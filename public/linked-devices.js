import { elements } from './elements.js';
import { showToast } from './toast.js';
import { auth } from './firebase-config.js';
import { subscribeToLinkedDevices, authorizeSession, removeLinkedDevice, removeAllLinkedDevices } from './database-service.js?v=1.1.11';
import { db } from './firebase-config.js';
import { subscribeToAuthChanges } from './auth-service.js';
import { getRelativeTime } from './utils.js';
import { getStoredKey } from './crypto-helper.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

export const initLinkedDevices = () => {
    let qrScanner = null;
    let isProcessingLink = false;

    const stopScanner = async () => {
        isProcessingLink = false;
        if (qrScanner) {
            try {
                if (typeof qrScanner.clear === 'function') {
                    await qrScanner.clear();
                }
                if (typeof qrScanner.stop === 'function') {
                    await qrScanner.stop();
                }
            } catch (err) {
                console.warn("Scanner clear warning:", err);
            }
            qrScanner = null;
        }
        if (elements.linkNewDeviceModal) elements.linkNewDeviceModal.style.display = 'none';
    };

    const parseLinkPayload = (decodedText) => {
        const trimmed = (decodedText || '').trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('hotmapp_link:') || trimmed.startsWith('hotma_link:')) {
            const cleanText = trimmed.replace(/^hotma_link:/, 'hotmapp_link:');
            const parts = cleanText.split(':');
            if (parts.length >= 3) {
                return {
                    sessionId: parts[1],
                    customToken: parts.slice(2).join(':')
                };
            }
        }

        try {
            const url = new URL(trimmed);
            const sessionId = url.searchParams.get('sid') || url.searchParams.get('session') || url.searchParams.get('sessionId');
            const customToken = url.searchParams.get('token') || url.searchParams.get('customToken');
            if (sessionId && customToken) {
                return { sessionId, customToken };
            }
        } catch (err) {
            console.warn("QR payload was not a URL", err);
        }

        return null;
    };

    const handleLinkScan = async (decodedText) => {
        if (isProcessingLink) return;

        if (!auth.currentUser) {
            showToast("You must be logged in to link a device.", "error");
            return;
        }

        const parsedPayload = parseLinkPayload(decodedText);
        if (!parsedPayload) {
            showToast("Invalid Linking QR code format", "warning");
            return;
        }

        showToast(`Scanned: ${decodedText.substring(0, 18)}...`, "info");
        isProcessingLink = true;
        const { sessionId, customToken } = parsedPayload;

        showToast("Extracting credentials...", "info");
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown Location';
        const userLanguage = navigator.language || '';

        const deviceInfo = {
            browser: navigator.userAgent.split(' ')[0] || 'Unknown Browser',
            platform: navigator.platform || 'Unknown Platform',
            city: userTimeZone,
            country: userLanguage
        };

        console.log("LocalStorage keys:", Object.keys(localStorage));
        const authKey = Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:'));
        let sessionPayload = null;

        if (authKey) {
            console.log("Found auth key in localStorage:", authKey);
            sessionPayload = { key: authKey, val: localStorage.getItem(authKey) };
        } else {
            console.log("Auth key not found in localStorage. Checking IndexedDB...");
            try {
                const getAuthFromIndexedDB = () => {
                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            console.warn("IndexedDB query timed out. Proceeding...");
                            resolve(null);
                        }, 2500);
                        const request = indexedDB.open("firebaseLocalStorageDb");
                        request.onsuccess = (e) => {
                            const db = e.target.result;
                            console.log("Successfully opened firebaseLocalStorageDb IndexedDB");
                            if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
                                console.warn("firebaseLocalStorage store not found in DB");
                                clearTimeout(timeout);
                                resolve(null);
                                return;
                            }
                            const transaction = db.transaction("firebaseLocalStorage", "readonly");
                            const store = transaction.objectStore("firebaseLocalStorage");
                            const getRequest = store.getAllKeys();
                            getRequest.onsuccess = () => {
                                const keys = getRequest.result;
                                console.log("IndexedDB auth keys:", keys);
                                const idbAuthKey = keys.find(k => k.startsWith('firebase:authUser:'));
                                if (idbAuthKey) {
                                    console.log("Found auth key in IndexedDB:", idbAuthKey);
                                    const valRequest = store.get(idbAuthKey);
                                    valRequest.onsuccess = () => {
                                        console.log("Successfully retrieved auth value from IndexedDB");
                                        clearTimeout(timeout);
                                        resolve({ key: idbAuthKey, val: JSON.stringify(valRequest.result) });
                                    };
                                    valRequest.onerror = (err) => {
                                        console.error("Error fetching value from IndexedDB:", err);
                                        clearTimeout(timeout);
                                        resolve(null);
                                    };
                                } else {
                                    console.warn("No firebase:authUser key found in IndexedDB keys");
                                    clearTimeout(timeout);
                                    resolve(null);
                                }
                            };
                            getRequest.onerror = (err) => {
                                console.error("Error getting keys from IndexedDB:", err);
                                clearTimeout(timeout);
                                resolve(null);
                            };
                        };
                        request.onerror = (err) => {
                            console.error("Error opening firebaseLocalStorageDb IndexedDB:", err);
                            clearTimeout(timeout);
                            resolve(null);
                        };
                    });
                };
                sessionPayload = await getAuthFromIndexedDB();
            } catch (idbErr) {
                console.warn("Failed to check IndexedDB:", idbErr);
            }
        }

        if (!sessionPayload) {
            showToast("Error: No local credentials found in storage! Cannot link device.", "error");
            isProcessingLink = false;
            return;
        } else {
            showToast("Credentials located. Encrypting payload...", "info");
        }

        let e2eeKeys = null;
        try {
            const getStoredKeyWithTimeout = () => {
                return new Promise(async (resolve) => {
                    const timeout = setTimeout(() => {
                        console.warn("getStoredKey query timed out. Proceeding...");
                        resolve(null);
                    }, 2000);
                    try {
                        const keys = await getStoredKey(auth.currentUser.uid);
                        clearTimeout(timeout);
                        resolve(keys);
                    } catch (err) {
                        clearTimeout(timeout);
                        resolve(null);
                    }
                });
            };
            e2eeKeys = await getStoredKeyWithTimeout();
        } catch (e2eeErr) {
            console.warn("Failed to fetch E2EE keys:", e2eeErr);
        }

        let encryptedSession = null;
        if (sessionPayload) {
            // ----- NEW: Ensure we are the active session before encrypting -----
            const dbSessionSnapshot = await get(ref(db, `users/${auth.currentUser.uid}/mainSessionId`));
            const dbSessionId = dbSessionSnapshot.val();
            const localSessionId = localStorage.getItem('mainSessionId');
            if (dbSessionId && localSessionId && dbSessionId !== localSessionId) {
                showToast("You are already logged in on another device. Please log out there first.", "warning");
                return; // abort linking
            }
            try {
                const payloadToEncrypt = {
                    authKey: sessionPayload.key,
                    authVal: sessionPayload.val,
                    e2eeKeys: e2eeKeys
                };
                const sessionStr = JSON.stringify(payloadToEncrypt);
                const encoder = new TextEncoder();
                const passcodeBytes = encoder.encode(customToken);
                const hash = await crypto.subtle.digest("SHA-256", passcodeBytes);
                const aesKey = await crypto.subtle.importKey(
                    "raw",
                    hash,
                    { name: "AES-GCM" },
                    false,
                    ["encrypt"]
                );
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const ciphertext = await crypto.subtle.encrypt(
                    { name: "AES-GCM", iv },
                    aesKey,
                    encoder.encode(sessionStr)
                );

                const bufferToBase64 = (buf) => {
                    let binary = '';
                    const bytes = new Uint8Array(buf);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary);
                };
                encryptedSession = {
                    ciphertext: bufferToBase64(ciphertext),
                    iv: bufferToBase64(iv)
                };
            } catch (cryptoErr) {
                console.error("Encryption issue:", cryptoErr);
                showToast("Failed to encrypt credentials: " + cryptoErr.message, "error");
                isProcessingLink = false;
                return;
            }
        }

        try {
            showToast("Sending authorization to database...", "info");
            await authorizeSession(sessionId, customToken, auth.currentUser.uid, deviceInfo, encryptedSession);
            showToast("Database authorization complete!", "success");
            await stopScanner();
        } catch (err) {
            showToast(err.message === "MAX_DEVICES_REACHED" ? "Maximum linked devices reached (5)." : "Failed to link: " + err.message, "error");
            isProcessingLink = false;
        }
    };

    const startScanner = async () => {
        if (!elements.linkDeviceScanner) return;
        elements.linkNewDeviceModal.style.display = 'flex';

        try {
            if (typeof window === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                throw new Error("This browser does not support camera access.");
            }

            if (typeof window.Html5Qrcode === 'undefined') {
                console.warn("QR scanner library unavailable, opening modal without scanner");
                showToast("Camera scanner is unavailable right now. Please refresh and try again.", "warning");
                return;
            }

            if (qrScanner) {
                try {
                    await qrScanner.stop();
                } catch (err) {
                    console.warn("Scanner stop warning:", err);
                }
                try {
                    await qrScanner.clear();
                } catch (err) {
                    console.warn("Scanner clear warning:", err);
                }
            }
            qrScanner = null;
            elements.linkDeviceScanner.innerHTML = '';

            const permissionStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            permissionStream.getTracks().forEach(track => track.stop());

            await new Promise((resolve) => setTimeout(resolve, 250));
            qrScanner = new window.Html5Qrcode("link-device-scanner");
            const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.7);
                return { width: qrboxSize, height: qrboxSize };
            };
            const config = {
                fps: 20,
                qrbox: qrboxFunction,
                aspectRatio: 1.0
            };

            await qrScanner.start(
                { facingMode: 'environment' },
                config,
                handleLinkScan,
                () => {}
            );
            showToast("Camera ready. Point at the QR code.", "info");
        } catch (err) {
            console.error("Scanner error:", err);
            showToast(err.message || "Failed to start camera scanner", "error");
            await stopScanner();
        }
    };

    const isLinked = localStorage.getItem('isLinkedDevice') === 'true';

    // Hide revoke all button on linked devices
    if (isLinked && elements.revokeAllDevicesBtn) {
        elements.revokeAllDevicesBtn.style.display = 'none';
    }

    const renderDeviceList = (devices) => {
        if (!elements.linkedDevicesList) return;
        elements.linkedDevicesList.innerHTML = '';

        const deviceEntries = Object.entries(devices);
        if (deviceEntries.length === 0) {
            elements.linkedDevicesList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">No other devices linked</div>';
            return;
        }

        deviceEntries.forEach(([id, dev]) => {
            const lastActive = dev.timestamp ? getRelativeTime(dev.timestamp) : 'Never';
            const location = (dev.city && dev.country) ? `${dev.city}, ${dev.country}` : (dev.platform || 'Unknown Location');

            const revokeBtnHtml = isLinked ? '' : `
                <button class="revoke-btn" data-id="${id}" style="background:none; border:none; color:#ff4d4d; cursor:pointer; padding:10px;">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>`;

            const html = `
                <div class="conversation-item" style="cursor: default; border-bottom: 1px solid var(--panel-soft);">
                    <div class="conversation-avatar" style="background: #f0f2f5; color: var(--muted);"><i class="fa-solid fa-laptop"></i></div>
                    <div class="conversation-info">
                        <div class="conversation-name">${dev.deviceName || dev.browser}</div>
                        <div class="conversation-preview" style="font-size: 0.8rem; color: var(--brand-dark); font-weight: 500;">Last active: ${lastActive}</div>
                        <div class="conversation-preview" style="font-size: 0.75rem;">${location}</div>
                    </div>
                    ${revokeBtnHtml}
                </div>`;
            elements.linkedDevicesList.insertAdjacentHTML('beforeend', html);
        });

        elements.linkedDevicesList.querySelectorAll('.revoke-btn').forEach(btn => {
            btn.onclick = async () => {
                if (localStorage.getItem('isLinkedDevice') === 'true') {
                    showToast("Only the primary device is authorized to unlink devices.", "error");
                    return;
                }
                if (confirm("Revoke access for this device?")) {
                    await removeLinkedDevice(auth.currentUser.uid, btn.dataset.id);
                    showToast("Device revoked", "info");
                }
            };
        });
    };

    subscribeToAuthChanges((user) => {
        if (user) {
            subscribeToLinkedDevices(user.uid, renderDeviceList);
        }
    });

    elements.linkNewDeviceBtn?.addEventListener('click', startScanner);
    elements.closeLinkNewDeviceModalBtn?.addEventListener('click', stopScanner);
    
    elements.revokeAllDevicesBtn?.addEventListener('click', async () => {
        if (localStorage.getItem('isLinkedDevice') === 'true') {
            showToast("Only the primary device is authorized to unlink devices.", "error");
            return;
        }
        if (confirm("Are you sure you want to logout from ALL other devices?")) {
            // The current device (main) is not in the linkedDevices list, so we can safely clear it.
            await removeAllLinkedDevices(auth.currentUser.uid);
            showToast("All other devices have been logged out.", "success");
        }
    });

    elements.closeLinkedDevicesModalBtn?.addEventListener('click', () => {
        if (elements.linkedDevicesModal) elements.linkedDevicesModal.style.display = 'none';
    });
};