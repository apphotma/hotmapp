import { db } from './firebase-config.js';
import { ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { elements } from './elements.js';

export const getAppPlatform = () => {
    if (
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.getPlatform?.() === 'android' ||
        window.AndroidBridge ||
        (window.location.protocol === 'https:' && window.location.hostname === 'hotmapp.shop') ||
        (window.location.protocol === 'http:' && window.location.hostname === 'localhost')
    ) {
        return 'android';
    }
    return 'web';
};

// Current App Build Constants
export const APP_METADATA = {
    version: '1.0.8',       // Native Android versionName
    versionCode: 34,        // Native Android versionCode
    webVersion: '1.1.22',   // Web build version
    get platform() {
        return getAppPlatform();
    }
};

/**
 * Compares two semantic version strings (e.g. "1.0.1" vs "1.0.2").
 * Returns:
 *   -1 if v1 < v2 (v1 is older)
 *    0 if v1 === v2 (equal)
 *    1 if v1 > v2 (v1 is newer)
 */
export const compareVersions = (v1, v2) => {
    if (!v1 || !v2) return 0;
    const clean1 = String(v1).replace(/^v/i, '').trim();
    const clean2 = String(v2).replace(/^v/i, '').trim();

    const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    return 0;
};

/**
 * Displays the non-dismissible Force Update dialog.
 */
const showForceUpdateModal = (config) => {
    const isAndroid = getAppPlatform() === 'android';
    const modal = elements.forceUpdateModal;
    if (!modal) return;

    const currentVer = isAndroid ? `v${APP_METADATA.version}` : `v${APP_METADATA.webVersion}`;
    const latestVer = isAndroid ? `v${config.android_latest_version || config.android_min_version || 'Latest'}` : `v${config.web_latest_version || config.web_min_version || 'Latest'}`;
    const updateUrl = isAndroid
        ? (config.android_update_url || "https://play.google.com/store/apps/details?id=com.hotmapp.app")
        : (config.web_update_url || "https://hotma-app.web.app");

    if (elements.updateCurrentVer) elements.updateCurrentVer.textContent = currentVer;
    if (elements.updateLatestVer) elements.updateLatestVer.textContent = latestVer;
    if (elements.updateModalTitle) elements.updateModalTitle.textContent = config.title || "Update Required";
    if (elements.updateModalMessage) {
        elements.updateModalMessage.textContent = config.message || "A new version of HOTMAPP is required to continue. Please update to the latest version.";
    }
    if (elements.updateReleaseNotes && config.release_notes) {
        elements.updateReleaseNotes.textContent = config.release_notes;
    }

    if (elements.updateNowBtn) {
        if (!isAndroid && updateUrl === 'reload') {
            elements.updateNowBtn.removeAttribute('href');
            elements.updateNowBtn.onclick = (e) => {
                e.preventDefault();
                window.location.reload(true);
            };
        } else {
            elements.updateNowBtn.href = updateUrl;
            elements.updateNowBtn.target = "_blank";
            elements.updateNowBtn.onclick = null;
        }
    }

    modal.style.display = 'flex';

    // Prevent closing through outside clicks or keyboard ESC
    modal.addEventListener('click', (e) => e.stopPropagation());
};

/**
 * Hides the Force Update modal if the app is compliant.
 */
const hideForceUpdateModal = () => {
    const modal = elements.forceUpdateModal;
    if (modal) modal.style.display = 'none';
};

/**
 * Initializes real-time listener on Firebase for app version constraints.
 */
export const initAppVersionChecker = () => {
    const configRef = ref(db, 'app_config');

    // Subscribe to real-time changes
    onValue(configRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Auto-initialize default app_config node in database
            const defaultConfig = {
                android_min_version: '1.0.1',
                android_min_code: 27,
                android_latest_version: '1.0.1',
                android_update_url: 'https://play.google.com/store/apps/details?id=com.hotmapp.app',
                web_min_version: '1.1.20',
                web_latest_version: '1.1.20',
                web_update_url: 'https://hotma-app.web.app',
                force_update: false,
                title: 'Update Required',
                message: 'A new version of HOTMAPP is available. Please update to continue using all features.',
                release_notes: 'Includes store currency selection, distance delivery improvements, and invoice breakdown.'
            };
            set(configRef, defaultConfig).catch((err) => {
                console.log("Auto-init app_config fallback:", err);
            });
            return;
        }

        const config = snapshot.val();
        if (!config) return;

        const isAndroid = getAppPlatform() === 'android';
        let updateRequired = false;

        if (isAndroid) {
            const minVer = config.android_min_version;
            const minCode = config.android_min_code;
            const latestVer = config.android_latest_version;

            if (minCode && APP_METADATA.versionCode < minCode) {
                updateRequired = true;
            } else if (minVer && compareVersions(APP_METADATA.version, minVer) < 0) {
                updateRequired = true;
            } else if (config.force_update && latestVer && compareVersions(APP_METADATA.version, latestVer) < 0) {
                updateRequired = true;
            }
        } else {
            // Web platform
            const minWebVer = config.web_min_version;
            const latestWebVer = config.web_latest_version;

            if (minWebVer && compareVersions(APP_METADATA.webVersion, minWebVer) < 0) {
                updateRequired = true;
            } else if (config.force_update && latestWebVer && compareVersions(APP_METADATA.webVersion, latestWebVer) < 0) {
                updateRequired = true;
            }
        }

        if (updateRequired) {
            showForceUpdateModal(config);
        } else {
            hideForceUpdateModal();
        }
    }, (error) => {
        console.warn("Could not check app version constraints:", error);
    });
};
