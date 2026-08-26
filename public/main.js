import { initNavigation } from './navigation.js';
import { initChatSelection } from './chat.js';
import { initStore, refreshStoreGrids } from './store.js';
import { initShop } from './shop.js';
import { initAuth } from './auth.js';
import { initProfile } from './profile.js';
import { initStarredMessages } from './starred-messages.js';
import { initLinkedDevices } from './linked-devices.js';
import { initAppLock } from './app-lock.js';
import { initChatLock } from './chat-lock.js';
import { validateUI } from './ui-validator.js';
import { initHistoryManager } from './history-manager.js';
import { initAccount } from './account.js';
import { initLanguage } from './language.js';
import { initNotificationSettings } from './notifications-settings.js';
import { initStorageSettings } from './storage-settings.js';
import { initHelpFeedback } from './help-feedback.js';
import { initAppVersionChecker } from './version-service.js';
import { showToast } from './toast.js';

// Monitors browser online/offline status and displays toast notifications
const initNetworkMonitoring = () => {
    // Check initial connection status on load
    if (!navigator.onLine) {
        showToast("No internet connection. The app is running in offline mode.", "error", 5000);
    }

    // Listen for device losing connection
    window.addEventListener('offline', () => {
        showToast("Connection lost. Working offline.", "error", 5000);
    });

    // Listen for connection restoration
    window.addEventListener('online', () => {
        showToast("Connection restored. Back online.", "success", 3000);
    });
};

// Bootstrapping the application
document.addEventListener('DOMContentLoaded', () => {
    initAppVersionChecker();
    initNetworkMonitoring();
    initHistoryManager();
    initNavigation();
    initChatSelection();
    initStore();
    initShop();
    initAuth();
    initProfile();
    initStarredMessages();
    initLinkedDevices();
    initAppLock();
    initChatLock();
    initAccount();
    initLanguage();
    initNotificationSettings();
    initStorageSettings();
    initHelpFeedback();

    // Perform UI integrity check once the application is bootstrapped
    validateUI();

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                refreshStoreGrids({ suppressShopAccessModal: true });
            }
        });
    }
});