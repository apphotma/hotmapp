import { elements } from './elements.js';
import { auth, db } from './firebase-config.js';
import { getUserProfile, updateUserProfile } from './database-service.js?v=1.1.6';
import { showToast } from './toast.js';
import { hideElement, showElement } from './utils.js';
import { subscribeToAuthChanges } from './auth-service.js';
import { uploadFile } from './database-service.js?v=1.1.6';
import { registerFcmToken, removeFcmToken, initFcmListener } from './fcm-service.js';

// Track if the user has interacted with the page (required for Vibration API)
let hasUserInteraction = false;
const setUserInteraction = () => { hasUserInteraction = true; window.removeEventListener('click', setUserInteraction); window.removeEventListener('keydown', setUserInteraction); };
window.addEventListener('click', setUserInteraction);
window.addEventListener('keydown', setUserInteraction);


// Play sound preview using Web Audio API to avoid external HTTP dependencies
export const playTone = (ctx, freq, duration, delay, type = 'sine', volume = 0.3) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
};

export const playSoundPreview = (toneName) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (toneName === 'default') {
        // Dual frequency chime: G5 (784Hz) then C6 (1046Hz)
        playTone(ctx, 784, 0.1, 0, 'sine');
        playTone(ctx, 1046, 0.2, 0.1, 'sine');
    } else if (toneName === 'bell') {
        // Bell ring: resonant decay
        playTone(ctx, 880, 0.8, 0, 'sine', 0.6);
        playTone(ctx, 1320, 0.6, 0, 'sine', 0.3); // overtone
    } else if (toneName === 'bubble') {
        // Bubble pop: rapid pitch sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } else if (toneName === 'digital') {
        // Digital beeps: high frequency square wave
        playTone(ctx, 1900, 0.05, 0, 'square', 0.15);
        playTone(ctx, 1900, 0.05, 0.08, 'square', 0.15);
    } else if (toneName === 'melody') {
        // Short arpeggio chime: G4 -> C5 -> E5 -> G5
        playTone(ctx, 392, 0.12, 0, 'sine', 0.2);
        playTone(ctx, 523, 0.12, 0.08, 'sine', 0.2);
        playTone(ctx, 659, 0.12, 0.16, 'sine', 0.2);
        playTone(ctx, 784, 0.25, 0.24, 'sine', 0.2);
    } else if (toneName === 'classic') {
        // Double phone ring
        playTone(ctx, 453, 0.15, 0, 'sine', 0.25);
        playTone(ctx, 440, 0.15, 0, 'sine', 0.25);
        playTone(ctx, 453, 0.15, 0.2, 'sine', 0.25);
        playTone(ctx, 440, 0.15, 0.2, 'sine', 0.25);
    }
};

/**
 * Triggers sound and vibration for incoming chat messages.
 */
export const playIncomingSound = () => {
    const messageTone = localStorage.getItem('hotmapp_notif_message_tone') || 'default';
    const vibrate = localStorage.getItem('hotmapp_notif_message_vibrate') !== 'false';
    const customBase64 = localStorage.getItem('hotmapp_notif_custom_tone_base64');

    // Trigger haptic vibration if enabled
    if (vibrate && hasUserInteraction && navigator.vibrate) {
        navigator.vibrate(100);
    }

    if (messageTone === 'none') {
        return;
    }

    if (messageTone === 'custom' && customBase64) {
        new Audio(customBase64).play().catch(err => console.warn("Failed to play custom tone:", err));
    } else {
        playSoundPreview(messageTone);
    }
};

/**
 * Helper to get the loop ringtone URL for calls.
 */
export const getCallRingtoneUrl = () => {
    const callTone = localStorage.getItem('hotmapp_notif_call_tone') || 'default';
    if (callTone === 'none') return '';
    if (callTone === 'classic') return 'https://upload.wikimedia.org/wikipedia/commons/3/34/Telephone_ring_double.wav';
    if (callTone === 'melody') return 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3';
    return 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'; // default incoming melodic ringtone
};

/**
 * Checks if vibration on call is enabled.
 */
export const shouldVibrateOnCall = () => {
    return localStorage.getItem('hotmapp_notif_call_vibrate') !== 'false';
};

/**
 * Sets up custom option item in select if custom tone exists
 */
const syncCustomToneOption = () => {
    const hasCustom = !!localStorage.getItem('hotmapp_notif_custom_tone_base64');
    const select = elements.notificationToneSelect;
    if (!select) return;

    let customOpt = select.querySelector('option[value="custom"]');

    if (hasCustom) {
        if (!customOpt) {
            customOpt = document.createElement('option');
            customOpt.value = 'custom';
            customOpt.textContent = 'Custom (Uploaded)';
            select.appendChild(customOpt);
        }
        if (elements.deleteCustomToneBtn) elements.deleteCustomToneBtn.style.display = 'inline-block';
    } else {
        if (customOpt) {
            select.removeChild(customOpt);
        }
        if (elements.deleteCustomToneBtn) elements.deleteCustomToneBtn.style.display = 'none';
    }
};

/**
 * Initializes notification settings triggers, forms, and handlers.
 */
export const initNotificationSettings = () => {
    // Helper to sync Push Notification settings and state
    const loadPushNotificationSettings = () => {
        const toggle = elements.pushNotificationsToggle;
        const tokenSection = elements.fcmTokenSection;
        const statusText = elements.fcmStatusText;
        const tokenPreview = elements.fcmTokenPreview;

        if (!toggle) return;

        const isEnabled = localStorage.getItem('hotmapp_push_notifications_enabled') !== 'false';
        toggle.checked = isEnabled;

        const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
        const hasNotificationSupport = ('Notification' in window) || isNative;
        const isPermissionGranted = isNative || (window.Notification && Notification.permission === 'granted');

        if (isEnabled && hasNotificationSupport && isPermissionGranted) {
            const token = localStorage.getItem('hotmapp_fcm_token');
            if (tokenSection) tokenSection.style.display = 'block';
            if (statusText) {
                statusText.textContent = 'Registered';
                statusText.style.color = '#008069';
            }
            if (tokenPreview) tokenPreview.textContent = token || 'Retrieving token...';
        } else {
            if (tokenSection) tokenSection.style.display = 'none';
            if (isEnabled && hasNotificationSupport && Notification.permission === 'denied') {
                localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                toggle.checked = false;
            } else if (!isEnabled) {
                toggle.checked = false;
            }
        }
    };

    // 1. Initial Load: load from localStorage
    const loadLocalSettings = () => {
        const messageTone = localStorage.getItem('hotmapp_notif_message_tone') || 'default';
        const messageVibrate = localStorage.getItem('hotmapp_notif_message_vibrate') !== 'false';
        const callTone = localStorage.getItem('hotmapp_notif_call_tone') || 'default';
        const callVibrate = localStorage.getItem('hotmapp_notif_call_vibrate') !== 'false';

        if (elements.notificationToneSelect) elements.notificationToneSelect.value = messageTone;
        if (elements.vibrateOnNotificationInput) elements.vibrateOnNotificationInput.checked = messageVibrate;
        if (elements.callRingtoneSelect) elements.callRingtoneSelect.value = callTone;
        if (elements.vibrateOnCallInput) elements.vibrateOnCallInput.checked = callVibrate;

        syncCustomToneOption();
        loadPushNotificationSettings();
    };

    // Load initial settings from disk
    loadLocalSettings();

    // Push Notifications Toggle
    elements.pushNotificationsToggle?.addEventListener('change', async (e) => {
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to configure push notifications", "warning");
            e.target.checked = false;
            return;
        }

        const checked = e.target.checked;
        if (checked) {
            try {
                showToast("Requesting notification permissions...", "info");
                const token = await registerFcmToken(user.uid);
                if (token) {
                    localStorage.setItem('hotmapp_push_notifications_enabled', 'true');
                    initFcmListener(user.uid);
                    showToast("Push notifications enabled successfully!", "success");
                } else {
                    localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                    e.target.checked = false;
                    showToast("FCM not supported or token failed to generate.", "warning");
                }
            } catch (err) {
                console.error("FCM registration failed:", err);
                try {
                    const { ref, push } = await import('./database-service.js');
                    await push(ref(db, 'debugLogs'), {
                        message: err.message || String(err),
                        stack: err.stack || null,
                        timestamp: Date.now(),
                        type: 'fcm_registration_error'
                    });
                } catch (dbErr) {
                    console.error("Failed to write log to db:", dbErr);
                }
                localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                e.target.checked = false;
                showToast(`Notification error: ${err.message || err}`, "error");
            }
        } else {
            try {
                await removeFcmToken(user.uid);
                localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                showToast("Push notifications disabled.", "info");
            } catch (err) {
                console.error("Failed to disable FCM:", err);
            }
        }
        loadPushNotificationSettings();
    });

    // Copy Push Token button handler
    elements.copyFcmTokenBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        const token = localStorage.getItem('hotmapp_fcm_token');
        if (token) {
            navigator.clipboard.writeText(token)
                .then(() => showToast("Push token copied to clipboard!", "success"))
                .catch(err => {
                    console.error("Copy failed:", err);
                    showToast("Failed to copy token.", "error");
                });
        }
    });

    // 2. Open Notification Modal
    elements.settingsNotificationBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        loadLocalSettings();
        showElement(elements.notificationSettingsModal, 'flex');
    });

    // 3. Close Notification Modal
    const closeModal = () => {
        hideElement(elements.notificationSettingsModal);
        showElement(elements.settingsModal, 'flex');
    };

    elements.closeNotificationSettingsModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
    });

    elements.notificationSettingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.notificationSettingsModal) {
            closeModal();
        }
    });

    // 4. Tone Preview Playback on Selection Change
    elements.notificationToneSelect?.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'custom') {
            const customBase64 = localStorage.getItem('hotmapp_notif_custom_tone_base64');
            if (customBase64) {
                new Audio(customBase64).play().catch(err => console.warn("Failed to play custom preview:", err));
            }
        } else if (value !== 'none') {
            playSoundPreview(value);
        }
    });

    elements.callRingtoneSelect?.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'classic') {
            new Audio('https://upload.wikimedia.org/wikipedia/commons/3/34/Telephone_ring_double.wav').play().catch(() => { });
        } else if (value === 'melody') {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3').play().catch(() => { });
        } else if (value === 'default') {
            new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3').play().catch(() => { });
        }
    });

    // 5. Custom Tone Upload trigger
    elements.uploadCustomToneBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        elements.customNotificationToneInput?.click();
    });

    elements.customNotificationToneInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB max
            showToast("Custom tone must be under 2MB", "warning");
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                // Save locally first
                localStorage.setItem('hotmapp_notif_custom_tone_base64', event.target.result);
                localStorage.setItem('hotmapp_notif_message_tone', 'custom');

                syncCustomToneOption();

                if (elements.notificationToneSelect) {
                    elements.notificationToneSelect.value = 'custom';
                }

                // Play preview to confirm upload
                new Audio(event.target.result).play().catch(err => console.warn("Custom play failed:", err));
                showToast("Custom tone uploaded locally", "info");

                // Sync with Firebase Storage if logged in
                const user = auth.currentUser;
                if (user) {
                    showToast("Uploading tone to cloud storage...", "info");
                    const path = `users/${user.uid}/custom_tones/${Date.now()}_${file.name}`;
                    const downloadUrl = await uploadFile(path, file);
                    localStorage.setItem('hotmapp_notif_custom_tone_url', downloadUrl);
                    showToast("Custom tone synced with cloud", "success");
                }
            } catch (err) {
                console.error("Custom tone upload error:", err);
                showToast("Error processing custom tone file", "error");
            }
        };
        reader.readAsDataURL(file);
    });

    // 6. Delete Custom Tone handler
    elements.deleteCustomToneBtn?.addEventListener('click', (e) => {
        e.preventDefault();

        localStorage.removeItem('hotmapp_notif_custom_tone_base64');
        localStorage.removeItem('hotmapp_notif_custom_tone_url');

        if (elements.notificationToneSelect) {
            elements.notificationToneSelect.value = 'default';
            localStorage.setItem('hotmapp_notif_message_tone', 'default');
        }

        syncCustomToneOption();
        showToast("Custom tone deleted", "info");
    });

    // 7. Form submission: Save preferences
    elements.notificationSettingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const messageTone = elements.notificationToneSelect?.value || 'default';
        const messageVibrate = elements.vibrateOnNotificationInput?.checked !== false;
        const callTone = elements.callRingtoneSelect?.value || 'default';
        const callVibrate = elements.vibrateOnCallInput?.checked !== false;
        const pushNotificationsEnabled = localStorage.getItem('hotmapp_push_notifications_enabled') !== 'false';

        localStorage.setItem('hotmapp_notif_message_tone', messageTone);
        localStorage.setItem('hotmapp_notif_message_vibrate', messageVibrate ? 'true' : 'false');
        localStorage.setItem('hotmapp_notif_call_tone', callTone);
        localStorage.setItem('hotmapp_notif_call_vibrate', callVibrate ? 'true' : 'false');

        try {
            const user = auth.currentUser;
            if (user) {
                const customUrl = localStorage.getItem('hotmapp_notif_custom_tone_url') || null;
                await updateUserProfile(user.uid, {
                    notificationSettings: {
                        messageTone,
                        messageVibrate,
                        customToneUrl: customUrl,
                        callTone,
                        callVibrate,
                        pushNotificationsEnabled
                    }
                });
            }
            showToast("Notification settings saved successfully", "success");
            closeModal();
        } catch (error) {
            console.error("Failed to save notification settings:", error);
            showToast("Failed to save settings", "error");
        }
    });

    // 8. Auto sync database preferences to LocalStorage on Auth change
    subscribeToAuthChanges(async (user) => {
        if (user) {
            try {
                const profile = await getUserProfile(user.uid);
                const settings = (profile && profile.notificationSettings) || {
                    messageTone: 'default',
                    messageVibrate: true,
                    callTone: 'default',
                    callVibrate: true,
                    pushNotificationsEnabled: true
                };

                localStorage.setItem('hotmapp_notif_message_tone', settings.messageTone || 'default');
                localStorage.setItem('hotmapp_notif_message_vibrate', settings.messageVibrate !== false ? 'true' : 'false');
                localStorage.setItem('hotmapp_notif_call_tone', settings.callTone || 'default');
                localStorage.setItem('hotmapp_notif_call_vibrate', settings.callVibrate !== false ? 'true' : 'false');
                localStorage.setItem('hotmapp_push_notifications_enabled', settings.pushNotificationsEnabled !== false ? 'true' : 'false');

                if (settings.pushNotificationsEnabled !== false) {
                    registerFcmToken(user.uid).catch((err) => {
                        console.warn("Auto FCM registration on login/sync failed:", err);
                    });
                    initFcmListener(user.uid);
                }

                if (settings.customToneUrl) {
                    localStorage.setItem('hotmapp_notif_custom_tone_url', settings.customToneUrl);
                    // Fetch file and convert to base64 if not already cached
                    if (!localStorage.getItem('hotmapp_notif_custom_tone_base64')) {
                        try {
                            const response = await fetch(settings.customToneUrl);
                            const blob = await response.blob();
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                localStorage.setItem('hotmapp_notif_custom_tone_base64', reader.result);
                                syncCustomToneOption();
                            };
                            reader.readAsDataURL(blob);
                        } catch (e) {
                            console.warn("Failed to fetch custom tone from cloud storage url:", e);
                        }
                    }
                }

                loadLocalSettings();
            } catch (err) {
                console.error("Failed to sync notification settings from profile:", err);
            }
        }
    });
};
