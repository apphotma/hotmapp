import { elements } from './elements.js';
import { auth } from './firebase-config.js';
import { showToast } from './toast.js';
import { subscribeToAuthChanges } from './auth-service.js';
import { renderUserList, getAllUsersCache, getCurrentChatListIds } from './chat.js';

let lockedChats = {};
let currentPin = '';

const getStorageKey = () => {
    const user = auth.currentUser;
    return user ? `hotmapp_locked_chats_${user.uid}` : null;
};

export const loadLockedChats = () => {
    const key = getStorageKey();
    if (!key) {
        lockedChats = {};
        return;
    }
    try {
        lockedChats = JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
        lockedChats = {};
    }
};

export const saveLockedChats = () => {
    const key = getStorageKey();
    if (key) {
        localStorage.setItem(key, JSON.stringify(lockedChats));
    }
};

export const isChatLocked = (uid) => {
    return !!lockedChats[uid];
};

export const toggleChatLock = (uid) => {
    loadLockedChats(); // ensure up to date
    if (lockedChats[uid]) {
        delete lockedChats[uid];
    } else {
        lockedChats[uid] = true;
    }
    saveLockedChats();
    updateLockedChatsTriggerVisibility();
};

export const updateLockedChatsTriggerVisibility = () => {
    const trigger = elements.lockedChatsTrigger;
    if (!trigger) return;
    
    const count = Object.keys(lockedChats).length;
    if (count > 0 && auth.currentUser) {
        trigger.style.display = 'flex';
    } else {
        trigger.style.display = 'none';
    }
};

export const renderLockedChatsList = () => {
    const user = auth.currentUser;
    if (!user || !elements.lockedConversationList) return;

    loadLockedChats();
    const allUsers = getAllUsersCache();
    const chatListIds = getCurrentChatListIds() || {};
    const lockedActive = {};

    Object.keys(lockedChats).forEach(uid => {
        if (allUsers && allUsers[uid]) {
            const entry = chatListIds[uid];
            const meta = typeof entry === 'object' ? entry : { lastInteraction: entry || 0 };
            lockedActive[uid] = { ...allUsers[uid], ...meta };
        }
    });

    renderUserList(lockedActive, elements.lockedConversationList, user.uid, true, false, false);
};

export const openLockedChatsSidebar = () => {
    // Hide standard sidebars/areas
    if (elements.chatSidebar) elements.chatSidebar.style.display = 'none';
    if (elements.custSidebar) elements.custSidebar.style.display = 'none';
    if (elements.starredSidebar) elements.starredSidebar.style.display = 'none';
    if (elements.callsSidebar) elements.callsSidebar.style.display = 'none';
    if (elements.archivedSidebar) elements.archivedSidebar.style.display = 'none';
    if (elements.generalMarketArea) elements.generalMarketArea.style.display = 'none';
    if (elements.storeArea) elements.storeArea.style.display = 'none';
    
    if (elements.lockedChatsSidebar) elements.lockedChatsSidebar.style.display = 'flex';

    renderLockedChatsList();
};

const showLockedChatsAuthModal = () => {
    const modal = elements.lockedChatsAuthModal;
    if (modal) {
        currentPin = '';
        updateDots();
        const errorMsg = modal.querySelector('.app-lock-error-msg') || elements.lockedChatsErrorMsg;
        if (errorMsg) errorMsg.textContent = '';
        modal.style.display = 'flex';
        modal.classList.remove('fade-out');
    }
};

const hideLockedChatsAuthModal = () => {
    const modal = elements.lockedChatsAuthModal;
    if (modal) {
        modal.style.display = 'none';
    }
};

const handlePinDigit = (digit) => {
    if (currentPin.length < 4) {
        currentPin += digit;
        updateDots();

        if (currentPin.length === 4) {
            setTimeout(verifyPin, 150);
        }
    }
};

const handleDelete = () => {
    if (currentPin.length > 0) {
        currentPin = currentPin.slice(0, -1);
        updateDots();
    }
};

const handleClear = () => {
    currentPin = '';
    updateDots();
};

const updateDots = () => {
    const modal = elements.lockedChatsAuthModal;
    if (!modal) return;

    const dots = modal.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('filled', index < currentPin.length);
    });
};

const verifyPin = () => {
    const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
    const modal = elements.lockedChatsAuthModal;
    const lockCard = modal?.querySelector('.lock-card');

    if (currentPin === savedPin) {
        currentPin = '';
        updateDots();
        
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.style.display = 'none';
                openLockedChatsSidebar();
            }, 300);
        }
        showToast("Chats unlocked", "success");
    } else {
        currentPin = '';
        updateDots();
        const errorMsg = modal?.querySelector('.app-lock-error-msg') || elements.lockedChatsErrorMsg;
        if (errorMsg) errorMsg.textContent = "Incorrect PIN. Try again.";

        if (lockCard) {
            lockCard.classList.add('shake');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            setTimeout(() => {
                lockCard.classList.remove('shake');
            }, 400);
        }
    }
};

export const initChatLock = () => {
    subscribeToAuthChanges(user => {
        loadLockedChats();
        updateLockedChatsTriggerVisibility();
        
        if (!user) {
            if (elements.lockedChatsSidebar) elements.lockedChatsSidebar.style.display = 'none';
            if (elements.chatSidebar) elements.chatSidebar.style.display = 'flex';
        }
    });

    elements.lockedChatsTrigger?.addEventListener('click', () => {
        const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
        if (!savedPin) {
            showToast("Please set up App Lock PIN in Privacy Settings first to use Chat Lock.", "warning");
            elements.settingsPrivacyBtn?.click();
            return;
        }
        showLockedChatsAuthModal();
    });

    elements.closeLockedChatsAuthModalBtn?.addEventListener('click', () => {
        hideLockedChatsAuthModal();
    });

    const modal = elements.lockedChatsAuthModal;
    if (modal) {
        const keypadBtns = modal.querySelectorAll('.keypad-btn');
        keypadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.val;
                const action = btn.dataset.action;

                if (val !== undefined) {
                    handlePinDigit(val);
                } else if (action === 'clear') {
                    handleClear();
                } else if (action === 'delete') {
                    handleDelete();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (modal.style.display === 'flex') {
                if (e.key >= '0' && e.key <= '9') {
                    handlePinDigit(e.key);
                } else if (e.key === 'Backspace') {
                    handleDelete();
                } else if (e.key === 'Escape' || e.key === 'Delete') {
                    handleClear();
                }
            }
        });
    }

    elements.closeLockedChatsSidebarBtn?.addEventListener('click', () => {
        if (elements.lockedChatsSidebar) elements.lockedChatsSidebar.style.display = 'none';
        if (elements.chatSidebar) elements.chatSidebar.style.display = 'flex';
    });
};
