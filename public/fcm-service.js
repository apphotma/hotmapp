import { messagingPromise, VAPID_KEY, db } from './firebase-config.js';
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging.js";
import { ref, set } from './database-service.js';
import { showToast } from './toast.js';


// Helper to determine the type of user device
const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "Tablet";
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
        return "Mobile";
    }
    return "Desktop";
};

// Helper to sanitize the token key for Firebase Realtime Database path safety
const getSafeTokenKey = (token) => {
    return token.replace(/[\.\$\#\[\]\/]/g, '_');
};

/**
 * Registers native mobile push notifications using Capacitor PushNotifications.
 */
const registerNativePushToken = async (userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
            if (!PushNotifications) {
                return reject(new Error("Capacitor PushNotifications plugin is not available. Please sync native platforms."));
            }

            // 1. Request permission
            let permStatus = await PushNotifications.checkPermissions();
            let state = permStatus.receive || permStatus.display;
            
            if (state !== 'granted') {
                permStatus = await PushNotifications.requestPermissions();
                state = permStatus.receive || permStatus.display;
            }

            if (state !== 'granted') {
                if (state === 'denied') {
                    return reject(new Error("Notification permission is blocked. Please enable Notifications in your Android Settings -> Apps -> hotmapp."));
                }
                return reject(new Error("Push notification permission denied by user."));
            }

            // Create custom channel for calls
            if (PushNotifications.createChannel) {
                try {
                    await PushNotifications.createChannel({
                        id: 'calls',
                        name: 'Calls',
                        description: 'Incoming calls notifications',
                        sound: 'ringtone',
                        importance: 5,
                        visibility: 1,
                        vibration: true
                    });
                    console.log("FCM calls channel created successfully.");
                } catch (chErr) {
                    console.warn("Failed to create call notification channel:", chErr);
                }
            }

            let regListener, errListener;

            regListener = await PushNotifications.addListener('registration', async (token) => {
                try {
                    console.log("Native FCM registration token successfully generated:", token.value);
                    if (regListener) regListener.remove();
                    if (errListener) errListener.remove();

                    // Save token to database
                    const safeTokenKey = getSafeTokenKey(token.value);
                    const tokenRef = ref(db, `users/${userId}/fcmTokens/${safeTokenKey}`);

                    await set(tokenRef, {
                        token: token.value,
                        deviceType: "Mobile",
                        updatedAt: new Date().toISOString()
                    });

                    // Cache token locally
                    localStorage.setItem('hotmapp_fcm_token', token.value);
                    resolve(token.value);
                } catch (dbErr) {
                    reject(dbErr);
                }
            });

            errListener = await PushNotifications.addListener('registrationError', (error) => {
                if (regListener) regListener.remove();
                if (errListener) errListener.remove();
                reject(new Error("FCM registration error: " + (error.error || "Unknown native error")));
            });

            // Trigger registration on native system
            await PushNotifications.register();

        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Registers standard web push notifications using Firebase Web SDK.
 */
const registerWebPushToken = async (userId) => {
    const messaging = await messagingPromise;
    if (!messaging) {
        console.warn("FCM messaging is not initialized or supported in this browser.");
        return null;
    }

    try {
        // Register the background service worker explicitly
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        // Force service worker update check to bypass aggressive browser caching
        await registration.update();

        // Prompt user for notification permissions
        if (!('Notification' in window)) {
            throw new Error("Push notifications are not supported in this browser.");
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error("Notification permission denied by user.");
        }

        // Retrieve registration token
        const cleanedVapidKey = (VAPID_KEY && VAPID_KEY.trim() !== "YOUR_PUBLIC_VAPID_KEY_HERE" && VAPID_KEY.trim() !== "") ? VAPID_KEY.trim() : undefined;
        const token = await getToken(messaging, {
            vapidKey: cleanedVapidKey,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log("FCM registration token successfully generated:", token);

            // Save token to database
            const safeTokenKey = getSafeTokenKey(token);
            const tokenRef = ref(db, `users/${userId}/fcmTokens/${safeTokenKey}`);

            await set(tokenRef, {
                token: token,
                deviceType: getDeviceType(),
                updatedAt: new Date().toISOString()
            });

            // Cache token locally
            localStorage.setItem('hotmapp_fcm_token', token);
            return token;
        } else {
            console.warn("No FCM registration token generated. Request permission again.");
            return null;
        }
    } catch (error) {
        console.error("FCM registration token retrieval failed:", error);
        try {
            await set(ref(db, `debugLogs/last_fcm_error`), {
                message: error.message || String(error),
                stack: error.stack || null,
                timestamp: new Date().toISOString()
            });
        } catch (dbErr) {
            console.error("Failed to write fcm_service_error to db:", dbErr);
        }
        throw error;
    }
};

/**
 * Registers this client device for FCM notifications.
 * Requests notification permission, registers service worker/native token, and saves token in database.
 */
export const registerFcmToken = async (userId) => {
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (isNative) {
        return registerNativePushToken(userId);
    } else {
        return registerWebPushToken(userId);
    }
};

/**
 * Removes the registration token from the database.
 * Used during logout or when notifications are disabled.
 */
export const removeFcmToken = async (userId) => {
    const token = localStorage.getItem('hotmapp_fcm_token');
    if (!token) return;

    try {
        const safeTokenKey = getSafeTokenKey(token);
        const tokenRef = ref(db, `users/${userId}/fcmTokens/${safeTokenKey}`);
        await set(tokenRef, null);
        localStorage.removeItem('hotmapp_fcm_token');
        console.log("FCM token successfully revoked from database.");
    } catch (error) {
        console.error("FCM token revocation failed:", error);
    }
};

/**
 * Initializes listeners for foreground notifications.
 */
export const initFcmListener = async (userId) => {
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isNative) {
        const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
        if (PushNotifications) {
            const persistPendingNotificationChat = (chatId) => {
                if (!chatId) return;
                try {
                    localStorage.setItem('pending_chat_id', chatId);
                } catch (storageErr) {
                    console.warn('Could not persist pending chat id:', storageErr);
                }
            };

            const handleNativeNotificationClick = async (payload) => {
                if (!payload) return;
                const data = payload.notification?.data || payload.notification?.additionalData || payload.data || payload.additionalData || {};
                const chatId = data.chatId || data.chat_id || data.chatid;
                const recipientId = data.recipientId || data.recipient_id;

                if (!chatId) return;

                persistPendingNotificationChat(chatId);

                try {
                    if (typeof window.openChatWithUser === 'function') {
                        const targetUid = chatId.startsWith('group_') ? chatId : chatId.split('_').find(id => id !== recipientId && id !== undefined);
                        if (targetUid) {
                            await window.openChatWithUser(targetUid);
                        }
                    }
                } catch (openErr) {
                    console.error('Failed to open chat after native notification tap:', openErr);
                }
            };

            // Listen for foreground push messages on native app
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log("Foreground native push notification received:", notification);
                const title = notification.title || "New Notification";
                const messageText = notification.body || "You received a new message.";

                // Attempt an ACK when native push arrives in foreground
                try {
                    const data = notification.data || notification.additionalData || {};
                    const ackUrl = data.ackUrl;
                    const deliveryToken = data.deliveryToken;
                    const deliveryExpiry = data.deliveryExpiry;
                    const chatId = data.chatId;
                    const messageId = data.messageId;
                    const recipientId = data.recipientId;

                    console.log('Native foreground push ACK attempt', {
                        ackUrl: ackUrl,
                        chatId: chatId,
                        messageId: messageId,
                        recipientId: recipientId,
                        deliveryExpiry: deliveryExpiry
                    });

                    if (ackUrl && deliveryToken && deliveryExpiry && chatId && messageId && recipientId) {
                        fetch(ackUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chatId, messageId, recipientId, deliveryToken, deliveryExpiry }),
                            keepalive: true,
                            mode: 'cors'
                        }).then((response) => {
                            console.log('Native delivery ACK response', {
                                status: response.status,
                                ok: response.ok,
                                chatId,
                                messageId,
                                recipientId
                            });
                        }).catch(err => {
                            console.warn('Native delivery ACK failed:', err, { chatId, messageId, recipientId });
                        });
                    } else {
                        console.warn('Native delivery ACK skipped, missing payload', {
                            ackUrl: ackUrl,
                            chatId: chatId,
                            messageId: messageId,
                            recipientId: recipientId
                        });
                    }
                } catch (ackErr) {
                    console.warn('Error sending native delivery ACK:', ackErr);
                }

                try {
                    import('./notifications-settings.js').then(({ playIncomingSound }) => {
                        playIncomingSound();
                    }).catch(soundErr => {
                        console.warn("Failed to dynamically load and play sound:", soundErr);
                    });
                } catch (soundErr) {
                    console.warn("Failed to play incoming message chime:", soundErr);
                }
                showToast(`🔔 ${title}: ${messageText}`, "info");
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log("Native notification action performed:", notification);
                handleNativeNotificationClick(notification);
            });
        }
        return;
    }

    const messaging = await messagingPromise;
    if (!messaging) return;

    // Listen for foreground push messages
    onMessage(messaging, (payload) => {
        console.log("Foreground push notification received:", payload);

        const title = payload.notification?.title || "New Notification";
        const messageText = payload.notification?.body || "You received a new message.";

        if (payload.notification) {
            const trySendAck = async () => {
                try {
                    const data = payload.data || {};
                    const ackUrl = data.ackUrl;
                    const deliveryToken = data.deliveryToken;
                    const deliveryExpiry = data.deliveryExpiry;
                    const chatId = data.chatId;
                    const messageId = data.messageId;
                    const recipientId = data.recipientId;

                    console.log('Web foreground push ACK attempt', {
                        ackUrl: ackUrl,
                        chatId: chatId,
                        messageId: messageId,
                        recipientId: recipientId,
                        deliveryExpiry: deliveryExpiry
                    });

                    if (ackUrl && deliveryToken && deliveryExpiry && chatId && messageId && recipientId) {
                        const response = await fetch(ackUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chatId, messageId, recipientId, deliveryToken, deliveryExpiry }),
                            keepalive: true,
                            mode: 'cors'
                        });
                        console.log('Web foreground delivery ACK response', {
                            status: response.status,
                            ok: response.ok,
                            chatId: chatId,
                            messageId: messageId,
                            recipientId: recipientId
                        });
                    } else {
                        console.warn('Web foreground delivery ACK skipped, missing payload', {
                            ackUrl: ackUrl,
                            chatId: chatId,
                            messageId: messageId,
                            recipientId: recipientId
                        });
                    }
                } catch (ackErr) {
                    console.warn('Error sending web foreground delivery ACK:', ackErr);
                }
            };

            trySendAck();
            navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, {
                    body: messageText,
                    icon: '/hotmapp-logo.png',
                    badge: '/hotmapp-logo.png',
                    data: payload.data
                });
            }).catch(swErr => {
                console.warn("Failed to dispatch native notification via service worker:", swErr);
                // Standard browser notification fallback
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        body: messageText,
                        icon: '/hotmapp-logo.png',
                        badge: '/hotmapp-logo.png',
                        data: payload.data
                    });
                }
            });
        } else {
            // Otherwise, play the message chime sound and show the custom in-app toast
            try {
                import('./notifications-settings.js').then(({ playIncomingSound }) => {
                    playIncomingSound();
                }).catch(soundErr => {
                    console.warn("Failed to dynamically load and play sound:", soundErr);
                });
            } catch (soundErr) {
                console.warn("Failed to play incoming message chime:", soundErr);
            }
            showToast(`🔔 ${title}: ${messageText}`, "info");
        }
    });
};

/**
 * Clears all delivered push notifications from the system notification tray.
 * On Android, this also automatically clears/resets the app launcher icon badge count.
 */
export const clearDeliveredNotifications = async () => {
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (!isNative) return;

    try {
        const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
        if (PushNotifications) {
            await PushNotifications.removeAllDeliveredNotifications();
            console.log("Delivered notifications cleared natively.");
        }
    } catch (err) {
        console.warn("Failed to clear native notifications:", err);
    }
};

// Automatically register App listener to clear notifications when app comes to foreground
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    const { App } = window.Capacitor.Plugins;
    App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
            clearDeliveredNotifications();
        }
    });
}

// Clear notifications immediately on startup/script loading
clearDeliveredNotifications();

// Debug helpers: print cached FCM token and pending chat id to console
try {
    const _hotmapp_token = localStorage.getItem('hotmapp_fcm_token');
    const _pending_chat = localStorage.getItem('pending_chat_id');
    console.log('DEBUG: hotmapp_fcm_token=', _hotmapp_token);
    console.log('DEBUG: pending_chat_id=', _pending_chat);
} catch (dbgErr) {
    console.warn('DEBUG: reading cached token/pending chat failed', dbgErr);
}

export const debugLogFcmState = () => {
    try {
        const t = localStorage.getItem('hotmapp_fcm_token');
        const p = localStorage.getItem('pending_chat_id');
        console.log('DEBUG CALL: hotmapp_fcm_token=', t, 'pending_chat_id=', p);
    } catch (e) {
        console.warn('DEBUG CALL: failed to read state', e);
    }
};
