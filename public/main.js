import { initNavigation } from './navigation.js?v=1.1.4';
import { initChatSelection } from './chat.js?v=1.1.4';
import { initStore, refreshStoreGrids } from './store.js?v=1.1.4';
import { initShop } from './shop.js?v=1.1.4';
import { initAuth } from './auth.js?v=1.1.4';
import { initProfile } from './profile.js?v=1.1.4';
import { initStarredMessages } from './starred-messages.js?v=1.1.4';
import { initLinkedDevices } from './linked-devices.js?v=1.1.4';
import { initAppLock } from './app-lock.js?v=1.1.4';
import { initChatLock } from './chat-lock.js?v=1.1.4';
import { validateUI } from './ui-validator.js?v=1.1.4';
import { initHistoryManager } from './history-manager.js?v=1.1.4';
import { initAccount } from './account.js?v=1.1.4';
import { initLanguage } from './language.js?v=1.1.4';
import { initNotificationSettings } from './notifications-settings.js?v=1.1.4';
import { initStorageSettings } from './storage-settings.js?v=1.1.4';
import { initHelpFeedback } from './help-feedback.js?v=1.1.4';
import { showToast } from './toast.js?v=1.1.4';

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
                refreshStoreGrids();
            }
        });
    }
});