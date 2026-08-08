import { elements } from './elements.js';
import { showToast } from './toast.js';
import { loginWithCustomToken, logoutUser, subscribeToAuthChanges, setAuthPersistence, setupRecaptcha, sendSmsCode } from './auth-service.js?v=1.1.4';
import { saveUserProfile, getUserProfile, getUserIdByPhoneNumber, updateUserProfile, monitorPresence, createLinkingSession, listenForSessionAuth, monitorDeviceSession, validateAndCleanupSessions, updateLinkedDeviceLastSeen, processInvitation, uploadFile } from './database-service.js?v=1.1.4';
import { auth, db } from './firebase-config.js';
import { ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { registerFcmToken, removeFcmToken } from './fcm-service.js';
import { hideElement, showElement, setElementText, getAvatarUrl, cropToSquare } from './utils.js';
import { showLockScreen } from './app-lock.js';
import { initUserKeys, setStoredKey, getStoredKey, encryptKeyPair, decryptKeyPair } from './crypto-helper.js';

export const initAuth = () => {
    let isSignUp = false;
    let mainSessionUnsubscribe = null;
    let authSignupPhotoBlob = null;

    // Parse URL invitation tokens (handle both query string and hash path)
    const urlParams = new URLSearchParams(window.location.search);
    let refToken = urlParams.get('ref');
    if (!refToken) {
        const hash = window.location.hash;
        const questionMarkIndex = hash.indexOf('?');
        if (questionMarkIndex !== -1) {
            const queryString = hash.substring(questionMarkIndex);
            const hashParams = new URLSearchParams(queryString);
            refToken = hashParams.get('ref');
        }
    }
    if (refToken) {
        localStorage.setItem('pending_invite_token', refToken);
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
    }

    const chatIdFromUrl = urlParams.get('chatId');
    if (chatIdFromUrl) {
        localStorage.setItem('pending_chat_id', chatIdFromUrl);
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
    }

    // Capacitor Native Deep Linking listener
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('appUrlOpen', (data) => {
            try {
                const url = new URL(data.url);
                let refToken = url.searchParams.get('ref');
                if (!refToken && url.hash) {
                    const qIdx = url.hash.indexOf('?');
                    if (qIdx !== -1) {
                        const hashParams = new URLSearchParams(url.hash.substring(qIdx));
                        refToken = hashParams.get('ref');
                    }
                }
                if (refToken) {
                    localStorage.setItem('pending_invite_token', refToken);
                    if (auth.currentUser) {
                        window.checkAndProcessPendingInvitation();
                    }
                }
            } catch (err) {
                console.error("Capacitor appUrlOpen handling error:", err);
            }
        });
    }

    // Global invitation processing method
    window.checkAndProcessPendingInvitation = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const pendingToken = localStorage.getItem('pending_invite_token');
        if (!pendingToken) return;

        // Clear immediately to prevent repeat triggers
        localStorage.removeItem('pending_invite_token');
        
        const isNewReg = localStorage.getItem('is_new_registration') === 'true';
        localStorage.removeItem('is_new_registration');

        showToast("Processing invitation...", "info");
        try {
            const result = await processInvitation(pendingToken, user.uid, isNewReg);
            if (result.success) {
                if (result.alreadyFriends) {
                    showToast(`You are already friends with ${result.ownerName}!`, "info");
                } else {
                    showToast(`Congratulations! You are now connected with ${result.ownerName}.`, "success");
                }
                if (result.ownerId) {
                    if (typeof window.openChatWithUser === 'function') {
                        window.openChatWithUser(result.ownerId);
                    }
                }
            } else {
                showToast(`Invitation error: ${result.reason}`, "error");
            }
        } catch (error) {
            console.error("Failed to process invitation:", error);
            showToast("Failed to process invitation link", "error");
        }
    };

    const processPendingChatNavigation = async (chatId) => {
        const user = auth.currentUser;
        if (!user || !chatId) return;

        const targetUid = chatId.startsWith('group_')
            ? chatId
            : chatId.split('_').find(id => id !== user.uid);

        if (!targetUid) return;

        try {
            if (typeof window.openChatWithUser === 'function') {
                await window.openChatWithUser(targetUid);
            }
        } catch (err) {
            console.error("Failed to open chat from notification click:", err);
        }
    };

    window.addEventListener('message', (event) => {
        const payload = event.data;
        if (!payload || payload.type !== 'notification-click') return;
        processPendingChatNavigation(payload.chatId);
    });

    const buildNewUserProfile = (fullname, phoneNumber, photoURL = null) => ({
        fullname: fullname || 'User',
        phoneNumber,
        createdAt: new Date().toISOString(),
        profilePhoto: getAvatarUrl(fullname, photoURL)
    });

    /**
     * Validates a single input field and updates its error container
     */
    const validateField = (input) => {
        const uiKey = input.dataset.ui;
        if (!uiKey) return true;
        
        const errorEl = document.querySelector(`[data-ui="${uiKey}-error"]`);
        if (!errorEl) return true;

        let message = "";
        if (uiKey === 'auth-phone') {
            const val = input.value.trim();
            if (!val) {
                message = "This field is required";
            } else if (!val.startsWith('+')) {
                message = "Phone number must start with '+' and country code (e.g. +16505550101)";
            }
        } else if (!input.checkValidity()) {
            if (input.validity.valueMissing) message = "This field is required";
            else if (input.validity.tooShort) message = `Minimum ${input.minLength} characters required`;
        }

        errorEl.textContent = message;
        input.classList.toggle('invalid', !!message);
        return !message;
    };

    /**
     * Validates all data-ui inputs within a form
     */
    const validateForm = (form) => {
        const inputs = form.querySelectorAll('input[data-ui]');
        let isValid = true;
        inputs.forEach(input => {
            if (!validateField(input)) isValid = false;
        });
        return isValid;
    };

    // Attach real-time validation listeners
    elements.authForm?.querySelectorAll('input[data-ui]').forEach(input => {
        input.addEventListener('input', () => validateField(input));
        input.addEventListener('blur', () => validateField(input));
    });

    const initQRLinking = () => {
        let sessionUnsubscribe = null;

        const stopLinking = () => {
            if (sessionUnsubscribe) sessionUnsubscribe();
            hideElement(elements.linkQrDisplayModal);
            hideElement(elements.linkQrLoading);
        };

        elements.linkDeviceLoginBtn?.addEventListener('click', async () => {
            showElement(elements.linkQrDisplayModal, 'flex');
            if (elements.linkQrContainer) elements.linkQrContainer.innerHTML = '';
            hideElement(elements.linkQrLoading);

            try {
                const { sessionId, customToken } = await createLinkingSession(); // Get both session ID and custom token
                
                new QRCode(elements.linkQrContainer, {
                    text: `hotmapp_link:${sessionId}:${customToken}`, // Include custom token in QR code
                    width: 220,
                    height: 220,
                    colorDark: '#111827',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.L
                });

                 sessionUnsubscribe = listenForSessionAuth(sessionId, async (uid, encryptedSession, deviceKey) => {
                    try {
                        showToast("Session authorized by other device! Syncing...", "info");
                        if (encryptedSession) {
                            try {
                                showToast("Decrypting credentials...", "info");
                                console.log("Attempting to decrypt session...");
                                const base64ToBuffer = (b64) => {
                                    const binary = atob(b64);
                                    const len = binary.length;
                                    const bytes = new Uint8Array(len);
                                    for (let i = 0; i < len; i++) {
                                        bytes[i] = binary.charCodeAt(i);
                                    }
                                    return bytes.buffer;
                                };
                                const ciphertext = base64ToBuffer(encryptedSession.ciphertext);
                                const iv = base64ToBuffer(encryptedSession.iv);
                                
                                const encoder = new TextEncoder();
                                const passcodeBytes = encoder.encode(customToken);
                                const hash = await crypto.subtle.digest("SHA-256", passcodeBytes);
                                const aesKey = await crypto.subtle.importKey(
                                    "raw",
                                    hash,
                                    { name: "AES-GCM" },
                                    false,
                                    ["decrypt"]
                                );
                                
                                const decryptedBuffer = await crypto.subtle.decrypt(
                                    { name: "AES-GCM", iv },
                                    aesKey,
                                    ciphertext
                                );
                                
                                const decoder = new TextDecoder();
                                const decryptedStr = decoder.decode(decryptedBuffer);
                                const sessionData = JSON.parse(decryptedStr);
                                console.log("Session decrypted successfully. Keys present in sessionData:", Object.keys(sessionData || {}));

                                if (sessionData && sessionData.authKey && sessionData.authVal) {
                                    showToast("Saving credentials locally...", "info");
                                    console.log("Setting localStorage key:", sessionData.authKey);
                                    localStorage.setItem(sessionData.authKey, sessionData.authVal);
                                    localStorage.setItem('isLinkedDevice', 'true');
                                    localStorage.setItem('linkedDeviceSessionId', deviceKey || sessionId);
                                    
                                    // Also save the Firebase Auth state to IndexedDB (firebaseLocalStorage)
                                    try {
                                        const fdb = await new Promise((resolve, reject) => {
                                            const request = indexedDB.open("firebaseLocalStorageDb");
                                            request.onsuccess = e => resolve(e.target.result);
                                            request.onerror = e => reject(e.target.error);
                                        });
                                        if (fdb.objectStoreNames.contains("firebaseLocalStorage")) {
                                            const transaction = fdb.transaction("firebaseLocalStorage", "readwrite");
                                            const store = transaction.objectStore("firebaseLocalStorage");
                                            const parsedAuthVal = JSON.parse(sessionData.authVal);
                                            await new Promise((res, rej) => {
                                                const putRequest = store.put(parsedAuthVal, sessionData.authKey);
                                                putRequest.onsuccess = () => res();
                                                putRequest.onerror = () => rej(putRequest.error);
                                            });
                                            console.log("Firebase Auth state saved to IndexedDB successfully.");
                                        } else {
                                            console.warn("firebaseLocalStorage store not found in target IndexedDB.");
                                        }
                                    } catch (dbErr) {
                                        console.error("Failed to save Firebase Auth state to IndexedDB on new device:", dbErr);
                                    }

                                    // Save the E2EE keys to IndexedDB on the new device
                                    if (sessionData.e2eeKeys) {
                                        try {
                                            console.log("Saving E2EE keys to IndexedDB...");
                                            await setStoredKey(uid, sessionData.e2eeKeys);
                                            console.log("E2EE keys saved successfully.");
                                        } catch (dbErr) {
                                            console.error("Failed to save E2EE keys on new device:", dbErr);
                                        }
                                    }
                                    // Show success and force a reload to initialize the app with the new session and keys
                                    showToast("Logged in successfully! Reloading...", "success");
                                    if (elements.linkQrLoading) {
                                        elements.linkQrLoading.style.display = 'flex'; // Use flex to center spinner
                                    }
                                    
                                    if (sessionUnsubscribe) sessionUnsubscribe();
                                    
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 1000);
                                } else {
                                    showToast("Failed to link device: Invalid session data received.", "error");
                                }
                            } catch (decryptErr) {
                                console.error("Session decryption failed:", decryptErr);
                                showToast("Failed to link device: Decryption error.", "error");
                            }
                        }
                    } catch (loginErr) {
                        console.error("Link authentication failed:", loginErr);
                        showToast("Failed to authenticate linked session", "error");
                    }
                });
            } catch (err) {
                showToast("Failed to initialize QR linking", "error");
            }
        });

        elements.closeLinkQrDisplayModalBtn?.addEventListener('click', stopLinking);
    };


    // Ensure the auth overlay is visible initially as a landing page
    showElement(elements.authOverlay, 'flex');
    // Hide main application content until authentication is confirmed
    hideElement(elements.mainAppContent);

    // Monitor Auth State
    subscribeToAuthChanges(async (user) => {
        if (mainSessionUnsubscribe) {
            mainSessionUnsubscribe();
            mainSessionUnsubscribe = null;
        }

        if (user) {
            // Keep loading screen active and hide login overlay while credentials/keys resolve
            if (elements.appLoadingScreen) {
                elements.appLoadingScreen.classList.remove('hidden');
            }
            hideElement(elements.authOverlay);

            // On linked devices, validate the session on startup
            const isLinked = localStorage.getItem('isLinkedDevice') === 'true';
            if (isLinked) {
                const sessionId = localStorage.getItem('linkedDeviceSessionId');
                validateAndCleanupSessions(user.uid, sessionId);
                updateLinkedDeviceLastSeen(user.uid, sessionId); // Update last active time
            } else {
                // Monitor main session to enforce single active browser/device login
                const mainSessionRef = ref(db, `users/${user.uid}/mainSessionId`);
                mainSessionUnsubscribe = onValue(mainSessionRef, async (snapshot) => {
                    const dbSessionId = snapshot.val();
                    const localSessionId = localStorage.getItem('mainSessionId');

                    if (dbSessionId) {
                        if (localSessionId && dbSessionId !== localSessionId) {
                            showToast("Logged out because you logged in on another device.", "warning");
                            
                            if (mainSessionUnsubscribe) {
                                mainSessionUnsubscribe();
                                mainSessionUnsubscribe = null;
                            }
                            localStorage.removeItem('mainSessionId');
                            localStorage.removeItem('hotmapp_cart_data');
                            localStorage.removeItem('hotmapp_saved_data');
                            localStorage.removeItem('hotmapp_app_lock_pin');
                            localStorage.removeItem('hotmapp_app_lock_duration');
                            
                            try {
                                await removeFcmToken(user.uid);
                                await logoutUser();
                            } catch (logoutErr) {
                                console.error("Firebase logout failed:", logoutErr);
                            }
                            
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        } else if (!localSessionId) {
                            // No local session ID exists yet (new browser/login).
                            // Generate a new session ID to claim active login and force logout on other devices.
                            const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
                            localStorage.setItem('mainSessionId', newSessionId);
                            await set(ref(db, `users/${user.uid}/mainSessionId`), newSessionId);
                        }
                    } else {
                        // DB empty, initialize it
                        const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
                        localStorage.setItem('mainSessionId', newSessionId);
                        await set(ref(db, `users/${user.uid}/mainSessionId`), newSessionId);
                    }
                });
            }

            try {
                const profile = await getUserProfile(user.uid);
                if (profile) {
                    console.log("Authenticated as:", profile.fullname);
                    
                    // Initialize E2EE Keys
                    try {
                        if (isLinked) {
                            // Start listening to the session status for revocation
                            const sessionId = localStorage.getItem('linkedDeviceSessionId');
                            if (sessionId) {
                                monitorDeviceSession(user.uid, sessionId, async () => {
                                    showToast("This session has been revoked by the main device.", "warning");
                                    localStorage.removeItem('isLinkedDevice');
                                    localStorage.removeItem('linkedDeviceSessionId');
                                    localStorage.removeItem('hotmapp_cart_data');
                                    localStorage.removeItem('hotmapp_saved_data');
                                    localStorage.removeItem('hotmapp_app_lock_pin');
                                    localStorage.removeItem('hotmapp_app_lock_duration');
                                    
                                    try {
                                        await removeFcmToken(user.uid);
                                        await logoutUser();
                                    } catch (logoutErr) {
                                        console.error("Firebase logout on revocation failed:", logoutErr);
                                    }
                                    
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 1500);
                                });
                            }

                            // On a linked device, we must NOT generate new keys or overwrite the profile's public key if one already exists
                            const stored = await getStoredKey(user.uid);
                            if (!stored || !stored.publicKey || !stored.privateKey) {
                                console.warn("Linked device is missing local E2EE keys. E2EE decryption will not be available on this device, but we will NOT generate new keys to avoid breaking the main device.");
                            } else if (profile.publicKey && (
                                !stored.publicKey ||
                                stored.publicKey.x !== profile.publicKey.x ||
                                stored.publicKey.y !== profile.publicKey.y ||
                                stored.publicKey.crv !== profile.publicKey.crv ||
                                stored.publicKey.kty !== profile.publicKey.kty
                            )) {
                                console.error("Linked device E2EE key mismatch with profile. We will NOT overwrite the profile public key to avoid breaking the main device.");
                            }
                        } else {
                            // Standard device behavior: only generate keys if they don't exist in the database profile
                            if (!profile.publicKey) {
                                const pubKeyJwk = await initUserKeys(user.uid);
                                if (pubKeyJwk) {
                                    await updateUserProfile(user.uid, { publicKey: pubKeyJwk });
                                    console.log("E2EE Public Key uploaded/updated successfully!");
                                }
                            } else {
                                // If they exist in DB, but not in local storage (e.g. logging into new browser),
                                // we restore them automatically.
                                 const stored = await getStoredKey(user.uid);
                                 const privateProfileSnapshot = await get(ref(db, `users/${user.uid}/encryptedKeyPair`));
                                 const dbEncryptedKeyPair = privateProfileSnapshot.val();

                                 if (!stored || !stored.publicKey || !stored.privateKey) {
                                     console.warn("E2EE keys exist in database but are missing locally. Syncing keys...");
                                     if (dbEncryptedKeyPair) {
                                         try {
                                             const keyPair = await decryptKeyPair(dbEncryptedKeyPair, user.uid);
                                             await setStoredKey(user.uid, keyPair);
                                             console.log("E2EE keys successfully restored from database!");
                                         } catch (decErr) {
                                             console.error("Failed to restore E2EE keys on startup:", decErr);
                                         }
                                     }
                                 } else if (!dbEncryptedKeyPair) {
                                     console.log("Backing up existing local E2EE keys to database...");
                                     try {
                                         const encrypted = await encryptKeyPair(stored, user.uid);
                                         await updateUserProfile(user.uid, { encryptedKeyPair: encrypted });
                                         console.log("E2EE keys successfully backed up to database!");
                                     } catch (encErr) {
                                         console.error("Failed to back up E2EE keys to database:", encErr);
                                     }
                                 }
                            }
                        }
                    } catch (e) {
                        console.error("Failed to initialize E2EE keys:", e);
                    }
                    
                    // Update Global Header
                    if (elements.headerUserName) elements.headerUserName.textContent = profile.fullname;
                    if (elements.headerUserAvatar) {
                        elements.headerUserAvatar.src = getAvatarUrl(profile.fullname, profile.profilePhoto);
                    }

                    // Start real-time presence tracking
                    monitorPresence(user.uid);
                } else {
                    console.warn("No user profile found for UID:", user.uid);
                }
            } catch (err) {
                console.error("Error loading user profile on auth state change:", err);
                showToast("Error loading user profile. Please check your connection.", "error");
            }

            // Remove loading screen from layout immediately if user is logged in
            // Remove loading screen from layout smoothly if user is logged in
            if (elements.appLoadingScreen) {
                elements.appLoadingScreen.classList.add('hidden');
            }

            enterApp();
        } else {
            // User is logged out: Show landing page, hide application content
            showElement(elements.authOverlay, 'flex');
            if (elements.authOverlay) elements.authOverlay.style.opacity = '1';
            hideElement(elements.mainAppContent);

            // Hide loading screen so user can interact with the sign-in form
            if (elements.appLoadingScreen) {
                elements.appLoadingScreen.classList.add('hidden');
            }
        }
    });

    // Load remembered phone if it exists
    const savedPhone = localStorage.getItem('rememberedPhone');
    if (savedPhone && elements.authForm) {
        const phoneInput = elements.authForm.querySelector('[name="phone"]');
        if (phoneInput) phoneInput.value = savedPhone;
        if (elements.rememberMeCheckbox) elements.rememberMeCheckbox.checked = true;
    }

    const enterApp = () => {
        if (elements.authOverlay) {
            elements.authOverlay.style.transition = 'opacity 0.5s ease';
            elements.authOverlay.style.opacity = '0';
            setTimeout(() => {
                hideElement(elements.authOverlay);
            }, 500);
            showElement(elements.mainAppContent, 'block');

            // Trigger App Lock Screen if enabled
            if (localStorage.getItem('hotmapp_app_lock_pin')) {
                showLockScreen();
            }

            // Automatically direct the user to the chat view
            elements.chatsNav?.click();

            // Auto-scroll to the newest message upon entry
            if (elements.messagesContainer) {
                elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
            }

            // Check and process any pending invitations after entry
            setTimeout(async () => {
                if (typeof window.checkAndProcessPendingInvitation === 'function') {
                    window.checkAndProcessPendingInvitation();
                }

                const pendingChatId = localStorage.getItem('pending_chat_id');
                if (pendingChatId) {
                    localStorage.removeItem('pending_chat_id');
                    await processPendingChatNavigation(pendingChatId);
                }
            }, 1000);
        }
    };

    let confirmationResult = null;
    let otpCooldownInterval = null;
    let otpThrottleUntil = 0;

    const formatAuthErrorMessage = (error) => {
        if (!error || !error.code) return error?.message || 'Authentication failed. Please try again.';

        switch (error.code) {
            case 'auth/too-many-requests':
                return 'Too many verification attempts. Please wait 24 hours before requesting a new code.';
            case 'auth/quota-exceeded':
                return 'Verification service is temporarily unavailable. Please try again in a few minutes.';
            case 'auth/invalid-phone-number':
                return 'Please enter a valid phone number with country code.';
            case 'auth/code-expired':
                return 'The verification code has expired. Please request a fresh code.';
            case 'auth/invalid-verification-code':
                return 'Invalid verification code. Please check and try again.';
            default:
                return error.message || 'Authentication failed. Please try again.';
        }
    };

    const startOtpCooldown = () => {
        if (otpCooldownInterval) clearInterval(otpCooldownInterval);
        const btn = elements.resendOtpBtn;
        if (!btn) return;
        let secondsLeft = 60;
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.style.color = 'var(--muted)';
        btn.textContent = `Resend code in ${secondsLeft}s`;
        otpCooldownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                clearInterval(otpCooldownInterval);
                otpCooldownInterval = null;
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.style.color = 'var(--brand-dark)';
                btn.textContent = 'Resend Code';
            } else {
                btn.textContent = `Resend code in ${secondsLeft}s`;
            }
        }, 1000);
    };

    const stopOtpCooldown = () => {
        if (otpCooldownInterval) {
            clearInterval(otpCooldownInterval);
            otpCooldownInterval = null;
        }
        const btn = elements.resendOtpBtn;
        if (btn) {
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
            btn.style.color = 'var(--muted)';
            btn.textContent = 'Resend code in 60s';
        }
    };

    const toggleAuthMode = () => {
        isSignUp = !isSignUp;
        
        confirmationResult = null;
        otpThrottleUntil = 0;
        stopOtpCooldown();
        if (elements.authPhoneInput) elements.authPhoneInput.disabled = false;
        if (elements.authFullnameInput) elements.authFullnameInput.disabled = false;
        hideElement(elements.otpGroup);
        if (elements.authOtpInput) {
            elements.authOtpInput.value = '';
            elements.authOtpInput.required = false;
        }

        const nameGroup = document.querySelector('#name-group');
        const authPhotoGroup = document.querySelector('#auth-photo-group');
        if (nameGroup) (isSignUp ? showElement(nameGroup, 'block') : hideElement(nameGroup));
        if (authPhotoGroup) (isSignUp ? showElement(authPhotoGroup, 'block') : hideElement(authPhotoGroup));
        if (elements.authFullnameInput) elements.authFullnameInput.required = isSignUp;

        if (!isSignUp) {
            authSignupPhotoBlob = null;
            if (elements.authProfilePhotoPreview) {
                elements.authProfilePhotoPreview.src = getAvatarUrl('User', '');
            }
        }

        setElementText(elements.authTitle, isSignUp ? 'Create Account' : 'Welcome back');
        
        setElementText(elements.authSubtitle, isSignUp 
            ? 'Join Hotmapp to start shopping' 
            : 'Sign in to continue to Hotmapp');
        
        setElementText(elements.authSubmitBtn, isSignUp ? 'Create Account' : 'Sign In');
        
        const toggleText = document.querySelector('#auth-toggle-text');
        setElementText(toggleText, isSignUp 
            ? 'Already have an account?' 
            : "Don't have an account?");
        
        setElementText(elements.authToggleBtn, isSignUp ? 'Sign In' : 'Sign Up');

        // Hide auth options (Remember Me) in Sign Up mode
        if (elements.authOptions) (isSignUp ? hideElement(elements.authOptions) : showElement(elements.authOptions, 'flex'));

        if (elements.linkDeviceLoginBtn) {
            const displayStyle = window.getComputedStyle(elements.linkDeviceLoginBtn).display;
            (isSignUp ? hideElement(elements.linkDeviceLoginBtn) : showElement(elements.linkDeviceLoginBtn, displayStyle !== 'none' ? displayStyle : 'block'));
        }
    };

    elements.authToggleBtn?.addEventListener('click', toggleAuthMode);

    elements.uploadAuthProfilePhotoBtn?.addEventListener('click', () => {
        elements.authProfilePhotoInput?.click();
    });

    elements.authProfilePhotoInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const blob = await cropToSquare(file, 400, 0.85);
            authSignupPhotoBlob = blob;
            const previewUrl = URL.createObjectURL(blob);
            if (elements.authProfilePhotoPreview) {
                elements.authProfilePhotoPreview.src = previewUrl;
            }
        } catch (err) {
            console.error('Error processing signup profile photo:', err);
            showToast('Could not process profile photo. Please try a different image.', 'error');
        } finally {
            if (e.target) e.target.value = '';
        }
    });

    elements.removeAuthProfilePhotoBtn?.addEventListener('click', () => {
        authSignupPhotoBlob = null;
        if (elements.authProfilePhotoPreview) {
            elements.authProfilePhotoPreview.src = getAvatarUrl('User', '');
        }
    });

    elements.editPhoneBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        confirmationResult = null;
        otpThrottleUntil = 0;
        stopOtpCooldown();
        
        if (window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier.clear();
            } catch (clearErr) {
                console.warn("Error clearing recaptcha verifier on phone edit:", clearErr);
            }
            window.recaptchaVerifier = null;
        }

        if (elements.authPhoneInput) elements.authPhoneInput.disabled = false;
        if (elements.authFullnameInput) elements.authFullnameInput.disabled = false;
        
        hideElement(elements.otpGroup);
        if (elements.authOtpInput) {
            elements.authOtpInput.value = '';
            elements.authOtpInput.required = false;
        }
        
        elements.authSubmitBtn.innerHTML = isSignUp ? 'Create Account' : 'Sign In';
    });

    elements.resendOtpBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = elements.resendOtpBtn;
        if (btn.disabled) return;

        const phone = elements.authPhoneInput ? elements.authPhoneInput.value.trim() : '';
        if (!phone) {
            showToast("Phone number is required", "error");
            return;
        }

        if (Date.now() < otpThrottleUntil) {
            showToast("Too many verification attempts. Please wait 24 hours before requesting a new code.", "error");
            return;
        }

        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.textContent = 'Sending...';

        try {
            confirmationResult = await sendSmsCode(phone);
            showToast("New verification code sent!", "success");
            startOtpCooldown();
        } catch (err) {
            console.error("Resend OTP failed:", err);
            showToast("Failed to resend code: " + err.message, "error");
            btn.disabled = false;
            btn.style.cursor = 'pointer';
            btn.style.color = 'var(--brand-dark)';
            btn.textContent = 'Resend Code';
        }
    });

    elements.authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = elements.authSubmitBtn;
        const originalContent = btn.innerHTML;
        const fullname = elements.authFullnameInput ? elements.authFullnameInput.value.trim() : '';
        const phone = elements.authPhoneInput ? elements.authPhoneInput.value.trim() : '';
        const otpCode = elements.authOtpInput ? elements.authOtpInput.value.trim() : '';

        // Clear error messages
        const phoneError = document.querySelector('[data-ui="auth-phone-error"]');
        const otpError = document.querySelector('[data-ui="auth-otp-error"]');
        if (phoneError) phoneError.textContent = '';
        if (otpError) otpError.textContent = '';

        if (!phone) {
            if (phoneError) phoneError.textContent = 'Phone number is required';
            return;
        }

        if (!isSignUp) {
            const existingUserId = await getUserIdByPhoneNumber(phone);
            if (!existingUserId) {
                showToast('No account found for this phone number. Please sign up first.', 'info');
                if (!isSignUp) toggleAuthMode();
                return;
            }
        }

        if (isSignUp && !fullname) {
            const nameError = document.querySelector('[data-ui="auth-fullname-error"]');
            if (nameError) nameError.textContent = 'Full name is required';
            return;
        }

        try {
            btn.disabled = true;
            
            if (!confirmationResult) {
                // Phase 1: Send SMS OTP
                if (!phone.startsWith('+')) {
                    if (phoneError) phoneError.textContent = 'Phone number must start with "+" and country code (e.g. +16505550101)';
                    btn.disabled = false;
                    return;
                }

                if (Date.now() < otpThrottleUntil) {
                    if (phoneError) phoneError.textContent = 'Too many verification attempts. Please wait 24 hours before requesting a new code.';
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                    return;
                }

                btn.innerHTML = `
                    <span class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin-right: 8px;"></span>
                    <span>Sending code...</span>
                `;

                setupRecaptcha('recaptcha-container');
                confirmationResult = await sendSmsCode(phone);
                
                showToast("SMS verification code sent!", "info");
                startOtpCooldown();
                otpThrottleUntil = Date.now() + 60000;
                
                if (elements.authPhoneInput) elements.authPhoneInput.disabled = true;
                if (elements.authFullnameInput) elements.authFullnameInput.disabled = true;
                showElement(elements.otpGroup, 'block');
                if (elements.authOtpInput) {
                    elements.authOtpInput.required = true;
                    elements.authOtpInput.focus();
                }
                
                btn.disabled = false;
                btn.innerHTML = 'Verify Code';
            } else {
                // Phase 2: Verify OTP
                if (!otpCode) {
                    if (otpError) otpError.textContent = 'Verification code is required';
                    btn.disabled = false;
                    return;
                }

                btn.innerHTML = `
                    <span class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin-right: 8px;"></span>
                    <span>Verifying...</span>
                `;

                const userCredential = await confirmationResult.confirm(otpCode);
                const user = userCredential.user;

                const rememberMe = elements.rememberMeCheckbox?.checked;
                await setAuthPersistence(rememberMe);

                let pubKeyJwk = null;
                 let storedKeys = await getStoredKey(user.uid);
                 const profile = await getUserProfile(user.uid);
                 const privateProfileSnapshot = await get(ref(db, `users/${user.uid}/encryptedKeyPair`));
                 const dbEncryptedKeyPair = privateProfileSnapshot.val();
                
                if (storedKeys && storedKeys.publicKey) {
                    pubKeyJwk = storedKeys.publicKey;
                    if (!dbEncryptedKeyPair) {
                        try {
                            const encrypted = await encryptKeyPair(storedKeys, user.uid);
                            await updateUserProfile(user.uid, { encryptedKeyPair: encrypted });
                            console.log("E2EE keys successfully backed up during login!");
                        } catch (encErr) {
                            console.error("Failed to back up E2EE keys during login:", encErr);
                        }
                    }
                } else {
                    if (dbEncryptedKeyPair) {
                        try {
                            const keyPair = await decryptKeyPair(dbEncryptedKeyPair, user.uid);
                            await setStoredKey(user.uid, keyPair);
                            pubKeyJwk = keyPair.publicKey;
                        } catch (decErr) {
                            console.error("Failed to decrypt E2EE keys:", decErr);
                        }
                    }
                    
                    if (!pubKeyJwk) {
                        pubKeyJwk = await initUserKeys(user.uid);
                        const freshKeys = await getStoredKey(user.uid);
                        const encrypted = await encryptKeyPair(freshKeys, user.uid);
                        await updateUserProfile(user.uid, { encryptedKeyPair: encrypted, publicKey: pubKeyJwk });
                    }
                }

                let pushEnabled = false;
                try {
                    const token = await registerFcmToken(user.uid);
                    if (token) {
                        pushEnabled = true;
                        localStorage.setItem('hotmapp_push_notifications_enabled', 'true');
                    } else {
                        localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                    }
                } catch (err) {
                    console.warn("FCM permission denied/failed during authentication:", err);
                    localStorage.setItem('hotmapp_push_notifications_enabled', 'false');
                }

                let authProfilePhotoUrl = null;
                if (authSignupPhotoBlob) {
                    try {
                        const path = `avatars/${user.uid}.jpg`;
                        authProfilePhotoUrl = await uploadFile(path, authSignupPhotoBlob);
                        authSignupPhotoBlob = null;
                    } catch (uploadErr) {
                        console.error('Failed to upload signup profile photo:', uploadErr);
                        showToast('Failed to upload profile photo. Account will still be created without it.', 'warning');
                    }
                }

                if (!profile) {
                    localStorage.setItem('is_new_registration', 'true');
                    await saveUserProfile(user.uid, {
                        ...buildNewUserProfile(fullname || 'User', user.phoneNumber, authProfilePhotoUrl),
                        publicKey: pubKeyJwk || '',
                        notificationSettings: {
                            messageTone: 'default',
                            messageVibrate: true,
                            callTone: 'default',
                            callVibrate: true,
                            pushNotificationsEnabled: pushEnabled
                        }
                    });
                    showToast("Account created successfully!", "success");
                } else {
                    if (!profile.publicKey && pubKeyJwk) {
                        await updateUserProfile(user.uid, { publicKey: pubKeyJwk });
                    }
                    const existingSettings = profile.notificationSettings || {};
                    await updateUserProfile(user.uid, {
                        notificationSettings: {
                            ...existingSettings,
                            pushNotificationsEnabled: pushEnabled
                        }
                    });
                    showToast("Welcome back!", "success");
                }

                if (rememberMe) {
                    localStorage.setItem('rememberedPhone', phone);
                } else {
                    localStorage.removeItem('rememberedPhone');
                }

                btn.innerHTML = `
                    <span class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin-right: 8px;"></span>
                    <span>Initializing...</span>
                `;
            }
        } catch (error) {
            console.error("Auth Error:", error);
            const friendlyMessage = formatAuthErrorMessage(error);
            showToast(friendlyMessage, "error");
            btn.disabled = false;
            btn.innerHTML = originalContent;

            if (error?.code === 'auth/too-many-requests' || error?.code === 'auth/quota-exceeded') {
                confirmationResult = null;
                otpThrottleUntil = Date.now() + 60000;
                startOtpCooldown();
                if (elements.authPhoneInput) elements.authPhoneInput.disabled = false;
                if (elements.authFullnameInput) elements.authFullnameInput.disabled = false;
                hideElement(elements.otpGroup);
                if (elements.authOtpInput) {
                    elements.authOtpInput.value = '';
                    elements.authOtpInput.required = false;
                }
                if (phoneError) phoneError.textContent = friendlyMessage;
            }
            
            // Clean up and reset Recaptcha on error so next attempt gets a fresh verifier
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                } catch (clearErr) {
                    console.warn("Error clearing recaptcha verifier:", clearErr);
                }
                window.recaptchaVerifier = null;
            }

            if (confirmationResult && otpError) {
                otpError.textContent = 'Invalid verification code. Please check and try again.';
            }
        }
    });

    let openedFromProfile = false;

    const configureLogoutModal = () => {
        if (!elements.logoutModal) return;
        const isLinked = localStorage.getItem('isLinkedDevice') === 'true';
        const titleEl = elements.logoutModal.querySelector('h2');
        const descEl = elements.logoutModal.querySelector('p');
        const confirmBtn = elements.confirmLogoutBtn;
        const cancelBtn = elements.cancelLogoutBtn;
        
        if (isLinked) {
            if (titleEl) titleEl.textContent = "Linked Device";
            if (descEl) descEl.textContent = "This device is linked to your primary account. It can only be logged out remotely from your primary device's settings (Settings > Linked Devices).";
            if (confirmBtn) confirmBtn.style.display = 'none';
            if (cancelBtn) {
                cancelBtn.textContent = "Close";
                cancelBtn.style.background = "var(--brand)";
            }
        } else {
            if (titleEl) titleEl.textContent = "Logout";
            if (descEl) descEl.textContent = "Are you sure you want to log out of Hotmapp?";
            if (confirmBtn) confirmBtn.style.display = 'block';
            if (cancelBtn) {
                cancelBtn.textContent = "Cancel";
                cancelBtn.style.background = "#95a5a6";
            }
        }
    };

    elements.logoutBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openedFromProfile = false;
        configureLogoutModal();
        if (elements.logoutModal) elements.logoutModal.style.display = 'flex';
    });

    elements.profileLogoutBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (elements.profileModal) elements.profileModal.style.display = 'none';
        openedFromProfile = true;
        configureLogoutModal();
        if (elements.logoutModal) elements.logoutModal.style.display = 'flex';
    });

    elements.cancelLogoutBtn?.addEventListener('click', () => {
        if (elements.logoutModal) elements.logoutModal.style.display = 'none';
        if (openedFromProfile) {
            if (elements.profileModal) elements.profileModal.style.display = 'flex';
            openedFromProfile = false;
        }
    });

    elements.confirmLogoutBtn?.addEventListener('click', async () => {
        // Prevent logout on linked devices
        if (localStorage.getItem('isLinkedDevice') === 'true') {
            showToast("Logout is only permitted from the main device's settings.", "warning");
            if (elements.logoutModal) elements.logoutModal.style.display = 'none';
            return;
        }

        try {
            const user = auth.currentUser;
            if (user) {
                await removeFcmToken(user.uid);
            }
            await logoutUser();
            localStorage.removeItem('mainSessionId');
            localStorage.removeItem('hotmapp_cart_data'); // Clear cart on logout
            localStorage.removeItem('hotmapp_saved_data'); // Clear saved items on logout
            localStorage.removeItem('hotmapp_app_lock_pin'); // Clear PIN on logout
            localStorage.removeItem('hotmapp_app_lock_duration'); // Clear duration on logout
            if (elements.logoutModal) elements.logoutModal.style.display = 'none';
            showToast("Logged out successfully", "success");
        } catch (error) {
            console.error("Logout error:", error);
            showToast("Error logging out", "error");
        }
    });



    initQRLinking();
};