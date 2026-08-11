import { elements } from './elements.js';
import { hideElement, showElement } from './utils.js';
import { pushHistoryState, removeHistoryState, replaceHistoryState } from './history-manager.js';

let activeTimeout = null;
let activeOldPanel = null;
let activeNewPanel = null;
let navIndicator = null;

const createNavIndicator = () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    // Check if it already exists to prevent duplicate injection
    navIndicator = navbar.querySelector('.nav-indicator');
    if (!navIndicator) {
        navIndicator = document.createElement('div');
        navIndicator.className = 'nav-indicator';
        navbar.appendChild(navIndicator);
    }
};

const updateNavIndicator = (activeTabElement) => {
    if (!navIndicator || !activeTabElement) return;
    
    // Compute positions
    const offsetLeft = activeTabElement.offsetLeft;
    const width = activeTabElement.offsetWidth;
    
    navIndicator.style.left = `${offsetLeft}px`;
    navIndicator.style.width = `${width}px`;
};

const resetPanelStyles = (panel) => {
    if (!panel) return;
    panel.classList.remove(
        'tab-slide-in-right',
        'tab-slide-out-left',
        'tab-slide-in-left',
        'tab-slide-out-right'
    );
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.zIndex = '';
};

const clearActiveTransition = () => {
    if (activeTimeout) {
        clearTimeout(activeTimeout);
        activeTimeout = null;
    }
    if (activeOldPanel) {
        hideElement(activeOldPanel);
        resetPanelStyles(activeOldPanel);
        activeOldPanel = null;
    }
    if (activeNewPanel) {
        resetPanelStyles(activeNewPanel);
        activeNewPanel = null;
    }
};

const getPanelForTab = (tabElement) => {
    if (tabElement === elements.customersNav) return elements.custSidebar;
    if (tabElement === elements.chatsNav) return elements.chatSidebar;
    if (tabElement === elements.callsNav) return elements.callsSidebar;
    if (tabElement === elements.generalMarketNav) return elements.generalMarketArea;
    return null;
};

export const switchTab = (clickedElement, show = [], hide = []) => {
    const navTabs = [
        elements.customersNav,
        elements.chatsNav,
        elements.callsNav,
        elements.generalMarketNav
    ];

    const currentActiveTab = document.querySelector('.nav-item.active');
    const fromIndex = navTabs.indexOf(currentActiveTab);
    const toIndex = navTabs.indexOf(clickedElement);

    const isTabTransition = (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex);

    // Update active class on tab buttons
    if (currentActiveTab) currentActiveTab.classList.remove('active');
    clickedElement.classList.add('active');

    // Update the sliding underline indicator
    if (toIndex !== -1) {
        updateNavIndicator(clickedElement);
    }

    // Handle history navigation for tabs
    if (clickedElement === elements.chatsNav) {
        if (window.history.state && window.history.state.hotmappState === 'tab-navigation') {
            removeHistoryState('tab-navigation');
            if (window.isSwitchingFromContact) {
                window.history.replaceState({ hotmappState: 'base' }, '', window.location.pathname);
                window.isSwitchingFromContact = false;
            } else {
                window.history.back();
            }
        }
    } else {
        if (window.history.state && window.history.state.hotmappState === 'header-dropdown-menu') {
            replaceHistoryState('tab-navigation', () => {
                elements.chatsNav?.click();
            });
        } else {
            pushHistoryState('tab-navigation', () => {
                elements.chatsNav?.click();
            });
        }
    }

    if (isTabTransition) {
        // Clear any ongoing transition cleanups
        clearActiveTransition();

        // Ensure container is relative
        if (elements.chatContainer) {
            elements.chatContainer.style.position = 'relative';
        }

        const oldPanel = getPanelForTab(currentActiveTab);
        const newPanel = getPanelForTab(clickedElement);

        if (oldPanel && newPanel && oldPanel !== newPanel) {
            const isForward = toIndex > fromIndex;

            // Lock position of the oldPanel
            const rect = oldPanel.getBoundingClientRect();
            const containerRect = elements.chatContainer.getBoundingClientRect();

            oldPanel.style.position = 'absolute';
            oldPanel.style.top = `${rect.top - containerRect.top}px`;
            oldPanel.style.left = `${rect.left - containerRect.left}px`;
            oldPanel.style.width = `${rect.width}px`;
            oldPanel.style.height = `${rect.height}px`;
            oldPanel.style.zIndex = '10';

            // Show new panel
            show.forEach(el => {
                if (!el) return;
                const ui = el.dataset.ui;
                if (ui === 'chat-area' || ui === 'chat-sidebar' || ui === 'cust-sidebar' || ui === 'starred-sidebar' || ui === 'calls-sidebar' || ui === 'locked-chats-sidebar' || ui === 'archived-sidebar') {
                    showElement(el, 'flex');
                } else {
                    showElement(el, 'block');
                }
            });

            // Hide other panels, but NOT the oldPanel (yet!)
            hide.forEach(el => {
                if (el !== oldPanel) {
                    hideElement(el);
                }
            });

            // Trigger reflow to make sure transition animations play cleanly
            void newPanel.offsetWidth;
            void oldPanel.offsetWidth;

            // Add sliding transition classes
            if (isForward) {
                oldPanel.classList.add('tab-slide-out-left');
                newPanel.classList.add('tab-slide-in-right');
            } else {
                oldPanel.classList.add('tab-slide-out-right');
                newPanel.classList.add('tab-slide-in-left');
            }

            // Keep track of the panels being animated for cleanup
            activeOldPanel = oldPanel;
            activeNewPanel = newPanel;

            activeTimeout = setTimeout(() => {
                // Once transition is complete, hide oldPanel
                hideElement(oldPanel);
                resetPanelStyles(oldPanel);
                resetPanelStyles(newPanel);
                activeTimeout = null;
                activeOldPanel = null;
                activeNewPanel = null;
            }, 280);

            // Reset list scroll state on mobile
            elements.chatContainer?.classList.remove('viewing-chat');
            elements.mainAppContent?.classList.remove('header-hidden');
            if (window.history.state && window.history.state.hotmappState === 'chat-view') {
                window.history.replaceState({ hotmappState: 'base' }, '', window.location.pathname);
                removeHistoryState('chat-view');
            }
            return;
        }
    }

    // Standard Instant Switch (Fallback)
    clearActiveTransition();

    show.forEach(el => {
        if (!el) return;
        const ui = el.dataset.ui;
        // Use flex for components designed as flex containers to preserve layout integrity
        if (ui === 'chat-area' || ui === 'chat-sidebar' || ui === 'cust-sidebar' || ui === 'starred-sidebar' || ui === 'calls-sidebar' || ui === 'locked-chats-sidebar' || ui === 'archived-sidebar') {
            showElement(el, 'flex');
        } else {
            showElement(el, 'block');
        }
    });
    hide.forEach(hideElement);

    // Ensure we reset to the sidebar list on mobile when switching tabs
    elements.chatContainer?.classList.remove('viewing-chat');
    elements.mainAppContent?.classList.remove('header-hidden');
    if (window.history.state && window.history.state.hotmappState === 'chat-view') {
        window.history.replaceState({ hotmappState: 'base' }, '', window.location.pathname);
        removeHistoryState('chat-view');
    }
};

export const initNavigation = () => {
    // Initialize the nav indicator
    createNavIndicator();
    const activeTab = document.querySelector('.nav-item.active');
    if (activeTab) {
        setTimeout(() => {
            updateNavIndicator(activeTab);
        }, 100);
    }

    // Update indicator on window resize to ensure responsiveness
    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab) {
            updateNavIndicator(activeTab);
        }
    });

    // Navigation: Customers
    elements.customersNav?.addEventListener('click', function() {
        switchTab(this, 
            [elements.custSidebar, elements.chatArea],
            [elements.chatSidebar, elements.storeArea, elements.generalMarketArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
        elements.custConversationList?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Navigation: Chat
    elements.chatsNav?.addEventListener('click', function() {
        switchTab(this, 
            [elements.chatSidebar, elements.chatArea],
            [elements.custSidebar, elements.storeArea, elements.generalMarketArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
        elements.chatConversationList?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Browser back fallback for non-chat tabs: return to the chat list page
    window.addEventListener('hotmapp-browser-back-to-base', () => {
        if (!elements.chatsNav?.classList.contains('active')) {
            switchTab(elements.chatsNav,
                [elements.chatSidebar, elements.chatArea],
                [elements.custSidebar, elements.storeArea, elements.generalMarketArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
            );
        }
    });

    // Navigation: Calls
    elements.callsNav?.addEventListener('click', function() {
        switchTab(this, 
            [elements.callsSidebar, elements.chatArea],
            [elements.chatSidebar, elements.custSidebar, elements.storeArea, elements.generalMarketArea, elements.starredSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
        elements.callHistoryList?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Navigation: General Market
    elements.generalMarketNav?.addEventListener('click', function() {
        switchTab(this,
            [elements.generalMarketArea],
            [elements.chatSidebar, elements.custSidebar, elements.chatArea, elements.storeArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
    });

    // Navigation: Store
    elements.storeNav?.addEventListener('click', function() {
        switchTab(this, 
            [elements.storeArea], 
            [elements.chatSidebar, elements.custSidebar, elements.chatArea, elements.generalMarketArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
    });

    // Navigation: Starred
    elements.starredNav?.addEventListener('click', function() {
        switchTab(this, 
            [elements.starredSidebar, elements.chatArea], 
            [elements.chatSidebar, elements.custSidebar, elements.storeArea, elements.generalMarketArea, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar]
        );
        elements.starredMessagesList?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Initialize horizontal swipe tab navigation
    initSwipeNavigation();
};

/**
 * Sets up horizontal swipe screen gestures to navigate between the main navbar buttons
 * (Customers, Chats, Calls, Market).
 */
const initSwipeNavigation = () => {
    let startX = 0;
    let startY = 0;
    let isSwipe = false;

    const navTabs = [
        elements.customersNav,
        elements.chatsNav,
        elements.callsNav,
        elements.generalMarketNav
    ];

    const getActiveTabIndex = () => {
        return navTabs.findIndex(tab => tab?.classList.contains('active'));
    };

    document.addEventListener('touchstart', (e) => {
        // Only single touch
        if (e.touches.length > 1) return;

        // Do not swipe if a chat window is open/viewing on mobile
        if (elements.chatContainer?.classList.contains('viewing-chat')) return;

        // Exclude interactive overlay modals, dropdowns, and header buttons
        const isOverlay = e.target.closest('.modal-overlay') || 
                          e.target.closest('.lightbox-modal') || 
                          e.target.closest('.store-search-overlay') ||
                          e.target.closest('.context-menu') ||
                          e.target.closest('.dropdown-menu');
        if (isOverlay) return;

        // Exclude specific horizontal-swiping elements, maps, and sliders
        const isExcluded = e.target.closest('.horizontal-scroll') || 
                           e.target.closest('.leaflet-container') || 
                           e.target.closest('[data-ui="cart-items-list"]') || 
                           e.target.closest('[data-ui="saved-items-list"]') ||
                           e.target.closest('input[type="range"]') ||
                           e.target.closest('.no-swipe');
        if (isExcluded) return;

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwipe = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isSwipe) return;

        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        // If horizontal movement is dominant, prevent default page vertical scrolling/bounce
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isSwipe) return;
        isSwipe = false;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const diffX = endX - startX;
        const diffY = endY - startY;

        // Thresholds: minimum 80px horizontal travel, maximum 60px vertical drift
        if (Math.abs(diffX) > 80 && Math.abs(diffY) < 60) {
            const activeIndex = getActiveTabIndex();
            if (activeIndex === -1) return;

            if (diffX > 80) {
                // Swipe to the right -> Go to the left tab
                if (activeIndex > 0) {
                    const prevTab = navTabs[activeIndex - 1];
                    prevTab?.click();
                }
            } else if (diffX < -80) {
                // Swipe to the left -> Go to the right tab
                if (activeIndex < navTabs.length - 1) {
                    const nextTab = navTabs[activeIndex + 1];
                    nextTab?.click();
                }
            }
        }
    });
};

export const openStoreView = () => {
    // Clear any ongoing transition cleanups
    clearActiveTransition();

    // Update active class on tab buttons
    const currentActiveTab = document.querySelector('.nav-item.active');
    if (currentActiveTab) currentActiveTab.classList.remove('active');

    // Hide the sliding indicator since Store is not in the navbar
    if (navIndicator) {
        navIndicator.style.width = '0px';
    }

    // Hide other panels and show store area
    const hideEls = [
        elements.chatSidebar,
        elements.custSidebar,
        elements.chatArea,
        elements.generalMarketArea,
        elements.starredSidebar,
        elements.callsSidebar,
        elements.archivedSidebar,
        elements.lockedChatsSidebar
    ];
    hideEls.forEach(el => {
        if (el) el.style.display = 'none';
    });

    if (elements.storeArea) {
        elements.storeArea.style.display = 'block';
    }

    // Reset list scroll state on mobile
    elements.chatContainer?.classList.remove('viewing-chat');
    elements.mainAppContent?.classList.remove('header-hidden');
    if (window.history.state && window.history.state.hotmappState === 'chat-view') {
        window.history.replaceState({ hotmappState: 'base' }, '', window.location.pathname);
        removeHistoryState('chat-view');
    }
};

window.openStoreView = openStoreView;
