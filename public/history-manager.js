/**
 * A simple history manager to handle back navigation for modals and views in a single-page application.
 */

const historyStack = [];
const pendingPushQueue = [];
let isBackPending = false;
let backPendingTimeoutId = null;

const isNativeApp = () => !!(window.Capacitor?.Plugins?.App);

const getHistoryUrl = (id) => {
    const base = `${window.location.pathname}${window.location.search}`;
    if (isNativeApp()) {
        return base;
    }
    return id === 'base' ? base : `${base}#${encodeURIComponent(id)}`;
};

const readHistoryIdFromLocation = () => {
    if (window.history.state?.hotmappState) {
        return window.history.state.hotmappState;
    }
    if (window.location.hash) {
        return decodeURIComponent(window.location.hash.slice(1));
    }
    return 'base';
};

const processPendingPushes = () => {
    while (pendingPushQueue.length > 0) {
        const { id, closeFn } = pendingPushQueue.shift();
        pushHistoryState(id, closeFn);
    }
};

const setBackPending = () => {
    isBackPending = true;
    if (backPendingTimeoutId) clearTimeout(backPendingTimeoutId);
    backPendingTimeoutId = setTimeout(() => {
        if (isBackPending) {
            console.warn("History back navigation did not fire popstate within timeout. Releasing queue.");
            isBackPending = false;
            processPendingPushes();
        }
    }, 150); // 150ms safety timeout
};

/**
 * Pushes a new state onto the history stack.
 * This should be called whenever a modal or a new view is opened.
 * @param {string} id - A unique identifier for the state (e.g., 'profile-modal').
 * @param {function} closeFn - The function to call to close this UI element.
 */
export const pushHistoryState = (id, closeFn) => {
    if (isBackPending) {
        pendingPushQueue.push({ id, closeFn });
        return;
    }

    // Prevent pushing duplicate states
    if (historyStack.length > 0 && historyStack[historyStack.length - 1].id === id) {
        return;
    }

    const state = { id, closeFn };
    historyStack.push(state);

    // Push a state to the browser's history API.
    window.history.pushState({ hotmappState: id }, '', getHistoryUrl(id));
};

/**
 * Replaces the current top history state with a new state.
 * @param {string} id - A unique identifier for the state.
 * @param {function} closeFn - The function to call to close this UI element.
 */
export const replaceHistoryState = (id, closeFn) => {
    if (historyStack.length > 0) {
        historyStack[historyStack.length - 1] = { id, closeFn };
    } else {
        historyStack.push({ id, closeFn });
    }
    window.history.replaceState({ hotmappState: id }, '', getHistoryUrl(id));
};

/**
 * Removes the latest state from our internal stack without triggering the close function.
 * @param {string} [id] - If provided, only removes the state if its ID matches.
 */
export const removeHistoryState = (id) => {
    if (historyStack.length > 0) {
        if (id && historyStack[historyStack.length - 1].id !== id) {
            const index = historyStack.findIndex(s => s.id === id);
            if (index !== -1) {
                historyStack.splice(index, 1);
            }
            return;
        }
        historyStack.pop();
    }
};

/**
 * Dismisses a state programmatically by triggering browser back if it's on top of stack.
 */
export const dismissHistoryState = (id) => {
    const index = historyStack.findIndex(s => s.id === id);
    if (index !== -1) {
        const steps = historyStack.length - index;
        setBackPending();
        window.history.go(-steps);
    }
};

/**
 * Handles the 'popstate' event fired by the browser's back button.
 */
const handlePopState = (event) => {
    if (backPendingTimeoutId) {
        clearTimeout(backPendingTimeoutId);
        backPendingTimeoutId = null;
    }

    const targetStateId = event.state?.hotmappState || readHistoryIdFromLocation() || 'base';

    // Close and pop states from our stack until the top of stack matches targetStateId
    while (historyStack.length > 0 && historyStack[historyStack.length - 1].id !== targetStateId) {
        const state = historyStack.pop();
        if (state && typeof state.closeFn === 'function') {
            try {
                state.closeFn();
            } catch (err) {
                console.error("Error closing state", state.id, err);
            }
        }
    }

    isBackPending = false;

    // If we popped to a modal state that is currently hidden, show it again
    if (targetStateId !== 'base') {
        const targetEl = document.getElementById(targetStateId) || document.querySelector(`[data-ui="${targetStateId}"]`);
        if (targetEl && window.getComputedStyle(targetEl).display === 'none') {
            const prevDisplay = targetEl.dataset.lastDisplay || 'flex';
            targetEl.dataset.skipPush = 'true';
            targetEl.style.display = prevDisplay;
        }
    }

    // Fallback: if there is no matching state and we've returned to the base state,
    // notify the app so any UI that is still open can close itself.
    if (targetStateId === 'base' && historyStack.length === 0) {
        window.dispatchEvent(new CustomEvent('hotmapp-browser-back-to-base'));
    }

    processPendingPushes();
};

/**
 * Automatically registers style mutation observers on all modal-overlay elements.
 */
const initModalObserver = () => {
    const observer = new MutationObserver((mutations) => {
        const shownTargets = [];
        const hiddenTargets = [];

        mutations.forEach((mutation) => {
if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                const target = mutation.target;
                const display = window.getComputedStyle(target).display;
                const isVisible = display !== 'none';
                const wasVisible = target.dataset.lastDisplay !== 'none' && target.dataset.lastDisplay !== undefined;

                if (isVisible && !wasVisible) {
                    shownTargets.push(target);
                } else if (!isVisible && wasVisible) {
                    hiddenTargets.push(target);
                }

                target.dataset.lastDisplay = display;
            }
        });

        // Determine if we are in a forward transition (A -> B)
        // A forward transition is when one or more modals are shown, and at least one is NOT currently in the historyStack.
        let isForwardTransition = false;
        if (shownTargets.length > 0 && hiddenTargets.length > 0) {
            isForwardTransition = shownTargets.some(target => {
                const id = target.id || target.getAttribute('data-ui') || 'modal';
                return !historyStack.some(s => s.id === id);
            });
        }

        // Process shown targets
        shownTargets.forEach(target => {
            if (target.dataset.skipPush === 'true') {
                target.dataset.skipPush = 'false';
                return;
            }
            const id = target.id || target.getAttribute('data-ui') || 'modal';
            // Do not push if it is already present in the historyStack (e.g. from back-navigation)
            if (historyStack.some(s => s.id === id)) {
                return;
            }
            pushHistoryState(id, () => {
                target.style.display = 'none';
            });
        });

        // Process hidden targets
        hiddenTargets.forEach(target => {
            if (target.dataset.skipBack === 'true') {
                target.dataset.skipBack = 'false';
                return;
            }
            // Skip back history command if it is a forward transition
            if (isForwardTransition) {
                return;
            }
            const id = target.id || target.getAttribute('data-ui') || 'modal';
            const index = historyStack.findIndex(s => s.id === id);
            if (index !== -1) {
                dismissHistoryState(id);
            }
        });
    });

    const modals = document.querySelectorAll('.modal-overlay, .reset-modal, .header-dropdown-menu, .chat-header-menu, .selection-ellipsis-menu, .lightbox-modal, .cart-overlay');
    modals.forEach((modal) => {
        modal.dataset.lastDisplay = window.getComputedStyle(modal).display;
        observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
    });
};

/**
 * Initializes the history manager by attaching the popstate listener.
 * This should be called once when the application starts.
 */
export const initHistoryManager = () => {
    // Set the initial state so we have a baseline.
    const initialStateId = readHistoryIdFromLocation();
    if (!window.history.state || !window.history.state.hotmappState) {
        window.history.replaceState({ hotmappState: initialStateId }, '', getHistoryUrl(initialStateId));
    }

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', () => {
        handlePopState({ state: window.history.state });
    });
    initModalObserver();
    console.log("History Manager Initialized.");

    // Capacitor Native Android/iOS Back Button Handler
    let backButtonRegistered = false;
    const isActiveCallOverlay = () => {
        const callOverlay = document.querySelector('.call-overlay');
        if (!callOverlay || callOverlay.style.display === 'none') {
            return false;
        }
        if (callOverlay.classList.contains('video-mode')) {
            return !callOverlay.classList.contains('minimized');
        }
        return true;
    };

    const registerCapacitorBackButton = () => {
        if (backButtonRegistered) return;
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            const { App } = window.Capacitor.Plugins;
            App.addListener('backButton', (data) => {
                const forceUpdateModal = document.querySelector('[data-ui="force-update-modal"]');
                if (forceUpdateModal && forceUpdateModal.style.display === 'flex') {
                    if (App.exitApp) App.exitApp();
                    else if (App.minimizeApp) App.minimizeApp();
                    return;
                }

                if (isActiveCallOverlay()) {
                    // Dispatch dedicated minimize event so call UI always handles it
                    window.dispatchEvent(new CustomEvent('hotmapp-minimize-call'));
                    return;
                }

                // Check if message selection mode is active
                const selectionBar = document.querySelector('[data-ui="selection-bar"]') || document.querySelector('.selection-bar');
                const isSelectionActive = selectionBar && selectionBar.classList.contains('active');
                if (isSelectionActive) {
                    window.dispatchEvent(new CustomEvent('hotmapp-cancel-selection'));
                    return;
                }

                const chatsTab = document.querySelector('[data-ui="nav-chats"]');
                const chatContainer = document.querySelector('[data-ui="chat-container"]') || document.querySelector('.chat-container');
                const isViewingChat = chatContainer && chatContainer.classList.contains('viewing-chat');
                
                const visibleModals = Array.from(
                    document.querySelectorAll('.modal-overlay, .lightbox-modal, .reset-modal, .header-dropdown-menu, .chat-header-menu, .selection-ellipsis-menu, .cart-overlay')
                ).some(m => m.style.display !== 'none' && m.style.display !== '');

                        const isAtHomeChatsPage = chatsTab && chatsTab.classList.contains('active') && !isViewingChat && !visibleModals;

                if (isAtHomeChatsPage) {
                    App.minimizeApp();
                } else if (visibleModals || historyStack.length > 0) {
                    window.history.back();
                } else if (isViewingChat) {
                    window.dispatchEvent(new CustomEvent('hotmapp-back-button'));
                } else {
                    chatsTab?.click();
                }
            });
            backButtonRegistered = true;
            console.log("Capacitor Back Button Listener registered.");
        }
    };

    // Try immediately
    registerCapacitorBackButton();

    // Try on window load
    window.addEventListener('load', registerCapacitorBackButton);

    // Poll for up to 3 seconds to handle asynchronous bridge initialization
    let capRetries = 0;
    const capInterval = setInterval(() => {
        if (backButtonRegistered) {
            clearInterval(capInterval);
        } else {
            registerCapacitorBackButton();
            capRetries++;
            if (capRetries > 30) {
                clearInterval(capInterval);
            }
        }
    }, 100);

    // Cordova-compatible fallback for backbutton event on document
    document.addEventListener('backbutton', (e) => {
        if (backButtonRegistered) return;

        if (isActiveCallOverlay()) {
            e.preventDefault();
            // Dispatch dedicated minimize event so call UI always handles it
            window.dispatchEvent(new CustomEvent('hotmapp-minimize-call'));
            return;
        }

        // Check if message selection mode is active
        const selectionBar = document.querySelector('[data-ui="selection-bar"]') || document.querySelector('.selection-bar');
        const isSelectionActive = selectionBar && selectionBar.classList.contains('active');
        if (isSelectionActive) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('hotmapp-cancel-selection'));
            return;
        }
        
        const chatsTab = document.querySelector('[data-ui="nav-chats"]');
        const chatContainer = document.querySelector('[data-ui="chat-container"]') || document.querySelector('.chat-container');
        const isViewingChat = chatContainer && chatContainer.classList.contains('viewing-chat');
        
        const visibleModals = Array.from(
            document.querySelectorAll('.modal-overlay, .lightbox-modal, .reset-modal, .header-dropdown-menu, .chat-header-menu, .selection-ellipsis-menu')
        ).some(m => m.style.display !== 'none' && m.style.display !== '');

        const isAtHomeChatsPage = chatsTab && chatsTab.classList.contains('active') && !isViewingChat && !visibleModals;

        if (isAtHomeChatsPage) {
            if (window.Capacitor?.Plugins?.App) {
                window.Capacitor.Plugins.App.minimizeApp();
            }
        } else if (visibleModals || historyStack.length > 0) {
            e.preventDefault();
            window.history.back();
        } else if (isViewingChat) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('hotmapp-back-button'));
        } else {
            chatsTab?.click();
        }
    });
};