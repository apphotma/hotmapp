import { elements } from './elements.js';
import { showToast } from './toast.js';
import { currentLanguage, languageList } from './language.js';
import { pushHistoryState, removeHistoryState, replaceHistoryState, dismissHistoryState } from './history-manager.js';
import { auth, db } from './firebase-config.js';
import { debounce, getRelativeTime, compressImage, getAvatarUrl, isEditableTextMessage } from './utils.js'; // Import utilities
import { ref, get, child, push, query, orderByChild, orderByKey, limitToLast, endBefore, startAfter, update, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { saveMessage, createGroup, promoteToAdmin, demoteFromAdmin, addGroupMembers, removeGroupMember, exitGroup, joinGroup, updateGroupProfilePhoto, updateGroupName, subscribeToMessages, subscribeToMessageUpdates, subscribeToMessageRemovals, subscribeToPinnedMessage, pinMessage, unpinMessage, markMessagesAsRead, markMessagesAsReadIds, subscribeToUnreadCount, getAllUsers, addToChatList, subscribeToChatList, getFirstUnreadMessageId, markMessageAsUnread, deleteMessagesBatch, deleteMessagesForEveryoneBatch, starMessagesBatch, getChatList, setTypingStatus, subscribeToUserProfile, subscribeToGroupProfile, uploadFile, subscribeToAllUsers, subscribeToCustomerList, subscribeToFriendRequests, sendFriendRequest, acceptFriendRequest, declineFriendRequest, toggleCustomerList, toggleMuteUser, subscribeToMutedUsers, subscribeToSentRequests, markMessagesAsDelivered, updateMessage, sendCallSignal, subscribeToCallSignals, clearCallSignal, addIceCandidate, subscribeToIceCandidates, saveCallLog, subscribeToCallHistory, clearCallHistory, getUserProfile, unfriendUser, deleteChatFromList, updateChatArchiveStatus, updateUserProfile, subscribeToBlockedUsers, toggleBlockUser, unblockAllUsers, subscribeToNewMessages, getOrder, updateOrder } from './database-service.js?v=1.0.7';
import { cacheItem, getCachedItem, deleteCachedItem, getCachedMessages } from './cache-manager.js';
import { subscribeToAuthChanges } from './auth-service.js';
import { refreshStoreGrids } from './store.js';
import { refreshCart } from './shop.js';
import { isChatLocked, toggleChatLock, renderLockedChatsList } from './chat-lock.js';
import { playIncomingSound, getCallRingtoneUrl } from './notifications-settings.js';
import { getOrDeriveSharedKey, encryptText, decryptText, getStoredKey } from './crypto-helper.js';
import { switchTab } from './navigation.js';
import { clearDeliveredNotifications } from './fcm-service.js';
import { buildCustomerSidebarUsers, countPendingRequestBreakdown, countPendingRequests, shouldShowUserInNewCustomersTab, shouldShowUserInRequestsModal } from './friend-list-utils.js';
import { getMessageStatusIcon, mergeMessageStatus } from './message-status.js';
import { createChatInitializationGate } from './chat-init-state.js';

export const getAllUsersCache = () => allUsersCache;
export const getCurrentChatListIds = () => currentChatListIds;

const animateRequestFlyer = (startElement) => {
    const targetElement = elements.headerOutgoingRequestsBtn || elements.headerIncomingRequestsBtn || elements.headerRequestsBtn;
    if (!targetElement) return;

    let startRect = null;
    if (startElement && typeof startElement.getBoundingClientRect === 'function') {
        startRect = startElement.getBoundingClientRect();
    }
    if ((!startRect || startRect.width === 0 || startRect.height === 0) && elements.manageCustomersModal) {
        const modalRect = elements.manageCustomersModal.getBoundingClientRect();
        startRect = {
            left: modalRect.left + modalRect.width / 2,
            top: modalRect.top + modalRect.height / 2,
            width: 0,
            height: 0
        };
    }
    if (!startRect) return;

    const targetRect = targetElement.getBoundingClientRect();
    const countText = elements.headerOutgoingRequestBadge?.textContent.trim();
    const flyer = document.createElement('div');
    flyer.className = 'request-flyer';
    flyer.textContent = countText || '✈️';
    const startLeft = startRect.left + startRect.width / 2;
    const startTop = startRect.top + startRect.height / 2;
    flyer.style.left = `${startLeft - 24}px`;
    flyer.style.top = `${startTop - 24}px`;
    flyer.style.opacity = '1';
    flyer.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
    flyer.style.position = 'fixed';
    flyer.style.zIndex = '100500';
    flyer.style.pointerEvents = 'none';
    flyer.style.whiteSpace = 'nowrap';
    flyer.style.backfaceVisibility = 'hidden';
    flyer.style.transformStyle = 'preserve-3d';
    flyer.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
    flyer.style.willChange = 'transform, opacity';
    document.body.appendChild(flyer);

    const pathSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pathSvg.setAttribute('class', 'request-flyer-curve');
    pathSvg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    pathSvg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const distanceX = endX - startLeft;
    const distanceY = endY - startTop;
    const distanceFactor = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    const baseOffset = Math.min(220, Math.max(80, distanceFactor * 0.28));
    let controlY;
    let controlX1 = startLeft + distanceX * 0.25;
    let controlX2 = startLeft + distanceX * 0.75;

    if (endY < startTop) {
        // Header target is above the start point: draw a higher arc with more upward curvature.
        controlY = Math.min(startTop, endY) - baseOffset;
        controlX1 -= 10;
        controlX2 += 10;
    } else {
        // Header target is below or level with the start point: draw a softer downward arc.
        controlY = Math.max(startTop, endY) + baseOffset * 0.35;
        controlX1 += 10;
        controlX2 -= 10;
    }

    path.setAttribute('d', `M${startLeft},${startTop} C${controlX1},${controlY} ${controlX2},${controlY} ${endX},${endY}`);
    pathSvg.appendChild(path);
    document.body.appendChild(pathSvg);

    const pathLength = path.getTotalLength();
    path.style.strokeDasharray = pathLength;
    path.style.strokeDashoffset = pathLength;

    const sparkle = document.createElement('div');
    sparkle.className = 'request-flyer-sparkle';
    sparkle.style.left = `${endX - 8}px`;
    sparkle.style.top = `${endY - 8}px`;
    document.body.appendChild(sparkle);

    // Force layout so the transition can animate from the initial state.
    flyer.getBoundingClientRect();
    pathSvg.getBoundingClientRect();
    sparkle.getBoundingClientRect();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const deltaX = endX - startLeft;
            const deltaY = endY - startTop;
            flyer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.72) rotate(360deg)`;
            flyer.style.opacity = '1';
            path.style.strokeDashoffset = '0';
            sparkle.classList.add('animate');
        });
    });

    setTimeout(() => {
        flyer.classList.add('fade-out');
        pathSvg.classList.add('fade-out');
    }, 700);

    setTimeout(() => {
        if (flyer.parentElement) flyer.parentElement.removeChild(flyer);
        if (pathSvg.parentElement) pathSvg.parentElement.removeChild(pathSvg);
        if (sparkle.parentElement) sparkle.parentElement.removeChild(sparkle);
        if (targetElement) {
            targetElement.classList.add('request-target-pulse');
            setTimeout(() => targetElement.classList.remove('request-target-pulse'), 500);
        }
    }, 1100);
};

const escapeHtml = (text) => {
    return String(text || '').replace(/[&<>"'`=\/]/g, (char) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#96;',
            '=': '&#61;',
            '/': '&#47;'
        };
        return map[char] || char;
    });
};

const normalizeMessageText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        if (typeof value.text === 'string') return value.text;
        if (typeof value.message === 'string') return value.message;
        try {
            return JSON.stringify(value);
        } catch (err) {
            return '';
        }
    }
    return '';
};

const linkifyText = (text) => {
    if (!text) return '';
    const urlPattern = /(https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/gi;
    let lastIndex = 0;
    let result = '';
    let match;

    while ((match = urlPattern.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, match.index));
        let href = match[0];
        if (!/^https?:\/\//i.test(href)) {
            href = 'http://' + href;
        }
        result += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[0])}</a>`;
        lastIndex = match.index + match[0].length;
    }

    result += escapeHtml(text.slice(lastIndex));
    return result;
};

const waitForE2EEKeys = async (userId) => {
    try {
        // 1. Fetch user's public profile from DB to see if they have E2EE enabled (publicKey exists)
        const profile = await getUserProfile(userId);
        if (!profile || !profile.publicKey) {
            // E2EE is not enabled or not yet set up, no need to wait
            return;
        }

        // 2. If E2EE is enabled, wait until we have E2EE keys in IndexedDB
        // We poll getStoredKey(userId) every 50ms, up to a timeout (e.g. 5 seconds)
        const startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            const stored = await getStoredKey(userId);
            if (stored && stored.publicKey && stored.privateKey) {
                console.log("E2EE keys are ready!");
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.warn("Timed out waiting for E2EE keys to initialize.");
    } catch (err) {
        console.error("Error in waitForE2EEKeys:", err);
    }
};

const tryDecryptMessage = async (msg, senderId) => {
    try {
        if (msg.isEncrypted && msg.text && msg.iv) {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.warn("[E2EE DEBUG] tryDecryptMessage: No currentUser found.");
                return "🔒 [Encrypted Message]";
            }

            let otherUid = msg.senderId === currentUser.uid ? activeChatUid : msg.senderId;
            if (!otherUid && msg.chatId) {
                otherUid = msg.chatId.split('_').find(id => id !== currentUser.uid);
            }
            if (!otherUid) {
                console.warn("[E2EE DEBUG] tryDecryptMessage: No otherUid could be determined. msg =", msg);
                return "🔒 [Encrypted Message]";
            }

            const otherProfile = allUsersCache[otherUid] || await getUserProfile(otherUid);
            if (!otherProfile || !otherProfile.publicKey) {
                console.warn(`[E2EE DEBUG] tryDecryptMessage: publicProfile or publicKey missing for otherUid: ${otherUid}`, otherProfile);
                return "🔒 [Encrypted Message]";
            }

            const sharedKey = await getOrDeriveSharedKey(currentUser.uid, otherProfile.publicKey);
            if (!sharedKey) {
                console.warn("[E2EE DEBUG] tryDecryptMessage: Failed to derive shared key with otherProfile.publicKey");
                return "🔒 [Encrypted Message]";
            }

            try {
                const decrypted = await decryptText(msg.text, msg.iv, sharedKey);
                console.log(`[E2EE DEBUG] tryDecryptMessage: Decryption succeeded. Result starts with: ${decrypted ? decrypted.substring(0, 40) : 'null'}`);
                return decrypted;
            } catch (e) {
                console.error("[E2EE DEBUG] tryDecryptMessage: Decryption via SubtleCrypto failed:", e);
                return "🔒 [Decryption failed]";
            }
        }
        return msg.text;
    } catch (e) {
        console.error("[E2EE DEBUG] tryDecryptMessage error in outer wrapper:", e);
        return "🔒 [Decryption failed]";
    }
};

const decryptMessageInPlace = async (msg, options = {}) => {
    const { cache = true } = options;

    console.log(`[E2EE DEBUG] decryptMessageInPlace: checking message ${msg.id}. isEncrypted = ${msg.isEncrypted}, isDecrypted = ${msg.isDecrypted}`);

    // Self-healing check: if the message was cached as decrypted but has a null URL for media,
    // it was a failed decryption. Reset it so we attempt decryption again.
    const isMedia = ['image', 'video', 'audio', 'document'].includes(msg.type);
    if (msg.isEncrypted && msg.isDecrypted && isMedia && (!msg.url || msg.url === 'null' || msg.url === 'undefined')) {
        console.log(`[E2EE DEBUG] decryptMessageInPlace: resetting corrupted cached message ${msg.id} to trigger re-decryption.`);
        msg.isDecrypted = false;
    }

    if (msg.isEncrypted && msg.text && msg.iv && !msg.isDecrypted) {
        msg.ciphertext = msg.text;
        const decrypted = await tryDecryptMessage(msg, msg.senderId);

        const isDecryptedSuccessfully = decrypted && !decrypted.startsWith("🔒");

        if (isDecryptedSuccessfully) {
            const trimmed = decrypted.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    const payload = JSON.parse(trimmed);
                    console.log(`[E2EE DEBUG] decryptMessageInPlace: successfully parsed JSON payload for ${msg.id}. Keys present:`, Object.keys(payload));
                    if (payload.text !== undefined) msg.text = normalizeMessageText(payload.text);
                    if (payload.url !== undefined) msg.url = payload.url;
                    if (payload.fileName !== undefined) msg.fileName = payload.fileName;
                    if (payload.fileSize !== undefined) msg.fileSize = payload.fileSize;
                    if (payload.thumbnailUrl !== undefined) msg.thumbnailUrl = payload.thumbnailUrl;
                    if (payload.latitude !== undefined) msg.latitude = payload.latitude;
                    if (payload.longitude !== undefined) msg.longitude = payload.longitude;
                    if (payload.address !== undefined) msg.address = payload.address;
                    if (payload.staticMapUrl !== undefined) msg.staticMapUrl = payload.staticMapUrl;
                    if (payload.mapUrl !== undefined) msg.mapUrl = payload.mapUrl;
                    if (payload.replyTo !== undefined) msg.replyTo = payload.replyTo;
                    if (payload.invoiceId !== undefined) msg.invoiceId = payload.invoiceId;
                    if (payload.liveSharingEnded !== undefined) msg.liveSharingEnded = payload.liveSharingEnded;
                    if (payload.duration !== undefined) msg.duration = payload.duration;
                    msg.isDecrypted = true;
                    // Persist decrypted payload so reopening the chat shows plaintext instantly
                    if (cache) {
                        try { cacheItem('messages', msg); } catch (e) { /* ignore cache errors */ }
                    }
                } catch (e) {
                    console.error("[E2EE DEBUG] decryptMessageInPlace: Failed to parse decrypted payload JSON for:", msg.id, e);
                    msg.text = normalizeMessageText(decrypted);
                    msg.isDecrypted = true;
                    if (cache) {
                        try { cacheItem('messages', msg); } catch (e) { /* ignore cache errors */ }
                    }
                }
            } else {
                console.log(`[E2EE DEBUG] decryptMessageInPlace: decrypted payload is not JSON for message ${msg.id}`);
                msg.text = normalizeMessageText(decrypted);
                msg.isDecrypted = true;
                if (cache) {
                    try { cacheItem('messages', msg); } catch (e) { /* ignore cache errors */ }
                }
            }
        } else {
            // Decryption failed (e.g. key mismatch, offline, or keys not initialized yet)
            console.warn(`[E2EE DEBUG] decryptMessageInPlace: decryption failed for message ${msg.id}. Status is: ${decrypted}`);
            msg.text = normalizeMessageText(decrypted);
        }
    }
    return msg;
};

const tryDecryptPreview = async (otherUid, ciphertext, iv) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUid || !ciphertext || !iv) return "🔒 [Encrypted Message]";
    const otherProfile = allUsersCache[otherUid] || await getUserProfile(otherUid);
    if (!otherProfile || !otherProfile.publicKey) return "🔒 [Encrypted Message]";
    const sharedKey = await getOrDeriveSharedKey(currentUser.uid, otherProfile.publicKey);
    if (!sharedKey) return "🔒 [Encrypted Message]";
    try {
        const decrypted = await decryptText(ciphertext, iv, sharedKey);
        if (decrypted && decrypted.startsWith('{') && decrypted.endsWith('}')) {
            try {
                const payload = JSON.parse(decrypted);
                return payload.text || '';
            } catch (e) {
                return decrypted;
            }
        }
        return decrypted;
    } catch (e) {
        return "🔒 [Decryption failed]";
    }
};

const decryptPreviewText = async (uid, profile, currentUserId, element) => {
    if (profile.lastMessageIsEncrypted && profile.lastMessage && profile.lastMessageIv) {
        const preview = await tryDecryptPreview(uid, profile.lastMessage, profile.lastMessageIv);
        if (element) {
            const prefix = profile.lastSenderId === currentUserId ? 'You: ' : '';
            element.textContent = `${prefix}${preview}`;
        }
    }
};

const renderE2EENotice = (hasKeys) => {
    if (!elements.messagesContainer) return;
    const existingNotice = elements.messagesContainer.querySelector('.e2ee-chat-notice');
    if (existingNotice) existingNotice.remove();

    const noticeHtml = hasKeys ? `
        <div class="e2ee-chat-notice" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 168, 132, 0.08); border: 1px dashed rgba(0, 168, 132, 0.3); border-radius: 12px; padding: 12px 16px; margin: 15px auto 20px auto; max-width: 85%; text-align: center; font-size: 0.82rem; color: var(--text); gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--brand); font-weight: 700;">
                <i class="fa-solid fa-lock" style="font-size: 0.85rem;"></i> End-to-End Encrypted
            </div>
            <div style="color: var(--muted); line-height: 1.4;">
                Messages and calls are secured with end-to-end encryption. No one outside of this chat, not even Hotmapp, can read or listen to them.
            </div>
        </div>
    ` : `
        <div class="e2ee-chat-notice" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 168, 132, 0.08); border: 1px dashed rgba(0, 168, 132, 0.3); border-radius: 12px; padding: 12px 16px; margin: 15px auto 20px auto; max-width: 85%; text-align: center; font-size: 0.82rem; color: var(--text); gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--brand); font-weight: 700;">
                <i class="fa-solid fa-comments" style="font-size: 0.85rem;"></i> Standard Chat
            </div>
            <div style="color: var(--muted); line-height: 1.4;">
                Messages in this chat are not end-to-end encrypted.
            </div>
        </div>
    `;
    elements.messagesContainer.insertAdjacentHTML('afterbegin', noticeHtml);
};

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

let currentPdfZoom = 100;
let currentPdfPanX = 0;
let currentPdfPanY = 0;
let touchStartDist = 0;
let baseZoom = 100;
let lastPdfTapTime = 0;

const updatePdfZoomUI = (smooth = false) => {
    if (elements.pdfViewerZoomLevel) {
        elements.pdfViewerZoomLevel.textContent = `${currentPdfZoom}%`;
    }
    const container = elements.pdfViewerScrollContainer;
    if (container) {
        // Reset baseline page layout width so pages are formatted properly
        container.style.setProperty('--pdf-page-max-width', '600px');

        const pdfZoomEl = container.querySelector('.pdf-zoom-container');
        if (pdfZoomEl) {
            const scale = currentPdfZoom / 100;
            if (smooth) {
                pdfZoomEl.style.transition = 'transform 0.2s ease-out';
            } else {
                pdfZoomEl.style.transition = 'none';
            }

            if (scale <= 1) {
                currentPdfPanX = 0;
                currentPdfPanY = 0;
                pdfZoomEl.style.transform = 'scale(1) translate(0px, 0px)';
                pdfZoomEl.style.cursor = 'default';
            } else {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                const maxPanX = (containerWidth * (scale - 1)) / 2 / scale;
                const maxPanY = (containerHeight * (scale - 1)) / 2 / scale;

                currentPdfPanX = Math.max(-maxPanX, Math.min(maxPanX, currentPdfPanX));
                currentPdfPanY = Math.max(-maxPanY, Math.min(maxPanY, currentPdfPanY));

                pdfZoomEl.style.transform = `scale(${scale}) translate(${currentPdfPanX}px, ${currentPdfPanY}px)`;
                pdfZoomEl.style.cursor = 'grab';
            }
        }
    }
};

const renderPdfPagesInline = async (url, container) => {
    let zoomContainer = container.querySelector('.pdf-zoom-container');
    if (!zoomContainer) {
        container.innerHTML = '<div class="pdf-zoom-container"></div>';
        zoomContainer = container.querySelector('.pdf-zoom-container');
    }
    zoomContainer.innerHTML = '<div class="pdf-loading"><span class="spinner" style="border-top-color: #fff; width: 24px; height: 24px; border-width: 2px;"></span> Rendering document...</div>';

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: url,
            withCredentials: false
        });

        const pdf = await loadingTask.promise;
        zoomContainer.innerHTML = '';

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        const scale = isMobile ? 1.1 : 1.4;

        // Create page placeholders immediately so the UI layout is established and loader clears
        const pagesData = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pdf-page-wrapper loading';
            wrapper.style.position = 'relative';
            wrapper.style.minHeight = isMobile ? '350px' : '600px'; // Placeholder height while loading
            wrapper.style.marginBottom = '20px';

            // Add spinner for this page
            const spinner = document.createElement('div');
            spinner.className = 'pdf-page-spinner';
            spinner.innerHTML = '<span class="spinner" style="border-top-color: var(--brand); width: 24px; height: 24px; border-width: 2px;"></span>';
            wrapper.appendChild(spinner);

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.style.display = 'none'; // Hide until rendered
            wrapper.appendChild(canvas);

            const indicator = document.createElement('div');
            indicator.className = 'pdf-page-indicator';
            indicator.textContent = `Page ${pageNum} of ${pdf.numPages}`;
            wrapper.appendChild(indicator);

            zoomContainer.appendChild(wrapper);

            pagesData.push({ pageNum, wrapper, canvas, spinner });
        }

        // Render pages sequentially, but yielding back to the browser's event loop to prevent UI freezing
        for (const pageData of pagesData) {
            const { pageNum, wrapper, canvas, spinner } = pageData;

            // Get page
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Page rendered! Reveal canvas and remove spinner/loading state
            canvas.style.display = 'block';
            spinner.style.display = 'none';
            wrapper.className = 'pdf-page-wrapper';
            wrapper.style.minHeight = 'auto'; // Reset min-height

            // Yield control back to browser to process touch scrolling and UI updates smoothly
            await new Promise(resolve => setTimeout(resolve, 30));
        }

    } catch (err) {
        console.error("PDF inline rendering failed:", err);
        zoomContainer.innerHTML = `
            <div class="pdf-error-fallback">
                <i class="fa-solid fa-file-circle-exclamation" style="font-size: 3.5rem; color: #ffc107; margin-bottom: 15px; display: block;"></i>
                <h5 style="margin-bottom: 8px;">Cannot Load Preview</h5>
                <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 20px;">This browser or server settings prevents loading the preview directly.</p>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn" style="background: var(--brand); color: white; padding: 10px 20px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 8px; box-shadow: var(--shadow);">
                    <i class="fa-solid fa-external-link"></i> Open Document Natively
                </a>
            </div>
        `;
    }
};

const setupLightboxUI = (msg, url, isProfilePhoto) => {
    const usernameEl = elements.lightboxUsername;
    const timeEl = elements.lightboxTime;
    const avatarEl = elements.lightboxAvatar;

    if (msg) {
        if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'flex';
        if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'flex';
        const profile = allUsersCache[msg.senderId] || {};
        const name = profile.fullname || msg.senderName || 'Contact';

        if (usernameEl) {
            usernameEl.textContent = name;
            usernameEl.style.display = 'block';
        }
        if (timeEl) {
            timeEl.textContent = getRelativeTime(msg.timestamp);
            timeEl.style.display = 'block';
        }
        if (avatarEl) {
            avatarEl.src = getAvatarUrl(name, profile.profilePhoto);
            avatarEl.style.display = 'block';
        }

        if (elements.lightboxStarBtn) {
            elements.lightboxStarBtn.style.display = 'flex';
            elements.lightboxStarBtn.onclick = async () => {
                selectedMessages.clear();
                selectedMessages.add(msg.id);
                await handleMassStar();
            };
        }

        if (elements.lightboxForwardBtn) {
            elements.lightboxForwardBtn.style.display = 'flex';
            elements.lightboxForwardBtn.onclick = async () => {
                if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                pendingForwardData = [{
                    text: msg.text || '',
                    type: msg.type,

                    url: msg.url || null,
                    fileName: msg.fileName || null,
                    fileSize: msg.fileSize || null
                }];
                selectedForwardRecipients.clear();
                updateForwardButton();

                if (elements.forwardModal) {
                    elements.forwardModal.style.display = 'flex';
                    if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';
                }
                await populateForwardUserList();
            };
        }
    }
};


/**
 * 
 * Opens the internal PDF viewer modal
 * Defined on window so it can be called from inline onclick handlers
 */
window.openPdfViewer = async (url, msgId = null) => {
    if (!url || url === 'null' || url === 'undefined') {
        showToast('Document is still uploading. Please wait a moment.', 'info');
        return;
    }

    currentPdfZoom = 100;
    updatePdfZoomUI();

    let pdfUrl = url;
    const msg = msgId ? messages.find(m => m.id === msgId) : null;

    // Handle background-uploading order invoice PDFs (initially downloadURL is null/empty)
    if (!pdfUrl || pdfUrl === 'null' || pdfUrl === 'undefined') {
        if (msg && msg.invoiceId) {
            showToast("Generating document preview, please wait...", "info");
            try {
                // Try fetching directly from database to bypass any cached 'null' value
                const orderSnap = await get(ref(db, `orders/${msg.invoiceId}`));
                if (orderSnap.exists()) {
                    const orderData = orderSnap.val();
                    if (orderData.downloadURL) {
                        pdfUrl = orderData.downloadURL;
                        await cacheItem('orders', orderData);
                    } else {
                        // If it is still null on the database, listen for changes in real-time
                        showToast("Document is uploading, please wait a moment...", "info");
                        pdfUrl = await new Promise((resolve, reject) => {
                            const orderRef = ref(db, `orders/${msg.invoiceId}/downloadURL`);
                            const timeoutId = setTimeout(() => {
                                unsub();
                                reject(new Error("Timeout waiting for document upload"));
                            }, 12000);

                            const unsub = onValue(orderRef, (snapshot) => {
                                const val = snapshot.val();
                                if (val) {
                                    clearTimeout(timeoutId);
                                    unsub();
                                    resolve(val);
                                }
                            });
                        });
                        if (pdfUrl) {
                            const updatedOrder = { ...orderData, downloadURL: pdfUrl };
                            await cacheItem('orders', updatedOrder);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to retrieve document URL:", err);
                showToast("Document is still uploading. Please try again in a few seconds.", "warning");
                return;
            }
        }
    }

    if (!pdfUrl || pdfUrl === 'null' || pdfUrl === 'undefined') {
        showToast("Document is still uploading. Please try again in a few seconds.", "warning");
        return;
    }

    if (elements.pdfViewerModal) {
        if (elements.downloadPdfViewerBtn) elements.downloadPdfViewerBtn.dataset.url = pdfUrl;
        if (elements.printPdfViewerBtn) elements.printPdfViewerBtn.dataset.url = pdfUrl;

        if (elements.pdfViewerTitle) {
            elements.pdfViewerTitle.textContent = msg ? msg.fileName || 'Document Preview' : 'Document Preview';
        }
        if (elements.pdfViewerSignBtn) {
            const isSignable = (msg && msg.type === 'document' && msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf') && !msg.deleted) ||
                (msg && msg.type === 'order') ||
                (pdfUrl && (pdfUrl.toLowerCase().includes('.pdf') || pdfUrl.toLowerCase().includes('invoice')));
            if (isSignable) {
                elements.pdfViewerSignBtn.style.display = 'grid';
                elements.pdfViewerSignBtn.onclick = async () => {
                    elements.pdfViewerModal.style.display = 'none';
                    showToast("Downloading document for signing...", "info");
                    try {
                        const resp = await fetch(pdfUrl);
                        const blob = await resp.blob();
                        const signedBlob = await openDocSigner(blob);
                        if (signedBlob) {
                            showToast("Sending signed document...", "info");
                            const filename = (msg && msg.fileName) ? msg.fileName : (msg && msg.type === 'order' ? `signed_invoice_${msg.id.substring(0, 6)}.pdf` : 'signed_document.pdf');
                            await sendMedia('document', signedBlob, filename);
                        }
                    } catch (err) {
                        console.error("Failed to download or sign document:", err);
                        showToast("Error loading document for signing.", "error");
                    }
                };
            } else {
                elements.pdfViewerSignBtn.style.display = 'none';
                elements.pdfViewerSignBtn.onclick = null;
            }
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

        elements.pdfViewerModal.style.display = 'flex';

        // Show loading spinner while downloading the PDF via storage SDK
        if (pdfUrl.startsWith('https://firebasestorage.googleapis.com')) {
            // Temporarily show spinner in container or iframe
            if (elements.pdfViewerScrollContainer) {
                elements.pdfViewerScrollContainer.innerHTML = '<div class="pdf-loading"><span class="spinner" style="border-top-color: #fff; width: 24px; height: 24px; border-width: 2px;"></span> Downloading document...</div>';
                elements.pdfViewerScrollContainer.style.display = 'flex';
            }

            // Optional: revoke previous object URL if it existed.
            if (activePdfBlobUrl) {
                URL.revokeObjectURL(activePdfBlobUrl);
                activePdfBlobUrl = null;
            }
        }

        if (elements.pdfViewerScrollContainer) {
            if (elements.pdfViewerIframe) {
                elements.pdfViewerIframe.src = '';
                elements.pdfViewerIframe.style.display = 'none';
            }
            elements.pdfViewerScrollContainer.style.display = 'flex';
            if (elements.printPdfViewerBtn) elements.printPdfViewerBtn.style.display = 'grid';

            // Start rendering pages inline
            renderPdfPagesInline(pdfUrl, elements.pdfViewerScrollContainer);
        }
    }
};

window.loadAndRenderInvoiceCard = async (msgId, invoiceId, isSent) => {
    const cardEl = document.getElementById(`invoice-card-${msgId}`);
    if (!cardEl) return;

    const renderInvoiceCard = (order) => {
        const msg = messages.find(m => m.id === msgId);
        const isConfirmed = order.status === 'confirmed' || order.orderConfirmed || (msg && msg.orderConfirmed);
        const totalHtml = `<span style="font-weight: 800; color: var(--brand-dark);">${order.currency}${parseFloat(order.total).toFixed(2)}</span>`;

        let statusBadge = '';
        if (isConfirmed) {
            statusBadge = `<span class="order-status-badge confirmed" style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; margin-left: auto;">Confirmed</span>`;
        } else {
            statusBadge = `<span class="order-status-badge pending" style="background: #fff3e0; color: #ef6c00; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; margin-left: auto;">Pending</span>`;
        }

        let actionButtonHtml = '';
        if (!isConfirmed && !isSent) {
            actionButtonHtml = `
                <button class="confirm-order-btn" data-msg-id="${msgId}" data-invoice-id="${invoiceId}" style="width: 100%; margin-top: 8px; background: var(--brand); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 0.8rem;">Confirm Order</button>
            `;
        }

        const viewButtonHtml = order.downloadURL ? `
            <button onclick="openPdfViewer('${order.downloadURL}', '${msgId}')" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: white; border: 1px solid var(--border); padding: 5px; border-radius: 6px; cursor: pointer; font-size: 0.76rem; font-weight: 600;"><i class="fa-solid fa-file-pdf" style="color: #008069;"></i> View PDF</button>
        ` : `
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: #fff7e6; border: 1px solid #ffe0b2; padding: 5px; border-radius: 6px; font-size: 0.76rem; font-weight: 600; color: var(--muted);">Uploading invoice...</div>
        `;

        cardEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; border-radius: 6px; background: rgba(0,0,0,0.03); padding: 8px;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.88rem; color: var(--brand-dark);">
                    <i class="fa-solid fa-file-invoice-dollar" style="font-size: 1.1rem;"></i>
                    <span>Order Invoice</span>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.76rem; color: var(--muted); margin-top: 2px;">
                    Order Number: <strong>${order.orderNumber || invoiceId.substring(0, 8).toUpperCase()}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 6px;">
                    <span>Total:</span>
                    <span>${totalHtml}</span>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                    ${viewButtonHtml}
                </div>
                ${actionButtonHtml}
            </div>
        `;
    };

    const renderLoading = () => {
        cardEl.innerHTML = `<div class="invoice-loading" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--muted);"><span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin:0;"></span> Uploading invoice...</div>`;
    };

    try {
        const order = await getOrder(invoiceId);
        if (!order) {
            cardEl.innerHTML = `<div style="color: var(--muted); font-size: 0.85rem; padding: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Invoice not found</div>`;
            return;
        }

        if (!order.downloadURL) {
            renderLoading();
            const orderRef = ref(db, `orders/${invoiceId}`);
            const unsubscribe = onValue(orderRef, async (snapshot) => {
                const updatedOrder = snapshot.val();
                if (!updatedOrder) return;
                await cacheItem('orders', updatedOrder);
                if (updatedOrder.downloadURL) {
                    unsubscribe();
                    renderInvoiceCard(updatedOrder);
                } else {
                    renderInvoiceCard(updatedOrder);
                }
            });
            return;
        }

        renderInvoiceCard(order);
    } catch (err) {
        console.error("Error loading invoice card details:", err);
        cardEl.innerHTML = `<div style="color: var(--muted); font-size: 0.85rem;">Failed to load invoice details.</div>`;
    }
};

const messages = [];
const PENDING_MESSAGES_STORAGE_KEY = 'hotmapp_pending_messages';
let messageQueue = [];
let isProcessingQueue = false;
let olderMessagesBacklog = [];
let pendingMessageSyncInFlight = false;
let pendingMessageSyncListenerAttached = false;
let isLoadingOlderMessages = false;
let renderedCount = 0;
let backgroundDecryptPaused = false;
let backgroundDecryptResumeTimer = null;
let chatInteractionPauseListenersAttached = false;
let activePdfBlobUrl = null;
let mediaRecorder;
let audioChunks = [];
let audioUrl = null;
let recordingInterval;
let msgAddUnsubscribe;

let sendInFlight = false;
let msgChangeUnsubscribe;
let msgRemoveUnsubscribe;
let pinnedMsgUnsubscribe;
let pinnedMessageData = null;
let userStatusUnsubscribe;
let videoRecorder;
let videoChunks = [];
let cameraStream = null;
export let moduleFriendsList = {}; // Track friendship status globally within the module
let liveLocationWatchId = null;
let liveLocationTimeoutId = null;
let currentLiveLocationMessageId = null; // New global variable to track the active live location message
let stopLiveSharingFn = null; // Global module reference to stop live sharing
let selectionMap = null;
let selectionMarker = null;
export let activeChatUid = null; // Track the UID of the user we are currently chatting with
export const getActiveChatUid = () => activeChatUid;
let isCurrentlyTypingInDb = false;
let pendingForwardData = []; // Buffer to store message data being forwarded
let incomingShareIntent = null; // Buffer to hold share intents received before authentication
let firstUnreadId = null; // Target for jumping to unread messages
let isInitialLoad = false; // Flag to prevent jitter during history loading
const chatInitializationGate = createChatInitializationGate();
let isSelectMode = false;
let searchResults = [];
let currentSearchIndex = -1;
let selectedMessages = new Set();
let selectedForwardRecipients = new Set();
let replyingTo = null; // State to track current reply
let editingMessageId = null; // State to track current edit
let newMessagesCount = 0; // Track new messages received while user is scrolled up
let mutedUsers = {}; // Map of UID -> boolean for suppressed notifications
let mutedUsersUnsubscribe;
let ephemeralExpiryDuration = 0; // 0 means ephemeral messages are off, otherwise duration in ms
let ephemeralMessageTimers = {}; // Stores setTimeout IDs for ephemeral messages
let reactionDetailModalTargetId = null; // Stores the ID of the message whose reactions are being viewed
let notificationSoundsEnabled = true; // Global flag for notification sounds
let readReceiptsEnabled = true; // Global flag for read receipts
let blockedUsers = {}; // Tack blocked users in real-time
export let excludedContacts = {}; // Track excluded contacts in real-time
let currentUserWhoCanViewShop = 'anyone'; // Global flag for current user's shop privacy
let currentUserOnlinePrivacy = 'anyone'; // Global flag for online status privacy
let currentUserLastSeenPrivacy = 'anyone'; // Global flag for last seen status privacy
let activeManageTab = 'new'; // 'added', 'new', or 'requests'

let allUsersCache = {};
const unreadCountUnsubscribes = new Map();

const unsubscribeUnreadCount = (chatId) => {
    const unsubscribe = unreadCountUnsubscribes.get(chatId);
    if (typeof unsubscribe === 'function') {
        try {
            unsubscribe();
        } catch (e) {
            console.warn(`Failed to unsubscribe unread count for ${chatId}:`, e);
        }
    }
    unreadCountUnsubscribes.delete(chatId);
};

const clearUnreadCountSubscriptions = () => {
    unreadCountUnsubscribes.forEach((unsubscribeFn, chatId) => {
        if (typeof unsubscribeFn === 'function') {
            try {
                unsubscribeFn();
            } catch (e) {
                console.warn(`Failed to clear unread count subscription for ${chatId}:`, e);
            }
        }
    });
    unreadCountUnsubscribes.clear();
};

let activeGroupMembers = [];
let currentGroupName = "";
let currentIncomingRequests = {};
let currentOutgoingRequests = {};
let currentSentRequests = {};
let activeRequestFilter = 'all';
let currentChatListIds = {};
let isFirstChatLoad = true; // Flag to prevent notification sound on initial load
const chatLastInteractions = new Map();

let lastProcessedMessageDate = null;
let lastSenderId = null;
let longPressTimer;
let archivedContextMenuTargetId = null;
let activeContextMenuTargetId = null;
let contextMenuTargetId = null;
let reactionPickerTargetId = null;
let lastTouchPos = { x: 0, y: 0 };

let swipeReplyTarget = null;
// WebRTC State
let peerConnection = null; // Main connection reference for backwards compatibility
let peerConnections = new Map(); // targetUid -> RTCPeerConnection
let remoteCandidatesQueues = new Map(); // targetUid -> Array of candidates
let iceSubscribes = new Map(); // targetUid -> unsubscribe function
let callParticipants = new Set(); // Set of active participant UIDs (excluding local user)
let localStream = null;
let callUnsubscribe = null;
let iceUnsubscribe = null; // Legacy single listener
let remoteCandidatesQueue = []; // Legacy candidate queue
let currentRingAudio = null;
let callDurationInterval = null;
let callStartTime = null;
let currentCallPartnerUid = null;
let waitingCallSignal = null;
let waitingBeepInterval = null;
let callLoggingSession = null;
let isReconnecting = false;
let currentCallType = 'voice';
let isCameraMuted = false;
let isSpeakerOn = false;
let currentFacingMode = 'user';
let isFlashOn = false;
let isLocalCaller = false;
let reconnectTimeoutId = null;
let callTimeoutId = null;
let isSettingRemoteDescription = false;
let isScreenSharing = false;
let screenStream = null;
const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "2974b6941245db450ba446bb",
            credential: "hD1fMWEf8mcSAFPr",
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "2974b6941245db450ba446bb",
            credential: "hD1fMWEf8mcSAFPr",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "2974b6941245db450ba446bb",
            credential: "hD1fMWEf8mcSAFPr",
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "2974b6941245db450ba446bb",
            credential: "hD1fMWEf8mcSAFPr",
        },
    ]
};

let ringbackOsc1 = null;
let ringbackOsc2 = null;
let ringbackGain = null;
let ringbackCtx = null;
let ringbackIntervalId = null;

const playSwitchSound = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
        const audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const playTone = (frequency, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = audioCtx.currentTime;
        playTone(680, now, 0.12);
        playTone(850, now + 0.10, 0.16);
    } catch (e) {
        console.warn('Failed to play switch sound via Web Audio:', e);
    }
};

const playSynthesizedRingback = () => {
    stopSynthesizedRingback();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
        ringbackCtx = new AudioContext();

        // Ensure the context is running
        if (ringbackCtx.state === 'suspended') {
            ringbackCtx.resume();
        }

        // Create gain node to control volume
        ringbackGain = ringbackCtx.createGain();
        ringbackGain.connect(ringbackCtx.destination);
        ringbackGain.gain.setValueAtTime(0.0, ringbackCtx.currentTime);

        // Create the two oscillators for the US ringback tone (440Hz and 480Hz)
        ringbackOsc1 = ringbackCtx.createOscillator();
        ringbackOsc1.type = 'sine';
        ringbackOsc1.frequency.value = 440;
        ringbackOsc1.connect(ringbackGain);

        ringbackOsc2 = ringbackCtx.createOscillator();
        ringbackOsc2.type = 'sine';
        ringbackOsc2.frequency.value = 480;
        ringbackOsc2.connect(ringbackGain);

        ringbackOsc1.start();
        ringbackOsc2.start();

        // Loop pattern: 2 seconds on, 4 seconds off
        const playCycle = () => {
            if (!ringbackCtx || ringbackCtx.state === 'closed') return;
            if (ringbackCtx.state === 'suspended') {
                ringbackCtx.resume();
            }

            // Ring for 2 seconds
            ringbackGain.gain.setValueAtTime(0.15, ringbackCtx.currentTime);
            ringbackGain.gain.setValueAtTime(0.15, ringbackCtx.currentTime + 1.8);
            ringbackGain.gain.exponentialRampToValueAtTime(0.001, ringbackCtx.currentTime + 2.0);

            // Turn off gain
            ringbackGain.gain.setValueAtTime(0.0, ringbackCtx.currentTime + 2.0);
        };

        // Trigger first cycle immediately
        playCycle();

        // Repeat every 6 seconds (2s on + 4s off)
        ringbackIntervalId = setInterval(playCycle, 6000);
    } catch (e) {
        console.warn("Failed to initialize synthesized ringback:", e);
    }
};

const stopSynthesizedRingback = () => {
    if (ringbackIntervalId) {
        clearInterval(ringbackIntervalId);
        ringbackIntervalId = null;
    }
    if (ringbackOsc1) {
        try { ringbackOsc1.stop(); } catch (e) { }
        ringbackOsc1 = null;
    }
    if (ringbackOsc2) {
        try { ringbackOsc2.stop(); } catch (e) { }
        ringbackOsc2 = null;
    }
    if (ringbackCtx) {
        try { ringbackCtx.close(); } catch (e) { }
        ringbackCtx = null;
    }
    ringbackGain = null;
};

const playRingAudio = (type) => {
    stopRingAudio();
    if (type === 'outgoing') {
        playSynthesizedRingback();
    } else {
        // Incoming call: play melodic ringtone
        const url = getCallRingtoneUrl() || './ringtone.mp3';
        if (!url) return; // Silent setting
        let audioEl = document.getElementById('ringing-audio');
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'ringing-audio';
            document.body.appendChild(audioEl);
        }

        currentRingAudio = audioEl;
        currentRingAudio.src = url;
        currentRingAudio.loop = true;
        currentRingAudio.play().catch(() => console.warn("Ringing audio blocked. User interaction required."));
    }
};

const stopRingAudio = () => {
    stopSynthesizedRingback();
    const audioEl = document.getElementById('ringing-audio');
    if (audioEl) {
        audioEl.pause();
        audioEl.src = "";
    }
    currentRingAudio = null;
};

const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const startWaitingBeeps = () => {
    stopWaitingBeeps();
    // Looping beep sound and vibration to notify the user during an active call
    const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    waitingBeepInterval = setInterval(() => {
        if (notificationSoundsEnabled) {
            beep.play().catch(() => { });
            if (navigator.vibrate) navigator.vibrate([40, 100, 40]);
        }
    }, 4000); // Notify every 4 seconds
};

const stopWaitingBeeps = () => {
    if (waitingBeepInterval) {
        clearInterval(waitingBeepInterval);
        waitingBeepInterval = null;
    }
};

const SKIN_TONE_STORAGE_KEY = 'hotmapp_selected_skin_tone';
const SKIN_TONE_MODIFIERS = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
let currentSkinTone = localStorage.getItem(SKIN_TONE_STORAGE_KEY) || '';

/** Checks if an emoji character supports skin tone modifiers */
const supportsSkinTone = (emoji) => {
    return /\p{Emoji_Modifier_Base}/u.test(emoji);
};

const emojiCategories = {
    'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🧐', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😢', '😭', '😠', '😡', '🤯', '👍', '👎', '👏', '🙌', '👋', '🙏', '💪', '🧠', '👀', '🗣️', '👶', '👧', '👦', '👩', '👨', '🧑', '👵', '👴', '👱‍♀️', '👱‍♂️', '👮‍♀️', '👮‍♂️', '👷‍♀️', '👷‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🎓', '👨‍🎓', '👩‍🏫', '👨‍🏫', '👩‍⚖️', '👨‍⚖️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎤', '👨‍🎤', '👩‍🎨', '👨‍🎨', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '👩‍🚒', '👨‍🚒', '👸', '🤴', '👰', '🤵', '👼', '🤰', '🤱', '🦸‍♀️', '🦸‍♂️', '🦹‍♀️', '🦹‍♂️', '🧙‍♀️', '🧙‍♂️', '🧚‍♀️', '🧚‍♂️', '🧛‍♀️', '🧛‍♂️', '🧜‍♀️', '🧜‍♂️', '🧝‍♀️', '🧝‍♂️', '🧟‍♀️', '🧟‍♂️', '🧞‍♀️', '🧞‍♂️', '💃', '🕺', '👯‍♀️', '👯‍♂️', '🚶‍♀️', '🚶‍♂️', '🏃‍♀️', '🏃‍♂️', '🧍‍♀️', '🧍‍♂️', '🧎‍♀️', '🧎‍♂️', '🧑‍🤝‍🧑', '👫', '👬', '👭', '💏', '💑', '👪', '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👨‍👩‍👦‍👦', '👨‍👩‍👧‍👧', '👨‍👦', '👨‍👦‍👦', '👨‍👧', '👨‍👧‍👦', '👨‍👧‍👧', '👩‍👦', '👩‍👦‍👦', '👩‍👧', '👩‍👧‍👦', '👩‍👧‍👧', '🗣️', '👤', '👥'],
    'Animals & Nature': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️', '🦂', '🦟', '🦠', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦀', '🐠', '🐟', '🐡', '🐬', '🦈', '🐳', '🐊', '🐅', '🐆', '🦓', '🦍', '🐘', '🦏', '🐪', '🐫', '🦒', '🐃', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🕊️', '🐇', '🐁', '🐀', '🐿️', '🦔', '🐾', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍄', '🌸', '🌼', '🌻', '🌹', '🌷', '🌱', '🌺', '🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌚', '🌝', '🌞', '🌟', '✨', '💫', '☄️', '💥', '🔥', '💧', '🌊', '🌬️', '💨', '🌨️', '☔', '⚡', '🌈', '☁️', '☀️', '🌙', '⭐'],
    'Food & Drink': ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🥚', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄'],
    'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '制', '🛹', '🛼', '🛷', '⛸️', '🎿', '⛷️', '🏂', '🏋️‍♀️', '🏋️‍♂️', '🤺', '🤼‍♀️', '🤼‍♂️', '🤸‍♀️', '🤸‍♂️', '⛹️‍♀️', '⛹️‍♂️', '🤾‍♀️', '🤾‍♂️', '攀', '🧗‍♂️', '🚴‍♀️', '🚴‍♂️', '🚵‍♀️', '🚵‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎫', '🎟️', '🎪', '🎭', '🖼️', '🎨', '🧵', '🧶', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    'Travel & Places': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛵', '🚲', '🛴', '🛹', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🛎️', '🧳', '⌛', '⏳', '⌚', '⏰', '⏱️', '⏲️', '🕰️', '🌡️', '☀️', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄️', '🌬️', '💨', '🌪️', '🌫️', '🌊', '💧', '💦', '☔️'],
    'Objects': ['⌚️', '📱', '📲', '💻', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', 'DVD', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '🕰️', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪝', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🧼', '🪠', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
    'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '💡', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩️', '⏪️', '⏫️', '⏬️', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '👁‍🗨', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾️', '◽️', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️', '⬜️', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'],
    'Flags': ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇲🇫', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼']
};

const FREQUENT_EMOJIS_KEY = 'hotmapp_frequent_emojis';
const MAX_FREQUENT_EMOJIS = 24;

const updateFrequentEmojis = (emoji) => {
    let frequent = JSON.parse(localStorage.getItem(FREQUENT_EMOJIS_KEY) || '[]');
    frequent = frequent.filter(e => e !== emoji);
    frequent.unshift(emoji);
    if (frequent.length > MAX_FREQUENT_EMOJIS) frequent.pop();
    localStorage.setItem(FREQUENT_EMOJIS_KEY, JSON.stringify(frequent));
};

const emojiKeywords = {
    '😀': 'grinning happy smile joy', '😃': 'grinning happy smile eye', '😄': 'grinning happy smile eye', '😁': 'grinning happy smile eye beam', '😆': 'grinning happy smile squint', '😅': 'grinning happy smile sweat cold', '😂': 'joy tears laughing happy', '🤣': 'rofl laughing floor', '😊': 'blush happy smile', '😇': 'halo innocent angel', '🙂': 'slight smile', '🙃': 'upside down smile', '😉': 'wink smile', '😌': 'relieved smile', '😍': 'heart eyes love', '🥰': 'hearts love smiling', '😘': 'kiss love blowing', '😗': 'kissing face', '😙': 'kissing eye smile', '😚': 'kissing closed eye', '😋': 'savoring delicious food', '😛': 'tongue face', '😝': 'squint tongue', '😜': 'wink tongue', '🤪': 'zany crazy face', '🧐': 'monocle smart', '😎': 'sunglasses cool', '🤩': 'star struck', '🥳': 'partying face', '😏': 'smirk', '😒': 'unamused', '😞': 'disappointed', '😔': 'pensive', '😟': 'worried', '😢': 'cry tear', '😭': 'sob cry loud', '😠': 'angry mad', '😡': 'pout angry red', '🤯': 'explode mind head', '👍': 'thumbs up ok agree', '👎': 'thumbs down no disagree', '❤️': 'heart love red', '🔥': 'fire lit hot', '✨': 'sparkles star', '✅': 'check mark verified', '❌': 'cross mark wrong'
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Limit
const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const getDateString = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        // Fallback for latency compensation / serverTimestamp placeholder
        return 'Today';
    }
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Helper to check if an action/view is allowed under a given privacy setting.
 * privacy: 'anyone' | 'friends-only' | 'excluded' | 'nobody'
 */
const isAllowedByPrivacy = (privacy, isFriend, isExcluded) => {
    if (privacy === 'anyone') return true;
    if (privacy === 'friends-only') return isFriend;
    if (privacy === 'excluded') return isFriend && !isExcluded;
    return false; // 'nobody'
};

/**
 * Helper to check if a user is in an excluded contacts list (supports both array and object structures).
 */
const isUserExcluded = (list, uid) => {
    if (!list) return false;
    if (Array.isArray(list)) return list.includes(uid);
    return !!list[uid];
};

/**
 * Determines the correct avatar HTML based on user privacy settings.
 */
const getAvatarHtml = (profile, uid) => {
    if (profile.isGroup || (uid && uid.startsWith('group_'))) {
        if (profile.profilePhoto) {
            return `<img src="${profile.profilePhoto}" class="avatar-img" style="border-radius: 50%; object-fit: cover;">`;
        }
        return `<i class="fa-solid fa-users"></i>`;
    }
    const privacy = profile.profilePhotoPrivacy || 'anyone';
    const isFriend = !!moduleFriendsList[uid];
    const isMe = auth.currentUser && uid === auth.currentUser.uid;
    const initials = (profile.fullname || 'U').charAt(0).toUpperCase();

    const showPhoto = isMe || isAllowedByPrivacy(privacy, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid));

    return (showPhoto && profile.profilePhoto) ? `<img src="${profile.profilePhoto}" class="avatar-img">` : initials;
};

/** Formats a timestamp into a human-readable string */
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Populates and opens the Message Info modal */
const showMessageInfo = (msg) => {
    if (!elements.messageInfoModal || !elements.messageInfoContent) return;

    const modalTitle = elements.messageInfoModal.querySelector('h3');
    if (modalTitle) modalTitle.textContent = 'Message Info';

    const sentTime = formatTimestamp(msg.timestamp);
    const editedTime = msg.edited && msg.updatedAt ? formatTimestamp(msg.updatedAt) : null;
    const deletedTime = msg.deleted && msg.deletedAt ? formatTimestamp(msg.deletedAt) : null;

    let html = `
        <div class="message-info-item">
            <span class="message-info-label">Sent</span>
            <span class="message-info-value">${sentTime}</span>
        </div>
    `;

    if (editedTime) {
        html += `
            <div class="message-info-item">
                <span class="message-info-label">Edited</span>
                <span class="message-info-value">${editedTime}</span>
            </div>
        `;
    }

    if (deletedTime) {
        html += `<div class="message-info-item"><span class="message-info-label">Deleted</span><span class="message-info-value">${deletedTime}</span></div>`;
    }

    elements.messageInfoContent.innerHTML = html;
    elements.messageInfoModal.style.display = 'flex';
};

/** Populates and opens a read-only profile view in the message info modal */
const showUserProfileInfo = (uid, profile, showRequestActions = true, profileActionMode = null) => {
    if (!elements.messageInfoModal || !elements.messageInfoContent) return;

    const modalTitle = elements.messageInfoModal.querySelector('h3');
    if (modalTitle) modalTitle.textContent = 'User Profile';

    const initials = (profile.fullname || 'U').charAt(0).toUpperCase();
    const isFriend = !!moduleFriendsList[uid];
    const privacy = profile.profilePhotoPrivacy || 'anyone';
    const isMe = auth.currentUser && uid === auth.currentUser.uid;
    const showPhoto = isMe || isAllowedByPrivacy(privacy, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid));
    const avatarHtml = (showPhoto && profile.profilePhoto) ? `<img src="${profile.profilePhoto}" class="view-profile-photo" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin: 0 auto 15px; display:block; border:2px solid var(--brand); cursor:pointer;" title="Click to view full photo">` : `<div style="width:80px; height:80px; border-radius:50%; background:var(--brand); color:white; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; margin:0 auto 15px;">${initials}</div>`;

    const hasPendingRequest = !!(currentOutgoingRequests?.[uid] || currentSentRequests?.[uid]);
    const profileActionButton = profileActionMode === 'send-request'
        ? `<div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="customer-toggle-btn ${hasPendingRequest ? 'cancel-profile-request-btn' : 'send-profile-request-btn'}" data-uid="${uid}" style="flex: 1; background: ${hasPendingRequest ? '#ff4d4d' : 'var(--brand)'}; color: white;" ${hasPendingRequest ? '' : ''}>${hasPendingRequest ? 'Cancel Request' : 'Send Request'}</button>
            </div>`
        : '';

    let html = `
        ${avatarHtml}
        <div class="message-info-item">
            <span class="message-info-label">Name</span>
            <span class="message-info-value">${profile.fullname || 'Unknown'}</span>
        </div>
        <div class="message-info-item">
            <span class="message-info-label">Phone</span>
            <span class="message-info-value">${profile.phoneNumber || profile.email || 'Private'}</span>
        </div>
        <div class="message-info-item">
            <span class="message-info-label">Member Since</span>
            <span class="message-info-value">${profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
        </div>
    `;

    if (showRequestActions) {
        html += `
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="customer-toggle-btn accept-profile-req" data-uid="${uid}" style="flex: 1;">Accept</button>
                <button class="customer-toggle-btn decline-profile-req" data-uid="${uid}" style="flex: 1; background: #ff4d4d;">Decline</button>
            </div>
        `;
    } else if (moduleFriendsList[uid]) {
        html += `
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="customer-toggle-btn unfriend-btn" data-uid="${uid}" style="flex: 1; background: #ff4d4d;">Unfriend</button>
            </div>
        `;
    }

    if (profileActionButton) {
        html += profileActionButton;
    }

    elements.messageInfoContent.innerHTML = html;
    elements.messageInfoModal.style.display = 'flex';
};

/** Populates and opens the Call Details modal */
const showCallDetails = (msg) => {
    if (!elements.callDetailsModal || !elements.callDetailsContent) return;

    const endTime = msg.timestamp;
    const startTime = endTime - (msg.duration * 1000);

    const startTimeStr = formatTimestamp(startTime);
    const durationStr = msg.duration > 0 ? formatDuration(msg.duration) : 'N/A';
    const typeStr = msg.callType.charAt(0).toUpperCase() + msg.callType.slice(1);
    const statusStr = msg.callStatus.charAt(0).toUpperCase() + msg.callStatus.slice(1);

    const html = `
        <div class="message-info-item">
            <span class="message-info-label">Call Type</span>
            <span class="message-info-value">${typeStr}</span>
        </div>
        <div class="message-info-item">
            <span class="message-info-label">Status</span>
            <span class="message-info-value">${statusStr}</span>
        </div>
        <div class="message-info-item">
            <span class="message-info-label">Time</span>
            <span class="message-info-value">${startTimeStr}</span>
        </div>
        <div class="message-info-item" style="${msg.duration > 0 ? '' : 'display:none'}">
            <span class="message-info-label">Duration</span>
            <span class="message-info-value">${durationStr}</span>
        </div>
    `;

    elements.callDetailsContent.innerHTML = html;
    elements.callDetailsModal.style.display = 'flex';
};

/**
 * Archives the currently active chat.
 */
const handleArchiveChat = async () => {
    const user = auth.currentUser;
    if (!user || !activeChatUid) return;

    try {
        await updateChatArchiveStatus(user.uid, activeChatUid, true);
        showToast("Chat archived", "info");
        // Optionally, switch to another chat or hide the current chat area
        elements.chatArea.style.display = 'none';
        elements.chatsNav?.click(); // Go back to main chat list
    } catch (error) {
        console.error("Error archiving chat:", error);
        showToast("Failed to archive chat", "error");
    }
};

/**
 * Handles blocking or unblocking the current active chat partner.
 */
const handleBlockUser = async () => {
    const user = auth.currentUser;
    if (!user || !activeChatUid) return;

    const isBlocked = !!blockedUsers[activeChatUid];

    if (isBlocked) {
        if (confirm("Unblock this user? They will be able to message you again.")) {
            try {
                await toggleBlockUser(user.uid, activeChatUid, false);
                showToast("User unblocked", "info");
                refreshChatSidebars();
                updateCustomerSidebar();
            } catch (error) {
                showToast("Failed to update block status", "error");
            }
        }
    } else {
        if (elements.blockReasonModal) {
            elements.blockReasonModal.style.display = 'flex';
        } else if (confirm("Block this user? You will no longer receive messages or calls from them.")) {
            try {
                await toggleBlockUser(user.uid, activeChatUid, true);
                showToast("User blocked", "info");
                refreshChatSidebars();
                updateCustomerSidebar();
            } catch (error) {
                showToast("Failed to update block status", "error");
            }
        }
    }
};

/**
 * Unarchives a chat.
 */
const handleUnarchiveChat = async (otherUid) => {
    const user = auth.currentUser;
    if (!user || !otherUid) return;

    await updateChatArchiveStatus(user.uid, otherUid, false);
    showToast("Chat unarchived", "info");
};

const openArchivedChatContextMenu = (uid, x, y) => {
    archivedContextMenuTargetId = uid;
    const menu = elements.archivedChatContextMenu;
    if (!menu) return;

    menu.style.display = 'flex';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
};

const openActiveChatContextMenu = (uid, x, y) => {
    activeContextMenuTargetId = uid;
    const menu = elements.activeChatContextMenu;
    if (!menu) return;

    menu.style.display = 'flex';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
};

/**
 * Deletes an archived chat from the list.
 */
const handleDeleteArchivedChat = async (otherUid) => {
    const user = auth.currentUser;
    if (!user || !otherUid) return;

    if (confirm("Are you sure you want to delete this archived chat? This will remove it from your chat list.")) {
        try {
            await deleteChatFromList(user.uid, otherUid);
            showToast("Chat deleted", "info");
        } catch (error) {
            console.error("Error deleting archived chat:", error);
            showToast("Failed to delete chat", "error");
        }
    }
};

/**
 * Starts a client-side timer for an ephemeral message.
 * When the timer expires, the message is removed from the DOM.
 */
const startEphemeralTimer = (msgId, expiryTimestamp) => {
    stopEphemeralTimer(msgId); // Clear any existing timer for this message

    const messageEl = document.getElementById(msgId);
    if (!messageEl) return;

    const timerDisplay = messageEl.querySelector('.ephemeral-timer');
    if (!timerDisplay) return;

    const updateTimer = () => {
        const now = Date.now();
        const remaining = expiryTimestamp - now;

        if (remaining <= 0) {
            // Time's up, remove message from DOM
            messageEl.remove();
            delete ephemeralMessageTimers[msgId];
            // Optionally, remove from local 'messages' array and database
            const index = messages.findIndex(m => m.id === msgId);
            if (index !== -1) messages.splice(index, 1);
            // For a full ephemeral implementation, you'd also trigger a database deletion here.
            // For now, it's client-side only.
            return;
        }

        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let timeString = '';
        if (days > 0) timeString = `${days}d ${hours % 24}h`;
        else if (hours > 0) timeString = `${hours}h ${minutes % 60}m`;
        else if (minutes > 0) timeString = `${minutes}m ${seconds % 60}s`;
        else timeString = `${seconds}s`;

        timerDisplay.textContent = `Disappears in ${timeString}`;
    };

    // Update immediately and then every second
    updateTimer();
    ephemeralMessageTimers[msgId] = setInterval(updateTimer, 1000);
};

/**
 * Stops a specific ephemeral message timer.
 */
const stopEphemeralTimer = (msgId) => {
    if (ephemeralMessageTimers[msgId]) {
        clearInterval(ephemeralMessageTimers[msgId]);
        delete ephemeralMessageTimers[msgId];
    }
};

/**
 * Formats a duration in milliseconds into a human-readable string.
 */
const formatDurationHuman = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
};

/**
 * Renders reaction badges below a message bubble.
 */
const renderReactions = async (msg, messageGroupEl) => {
    const reactionsContainer = messageGroupEl.querySelector('.message-reactions-container');
    if (!reactionsContainer) return;

    reactionsContainer.innerHTML = '';

    if (!msg.reactions || Object.keys(msg.reactions).length === 0) return;

    const allUsers = await getAllUsers(); // Fetch all users once

    for (const emoji in msg.reactions) {
        const userIds = Object.keys(msg.reactions[emoji]);
        if (userIds.length === 0) continue;

        const badge = document.createElement('div');
        badge.className = 'reaction-badge';
        badge.innerHTML = `${emoji}<span>${userIds.length}</span>`;
        badge.dataset.emoji = emoji;
        badge.dataset.msgId = msg.id;

        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            showReactionDetails(msg.id, emoji, allUsers);
        });
        reactionsContainer.appendChild(badge);
    }
};

/**
 * Displays a modal showing who reacted with a specific emoji.
 */
const showReactionDetails = (msgId, emoji, allUsers) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.reactions || !msg.reactions[emoji] || !elements.reactionDetailModal || !elements.reactionDetailList) return;

    elements.reactionDetailModal.style.display = 'flex';
    elements.reactionDetailModal.querySelector('h3').textContent = `Reacted with ${emoji}`;
    elements.reactionDetailList.innerHTML = '';

    const userReactions = msg.reactions[emoji];
    const sortedUserIds = Object.keys(userReactions).sort((a, b) => userReactions[a] - userReactions[b]);

    sortedUserIds.forEach(uid => {
        const userProfile = allUsers[uid];
        const name = userProfile?.fullname || 'Unknown User';
        const avatar = getAvatarUrl(name, userProfile?.profilePhoto);
        const time = new Date(userReactions[uid]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = 'reaction-detail-item';
        item.innerHTML = `
            <img src="${avatar}" alt="${name}" class="avatar">
            <span class="name">${name}</span>
            <span class="time">${time}</span>
        `;
        elements.reactionDetailList.appendChild(item);
    });
};

/**
 * Toggles a user's reaction to a message.
 */
const toggleReaction = async (msgId, emoji) => {
    const user = auth.currentUser;
    if (!user || !activeChatUid || !msgId) return;

    const chatId = [user.uid, activeChatUid].sort().join('_');
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const updatedReactions = { ...msg.reactions };
    if (!updatedReactions[emoji]) {
        updatedReactions[emoji] = {};
    }

    if (updatedReactions[emoji][user.uid]) {
        // User already reacted with this emoji, so remove it
        delete updatedReactions[emoji][user.uid];
        if (Object.keys(updatedReactions[emoji]).length === 0) {
            delete updatedReactions[emoji]; // Remove emoji entry if no one reacted with it
        }
    } else {
        // Add user's reaction
        updatedReactions[emoji][user.uid] = Date.now();
    }

    await updateMessage(chatId, msgId, { reactions: updatedReactions });
};

/**
 * Generates a thumbnail for the first page of a PDF
 */
const generatePdfThumbnail = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.8);
    });
};

/**
 * Returns an icon based on file extension for document types
 */
const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
        'pdf': '📗',
        'doc': '📘', 'docx': '📘',
        'xls': '📗', 'xlsx': '📗',
        'ppt': '📙', 'pptx': '📙',
        'zip': '📦', 'rar': '📦', '7z': '📦',
        'txt': '📑'
    };
    return map[ext] || '📄';
};

/**
 * Formats file size into a human-readable string.
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const renderDateSeparator = (timestamp) => {
    const dateStr = getDateString(timestamp);
    if (dateStr !== lastProcessedMessageDate) {
        lastProcessedMessageDate = dateStr;
        return `<div class="date-separator">${dateStr}</div>`;
    }
    return '';
};

/**
 * Automatically scrolls to the first unread message or to the bottom of the chat.
 * Tries a few times in case elements are not yet in the DOM when called.
 */
const scrollToFirstUnread = (maxRetries = 3, retryDelay = 150) => {
    if (!elements.messagesContainer) return;

    let attempts = 0;

    const tryScroll = () => {
        attempts++;
        const targetEl = firstUnreadId ? document.getElementById(firstUnreadId) : null;
        if (targetEl) {
            try {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
                // fallback to manual scrollTop if scrollIntoView fails
                elements.messagesContainer.scrollTop = targetEl.offsetTop - (elements.messagesContainer.clientHeight / 2);
            }
            isInitialLoad = false;
            firstUnreadId = null;
            return;
        }

        if (attempts <= maxRetries) {
            // element may not be rendered yet; retry shortly
            setTimeout(tryScroll, retryDelay);
            return;
        }

        // Fallback: scroll to bottom if unread element never appears
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        isInitialLoad = false;
        firstUnreadId = null;
    };

    tryScroll();
};

/**
 * Renders skeleton bubbles in the message container
 */
const renderMessageSkeletons = () => {
    if (!elements.messagesContainer) return;
    const skeletonHtml = `
        <div class="message-skeleton" data-ui="message-skeleton">
            <div class="skeleton-bubble received"></div>
            <div class="skeleton-bubble sent"></div>
            <div class="skeleton-bubble received"></div>
            <div class="skeleton-bubble sent"></div>
        </div>
    `;
    elements.messagesContainer.innerHTML = skeletonHtml;
};

const removeMessageSkeleton = () => {
    const skeleton = elements.messagesContainer?.querySelector('[data-ui="message-skeleton"]');
    if (skeleton) skeleton.remove();
};

const hideLocationModal = () => {
    if (elements.locationModal) elements.locationModal.style.display = 'none';
};

const showReplyPreview = (msgId, text, senderName) => {
    replyingTo = { msgId, text, senderName };
    if (elements.replyPreviewText) elements.replyPreviewText.textContent = text;
    if (elements.replyPreview) elements.replyPreview.style.display = 'flex';
    if (elements.messageInput) elements.messageInput.focus();
};

const showEditPreview = (msgId, text) => {
    editingMessageId = msgId;
    hideReplyPreview();
    if (elements.editPreviewText) elements.editPreviewText.textContent = text;
    if (elements.editPreview) elements.editPreview.style.display = 'flex';
    if (elements.messageInput) {
        elements.messageInput.value = text;
        elements.messageInput.focus();
        elements.messageInput.dispatchEvent(new Event('input')); // Trigger auto-resize
    }
};

const populateForwardUserList = async () => {
    const [users, chatListIds] = await Promise.all([
        getAllUsers(),
        getChatList(auth.currentUser.uid)
    ]);

    const container = elements.forwardUserList;
    if (!container) return;

    container.innerHTML = '';
    // Render previews of messages being forwarded (if any)
    try {
        const previewContainer = document.querySelector('[data-ui="forward-preview"]');
        if (previewContainer) {
            if (pendingForwardData && pendingForwardData.length > 0) {
                previewContainer.style.display = 'block';
                previewContainer.innerHTML = pendingForwardData.map(item => {
                    const isEncrypted = item.isEncrypted;
                    const isPending = item.status === 'pending' || (item.id && item.id.startsWith && item.id.startsWith('pending_'));
                    const text = item.previewText || item.text || (item.type === 'image' ? '📷 Image' : (item.type === 'document' ? '📄 File' : `[${item.type}]`));
                    const lock = (isEncrypted && !item.isDecrypted) ? ' <span style="opacity:0.65; font-size:0.85em; margin-left:6px;">🔒</span>' : '';
                    const pendingIcon = isPending ? ' <span style="margin-left:6px; opacity:0.8; font-size:0.9em;">⏳</span>' : '';
                    return `<div class="forward-preview-item" style="padding:6px 0; border-bottom:1px dashed var(--border); font-size:0.92rem;">${text}${lock}${pendingIcon}</div>`;
                }).join('');
            } else {
                previewContainer.style.display = 'none';
                previewContainer.innerHTML = '';
            }
        }
    } catch (e) {
        console.warn('Failed to render forward preview:', e);
    }
    const currentUserId = auth.currentUser.uid;

    const recentUsers = [];
    const frequentUsers = [];
    const otherUsers = [];

    Object.entries(users).forEach(([uid, profile]) => {
        if (uid === currentUserId) return;

        // ONLY allow forwarding/sharing messages to contacts in the user's friend list (privacy constraint)
        const isContact = moduleFriendsList && !!moduleFriendsList[uid];
        if (!isContact) return;

        const userData = { uid, profile };
        const entry = chatListIds[uid];
        if (entry) {
            userData.lastInteraction = (typeof entry === 'object') ? (entry.lastInteraction || 0) : (typeof entry === 'number' ? entry : 0);
            userData.messageCount = (typeof entry === 'object') ? (entry.messageCount || 0) : 0;
            recentUsers.push(userData);
            if (userData.messageCount > 0) frequentUsers.push(userData);
        } else {
            otherUsers.push(userData);
        }
    });

    const renderItems = (list, title) => {
        if (list.length === 0) return;
        container.insertAdjacentHTML('beforeend', `<div class="forward-section-header">${title}</div>`);
        list.forEach(({ uid, profile }) => {
            const name = profile.fullname || 'User';
            const initials = name.charAt(0).toUpperCase();
            const avatarHtml = profile.profilePhoto ? `<img src="${profile.profilePhoto}" class="avatar-img">` : initials;

            const html = `
            <div class="conversation-item" data-uid="${uid}" data-ui="conversation-item">
                <div class="conversation-avatar">${avatarHtml}</div>
                <div class="conversation-info">
                    <div class="conversation-name" data-name="${name}">${name}</div>
                </div>
            </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
    };

    frequentUsers.sort((a, b) => b.messageCount - a.messageCount);
    renderItems(frequentUsers.slice(0, 5), "Frequently Contacted");

    recentUsers.sort((a, b) => b.lastInteraction - a.lastInteraction);
    renderItems(recentUsers, "Recent Chats");
    renderItems(otherUsers, "All Contacts");
};

const handleMassForward = async () => {
    if (selectedMessages.size === 0) return;

    // Capture the actual message data immediately to prevent data loss if the chat context changes
    pendingForwardData = Array.from(selectedMessages).map(id => {
        const msg = messages.find(m => m.id === id);
        if (!msg) return null;
        // Strip metadata that shouldn't be cloned to a new room
        const { id: _, timestamp: __, status: ___, isStarred: ____, starredAt: _____, ...cleanData } = msg;
        return cleanData;
    }).filter(m => !!m);

    if (pendingForwardData.length === 0) return;

    await populateForwardUserList();

    if (elements.forwardModal) elements.forwardModal.style.display = 'flex';
    if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';

    selectedForwardRecipients.clear();
    updateForwardButton();
};

const toggleSelectMode = (active, options = {}) => {
    const { updateHistory = true, clearSelection = true } = options;
    isSelectMode = active;
    if (clearSelection) selectedMessages.clear();
    elements.chatArea?.classList.toggle('select-mode', active);
    if (elements.selectionBar) elements.selectionBar.classList.toggle('active', active);

    if (active && updateHistory) {
        pushHistoryState('message-selection', () => {
            toggleSelectMode(false, { updateHistory: false });
        });
    } else if (!active && updateHistory) {
        dismissHistoryState('message-selection');
    }

    updateSelectionUI();
};

const executeForward = async (targetUid, messagesToForward) => {
    const currentUser = auth.currentUser;
    const chatId = targetUid.startsWith('group_') ? targetUid : [currentUser.uid, targetUid].sort().join('_');

    let targetProfile = null;
    if (!targetUid.startsWith('group_')) {
        targetProfile = allUsersCache[targetUid] || await getUserProfile(targetUid);
    }
    const isTargetE2EE = targetProfile && targetProfile.publicKey;
    let sharedKey = null;
    if (isTargetE2EE) {
        sharedKey = await getOrDeriveSharedKey(currentUser.uid, targetProfile.publicKey);
    }

    const forwardPromises = messagesToForward.map(async (data) => {
        let messageData = {
            ...data,
            senderId: currentUser.uid,
            chatId: chatId,
            forwarded: true
        };
        delete messageData.id;
        delete messageData.timestamp;
        delete messageData.status;

        if (isTargetE2EE && sharedKey) {
            const payload = {
                text: messageData.text || ''
            };
            if (messageData.url) payload.url = messageData.url;
            if (messageData.fileName) payload.fileName = messageData.fileName;
            if (messageData.fileSize) payload.fileSize = messageData.fileSize;
            if (messageData.thumbnailUrl) payload.thumbnailUrl = messageData.thumbnailUrl;
            if (messageData.latitude !== undefined) payload.latitude = messageData.latitude;
            if (messageData.longitude !== undefined) payload.longitude = messageData.longitude;
            if (messageData.address) payload.address = messageData.address;
            if (messageData.staticMapUrl) payload.staticMapUrl = messageData.staticMapUrl;
            if (messageData.mapUrl) payload.mapUrl = messageData.mapUrl;
            if (messageData.replyTo) payload.replyTo = messageData.replyTo;

            const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
            messageData.text = encrypted.ciphertext;
            messageData.isEncrypted = true;
            messageData.iv = encrypted.iv;

            messageData.url = null;
            messageData.fileName = null;
            messageData.fileSize = null;
            messageData.thumbnailUrl = null;
            delete messageData.latitude;
            delete messageData.longitude;
            messageData.address = null;
            messageData.staticMapUrl = null;
            messageData.mapUrl = null;
            messageData.replyTo = null;
        } else {
            messageData.isEncrypted = null;
            messageData.iv = null;
        }

        return saveMessage(chatId, messageData);
    });

    await Promise.all(forwardPromises);
};

const updateForwardButton = () => {
    const btn = elements.confirmForwardBtn;
    if (!btn) return;
    const count = selectedForwardRecipients.size;
    btn.disabled = count === 0;
    btn.textContent = count > 0 ? `Send to ${count}` : 'Send';
};

const updateSelectionUI = () => {
    try {
        if (elements.selectionCount) elements.selectionCount.textContent = selectedMessages.size;

        // Toggle 'Message Info' in the header ellipsis menu: only visible if exactly 1 message is selected
        const infoBtn = elements.selectionEllipsisMenu?.querySelector('[data-action="selection-info"]');
        if (infoBtn) infoBtn.style.display = selectedMessages.size === 1 ? 'flex' : 'none';

        if (elements.massPinBtn) {
            elements.massPinBtn.style.display = 'none';
        }

        const selectionEditItem = elements.selectionEllipsisMenu?.querySelector('[data-action="selection-edit"]');
        if (selectionEditItem) {
            if (selectedMessages.size === 1) {
                const msgId = Array.from(selectedMessages)[0];
                const msg = messages.find(m => m.id === msgId);
                const currentUser = auth.currentUser;
                const showEdit = Boolean(currentUser && msg && !msg.deleted && isEditableTextMessage(msg, currentUser.uid));
                selectionEditItem.style.display = showEdit ? 'flex' : 'none';
            } else {
                selectionEditItem.style.display = 'none';
            }
        }

        const selectionPinItem = elements.selectionEllipsisMenu?.querySelector('[data-action="selection-pin"]');
        if (selectionPinItem) {
            if (selectedMessages.size === 1) {
                selectionPinItem.style.display = 'flex';
                const msgId = Array.from(selectedMessages)[0];
                const isPinned = pinnedMessageData && pinnedMessageData.msgId === msgId;
                selectionPinItem.innerHTML = isPinned ? '<i class="fa-solid fa-thumbtack-slash"></i> Unpin Message' : '<i class="fa-solid fa-thumbtack"></i> Pin Message';
            } else {
                selectionPinItem.style.display = 'none';
            }
        }

        if (elements.massReplyBtn) {
            elements.massReplyBtn.style.display = selectedMessages.size === 1 ? 'inline-flex' : 'none';
        }

        if (elements.selectionEditImageBtn || elements.selectionSignDocumentBtn) {
            let showEditImage = false;
            let showSignDoc = false;
            if (selectedMessages.size === 1) {
                const msgId = Array.from(selectedMessages)[0];
                const msg = messages.find(m => m.id === msgId);
                if (msg && !msg.deleted) {
                    showEditImage = msg.type === 'image';
                    showSignDoc = msg.type === 'document' && msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf');
                }
            }
            if (elements.selectionEditImageBtn) elements.selectionEditImageBtn.style.display = 'none';
            if (elements.selectionSignDocumentBtn) elements.selectionSignDocumentBtn.style.display = 'none';

            const selectionEditImageItem = elements.selectionEllipsisMenu?.querySelector('[data-action="selection-edit-image"]');
            const selectionSignDocItem = elements.selectionEllipsisMenu?.querySelector('[data-action="selection-sign-document"]');
            if (selectionEditImageItem) selectionEditImageItem.style.display = showEditImage ? 'flex' : 'none';
            if (selectionSignDocItem) selectionSignDocItem.style.display = showSignDoc ? 'flex' : 'none';
        }

        document.querySelectorAll('.message-group').forEach(el => {
            el.classList.toggle('selected', selectedMessages.has(el.id));
        });
    } catch (err) {
        console.error("updateSelectionUI error:", err);
        showToast("Selection UI Error: " + err.message, "error");
    }
};

const handlePinMessage = async (msgId) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !activeChatUid) return;
    const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
    await pinMessage(chatId, msgId, msg);
    showToast("Message pinned", "success");
};

const handleUnpinMessage = async () => {
    if (!activeChatUid) return;
    const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
    await unpinMessage(chatId);
    showToast("Message unpinned", "info");
};

const translateText = async (text, targetLang = 'en') => {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
        if (!response.ok) throw new Error("Translation failed");
        const data = await response.json();
        if (data && data[0]) {
            return data[0].map(segment => segment[0]).join('');
        }
        throw new Error("Translation failed");
    } catch (e) {
        console.error("Error during translation:", e);
        throw e;
    }
};

const isLanguagePackDownloaded = (langCode) => {
    if (langCode === 'en') return true;
    try {
        const downloaded = JSON.parse(localStorage.getItem('downloadedLanguagePacks') || '[]');
        return downloaded.includes(langCode);
    } catch (e) {
        return false;
    }
};

const downloadLanguagePack = (langCode, langName) => {
    return new Promise((resolve) => {
        const progressContainer = elements.translationPackProgressContainer;
        const progressBar = elements.translationPackProgressBar;
        const percentLabel = elements.translationPackPercent;
        const langLabel = elements.translationPackProgressLangName;

        if (langLabel) langLabel.textContent = langName;
        if (progressContainer) progressContainer.style.display = 'block';
        if (elements.translationPackPrompt) elements.translationPackPrompt.style.display = 'none';
        if (elements.copyTranslationBtn) elements.copyTranslationBtn.style.display = 'none';

        let percent = 0;
        const interval = setInterval(() => {
            percent += 5;
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (percentLabel) percentLabel.textContent = `${percent}%`;

            if (percent >= 100) {
                clearInterval(interval);
                try {
                    const downloaded = JSON.parse(localStorage.getItem('downloadedLanguagePacks') || '[]');
                    if (!downloaded.includes(langCode)) {
                        downloaded.push(langCode);
                        localStorage.setItem('downloadedLanguagePacks', JSON.stringify(downloaded));
                    }
                } catch (e) {
                    console.error("Failed to save downloaded pack:", e);
                }
                setTimeout(() => {
                    if (progressContainer) progressContainer.style.display = 'none';
                    resolve();
                }, 300);
            }
        }, 100);
    });
};

let currentTranslationText = "";
let translationSelectedMessages = [];

const handleSelectionCopy = async () => {
    const selectedMsgs = Array.from(selectedMessages)
        .map(id => messages.find(m => m.id === id))
        .filter(m => m && m.text && !m.deleted)
        .sort((a, b) => a.id.localeCompare(b.id));

    if (selectedMsgs.length === 0) {
        showToast("No copyable text in selection", "warning");
        return;
    }

    const combinedText = selectedMsgs.map(m => m.text).join('\n');
    try {
        await navigator.clipboard.writeText(combinedText);
        showToast(selectedMsgs.length > 1 ? "Messages copied to clipboard" : "Message copied to clipboard", "success");
    } catch (err) {
        showToast("Failed to copy messages", "error");
    }
};

const handleSelectionTranslate = () => {
    const selectedMsgs = Array.from(selectedMessages)
        .map(id => messages.find(m => m.id === id))
        .filter(m => m && m.text && !m.deleted)
        .sort((a, b) => a.id.localeCompare(b.id));

    if (selectedMsgs.length === 0) {
        showToast("No translatable text in selection", "warning");
        return;
    }

    const modal = elements.translationModal;
    if (!modal) return;

    modal.style.display = 'flex';

    const dropdown = elements.translationTargetLang;
    if (dropdown && dropdown.options.length === 0) {
        dropdown.innerHTML = languageList.map(lang => `<option value="${lang.code}">${lang.name}</option>`).join('');
    }

    if (dropdown) dropdown.value = currentLanguage;

    translationSelectedMessages = selectedMsgs;
    performTranslation(selectedMsgs);
};

const performTranslation = async (msgs) => {
    const loading = elements.translationLoading;
    const results = elements.translationResults;
    const copyBtn = elements.copyTranslationBtn;
    const targetLang = elements.translationTargetLang?.value || 'en';

    if (elements.translationPackPrompt) elements.translationPackPrompt.style.display = 'none';
    if (elements.translationPackProgressContainer) elements.translationPackProgressContainer.style.display = 'none';

    const isDownloaded = isLanguagePackDownloaded(targetLang);
    if (!isDownloaded) {
        if (loading) loading.style.display = 'none';
        if (results) results.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';

        const langObj = languageList.find(l => l.code === targetLang) || { name: targetLang };
        if (elements.translationPackLangName) elements.translationPackLangName.textContent = langObj.name;
        if (elements.translationPackPrompt) elements.translationPackPrompt.style.display = 'block';
        return;
    }

    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';
    if (copyBtn) {
        copyBtn.disabled = true;
        copyBtn.style.display = 'block';
    }

    try {
        const translatedTexts = [];
        for (const msg of msgs) {
            const translated = await translateText(msg.text, targetLang);
            translatedTexts.push(translated);
        }

        currentTranslationText = translatedTexts.join('\n');

        if (results) {
            results.innerHTML = msgs.map((msg, index) => {
                const senderProfile = allUsersCache[msg.senderId];
                const senderName = senderProfile ? senderProfile.fullname : (msg.senderId === auth.currentUser.uid ? 'You' : 'Contact');
                return `
                    <div style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                        <strong style="color: var(--brand-dark); font-size: 0.8rem; display: block; margin-bottom: 2px;">${senderName}</strong>
                        <div style="color: var(--muted); font-size: 0.82rem; margin-bottom: 4px; font-style: italic;">Original: ${msg.text}</div>
                        <div style="font-weight: 500;">${translatedTexts[index]}</div>
                    </div>
                `;
            }).join('');
            results.style.display = 'block';
        }
        if (copyBtn) copyBtn.disabled = false;
    } catch (e) {
        showToast("Translation failed. Please try again.", "error");
        if (results) {
            results.innerHTML = `<div style="color: #ff4d4d; text-align: center;">Failed to translate.</div>`;
            results.style.display = 'block';
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
};

const handleMassDelete = () => {
    if (selectedMessages.size === 0 || !activeChatUid) return;
    const DELETE_FOR_EVERYONE_LIMIT = 48 * 60 * 60 * 1000; // 48 hours in ms

    const user = auth.currentUser;
    const now = Date.now();
    const selectedMsgsData = Array.from(selectedMessages).map(id => messages.find(m => m.id === id)).filter(m => !!m);

    const hasActiveMessages = selectedMsgsData.some(m => !m.deleted);
    const allMine = selectedMsgsData.length > 0 && selectedMsgsData.every(m => m.senderId === user.uid);
    const allWithinTime = selectedMsgsData.every(m => (now - m.timestamp) < DELETE_FOR_EVERYONE_LIMIT);

    // Only allow "Delete for everyone" if there are active (non-deleted) messages
    const isAllowed = hasActiveMessages && allMine && allWithinTime;

    if (elements.deleteEveryoneBtn) {
        elements.deleteEveryoneBtn.dataset.allowed = isAllowed;
        elements.deleteEveryoneBtn.style.color = isAllowed ? '#008069' : 'var(--muted)';
        elements.deleteEveryoneBtn.style.opacity = isAllowed ? '1' : '0.8';
        // Hide "Delete for everyone" if all selected messages are already deleted
        elements.deleteEveryoneBtn.style.display = hasActiveMessages ? 'flex' : 'none';
    }
    if (elements.deleteTimeLimitMsg) {
        elements.deleteTimeLimitMsg.style.display = (hasActiveMessages && allMine && !allWithinTime) ? 'block' : 'none';
    }
    if (elements.deleteConfirmationModal) {
        elements.deleteConfirmationModal.style.display = 'flex';
    }
};

const closeDeleteModal = () => {
    const modal = elements.deleteConfirmationModal;
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 300);
};

const handleClearChat = async () => {
    if (!activeChatUid || messages.length === 0) return;

    if (confirm("Are you sure you want to clear all messages in this chat? This cannot be undone.")) {
        const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
        const messageIds = messages.map(m => m.id);

        try {
            await deleteMessagesBatch(chatId, messageIds);
            messages.length = 0;
            if (elements.messagesContainer) elements.messagesContainer.innerHTML = '';
            showToast("Chat cleared", "info");
        } catch (error) {
            console.error("Clear Chat Error:", error);
            showToast("Failed to clear chat", "error");
        }
    }
};

const toggleChatSearch = (show) => {
    if (show) {
        if (elements.chatHeaderInfo) elements.chatHeaderInfo.style.display = 'none';
        if (elements.chatActions) elements.chatActions.style.display = 'none';
        if (elements.chatSearchBar) elements.chatSearchBar.style.display = 'flex';
        if (elements.chatSearchInput) elements.chatSearchInput.focus();
    } else {
        if (elements.chatHeaderInfo) elements.chatHeaderInfo.style.display = 'flex';
        if (elements.chatActions) elements.chatActions.style.display = 'flex';
        if (elements.chatSearchBar) elements.chatSearchBar.style.display = 'none';
        if (elements.chatSearchInput) elements.chatSearchInput.value = '';
        if (elements.clearChatSearchBtn) elements.clearChatSearchBtn.style.display = 'none';
        searchResults = [];
        currentSearchIndex = -1;
        filterChatMessages('');
    }
};

const updateSearchUI = () => {
    if (elements.searchResultsCount) {
        const total = searchResults.length;
        const current = total > 0 ? currentSearchIndex + 1 : 0;
        elements.searchResultsCount.textContent = `${current}/${total}`;
    }

    // Remove previous active highlight
    document.querySelectorAll('.message-bubble.active-match').forEach(el => el.classList.remove('active-match'));

    if (searchResults.length > 0 && currentSearchIndex >= 0) {
        const activeGroup = searchResults[currentSearchIndex];
        const bubble = activeGroup.querySelector('.message-bubble');
        if (bubble) {
            bubble.classList.add('active-match');
            activeGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

const filterChatMessages = (query) => {
    const term = query.toLowerCase().trim();
    const groups = document.querySelectorAll('.message-group');
    const separators = document.querySelectorAll('.date-separator, .unread-divider');

    separators.forEach(s => s.style.display = term ? 'none' : '');

    searchResults = [];
    groups.forEach(group => {
        const textEl = group.querySelector('.message-text');
        if (!textEl) {
            group.style.display = term ? 'none' : 'flex';
            return;
        }

        const msg = messages.find(m => m.id === group.id);
        const plainText = textEl.textContent || '';
        const isMatch = !term || plainText.toLowerCase().includes(term);
        group.style.display = isMatch ? 'flex' : 'none';

        if (isMatch && term) {
            searchResults.push(group);
            let baseText = "";
            let prefixHtml = "";
            let suffixHtml = "";

            if (msg?.deleted) {
                baseText = "This message was deleted";
                prefixHtml = '<i class="fa-solid fa-ban" style="margin-right: 5px; opacity: 0.5;"></i> ';
            } else if (msg?.type === 'text') {
                baseText = normalizeMessageText(msg.text);
                if (msg.edited) suffixHtml = ' <small style="opacity:0.5; font-size:0.7rem; font-style:italic;">(edited)</small>';
            }

            if (baseText) {
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const highlighted = baseText.replace(regex, '<mark class="search-highlight">$1</mark>');
                textEl.innerHTML = prefixHtml + highlighted + suffixHtml;
            }
        } else if (!term) {
            if (msg?.deleted) {
                textEl.innerHTML = `<i class="fa-solid fa-ban" style="margin-right: 5px; opacity: 0.5;"></i> This message was deleted`;
            } else if (msg?.type === 'text') {
                textEl.innerHTML = `${escapeHtml(normalizeMessageText(msg.text))}${msg.edited ? ' <small style="opacity:0.5; font-size:0.7rem; font-style:italic;">(edited)</small>' : ''}`;
            }
        }
    });

    // Start at the most recent result (bottom of history)
    currentSearchIndex = searchResults.length > 0 ? searchResults.length - 1 : -1;
    updateSearchUI();
};

const handleMassStar = async () => {
    if (selectedMessages.size === 0) return;
    const messagesToStar = Array.from(selectedMessages).map(id => {
        const group = document.getElementById(id);
        return {
            id: id,
            data: messages.find(m => m.id === id) || { text: group.querySelector('.message-bubble').innerText, type: 'sent' }
        };
    });

    await starMessagesBatch(auth.currentUser.uid, messagesToStar);
    showToast(`${selectedMessages.size} messages starred`, "success");
    toggleSelectMode(false);
};

const hideReplyPreview = () => {
    replyingTo = null;
    if (elements.replyPreview) elements.replyPreview.style.display = 'none';
};

const sendMedia = async (type, fileOrBlob, fileName = null) => {
    const user = auth.currentUser;
    if (!user || !activeChatUid || !fileOrBlob || !elements.chatArea) return;

    if (fileOrBlob.size > MAX_FILE_SIZE) {
        showToast(`File too large! Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`, "error");
        return;
    }

    const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    const preGeneratedId = push(messagesRef).key;
    const clientTimestamp = Date.now();

    let uploadTarget = fileOrBlob;

    // 1. Compress if it's an image
    if (type === 'image') {
        try {
            uploadTarget = await compressImage(fileOrBlob);
        } catch (e) {
            console.warn("Compression failed, using original", e);
        }
    }

    // Get video duration
    let videoDuration = null;
    if (type === 'video') {
        try {
            videoDuration = await new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); resolve(video.duration); };
                video.onerror = () => { reject("Error loading video metadata."); };
                video.src = URL.createObjectURL(uploadTarget);
            });
        } catch (e) { console.warn("Could not get video duration", e); }
    }

    const previewUrl = type === 'image' ? URL.createObjectURL(uploadTarget) : null;
    const displayName = fileName || (type.charAt(0).toUpperCase() + type.slice(1));
    const fileIcon = type === 'document' ? getFileIcon(fileName) : (type === 'audio' ? '🎵' : (type === 'video' ? '🎬' : ''));

    // Create upload progress UI (floating) and an optimistic message placeholder
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress-container';
    progressContainer.innerHTML = `
        ${previewUrl ? `<img src="${previewUrl}" class="upload-preview-img">` : ''}
        ${fileIcon ? `<div class="upload-file-icon">${fileIcon}</div>` : ''}
        <div class="progress-text" title="${displayName}">Preparing: ${displayName}</div>
        <div class="progress-bar"><div class="progress-bar-fill"></div></div>
        <button class="upload-cancel-btn">Cancel Upload</button>
    `;
    elements.chatArea.appendChild(progressContainer);

    // Prepare reply/thumbnail variables before creating optimistic UI
    const replyData = replyingTo ? { ...replyingTo } : null;
    let thumbnailUrl = null;

    // Optimistic UI: create a local placeholder message so media appears immediately
    const placeholderMessage = {
        id: preGeneratedId,
        senderId: user.uid,
        chatId: chatId,
        type: type,
        url: previewUrl || null,
        thumbnailUrl: (type === 'image' ? previewUrl : thumbnailUrl) || null,
        fileName: fileName || displayName,
        timestamp: clientTimestamp,
        status: 'sending',
        fileSize: fileOrBlob.size,
        isEncrypted: null,
        previewText: type === 'image' ? '📷 Image' : (type === 'video' ? '🎥 Video' : (type === 'audio' ? '🎵 Audio' : `📄 ${fileName || 'Document'}`))
    };

    // Immediately render the placeholder in the messages container
    try {
        displayMessage(placeholderMessage, false);
        // Insert a small progress bar inside the message bubble so it's visible inline
        const inserted = document.getElementById(preGeneratedId);
        if (inserted) {
            const bubble = inserted.querySelector('.message-bubble');
            if (bubble) {
                const inlineProgress = document.createElement('div');
                inlineProgress.className = 'message-upload-inline-progress';
                inlineProgress.innerHTML = `<div class="inline-progress-fill" style="width:0%"></div>`;
                bubble.appendChild(inlineProgress);
            }
        }
    } catch (e) {
        console.warn('Could not render optimistic placeholder message', e);
    }


    if (type === 'document' && fileName?.toLowerCase().endsWith('.pdf')) {
        try {
            const thumbBlob = await generatePdfThumbnail(fileOrBlob);
            const thumbPath = `chat_media/${chatId}/thumb_${Date.now()}.jpg`;
            thumbnailUrl = await uploadFile(thumbPath, thumbBlob);
        } catch (e) {
            console.warn("Could not generate PDF thumbnail", e);
        }
    }

    try {
        // 1. Upload to Firebase Storage first
        const extension = fileName ? fileName.split('.').pop() : (type === 'image' ? 'jpg' : 'bin');
        const storagePath = `chat_media/${chatId}/${Date.now()}_${user.uid}.${extension}`;

        const uploadTask = uploadFile(storagePath, uploadTarget, (progress) => {
            const fill = progressContainer.querySelector('.progress-bar-fill');
            const text = progressContainer.querySelector('.progress-text');
            if (fill) fill.style.width = `${progress}%`;
            if (text) text.textContent = `${displayName} (${Math.round(progress)}%)`;

            // Update inline progress inside the optimistic message bubble
            try {
                const msgEl = document.getElementById(preGeneratedId);
                if (msgEl) {
                    const inlineFill = msgEl.querySelector('.inline-progress-fill');
                    if (inlineFill) inlineFill.style.width = `${progress}%`;
                }
            } catch (e) { /* ignore DOM timing issues */ }
        });

        const cancelBtn = progressContainer.querySelector('.upload-cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => uploadTask.cancel();

        const downloadURL = await uploadTask;

        // Update optimistic placeholder immediately with the real URL so sender sees media
        try {
            const updatedLocal = {
                id: preGeneratedId,
                senderId: user.uid,
                chatId: chatId,
                type: type,
                url: downloadURL,
                thumbnailUrl: thumbnailUrl || (type === 'image' ? downloadURL : null),
                fileName: fileName || `media_${Date.now()}`,
                timestamp: clientTimestamp,
                status: 'sending',
                fileSize: fileOrBlob.size
            };
            displayMessage(updatedLocal, false);
        } catch (e) { console.warn('Failed to update placeholder with URL', e); }

        // 2. Save the metadata and downloadURL to Realtime Database
        const messageData = {
            senderId: user.uid,
            chatId: chatId,
            type: type,
            url: downloadURL,
            fileName: fileName || `media_${Date.now()}`,
            timestamp: clientTimestamp,
            thumbnailUrl: thumbnailUrl,
            replyTo: replyData,
            fileSize: fileOrBlob.size // Add file size for document previews
        };
        if (videoDuration) messageData.duration = videoDuration;

        let otherProfile = null;
        if (!activeChatUid.startsWith('group_')) {
            otherProfile = allUsersCache[activeChatUid] || await getUserProfile(activeChatUid);
        }
        if (otherProfile && otherProfile.publicKey) {
            const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
            if (sharedKey) {
                const payload = {
                    text: type === 'image' ? '📷 Image' : (type === 'video' ? '🎥 Video' : (type === 'audio' ? '🎵 Audio' : `📄 ${fileName || 'Document'}`)),
                    url: downloadURL,
                    fileName: messageData.fileName,
                    fileSize: messageData.fileSize,
                    thumbnailUrl: thumbnailUrl,
                    replyTo: replyData,
                    duration: videoDuration
                };
                const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                messageData.text = encrypted.ciphertext;
                messageData.isEncrypted = true;
                messageData.iv = encrypted.iv;

                messageData.url = null;
                messageData.fileName = null;
                messageData.fileSize = null;
                messageData.thumbnailUrl = null;
                messageData.replyTo = null;
                delete messageData.duration;
            }
        }

        await saveMessage(chatId, messageData, preGeneratedId);
        hideReplyPreview();
    } catch (error) {
        if (error && error.code === 'storage/canceled') {
            showToast("Upload canceled", "info");
        } else {
            console.error("Media Upload Error:", error);
            showToast("Failed to upload media. Please try again.", "error");
        }
        // Mark optimistic message as failed so user sees a retry state
        try {
            displayMessage({ id: preGeneratedId, senderId: user.uid, status: 'failed' }, false);
            const msgEl = document.getElementById(preGeneratedId);
            if (msgEl) msgEl.classList.add('message-send-failed');
        } catch (e) { /* ignore updates */ }
    } finally {
        if (progressContainer) progressContainer.remove();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }

    // The UI will be updated automatically via the Firebase listener
    if (elements.messagesContainer) elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
};

// Initialize Voice Recording logic
// Initialize Voice Recording logic
const initVoiceRecording = () => {
    let lastBlob = null;
    let isRecordingActive = false;
    let isLocked = false;
    let isStoppedForPreview = false;
    let startX = 0;
    let startY = 0;
    let lockThreshold = -60; // drag up 60px to lock
    let cancelThreshold = -80; // drag left 80px to cancel
    let secondsElapsed = 0;
    let previewAudio = null;

    const startRecording = async (e) => {
        if (isRecordingActive) return;

        try {
            // Prevent default touch/click behaviors to avoid text selection or scrolling
            if (e && e.cancelable) e.preventDefault();

            // Set coordinates for gesture tracking
            const pageX = e.touches ? e.touches[0].pageX : e.clientX;
            const pageY = e.touches ? e.touches[0].pageY : e.clientY;
            startX = pageX;
            startY = pageY;
            isLocked = false;
            isStoppedForPreview = false;

            if (elements.previewPlayBtn) {
                elements.previewPlayBtn.innerHTML = '<i class="fa-solid fa-stop" style="color: #e53935;"></i>';
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                lastBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                audioUrl = URL.createObjectURL(lastBlob);

                // If it was cancelled, discard the blob
                if (isCancelled) {
                    lastBlob = null;
                    audioUrl = null;
                    return;
                }

                // If it was locked, show preview/locked UI
                if (isLocked) {
                    isStoppedForPreview = true;
                    if (elements.previewPlayBtn) {
                        elements.previewPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    }
                } else {
                    // Regular hold-release: send immediately!
                    sendVoiceNote();
                }
            };

            let isCancelled = false;
            window.isRecordingCancelled = () => isCancelled = true;

            mediaRecorder.start();
            isRecordingActive = true;

            // Add UI classes
            elements.recordBtn.classList.add('recording');
            elements.inputPill?.classList.add('recording-active');
            elements.lockIndicatorContainer?.classList.add('visible');

            // Reset indicators
            if (elements.lockIndicatorContainer) {
                elements.lockIndicatorContainer.style.transform = 'translateY(0)';
                elements.lockIndicatorContainer.style.opacity = '1';
                elements.lockIndicatorContainer.querySelector('span').textContent = 'Swipe up to lock';
                elements.lockIndicatorContainer.querySelector('i').className = 'fa-solid fa-lock';
            }

            startTimer();

            // Bind move and end listeners to track swipe up/left gestures
            if (e.type === 'touchstart') {
                window.addEventListener('touchmove', handleRecordingDrag, { passive: false });
                window.addEventListener('touchend', handleRecordingEnd);
            } else {
                window.addEventListener('mousemove', handleRecordingDrag);
                window.addEventListener('mouseup', handleRecordingEnd);
            }

        } catch (err) {
            console.error("Microphone access denied:", err);
            showToast("Please allow microphone access to record voice notes.", "error");
        }
    };

    const handleRecordingDrag = (e) => {
        if (!isRecordingActive || isLocked) return;
        if (e.cancelable) e.preventDefault();

        const pageX = e.touches ? e.touches[0].pageX : e.clientX;
        const pageY = e.touches ? e.touches[0].pageY : e.clientY;

        const deltaX = pageX - startX;
        const deltaY = pageY - startY;

        // Visual feedback: slide lock indicator with swipe up
        if (deltaY < 0 && deltaY > lockThreshold) {
            if (elements.lockIndicatorContainer) {
                elements.lockIndicatorContainer.style.transform = `translateY(${deltaY / 2}px)`;
                elements.lockIndicatorContainer.style.opacity = `${1 - Math.abs(deltaY) / Math.abs(lockThreshold)}`;
            }
        }

        // 1. Detect Slide Up to Lock
        if (deltaY <= lockThreshold) {
            lockRecording();
        }
        // 2. Detect Slide Left to Cancel
        else if (deltaX <= cancelThreshold) {
            cancelRecording();
        }
    };

    const lockRecording = () => {
        isLocked = true;

        // Hide lock indicators
        elements.lockIndicatorContainer?.classList.remove('visible');

        // Transition to Locked voice preview layout
        elements.inputPill?.classList.remove('recording-active');
        elements.recordBtn?.classList.remove('recording');

        // Show voice preview with Send and Cancel buttons
        showVoicePreview();

        // Update timer text inside locked preview
        if (elements.previewStatus) {
            elements.previewStatus.textContent = elements.recordingTimer?.textContent || '0:00';
        }

        cleanupRecordingListeners();
    };

    const cancelRecording = () => {
        window.isRecordingCancelled?.();

        showToast("Recording discarded", "info");

        // Stop recording
        stopRecording();

        // Visual cleanup
        elements.inputPill?.classList.remove('recording-active');
        elements.recordBtn?.classList.remove('recording');
        elements.lockIndicatorContainer?.classList.remove('visible');

        cleanupRecordingListeners();
    };

    const handleRecordingEnd = (e) => {
        if (!isRecordingActive) return;

        // If not locked and not cancelled, user released holder to send immediately!
        if (!isLocked) {
            stopRecording();
        }

        cleanupRecordingListeners();
    };

    const cleanupRecordingListeners = () => {
        window.removeEventListener('touchmove', handleRecordingDrag);
        window.removeEventListener('touchend', handleRecordingEnd);
        window.removeEventListener('mousemove', handleRecordingDrag);
        window.removeEventListener('mouseup', handleRecordingEnd);
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecordingActive = false;
        clearInterval(recordingInterval);

        // Reset UI classes and states
        elements.recordBtn?.classList.remove('recording');
        elements.inputPill?.classList.remove('recording-active');
        elements.lockIndicatorContainer?.classList.remove('visible');
    };

    const startTimer = () => {
        secondsElapsed = 0;
        if (elements.recordingTimer) elements.recordingTimer.textContent = '0:00';

        recordingInterval = setInterval(() => {
            secondsElapsed++;
            const mins = Math.floor(secondsElapsed / 60);
            const secs = secondsElapsed % 60;
            const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (elements.recordingTimer) elements.recordingTimer.textContent = timeString;
            if (elements.previewStatus) elements.previewStatus.textContent = timeString;
        }, 1000);
    };

    const showVoicePreview = () => {
        const inputArea = document.querySelector('[data-ui="message-input-area"]');
        inputArea?.classList.add('voice-preview-active');
        if (elements.voicePreview) elements.voicePreview.style.display = 'flex';
    };

    const hideVoicePreview = () => {
        const inputArea = document.querySelector('[data-ui="message-input-area"]');
        inputArea?.classList.remove('voice-preview-active');

        if (previewAudio) {
            previewAudio.pause();
            previewAudio = null;
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            window.isRecordingCancelled?.();
            stopRecording();
        }

        if (elements.voicePreview) elements.voicePreview.style.display = 'none';
        audioUrl = null;
        lastBlob = null;
        isStoppedForPreview = false;
    };

    const sendVoiceNote = async () => {
        const voiceBlob = lastBlob;
        if (!voiceBlob) return;

        hideVoicePreview();
        await sendMedia('audio', voiceBlob, `voice_note_${Date.now()}.mp3`);
    };

    // Event Listeners for Mic Button (Touch and Mouse gestures)
    elements.recordBtn?.addEventListener('mousedown', startRecording);
    elements.recordBtn?.addEventListener('touchstart', startRecording, { passive: false });

    // Preview Actions (Cancel, Play/Stop and Send inside Locked mode)
    elements.previewPlayBtn?.addEventListener('click', () => {
        if (isRecordingActive) {
            stopRecording();
            return;
        }

        if (audioUrl) {
            if (previewAudio && !previewAudio.paused) {
                previewAudio.pause();
                elements.previewPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            } else {
                if (!previewAudio) {
                    previewAudio = new Audio(audioUrl);
                    previewAudio.onended = () => {
                        elements.previewPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    };
                }
                previewAudio.play();
                elements.previewPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
        }
    });

    elements.previewCancelBtn?.addEventListener('click', hideVoicePreview);

    elements.previewSendBtn?.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            // Stop recorder first to trigger save message
            mediaRecorder.onstop = async () => {
                const finalBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                await sendMedia('audio', finalBlob, `voice_note_${Date.now()}.mp3`);
                hideVoicePreview();
            };
            stopRecording();
        } else {
            sendVoiceNote();
        }
    });
};

// Initialize Camera logic
const initCamera = () => {
    const startCamera = async () => {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacingMode },
                audio: true
            });
            if (elements.cameraStream) {
                elements.cameraStream.srcObject = cameraStream;
                if (elements.cameraModal) {
                    const isPhotoOnly = elements.cameraModal.dataset.mode === 'photo-only';
                    if (elements.camVideoBtn) {
                        elements.camVideoBtn.style.display = isPhotoOnly ? 'none' : 'flex';
                    }
                    elements.cameraModal.style.display = 'flex';
                }
            }
        } catch (err) {
            console.error("Camera access denied:", err);
            showToast("Please allow camera access to take photos/videos.", "error");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        currentFacingMode = 'user'; // Reset to user-facing camera on close
        if (elements.cameraModal) {
            elements.cameraModal.style.display = 'none';
            elements.cameraModal.dataset.mode = ''; // Reset mode
        }
    };

    const switchCamera = async () => {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacingMode },
                audio: true
            });
            if (elements.cameraStream) {
                elements.cameraStream.srcObject = cameraStream;
            }
        } catch (err) {
            console.error("Camera switch failed:", err);
            showToast("Failed to switch camera direction.", "error");
        }
    };

    const capturePhoto = () => {
        const video = elements.cameraStream;
        if (!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        // Convert canvas to Blob for Storage upload
        canvas.toBlob((blob) => {
            if (blob) processCapturedMedia(blob);
        }, 'image/jpeg');

        const processCapturedMedia = (blob) => {
            const dataUrl = URL.createObjectURL(blob);

            const isProductModalOpen = elements.productModal && elements.productModal.style.display === 'flex';
            const isProfileModalOpen = elements.profileModal && elements.profileModal.style.display === 'flex';

            if (isProfileModalOpen) {
                if (elements.profilePhotoPreview) elements.profilePhotoPreview.src = dataUrl;
            } else if (isProductModalOpen) {
                let currentImages = [];
                try {
                    currentImages = JSON.parse(elements.productImgData.value || '[]');
                } catch (e) {
                    currentImages = elements.productImgData.value ? [elements.productImgData.value] : [];
                }

                if (currentImages.length >= 5) {
                    showToast("You can't upload more than 5 images per product.", "warning");
                } else {
                    currentImages.push(dataUrl);
                    if (elements.productImgData) elements.productImgData.value = JSON.stringify(currentImages);
                    if (elements.productImgPreview) {
                        elements.productImgPreview.innerHTML = currentImages.map((img, index) =>
                            `<div class="preview-item" data-index="${index}">
                            <img src="${img}" alt="Preview">
                            <button type="button" class="remove-img-btn">×</button>
                        </div>`
                        ).join('');
                    }

                    const isLimitReached = currentImages.length >= 5;
                    if (elements.uploadProductBtn) elements.uploadProductBtn.disabled = isLimitReached;
                    if (elements.captureProductBtn) elements.captureProductBtn.disabled = isLimitReached;
                }
            } else {
                sendMedia('image', blob, `camera_${Date.now()}.jpg`);
            }
            stopCamera();
        };
    };

    const toggleVideoRecording = () => {
        if (videoRecorder && videoRecorder.state === "recording") {
            videoRecorder.stop();
            elements.camVideoBtn.classList.remove('recording');
        } else {
            videoChunks = [];
            videoRecorder = new MediaRecorder(cameraStream);
            videoRecorder.ondataavailable = (e) => videoChunks.push(e.data);
            videoRecorder.onstop = () => {
                const blob = new Blob(videoChunks, { type: 'video/webm' });
                sendMedia('video', blob, `video_${Date.now()}.webm`);
                stopCamera();
            };
            videoRecorder.start();
            elements.camVideoBtn.classList.add('recording');
        }
    };

    elements.cameraBtn?.addEventListener('click', startCamera);
    elements.camPhotoBtn?.addEventListener('click', capturePhoto);
    elements.camVideoBtn?.addEventListener('click', toggleVideoRecording);
    elements.camSwitchBtn?.addEventListener('click', switchCamera);
    elements.camCloseBtn?.addEventListener('click', stopCamera);
};

const initLocation = () => {
    const stopLiveSharing = async () => {
        if (liveLocationWatchId) {
            navigator.geolocation.clearWatch(liveLocationWatchId);
            liveLocationWatchId = null;
        }
        if (liveLocationTimeoutId) {
            clearTimeout(liveLocationTimeoutId);
            liveLocationTimeoutId = null;
        }

        if (currentLiveLocationMessageId && activeChatUid) {
            const user = auth.currentUser;
            if (user) {
                const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');
                const updates = { liveSharingEnded: true };

                let otherProfile = null;
                if (!activeChatUid.startsWith('group_')) {
                    otherProfile = allUsersCache[activeChatUid] || await getUserProfile(activeChatUid);
                }
                if (otherProfile && otherProfile.publicKey) {
                    const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
                    if (sharedKey) {
                        const origMsg = messages.find(m => m.id === currentLiveLocationMessageId);
                        const payload = {
                            text: '🛰️ Live Location (Ended)',
                            latitude: origMsg?.latitude || null,
                            longitude: origMsg?.longitude || null,
                            address: 'Live sharing ended',
                            mapUrl: origMsg?.mapUrl || null,
                            staticMapUrl: origMsg?.staticMapUrl || null,
                            liveSharingEnded: true
                        };
                        const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                        updates.text = encrypted.ciphertext;
                        updates.isEncrypted = true;
                        updates.iv = encrypted.iv;
                    }
                } else {
                    updates.address = 'Live sharing ended';
                }

                await updateMessage(chatId, currentLiveLocationMessageId, updates);
            }
            currentLiveLocationMessageId = null;
        }

        elements.liveLocationBtn?.classList.remove('active');
        document.querySelectorAll('.live-status').forEach(el => el.textContent = 'Live sharing ended');
        document.querySelectorAll('.live-indicator').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.stop-live-sharing-bubble-btn').forEach(btn => btn.remove());
        if (elements.liveLocationHeaderBtn) {
            elements.liveLocationHeaderBtn.style.display = 'none';
        }
    };
    stopLiveSharingFn = stopLiveSharing;

    const updateLiveLocationCoordinates = async (messageId, latitude, longitude) => {
        const user = auth.currentUser;
        if (!user || !activeChatUid || !messageId) return;

        let address = "Sharing live location...";
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await resp.json();
            const displayName = data.display_name || '';
            address = data.name || displayName.split(',')[0] || "Live Location";
        } catch (e) { console.warn("Reverse geocoding failed", e); }

        const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${longitude},${latitude}&z=15&l=map&size=300,180&pt=${longitude},${latitude},pm2rdl`;

        const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');

        const updates = {
            latitude: latitude,
            longitude: longitude,
            address: address,
            mapUrl: mapUrl,
            staticMapUrl: staticMapUrl
        };

        let otherProfile = null;
        if (!activeChatUid.startsWith('group_')) {
            otherProfile = allUsersCache[activeChatUid] || await getUserProfile(activeChatUid);
        }
        if (otherProfile && otherProfile.publicKey) {
            const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
            if (sharedKey) {
                const payload = {
                    text: '🛰️ Live Location',
                    latitude: latitude,
                    longitude: longitude,
                    address: address,
                    mapUrl: mapUrl,
                    staticMapUrl: staticMapUrl
                };
                const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                updates.text = encrypted.ciphertext;
                updates.isEncrypted = true;
                updates.iv = encrypted.iv;

                delete updates.latitude;
                delete updates.longitude;
                updates.address = null;
                updates.mapUrl = null;
                updates.staticMapUrl = null;
            }
        }

        await updateMessage(chatId, messageId, updates);
    };

    const startLiveSharing = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "error");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const msgId = await sendLocationMessage(latitude, longitude, "Sharing live location...", true);
                    currentLiveLocationMessageId = msgId;

                    elements.liveLocationBtn?.classList.add('active');

                    if (elements.liveLocationHeaderBtn) {
                        elements.liveLocationHeaderBtn.style.display = 'block';
                    }

                    let lastUpdateTimestamp = 0;
                    liveLocationWatchId = navigator.geolocation.watchPosition(
                        async (watchPos) => {
                            const now = Date.now();
                            if (now - lastUpdateTimestamp < 5000) {
                                return;
                            }
                            lastUpdateTimestamp = now;

                            const lat = watchPos.coords.latitude;
                            const lng = watchPos.coords.longitude;
                            if (currentLiveLocationMessageId) {
                                await updateLiveLocationCoordinates(currentLiveLocationMessageId, lat, lng);
                            }
                        },
                        (err) => {
                            console.error("Live geolocation watch error:", err);
                            showToast("Live location connection lost.", "error");
                            stopLiveSharing();
                        },
                        { enableHighAccuracy: true, maximumAge: 0 }
                    );

                    liveLocationTimeoutId = setTimeout(() => {
                        stopLiveSharing();
                        showToast("Live location sharing ended (15 min timeout).", "info");
                    }, 15 * 60 * 1000);

                    showToast("Live location sharing started!", "success");
                } catch (e) {
                    console.error("Failed to start live location sharing:", e);
                    showToast("Error starting live location sharing.", "error");
                }
            },
            (error) => {
                console.error("Live geolocation error:", error);
                showToast("Unable to access location. Check permissions.", "error");
            }
        );
    };

    const handleLiveLocationToggle = () => {
        if (liveLocationWatchId) {
            stopLiveSharing();
            showToast("Live location sharing stopped.", "info");
        } else {
            startLiveSharing();
        }
    };

    const updateSendBarAddress = async (lat, lng) => {
        if (!elements.sendThisLocationAddress) return;
        elements.sendThisLocationAddress.textContent = 'Getting location...';
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await resp.json();
            const address = data.name || data.display_name.split(',')[0] || "Selected Location";
            elements.sendThisLocationAddress.textContent = address;
        } catch (e) {
            console.warn("Reverse geocoding for send bar failed", e);
            elements.sendThisLocationAddress.textContent = "Selected Location";
        }
    };

    const fetchNearbyPlaces = async (lat, lng) => {
        const container = elements.nearbyPlacesList;
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:15px;"><span class="spinner" style="border-top-color:var(--brand); width:16px; height:16px; margin:0;"></span></div>';

        try {
            // Query Overpass API for POIs within 500m of the pin
            const query = `[out:json];node(around:500,${lat},${lng})["name"];out 15;`;
            const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await response.json();

            const places = data.elements || [];
            if (places.length === 0) {
                container.innerHTML = '<div style="font-size:0.85rem; color:var(--muted); padding:15px; text-align:center;">No nearby places found</div>';
                return;
            }

            container.innerHTML = places.map(p => {
                const name = p.tags.name;
                const type = p.tags.amenity || p.tags.shop || p.tags.tourism || p.tags.leisure || p.tags.historic || 'Place';
                const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');

                return `
                    <div class="nearby-place-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${name}">
                        <div class="location-icon" style="background: #f8faf7; color: var(--brand-dark); width: 34px; height: 32px; font-size: 0.9rem;">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div class="location-text">
                            <strong style="font-size:0.9rem; color:var(--text);">${name}</strong>
                            <span style="font-size:0.75rem;">${typeLabel}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = '<div style="font-size:0.85rem; color:var(--muted); padding:15px; text-align:center;">Could not load nearby places</div>';
        }
    };

    const inputPill = document.querySelector('.input-pill');
    if (inputPill && !elements.locationBtn) {
        const locBtn = document.createElement('button');
        locBtn.className = 'input-icon-btn location-btn';
        locBtn.setAttribute('data-ui', 'location-btn');
        locBtn.type = 'button';
        locBtn.title = 'Send Location';
        locBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
        locBtn.style.display = 'none';
        inputPill.appendChild(locBtn);
    }
    if (inputPill && !elements.liveLocationBtn) {
        const liveLocBtn = document.createElement('button');
        liveLocBtn.className = 'input-icon-btn live-location-btn';
        liveLocBtn.setAttribute('data-ui', 'live-location-btn');
        liveLocBtn.type = 'button';
        liveLocBtn.title = 'Share Live Location';
        liveLocBtn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i>';
        liveLocBtn.style.display = 'none';
        inputPill.appendChild(liveLocBtn);

        liveLocBtn.addEventListener('click', () => {
            handleLiveLocationToggle();
        });
    }

    window.initSelectionMap = (lat, lng) => { // This function was already present
        if (typeof L === 'undefined') return;

        const brandIcon = L.divIcon({
            html: '<i class="fa-solid fa-location-dot custom-map-marker"></i>',
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32] // Anchor point at the bottom center
        });

        if (selectionMap) {
            selectionMap.setView([lat, lng], 15, { animate: false }); // Set animate to false to prevent multiple moveend events during rapid updates
            if (selectionMarker) {
                selectionMarker.setLatLng([lat, lng]);
            }
            // The 'moveend' listener will handle fetching nearby places.
            // Invalidation is now handled when the modal is shown.
            return;
        }


        selectionMap = L.map('location-map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(selectionMap);

        selectionMarker = L.marker([lat, lng], {
            draggable: true,
            icon: brandIcon
        }).addTo(selectionMap);

        // Consolidate nearby places fetching to a single 'moveend' event
        // This listener will fire after initial setView, after clicks, and after dragends.
        selectionMap.on('moveend', () => {
            const center = selectionMap.getCenter();
            fetchNearbyPlaces(center.lat, center.lng);
            updateSendBarAddress(center.lat, center.lng);
        });

        selectionMap.on('click', (e) => {
            selectionMarker.setLatLng(e.latlng);
            updateSendBarAddress(e.latlng.lat, e.latlng.lng);
        });

        selectionMarker.on('dragend', () => {
            const { lat, lng } = selectionMarker.getLatLng();
            selectionMap.setView([lat, lng], selectionMap.getZoom()); // This will trigger 'moveend'
        });

    };

    // Location Selector Modal Handlers
    if (elements.sendCurrentLocBtn) {
        elements.sendCurrentLocBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your browser.", "error");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    sendLocationMessage(position.coords.latitude, position.coords.longitude, "My Current Location", false);
                    hideLocationModal();
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    showToast("Unable to retrieve current location. Check permissions.", "error");
                }
            );
        });
    }

    // Event listener for selecting a nearby place
    if (elements.nearbyPlacesList) {
        elements.nearbyPlacesList.addEventListener('click', (e) => {
            const item = e.target.closest('.nearby-place-item');
            if (!item) return;
            const lat = parseFloat(item.dataset.lat);
            const lng = parseFloat(item.dataset.lon);
            const name = item.dataset.name;
            sendLocationMessage(lat, lng, name);
            hideLocationModal();
        });
    }

    if (elements.sendThisLocationBtn) {
        elements.sendThisLocationBtn.addEventListener('click', () => {
            if (selectionMarker) {
                const { lat, lng } = selectionMarker.getLatLng();
                sendLocationMessage(lat, lng);
                hideLocationModal();
            } else {
                showToast("Please select a location on the map first.", "warning");
            }
        });
    }

    if (elements.sendLiveLocBtn) {
        elements.sendLiveLocBtn.addEventListener('click', () => {
            if (elements.liveLocationBtn) {
                elements.liveLocationBtn.click();
            }
            hideLocationModal();
        });
    }
    if (elements.closeLocationModalBtn) {
        elements.closeLocationModalBtn.addEventListener('click', () => {
            hideLocationModal();
        });
    }

    const performLocationSearch = debounce(async (query) => {
        if (query.length < 3) {
            if (elements.locationSearchResults) elements.locationSearchResults.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const results = await response.json();
            const container = elements.locationSearchResults;
            if (!container) return;

            if (results.length === 0) {
                container.innerHTML = '<div class="location-search-results-item">No results found</div>';
            } else {
                container.innerHTML = results.map(res => `
                    <div class="location-search-results-item" data-lat="${res.lat}" data-lon="${res.lon}">
                        <i class="fa-solid fa-location-dot" style="color: var(--muted);"></i>
                        <span>${res.display_name}</span>
                    </div>
                `).join('');
            }
            container.style.display = 'block';
        } catch (err) { console.error("Location search error:", err); }
    }, 500); // Debounce delay for location search

    if (elements.locationSearchInput) {
        elements.locationSearchInput.addEventListener('input', (e) => {
            performLocationSearch(e.target.value.trim());
        });
    }

    if (elements.locationSearchResults) {
        elements.locationSearchResults.addEventListener('click', (e) => {
            const item = e.target.closest('.location-search-results-item');
            if (!item || !item.dataset.lat) return;
            const lat = parseFloat(item.dataset.lat);
            const lon = parseFloat(item.dataset.lon);
            if (selectionMap && selectionMarker) {
                selectionMap.setView([lat, lon], 15);
                selectionMarker.setLatLng([lat, lon]);
            }
            elements.locationSearchResults.style.display = 'none';
            if (elements.locationSearchInput) {
                elements.locationSearchInput.value = item.querySelector('span').textContent;
            }
        });
    }

    if (elements.resetMapToCurrentLocBtn) {
        elements.resetMapToCurrentLocBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your browser.", "error");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    if (selectionMap && selectionMarker) {
                        selectionMap.setView([latitude, longitude], 15);
                        selectionMarker.setLatLng([latitude, longitude]);
                    }
                    showToast("Map reset to current location", "info");
                },
                (error) => showToast("Unable to retrieve current location. Check permissions.", "error")
            );
        });
    }

    // Create and append the header button if it doesn't exist
    if (elements.chatHeader && !elements.liveLocationHeaderBtn) {
        const headerBtn = document.createElement('button');
        headerBtn.className = 'live-location-header-btn';
        headerBtn.type = 'button';
        headerBtn.title = 'Stop Live Location Sharing';
        headerBtn.innerHTML = 'Stop Live';
        headerBtn.style.display = 'none'; // Hidden by default
        elements.chatHeader.appendChild(headerBtn);

        headerBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to stop sharing your live location?")) {
                stopLiveSharing();
            }
        });
    }

    const sendLocationMessage = async (latitude, longitude, label = null, isLive = false) => {
        const user = auth.currentUser;
        if (!user || !activeChatUid) return;

        let address = label || "Location";

        // Try to get a user-friendly name via reverse geocoding if a specific label wasn't provided
        if (!label) {
            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await resp.json();
                const displayName = data.display_name || '';
                address = data.name || displayName.split(',')[0] || "Shared Location";
            } catch (e) { console.warn("Reverse geocoding failed", e); }
        }

        const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
        // Use OpenStreetMap for static map images to avoid needing an API key.
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${longitude},${latitude}&z=15&l=map&size=300,180&pt=${longitude},${latitude},pm2rdl`;

        const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');
        const messageData = {
            senderId: user.uid,
            chatId: chatId,
            type: isLive ? 'live-location' : 'location',
            latitude: latitude,
            longitude: longitude,
            address: address,
            mapUrl: mapUrl,
            staticMapUrl: staticMapUrl,
            timestamp: Date.now()
        };

        let otherProfile = null;
        if (!activeChatUid.startsWith('group_')) {
            otherProfile = allUsersCache[activeChatUid] || await getUserProfile(activeChatUid);
        }
        if (otherProfile && otherProfile.publicKey) {
            const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
            if (sharedKey) {
                const payload = {
                    text: isLive ? '🛰️ Live Location' : '📍 Location',
                    latitude: latitude,
                    longitude: longitude,
                    address: address,
                    mapUrl: mapUrl,
                    staticMapUrl: staticMapUrl
                };
                const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                messageData.text = encrypted.ciphertext;
                messageData.isEncrypted = true;
                messageData.iv = encrypted.iv;

                delete messageData.latitude;
                delete messageData.longitude;
                messageData.address = null;
                messageData.mapUrl = null;
                messageData.staticMapUrl = null;
            }
        }

        const messageId = await saveMessage(chatId, messageData);
        return messageId; // Return the message ID
    };

};

/**
 * Voice Calling Implementation
 */
/**
 * Voice/Video Calling Mesh WebRTC Implementation
 */
const playRemoteStream = (targetUid, stream, type) => {
    // Play audio in a dynamic hidden audio element
    let audioId = `remote-audio-${targetUid}`;
    let audioEl = document.getElementById(audioId);
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = audioId;
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
    }
    if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        audioEl.play().catch(err => console.warn(`Audio play blocked for ${targetUid}:`, err));
    }

    // Support legacy elements.remoteAudio for backwards compatibility if 1-to-1
    if (peerConnections.size === 1 && elements.remoteAudio) {
        if (elements.remoteAudio.srcObject !== stream) {
            elements.remoteAudio.srcObject = stream;
            elements.remoteAudio.play().catch(() => { });
        }
    }

    // Handle remote video stream
    if (type === 'video' && elements.videoContainer) {
        let videoId = `remote-video-${targetUid}`;
        let videoEl = document.getElementById(videoId);
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.id = videoId;
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.className = 'remote-grid-video';
            elements.videoContainer.insertBefore(videoEl, elements.localVideo);
        }
        if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
            videoEl.play().catch(err => console.warn(`Remote video play blocked for ${targetUid}:`, err));
        }

        // Hide default static remote video element
        if (elements.remoteVideo) {
            elements.remoteVideo.style.display = 'none';
        }

        adjustVideoContainerLayout();
    }
};

const adjustVideoContainerLayout = () => {
    if (!elements.videoContainer) return;
    const remoteVideos = elements.videoContainer.querySelectorAll('.remote-grid-video');
    const total = remoteVideos.length;

    if (total === 0) {
        if (elements.remoteVideo) {
            elements.remoteVideo.style.display = 'block';
        }
        elements.videoContainer.style.display = 'none';
        return;
    }

    elements.videoContainer.style.display = 'grid';
    if (total === 1) {
        elements.videoContainer.style.gridTemplateColumns = '1fr';
        elements.videoContainer.style.gridTemplateRows = '1fr';
        remoteVideos[0].style.width = '100%';
        remoteVideos[0].style.height = '100%';
        remoteVideos[0].style.objectFit = 'cover';
    } else if (total === 2) {
        elements.videoContainer.style.gridTemplateColumns = '1fr';
        elements.videoContainer.style.gridTemplateRows = '1fr 1fr';
        remoteVideos.forEach(v => {
            v.style.width = '100%';
            v.style.height = '100%';
            v.style.objectFit = 'cover';
        });
    } else {
        elements.videoContainer.style.gridTemplateColumns = '1fr 1fr';
        elements.videoContainer.style.gridTemplateRows = 'auto';
        remoteVideos.forEach(v => {
            v.style.width = '100%';
            v.style.height = '100%';
            v.style.objectFit = 'cover';
        });
    }
};

const cleanupRemoteMedia = (targetUid) => {
    const audioEl = document.getElementById(`remote-audio-${targetUid}`);
    if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
    }

    const videoEl = document.getElementById(`remote-video-${targetUid}`);
    if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl.remove();
    }

    adjustVideoContainerLayout();
};

const closePeerConnection = (targetUid) => {
    const pc = peerConnections.get(targetUid);
    if (pc) {
        pc.close();
        peerConnections.delete(targetUid);
    }

    const unsub = iceSubscribes.get(targetUid);
    if (unsub) {
        unsub();
        iceSubscribes.delete(targetUid);
    }

    remoteCandidatesQueues.delete(targetUid);

    cleanupRemoteMedia(targetUid);

    callParticipants.delete(targetUid);

    if (peerConnections.size === 0) {
        endCall();
    } else {
        updateCallUI();
        adjustVideoContainerLayout();
    }
};

const setupWebRTC = async (targetUid, isCaller, type = 'voice') => {
    remoteCandidatesQueues.set(targetUid, []);
    isSettingRemoteDescription = false;

    // Check if there is an existing peer connection for this targetUid and close it first!
    if (peerConnections.has(targetUid)) {
        console.log(`Closing existing peer connection for ${targetUid} before setting up a new one.`);
        const oldPc = peerConnections.get(targetUid);
        try {
            oldPc.close();
        } catch (e) {
            console.error("Error closing old peer connection:", e);
        }
        peerConnections.delete(targetUid);
        // Do not cleanup remote media elements during setup to avoid destroying them during renegotiation
        // cleanupRemoteMedia(targetUid);
    }

    // Unsubscribe from old ICE candidates listener for this targetUid if exists
    if (iceSubscribes.has(targetUid)) {
        const oldUnsub = iceSubscribes.get(targetUid);
        if (typeof oldUnsub === 'function') {
            try {
                oldUnsub();
            } catch (e) {
                console.error("Error unsubscribing from old ICE candidates listener:", e);
            }
        }
        iceSubscribes.delete(targetUid);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.set(targetUid, pc);

    const needsVideo = type === 'video';
    const hasVideo = localStream && localStream.getVideoTracks().length > 0;

    if (!localStream || (needsVideo && !hasVideo)) {
        if (localStream) {
            console.log("Stopping old local stream to upgrade to video...");
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        const constraints = {
            audio: true,
            video: needsVideo ? { facingMode: currentFacingMode } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (needsVideo) {
            localStream.getVideoTracks()[0].enabled = !isCameraMuted;
            if (elements.localVideo) {
                elements.localVideo.classList.toggle('muted-blur', isCameraMuted);
                if (isCameraMuted) {
                    const avatar = elements.headerUserAvatar?.src || '';
                    elements.localVideo.style.backgroundImage = `url(${avatar})`;
                }
            }
        }
    }

    if (type === 'video' && elements.localVideo) {
        elements.localVideo.srcObject = localStream;
        elements.localVideo.classList.remove('muted-blur');
        elements.localVideo.style.backgroundImage = 'none';
    } else if (elements.localVideo) {
        elements.localVideo.srcObject = null;
        elements.localVideo.classList.add('muted-blur');
        const avatar = elements.headerUserAvatar?.src || '';
        elements.localVideo.style.backgroundImage = `url(${avatar})`;
    }

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        let remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
        if (!remoteStream) {
            remoteStream = new MediaStream([event.track]);
        }

        const hasVideo = (event.track.kind === 'video') || (remoteStream.getVideoTracks().length > 0);
        const streamType = hasVideo ? 'video' : type;

        if (hasVideo) {
            const wasVoice = !elements.callOverlay?.classList.contains('video-mode');
            if (wasVoice) {
                playSwitchSound();

                // Show video call overlay layout elements
                elements.callOverlay?.classList.add('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'block';

                if (currentCallType === 'video') {
                    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'flex';
                    if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'flex';
                    if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'flex';
                    if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'none';
                } else {
                    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
                    if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
                    if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';
                    if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'flex';
                }
                updatePipButtonVisibility();
                updateFlashButtonVisibility();
            }
        }

        playRemoteStream(targetUid, remoteStream, streamType);
    };

    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'failed' || state === 'closed') {
            if (peerConnections.get(targetUid) === pc) {
                closePeerConnection(targetUid);
            } else {
                console.log(`Ignoring iceconnectionstatechange for old connection of ${targetUid}`);
                pc.close();
            }
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate && auth.currentUser) {
            addIceCandidate(targetUid, auth.currentUser.uid, event.candidate);
        }
    };

    const unsub = subscribeToIceCandidates(auth.currentUser.uid, targetUid, (candidate) => {
        if (pc) {
            if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(e => console.warn(`Error adding ICE candidate directly for ${targetUid}:`, e));
            } else {
                let queue = remoteCandidatesQueues.get(targetUid) || [];
                queue.push(candidate);
                remoteCandidatesQueues.set(targetUid, queue);
            }
        }
    });
    iceSubscribes.set(targetUid, unsub);

    return pc;
};

const processCandidatesQueue = (targetUid) => {
    const pc = peerConnections.get(targetUid);
    const queue = remoteCandidatesQueues.get(targetUid);
    if (pc && pc.remoteDescription && queue && queue.length > 0) {
        console.log(`Processing ${queue.length} queued ICE candidates for ${targetUid}`);
        queue.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(e => console.warn(`Error adding queued ICE candidate for ${targetUid}:`, e));
        });
        remoteCandidatesQueues.set(targetUid, []);
    }
};

let isLocalVideoDragging = false;

const resetLocalVideoPosition = () => {
    if (elements.localVideo) {
        elements.localVideo.style.left = '';
        elements.localVideo.style.top = '';
        elements.localVideo.style.bottom = '';
        elements.localVideo.style.right = '';
    }
    if (elements.localClickCatcher) {
        elements.localClickCatcher.style.left = '';
        elements.localClickCatcher.style.top = '';
        elements.localClickCatcher.style.bottom = '';
        elements.localClickCatcher.style.right = '';
    }
};

const toggleVideoSwap = (e) => {
    e.stopPropagation();
    if (isLocalVideoDragging) return; // Prevent swap if we were dragging

    const container = elements.videoContainer;
    if (!container) return;

    const isSwapped = container.classList.contains('swapped');

    if (e.currentTarget === elements.localClickCatcher && !isSwapped) {
        container.classList.add('swapped');
    } else if (e.currentTarget === elements.remoteClickCatcher && isSwapped) {
        container.classList.remove('swapped');
        resetLocalVideoPosition();
    }
};

const startVoiceCall = () => startCall('voice');
const startVideoCall = () => startCall('video');

const showVideoCallLayout = () => {
    elements.callOverlay?.classList.add('video-mode');
    if (elements.videoContainer) elements.videoContainer.style.display = 'block';
    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'flex';
    if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'flex';
    if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'flex';
    updatePipButtonVisibility();
    updateFlashButtonVisibility();
};

const startCall = async (type) => {
    if (!activeChatUid) return;
    const user = auth.currentUser;
    currentCallType = type;

    const isGroup = activeChatUid.startsWith('group_');
    let profileData = {};
    let targetUids = [];

    if (isGroup) {
        profileData = {
            fullname: currentGroupName || "Group Chat",
            profilePhoto: document.getElementById('group-info-avatar-img')?.src || ""
        };
        targetUids = activeGroupMembers.filter(uid => uid !== user.uid);
    } else {
        profileData = await getUserProfile(activeChatUid) || {};
        targetUids = [activeChatUid];
    }

    // Always start in standard/avatar calling view (no video container showing yet)
    elements.callOverlay?.classList.remove('video-mode');
    if (elements.videoContainer) elements.videoContainer.style.display = 'none';
    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
    if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
    if (elements.callPipBtn) elements.callPipBtn.style.display = 'none';
    if (elements.callFlashBtn) elements.callFlashBtn.style.display = 'none';
    if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';

    if (elements.callOverlay) {
        elements.callOverlayName.textContent = profileData.fullname;
        if (profileData.profilePhoto && !profileData.profilePhoto.includes('group-info-avatar-img') && !profileData.profilePhoto.endsWith('/')) {
            elements.callOverlayAvatar.innerHTML = `<img src="${profileData.profilePhoto}" class="avatar-img">`;
        } else {
            elements.callOverlayAvatar.innerHTML = (profileData.fullname || 'G').charAt(0).toUpperCase();
        }
        elements.callOverlay.style.display = 'flex';
        elements.callStatus.textContent = "Calling...";
    }

    const callerName = elements.headerUserName?.textContent || user.displayName || 'Contact';

    callLoggingSession = {
        contactUid: activeChatUid,
        type: 'outgoing',
        callType: type
    };

    callTimeoutId = setTimeout(async () => {
        showToast("Call not answered", "info");
        await saveCallLog(user.uid, { ...callLoggingSession, status: 'missed' });
        callLoggingSession = null;
        for (const targetUid of targetUids) {
            await sendCallSignal(targetUid, user.uid, { status: 'missed', from: user.uid, fromName: callerName });
        }
        endCall();
    }, 30000);

    playRingAudio('outgoing');

    isLocalCaller = true;
    currentCallPartnerUid = activeChatUid;

    // Add all targets to call participants
    for (const targetUid of targetUids) {
        callParticipants.add(targetUid);
    }
    updateCallUI();

    // Establish WebRTC for each group member
    for (const targetUid of targetUids) {
        try {
            const pc = await setupWebRTC(targetUid, true, type);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Send call invite to each member
            await sendCallSignal(targetUid, user.uid, {
                from: user.uid,
                fromName: callerName,
                fromAvatar: '',
                offer: offer.sdp,
                callType: type,
                status: isGroup ? 'group-invite' : 'calling',
                participants: isGroup ? [user.uid, ...targetUids] : null
            });
        } catch (e) {
            console.error(`Failed to initiate WebRTC for user ${targetUid}:`, e);
        }
    }
};

const recordCallInChat = async (partnerUid, callType, status, duration = 0, callerId = null) => {
    const user = auth.currentUser;
    if (!user || !partnerUid) return;
    const chatId = [user.uid, partnerUid].sort().join('_');

    await saveMessage(chatId, {
        senderId: user.uid,
        type: 'call',
        callType,
        callStatus: status,
        duration,
        callerId: callerId || (isLocalCaller ? user.uid : partnerUid)
    });
};

const endCall = async () => {
    resetLocalVideoPosition();
    elements.callMoreSheet?.classList.remove('show');
    if (elements.callMoreBackdrop) elements.callMoreBackdrop.style.display = 'none';
    elements.videoContainer?.classList.remove('swapped');

    clearTimeout(callTimeoutId);
    clearTimeout(reconnectTimeoutId);

    let duration = 0;
    if (callStartTime) {
        duration = Math.floor((Date.now() - callStartTime) / 1000);
    }

    stopCallTimer();

    if (elements.localVideo) elements.localVideo.srcObject = null;
    if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
    if (elements.remoteMuteOverlay) elements.remoteMuteOverlay.style.display = 'none';
    if (elements.videoContainer) elements.videoContainer.style.display = 'none';
    elements.callOverlay?.classList.remove('video-mode');

    peerConnections.forEach((pc, targetUid) => {
        pc.close();
        cleanupRemoteMedia(targetUid);
    });
    peerConnections.clear();

    iceSubscribes.forEach((unsub) => {
        if (unsub) unsub();
    });
    iceSubscribes.clear();

    remoteCandidatesQueues.clear();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    isScreenSharing = false;
    if (elements.callScreenShareBtn) {
        elements.callScreenShareBtn.style.display = 'none';
        elements.callScreenShareBtn.classList.remove('active');
        elements.callScreenShareBtn.title = "Share Screen";
    }
    if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
    }
    waitingCallSignal = null;

    if (elements.waitingCallBadge) elements.waitingCallBadge.style.display = 'none';
    stopRingAudio();
    if (elements.callRetryBtn) elements.callRetryBtn.style.display = 'none';
    if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'none';
    if (elements.callPipBtn) elements.callPipBtn.style.display = 'none';

    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => { });
    }

    if (elements.callCamMuteBtn) {
        elements.callCamMuteBtn.style.display = 'none';
        elements.callCamMuteBtn.classList.remove('active');
        elements.callCamMuteBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
    }

    if (elements.callSpeakerBtn) {
        elements.callSpeakerBtn.classList.remove('active');
        elements.callSpeakerBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        isSpeakerOn = false;
    }
    if (elements.pipMuteIndicator) elements.pipMuteIndicator.classList.remove('active');
    if (elements.localVideo) {
        elements.localVideo.classList.remove('muted-blur');
        elements.localVideo.style.backgroundImage = '';
    }
    isCameraMuted = false;

    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
    if (elements.callFlashBtn) elements.callFlashBtn.style.display = 'none';
    isFlashOn = false;
    if (elements.callOverlay) {
        elements.callOverlay.style.left = '';
        elements.callOverlay.style.top = '';
        elements.callOverlay.style.right = '';
        elements.callOverlay.style.bottom = '';
        elements.callOverlay.style.width = '';
        elements.callOverlay.style.height = '';
    }
    elements.callOverlay?.classList.remove('minimized');
    currentFacingMode = 'user';

    try {
        await clearCallSignal(auth.currentUser.uid);
    } catch (clearErr) {
        console.warn("Failed to clear call signal on database:", clearErr);
    }

    if (auth.currentUser) {
        const user = auth.currentUser;
        const promises = Array.from(callParticipants).map(pUid => {
            return sendCallSignal(pUid, user.uid, { status: 'ended', from: user.uid })
                .catch(err => console.warn(`Failed to send end signal to ${pUid}:`, err));
        });
        try {
            await Promise.all(promises);
        } catch (signalErr) {
            console.warn("Failed to dispatch ended signals:", signalErr);
        }
    }

    try {
        if (callLoggingSession && currentCallPartnerUid) {
            if (duration > 0) {
                if (isLocalCaller) {
                    await recordCallInChat(currentCallPartnerUid, currentCallType, 'completed', duration, auth.currentUser.uid);
                }
                await saveCallLog(auth.currentUser.uid, { ...callLoggingSession, status: 'completed', duration });
            } else if (!callStartTime && callLoggingSession.type === 'outgoing' && !['missed', 'busy', 'declined'].includes(callLoggingSession.status)) {
                await recordCallInChat(currentCallPartnerUid, currentCallType, 'cancelled', 0, auth.currentUser.uid);
                await saveCallLog(auth.currentUser.uid, { ...callLoggingSession, status: 'cancelled' });
            } else if (!callStartTime && callLoggingSession.type === 'incoming' && callLoggingSession.status === 'declined') {
                await recordCallInChat(currentCallPartnerUid, currentCallType, 'declined', 0, currentCallPartnerUid);
            }
        }
    } catch (logErr) {
        console.warn("Failed to save call logs in endCall:", logErr);
    }

    callLoggingSession = null;
    callStartTime = null;
    currentCallType = 'voice';
    isReconnecting = false;
    currentCallPartnerUid = null;
    callParticipants.clear();

    if (elements.minimizedCallBar) elements.minimizedCallBar.style.display = 'none';

    if (elements.callOverlay) elements.callOverlay.style.display = 'none';
    if (elements.incomingCallOverlay) elements.incomingCallOverlay.style.display = 'none';
    showToast("Call ended", "info");
};

const updatePipButtonVisibility = () => {
    if (!elements.callPipBtn) return;
    const isSupported = !!document.pictureInPictureEnabled;
    const shouldShow = currentCallType === 'video' && isSupported;
    elements.callPipBtn.style.display = shouldShow ? 'flex' : 'none';
};

const togglePiP = async () => {
    const video = elements.remoteVideo;
    if (!video || !document.pictureInPictureEnabled) {
        showToast("Picture-in-Picture not supported", "warning");
        return;
    }

    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            if (video.readyState >= 2) {
                await video.requestPictureInPicture();
            } else {
                showToast("Video stream not ready", "warning");
            }
        }
    } catch (err) {
        console.error("PiP Error:", err);
        showToast("Failed to enter Picture-in-Picture", "error");
    }
};

const updateFlashButtonVisibility = () => {
    if (!elements.callFlashBtn) return;
    const shouldShow = currentCallType === 'video' && currentFacingMode === 'environment';
    elements.callFlashBtn.style.display = shouldShow ? 'flex' : 'none';
    if (currentFacingMode !== 'environment') {
        isFlashOn = false;
        elements.callFlashBtn.classList.remove('active');
    }
};

const toggleFlash = async () => {
    if (currentCallType !== 'video' || !localStream || currentFacingMode !== 'environment') return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
            isFlashOn = !isFlashOn;
            await videoTrack.applyConstraints({
                advanced: [{ torch: isFlashOn }]
            });
        } else {
            showToast("Flash/Torch not supported on this device camera", "warning");
            isFlashOn = false;
        }

        if (elements.callFlashBtn) {
            elements.callFlashBtn.classList.toggle('active', isFlashOn);
        }
        showToast(`Flash ${isFlashOn ? 'ON' : 'OFF'}`, "info");
    } catch (err) {
        console.error("Error toggling flash:", err);
        showToast("Failed to toggle flash", "error");
    }
};

const toggleSpeaker = async () => {
    try {
        isSpeakerOn = !isSpeakerOn;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');

        let targetId = "";
        if (isSpeakerOn) {
            const speaker = outputs.find(d => d.label.toLowerCase().includes('speaker')) || outputs[1];
            targetId = speaker ? speaker.deviceId : "";
        } else {
            targetId = outputs[0] ? outputs[0].deviceId : "";
        }

        const allAudioElements = [];
        if (elements.remoteVideo) allAudioElements.push(elements.remoteVideo);
        if (elements.remoteAudio) allAudioElements.push(elements.remoteAudio);
        document.querySelectorAll('audio[id^="remote-audio-"]').forEach(el => allAudioElements.push(el));
        document.querySelectorAll('video[id^="remote-video-"]').forEach(el => allAudioElements.push(el));

        for (const el of allAudioElements) {
            await el.setSinkId(targetId);
        }

        if (elements.callSpeakerBtn) elements.callSpeakerBtn.classList.toggle('active', isSpeakerOn);
        showToast(isSpeakerOn ? "Speaker ON" : "Handset Mode", "info");
    } catch (err) {
        console.error("Speaker toggle error:", err);
        showToast("Error switching audio output", "error");
    }
};

const toggleAudioSourceMenu = async (e) => {
    e.stopPropagation();
    const menu = elements.audioSourceMenu;
    if (!menu) return;

    if (menu.style.display === 'flex') {
        menu.style.display = 'none';
        elements.callAudioSourceBtn?.classList.remove('active');
        return;
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        menu.innerHTML = audioInputs.map(device => `
            <div class="audio-source-item" data-id="${device.deviceId}">
                <i class="fa-solid fa-microphone"></i>
                <span>${device.label || `Microphone ${menu.children.length + 1}`}</span>
            </div>
        `).join('');

        menu.style.display = 'flex';
        elements.callAudioSourceBtn?.classList.add('active');

        // Position menu above button
        const btnRect = elements.callAudioSourceBtn.getBoundingClientRect();
        menu.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
        menu.style.left = `${btnRect.left}px`;

        menu.querySelectorAll('.audio-source-item').forEach(item => {
            item.onclick = async () => {
                const deviceId = item.getAttribute('data-id');
                await switchMicrophone(deviceId);
                menu.style.display = 'none';
                elements.callAudioSourceBtn?.classList.remove('active');
            };
        });
    } catch (err) {
        console.error("Error populating audio sources:", err);
        showToast("Failed to list microphones", "error");
    }
};

const switchMicrophone = async (deviceId) => {
    if (!localStream) return;
    try {
        const oldTrack = localStream.getAudioTracks()[0];
        const isMuted = oldTrack ? !oldTrack.enabled : false;

        const constraints = { audio: { deviceId: { exact: deviceId } } };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = newStream.getAudioTracks()[0];
        newTrack.enabled = !isMuted;

        if (oldTrack) {
            oldTrack.stop();
            localStream.removeTrack(oldTrack);
        }
        localStream.addTrack(newTrack);

        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) sender.replaceTrack(newTrack);
        });
        showToast("Microphone switched", "info");
    } catch (err) {
        console.error("Error switching microphone:", err);
        showToast("Failed to switch microphone", "error");
    }
};

const startScreenSharing = async () => {
    if (isScreenSharing || peerConnections.size === 0) return;

    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
            stopScreenSharing();
        };

        peerConnections.forEach((pc, targetUid) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack).catch(err => {
                    console.error(`Error replacing track for screen share with peer ${targetUid}:`, err);
                });
            }
        });

        if (elements.localVideo) {
            elements.localVideo.srcObject = screenStream;
            elements.localVideo.classList.remove('muted-blur');
            elements.localVideo.style.backgroundImage = 'none';
        }

        isScreenSharing = true;
        if (elements.callScreenShareBtn) {
            elements.callScreenShareBtn.classList.add('active');
            elements.callScreenShareBtn.title = "Stop Screen Share";
        }
        showToast("Screen sharing started", "info");
    } catch (err) {
        console.error("Error starting screen share:", err);
        showToast("Could not share screen", "error");
        isScreenSharing = false;
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
    }
};

const stopScreenSharing = async () => {
    if (!isScreenSharing) return;

    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    isScreenSharing = false;

    if (elements.callScreenShareBtn) {
        elements.callScreenShareBtn.classList.remove('active');
        elements.callScreenShareBtn.title = "Share Screen";
    }

    try {
        if (localStream) {
            let videoTrack = localStream.getVideoTracks()[0];
            if (!videoTrack || videoTrack.readyState === 'ended') {
                const constraints = {
                    video: { facingMode: currentFacingMode }
                };
                const newCamStream = await navigator.mediaDevices.getUserMedia(constraints);
                const newCamTrack = newCamStream.getVideoTracks()[0];
                if (videoTrack) {
                    localStream.removeTrack(videoTrack);
                }
                localStream.addTrack(newCamTrack);
                videoTrack = newCamTrack;
            }

            videoTrack.enabled = !isCameraMuted;

            peerConnections.forEach((pc, targetUid) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack).catch(err => {
                        console.error(`Error restoring camera track for peer ${targetUid}:`, err);
                    });
                }
            });

            if (elements.localVideo) {
                elements.localVideo.srcObject = localStream;
                elements.localVideo.classList.toggle('muted-blur', isCameraMuted);
                if (isCameraMuted) {
                    const avatar = elements.headerUserAvatar?.src || '';
                    elements.localVideo.style.backgroundImage = `url(${avatar})`;
                } else {
                    elements.localVideo.style.backgroundImage = 'none';
                }
            }
        }
        showToast("Screen sharing stopped", "info");
    } catch (err) {
        console.error("Error restoring camera after screen share:", err);
        showToast("Failed to restore camera feed", "error");
    }
};

const toggleScreenSharing = () => {
    if (isScreenSharing) {
        stopScreenSharing();
    } else {
        startScreenSharing();
    }
};

const toggleCameraMute = async () => {
    if (currentCallType !== 'video' || !localStream) return;

    let videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) {
        // Request camera track access
        try {
            const constraints = {
                video: { facingMode: currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 } }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                isCameraMuted = false;

                // Stop the old localStream so retryCallHandshake gets a fresh one containing video
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                    localStream = null;
                }

                if (elements.callCamMuteBtn) {
                    elements.callCamMuteBtn.classList.remove('active');
                    elements.callCamMuteBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
                }

                await retryCallHandshake();
                return;
            }
        } catch (err) {
            console.error("Error accessing camera on switch:", err);
            showToast("Could not access camera", "error");
            return;
        }
    }

    isCameraMuted = !isCameraMuted;
    videoTrack.enabled = !isCameraMuted;

    if (elements.localVideo) {
        elements.localVideo.classList.toggle('muted-blur', isCameraMuted);
        if (isCameraMuted) {
            const avatar = elements.headerUserAvatar?.src || '';
            elements.localVideo.style.backgroundImage = `url(${avatar})`;
        } else {
            elements.localVideo.style.backgroundImage = '';
        }
    }

    if (elements.callCamMuteBtn) {
        elements.callCamMuteBtn.classList.toggle('active', isCameraMuted);
        elements.callCamMuteBtn.innerHTML = isCameraMuted
            ? '<i class="fa-solid fa-video-slash"></i>'
            : '<i class="fa-solid fa-video"></i>';
    }
    showToast(isCameraMuted ? "Camera disabled" : "Camera enabled", "info");

    callParticipants.forEach(pUid => {
        sendCallSignal(pUid, auth.currentUser.uid, {
            status: isCameraMuted ? 'camera-muted' : 'camera-unmuted',
            from: auth.currentUser.uid
        });
    });
};

const flipCamera = async () => {
    if (currentCallType !== 'video' || !localStream) return;

    const icon = elements.callFlipCameraBtn?.querySelector('i');
    icon?.classList.add('flipping');
    setTimeout(() => icon?.classList.remove('flipping'), 400);

    const oldVideoTrack = localStream.getVideoTracks()[0];
    const oldFacingMode = currentFacingMode;

    // Toggle facing mode
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    updateFlashButtonVisibility();

    // Stop old track FIRST to release hardware lock on mobile devices
    if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStream.removeTrack(oldVideoTrack);
    }

    try {
        const constraints = {
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) {
            throw new Error("No video track found in stream");
        }

        newVideoTrack.enabled = !isCameraMuted;
        localStream.addTrack(newVideoTrack);

        if (elements.localVideo) {
            elements.localVideo.srcObject = localStream;
            elements.localVideo.play().catch(e => console.warn("localVideo play error after flip:", e));
        }

        const replacePromises = [];
        peerConnections.forEach((pc, targetUid) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                replacePromises.push(
                    sender.replaceTrack(newVideoTrack).catch(err => {
                        console.error(`Error replacing track for peer ${targetUid}:`, err);
                    })
                );
            }
        });
        await Promise.all(replacePromises);

        showToast(`Switched to ${currentFacingMode} camera`, "info");
    } catch (err) {
        console.error("Error flipping camera, attempting recovery:", err);
        showToast("Failed to flip camera", "error");

        // Restore previous state
        currentFacingMode = oldFacingMode;
        updateFlashButtonVisibility();

        try {
            const recoveryConstraints = {
                video: {
                    facingMode: { ideal: currentFacingMode },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            const recoveryStream = await navigator.mediaDevices.getUserMedia(recoveryConstraints);
            const recoveredTrack = recoveryStream.getVideoTracks()[0];
            recoveredTrack.enabled = !isCameraMuted;
            localStream.addTrack(recoveredTrack);

            if (elements.localVideo) {
                elements.localVideo.srcObject = localStream;
                elements.localVideo.play().catch(e => console.warn("localVideo play error after recovery:", e));
            }

            peerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(recoveredTrack).catch(e => console.error("Error replacing track on recovery:", e));
            });
        } catch (recoveryErr) {
            console.error("Critical: Camera recovery failed:", recoveryErr);
            showToast("Camera access lost", "error");
        }
    }
};

const switchCallToVideo = async () => {
    if (peerConnections.size === 0 || currentCallType === 'video') return;

    playSwitchSound(); // Play switch beep locally
    currentCallType = 'video';
    if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'none';
    if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'flex';
    updatePipButtonVisibility();
    if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'flex';
    updateFlashButtonVisibility();

    elements.callOverlay?.classList.add('video-mode');
    if (elements.videoContainer) elements.videoContainer.style.display = 'block';

    showToast("Switching to video...", "info");
    await retryCallHandshake();
};

const retryCallHandshake = async () => {
    if (peerConnections.size === 0) return;

    if (elements.callRetryBtn) elements.callRetryBtn.style.display = 'none';
    if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'none';
    if (elements.callStatus) elements.callStatus.textContent = "Retrying...";

    if (currentCallType === 'video') {
        elements.callOverlay?.classList.add('video-mode');
        if (elements.videoContainer) elements.videoContainer.style.display = 'block';
    }

    // Unsubscribe from active ICE candidate listeners to prevent closed state execution warnings
    iceSubscribes.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
    });
    iceSubscribes.clear();

    peerConnections.forEach((pc, targetUid) => {
        pc.close();
        // Keep remote media elements in the DOM to avoid triggering browser autoplay blocks on recreation
        // cleanupRemoteMedia(targetUid);
    });
    peerConnections.clear();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const targets = Array.from(callParticipants);
    for (const targetUid of targets) {
        await setupWebRTC(targetUid, isLocalCaller, currentCallType);

        const pc = peerConnections.get(targetUid);
        if (pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendCallSignal(targetUid, auth.currentUser.uid, {
                from: auth.currentUser.uid,
                fromName: elements.headerUserName?.textContent || auth.currentUser.displayName || 'Contact',
                callType: currentCallType,
                offer: offer.sdp,
                status: 'calling',
                isSwitch: true
            });
        }
    }
    showToast("Attempting to reconnect...", "info");
};

const startCallTimer = () => {
    stopCallTimer();
    callStartTime = Date.now();
    callDurationInterval = setInterval(() => {
        if (isReconnecting) {
            if (elements.callStatus) elements.callStatus.textContent = "Reconnecting...";
            if (elements.minimizedCallTimer) elements.minimizedCallTimer.textContent = "Reconnect...";
            return;
        }

        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        const timeStr = `${mins}:${secs}`;
        if (elements.callStatus) elements.callStatus.textContent = timeStr;
        if (elements.minimizedCallTimer) elements.minimizedCallTimer.textContent = timeStr;
    }, 1000);
};

const stopCallTimer = () => {
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
    if (elements.minimizedCallTimer) elements.minimizedCallTimer.textContent = "00:00";
};

const updateCallUI = () => {
    if (!elements.callOverlay) return;
    const user = auth.currentUser;
    if (!user) return;

    const names = [];
    if (currentCallPartnerUid && allUsersCache[currentCallPartnerUid]) {
        names.push(allUsersCache[currentCallPartnerUid].fullname);
    }

    callParticipants.forEach(uid => {
        if (uid !== currentCallPartnerUid && allUsersCache[uid]) {
            names.push(allUsersCache[uid].fullname);
        }
    });

    if (names.length > 0) {
        if (names.length <= 2) {
            elements.callOverlayName.textContent = names.join(', ');
        } else {
            elements.callOverlayName.textContent = `${names[0]}, ${names[1]} (+${names.length - 2} others)`;
        }
    }
};

const showAddParticipantModal = () => {
    let modal = document.getElementById('add-participant-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-participant-modal';
        modal.className = 'modal add-participant-modal';
        modal.style.display = 'none';

        const style = document.createElement('style');
        style.innerHTML = `
            .add-participant-modal {
                position: fixed;
                inset: 0;
                width: 100%;
                height: 100dvh;
                min-height: 100svh;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(10px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            .add-participant-modal.show {
                opacity: 1;
                pointer-events: auto;
            }
            .add-participant-content {
                background: var(--surface, #1e293b);
                color: var(--text, #f8fafc);
                width: min(90vw, 400px);
                max-width: 400px;
                max-height: calc(100dvh - 32px);
                overflow-y: auto;
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
                transform: scale(0.9);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .add-participant-modal.show .add-participant-content {
                transform: scale(1);
            }
            .add-participant-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            .add-participant-header h3 {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
            }
            .add-participant-close {
                background: none;
                border: none;
                color: var(--text-muted, #94a3b8);
                font-size: 1.5rem;
                cursor: pointer;
                transition: color 0.2s;
            }
            .add-participant-close:hover {
                color: #ef4444;
            }
            .add-participant-list {
                max-height: 280px;
                overflow-y: auto;
                margin-bottom: 10px;
            }
            .add-participant-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                border-radius: 8px;
                transition: background 0.2s;
                margin-bottom: 8px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .add-participant-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            .add-participant-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .add-participant-avatar {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: var(--brand, #0284c7);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 1rem;
                object-fit: cover;
                color: #ffffff;
            }
            .add-participant-name {
                font-weight: 500;
                font-size: 0.95rem;
            }
            .add-participant-status {
                font-size: 0.75rem;
                color: #10b981;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .add-participant-invite-btn {
                background: var(--brand, #0284c7);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.85rem;
                font-weight: 500;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.1s;
            }
            .add-participant-invite-btn:hover {
                opacity: 0.9;
            }
            .add-participant-invite-btn:active {
                transform: scale(0.95);
            }
            .add-participant-invite-btn:disabled {
                background: #475569;
                color: #94a3b8;
                cursor: not-allowed;
            }
            .add-participant-empty {
                text-align: center;
                color: var(--text-muted, #94a3b8);
                padding: 20px;
                font-size: 0.9rem;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    const user = auth.currentUser;
    if (!user) return;

    let itemsHtml = '';
    const onlineFriends = Object.keys(moduleFriendsList).filter(uid => {
        const profile = allUsersCache[uid];
        return profile &&
            profile.online &&
            uid !== user.uid &&
            !peerConnections.has(uid) &&
            !callParticipants.has(uid);
    });

    if (onlineFriends.length === 0) {
        itemsHtml = `<div class="add-participant-empty">No online contacts available to invite.</div>`;
    } else {
        onlineFriends.forEach(uid => {
            const profile = allUsersCache[uid];
            const name = profile.fullname || 'Unknown Contact';
            const initials = name.charAt(0).toUpperCase();
            const avatarHtml = profile.profilePhoto
                ? `<img src="${profile.profilePhoto}" class="add-participant-avatar">`
                : `<div class="add-participant-avatar">${initials}</div>`;

            itemsHtml += `
                <div class="add-participant-item">
                    <div class="add-participant-info">
                        ${avatarHtml}
                        <div>
                            <div class="add-participant-name">${name}</div>
                            <div class="add-participant-status"><span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Online</div>
                        </div>
                    </div>
                    <button class="add-participant-invite-btn" data-uid="${uid}">Invite</button>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="add-participant-content">
            <div class="add-participant-header">
                <h3>Add Participant</h3>
                <button class="add-participant-close">&times;</button>
            </div>
            <div class="add-participant-list">
                ${itemsHtml}
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('show');

    const closeBtn = modal.querySelector('.add-participant-close');
    closeBtn.onclick = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    const inviteBtns = modal.querySelectorAll('.add-participant-invite-btn');
    inviteBtns.forEach(btn => {
        btn.onclick = async () => {
            const targetUid = btn.getAttribute('data-uid');
            btn.disabled = true;
            btn.textContent = 'Invited';
            await inviteParticipantToCall(targetUid);
            showToast(`Invitation sent to ${allUsersCache[targetUid]?.fullname || 'contact'}`);
            setTimeout(() => {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            }, 500);
        };
    });
};

const inviteParticipantToCall = async (targetUid) => {
    const user = auth.currentUser;
    if (!user || !targetUid) return;

    callParticipants.add(targetUid);
    updateCallUI();

    const currentParticipants = [user.uid, ...Array.from(peerConnections.keys())];
    const callerName = elements.headerUserName?.textContent || user.displayName || 'Contact';

    await sendCallSignal(targetUid, user.uid, {
        status: 'group-invite',
        from: user.uid,
        fromName: callerName,
        callType: currentCallType,
        participants: currentParticipants
    });

    const notifyPromises = Array.from(peerConnections.keys()).map(pUid => {
        return sendCallSignal(pUid, user.uid, {
            status: 'add-participant',
            participantUid: targetUid,
            from: user.uid
        });
    });
    if (notifyPromises.length > 0) {
        await Promise.all(notifyPromises);
    }
};

const handleIncomingCallSignal = async (signals) => {
    if (!signals || Object.keys(signals).length === 0) {
        if (elements.waitingCallBadge) elements.waitingCallBadge.style.display = 'none';
        stopWaitingBeeps();
        waitingCallSignal = null;
        stopRingAudio();
        if (elements.incomingCallOverlay) {
            elements.incomingCallOverlay.style.display = 'none';
        }
        currentCallPartnerUid = null;
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    for (const [senderUid, signal] of Object.entries(signals)) {
        if (senderUid === 'candidates') continue;
        await handleSingleSignal(senderUid, signal);
    }
};

const handleSingleSignal = async (senderUid, signal) => {
    const user = auth.currentUser;
    if (!user) return;
    const incomingCallType = signal.callType || 'voice';

    if (signal.status === 'calling') {
        const isCurrentlyInCall = peerConnections.size > 0;

        if (isCurrentlyInCall) {
            console.log(`Auto-accepting group connection from ${senderUid}`);

            // Detect if remote peer has switched to video call
            if (signal.callType === 'video' && currentCallType !== 'voice') {
                // If we are already in video call, just keep currentCallType as video
            } else if (signal.callType === 'video' && currentCallType === 'voice') {
                playSwitchSound();
                // Note: We do NOT set currentCallType = 'video' here to respect privacy.
                // The local user's camera remains off until they manually click "Switch to video".

                // Update UI layout to show remote video call overlay
                elements.callOverlay?.classList.add('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'block';

                // Hide camera flip/mute controls since local camera is off
                if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
                if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
                if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';
                updatePipButtonVisibility();
                updateFlashButtonVisibility();

                // Keep video switch button visible so local user can switch to video
                if (elements.callVideoBtn) elements.callVideoBtn.style.display = 'flex';
            }

            const pc = await setupWebRTC(senderUid, false, currentCallType);
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.offer }));
            processCandidatesQueue(senderUid);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendCallSignal(senderUid, user.uid, {
                status: 'accepted',
                answer: answer.sdp,
                from: user.uid
            });

            callParticipants.add(senderUid);
            updateCallUI();
            return;
        }

        // If we are not in an active call and this is a call type switch/renegotiation, ignore it
        if (signal.isSwitch) {
            console.log("Ignoring call type switch signal on idle linked device.");
            return;
        }

        currentCallPartnerUid = senderUid;
        playRingAudio('incoming');

        callLoggingSession = {
            contactUid: senderUid,
            type: 'incoming',
            callType: incomingCallType
        };

        elements.incomingName.textContent = signal.fromName;
        elements.incomingCallOverlay.querySelector('p').textContent = `Incoming ${incomingCallType} call`;
        elements.incomingCallOverlay.style.display = 'flex';
        if (elements.incomingAvatar) {
            elements.incomingAvatar.innerHTML = (signal.fromName || 'U').charAt(0).toUpperCase();
        }

        // Send 'ringing' feedback status back to the caller
        await sendCallSignal(senderUid, user.uid, {
            status: 'ringing',
            from: user.uid
        });

        const onAccept = async () => {
            currentCallType = incomingCallType;
            isLocalCaller = false;
            currentCallPartnerUid = senderUid;
            stopRingAudio();
            elements.incomingCallOverlay.style.display = 'none';
            elements.callOverlay.style.display = 'flex';
            elements.callOverlayName.textContent = signal.fromName;
            elements.callStatus.textContent = "Connecting...";
            if (currentCallType === 'video') {
                showVideoCallLayout();
            } else {
                elements.callOverlay?.classList.remove('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'none';
                if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
                if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
                if (elements.callPipBtn) elements.callPipBtn.style.display = 'none';
                if (elements.callFlashBtn) elements.callFlashBtn.style.display = 'none';
                if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';
            }

            if (elements.minimizedCallName) elements.minimizedCallName.textContent = signal.fromName;

            const pc = await setupWebRTC(senderUid, false, currentCallType);
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.offer }));
            processCandidatesQueue(senderUid);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendCallSignal(senderUid, user.uid, {
                status: 'accepted',
                answer: answer.sdp,
                from: user.uid
            });

            // Inform other linked devices that the call has been accepted
            await sendCallSignal(user.uid, senderUid, {
                status: 'accepted',
                callType: incomingCallType,
                fromName: signal.fromName,
                from: senderUid
            });

            callParticipants.add(senderUid);
            startCallTimer();
            elements.callStatus.textContent = "Connected";
            if (currentCallType === 'voice' && elements.callVideoBtn) elements.callVideoBtn.style.display = 'flex';
            updateCallUI();
        };

        const onReject = async () => {
            try {
                await saveCallLog(user.uid, { ...callLoggingSession, status: 'declined' });
            } catch (err) {
                console.warn("Failed to save call log in onReject:", err);
            }
            callLoggingSession = null;
            try {
                await sendCallSignal(senderUid, user.uid, { status: 'rejected', from: user.uid });
            } catch (err) {
                console.warn("Failed to send reject signal:", err);
            }
            endCall();
        };

        elements.callAcceptBtn.onclick = onAccept;
        elements.callRejectBtn.onclick = onReject;

    } else if (signal.status === 'group-invite') {
        currentCallPartnerUid = senderUid;
        playRingAudio('incoming');

        callLoggingSession = {
            contactUid: senderUid,
            type: 'incoming',
            callType: incomingCallType
        };

        const groupPartners = signal.participants || [];
        window._groupCallParticipants = groupPartners;

        const otherNames = groupPartners
            .filter(uid => uid !== user.uid && uid !== senderUid)
            .map(uid => allUsersCache[uid]?.fullname || 'Contact')
            .join(', ');

        const inviteText = otherNames ? `Group call with ${signal.fromName} and ${otherNames}` : `Group call with ${signal.fromName}`;

        elements.incomingName.textContent = signal.fromName;
        elements.incomingCallOverlay.querySelector('p').textContent = inviteText;
        elements.incomingCallOverlay.style.display = 'flex';
        if (elements.incomingAvatar) {
            elements.incomingAvatar.innerHTML = (signal.fromName || 'U').charAt(0).toUpperCase();
        }

        const onAccept = async () => {
            currentCallType = incomingCallType;
            isLocalCaller = false;
            stopRingAudio();
            elements.incomingCallOverlay.style.display = 'none';
            elements.callOverlay.style.display = 'flex';
            elements.callOverlayName.textContent = signal.fromName;
            elements.callStatus.textContent = "Connecting...";

            if (currentCallType === 'video') {
                elements.callOverlay?.classList.add('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'block';
                if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'flex';
                if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'flex';
                if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'flex';
                updatePipButtonVisibility();
                updateFlashButtonVisibility();
            } else {
                elements.callOverlay?.classList.remove('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'none';
                if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
                if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
                if (elements.callPipBtn) elements.callPipBtn.style.display = 'none';
                if (elements.callFlashBtn) elements.callFlashBtn.style.display = 'none';
                if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';
            }

            if (elements.minimizedCallName) elements.minimizedCallName.textContent = signal.fromName;

            const participantsToConnect = window._groupCallParticipants || [];

            for (const pUid of participantsToConnect) {
                if (pUid === user.uid) continue;

                callParticipants.add(pUid);

                const pc = await setupWebRTC(pUid, true, currentCallType);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                await sendCallSignal(pUid, user.uid, {
                    status: 'calling',
                    from: user.uid,
                    fromName: user.displayName || 'Contact',
                    callType: currentCallType,
                    offer: offer.sdp,
                    isGroup: true
                });
            }

            // Inform other linked devices that the group call has been accepted
            await sendCallSignal(user.uid, senderUid, {
                status: 'accepted',
                callType: incomingCallType,
                fromName: signal.fromName,
                from: senderUid
            });

            startCallTimer();
            elements.callStatus.textContent = "Connected";
            if (currentCallType === 'video') {
                showVideoCallLayout();
            } else if (currentCallType === 'voice' && elements.callVideoBtn) {
                elements.callVideoBtn.style.display = 'flex';
            }
            updateCallUI();
        };

        const onReject = async () => {
            try {
                await saveCallLog(user.uid, { ...callLoggingSession, status: 'declined' });
            } catch (err) {
                console.warn("Failed to save call log in group onReject:", err);
            }
            callLoggingSession = null;
            try {
                await sendCallSignal(senderUid, user.uid, { status: 'rejected', from: user.uid });
            } catch (err) {
                console.warn("Failed to send reject signal in group onReject:", err);
            }
            endCall();
        };

        elements.callAcceptBtn.onclick = onAccept;
        elements.callRejectBtn.onclick = onReject;

    } else if (signal.status === 'add-participant') {
        if (signal.participantUid && signal.participantUid !== user.uid) {
            callParticipants.add(signal.participantUid);
            updateCallUI();
        }
    } else if (signal.status === 'accepted' && signal.answer) {
        const pc = peerConnections.get(senderUid);
        if (pc && pc.signalingState === 'have-local-offer' && !isSettingRemoteDescription) {
            clearTimeout(callTimeoutId);
            stopRingAudio();
            if (elements.callOverlayPulse) elements.callOverlayPulse.style.display = 'none';
            try {
                isSettingRemoteDescription = true;
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.answer }));
                processCandidatesQueue(senderUid);
                elements.callStatus.textContent = "Connected";
                if (!callStartTime) startCallTimer();
                if (currentCallType === 'video') {
                    showVideoCallLayout();
                } else if (currentCallType === 'voice' && elements.callVideoBtn) {
                    elements.callVideoBtn.style.display = 'flex';
                }
            } catch (err) {
                console.error(`Error setting remote answer description for ${senderUid}:`, err);
            } finally {
                isSettingRemoteDescription = false;
            }
        }
    } else if (signal.status === 'accepted') {
        // If we are currently ringing for this call on another device, stop ringing and hide overlay
        if (currentCallPartnerUid === senderUid) {
            console.log(`Call accepted on another device. Stopping ringtone.`);
            stopRingAudio();
            if (elements.incomingCallOverlay) elements.incomingCallOverlay.style.display = 'none';
            if (elements.waitingCallBadge) elements.waitingCallBadge.style.display = 'none';
            stopWaitingBeeps();
            waitingCallSignal = null;
            currentCallPartnerUid = null;
            showToast("Call answered on another device", "info");
        }
    } else if (signal.status === 'camera-muted') {
        if (elements.remoteMuteOverlay) elements.remoteMuteOverlay.style.display = 'flex';
    } else if (signal.status === 'camera-unmuted') {
        if (elements.remoteMuteOverlay) elements.remoteMuteOverlay.style.display = 'none';
    } else if (signal.status === 'busy') {
        clearTimeout(callTimeoutId);
        try {
            await saveCallLog(user.uid, { ...callLoggingSession, status: 'busy' });
        } catch (err) {
            console.warn("Failed to save busy call log:", err);
        }
        callLoggingSession = null;
        showToast(`${allUsersCache[senderUid]?.fullname || 'Contact'} is busy`, "warning");
        closePeerConnection(senderUid);
        updateCallUI();
    } else if (signal.status === 'ringing') {
        elements.callStatus.textContent = "Ringing...";
    } else if (signal.status === 'rejected' || signal.status === 'ended') {
        clearTimeout(callTimeoutId);
        if (signal.status === 'rejected') {
            try {
                await saveCallLog(user.uid, { ...callLoggingSession, status: 'declined' });
            } catch (err) {
                console.warn("Failed to save rejected call log:", err);
            }
            callLoggingSession = null;
        }
        closePeerConnection(senderUid);
        updateCallUI();
    }
};

const toggleCallMinimize = (minimize) => {
    if (currentCallType === 'video') {
        elements.callOverlay?.classList.toggle('minimized', minimize);
        // Reset custom positioning when expanding
        if (!minimize && elements.callOverlay) {
            elements.callOverlay.style.left = '';
            elements.callOverlay.style.top = '';
            elements.callOverlay.style.right = '';
            elements.callOverlay.style.bottom = '';
            elements.callOverlay.style.width = '';
            elements.callOverlay.style.height = '';
            // Also reset local video preview position
            resetLocalVideoPosition();
        }
        if (elements.minimizedCallBar) elements.minimizedCallBar.style.display = 'none';
    } else {
        if (elements.callOverlay) elements.callOverlay.style.display = minimize ? 'none' : 'flex';
        if (elements.minimizedCallBar) elements.minimizedCallBar.style.display = minimize ? 'flex' : 'none';
    }
};

const initCallHistory = (user) => {
    if (!user) return;

    // 1. Static Listeners: Attach only once per lifecycle
    if (elements.callHistoryList && !elements.callHistoryList.dataset.redialBound) {
        elements.callHistoryList.addEventListener('click', (e) => {
            const btn = e.target.closest('.redial-btn');
            if (btn) {
                e.stopPropagation();
                activeChatUid = btn.dataset.uid;
                startCall(btn.dataset.type);
            }
        });
        elements.callHistoryList.dataset.redialBound = "true";
    }

    if (elements.clearCallHistoryBtn && !elements.clearCallHistoryBtn.dataset.bound) {
        elements.clearCallHistoryBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear your call history? This cannot be undone.")) {
                try {
                    await clearCallHistory(user.uid);
                    showToast("Call history cleared", "info");
                } catch (error) {
                    showToast("Failed to clear history", "error");
                }
            }
        });
        elements.clearCallHistoryBtn.dataset.bound = "true";
    }

    // 2. Data Listeners: Fetch once on login
    getAllUsers().then(allUsers => {
        subscribeToCallHistory(user.uid, (logs) => {
            const container = elements.callHistoryList;
            if (!container) return;

            const logArray = Object.values(logs).sort((a, b) => b.timestamp - a.timestamp);

            if (elements.clearCallHistoryBtn) elements.clearCallHistoryBtn.style.display = logArray.length > 0 ? 'block' : 'none';
            if (logArray.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted);">No call history yet</div>'; return; }

            container.innerHTML = '';
            logArray.forEach(log => {
                const contact = allUsers[log.contactUid] || { fullname: 'Unknown', profilePhoto: '' };
                const date = new Date(log.timestamp), timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                let icon = '', statusText = '', colorClass = '', callTypeIcon = log.callType === 'video' ? 'fa-video' : 'fa-phone';
                if (log.type === 'outgoing') { icon = `<i class="fa-solid ${callTypeIcon} call-type-icon outgoing"></i>`; statusText = log.status === 'completed' ? `Outgoing (${formatDuration(log.duration)})` : (log.status === 'missed' || log.status === 'cancelled' ? 'Canceled' : (log.status === 'declined' ? 'Declined' : log.status.charAt(0).toUpperCase() + log.status.slice(1))); colorClass = log.status === 'missed' ? 'missed' : ''; }
                else { if (log.status === 'missed' || log.status === 'busy') { icon = `<i class="fa-solid ${log.callType === 'video' ? 'fa-video-slash' : 'fa-phone-slash'} call-type-icon missed"></i>`; statusText = log.status === 'missed' ? 'Missed' : 'Missed (Busy)'; colorClass = 'missed'; } else { icon = `<i class="fa-solid ${callTypeIcon} call-type-icon incoming"></i>`; statusText = log.status === 'completed' ? `Incoming (${formatDuration(log.duration)})` : (log.status === 'declined' ? 'Declined' : 'Incoming'); } }
                const avatarHtml = contact.profilePhoto ? `<img src="${contact.profilePhoto}" class="avatar-img">` : (contact.fullname || 'U').charAt(0).toUpperCase();
                const html = `<div class="conversation-item call-history-item" data-uid="${log.contactUid}"><div class="conversation-avatar">${avatarHtml}</div><div class="conversation-info"><div class="conversation-header"><div class="conversation-name ${colorClass}" data-name="${contact.fullname}">${contact.fullname}</div><div class="conversation-time">${dateStr}, ${timeStr}</div></div><div class="conversation-preview">${icon} ${statusText}</div></div><button class="redial-btn" data-uid="${log.contactUid}" data-type="${log.callType}" title="Redial"><i class="fa-solid ${log.callType === 'video' ? 'fa-video' : 'fa-phone'}"></i></button></div>`;
                container.insertAdjacentHTML('beforeend', html);
            });
            const searchInput = elements.callsSidebar?.querySelector('.search-input');
            if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));
        });
    });
};

const toggleCallMute = () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;

        if (elements.callMuteBtn) {
            elements.callMuteBtn.classList.toggle('active', isMuted);
            elements.callMuteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        }
        if (elements.minimizedMuteBtn) {
            elements.minimizedMuteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        }
        if (elements.pipMuteIndicator) {
            elements.pipMuteIndicator.classList.toggle('active', isMuted);
        }
        showToast(isMuted ? "Microphone muted" : "Microphone unmuted", "info");
    }
};

const toggleInputButtons = () => {
    const hasText = elements.messageInput?.value.trim().length > 0;
    if (elements.sendBtn) elements.sendBtn.style.display = hasText ? 'grid' : 'none';
    if (elements.recordBtn) elements.recordBtn.style.display = hasText ? 'none' : 'grid';
};

const hideEditPreview = () => {
    editingMessageId = null;
    if (elements.editPreview) elements.editPreview.style.display = 'none';
    if (elements.messageInput) {
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
    }
    toggleInputButtons();
};

// Initialize a WhatsApp-style custom audio player
const initCustomAudioPlayer = (messageId, audioUrl) => {
    const groupEl = document.getElementById(messageId);
    if (!groupEl) return;

    const playerEl = groupEl.querySelector('.wa-audio-player');
    if (!playerEl) return;

    const playBtn = playerEl.querySelector('.wa-play-btn');
    const slider = playerEl.querySelector('.wa-progress-slider');
    const durationText = playerEl.querySelector('.wa-duration');
    const speedBtn = playerEl.querySelector('.wa-speed-btn');

    const audio = new Audio(audioUrl);
    let speed = 1.0;
    let previewAudio = null; // Local speed cache

    // Set meta duration once loaded
    audio.addEventListener('loadedmetadata', () => {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60);
        durationText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    // Fallback if metadata is already loaded
    if (audio.duration && !isNaN(audio.duration)) {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60);
        durationText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Play/Pause interaction
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent message bubble actions

        // Stop all other audio players in chat first
        document.querySelectorAll('.wa-audio-player').forEach(otherPlayer => {
            if (otherPlayer !== playerEl && otherPlayer.audioInstance && !otherPlayer.audioInstance.paused) {
                otherPlayer.audioInstance.pause();
                const otherPlayBtn = otherPlayer.querySelector('.wa-play-btn');
                if (otherPlayBtn) otherPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });

        if (audio.paused) {
            audio.play().catch(err => console.error("Audio playback blocked:", err));
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    });

    // Update progress slider
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration || isNaN(audio.duration)) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        slider.value = pct;

        // Update timer
        const currentMins = Math.floor(audio.currentTime / 60);
        const currentSecs = Math.floor(audio.currentTime % 60);

        const totalMins = Math.floor(audio.duration / 60);
        const totalSecs = Math.floor(audio.duration % 60);

        durationText.textContent = `${currentMins}:${currentSecs.toString().padStart(2, '0')} / ${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
    });

    // Drag slider to seek
    slider.addEventListener('input', () => {
        if (!audio.duration || isNaN(audio.duration)) return;
        const time = (slider.value / 100) * audio.duration;
        audio.currentTime = time;
    });

    // Reset play button on end
    audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        slider.value = 0;
        const totalMins = Math.floor(audio.duration / 60);
        const totalSecs = Math.floor(audio.duration % 60);
        durationText.textContent = `${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
    });

    // Speed rate control
    speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (speed === 1.0) {
            speed = 1.5;
        } else if (speed === 1.5) {
            speed = 2.0;
        } else {
            speed = 1.0;
        }
        audio.playbackRate = speed;
        speedBtn.textContent = `${speed}x`;
    });

    // Attach audio instance to element for lookup
    playerEl.audioInstance = audio;
};

const getMessageTextForDisplay = (msg, currentUser) => {
    if (!msg) return '';

    const textValue = normalizeMessageText(msg.text);
    const previewValue = msg.previewText ? normalizeMessageText(msg.previewText) : '';

    if (msg.isEncrypted && !msg.isDecrypted && previewValue) {
        if (msg.text && msg.text.startsWith("🔒")) {
            return msg.text;
        }
        // Senders should see their own plaintext preview immediately.
        if (msg.senderId === currentUser?.uid) {
            return previewValue;
        }
        return previewValue;
    }

    return textValue;
};

const displayMessage = (msg, isReRendering = false, insertAtTop = false) => {
    const user = auth.currentUser;
    if (!user || !elements.messagesContainer) return;

    // Update local store
    const localMsgIndex = messages.findIndex(m => m.id === msg.id);
    const previousMessage = localMsgIndex !== -1 ? messages[localMsgIndex] : null;
    let isOutOfOrder = false;
    let shouldForceRerender = false;

    if (localMsgIndex !== -1) {
        const mergedMessage = {
            ...messages[localMsgIndex],
            ...msg,
            status: mergeMessageStatus(messages[localMsgIndex].status, msg.status)
        };
        messages[localMsgIndex] = mergedMessage;
        msg = mergedMessage;

        if (previousMessage) {
            const oldUrl = previousMessage.url;
            const oldThumb = previousMessage.thumbnailUrl;
            const oldFileName = previousMessage.fileName;
            const oldType = previousMessage.type;
            const oldDeleted = previousMessage.deleted;
            const oldEncrypted = previousMessage.isEncrypted;
            const oldPreviewText = previousMessage.previewText;

            shouldForceRerender = (
                oldUrl !== msg.url ||
                oldThumb !== msg.thumbnailUrl ||
                oldFileName !== msg.fileName ||
                oldType !== msg.type ||
                oldDeleted !== msg.deleted ||
                oldEncrypted !== msg.isEncrypted ||
                oldPreviewText !== msg.previewText
            );
        }
    } else {
        if (!isReRendering && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            const newTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
            const lastTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
            if (newTime < lastTime) {
                isOutOfOrder = true;
            } else if (newTime === lastTime) {
                if (msg.id.localeCompare(lastMsg.id) < 0) {
                    isOutOfOrder = true;
                }
            }
        }
        messages.push(msg);
    }

    if (isOutOfOrder) {
        reRenderAllMessages();
        return;
    }

    // Remove skeleton if present before displaying actual messages
    removeMessageSkeleton();

    // 1. Check if message already exists (to handle real-time status updates)
    const existingMsg = document.getElementById(msg.id);
    if (existingMsg) {
        if (!shouldForceRerender) {
            // Handle real-time "Delete for Everyone" update (Placeholder)
            if (msg.deleted) {
                const bubble = existingMsg.querySelector('.message-bubble');
                if (bubble) {
                    bubble.className = `message-bubble deleted`;
                    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    bubble.innerHTML = `
                        <div class="message-text"><i class="fa-solid fa-ban" style="margin-right: 5px; opacity: 0.5;"></i> This message was deleted</div>
                        <div class="message-meta">
                            <span class="message-time">${time}</span>
                        </div>
                    `;
                }
                return;
            }

            // Handle content update for edited messages
            if (msg.edited && msg.type === 'text') {
                const textEl = existingMsg.querySelector('.message-text');
                if (textEl) {
                    textEl.innerHTML = (msg.text || '') + ' <small style="opacity:0.5; font-size:0.7rem; font-style:italic;">(edited)</small>';
                }
            }

            // Handle live location updates
            if (msg.type === 'live-location') {
                const img = existingMsg.querySelector('.location-map-img');
                const status = existingMsg.querySelector('.live-status');
                const link = existingMsg.querySelector('.location-preview');
                const liveIndicator = existingMsg.querySelector('.live-indicator');
                const stopBtn = existingMsg.querySelector('.stop-live-sharing-bubble-btn');

                if (img) img.src = msg.staticMapUrl || '';

                const isEnded = msg.liveSharingEnded === true;
                if (status) status.textContent = isEnded ? 'Live sharing ended' : (msg.address || 'Updating live...');
                if (link) link.href = msg.mapUrl || '#';

                if (isEnded) {
                    if (liveIndicator) liveIndicator.style.display = 'none';
                    if (stopBtn) stopBtn.remove();

                    const title = existingMsg.querySelector('strong');
                    if (title && !title.textContent.includes('(Ended)')) {
                        title.textContent = '🛰️ Live Location (Ended)';
                    }
                }
            }

            // Re-render reactions if they changed
            const messageGroupEl = document.getElementById(msg.id);
            if (messageGroupEl) renderReactions(msg, messageGroupEl);

            const statusEl = existingMsg.querySelector('.message-status');
            if (statusEl && msg.senderId === user.uid) {
                const wasRead = statusEl.classList.contains('read');
                const isRead = msg.status === 'read' && readReceiptsEnabled;

                // Trigger distinct sound when message is successfully delivered (Sent -> Delivered)
                const wasShowingSentOnly = statusEl.innerHTML.includes('fa-check') && !statusEl.innerHTML.includes('fa-check-double');
                if (wasShowingSentOnly && msg.status === 'delivered' && notificationSoundsEnabled) {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3');
                    audio.play().catch(() => { });
                }

                // Trigger subtle sound when message is newly marked as read
                if (!wasRead && isRead && notificationSoundsEnabled) {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
                    audio.play().catch(() => { }); // Catch browser block
                }

                statusEl.className = `message-status ${isRead ? 'read' : ''}`;
                statusEl.innerHTML = `<i class="fa-solid ${getMessageStatusIcon(msg.status || 'sent')}"></i>`;
            }

            if (msg.senderId === user.uid && !isInitialLoad && !insertAtTop && elements.messagesContainer) {
                elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
                newMessagesCount = 0;
            }

            // If the message is already rendered, and it's a live location message,
            // we need to ensure the stop sharing button is correctly displayed/hidden.
            // This is handled by the initial render, but if the message type changes, it needs re-evaluation.
            return;
        }

        existingMsg.remove();
    }

    // If it's an ephemeral message and it has already expired, don't display it.
    if (msg.ephemeralExpiry && msg.ephemeralExpiry <= Date.now()) {
        // Optionally, trigger a database deletion here if not handled by server-side functions
        return;
    }

    // 2. Determine if the message was sent by the current user
    const isSent = msg.senderId === user.uid;
    const senderProfile = allUsersCache[msg.senderId];
    const senderName = senderProfile ? senderProfile.fullname : 'Unknown User';
    let time = '';
    if (msg.timestamp) {
        const dateObj = new Date(msg.timestamp);
        if (!isNaN(dateObj.getTime())) {
            time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    // Unread Divider Logic
    let unreadDividerHtml = '';
    const isFirstUnread = firstUnreadId && msg.id === firstUnreadId;
    if (isFirstUnread) {
        unreadDividerHtml = `<div class="unread-divider"><span>New Messages</span></div>`;
    }

    // Logic for tails and consecutive grouping
    const isNewGroup = msg.senderId !== lastSenderId || isFirstUnread;
    lastSenderId = msg.senderId;

    // Generate Date Separator
    let durationStr;
    const dateSeparatorHtml = renderDateSeparator(msg.timestamp);

    let contentHtml = '';

    // Store message data locally so it can be forwarded even if received
    if (!messages.find(m => m.id === msg.id)) messages.push(msg);

    // Ephemeral message handling
    const isEphemeral = msg.ephemeralExpiry && msg.ephemeralExpiry > Date.now();
    const ephemeralClass = isEphemeral ? 'ephemeral' : '';

    if (msg.deleted) {
        contentHtml = `<div class="message-text"><i class="fa-solid fa-ban" style="margin-right: 5px; opacity: 0.5;"></i> This message was deleted</div>`;
    } else {
        switch (msg.isEncrypted && !msg.isDecrypted ? 'text' : msg.type) {
            case 'audio':
                const photoUrl = (senderProfile && senderProfile.profilePhoto) ? senderProfile.profilePhoto : '';
                const fallbackImg = photoUrl ? `<img src="${photoUrl}" class="wa-player-avatar" onerror="this.onerror=null; this.src='/hotmapp-logo.png';">` : `<div class="wa-player-avatar-fallback"><i class="fa-solid fa-user"></i></div>`;
                contentHtml = `
                    <div class="wa-audio-player">
                        <div class="wa-player-left">
                            <div class="wa-player-avatar-container">
                                ${fallbackImg}
                                <span class="wa-player-mic-badge"><i class="fa-solid fa-microphone"></i></span>
                            </div>
                            <button class="wa-play-btn"><i class="fa-solid fa-play"></i></button>
                        </div>
                        <div class="wa-player-center">
                            <input type="range" class="wa-progress-slider" min="0" max="100" value="0" step="0.1">
                            <div class="wa-player-meta">
                                <span class="wa-duration">0:00</span>
                            </div>
                        </div>
                        <button class="wa-speed-btn">1.0x</button>
                    </div>
                `;
                break;
            case 'image':
                const displayUrl = msg.thumbnailUrl || msg.url;
                contentHtml = `
                    <div class="image-loader-wrapper" style="max-width: 330px; cursor: pointer;">
                        <div class="spinner"></div>
                        <img src="${displayUrl}" data-full-url="${msg.url}" class="message-image" alt="Image" draggable="false" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';" onerror="this.classList.add('error'); this.previousElementSibling.style.display='none';">
                    </div>
                `;
                break;
            case 'video':
                const videoDisplayUrl = msg.thumbnailUrl || '';
                durationStr = msg.duration ? formatDuration(Math.round(msg.duration)) : '';
                contentHtml = `
                    <div class="video-loader-placeholder" data-full-url="${msg.url}" style="position: relative; max-width: 330px; cursor: pointer; border-radius: 8px; overflow: hidden;">
                        ${videoDisplayUrl ? `<img src="${videoDisplayUrl}" class="video-thumb" style="width: 100%; display: block; filter: brightness(0.7);">` : `<div style="width: 180px; height: 120px; background: #262626; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-video" style="font-size: 2rem;"></i></div>`}
                        <div class="video-play-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;"><i class="fa-solid fa-play"></i></div>
                        ${durationStr ? `<div class="video-duration-badge">${durationStr}</div>` : ''}
                    </div>
                `;
                break;
            case 'invoice':
                contentHtml = `
                    <div class="invoice-message-card" id="invoice-card-${msg.id}" data-invoice-id="${msg.invoiceId}" style="min-width: 220px; padding: 5px 0;">
                        <div class="invoice-loading" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--muted);"><span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin:0;"></span> Loading Invoice...</div>
                    </div>
                `;
                setTimeout(() => window.loadAndRenderInvoiceCard(msg.id, msg.invoiceId, isSent), 50);
                break;
            case 'document':
                const isPdf = msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf');
                const isInvoiceOrderMessage = !!(msg.invoiceId && msg.fileName && msg.fileName.startsWith('Invoice_'));

                let actionHtml = '';
                if (isPdf && !msg.deleted) {
                    if (msg.orderConfirmed) {
                        actionHtml = `
                            <div class="order-status-confirmed" style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; color: var(--brand-dark); font-weight: 700; font-size: 0.82rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <i class="fa-solid fa-circle-check"></i> Order Confirmed
                            </div>`;
                    } else if (!isSent && isInvoiceOrderMessage) {
                        actionHtml = `
                            <div class="order-action-container" style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; text-align: center;">
                                <button class="confirm-order-btn" data-msg-id="${msg.id}" style="width: 100%; background: var(--brand); color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 0.85rem;">Confirm Order</button>
                            </div>`;
                    }
                }

                let invoiceCardHtml = '';
                if (isInvoiceOrderMessage) {
                    invoiceCardHtml = `
                        <div class="invoice-message-card" id="invoice-card-${msg.id}" data-invoice-id="${msg.invoiceId}" style="margin-top: 8px; min-width: 220px; padding: 5px 0;">
                            <div class="invoice-loading" style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--muted);"><span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin:0;"></span> Loading Invoice...</div>
                        </div>`;
                    setTimeout(() => window.loadAndRenderInvoiceCard(msg.id, msg.invoiceId, isSent), 50);
                }

                const hasValidUrl = msg.url && msg.url !== 'null' && msg.url !== 'undefined';
                const documentPreviewHtml = hasValidUrl ? `
                    <a href="${msg.url}" target="_blank" rel="noopener noreferrer" class="document-preview">
                        <div class="document-icon-wrapper">
                            <span>${getFileIcon(msg.fileName)}</span>
                        </div>
                        <div class="document-info">
                            <span class="document-name">${msg.fileName || 'Document'}</span>
                            <span class="document-meta">${formatFileSize(msg.fileSize)}</span>
                        </div>
                    </a>
                ` : `
                    <div class="document-preview document-uploading">
                        <div class="document-icon-wrapper">
                            <span>${getFileIcon(msg.fileName)}</span>
                        </div>
                        <div class="document-info">
                            <span class="document-name">${msg.fileName || 'Document'}</span>
                            <span class="document-meta">Uploading document...</span>
                        </div>
                    </div>
                `;

                let pdfPreviewHtml = '';
                if (isPdf) {
                    if (hasValidUrl) {
                        const pdfContent = msg.thumbnailUrl ? `
                            <div class="image-loader-wrapper" style="min-height: 100px;"><div class="spinner"></div><img src="${msg.thumbnailUrl}" class="pdf-thumbnail" alt="PDF Preview" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';"></div>
                        ` : `
                            <div class="pdf-embed-container"><iframe src="${msg.url}#toolbar=0&navpanes=0" frameborder="0"></iframe></div>
                        `;
                        pdfPreviewHtml = `
                            <div class="pdf-thumbnail-container" onclick="openPdfViewer('${msg.url}', '${msg.id}')">
                                ${pdfContent}
                                <div class="pdf-thumbnail-overlay"><i class="fa-solid fa-expand"></i> Tap to view full PDF</div>
                            </div>
                        `;
                    } else {
                        pdfPreviewHtml = `
                            <div class="pdf-thumbnail-container">
                                <div class="pdf-uploading-placeholder">
                                    <span>Preview available after upload</span>
                                </div>
                            </div>
                        `;
                    }
                }

                contentHtml = `
                    <div class="document-container">
                        ${documentPreviewHtml}
                        ${pdfPreviewHtml}
                        ${invoiceCardHtml}
                        ${actionHtml}
                    </div>`;
                break;
            case 'call':
                const isIWasCaller = msg.callerId === user.uid;
                const isMissed = msg.callStatus === 'missed' || msg.callStatus === 'busy' || msg.callStatus === 'declined' || msg.callStatus === 'cancelled';

                // Determine the correct icon based on call status and type
                let callStatusIcon = 'fa-phone'; // Default for voice
                if (msg.callType === 'video') callStatusIcon = 'fa-video';
                if (isMissed) callStatusIcon = 'fa-phone-slash'; // Generic missed icon
                if (msg.callType === 'video' && isMissed) callStatusIcon = 'fa-video-slash';


                let text = "";
                let colorClass = "";
                let dirIcon = isIWasCaller ? 'fa-arrow-up-right' : 'fa-arrow-down-left';

                const typeLabel = msg.callType.charAt(0).toUpperCase() + msg.callType.slice(1);
                durationStr = msg.duration ? ` (${formatDuration(msg.duration)})` : '';

                if (!isIWasCaller && isMissed) {
                    text = `Missed ${msg.callType} call`;
                    colorClass = "missed";
                } else if (msg.callStatus === 'cancelled') {
                    text = `Cancelled ${msg.callType} call`; // For outgoing calls that were cancelled
                    colorClass = "missed"; // Visually similar to missed
                } else {
                    text = `${typeLabel} call${durationStr}`;
                }

                // Adjust icon for missed video calls
                if (isMissed && msg.callType === 'video') {
                    callStatusIcon = 'fa-video-slash';
                } else if (isMissed && msg.callType === 'voice') {
                    callStatusIcon = 'fa-phone-slash';
                }

                const callIcon = msg.callType === 'video' ? 'fa-video' : 'fa-phone';

                const callBackBtnHtml = (!isIWasCaller && isMissed)
                    ? `<button class="call-back-btn" data-type="${msg.callType}">Call Back</button>`
                    : '';

                const deleteBtnHtml = `<button class="call-log-delete-btn" title="Delete log"><i class="fa-solid fa-trash-can"></i></button>`;

                contentHtml = `
                    <div class="message-bubble call ${colorClass}">
                        <i class="fa-solid ${dirIcon} dir-icon"></i> 
                        <i class="fa-solid ${callStatusIcon}"></i> 
                        <span>${text}</span>
                        ${callBackBtnHtml}
                        ${deleteBtnHtml}
                    </div>
                `;

                // For call logs and system messages, we insert the entire message group directly
                // because they often have different styling and don't fit the standard bubble structure.
                if (insertAtTop) elements.messagesContainer.insertAdjacentHTML('afterbegin', `<div class="message-group call-log" id="${msg.id}">${contentHtml}</div>`);
                else elements.messagesContainer.insertAdjacentHTML('beforeend', `<div class="message-group call-log" id="${msg.id}">${contentHtml}</div>`);
                if (elements.messagesContainer) elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
                break;
            case 'system': {
                let displayText = msg.text;
                let viewProfileBtn = '';

                if (msg.targetUserId || msg.senderId) {
                    const senderProfile = allUsersCache[msg.senderId];
                    const senderName = senderProfile ? (msg.senderId === auth.currentUser?.uid ? 'You' : senderProfile.fullname) : 'Someone';
                    const targetProfile = msg.targetUserId ? allUsersCache[msg.targetUserId] : null;
                    const targetName = targetProfile ? (msg.targetUserId === auth.currentUser?.uid ? 'you' : targetProfile.fullname) : 'someone';

                    if (msg.text === 'made admin') {
                        displayText = `${senderName} made ${targetName} a group admin`;
                    } else if (msg.text === 'dismissed as admin') {
                        displayText = `${senderName} dismissed ${targetName} as a group admin`;
                    } else if (msg.text === 'added member') {
                        displayText = `${senderName} added ${targetName} to the group`;
                    } else if (msg.text === 'removed member') {
                        displayText = `${senderName} removed ${targetName} from the group`;
                    } else if (msg.text === 'left the group') {
                        displayText = `${senderName} left the group`;
                    } else if (msg.text === 'became admin') {
                        displayText = `${targetName} is now a group admin`;
                    }
                }

                if (msg.text === "I've accepted your request. Let's chat!") {
                    viewProfileBtn = ` <button class="view-profile-link" data-uid="${activeChatUid}" style="background:none; border:none; color:var(--brand-dark); font-weight:800; text-decoration:none; cursor:pointer; font-size:0.72rem; margin-left:8px; padding:2px 8px; border:1px solid var(--brand-dark); border-radius:12px; text-transform:uppercase; white-space:nowrap;">View Profile</button>`;
                }
                contentHtml = `<div class="system-message-bubble"><i class="fa-solid fa-shield-halved" style="font-size: 0.75rem; opacity: 0.8;"></i> <span>${displayText}</span>${viewProfileBtn}</div>`;
                if (insertAtTop) elements.messagesContainer.insertAdjacentHTML('afterbegin', `<div class="message-group system-message" id="${msg.id}">${contentHtml}</div>`);
                else elements.messagesContainer.insertAdjacentHTML('beforeend', `<div class="message-group system-message" id="${msg.id}">${contentHtml}</div>`);
                if (elements.messagesContainer) elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
                break;
            }
            case 'location':
                const locationMapUrl = msg.mapUrl || `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`;
                const locationStaticMapUrl = msg.staticMapUrl || '';
                contentHtml = `
                    <a href="${locationMapUrl}" target="_blank" class="location-bubble" title="View on Google Maps">
                        <div class="image-loader-wrapper" style="min-height: 150px;">
                            <div class="spinner"></div>
                            <img src="${locationStaticMapUrl}" alt="Location Map" class="location-map-img" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x180.png?text=Map+Preview'; this.classList.add('loaded'); this.previousElementSibling.style.display='none';">
                        </div>
                        <div class="location-info">
                            <strong>${msg.address || '📍 Shared Location'}</strong>
                            <span>${msg.latitude.toFixed(4)}, ${msg.longitude.toFixed(4)}</span>
                        </div>
                    </a>
                `;
                break;
            case 'live-location':
                const isEnded = msg.liveSharingEnded === true;
                const liveLocationMapUrl = msg.mapUrl || `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`;
                const liveLocationStaticMapUrl = msg.staticMapUrl || '';
                contentHtml = `
                    <a href="${liveLocationMapUrl}" target="_blank" class="location-bubble" title="View on Google Maps">
                        <div class="image-loader-wrapper" style="min-height: 150px;">
                            ${isEnded ? '' : '<div class="live-indicator">LIVE</div>'}
                            <div class="spinner"></div>
                            <img src="${liveLocationStaticMapUrl}" alt="Live Location Map" class="location-map-img" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x180.png?text=Map+Preview'; this.classList.add('loaded'); this.previousElementSibling.style.display='none';">
                        </div>
                        <div class="location-info">
                            <strong>🛰️ Live Location${isEnded ? ' (Ended)' : ''}</strong>
                            <span class="live-status">${isEnded ? 'Live sharing ended' : (msg.address || 'Updating live...')}</span>
                        </div>
                    </a>
                    ${(!isEnded && msg.senderId === user.uid) ? `<button class="stop-live-sharing-bubble-btn" data-msg-id="${msg.id}">Stop Sharing</button>` : ''}
                `;
                break;
            default:
                const displayTextBase = getMessageTextForDisplay(msg, user);
                let displayText = displayTextBase;
                if (msg.isEncrypted && !msg.isDecrypted && msg.previewText && msg.senderId !== user.uid) {
                    displayText = `${normalizeMessageText(msg.previewText)} <small style="opacity:0.65; font-size:0.75rem; margin-left:6px;">🔒</small>`;
                }
                const linkedText = linkifyText(displayText);
                contentHtml = `<div class="message-text">${linkedText + (msg.edited ? ' <small style="opacity:0.5; font-size:0.7rem; font-style:italic;">(edited)</small>' : '')}</div>`;
        }
    }

    let replyHtml = (msg.replyTo && !msg.deleted) ? `
        <div class="quoted-message" onclick="document.getElementById('${msg.replyTo.msgId}')?.scrollIntoView({behavior:'smooth'})">
            <span class="quoted-sender">${escapeHtml(normalizeMessageText(msg.replyTo.senderName))}</span>
            <div class="quoted-text">${escapeHtml(normalizeMessageText(msg.replyTo.text))}</div>
        </div>` : '';

    const forwardedHtml = (msg.forwarded && !msg.deleted) ? `<div class="forwarded-label">↪ Forwarded</div>` : '';

    if (msg.type === 'call' || msg.type === 'system') return; // Handled in switch case

    const groupSenderHtml = (activeChatUid && activeChatUid.startsWith('group_') && !isSent && !msg.deleted)
        ? `<div class="group-sender-name" style="font-weight: 700; font-size: 0.75rem; color: var(--brand-dark); margin-bottom: 4px; cursor: default;">${senderName}</div>`
        : '';

    // 3. Build the message HTML with conditional classes for alignment
    const groupClasses = `${isSent ? 'sent' : 'received'} ${isNewGroup ? 'has-tail' : 'consecutive'}`;

    const html = `
        ${dateSeparatorHtml}
        ${unreadDividerHtml}
        <div class="message-group ${groupClasses}" id="${msg.id}">
            <div class="message-checkbox"></div>
            <div class="message-bubble ${msg.type === 'text' ? '' : msg.type} ${msg.deleted ? 'deleted' : ''} ${ephemeralClass}">
                ${isEphemeral ? `<span class="ephemeral-timer"></span>` : ''}
                ${forwardedHtml}
                ${replyHtml}
                ${groupSenderHtml}
                ${contentHtml}
                <div class="message-meta">
                    ${(msg.isStarred && !msg.deleted) ? '<span class="starred-indicator">⭐</span>' : ''}
                    <span class="message-time">${time}</span>
                    ${(isSent && !msg.deleted) ? `<span class="message-status ${msg.status === 'read' && readReceiptsEnabled ? 'read' : ''}"><i class="fa-solid ${getMessageStatusIcon(msg.status || 'sent')}"></i></span>` : ''}
                </div>
            </div>
        </div>
    `;

    if (insertAtTop) elements.messagesContainer.insertAdjacentHTML('afterbegin', html);
    else elements.messagesContainer.insertAdjacentHTML('beforeend', html);

    // Initialize custom voice note player
    if (msg.type === 'audio' && !msg.deleted) {
        initCustomAudioPlayer(msg.id, msg.url);
    }

    // Start ephemeral timer if applicable
    if (isEphemeral) {
        startEphemeralTimer(msg.id, msg.ephemeralExpiry);
    }

    // Apply search filter if active
    if (elements.chatSearchBar && elements.chatSearchBar.style.display === 'flex') {
        filterChatMessages(elements.chatSearchInput?.value || '');
    }

    const { scrollTop, scrollHeight, clientHeight } = elements.messagesContainer;
    const shouldAutoScroll = isSent && !insertAtTop;
    if (shouldAutoScroll) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        newMessagesCount = 0;
    } else if (!isInitialLoad && !isSent) {
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isNearBottom) {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        } else {
            newMessagesCount++;
            const btn = elements.scrollToBottomBtn;
            if (btn) {
                let badge = btn.querySelector('.unread-badge-mini');
                if (!badge) {
                    btn.insertAdjacentHTML('beforeend', '<span class="unread-badge-mini" style="display:none">0</span>');
                    badge = btn.querySelector('.unread-badge-mini');
                }
                badge.textContent = newMessagesCount;
                badge.style.display = 'flex';
            }
        }
    }

    // Render reactions for the newly added message
    const messageGroupEl = document.getElementById(msg.id);
    if (messageGroupEl) renderReactions(msg, messageGroupEl);
};

const waitForBrowserIdle = async () => {
    return new Promise(resolve => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(resolve, { timeout: 50 });
        } else {
            setTimeout(resolve, 25);
        }
    });
};

const pauseBackgroundDecryptForInteraction = () => {
    if (backgroundDecryptPaused) {
        clearTimeout(backgroundDecryptResumeTimer);
    } else {
        backgroundDecryptPaused = true;
    }

    backgroundDecryptResumeTimer = setTimeout(() => {
        backgroundDecryptPaused = false;
    }, 600);
};

const attachChatInteractionPauseListeners = () => {
    if (chatInteractionPauseListenersAttached) return;
    chatInteractionPauseListenersAttached = true;

    const pauseEvents = ['pointerdown', 'touchstart', 'keydown', 'focusin'];
    const target = elements.chatArea || document.body;

    pauseEvents.forEach(eventName => {
        target.addEventListener(eventName, pauseBackgroundDecryptForInteraction, { passive: true });
    });
};

const processMessageQueue = async (chatId, userId, initialMessageCount, options = {}) => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    const { display = true, insertAtTop = false, renderAfterBatch = false, cacheDecrypted = true } = options;

    const BATCH_SIZE = isInitialLoad ? 8 : 4;
    while (messageQueue.length > 0) {
        if (backgroundDecryptPaused) {
            await new Promise(resolve => setTimeout(resolve, 120));
            continue;
        }

        const chunk = messageQueue.splice(0, BATCH_SIZE);
        try {
            // Decrypt messages in parallel for this batch
            const decryptPromises = chunk.map(m => decryptMessageInPlace({ ...m }, { cache: cacheDecrypted }));
            const decryptedBatch = await Promise.all(decryptPromises);

            let shouldMarkDelivered = false;
            let scrollTriggered = false;

            // Render or cache the batch in the next animation frame to minimize reflows
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (display) {
                const batchToRender = insertAtTop ? [...decryptedBatch].reverse() : decryptedBatch;
                for (const decryptedMsg of batchToRender) {
                    try {
                        displayMessage(decryptedMsg, false, insertAtTop);
                    } catch (e) {
                        console.error('Failed to display decrypted message:', e);
                    }

                    renderedCount++;
                    if (!scrollTriggered && decryptedMsg.id === firstUnreadId) {
                        scrollTriggered = true;
                        setTimeout(scrollToFirstUnread, 50);
                    } else if (!scrollTriggered && renderedCount === initialMessageCount) {
                        setTimeout(scrollToFirstUnread, 100);
                    }

                    if (decryptedMsg.senderId !== userId) {
                        if (decryptedMsg.status !== 'read' && readReceiptsEnabled) {
                            // Mark this message as read locally and batch a DB update for nearby messages.
                            // Collect nearby unread message IDs to minimize DB writes and ensure real-time feel.
                            const toMark = [decryptedMsg.id];
                            // Also check the previous 3 messages in the array for unread items
                            const lastIndex = messages.findIndex(m => m.id === decryptedMsg.id);
                            for (let i = Math.max(0, lastIndex - 3); i < lastIndex; i++) {
                                const m = messages[i];
                                if (m && m.senderId !== userId && m.status !== 'read') toMark.push(m.id);
                            }
                            // Optimistically update local message statuses so UI is responsive
                            toMark.forEach(id => {
                                const idx = messages.findIndex(m => m.id === id);
                                if (idx !== -1) messages[idx].status = 'read';
                            });
                            // Call new batched helper
                            markMessagesAsReadIds(chatId, Array.from(new Set(toMark))).catch(err => {
                                console.warn('Failed to mark messages as read (batched):', err);
                            });
                        }
                        if (decryptedMsg.status === 'notified' || decryptedMsg.status === 'sent') {
                            shouldMarkDelivered = true;
                        }
                    }

                    if (!isInitialLoad) {
                        // Yield within the batch to avoid long blocking frames for interactive chat
                        await waitForBrowserIdle();
                    }
                }
            } else {
                for (const decryptedMsg of decryptedBatch) {
                    const existingIndex = messages.findIndex(m => m.id === decryptedMsg.id);
                    if (existingIndex >= 0) {
                        messages[existingIndex] = decryptedMsg;
                    } else {
                        messages.push(decryptedMsg);
                    }
                }
            }

            if (shouldMarkDelivered) {
                markMessagesAsDelivered(chatId, userId).catch(err => {
                    console.warn(`Failed to mark messages as delivered for chat ${chatId}:`, err);
                });
            }

            // Yield briefly to keep UI responsive
            await waitForBrowserIdle();
        } catch (e) {
            console.error("Error processing queued message batch:", e);
        }
    }

    if (!display && renderAfterBatch) {
        reRenderAllMessages();
        if (elements.messagesContainer) {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }
    }

    isProcessingQueue = false;
};

const startMessageListener = async (otherUid) => {
    const user = auth.currentUser;
    if (!user || !otherUid) return;

    // Unconditionally show the chat header and footer, and add the active chat selection class
    if (elements.chatHeader) elements.chatHeader.style.display = 'flex';
    if (elements.messageInputArea) elements.messageInputArea.style.display = 'flex';
    if (elements.chatArea) elements.chatArea.classList.add('active-chat-selected');

    const currentUserProfile = await getUserProfile(user.uid); // Fetch current user's profile
    // Clean up existing listeners
    if (msgAddUnsubscribe) msgAddUnsubscribe();
    if (msgChangeUnsubscribe) msgChangeUnsubscribe();
    if (msgRemoveUnsubscribe) msgRemoveUnsubscribe();

    chatInitializationGate.begin();

    chatInitializationGate.begin();

    // Clear all ephemeral timers for the previous chat
    for (const msgId in ephemeralMessageTimers) {
        stopEphemeralTimer(msgId);
    }
    if (pinnedMsgUnsubscribe) pinnedMsgUnsubscribe();
    messages.length = 0;
    messageQueue = [];
    isProcessingQueue = false;
    renderedCount = 0;

    // Start real-time presence/status listener for the header
    if (userStatusUnsubscribe) userStatusUnsubscribe();
    if (otherUid.startsWith('group_')) {
        // Show call buttons for group chats
        if (elements.callMenuBtn) elements.callMenuBtn.style.display = 'none';
        if (elements.privacyBlockNotice) elements.privacyBlockNotice.style.display = 'none';
        if (elements.messageInputArea) elements.messageInputArea.style.display = 'flex';
        if (elements.chatActions) elements.chatActions.style.display = 'flex';

        // Set standard unlock icon for groups
        if (elements.chatHeaderName) {
            const existingLock = elements.chatHeaderName.parentNode.querySelector('.e2ee-header-lock');
            if (existingLock) existingLock.remove();

            const lockIcon = `<i class="fa-solid fa-unlock e2ee-header-lock" title="Standard Chat" style="color: var(--muted); margin-left: 6px; font-size: 0.85rem; cursor: help;"></i>`;
            elements.chatHeaderName.insertAdjacentHTML('afterend', lockIcon);
        }

        renderE2EENotice(false);

        userStatusUnsubscribe = subscribeToGroupProfile(otherUid, (groupData) => {
            if (groupData) {
                if (elements.chatHeaderName) {
                    elements.chatHeaderName.textContent = groupData.name || "Group Chat";
                }
                if (elements.chatHeaderAvatar) {
                    elements.chatHeaderAvatar.innerHTML = getAvatarHtml(groupData, otherUid);
                }
                if (elements.userStatus) {
                    const memberCount = groupData.members ? Object.keys(groupData.members).length : 0;
                    elements.userStatus.style.display = 'block';
                    elements.userStatus.textContent = `${memberCount} members`;
                }

                // Cache active group members
                activeGroupMembers = groupData.members ? Object.keys(groupData.members) : [];
                currentGroupName = groupData.name || "Group Chat";
            }
        });
    } else {
        // Restore call buttons for 1-to-1 chats
        if (elements.callMenuBtn) elements.callMenuBtn.style.display = 'flex';

        userStatusUnsubscribe = subscribeToUserProfile(otherUid, async (profile) => { // Made async to await getUserProfile
            if (profile && currentUserProfile) { // Ensure both profiles are loaded
                const isFriend = !!moduleFriendsList[otherUid];
                const otherUserWhoCanMessage = profile.whoCanMessage || 'anyone';
                const currentUserWhoCanMessage = currentUserProfile.whoCanMessage || 'anyone'; // Get current user's setting

                const isBlockedByMe = !!blockedUsers[otherUid];
                const isBlockedByOther = profile.blockedUsers && !!profile.blockedUsers[user.uid];
                let chatBlocked = false;
                let blockReason = '';

                if (isBlockedByMe) {
                    chatBlocked = true;
                    blockReason = "You have blocked this contact. Tap to unblock.";
                } else if (isBlockedByOther) {
                    chatBlocked = true;
                    blockReason = "You cannot send messages to this contact because they have blocked you.";
                }
                // Condition 1: Other user's privacy
                else if (!isAllowedByPrivacy(otherUserWhoCanMessage, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid))) {
                    chatBlocked = true;
                    if (otherUserWhoCanMessage === 'friends-only') {
                        blockReason = `${profile.fullname} only accepts messages from friends.`;
                    } else if (otherUserWhoCanMessage === 'excluded') {
                        if (!isFriend) {
                            blockReason = `${profile.fullname} only accepts messages from approved contacts.`;
                        } else {
                            blockReason = `You cannot message this user because they have restricted access for this contact.`;
                        }
                    } else {
                        blockReason = `${profile.fullname} does not accept new messages.`;
                    }
                }
                // Condition 2: Current user's privacy
                else if (!isAllowedByPrivacy(currentUserWhoCanMessage, isFriend, isUserExcluded(excludedContacts, otherUid))) {
                    chatBlocked = true;
                    if (currentUserWhoCanMessage === 'friends-only') {
                        blockReason = `You can only message your friends.`;
                    } else if (currentUserWhoCanMessage === 'excluded') {
                        if (!isFriend) {
                            blockReason = `You can only message your approved contacts.`;
                        } else {
                            blockReason = `You cannot message this user because they are in your excluded list.`;
                        }
                    } else {
                        blockReason = `You have restricted messaging settings.`;
                    }
                }

                if (chatBlocked) {
                    if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
                    if (elements.callMenuBtn) elements.callMenuBtn.style.display = 'none';
                    if (elements.privacyBlockNotice) {
                        elements.privacyBlockNotice.style.display = 'block';
                        if (elements.privacyBlockText) {
                            elements.privacyBlockText.textContent = blockReason;
                        }

                        // Check if a request has already been sent
                        const sentReqSnap = await get(ref(db, `users/${user.uid}/sentRequests/${otherUid}`));
                        const hasSent = sentReqSnap.exists();

                        if (elements.requestToMessageBtn) {
                            if (isBlockedByMe) {
                                elements.requestToMessageBtn.style.display = 'block';
                                elements.requestToMessageBtn.textContent = 'Unblock User';
                                elements.requestToMessageBtn.disabled = false;
                                elements.requestToMessageBtn.style.opacity = '1';
                            } else if (isBlockedByOther) {
                                elements.requestToMessageBtn.style.display = 'none';
                            } else {
                                elements.requestToMessageBtn.style.display = 'block';
                                elements.requestToMessageBtn.dataset.uid = otherUid;
                                updateRequestActionButtonState(otherUid);
                            }
                            elements.requestToMessageBtn.dataset.uid = otherUid;
                        }
                    }
                } else {
                    // Allow chat for friends or if privacy is set to "Anyone"
                    if (elements.privacyBlockNotice) elements.privacyBlockNotice.style.display = 'none';
                    if (elements.messageInputArea) elements.messageInputArea.style.display = 'flex';
                    if (elements.chatActions) elements.chatActions.style.display = 'flex';
                }

                if (elements.userStatus) {
                    // Live update Name and Avatar in the Header
                    if (elements.chatHeaderName) {
                        const isE2EE = !!(profile.publicKey);
                        const lockIcon = isE2EE
                            ? `<i class="fa-solid fa-lock e2ee-header-lock" title="End-to-End Encrypted" style="color: var(--brand); margin-left: 6px; font-size: 0.85rem; cursor: help;"></i>`
                            : `<i class="fa-solid fa-unlock e2ee-header-lock" title="Standard Chat" style="color: var(--muted); margin-left: 6px; font-size: 0.85rem; cursor: help;"></i>`;

                        // Remove existing lock icon to avoid duplicate indicators
                        const existingLock = elements.chatHeaderName.parentNode.querySelector('.e2ee-header-lock');
                        if (existingLock) existingLock.remove();

                        elements.chatHeaderName.textContent = profile.fullname;
                        elements.chatHeaderName.insertAdjacentHTML('afterend', lockIcon);
                    }

                    // Render E2EE notice bubble at the top of the chat
                    renderE2EENotice(!!(profile.publicKey));

                    if (elements.chatHeaderAvatar) {
                        const initials = (profile.fullname || 'U').charAt(0).toUpperCase();
                        const dot = elements.chatHeaderAvatar.querySelector('.online-dot');
                        elements.chatHeaderAvatar.innerHTML = getAvatarHtml(profile, otherUid);
                        if (dot) elements.chatHeaderAvatar.appendChild(dot);
                    }

                    if (profile.typingTo === user.uid) {
                        showTypingIndicator();
                        elements.userStatus.style.display = 'none';
                    } else {
                        hideTypingIndicator();
                        elements.userStatus.style.display = 'block';
                        elements.userStatus.innerHTML = formatLastSeen(profile, false, otherUid);
                    }
                }
            }
        });
    }

    // Reset grouping state
    lastProcessedMessageDate = null;
    lastSenderId = null;

    // Hide live location header button
    if (elements.liveLocationHeaderBtn) {
        elements.liveLocationHeaderBtn.style.display = 'none';
    }

    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = '';
        renderMessageSkeletons();
    }

    const chatId = otherUid.startsWith('group_') ? otherUid : [user.uid, otherUid].sort().join('_');

    isInitialLoad = true;
    messages.length = 0;

    const cachedMessages = await getCachedMessages(chatId);
    const pendingMessagesForChat = getPendingMessagesQueue().filter(item => item.chatId === chatId);

    const mergeMessages = (...messageArrays) => {
        const merged = new Map();
        for (const array of messageArrays) {
            for (const msg of array) {
                const existing = merged.get(msg.id);
                if (!existing) {
                    merged.set(msg.id, msg);
                } else {
                    merged.set(msg.id, {
                        ...existing,
                        ...msg,
                        status: mergeMessageStatus(existing.status, msg.status)
                    });
                }
            }
        }
        return Array.from(merged.values());
    };

    const lastCachedId = cachedMessages.length > 0 ? cachedMessages[cachedMessages.length - 1].id : null;
    let syncSnapshot;
    if (lastCachedId) {
        const syncQuery = query(
            ref(db, `messages/${chatId}`),
            orderByKey(),
            startAfter(lastCachedId)
        );
        syncSnapshot = await get(syncQuery);
    } else {
        const initialQuery = query(
            ref(db, `messages/${chatId}`),
            orderByKey(),
            limitToLast(30)
        );
        syncSnapshot = await get(initialQuery);
    }

    let firebaseMessages = [];
    if (syncSnapshot && syncSnapshot.exists()) {
        const firebaseData = syncSnapshot.val();
        firebaseMessages = Object.entries(firebaseData)
            .map(([key, val]) => ({ id: key, ...val, chatId }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    const mergedMessages = mergeMessages(cachedMessages, pendingMessagesForChat, firebaseMessages);
    mergedMessages.sort((a, b) => {
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.id.localeCompare(b.id);
    });

    // Use merged messages to determine the unread anchor quickly.
    firstUnreadId = null;
    for (const msg of mergedMessages) {
        if (!firstUnreadId && msg.senderId !== user.uid && msg.status !== 'read') {
            firstUnreadId = msg.id;
        }
    }

    if (mergedMessages.length > 0) {
        removeMessageSkeleton();
    }

    const INITIAL_DISPLAY_COUNT = 30;
    const startIndex = Math.max(0, mergedMessages.length - INITIAL_DISPLAY_COUNT);
    const initialMessages = mergedMessages.slice(startIndex);
    olderMessagesBacklog = mergedMessages.slice(0, startIndex);

    const initialDecryptPromises = initialMessages.map(msg => decryptMessageInPlace({ ...msg }, { cache: false }));
    const preparedInitialMessages = await Promise.all(initialDecryptPromises);
    for (const preparedMsg of preparedInitialMessages) {
        messages.push(preparedMsg);
        try {
            displayMessage(preparedMsg, false, false);
        } catch (e) {
            console.warn('Failed to display initial chat message:', e);
        }
        await waitForBrowserIdle();
    }

    if (olderMessagesBacklog.length > 0) {
        attachChatInteractionPauseListeners();
    }

    if (readReceiptsEnabled) {
        const unreadMessageIds = messages
            .filter(m => m.senderId !== user.uid && m.status !== 'read')
            .map(m => m.id);

        if (unreadMessageIds.length > 0) {
            markMessagesAsRead(chatId, user.uid).catch(err => {
                console.warn(`Failed to mark initial chat ${chatId} messages as read:`, err);
            });

            messages.forEach(m => {
                if (m.senderId !== user.uid && m.status !== 'read') {
                    m.status = 'read';
                }
            });

            const activeBadge = document.querySelector(`.conversation-item[data-uid="${otherUid}"] .unread-badge`);
            if (activeBadge) {
                activeBadge.textContent = '0';
                activeBadge.style.display = 'none';
            }

            firstUnreadId = null;
            reRenderAllMessages();
        }
    }

    if (firstUnreadId) {
        scrollToFirstUnread();
    } else if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        isInitialLoad = false;
    }

    let initialFirebaseCount = firebaseMessages.length;
    if (firebaseMessages.length > 0) {
        for (const msgObj of firebaseMessages) {
            await cacheItem('messages', msgObj);

            if (msgObj.orderConfirmed && msgObj.invoiceId) {
                try {
                    const cachedOrder = await getCachedItem('orders', msgObj.invoiceId);
                    if (cachedOrder && cachedOrder.status !== 'confirmed') {
                        cachedOrder.status = 'confirmed';
                        await cacheItem('orders', cachedOrder);
                    }
                } catch (e) {
                    console.error("Failed to update cached order on sync:", e);
                }
            }
        }
    }

    if (!firstUnreadId) {
        firstUnreadId = await getFirstUnreadMessageId(chatId, user.uid);
    }

    // Subscribe to new messages in real-time starting after the last loaded Firebase message ID.
    const lastFirebaseKey = firebaseMessages.length > 0
        ? firebaseMessages[firebaseMessages.length - 1].id
        : lastCachedId;

    msgAddUnsubscribe = subscribeToNewMessages(chatId, lastFirebaseKey, async (msg) => {
        console.log(`[E2EE DEBUG] msgAddUnsubscribe: received message ${msg.id} real-time. isEncrypted: ${msg.isEncrypted}, senderId: ${msg.senderId}`);
        await cacheItem('messages', msg);
        if (!messages.some(m => m.id === msg.id)) {
            const decryptedMsg = await decryptMessageInPlace(msg);

            if (decryptedMsg.orderConfirmed && decryptedMsg.invoiceId) {
                try {
                    const cachedOrder = await getCachedItem('orders', decryptedMsg.invoiceId);
                    if (cachedOrder && cachedOrder.status !== 'confirmed') {
                        cachedOrder.status = 'confirmed';
                        await cacheItem('orders', cachedOrder);
                    }
                } catch (e) {
                    console.error("Failed to update cached order on real-time new message:", e);
                }
            }

            messageQueue.push(decryptedMsg);
            processMessageQueue(chatId, user.uid, 1);
        }
    });

    pinnedMessageData = null;
    if (elements.pinnedMessageBar) elements.pinnedMessageBar.style.display = 'none';
    pinnedMsgUnsubscribe = subscribeToPinnedMessage(chatId, async (data) => {
        pinnedMessageData = data;
        if (data && !messages.find(m => m.id === data.msgId)?.deleted) {
            const decryptedMsg = await decryptMessageInPlace({ ...data });
            if (elements.pinnedPreview) elements.pinnedPreview.textContent = decryptedMsg.text;
            if (elements.pinnedMessageBar) {
                elements.pinnedMessageBar.style.display = 'flex';
            }
        } else {
            if (elements.pinnedMessageBar) elements.pinnedMessageBar.style.display = 'none';
        }
    });

    msgRemoveUnsubscribe = subscribeToMessageRemovals(chatId, (msgId) => {
        const el = document.getElementById(msgId);
        if (el) el.remove();
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx !== -1) messages.splice(idx, 1);
        deleteCachedItem('messages', msgId);
    });

    msgChangeUnsubscribe = subscribeToMessageUpdates(chatId, async (msg) => {
        console.log(`[E2EE DEBUG] msgChangeUnsubscribe: message updated ${msg.id}. status: ${msg.status}`);
        await cacheItem('messages', msg);
        const decryptedMsg = await decryptMessageInPlace({ ...msg });

        if (decryptedMsg.orderConfirmed && decryptedMsg.invoiceId) {
            try {
                const cachedOrder = await getCachedItem('orders', decryptedMsg.invoiceId);
                if (cachedOrder && cachedOrder.status !== 'confirmed') {
                    cachedOrder.status = 'confirmed';
                    await cacheItem('orders', cachedOrder);
                }
            } catch (e) {
                console.error("Failed to update cached order on real-time update:", e);
            }
        }

        const idx = messages.findIndex(m => m.id === msg.id);
        if (idx !== -1) {
            const existingMessage = messages[idx];
            messages[idx] = {
                ...existingMessage,
                ...decryptedMsg,
                status: mergeMessageStatus(existingMessage?.status, decryptedMsg.status)
            };
            reRenderAllMessages();
        } else {
            displayMessage(decryptedMsg);
        }
    });

    chatInitializationGate.finish();
};

const reRenderAllMessages = () => {
    if (!elements.messagesContainer) return;

    elements.messagesContainer.innerHTML = '';
    lastProcessedMessageDate = null;
    lastSenderId = null;

    messages.sort((a, b) => (a.timestamp && b.timestamp) ? a.timestamp - b.timestamp : a.id.localeCompare(b.id));

    const uniqueMessages = [];
    const ids = new Set();
    messages.forEach(m => {
        if (!ids.has(m.id)) {
            ids.add(m.id);
            uniqueMessages.push(m);
        }
    });
    messages.length = 0;
    messages.push(...uniqueMessages);

    messages.forEach(msg => {
        displayMessage(msg, false, false);
    });
};

const loadOlderMessages = async () => {
    if (isLoadingOlderMessages) return;
    isLoadingOlderMessages = true;

    const user = auth.currentUser;
    if (!user || !activeChatUid || messages.length === 0) {
        isLoadingOlderMessages = false;
        return;
    }

    const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');
    const earliestMsgId = messages.length > 0 ? messages[0].id : null;

    if (!earliestMsgId) {
        isLoadingOlderMessages = false;
        return;
    }

    const container = elements.messagesContainer;
    const oldScrollHeight = container.scrollHeight;

    try {
        let olderMsgs = [];

        if (olderMessagesBacklog.length > 0) {
            olderMsgs = olderMessagesBacklog.filter(m => m.id < earliestMsgId);
            olderMessagesBacklog = olderMessagesBacklog.filter(m => m.id >= earliestMsgId);
        }

        if (olderMsgs.length === 0) {
            const allCached = await getCachedMessages(chatId);
            olderMsgs = allCached.filter(m => m.id < earliestMsgId);
        }

        if (olderMsgs.length === 0) {
            const olderQuery = query(
                ref(db, `messages/${chatId}`),
                orderByKey(),
                endBefore(earliestMsgId),
                limitToLast(20)
            );
            const snapshot = await get(olderQuery);
            if (snapshot.exists()) {
                const val = snapshot.val();
                olderMsgs = Object.entries(val).map(([id, msg]) => ({ id, ...msg, chatId: chatId }));
                olderMsgs.sort((a, b) => a.id.localeCompare(b.id));

                for (const msg of olderMsgs) {
                    await cacheItem('messages', msg);
                }
            }
        }

        if (olderMsgs.length > 0) {
            const decryptedMsgs = [];
            const BATCH_SIZE = 4;
            while (olderMsgs.length > 0) {
                const batch = olderMsgs.splice(0, BATCH_SIZE);
                const decryptedBatch = await Promise.all(batch.map(msg => decryptMessageInPlace({ ...msg }, { cache: false })));
                decryptedMsgs.push(...decryptedBatch);
                await waitForBrowserIdle();
            }
            messages.unshift(...decryptedMsgs);
            for (const msg of decryptedMsgs) {
                displayMessage(msg, false, true);
            }
            container.scrollTop = container.scrollHeight - oldScrollHeight;
        }
    } catch (err) {
        console.error("Error loading older messages:", err);
    } finally {
        isLoadingOlderMessages = false;
    }
};

const getPendingMessagesQueue = () => {
    if (typeof localStorage === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(PENDING_MESSAGES_STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Failed to read pending messages queue:', error);
        return [];
    }
};

const persistPendingMessagesQueue = (queue) => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(PENDING_MESSAGES_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('Failed to persist pending messages queue:', error);
    }
};

const getCurrentNetworkStatus = async () => {
    if (typeof window === 'undefined') return true;
    const networkPlugin = window.Capacitor?.Plugins?.Network;
    if (networkPlugin && typeof networkPlugin.getStatus === 'function') {
        try {
            const status = await networkPlugin.getStatus();
            if (typeof status.connected === 'boolean') return status.connected;
            if (typeof status.online === 'boolean') return status.online;
        } catch (error) {
            console.warn('Unable to read Capacitor network status:', error);
        }
    }
    return navigator.onLine;
};

let currentNetworkOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

const isOnline = async () => {
    currentNetworkOnline = await getCurrentNetworkStatus();
    return currentNetworkOnline;
};

const queuePendingMessage = (messageData, chatId) => {
    const queue = getPendingMessagesQueue();
    const pendingMessage = { ...messageData, chatId };
    const existingIndex = queue.findIndex(item => item.id === pendingMessage.id);
    if (existingIndex >= 0) {
        queue[existingIndex] = pendingMessage;
    } else {
        queue.push(pendingMessage);
    }
    persistPendingMessagesQueue(queue);

    const existingMessage = messages.find(m => m.id === pendingMessage.id);
    if (existingMessage) {
        Object.assign(existingMessage, pendingMessage);
    } else {
        messages.push(pendingMessage);
    }

    if (elements.messagesContainer && activeChatUid && pendingMessage.chatId === chatId) {
        displayMessage(pendingMessage, false);
        // Update sidebar conversation preview immediately to show the queued text
        try {
            const previewEl = document.querySelector(`.conversation-item[data-uid="${activeChatUid}"] .conversation-preview`);
            if (previewEl) {
                const previewText = pendingMessage.previewText || (pendingMessage.isEncrypted ? '🔒 [Encrypted]' : (pendingMessage.text || ''));
                // Show a pending indicator for queued messages
                previewEl.innerHTML = `${pendingMessage.senderId === auth.currentUser.uid ? 'You: ' : ''}${previewText} <span class="pending-preview" style="margin-left:6px; opacity:0.8; font-size:0.85em;">⏳</span>`;
            }
        } catch (e) {
            console.warn('Failed to update conversation preview for queued message:', e);
        }
    }
};

const removePendingMessageFromQueue = (messageId) => {
    const queue = getPendingMessagesQueue().filter(item => item.id !== messageId);
    persistPendingMessagesQueue(queue);
};

const getChatIdForEntry = (userId, entryId) => {
    if (!entryId) return null;
    return entryId.startsWith('group_') ? entryId : [userId, entryId].sort().join('_');
};

const ensurePendingMessageSync = () => {
    if (pendingMessageSyncListenerAttached || typeof window === 'undefined') return;
    pendingMessageSyncListenerAttached = true;
    window.addEventListener('online', () => {
        flushPendingMessages();
        markAllKnownChatsDelivered().catch(err => {
            console.warn('Error marking delivered messages on reconnect via browser online:', err);
        });
    });
    window.addEventListener('offline', () => {
        currentNetworkOnline = false;
    });

    const networkPlugin = window.Capacitor?.Plugins?.Network;
    if (networkPlugin && typeof networkPlugin.addListener === 'function') {
        networkPlugin.addListener('networkStatusChange', (status) => {
            const connected = typeof status.connected === 'boolean' ? status.connected : (typeof status.online === 'boolean' ? status.online : false);
            currentNetworkOnline = connected;
            if (connected) {
                flushPendingMessages();
                markAllKnownChatsDelivered().catch(err => {
                    console.warn('Error marking delivered messages on reconnect via native network:', err);
                });
            }
        });
    }
};

const flushPendingMessages = async () => {
    if (pendingMessageSyncInFlight || !(await isOnline())) return;
    pendingMessageSyncInFlight = true;

    const queue = getPendingMessagesQueue();
    if (queue.length === 0) {
        pendingMessageSyncInFlight = false;
        return;
    }

    const remaining = [];
    for (const pendingMessage of queue) {
        try {
            await saveMessage(pendingMessage.chatId, { ...pendingMessage, status: 'notified' }, pendingMessage.id);
            const localMessage = messages.find(m => m.id === pendingMessage.id);
            if (localMessage) {
                localMessage.status = 'notified';
            }
            const displayMsg = { ...pendingMessage, status: 'notified' };
            if (displayMsg.isEncrypted) {
                try {
                    await decryptMessageInPlace(displayMsg, { cache: false });
                } catch (decryptError) {
                    console.warn('Failed to decrypt outgoing queued message locally:', decryptError);
                }
            }
            displayMessage(displayMsg, false);
            // Remove pending indicator from sidebar preview (will also be updated by DB listener)
            try {
                const uid = pendingMessage.chatId.includes('_') ? pendingMessage.chatId.split('_').find(id => id !== auth.currentUser.uid) : pendingMessage.chatId;
                const previewEl = document.querySelector(`.conversation-item[data-uid="${uid}"] .conversation-preview`);
                if (previewEl) {
                    const previewText = pendingMessage.previewText || pendingMessage.text || '';
                    previewEl.innerHTML = `${pendingMessage.senderId === auth.currentUser.uid ? 'You: ' : ''}${previewText}`;
                }
            } catch (e) {
                // ignore
            }
        } catch (error) {
            const message = error && error.message ? error.message : String(error);
            const shouldRetry = !navigator.onLine || /offline|network|failed to fetch|err_network|internet_disconnected/i.test(message);
            if (shouldRetry) {
                remaining.push(pendingMessage);
            } else {
                console.error('Failed to sync queued message:', error);
            }
        }
    }

    persistPendingMessagesQueue(remaining);
    pendingMessageSyncInFlight = false;
};

ensurePendingMessageSync();

const markAllKnownChatsDelivered = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const chatIds = Object.keys(currentChatListIds || {});
    if (chatIds.length === 0) return;

    await Promise.all(chatIds.map(async (chatId) => {
        try {
            await markMessagesAsDelivered(chatId, user.uid);
        } catch (err) {
            console.warn(`Failed to mark delivered on reconnect for chat ${chatId}:`, err);
        }
    }));
};

window.addEventListener('online', () => {
    markAllKnownChatsDelivered().catch(err => {
        console.warn('Error marking delivered messages on reconnect:', err);
    });
});

const sendMessage = async () => {
    const text = elements.messageInput?.value.trim();
    const user = auth.currentUser;
    if (!text || !user || !activeChatUid) return;

    if (chatInitializationGate.isInitializing) {
        await chatInitializationGate.wait();
    }

    const replyData = replyingTo ? { ...replyingTo } : null;
    const chatId = activeChatUid.startsWith('group_') ? activeChatUid : [user.uid, activeChatUid].sort().join('_');

    let otherProfile = null;
    if (!activeChatUid.startsWith('group_')) {
        otherProfile = allUsersCache[activeChatUid] || await getUserProfile(activeChatUid);
        if (otherProfile && otherProfile.blockedUsers && otherProfile.blockedUsers[user.uid]) {
            showToast("You cannot send messages to this contact because they have blocked you.", "error");
            return;
        }
    }
    const isE2EE = otherProfile && otherProfile.publicKey;

    if (editingMessageId) {
        if (isE2EE) {
            const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
            if (sharedKey) {
                const payload = { text: text };
                const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                await updateMessage(chatId, editingMessageId, {
                    text: encrypted.ciphertext,
                    isEncrypted: true,
                    iv: encrypted.iv,
                    edited: true
                });
                hideEditPreview();
                updateTypingPresence(false);
                if (elements.messageInput) {
                    elements.messageInput.value = '';
                    elements.messageInput.style.height = 'auto';
                }
                toggleInputButtons();
                hideTypingIndicator();
                return;
            }
        }
        await updateMessage(chatId, editingMessageId, { text: text, edited: true });
        hideEditPreview();
    } else {
        if (sendInFlight) return; // prevent duplicate rapid sends
        sendInFlight = true;
        try {
            const messageData = {
                senderId: user.uid,
                chatId: chatId,
                text: text,
                previewText: text,
                type: 'text',
                timestamp: Date.now(),
                ephemeralExpiry: ephemeralExpiryDuration > 0 ? Date.now() + ephemeralExpiryDuration : null,
                replyTo: replyData
            };

            if (isE2EE) {
                const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
                if (sharedKey) {
                    const payload = {
                        text: text,
                        replyTo: replyData
                    };
                    const encrypted = await encryptText(JSON.stringify(payload), sharedKey);
                    messageData.text = encrypted.ciphertext;
                    messageData.isEncrypted = true;
                    messageData.iv = encrypted.iv;
                    messageData.replyTo = null;
                }
            }

            const messageId = push(ref(db, `messages/${chatId}`)).key;
            const pendingMessageData = {
                ...messageData,
                id: messageId,
                status: 'pending'
            };

            // Immediately render the pending message and clear the input to
            // give instant feedback and prevent accidental double-sends.
            try {
                displayMessage(pendingMessageData, false);
            } catch (e) {
                console.warn('Failed to display pending message immediately:', e);
            }
            if (elements.messageInput) {
                elements.messageInput.value = '';
                elements.messageInput.style.height = 'auto';
            }
            toggleInputButtons();

            if (!(await isOnline())) {
                queuePendingMessage(pendingMessageData, chatId);
                showToast('You are offline. Message queued and will send when you are back online.', 'info');
            } else {
                try {
                    await saveMessage(chatId, pendingMessageData, messageId);
                    removePendingMessageFromQueue(messageId);
                    const displayMsg = { ...pendingMessageData, status: 'notified' };
                    if (displayMsg.isEncrypted) {
                        try {
                            await decryptMessageInPlace(displayMsg, { cache: false });
                        } catch (decryptError) {
                            console.warn('Failed to decrypt outgoing message locally:', decryptError);
                        }
                    }
                    // Update the rendered message to 'sent'
                    displayMessage(displayMsg, false);
                } catch (error) {
                    const message = error && error.message ? error.message : String(error);
                    const shouldQueue = !(await isOnline()) || /offline|network|failed to fetch|err_network|internet_disconnected/i.test(message);
                    if (shouldQueue) {
                        queuePendingMessage(pendingMessageData, chatId);
                        showToast('You are offline. Message queued and will send when you are back online.', 'info');
                    } else {
                        showToast('Unable to send message right now.', 'error');
                    }
                }
            }

            hideReplyPreview();
        } finally {
            sendInFlight = false;
        }
    }

    updateTypingPresence(false);

    if (elements.messageInput) {
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
    }
    ephemeralExpiryDuration = 0;
    toggleInputButtons();
    hideTypingIndicator();
};

const openContextMenu = (msgId, x, y) => {
    contextMenuTargetId = msgId;
    const menu = elements.messageContextMenu;
    if (!menu) return;

    // Hide reaction picker if open
    if (elements.reactionPicker) elements.reactionPicker.style.display = 'none';
    reactionPickerTargetId = null;

    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const user = auth.currentUser;
    const isMine = user && msg.senderId === user.uid;

    // Reset visibility of context menu items
    menu.querySelectorAll('.context-menu-item').forEach(item => item.style.display = 'flex'); // Default to flex
    menu.querySelectorAll('.context-menu-divider').forEach(div => div.style.display = 'block');

    const deleteBtn = menu.querySelector('[data-action="delete"]');
    if (deleteBtn) deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';

    if (msg.deleted) {
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            if (!['delete', 'info', 'select'].includes(item.dataset.action)) {
                item.style.display = 'none'; // Hide irrelevant options for deleted messages
            }
        });
        if (deleteBtn) deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete for me';
        menu.querySelectorAll('.context-menu-divider').forEach(div => div.style.display = 'none');
    } else {
        const copyBtn = menu.querySelector('[data-action="copy"]');
        if (copyBtn) copyBtn.style.display = msg.type === 'text' ? 'flex' : 'none';

        const editBtn = menu.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.style.display = 'none';
        }

        const editImageBtn = menu.querySelector('[data-action="edit-image"]');
        if (editImageBtn) {
            editImageBtn.style.display = msg.type === 'image' ? 'flex' : 'none';
        }

        const signDocBtn = menu.querySelector('[data-action="sign-document"]');
        if (signDocBtn) {
            const isPdf = msg.type === 'document' && msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf');
            signDocBtn.style.display = isPdf ? 'flex' : 'none';
        }

        // Show 'React' button for non-deleted messages
        const reactBtn = menu.querySelector('[data-action="react"]');
        if (reactBtn) reactBtn.style.display = 'flex';
    }

    const pinBtn = menu.querySelector('[data-action="pin"], [data-action="unpin"]');
    if (pinBtn) {
        const isPinned = pinnedMessageData && pinnedMessageData.msgId === msgId;
        pinBtn.innerHTML = isPinned ? '<i class="fa-solid fa-thumbtack"></i> Unpin' : '<i class="fa-solid fa-thumbtack"></i> Pin';
        pinBtn.dataset.action = isPinned ? 'unpin' : 'pin';
    }

    // Hide 'React' button if message is deleted
    const reactBtn = menu.querySelector('[data-action="react"]');
    if (reactBtn && msg.deleted) reactBtn.style.display = 'none';

    menu.style.display = 'flex';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
};

const updateTypingPresence = (isTyping) => {
    const user = auth.currentUser;
    if (!user || !activeChatUid || activeChatUid.startsWith('group_') || isCurrentlyTypingInDb === isTyping) return;

    isCurrentlyTypingInDb = isTyping;
    setTypingStatus(user.uid, activeChatUid, isTyping);
};

let typingDbTimeout;
let typingTimeout;
const showTypingIndicator = () => {
    if (elements.typingIndicator) {
        elements.typingIndicator.innerHTML = `
            <span class="typing-text">typing</span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        `;
        elements.typingIndicator.style.display = 'flex';
    }
};

const hideTypingIndicator = () => {
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = 'none';
    }
};

const formatLastSeen = (profile, useInteractionTime = false, otherUid = null) => {
    if (profile.online && !useInteractionTime) {
        const theirOnlinePrivacy = profile.onlinePrivacy || 'anyone';
        const isFriend = otherUid ? !!moduleFriendsList[otherUid] : false;

        // Reciprocity: If I hide mine, I can't see theirs. Or if they hide theirs.
        const allowedByMe = isAllowedByPrivacy(currentUserOnlinePrivacy, isFriend, isUserExcluded(excludedContacts, otherUid));
        const allowedByThem = isAllowedByPrivacy(theirOnlinePrivacy, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid));

        if (allowedByMe && allowedByThem) return '<span class="status-online">Online</span>';
    }

    // Privacy enforcement for "Last Seen" status in Chat Header
    if (!useInteractionTime) {
        const theirPrivacy = profile.lastSeenPrivacy || 'anyone';
        const isFriend = otherUid ? !!moduleFriendsList[otherUid] : false;

        // Reciprocity: If I hide mine, I can't see theirs. Or if they hide theirs.
        const allowedByMe = isAllowedByPrivacy(currentUserLastSeenPrivacy, isFriend, isUserExcluded(excludedContacts, otherUid));
        const allowedByThem = isAllowedByPrivacy(theirPrivacy, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid));

        if (!allowedByMe || !allowedByThem) return '';
    }

    const timestamp = useInteractionTime ? profile.lastInteraction : profile.lastSeen;
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
    const startOfLastWeek = startOfToday - (6 * 24 * 60 * 60 * 1000);

    if (timestamp >= startOfToday) {
        return useInteractionTime ? timeStr : `last seen today at ${timeStr}`;
    } else if (timestamp >= startOfYesterday) {
        return useInteractionTime ? 'Yesterday' : `last seen yesterday at ${timeStr}`;
    } else if (timestamp >= startOfLastWeek && useInteractionTime) {
        return date.toLocaleDateString([], { weekday: 'long' });
    } else {
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return useInteractionTime ? dateStr : `last seen ${dateStr} at ${timeStr}`;
    }
};

/**
 * Helper to determine if a user's online status should be visible based on privacy settings and reciprocity.
 */
const shouldShowOnline = (profile, uid) => {
    if (!profile.online) return false;
    const theirPrivacy = profile.onlinePrivacy || 'anyone';
    const isFriend = !!moduleFriendsList[uid];

    const allowedByMe = isAllowedByPrivacy(currentUserOnlinePrivacy, isFriend, isUserExcluded(excludedContacts, uid));
    const allowedByThem = isAllowedByPrivacy(theirPrivacy, isFriend, isUserExcluded(profile.excludedContacts, auth.currentUser.uid));

    return allowedByMe && allowedByThem;
};

/**
 * Generates the preview text for the sidebar, prioritizing typing status
 */
const getPreviewContent = (profile, currentUserId, isRecentSidebar) => {
    if (profile.typingTo === currentUserId) {
        return `<span class="status-typing">
            <span class="typing-text">typing</span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
           </span>`;
    }

    if (isRecentSidebar) {
        if (profile.lastMessage) {
            const isOrder = (profile.lastMessageType === 'document' && profile.lastMessageFileName && profile.lastMessageFileName.startsWith('Invoice_')) || profile.lastMessageType === 'invoice';
            if (isOrder) {
                const label = profile.lastMessageFileName || (profile.lastMessage ? profile.lastMessage.replace('📄 ', '') : 'Order');
                return profile.lastSenderId === currentUserId
                    ? `You: 📦 Order (${label})`
                    : `📦 Order (${label})`;
            }
            return `${profile.lastSenderId === currentUserId ? 'You: ' : ''}${profile.lastMessage}`;
        }
        return 'Click to continue chatting';
    }
    return 'Click to start chatting';
};

export const renderUserList = (users, container, currentUserId, isRecentSidebar = false, isArchivedSidebar = false, isStarredSidebar = false) => {
    if (!container) return;
    container.innerHTML = '';

    // Convert to array and sort: Online users first, then by last seen
    const sortedUsers = Object.entries(users)
        .filter(([uid]) => uid !== currentUserId)
        .filter(([, profile]) => !!profile) // Ensure profile is not null/undefined
        .sort(([, a], [, b]) => {
            if (container.getAttribute('data-ui') === 'cust-conversation-list') {
                const nameA = (a.fullname || '').trim().toLowerCase();
                const nameB = (b.fullname || '').trim().toLowerCase();
                return nameA.localeCompare(nameB);
            }
            const timeA = isRecentSidebar ? (a.lastInteraction || 0) : (a.lastSeen || 0);
            const timeB = isRecentSidebar ? (b.lastInteraction || 0) : (b.lastSeen || 0);
            return timeB - timeA;
        });

    sortedUsers.forEach(([uid, profile]) => {
        const name = profile.fullname || 'Unknown User';
        const initials = name.charAt(0).toUpperCase();
        const timeSummary = profile.isGroup
            ? (profile.lastInteraction ? getRelativeTime(profile.lastInteraction) : '')
            : (isArchivedSidebar ? getRelativeTime(profile.lastInteraction) : (isStarredSidebar ? '' : formatLastSeen(profile, isRecentSidebar)));
        const previewText = isStarredSidebar ? '' : getPreviewContent(profile, currentUserId, isRecentSidebar); // No preview text for starred sidebar
        const isMuted = !!mutedUsers[uid];
        const mutedIconHtml = `<i class="fa-solid fa-bell-slash muted-icon" title="Notifications Silenced" style="display: ${isMuted ? 'inline-block' : 'none'};"></i>`;

        const avatarHtml = getAvatarHtml(profile, uid);
        const canSeeOnline = !profile.isGroup && shouldShowOnline(profile, uid);
        const isOrderLast = !profile.isGroup && ((profile.lastMessageType === 'document' && profile.lastMessageFileName && profile.lastMessageFileName.startsWith('Invoice_')) || profile.lastMessageType === 'invoice') && profile.lastSenderId === uid;

        const html = `
            <div class="conversation-item ${canSeeOnline ? 'online' : ''} ${uid === activeChatUid ? 'active' : ''}" data-uid="${uid}" data-ui="conversation-item">
                <div class="conversation-avatar" style="position: relative;">
                    ${avatarHtml}
                    <div class="online-dot"></div>
                    <div class="order-notif-badge" style="display: ${isOrderLast ? 'flex' : 'none'}; position: absolute; top: -4px; left: -4px; background: #ff9800; color: white; border-radius: 50%; width: 18px; height: 18px; align-items: center; justify-content: center; border: 1.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 5; font-size: 0.65rem;" title="Order Received">📦</div>
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <div class="conversation-name" data-name="${name}">${name}${mutedIconHtml}</div>
                        <div class="conversation-time">${timeSummary}</div>
                    </div>
                    <div class="conversation-preview">${previewText}</div>
                </div>
                <span class="unread-badge" style="display: none;">0</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);

        const conversationItem = container.lastElementChild;
        const previewEl = conversationItem.querySelector('.conversation-preview');
        const timeEl = conversationItem.querySelector('.conversation-time');

        if (profile.lastMessageIsEncrypted) {
            decryptPreviewText(uid, profile, currentUserId, previewEl);
        }

        if (uid.startsWith('group_')) {
            subscribeToGroupProfile(uid, (updatedGroup) => {
                if (!updatedGroup || !conversationItem) return;
                const merged = { ...profile, ...updatedGroup };
                conversationItem.classList.toggle('online', false);
                if (timeEl) timeEl.innerHTML = merged.lastInteraction ? getRelativeTime(merged.lastInteraction) : '';
                if (previewEl) {
                    previewEl.innerHTML = getPreviewContent(merged, currentUserId, isRecentSidebar);
                }
                const nameEl = conversationItem.querySelector('.conversation-name');
                if (nameEl) {
                    const isMuted = !!mutedUsers[uid];
                    nameEl.innerHTML = `${merged.name || merged.fullname}<i class="fa-solid fa-bell-slash muted-icon" title="Notifications Silenced" style="display: ${isMuted ? 'inline-block' : 'none'};"></i>`;
                }
                const avatarContainer = conversationItem.querySelector('.conversation-avatar');
                if (avatarContainer) {
                    avatarContainer.innerHTML = getAvatarHtml(merged, uid);
                }
            });
        } else {
            subscribeToUserProfile(uid, (updatedProfile) => {
                if (!updatedProfile || !conversationItem) return;

                const merged = { ...profile, ...updatedProfile };
                const showOnline = shouldShowOnline(merged, uid);
                conversationItem.classList.toggle('online', showOnline && !isArchivedSidebar && !isStarredSidebar);

                if (timeEl) timeEl.innerHTML = formatLastSeen(merged, isRecentSidebar, uid);
                if (previewEl) {
                    if (merged.lastMessageIsEncrypted) {
                        decryptPreviewText(uid, merged, currentUserId, previewEl);
                    } else {
                        previewEl.innerHTML = getPreviewContent(merged, currentUserId, isRecentSidebar);
                    }
                }

                // Live update avatar and name in sidebar
                const avatarContainer = conversationItem.querySelector('.conversation-avatar');
                const nameEl = conversationItem.querySelector('.conversation-name');

                if (avatarContainer) {
                    const newAvatarHtml = getAvatarHtml(merged, uid);
                    // Preserve the online dot
                    const dot = avatarContainer.querySelector('.online-dot');
                    const isOrder = ((merged.lastMessageType === 'document' && merged.lastMessageFileName && merged.lastMessageFileName.startsWith('Invoice_')) || merged.lastMessageType === 'invoice') && merged.lastSenderId === uid;
                    avatarContainer.innerHTML = newAvatarHtml;
                    if (dot) avatarContainer.appendChild(dot);

                    // Re-add order notif badge
                    const orderBadge = document.createElement('div');
                    orderBadge.className = 'order-notif-badge';
                    orderBadge.style.cssText = `display: ${isOrder ? 'flex' : 'none'}; position: absolute; top: -4px; left: -4px; background: #ff9800; color: white; border-radius: 50%; width: 18px; height: 18px; align-items: center; justify-content: center; border: 1.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 5; font-size: 0.65rem;`;
                    orderBadge.title = 'Order Received';
                    orderBadge.innerHTML = '📦';
                    avatarContainer.appendChild(orderBadge);
                }
                if (nameEl) {
                    const isMuted = !!mutedUsers[uid];
                    nameEl.innerHTML = `${merged.fullname}<i class="fa-solid fa-bell-slash muted-icon" title="Notifications Silenced" style="display: ${isMuted ? 'inline-block' : 'none'};"></i>`;
                }
            });
        }

        // Setup real-time unread count for this specific sidebar item
        const chatId = uid.startsWith('group_') ? uid : [currentUserId, uid].sort().join('_');
        const badge = container.lastElementChild.querySelector('.unread-badge');
        const unreadUnsubscribe = subscribeToUnreadCount(chatId, currentUserId, (count, hasUnreadOrder) => {
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'grid' : 'none';
            }

            // Real-time order notification badge toggle
            const avatarContainer = conversationItem.querySelector('.conversation-avatar');
            if (avatarContainer) {
                let orderBadge = avatarContainer.querySelector('.order-notif-badge');
                if (!orderBadge) {
                    orderBadge = document.createElement('div');
                    orderBadge.className = 'order-notif-badge';
                    orderBadge.style.cssText = `position: absolute; top: -4px; left: -4px; background: #ff9800; color: white; border-radius: 50%; width: 18px; height: 18px; align-items: center; justify-content: center; border: 1.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 5; font-size: 0.65rem;`;
                    orderBadge.title = 'Order Received';
                    orderBadge.innerHTML = '📦';
                    avatarContainer.appendChild(orderBadge);
                }

                const isOrder = hasUnreadOrder || (((profile.lastMessageType === 'document' && profile.lastMessageFileName && profile.lastMessageFileName.startsWith('Invoice_')) || profile.lastMessageType === 'invoice') && profile.lastSenderId === uid);
                orderBadge.style.display = isOrder ? 'flex' : 'none';
                if (hasUnreadOrder) {
                    orderBadge.classList.add('pulse');
                    orderBadge.style.background = '#ff5722'; // Pulsing orange-red for urgent unread order
                } else {
                    orderBadge.classList.remove('pulse');
                    orderBadge.style.background = '#ff9800'; // Steady orange for regular last message order
                }
            }
        });
        unreadCountUnsubscribes.set(chatId, unreadUnsubscribe);

        // Attach context menu for archived items
        if (isArchivedSidebar) {
            conversationItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openArchivedChatContextMenu(uid, e.clientX, e.clientY);
            });
            // For mobile long press
            conversationItem.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => openArchivedChatContextMenu(uid, e.touches[0].clientX, e.touches[0].clientY), 800);
            }, { passive: true });
            conversationItem.addEventListener('touchend', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchmove', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
        }

        // Attach context menu for starred items (if applicable)
        if (isStarredSidebar) {
            conversationItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // openStarredChatContextMenu(uid, e.clientX, e.clientY); // Placeholder for starred context menu
                showToast("Starred chat context menu coming soon", "info");
            });
            // For mobile long press
            conversationItem.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => showToast("Starred chat context menu coming soon", "info"), 800);
            }, { passive: true });
            conversationItem.addEventListener('touchend', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchmove', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
        }

        // Attach context menu for active chat list
        if (isRecentSidebar && !isArchivedSidebar && !isStarredSidebar && container !== elements.custConversationList) {
            conversationItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openActiveChatContextMenu(uid, e.clientX, e.clientY);
            });
            // For mobile long press
            conversationItem.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => openActiveChatContextMenu(uid, e.touches[0].clientX, e.touches[0].clientY), 800);
            }, { passive: true });
            conversationItem.addEventListener('touchend', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchmove', () => clearTimeout(longPressTimer));
            conversationItem.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
        }
    });
};

const updateRequestActionButtonState = (uid = null) => {
    const btn = elements.requestToMessageBtn;
    if (!btn) return;

    const targetUid = uid || btn.dataset.uid;
    if (!targetUid) return;

    const hasPendingRequest = !!(currentOutgoingRequests && currentOutgoingRequests[targetUid]);
    if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent.trim() || 'Send Request to Chat';
    }

    const originalText = btn.dataset.originalText || 'Send Request to Chat';
    btn.textContent = hasPendingRequest ? 'Request Sent' : originalText;
    btn.disabled = hasPendingRequest;
    btn.style.opacity = hasPendingRequest ? '0.6' : '1';
};

const updateRequestBadges = () => {
    const { incomingCount, outgoingCount } = countPendingRequestBreakdown({
        incomingRequests: currentIncomingRequests || {},
        outgoingRequests: currentOutgoingRequests || {}
    });

    const totalCount = incomingCount + outgoingCount;

    if (elements.requestCountBadge) {
        elements.requestCountBadge.textContent = totalCount;
        elements.requestCountBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }
    if (elements.headerIncomingRequestBadge) {
        elements.headerIncomingRequestBadge.textContent = incomingCount;
        elements.headerIncomingRequestBadge.style.display = incomingCount > 0 ? 'inline-block' : 'none';
    }
    if (elements.headerOutgoingRequestBadge) {
        elements.headerOutgoingRequestBadge.textContent = outgoingCount;
        elements.headerOutgoingRequestBadge.style.display = outgoingCount > 0 ? 'inline-block' : 'none';
    }
};

const handleManageCustomers = async (requestFilter = activeRequestFilter) => {
    const user = auth.currentUser;
    if (!user) return;

    const [allUsers, listSnap, historySnap, requestsSnap, sentSnap] = await Promise.all([
        getAllUsers(),
        get(ref(db, `users/${user.uid}/customerList`)),
        get(ref(db, `users/${user.uid}/customerHistory`)),
        get(ref(db, `users/${user.uid}/friendRequests`)),
        get(ref(db, `users/${user.uid}/sentRequests`))
    ]);

    const container = elements.manageUsersList;
    if (!container) return;

    let currentList = listSnap.val() || {};
    let currentHistory = historySnap.val() || {};
    let currentRequests = requestsSnap.val() || {};
    currentSentRequests = sentSnap.val() || {};

    if (elements.manageCustomersModal) elements.manageCustomersModal.style.display = 'flex';

    const modalTitle = elements.manageCustomersModal?.querySelector('h3');
    const modalSubtitle = elements.manageCustomersModal?.querySelector('[data-ui="manage-customers-subtitle"]');
    const searchSections = elements.manageCustomersModal?.querySelectorAll('.search-box, .auth-divider');
    const recentSearches = elements.recentCustomerSearches;

    if (activeManageTab === 'requests') {
        if (modalTitle) modalTitle.textContent = requestFilter === 'incoming' ? 'Incoming Requests' : requestFilter === 'outgoing' ? 'Outgoing Requests' : 'Friend Requests';
        if (modalSubtitle) {
            const subtitleText = requestFilter === 'incoming'
                ? 'Only pending incoming requests'
                : requestFilter === 'outgoing'
                    ? 'Only pending outgoing requests'
                    : 'All pending requests';
            modalSubtitle.textContent = subtitleText;
            modalSubtitle.style.display = 'block';
        }
        searchSections?.forEach(el => el.style.display = 'none');
        if (recentSearches) recentSearches.style.display = 'none';
    } else {
        if (modalSubtitle) modalSubtitle.style.display = 'none';
        if (modalTitle) modalTitle.textContent = 'Find New Customers';
        searchSections?.forEach(el => el.style.display = 'flex');
    }

    const tabsToHighlight = {
        'added': elements.manageCustomersTabAdded,
        'new': elements.manageCustomersTabNew,
        'requests': elements.manageCustomersTabRequests
    };
    Object.values(tabsToHighlight).forEach(t => t?.classList.remove('active'));
    const activeTabEl = tabsToHighlight[activeManageTab];
    if (activeTabEl) activeTabEl.classList.add('active');

    const render = () => {
        container.innerHTML = '';
        const term = activeManageTab === 'requests' ? '' : (elements.manageCustomersSearch?.value.toLowerCase().trim() || '');

        let filteredUsers = [];

        if (activeManageTab === 'requests') {
            const pendingUserIds = new Set([
                ...(requestFilter === 'incoming' ? Object.keys(currentRequests || {}).filter(uid => !!currentRequests[uid]) : []),
                ...(requestFilter === 'outgoing' ? Object.keys(currentSentRequests || {}).filter(uid => !!currentSentRequests[uid]) : []),
                ...(requestFilter === 'all' ? [
                    ...Object.keys(currentRequests || {}).filter(uid => !!currentRequests[uid]),
                    ...Object.keys(currentSentRequests || {}).filter(uid => !!currentSentRequests[uid])
                ] : [])
            ]);

            filteredUsers = Array.from(pendingUserIds).map((uid) => [uid, allUsers[uid] || { fullname: 'Unknown User' }]).filter(([uid, profile]) => {
                if (uid === user.uid) return false;
                if (!profile) return false;
                const hasIncoming = !!currentRequests[uid];
                const hasOutgoing = !!currentSentRequests[uid];
                if (requestFilter === 'incoming') return hasIncoming && !hasOutgoing;
                if (requestFilter === 'outgoing') return hasOutgoing && !hasIncoming;
                return shouldShowUserInRequestsModal({ hasIncomingRequest: hasIncoming, hasSentRequest: hasOutgoing });
            });
        } else {
            filteredUsers = Object.entries(allUsers).filter(([uid, profile]) => {
                if (uid === user.uid) return false;

                // Global check: Skip users with missing profile data to prevent "undefined" errors in UI
                if (!profile || !profile.fullname) return false;

                // For finding new people or searching added ones, require an active search term
                if (!term) return false;

                const name = (profile.fullname || '').toLowerCase();
                const email = (profile.email || '').toLowerCase();
                const phone = (profile.phoneNumber || '').toLowerCase();
                const matchesSearch = name.includes(term) || email.includes(term) || phone.includes(term) || uid.toLowerCase().includes(term);

                if (activeManageTab === 'added') return matchesSearch && !!currentHistory[uid] && !currentRequests[uid] && !currentSentRequests[uid];
                if (activeManageTab === 'new') {
                    return matchesSearch && shouldShowUserInNewCustomersTab({
                        isCustomer: !!currentList[uid],
                        hasIncomingRequest: !!currentRequests[uid],
                        hasSentRequest: !!currentSentRequests[uid]
                    });
                }
                return false;
            });
        }

        filteredUsers.forEach(([uid, profile]) => {
            const isCustomer = !!currentList[uid];
            const wasCustomer = !!currentHistory[uid];
            const sentTimestamp = currentSentRequests[uid];
            const hasSentRequest = !!sentTimestamp;
            // 86400000 ms = 24 hours
            const isIgnoredLongTime = hasSentRequest && (typeof sentTimestamp === 'number') && (Date.now() - sentTimestamp > 86400000);

            let btnHtml = '';

            if (activeManageTab === 'requests') {
                if (currentSentRequests[uid]) {
                    const resendBtn = isIgnoredLongTime ? `<button class="customer-toggle-btn resend-req" data-uid="${uid}" style="background:var(--brand);color:white;margin-right:5px;">Resend</button>` : '';
                    btnHtml = `${resendBtn}<button class="customer-toggle-btn cancel-req" data-uid="${uid}" style="background:#ff4d4d;color:white;">Cancel Request</button>`;
                } else {
                    btnHtml = `<button class="customer-toggle-btn view-profile-btn" data-uid="${uid}" style="background:var(--brand-dark);color:white;">View</button>
                               <button class="customer-toggle-btn accept-req" data-uid="${uid}">Accept</button>
                               <button class="customer-toggle-btn decline-req" data-uid="${uid}" style="background:#ff4d4d;color:white;">Decline</button>`;
                }
            } else if (activeManageTab === 'added') {
                btnHtml = `<button class="customer-toggle-btn toggle-active" data-uid="${uid}">${isCustomer ? 'Remove' : 'Add Again'}</button>`;
            } else if (hasSentRequest) {
                const resendBtn = isIgnoredLongTime ? `<button class="customer-toggle-btn resend-req" data-uid="${uid}" style="background:var(--brand);color:white;margin-right:5px;">Resend</button>` : '';
                btnHtml = `${resendBtn}<button class="customer-toggle-btn cancel-req" data-uid="${uid}" style="background:#ff4d4d;color:white;">Cancel Request</button>`;
            } else {
                btnHtml = `<button class="customer-toggle-btn send-req" data-uid="${uid}">Send Request</button>`;
            }

            const pendingBadge = activeManageTab === 'requests'
                ? (() => {
                    const hasIncoming = !!currentRequests[uid];
                    const hasOutgoing = !!currentSentRequests[uid];
                    const label = hasIncoming && hasOutgoing ? 'Pending' : (hasOutgoing ? 'Sent' : 'Received');
                    const color = hasOutgoing ? '#0f766e' : '#7c3aed';
                    const bg = hasOutgoing ? '#ccfbf1' : '#ede9fe';
                    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 9px;border-radius:999px;background:${bg};color:${color};font-size:0.75rem;font-weight:700;">${hasOutgoing ? '↗' : '↙'} ${label}</span>`;
                })()
                : '';

            const previewSubtitle = profile.phoneNumber || profile.email || 'No contact info';
            const previewMeta = activeManageTab === 'requests'
                ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
                    <span style="font-size:0.72rem;color:var(--muted);">${previewSubtitle}</span>
                    ${pendingBadge}
                </div>`
                : `<div class="conversation-preview">${previewSubtitle}</div>`;

            const previewBadge = activeManageTab === 'requests' ? '' : `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="font-size:0.72rem;color:var(--muted);">${profile.phoneNumber ? 'Phone contact' : 'Email contact'}</span>
            </div>`;

            const isMobileCompactLayout = window.matchMedia('(max-width: 768px)').matches && (activeManageTab === 'new' || activeManageTab === 'requests');
            const html = isMobileCompactLayout
                ? `
                    <div class="manage-customer-mobile-card ${!isCustomer && wasCustomer ? 'is-removed' : ''}" data-uid="${uid}">
                        <button class="manage-customer-avatar-btn" data-uid="${uid}" data-action="open-profile" title="View profile">
                            <div class="conversation-avatar">${getAvatarHtml(profile, uid)}</div>
                        </button>
                        <div class="manage-customer-mobile-meta">
                            <div class="conversation-name">${profile.fullname || 'Unknown User'}</div>
                            <div class="conversation-preview">${previewSubtitle}</div>
                        </div>
                        <div class="manage-customer-mobile-actions">${btnHtml}</div>
                    </div>`
                : `
                    <div class="conversation-item ${!isCustomer && wasCustomer ? 'is-removed' : ''}" data-uid="${uid}">
                        <div class="conversation-avatar">${getAvatarHtml(profile, uid)}</div>
                        <div class="conversation-info" style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; cursor:pointer;" data-uid="${uid}" data-action="open-profile">
                            <div class="conversation-name" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                <span>${profile.fullname || 'Unknown User'}</span>
                                ${activeManageTab === 'requests' ? '<span style="font-size:0.72rem;color:var(--brand);font-weight:700;">Profile</span>' : ''}
                            </div>
                            ${previewMeta}
                            ${previewBadge}
                        </div>
                        <div style="display:flex; gap:5px; flex-shrink:0;">${btnHtml}</div>
                    </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
    };

    render();

    container.onclick = async (e) => {
        const target = e.target;
        const profileTrigger = target.closest('.manage-customer-avatar-btn, [data-action="open-profile"]');
        const sendRequestButton = target.closest('.send-req');
        const actionTarget = target.closest('[data-uid]');
        const uid = profileTrigger?.dataset.uid || actionTarget?.dataset.uid || sendRequestButton?.dataset.uid;
        if (!uid) return;

        if (profileTrigger || actionTarget?.classList.contains('view-profile-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const profile = allUsers[uid];
            if (profile) {
                if (elements.manageCustomersModal) elements.manageCustomersModal.style.display = 'none';
                
                let showReq = false;
                let mode = null;
                if (activeManageTab === 'requests') {
                    if (currentRequests && currentRequests[uid]) {
                        showReq = true;
                    } else if (currentSentRequests && currentSentRequests[uid]) {
                        mode = 'send-request';
                    }
                } else if (activeManageTab === 'new') {
                    mode = 'send-request';
                }
                
                showUserProfileInfo(uid, profile, showReq, mode);
            }
            return;
        }

        if (sendRequestButton || actionTarget?.classList.contains('send-req')) {
            animateRequestFlyer(sendRequestButton || actionTarget);
            await sendFriendRequest(user.uid, uid);
            showToast("Request sent!", "success");
            currentSentRequests[uid] = Date.now();
            currentOutgoingRequests[uid] = Date.now();
            updateRequestActionButtonState(uid);
            refreshChatSidebars();
            updateCustomerSidebar();
            render();
        } else if (actionTarget?.classList.contains('resend-req')) {
            await sendFriendRequest(user.uid, uid);
            showToast("Request resent!", "success");
            currentSentRequests[uid] = Date.now();
            currentOutgoingRequests[uid] = Date.now();
            updateRequestActionButtonState(uid);
            refreshChatSidebars();
            updateCustomerSidebar();
            render();
        } else if (actionTarget?.classList.contains('accept-req')) {
            await acceptFriendRequest(user.uid, uid);
            showToast("Request accepted!", "success");
            delete currentRequests[uid];
            currentList[uid] = true;
            currentHistory[uid] = true;
        } else if (actionTarget?.classList.contains('cancel-req')) {
            await declineFriendRequest(uid, user.uid);
            showToast("Request canceled!", "info");
            delete currentSentRequests[uid];
            delete currentOutgoingRequests[uid];
            updateRequestActionButtonState(uid);
            refreshChatSidebars();
            updateCustomerSidebar();
            render();
        } else if (actionTarget?.classList.contains('decline-req')) {
            await declineFriendRequest(user.uid, uid);
            delete currentRequests[uid];
        } else if (actionTarget?.classList.contains('toggle-active')) {
            const isAdding = actionTarget.textContent === 'Add Again';
            await toggleCustomerList(user.uid, uid, isAdding);
            if (isAdding) currentList[uid] = true;
            else delete currentList[uid];
        }
        render();
    };

    // Tab Switching
    const tabs = {
        'added': elements.manageCustomersTabAdded,
        'new': elements.manageCustomersTabNew,
        'requests': elements.manageCustomersTabRequests
    };
    Object.entries(tabs).forEach(([key, el]) => {
        if (!el) return;
        el.onclick = () => {
            activeManageTab = key;
            Object.values(tabs).forEach(t => t?.classList.remove('active'));
            el.classList.add('active');
            render();
        };
    });

    // Search listener
    elements.manageCustomersSearch?.addEventListener('input', render);
};

const updateMuteUI = () => {
    if (!elements.muteChatBtn || !activeChatUid) return;
    const isMuted = !!mutedUsers[activeChatUid];
    elements.muteChatBtn.innerHTML = isMuted
        ? '<i class="fa-solid fa-bell"></i> Unmute Chat'
        : '<i class="fa-solid fa-bell-slash"></i> Mute Chat';
    elements.muteChatBtn.title = isMuted ? 'Unmute Chat' : 'Mute Chat';
};

/**
 * Refreshes the active chat sidebar based on provided merged data.
 */
const updateActiveChatSidebar = (activeChats) => {
    const user = auth.currentUser;
    if (!user || !elements.chatConversationList) return;

    const filteredActive = {};
    Object.entries(activeChats).forEach(([id, profileWithMeta]) => {
        // Filter out pending friend requests from the main chat list
        if (currentIncomingRequests[id] || currentOutgoingRequests[id]) return;

        // Filter out locked chats
        if (isChatLocked && isChatLocked(id)) return;

        // Handle notification sounds for new incoming messages
        const prevInteraction = chatLastInteractions.get(id) || 0;
        const currentInteraction = profileWithMeta.lastInteraction || 0;

        if (!isFirstChatLoad && currentInteraction > prevInteraction && profileWithMeta.lastSenderId !== user.uid && notificationSoundsEnabled && !mutedUsers[id]) {
            playIncomingSound();
        }
        chatLastInteractions.set(id, currentInteraction);
        filteredActive[id] = profileWithMeta;
    });

    renderUserList(filteredActive, elements.chatConversationList, user.uid, true, false, false);
    isFirstChatLoad = false;
};

/**
 * Refreshes the archived chat sidebar.
 */
const updateArchivedChatSidebar = (archivedChats) => {
    const user = auth.currentUser;
    if (!user || !elements.archivedConversationList) return;

    // Filter out locked archived chats
    const filteredArchived = {};
    Object.entries(archivedChats).forEach(([id, data]) => {
        if (isChatLocked && isChatLocked(id)) return;
        filteredArchived[id] = data;
    });

    clearUnreadCountSubscriptions();
    renderUserList(filteredArchived, elements.archivedConversationList, user.uid, true, true, false);
};

const updateCustomerSidebar = () => {
    const user = auth.currentUser;
    if (!user || !allUsersCache) return;

    const customerUsers = buildCustomerSidebarUsers({
        moduleFriendsList,
        allUsersCache,
        currentChatListIds,
        isChatLocked: (id) => !!(isChatLocked && isChatLocked(id))
    });

    renderUserList(customerUsers, elements.custConversationList, user.uid, true);
};

const refreshChatSidebars = () => {
    if (!allUsersCache || Object.keys(allUsersCache).length === 0) return;

    clearUnreadCountSubscriptions();

    const activeChats = {};
    const archivedChats = {};

    Object.entries(currentChatListIds).forEach(([uid, entry]) => {
        const meta = typeof entry === 'object' ? entry : { lastInteraction: entry };
        let mergedData;
        if (uid.startsWith('group_')) {
            mergedData = {
                uid: uid,
                fullname: meta.groupName || "Group Chat",
                isGroup: true,
                ...meta
            };
        } else {
            if (!allUsersCache[uid]) return;
            mergedData = { ...allUsersCache[uid], ...meta };
        }

        if (meta.isArchived) archivedChats[uid] = mergedData;
        else activeChats[uid] = mergedData;
    });

    updateActiveChatSidebar(activeChats);
    updateArchivedChatSidebar(archivedChats);
};

const renderChatPlaceholder = () => {
    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = `
            <div class="chat-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted); text-align: center; padding: 20px;">
                <i class="fa-solid fa-comments" style="font-size: 4rem; margin-bottom: 16px; color: var(--brand);"></i>
                <h3>Welcome to Hotmapp</h3>
                <p>Please select a conversation from the sidebar list to start chatting.</p>
            </div>`;
    }
};

const showChatListView = () => {
    removeHistoryState('chat-view');
    elements.chatContainer?.classList.remove('viewing-chat');
    elements.mainAppContent?.classList.remove('header-hidden');
    toggleChatSearch(false);

    // Remove active chat selection class from chat area
    if (elements.chatArea) {
        elements.chatArea.classList.remove('active-chat-selected');
    }

    // On desktop, hide chat header and footer when no conversation is active
    if (window.innerWidth > 768) {
        if (elements.chatHeader) elements.chatHeader.style.display = 'none';
        if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
        if (elements.privacyBlockNotice) elements.privacyBlockNotice.style.display = 'none';
        if (elements.chatActions) elements.chatActions.style.display = 'none';
        renderChatPlaceholder();
    }

    if (history.state && history.state.view === 'chat') {
        history.replaceState({ view: 'list' }, '', window.location.pathname);
    }
    // Multitasking: Auto-minimize active call on back button click
    if (peerConnections.size > 0) {
        toggleCallMinimize(true);
    }
};

window.addEventListener('hotmapp-back-button', () => {
    if (elements.chatContainer?.classList.contains('viewing-chat')) {
        showChatListView();
    }
});

export const initChatSelection = () => {
    // Create Scroll to Bottom Button if it doesn't exist
    if (elements.chatArea && !elements.scrollToBottomBtn) {
        const btn = document.createElement('button');
        btn.className = 'scroll-to-bottom-btn';
        btn.setAttribute('data-ui', 'scroll-to-bottom-btn');
        btn.innerHTML = '↓';
        btn.title = 'Scroll to bottom';
        elements.chatArea.appendChild(btn);
    }

    const ShareTarget = window.Capacitor?.Plugins?.CapacitorShareTarget;
    if (ShareTarget) {
        ShareTarget.addListener('shareReceived', async (event) => {
            console.log('Native shareReceived event received:', event);
            if (!event) return;

            const filesData = [];
            if (event.files && event.files.length > 0) {
                for (const file of event.files) {
                    try {
                        const localUrl = window.Capacitor.convertFileSrc(file.uri);
                        const response = await fetch(localUrl);
                        const blob = await response.blob();
                        filesData.push({
                            type: file.mimeType.startsWith('image/') ? 'image' : (file.mimeType.startsWith('video/') ? 'video' : (file.mimeType.startsWith('audio/') ? 'audio' : 'document')),
                            fileName: file.name,
                            fileSize: blob.size,
                            fileBlob: blob
                        });
                    } catch (err) {
                        console.error("Failed to fetch shared file blob:", err);
                    }
                }
            }

            let shareItems = [];
            if (event.texts && event.texts.length > 0) {
                const textContent = [event.title, ...event.texts].filter(Boolean).join('\n');
                shareItems.push({ text: textContent });
            } else if (event.title) {
                shareItems.push({ text: event.title });
            }
            shareItems = [...shareItems, ...filesData];

            if (shareItems.length > 0) {
                const triggerForwardModal = async () => {
                    pendingForwardData = shareItems;
                    const container = elements.forwardUserList;
                    if (container) {
                        await populateForwardUserList();
                        if (elements.forwardModal) elements.forwardModal.style.display = 'flex';
                        if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';
                        selectedForwardRecipients.clear();
                        updateForwardButton();
                    }
                };

                const currentUser = auth.currentUser;
                if (currentUser) {
                    await triggerForwardModal();
                } else {
                    incomingShareIntent = shareItems;
                }
            }
        });
    }

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('appUrlOpen', (data) => {
            console.log('App opened with URL:', data.url);
            try {
                const url = new URL(data.url);
                const inviteGroupId = url.searchParams.get('invite');
                if (inviteGroupId) {
                    handleGroupInviteLink(inviteGroupId);
                }
            } catch (e) {
                console.error('Failed to parse app deep link URL:', e);
            }
        });
    }

    const getActiveChatUid = () => {
        const activeItem = document.querySelector('.conversation-item.active');
        return activeItem?.dataset.uid;
    };

    async function handleGroupInviteLink(groupId) {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            // 1. Fetch group data
            const groupSnap = await get(ref(db, `groups/${groupId}`));
            if (!groupSnap.exists()) {
                showToast("This group invite link is invalid or the group has been deleted.", "error");
                return;
            }
            const groupData = groupSnap.val();

            // 2. Check if the user is already in the group
            if (groupData.members && groupData.members[currentUser.uid]) {
                showToast("You are already a member of this group.", "info");
                const groupChatItem = document.querySelector(`.conversation-item[data-uid="${groupId}"]`);
                if (groupChatItem) {
                    groupChatItem.click();
                } else {
                    await addToChatList(currentUser.uid, groupId);
                    setTimeout(() => {
                        const newItem = document.querySelector(`.conversation-item[data-uid="${groupId}"]`);
                        if (newItem) newItem.click();
                    }, 500);
                }
                return;
            }

            // 3. Populate Join Group modal
            if (elements.joinGroupName) elements.joinGroupName.textContent = groupData.name || "Group Chat";
            if (elements.joinGroupMembersCount) {
                const count = groupData.members ? Object.keys(groupData.members).length : 0;
                elements.joinGroupMembersCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
            }
            if (elements.joinGroupAvatarInitials) {
                elements.joinGroupAvatarInitials.textContent = (groupData.name || "G").charAt(0).toUpperCase();
            }

            // 4. Set up confirm button event (one-time listener)
            const handleConfirmJoin = async () => {
                try {
                    elements.joinGroupConfirmBtn.disabled = true;
                    elements.joinGroupConfirmBtn.textContent = "Joining...";

                    await joinGroup(groupId, currentUser.uid);

                    showToast("Joined group successfully!", "success");
                    if (elements.joinGroupOverlay) elements.joinGroupOverlay.style.display = 'none';

                    // Switch tab to chats and open the group
                    elements.chatsNav?.click();
                    setTimeout(() => {
                        const groupChatItem = document.querySelector(`.conversation-item[data-uid="${groupId}"]`);
                        if (groupChatItem) {
                            groupChatItem.click();
                        } else {
                            setTimeout(() => {
                                const delayedItem = document.querySelector(`.conversation-item[data-uid="${groupId}"]`);
                                if (delayedItem) delayedItem.click();
                            }, 500);
                        }
                    }, 500);

                } catch (joinErr) {
                    console.error("Error joining group:", joinErr);
                    showToast("Failed to join group.", "error");
                } finally {
                    elements.joinGroupConfirmBtn.disabled = false;
                    elements.joinGroupConfirmBtn.textContent = "Join Group";
                }
            };

            elements.joinGroupConfirmBtn.replaceWith(elements.joinGroupConfirmBtn.cloneNode(true));
            const newConfirmBtn = document.getElementById('join-group-confirm-btn');
            newConfirmBtn.addEventListener('click', handleConfirmJoin);

            const handleCancelJoin = () => {
                if (elements.joinGroupOverlay) elements.joinGroupOverlay.style.display = 'none';
            };
            elements.joinGroupCancelBtn.replaceWith(elements.joinGroupCancelBtn.cloneNode(true));
            const newCancelBtn = document.getElementById('join-group-cancel-btn');
            newCancelBtn.addEventListener('click', handleCancelJoin);

            elements.closeJoinGroupModalBtn.replaceWith(elements.closeJoinGroupModalBtn.cloneNode(true));
            const newCloseBtn = document.querySelector('[data-ui="close-join-group-modal"]');
            newCloseBtn.addEventListener('click', handleCancelJoin);

            // 5. Show join modal
            if (elements.joinGroupOverlay) elements.joinGroupOverlay.style.display = 'flex';

        } catch (err) {
            console.error("Error loading group invite details:", err);
            showToast("Failed to load group details.", "error");
        }
    };

    // Initialize sidebars and unread counters when authenticated
    subscribeToAuthChanges(async (user) => {
        if (user) {
            await waitForE2EEKeys(user.uid);
            // Check for Web Share Target query parameters from external apps
            const urlParams = new URLSearchParams(window.location.search);
            const sharedTitle = urlParams.get('title');
            const sharedText = urlParams.get('text');
            const sharedUrl = urlParams.get('url');

            if (sharedText || sharedUrl) {
                const contentToShare = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n');

                // Clean URL query parameters immediately to avoid triggering the share modal repeatedly on refreshes
                window.history.replaceState({ view: 'list' }, document.title, window.location.pathname);

                pendingForwardData = [{ text: contentToShare }];

                setTimeout(async () => {
                    const container = elements.forwardUserList;
                    if (container) {
                        await populateForwardUserList();

                        if (elements.forwardModal) elements.forwardModal.style.display = 'flex';
                        if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';

                        selectedForwardRecipients.clear();
                        updateForwardButton();
                    }
                }, 1200);
            }

            // Check for Group Invite Link query parameter
            const inviteGroupId = urlParams.get('invite');
            if (inviteGroupId) {
                // Clean URL query parameters immediately to avoid triggering modal repeatedly on refreshes
                const newUrl = window.location.pathname;
                window.history.replaceState({ view: 'list' }, document.title, newUrl);

                setTimeout(async () => {
                    await handleGroupInviteLink(inviteGroupId);
                }, 800);
            }

            if (incomingShareIntent) {
                pendingForwardData = incomingShareIntent;
                incomingShareIntent = null;

                setTimeout(async () => {
                    const container = elements.forwardUserList;
                    if (container) {
                        await populateForwardUserList();

                        if (elements.forwardModal) elements.forwardModal.style.display = 'flex';
                        if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';

                        selectedForwardRecipients.clear();
                        updateForwardButton();
                    }
                }, 1200);
            }

            let isFirstLoad = true;

            subscribeToAllUsers((allUsers) => {
                allUsersCache = allUsers;
                updateCustomerSidebar();
                refreshChatSidebars();
            });

            subscribeToMutedUsers(user.uid, (data) => {
                mutedUsers = data;
                updateMuteUI();
                document.querySelectorAll('.conversation-item').forEach(item => {
                    const uid = item.dataset.uid;
                    const icon = item.querySelector('.muted-icon');
                    if (icon) icon.style.display = !!mutedUsers[uid] ? 'inline-block' : 'none';
                });
            });

            subscribeToUserProfile(user.uid, (profile) => {
                if (profile) {
                    notificationSoundsEnabled = profile.notificationSounds !== false;
                    readReceiptsEnabled = profile.readReceipts !== false;
                    currentUserLastSeenPrivacy = profile.lastSeenPrivacy || 'anyone';
                    // Ensure excludedContacts is always an object, even if it was previously saved as an array
                    if (Array.isArray(profile.excludedContacts)) {
                        excludedContacts = profile.excludedContacts.reduce((acc, uid) => {
                            acc[uid] = true;
                            return acc;
                        }, {});
                    } else {
                        excludedContacts = profile.excludedContacts || {};
                    }
                    currentUserWhoCanViewShop = profile.whoCanViewShop || 'anyone'; // Load current user's shop privacy
                    currentUserOnlinePrivacy = profile.onlinePrivacy || 'anyone';
                }
            });

            subscribeToBlockedUsers(user.uid, (data) => {
                blockedUsers = data || {};
                // Auto-sync blocked users to publicProfiles for block enforcement
                if (data && Object.keys(data).length > 0) {
                    get(ref(db, `publicProfiles/${user.uid}/blockedUsers`)).then(snapshot => {
                        const publicBlocked = snapshot.val() || {};
                        const updates = {};
                        let needsSync = false;
                        for (const [targetUid, blockInfo] of Object.entries(data)) {
                            if (!publicBlocked[targetUid]) {
                                updates[`publicProfiles/${user.uid}/blockedUsers/${targetUid}`] = blockInfo;
                                needsSync = true;
                            }
                        }
                        if (needsSync) {
                            console.log("Auto-syncing blocked users to publicProfiles...");
                            update(ref(db), updates).catch(err => {
                                console.error("Failed to sync blocked users to publicProfiles:", err);
                            });
                        }
                    });
                }
            });

            subscribeToCustomerList(user.uid, (list) => {
                moduleFriendsList = list;
                updateCustomerSidebar();
            });

            subscribeToSentRequests(user.uid, (sent) => {
                console.log("[Friend Requests Debug] subscribeToSentRequests fired. Data:", sent);
                currentOutgoingRequests = sent;
                updateRequestActionButtonState();
                refreshChatSidebars();
                updateCustomerSidebar();
                updateRequestBadges();
            });

            let prevIncomingCount = null;
            subscribeToFriendRequests(user.uid, (requests) => {
                console.log("[Friend Requests Debug] subscribeToFriendRequests fired. Data:", requests);
                const newCount = Object.keys(requests || {}).filter(uid => requests[uid]).length;
                if (prevIncomingCount !== null && newCount > prevIncomingCount) {
                    playIncomingSound();
                    showToast("New friend request received!", "info");
                }
                prevIncomingCount = newCount;
                currentIncomingRequests = requests;
                refreshChatSidebars();
                updateRequestBadges();
            });

            // Call History and Incoming Signals: Consolidate static/reactive initializers
            initCallHistory(user);
            subscribeToCallSignals(user.uid, handleIncomingCallSignal);

            // Main chat list subscription
            // This single subscription will now handle filtering for both active and archived chats
            subscribeToChatList(user.uid, (chatListIds) => {
                currentChatListIds = chatListIds;
                refreshChatSidebars();
                updateCustomerSidebar();

                if (isFirstLoad) {
                    const defaultUid = getActiveChatUid();
                    if (defaultUid) {
                        startMessageListener(defaultUid);
                    } else {
                        // Desktop only: show toast, placeholder, and ensure hidden if no active chat
                        if (window.innerWidth > 768) {
                            if (elements.chatHeader) elements.chatHeader.style.display = 'none';
                            if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
                            renderChatPlaceholder();

                            setTimeout(() => {
                                showToast("Please click a conversation from the list to start chatting.", "info");
                            }, 1500);
                        }
                    }
                    isFirstLoad = false;
                }

                Object.keys(chatListIds).forEach(otherUid => {
                    const chatId = getChatIdForEntry(user.uid, otherUid);
                    if (chatId) {
                        markMessagesAsDelivered(chatId, user.uid);
                    }
                });
            });
        }
    });

    // Handle Scroll to Bottom visibility and action
    elements.messagesContainer?.addEventListener('scroll', function () {
        const { scrollTop, scrollHeight, clientHeight } = this;
        // Show button if the user is more than 200px away from the bottom
        const isScrolledUp = scrollHeight - scrollTop - clientHeight > 200;
        elements.scrollToBottomBtn?.classList.toggle('visible', isScrolledUp);

        // Lazy load older messages when scrolling to top
        if (scrollTop < 50) {
            loadOlderMessages();
        }
    });

    elements.scrollToBottomBtn?.addEventListener('click', () => {
        elements.messagesContainer?.scrollTo({ top: elements.messagesContainer.scrollHeight, behavior: 'smooth' });
    });

    elements.addCustomerBtn?.addEventListener('click', () => {
        activeManageTab = 'new';
        handleManageCustomers();
    });

    // Navigation to Archived Chats
    elements.archivedNav?.addEventListener('click', (e) => {
        e.preventDefault();
        // Hide all other sidebars
        if (elements.chatSidebar) elements.chatSidebar.style.display = 'none';
        if (elements.custSidebar) elements.custSidebar.style.display = 'none';
        if (elements.starredSidebar) elements.starredSidebar.style.display = 'none';
        if (elements.callsSidebar) elements.callsSidebar.style.display = 'none';
        if (elements.generalMarketArea) elements.generalMarketArea.style.display = 'none';
        if (elements.storeArea) elements.storeArea.style.display = 'none';
        if (elements.chatArea) elements.chatArea.style.display = 'none'; // Hide chat area when switching to a sidebar view
        if (elements.archivedSidebar) elements.archivedSidebar.style.display = 'flex';
    });

    const openFriendRequestsModal = (e, filter = 'all') => {
        e.preventDefault();
        activeManageTab = 'requests';
        activeRequestFilter = filter;
        handleManageCustomers(filter);
    };

    elements.headerRequestsBtn?.addEventListener('click', (e) => openFriendRequestsModal(e, 'all'));
    elements.headerIncomingRequestsBtn?.addEventListener('click', (e) => openFriendRequestsModal(e, 'incoming'));
    elements.headerOutgoingRequestsBtn?.addEventListener('click', (e) => openFriendRequestsModal(e, 'outgoing'));

    elements.closeManageCustomersBtn?.addEventListener('click', () => {
        if (elements.manageCustomersModal) elements.manageCustomersModal.style.display = 'none';
    });

    elements.archivedChatContextMenu?.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item || !archivedContextMenuTargetId) return;

        const action = item.dataset.action;
        if (action === 'unarchive') handleUnarchiveChat(archivedContextMenuTargetId);
        if (action === 'delete-archived') handleDeleteArchivedChat(archivedContextMenuTargetId);

        elements.archivedChatContextMenu.style.display = 'none';
        archivedContextMenuTargetId = null;
    });

    elements.activeChatContextMenu?.addEventListener('click', async (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item || !activeContextMenuTargetId) return;

        const action = item.dataset.action;
        const user = auth.currentUser;
        if (user) {
            if (action === 'archive-chat-item') {
                try {
                    await updateChatArchiveStatus(user.uid, activeContextMenuTargetId, true);
                    showToast("Chat archived", "info");
                    if (activeChatUid === activeContextMenuTargetId) {
                        elements.chatArea.style.display = 'none';
                        elements.chatsNav?.click();
                    }
                } catch (error) {
                    console.error("Error archiving chat:", error);
                    showToast("Failed to archive chat", "error");
                }
            } else if (action === 'delete-chat-item') {
                if (confirm("Are you sure you want to delete this chat? This will remove it from your chat list.")) {
                    try {
                        await deleteChatFromList(user.uid, activeContextMenuTargetId);
                        showToast("Chat deleted", "info");
                        if (activeChatUid === activeContextMenuTargetId) {
                            elements.chatArea.style.display = 'none';
                            elements.chatsNav?.click();
                        }
                    } catch (error) {
                        console.error("Error deleting chat:", error);
                        showToast("Failed to delete chat", "error");
                    }
                }
            }
        }

        elements.activeChatContextMenu.style.display = 'none';
        activeContextMenuTargetId = null;
    });

    elements.muteChatBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !activeChatUid) return;
        const isCurrentlyMuted = !!mutedUsers[activeChatUid];
        await toggleMuteUser(user.uid, activeChatUid, !isCurrentlyMuted);
    });

    // Set restricted file types on the hidden input
    if (elements.fileInput) {
        elements.fileInput.accept = `image/*,video/*,${ALLOWED_DOC_EXTENSIONS.join(',')}`;
    }

    // Use event delegation for clicking conversation items (works for dynamic content)
    document.addEventListener('click', async (e) => {
        // Ignore clicks inside the "Find New Customers" search results to prevent redirection
        const searchItem = e.target.closest('[data-ui="manage-users-list"]');
        if (searchItem) return;

        // Handle message selection when in selection mode
        const group = e.target.closest('.message-group');
        if (group && isSelectMode) {
            if (window.skipNextClick) {
                window.skipNextClick = false;
                return;
            }
            try {
                e.stopPropagation();
                const id = group.id;
                if (selectedMessages.has(id)) {
                    selectedMessages.delete(id);
                    if (selectedMessages.size === 0) toggleSelectMode(false);
                } else {
                    selectedMessages.add(id);
                }
                updateSelectionUI();
                return;
            } catch (err) {
                console.error("isSelectMode click error:", err);
                showToast("Select Mode Click Error: " + err.message, "error");
            }
        }

        // Handle Call Details click on bubble
        const callBubble = e.target.closest('.message-bubble.call');
        if (callBubble && !e.target.closest('.call-back-btn') && !e.target.closest('.call-log-delete-btn')) {
            e.stopPropagation();
            const group = callBubble.closest('.message-group');
            if (group && group.id) {
                const msg = messages.find(m => m.id === group.id);
                if (msg) showCallDetails(msg);
            }
            return;
        }

        // Handle Call Back button in message bubbles
        const callBackBtn = e.target.closest('.call-back-btn');
        if (callBackBtn) {
            e.stopPropagation();
            const callType = callBackBtn.dataset.type || 'voice';
            startCall(callType);
            return;
        }

        // Handle Confirm Order button
        const confirmOrderBtn = e.target.closest('.confirm-order-btn');
        if (confirmOrderBtn && activeChatUid) {
            e.stopPropagation();
            const msgId = confirmOrderBtn.dataset.msgId;
            const invoiceId = confirmOrderBtn.dataset.invoiceId;
            const user = auth.currentUser;
            if (!user || !msgId) return;

            const chatId = [user.uid, activeChatUid].sort().join('_');

            try {
                confirmOrderBtn.disabled = true;
                confirmOrderBtn.innerHTML = '<span class="spinner" style="border-top-color:white; width:12px; height:12px; margin:0;"></span> Confirming...';

                if (invoiceId) {
                    await updateOrder(invoiceId, { status: 'confirmed' });
                }

                await updateMessage(chatId, msgId, { orderConfirmed: true });
                await saveMessage(chatId, {
                    senderId: user.uid,
                    type: 'system',
                    text: 'Order has been confirmed by the business.'
                });

                if (invoiceId) {
                    window.loadAndRenderInvoiceCard(msgId, invoiceId, false);
                }

                showToast("Order confirmed!", "success");
            } catch (error) {
                showToast("Failed to confirm order.", "error");
                confirmOrderBtn.disabled = false;
                confirmOrderBtn.textContent = 'Confirm Order';
            }
            return;
        }

        // Handle Call Log Delete button
        const callLogDeleteBtn = e.target.closest('.call-log-delete-btn');
        if (callLogDeleteBtn) {
            e.stopPropagation();
            const group = callLogDeleteBtn.closest('.message-group');
            if (group && group.id && activeChatUid) {
                if (confirm("Delete this call log from chat?")) {
                    const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
                    deleteMessagesBatch(chatId, [group.id]);
                }
            }
            return;
        }

        // Handle System Message "View Profile" click
        const viewProfileLink = e.target.closest('.view-profile-link');
        if (viewProfileLink) {
            e.stopPropagation();
            const uid = viewProfileLink.dataset.uid;
            if (uid) {
                getUserProfile(uid).then(profileData => {
                    if (profileData) showUserProfileInfo(uid, profileData, false);
                });
            }
            return;
        }

        const item = e.target.closest('.conversation-item');
        if (!item) return;

        const parentSidebar = item.closest('aside');
        const isFromCustomerSidebar = parentSidebar?.classList.contains('costomersidebar');
        const isFromCallsSidebar = parentSidebar?.classList.contains('callssidebar');
        const currentUser = auth.currentUser;

        // Logic: Click in Customers or Calls -> Add to Chat List -> Switch to Chat View
        if ((isFromCustomerSidebar || isFromCallsSidebar) && currentUser) {
            const otherUid = item.dataset.uid;
            if (otherUid) {
                // Prevent communication from Calls sidebar if they are not friends
                if (isFromCallsSidebar && !moduleFriendsList[otherUid]) {
                    showToast("You must be friends to message or call.", "warning");
                    return;
                }

                window.isSwitchingFromContact = true;
                await addToChatList(currentUser.uid, otherUid);
                elements.chatsNav?.click();
                window.isSwitchingFromContact = false;
            }
        }

        // Update active state within the conversation list
        const parentList = item.closest('.conversations-list');
        parentList?.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const otherUid = item.dataset.uid;
        if (typeof window.setActiveShopSellerId === 'function') {
            window.setActiveShopSellerId(otherUid);
        }

        // Extract user info
        const name = item.querySelector('.conversation-name')?.textContent?.trim();
        const avatarEl = item.querySelector('.conversation-avatar');
        activeChatUid = otherUid;

        // Multitasking: Auto-minimize active call when switching chats
        if (peerConnections.size > 0) toggleCallMinimize(true);

        // Refresh shop grid to show only this person's products
        if (typeof window.closeShopMode === 'function') {
            window.closeShopMode();
        } else {
            elements.chatArea?.classList.remove('shop-mode-active');
        }
        refreshStoreGrids();
        refreshCart();
        updateMuteUI();

        // Update header
        if (elements.chatHeaderName && name) elements.chatHeaderName.textContent = name;
        if (elements.chatHeaderAvatar && avatarEl) {
            // Initial avatar sync (strip dot)
            const initials = name ? name.charAt(0).toUpperCase() : 'U';
            const img = avatarEl.querySelector('img');
            elements.chatHeaderAvatar.innerHTML = img ? img.outerHTML : initials;
        }

        // Start listening for real-time messages for this user
        if (otherUid) {
            startMessageListener(otherUid);
            clearDeliveredNotifications();
        }

        // Logic to ensure chat area is shown if switched from other views
        if (elements.chatArea) elements.chatArea.style.display = 'flex';

        // Mobile: Switch view to chat
        elements.chatContainer?.classList.add('viewing-chat');
        pushHistoryState('chat-view', showChatListView);
        elements.mainAppContent?.classList.add('header-hidden');

        toggleChatSearch(false);
    });



    // Add event listeners for sending messages
    // Handle real-time input changes (Icon swapping & Auto-resize)
    elements.messageInput?.addEventListener('input', function () {
        // Auto-resize logic
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';

        // Update typing status in the database, don't show the UI locally
        updateTypingPresence(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            updateTypingPresence(false);
        }, 2000); // Stop typing status after 2 seconds of inactivity

        toggleInputButtons();
    });

    elements.sendBtn?.addEventListener('click', sendMessage);

    // Long-press detection for mobile message action menu and desktop selection
    const handleLongPressStart = (e) => {
        const group = e.target.closest('.message-group');
        if (!group || isSelectMode) return;

        const touch = e.touches ? e.touches[0] : e;
        lastTouchPos = { x: touch.clientX, y: touch.clientY };

        if (e.type === 'touchstart') {
            longPressTimer = window.setTimeout(() => {
                const msg = messages.find(m => m.id === group.id);
                if (!msg || msg.deleted) return;
                toggleSelectMode(true);
                selectedMessages.clear();
                selectedMessages.add(group.id);
                updateSelectionUI();
                if (navigator.vibrate) navigator.vibrate(50);
                window.blockContextMenu = true;
                window.skipNextClick = true;
                window.setTimeout(() => { window.blockContextMenu = false; }, 400);
            }, 350);
        } else {
            longPressTimer = window.setTimeout(() => {
                toggleSelectMode(true);
                selectedMessages.add(group.id);
                updateSelectionUI();
            }, 500);
        }
    };

    const handleLongPressEnd = () => {
        if (longPressTimer) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    // Swipe handling for chat messages
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeActive = false;
    let swipeThreshold = 50;
    let maxSwipeDistance = 80;
    let hasVibrated = false;
    let swipeIndicator = null;

    const handleSwipeStart = (e) => {
        if (isSelectMode) return;

        const bubble = e.target.closest('.message-bubble');
        if (!bubble) return;

        const group = bubble.closest('.message-group');
        if (!group || group.classList.contains('system-message') || group.classList.contains('call-log')) return;

        // Ensure message is not deleted
        const msg = messages.find(m => m.id === group.id);
        if (msg && msg.deleted) return;

        const point = e.touches ? e.touches[0] : e;
        swipeStartX = point.clientX;
        swipeStartY = point.clientY;
        swipeReplyTarget = bubble;
        swipeActive = false;
        hasVibrated = false;

        // Create and insert reply indicator
        if (swipeIndicator) swipeIndicator.remove();
        swipeIndicator = document.createElement('div');
        swipeIndicator.className = 'swipe-reply-indicator';
        swipeIndicator.innerHTML = '<i class="fa-solid fa-reply"></i>';

        // Position indicator 35px to the left of the bubble
        const leftPos = bubble.offsetLeft - 35;
        swipeIndicator.style.left = `${leftPos}px`;

        group.appendChild(swipeIndicator);
    };

    const handleSwipeMove = (e) => {
        if (!swipeReplyTarget || !swipeIndicator) return;

        const point = e.touches ? e.touches[0] : e;
        const diffX = point.clientX - swipeStartX;
        const diffY = point.clientY - swipeStartY;

        if (!swipeActive) {
            if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                swipeActive = true;
            } else if (Math.abs(diffY) > 10) {
                // Cancel swipe if vertical scroll is dominant
                cleanupSwipe();
                return;
            }
        }

        if (swipeActive) {
            // Swipe is left-to-right (positive diffX)
            if (diffX > 0) {
                // Prevent horizontal scroll
                if (e.cancelable) e.preventDefault();

                // Apply rubber-banding
                let translateX = diffX;
                if (translateX > maxSwipeDistance) {
                    translateX = maxSwipeDistance + (translateX - maxSwipeDistance) * 0.3;
                }
                translateX = Math.min(translateX, maxSwipeDistance + 10);

                swipeReplyTarget.style.transform = `translateX(${translateX}px)`;
                swipeReplyTarget.style.transition = 'none';

                // Update indicator position to slide closer to the bubble
                const currentLeft = swipeReplyTarget.offsetLeft - 35 + Math.min(translateX, swipeThreshold) * 0.3;
                swipeIndicator.style.left = `${currentLeft}px`;

                if (translateX >= swipeThreshold) {
                    if (!swipeIndicator.classList.contains('active')) {
                        swipeIndicator.classList.add('active');
                        swipeIndicator.style.transform = ''; // let CSS class handle scaling & rotation
                        if (!hasVibrated && navigator.vibrate) {
                            navigator.vibrate(15);
                            hasVibrated = true;
                        }
                    }
                } else {
                    if (swipeIndicator.classList.contains('active')) {
                        swipeIndicator.classList.remove('active');
                        hasVibrated = false;
                    }
                    const scale = Math.min(translateX / swipeThreshold, 1);
                    swipeIndicator.style.transform = `translateY(-50%) scale(${scale})`;
                }
            } else {
                swipeReplyTarget.style.transform = '';
                swipeIndicator.style.transform = 'translateY(-50%) scale(0)';
            }
        }
    };

    const handleSwipeEnd = (e) => {
        if (!swipeReplyTarget) return;

        const bubble = swipeReplyTarget;
        const indicator = swipeIndicator;
        const group = bubble.closest('.message-group');

        const point = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : e);
        const diffX = point ? (point.clientX - swipeStartX) : 0;

        if (swipeActive && diffX >= swipeThreshold && group) {
            const msgId = group.id;
            const msg = messages.find(m => m.id === msgId);
            if (msg && !msg.deleted) {
                const user = auth.currentUser;
                let senderName = 'Contact';
                if (msg.senderId === user.uid) {
                    senderName = 'You';
                } else {
                    const senderProfile = allUsersCache[msg.senderId];
                    senderName = senderProfile ? senderProfile.fullname : (elements.chatHeaderName?.textContent || 'Contact');
                }
                showReplyPreview(msg.id, msg.text || `[${msg.type}]`, senderName);
            }
        }

        // Animate bubble back to original position
        bubble.style.transition = 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        bubble.style.transform = 'translateX(0px)';

        if (indicator) {
            indicator.classList.remove('active');
            indicator.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
            indicator.style.transform = 'translateY(-50%) scale(0)';

            // Remove indicator after transition ends
            setTimeout(() => {
                indicator.remove();
            }, 150);
        }

        // Clean up bubble inline transition styles
        setTimeout(() => {
            if (bubble) {
                bubble.style.transition = '';
                bubble.style.transform = '';
            }
        }, 200);

        // Reset swipe state
        swipeStartX = 0;
        swipeStartY = 0;
        swipeReplyTarget = null;
        swipeIndicator = null;
        swipeActive = false;
        hasVibrated = false;
    };

    const cleanupSwipe = () => {
        if (swipeReplyTarget) {
            swipeReplyTarget.style.transition = 'transform 0.2s ease';
            swipeReplyTarget.style.transform = 'translateX(0px)';
            const bubble = swipeReplyTarget;
            setTimeout(() => {
                if (bubble) {
                    bubble.style.transition = '';
                    bubble.style.transform = '';
                }
            }, 200);
        }
        if (swipeIndicator) {
            swipeIndicator.remove();
        }
        swipeStartX = 0;
        swipeStartY = 0;
        swipeReplyTarget = null;
        swipeIndicator = null;
        swipeActive = false;
        hasVibrated = false;
    };

    elements.messagesContainer?.addEventListener('mousedown', handleLongPressStart, { passive: true });
    elements.messagesContainer?.addEventListener('touchstart', (e) => { handleLongPressStart(e); handleSwipeStart(e); }, { passive: true });
    elements.messagesContainer?.addEventListener('mouseup', (e) => {
        if (!e.target.closest('.message-action-trigger')) {
            handleLongPressEnd();
        }
    }, { passive: true });
    elements.messagesContainer?.addEventListener('mouseleave', (e) => { handleLongPressEnd(e); cleanupSwipe(); }, { passive: true });
    elements.messagesContainer?.addEventListener('touchend', (e) => { handleLongPressEnd(e); handleSwipeEnd(e); });
    elements.messagesContainer?.addEventListener('touchmove', (e) => { handleLongPressEnd(e); handleSwipeMove(e); }, { passive: false });
    elements.messagesContainer?.addEventListener('touchcancel', (e) => { handleLongPressEnd(e); cleanupSwipe(); });

    // Selection Bar Actions
    elements.massReplyBtn?.addEventListener('click', () => {
        if (selectedMessages.size !== 1) return;
        const msgId = Array.from(selectedMessages)[0];
        const msg = messages.find(m => m.id === msgId);
        if (msg && !msg.deleted) {
            const user = auth.currentUser;
            let senderName = 'Contact';
            if (msg.senderId === user.uid) {
                senderName = 'You';
            } else {
                const senderProfile = allUsersCache[msg.senderId];
                senderName = senderProfile ? senderProfile.fullname : (elements.chatHeaderName?.textContent || 'Contact');
            }
            showReplyPreview(msg.id, msg.text || `[${msg.type}]`, senderName);
        }
        toggleSelectMode(false);
    });
    elements.massDeleteBtn?.addEventListener('click', handleMassDelete);
    elements.massStarBtn?.addEventListener('click', handleMassStar);
    elements.massForwardBtn?.addEventListener('click', handleMassForward);
    elements.massPinBtn?.addEventListener('click', async () => {
        if (selectedMessages.size !== 1) return;
        const msgId = Array.from(selectedMessages)[0];
        const isPinned = pinnedMessageData && pinnedMessageData.msgId === msgId;
        if (isPinned) {
            await handleUnpinMessage();
        } else {
            await handlePinMessage(msgId);
        }
        toggleSelectMode(false);
    });

    elements.selectionEditImageBtn?.addEventListener('click', async () => {
        if (selectedMessages.size !== 1) return;
        const msgId = Array.from(selectedMessages)[0];
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.url) {
            showToast("Downloading image for editing...", "info");
            try {
                const resp = await fetch(msg.url);
                const blob = await resp.blob();
                const editedBlob = await openImageEditor(blob);
                if (editedBlob) {
                    showToast("Sending edited image...", "info");
                    await sendMedia('image', editedBlob, msg.fileName || 'edited_image.jpg');
                    toggleSelectMode(false);
                }
            } catch (err) {
                console.error("Failed to download or edit image:", err);
                showToast("Error loading image for editing.", "error");
            }
        }
    });

    elements.selectionSignDocumentBtn?.addEventListener('click', async () => {
        if (selectedMessages.size !== 1) return;
        const msgId = Array.from(selectedMessages)[0];
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.url) {
            showToast("Downloading document for signing...", "info");
            try {
                const resp = await fetch(msg.url);
                const blob = await resp.blob();
                const signedBlob = await openDocSigner(blob);
                if (signedBlob) {
                    showToast("Sending signed document...", "info");
                    await sendMedia('document', signedBlob, msg.fileName || 'signed_document.pdf');
                    toggleSelectMode(false);
                }
            } catch (err) {
                console.error("Failed to download or sign document:", err);
                showToast("Error loading document for signing.", "error");
            }
        }
    });
    elements.cancelSelectionBtn?.addEventListener('click', () => toggleSelectMode(false));

    // Delete Modal Listeners
    elements.deleteMeBtn?.addEventListener('click', async () => {
        try {
            const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
            await deleteMessagesBatch(chatId, Array.from(selectedMessages));
            showToast("Messages deleted", "info");
            toggleSelectMode(false);
            closeDeleteModal();
        } catch (err) {
            console.error("deleteMeBtn error:", err);
            showToast("Delete Error: " + err.message, "error");
        }
    });
    elements.deleteEveryoneBtn?.addEventListener('click', async () => {
        try {
            if (elements.deleteEveryoneBtn.dataset.allowed === 'false') {
                const content = elements.deleteConfirmationModal?.querySelector('.modal-content');
                if (content) {
                    content.classList.add('modal-shake');
                    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                    setTimeout(() => content.classList.remove('modal-shake'), 400);
                }
                return;
            }
            const chatId = [auth.currentUser.uid, activeChatUid].sort().join('_');
            await deleteMessagesForEveryoneBatch(chatId, Array.from(selectedMessages));
            showToast("Messages deleted for everyone", "info");
            toggleSelectMode(false);
            closeDeleteModal();
        } catch (err) {
            console.error("deleteEveryoneBtn error:", err);
            showToast("Delete Everyone Error: " + err.message, "error");
        }
    });

    elements.cancelDeleteBtn?.addEventListener('click', () => {
        selectedMessages.clear();
        closeDeleteModal();
    });


    // Header Selection Ellipsis Logic
    elements.selectionEllipsisBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.selectionEllipsisMenu) {
            const isHidden = elements.selectionEllipsisMenu.style.display === 'none';
            elements.selectionEllipsisMenu.style.display = isHidden ? 'flex' : 'none';
        }
    });

    // Pinned Message Bar Interactions
    elements.pinnedMessageBar?.addEventListener('click', (e) => {
        if (e.target.closest('[data-ui="unpin-btn"]')) return;
        if (pinnedMessageData && pinnedMessageData.msgId) {
            const el = document.getElementById(pinnedMessageData.msgId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('flash');
                setTimeout(() => el.classList.remove('flash'), 1500);
            }
        }
    });

    elements.unpinBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleUnpinMessage();
    });

    // Chat Header Menu Toggle
    elements.chatMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = elements.chatHeaderMenu;
        if (!menu) return;

        // Use computed style to handle initial CSS 'display: none' correctly
        const isHidden = window.getComputedStyle(menu).display === 'none';
        menu.style.display = isHidden ? 'flex' : 'none';

        // Update Menu state and visibility when opened
        if (isHidden && activeChatUid) {
            const isArchived = currentChatListIds[activeChatUid]?.isArchived;
            const archiveBtn = menu.querySelector('[data-action="archive-chat"]');
            const unarchiveBtn = menu.querySelector('[data-action="unarchive-chat"]');
            const blockBtn = menu.querySelector('[data-action="block-user"]');
            const lockBtn = menu.querySelector('[data-action="lock-chat"]');
            const unlockBtn = menu.querySelector('[data-action="unlock-chat"]');

            if (archiveBtn) archiveBtn.style.display = isArchived ? 'none' : 'flex';
            if (unarchiveBtn) unarchiveBtn.style.display = isArchived ? 'flex' : 'none';

            const locked = isChatLocked(activeChatUid);
            if (lockBtn) lockBtn.style.display = locked ? 'none' : 'flex';
            if (unlockBtn) unlockBtn.style.display = locked ? 'flex' : 'none';

            if (blockBtn) {
                const isSelf = activeChatUid === auth.currentUser?.uid;
                blockBtn.style.display = isSelf ? 'none' : 'flex'; // Hide block button for self-chats

                const isBlocked = !!blockedUsers[activeChatUid];
                blockBtn.innerHTML = isBlocked ? '<i class="fa-solid fa-circle-check"></i> Unblock User' : '<i class="fa-solid fa-ban"></i> Block User';
                blockBtn.classList.toggle('delete', !isBlocked);
            }
        }

        // Close other potential popups when chatHeaderMenu is opened
        if (isHidden) {
            if (elements.selectionEllipsisMenu) elements.selectionEllipsisMenu.style.display = 'none';
            if (elements.headerDropdownMenu) elements.headerDropdownMenu.style.display = 'none'; // Also close header dropdown
            if (elements.callDropdownMenu) elements.callDropdownMenu.style.display = 'none';
        }
    });

    // Call Options Menu Toggle
    elements.callMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = elements.callDropdownMenu;
        if (!menu) return;

        const isHidden = window.getComputedStyle(menu).display === 'none';
        menu.style.display = isHidden ? 'flex' : 'none';

        // Close other potential popups when callDropdownMenu is opened
        if (isHidden) {
            if (elements.selectionEllipsisMenu) elements.selectionEllipsisMenu.style.display = 'none';
            if (elements.headerDropdownMenu) elements.headerDropdownMenu.style.display = 'none';
            if (elements.chatHeaderMenu) elements.chatHeaderMenu.style.display = 'none';
        }
    });

    elements.headerEllipsisBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = elements.headerDropdownMenu;
        if (!menu) return;
        const isHidden = window.getComputedStyle(menu).display === 'none';
        menu.style.display = isHidden ? 'flex' : 'none';

        // Close other potential popups when headerDropdownMenu is opened
        if (isHidden) {
            if (elements.selectionEllipsisMenu) elements.selectionEllipsisMenu.style.display = 'none';
            if (elements.chatHeaderMenu) elements.chatHeaderMenu.style.display = 'none';
            if (elements.callDropdownMenu) elements.callDropdownMenu.style.display = 'none';
        }
    });

    elements.headerDropdownMenu?.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item) return;

        const action = item.dataset.action;
        elements.headerDropdownMenu.style.display = 'none'; // Close the menu

        switch (action) {
            case 'new-group':
                if (elements.newGroupModal) {
                    elements.newGroupModal.style.display = 'flex';
                    populateNewGroupContacts();
                }
                break;
            case 'settings':
                if (elements.settingsModal) {
                    elements.settingsModal.style.display = 'flex';
                }
                break;
            case 'starred':
                if (elements.starredNav) {
                    elements.starredNav.click();
                }
                break;
            case 'linked-devices':
                if (elements.linkedDevicesModal) {
                    elements.linkedDevicesModal.style.display = 'flex';
                }
            case 'store':
                if (typeof window.openStoreView === 'function') {
                    window.openStoreView();
                } else {
                    const hideEls = [elements.chatSidebar, elements.custSidebar, elements.chatArea, elements.generalMarketArea, elements.starredSidebar, elements.callsSidebar, elements.archivedSidebar, elements.lockedChatsSidebar];
                    hideEls.forEach(el => el && (el.style.display = 'none'));
                    if (elements.storeArea) {
                        elements.storeArea.style.display = 'block';
                    }
                }
                break;
        }
    });

    const handleLockChat = () => {
        if (!activeChatUid) return;
        const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
        if (!savedPin) {
            showToast("Please set up App Lock PIN in Privacy Settings first to use Chat Lock.", "warning");
            elements.settingsPrivacyBtn?.click();
            return;
        }

        toggleChatLock(activeChatUid);
        showToast("Chat locked successfully", "success");

        activeChatUid = null;
        if (elements.chatArea) elements.chatArea.style.display = 'none';
        showChatListView();
        document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));

        refreshChatSidebars();
        updateCustomerSidebar();
    };

    const handleUnlockChat = () => {
        if (!activeChatUid) return;
        toggleChatLock(activeChatUid);
        showToast("Chat unlocked successfully", "success");

        refreshChatSidebars();
        updateCustomerSidebar();

        renderLockedChatsList();
    };

    elements.chatHeaderMenu?.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item) return;
        const action = item.dataset.action;
        if (action === 'clear-chat') handleClearChat();
        if (action === 'search-chat') toggleChatSearch(true);
        if (action === 'archive-chat') handleArchiveChat();
        if (action === 'unarchive-chat') handleUnarchiveChat(activeChatUid);
        if (action === 'block-user') handleBlockUser();
        if (action === 'lock-chat') handleLockChat();
        if (action === 'unlock-chat') handleUnlockChat();
        if (action === 'view-invoices') openChatInvoicesModal();

        elements.chatHeaderMenu.style.display = 'none';
    });

    const debouncedFilterChatMessages = debounce(filterChatMessages, 300); // Debounce chat search

    elements.chatSearchInput?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (elements.clearChatSearchBtn) elements.clearChatSearchBtn.style.display = val ? 'block' : 'none';
        debouncedFilterChatMessages(val);
    });


    elements.clearChatSearchBtn?.addEventListener('click', () => {
        if (elements.chatSearchInput) {
            elements.chatSearchInput.value = '';
            elements.chatSearchInput.focus();
        }
        if (elements.clearChatSearchBtn) elements.clearChatSearchBtn.style.display = 'none';
        debouncedFilterChatMessages('');
    });

    elements.closeChatSearchBtn?.addEventListener('click', () => {
        toggleChatSearch(false);
    });

    elements.prevSearchBtn?.addEventListener('click', () => {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        updateSearchUI();
    });

    elements.nextSearchBtn?.addEventListener('click', () => {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
        updateSearchUI();
    });

    elements.selectionEllipsisMenu?.addEventListener('click', async (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item) return;

        const action = item.dataset.action;
        if (action === 'selection-star') {
            elements.selectionEllipsisMenu.style.display = 'none';
            handleMassStar();
        } else if (action === 'selection-info') {
            const id = Array.from(selectedMessages)[0];
            const msg = messages.find(m => m.id === id);
            if (msg) showMessageInfo(msg);
            elements.selectionEllipsisMenu.style.display = 'none';
        } else if (action === 'selection-copy') {
            handleSelectionCopy();
            elements.selectionEllipsisMenu.style.display = 'none';
        } else if (action === 'selection-edit') {
            elements.selectionEllipsisMenu.style.display = 'none';
            if (selectedMessages.size !== 1) return;
            const msgId = Array.from(selectedMessages)[0];
            const msg = messages.find(m => m.id === msgId);
            if (msg && msg.text) {
                showEditPreview(msg.id, msg.text);
                toggleSelectMode(false, { updateHistory: false });
            }
        } else if (action === 'selection-translate') {
            handleSelectionTranslate();
            elements.selectionEllipsisMenu.style.display = 'none';
        } else if (action === 'selection-pin') {
            elements.selectionEllipsisMenu.style.display = 'none';
            if (selectedMessages.size !== 1) return;
            const msgId = Array.from(selectedMessages)[0];
            const isPinned = pinnedMessageData && pinnedMessageData.msgId === msgId;
            if (isPinned) {
                await handleUnpinMessage();
            } else {
                await handlePinMessage(msgId);
            }
            toggleSelectMode(false);
        } else if (action === 'selection-edit-image') {
            elements.selectionEllipsisMenu.style.display = 'none';
            const msgId = Array.from(selectedMessages)[0];
            const msg = messages.find(m => m.id === msgId);
            if (msg && msg.url) {
                showToast("Downloading image for editing...", "info");
                try {
                    const resp = await fetch(msg.url);
                    const blob = await resp.blob();
                    const editedBlob = await openImageEditor(blob);
                    if (editedBlob) {
                        showToast("Sending edited image...", "info");
                        await sendMedia('image', editedBlob, msg.fileName || 'edited_image.jpg');
                        toggleSelectMode(false);
                    }
                } catch (err) {
                    console.error("Failed to download or edit image:", err);
                    showToast("Error loading image for editing.", "error");
                }
            }
        } else if (action === 'selection-sign-document') {
            elements.selectionEllipsisMenu.style.display = 'none';
            const msgId = Array.from(selectedMessages)[0];
            const msg = messages.find(m => m.id === msgId);
            if (msg && msg.url) {
                showToast("Downloading document for signing...", "info");
                try {
                    const resp = await fetch(msg.url);
                    const blob = await resp.blob();
                    const signedBlob = await openDocSigner(blob);
                    if (signedBlob) {
                        showToast("Sending signed document...", "info");
                        await sendMedia('document', signedBlob, msg.fileName || 'signed_document.pdf');
                        toggleSelectMode(false);
                    }
                } catch (err) {
                    console.error("Failed to download or sign document:", err);
                    showToast("Error loading document for signing.", "error");
                }
            }
        }
    });

    // Translation Modal event listeners
    elements.closeTranslationModalBtn?.addEventListener('click', () => {
        if (elements.translationModal) elements.translationModal.style.display = 'none';
    });
    elements.translationModal?.addEventListener('click', (e) => {
        if (e.target === elements.translationModal) {
            elements.translationModal.style.display = 'none';
        }
    });
    elements.translationTargetLang?.addEventListener('change', () => {
        if (translationSelectedMessages.length > 0) {
            performTranslation(translationSelectedMessages);
        }
    });
    elements.copyTranslationBtn?.addEventListener('click', async () => {
        if (!currentTranslationText) return;
        try {
            await navigator.clipboard.writeText(currentTranslationText);
            showToast("Translation copied to clipboard", "success");
        } catch (err) {
            showToast("Failed to copy translation", "error");
        }
    });
    elements.downloadPackBtn?.addEventListener('click', async () => {
        const targetLang = elements.translationTargetLang?.value || 'en';
        const langObj = languageList.find(l => l.code === targetLang) || { name: targetLang };
        await downloadLanguagePack(targetLang, langObj.name);
        if (translationSelectedMessages.length > 0) {
            performTranslation(translationSelectedMessages);
        }
    });

    // Sidebar Search Highlighting (Chat & Customers)
    const setupSidebarSearch = (sidebarEl, listContainer) => {
        const input = sidebarEl?.querySelector('.search-input');
        const debouncedFilter = debounce((term) => {
            const items = listContainer?.querySelectorAll('.conversation-item');

            items?.forEach(item => {
                const nameEl = item.querySelector('.conversation-name');
                const originalName = nameEl?.dataset.name || '';
                const matches = originalName.toLowerCase().includes(term);

                item.style.display = matches ? 'flex' : 'none';

                const icon = nameEl?.querySelector('.muted-icon');
                const iconHtml = icon ? icon.outerHTML : '';

                if (term && matches) {
                    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    const highlighted = originalName.replace(regex, '<mark class="search-highlight">$1</mark>');
                    if (nameEl) nameEl.innerHTML = highlighted + iconHtml;
                } else if (nameEl) {
                    nameEl.innerHTML = originalName + iconHtml;
                }
            });
        }, 300); // Debounce delay for sidebar search
        input?.addEventListener('input', (e) => {
            debouncedFilter(e.target.value.toLowerCase().trim());
        });
    };

    setupSidebarSearch(elements.chatSidebar, elements.chatConversationList);
    setupSidebarSearch(elements.custSidebar, elements.custConversationList);
    setupSidebarSearch(elements.callsSidebar, elements.callHistoryList);

    // Forward Modal Search Logic
    const debouncedForwardSearch = debounce((term) => {
        const items = elements.forwardUserList?.querySelectorAll('.conversation-item');

        items?.forEach(item => {
            const nameEl = item.querySelector('.conversation-name');
            const originalName = nameEl?.dataset.name || '';
            const matches = originalName.toLowerCase().includes(term);

            item.style.display = matches ? 'flex' : 'none';

            if (term && matches) {
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                nameEl.innerHTML = originalName.replace(regex, '<mark class="search-highlight">$1</mark>');
            } else {
                nameEl.textContent = originalName;
            }
        });
    }, 300); // Debounce delay for forward search

    elements.forwardSearchInput?.addEventListener('input', (e) => {
        debouncedForwardSearch(e.target.value.toLowerCase().trim());
    });

    // Handle Forward recipient selection
    elements.forwardUserList?.addEventListener('click', (e) => {
        const item = e.target.closest('.conversation-item');
        if (!item) return;
        const uid = item.dataset.uid;

        if (selectedForwardRecipients.has(uid)) {
            selectedForwardRecipients.delete(uid);
            item.classList.remove('selected');
        } else {
            selectedForwardRecipients.add(uid);
            item.classList.add('selected');
        }
        updateForwardButton();
    });

    elements.confirmForwardBtn?.addEventListener('click', async () => {
        if (selectedForwardRecipients.size === 0 || pendingForwardData.length === 0) return;

        const btn = elements.confirmForwardBtn;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Sending...';

        const recipients = Array.from(selectedForwardRecipients);
        try {
            // 1. Upload files first if any exist in pendingForwardData
            for (const item of pendingForwardData) {
                if (item.fileBlob) {
                    const ext = item.fileName ? item.fileName.split('.').pop() : (item.type === 'image' ? 'jpg' : 'bin');
                    const storagePath = `chat_media/shared/${Date.now()}_${auth.currentUser.uid}.${ext}`;

                    const uploadTask = uploadFile(storagePath, item.fileBlob);
                    item.url = await uploadTask;

                    // Generate PDF thumbnail if applicable
                    if (item.type === 'document' && item.fileName?.toLowerCase().endsWith('.pdf')) {
                        try {
                            const thumbBlob = await generatePdfThumbnail(item.fileBlob);
                            const thumbPath = `chat_media/shared/thumb_${Date.now()}.jpg`;
                            item.thumbnailUrl = await uploadFile(thumbPath, thumbBlob);
                        } catch (e) {
                            console.warn("Could not generate PDF thumbnail for shared file:", e);
                        }
                    }

                    // Clean up blob reference so we don't try to save it or send it to DB
                    delete item.fileBlob;
                }
            }

            // 2. Execute forward for all recipients
            await Promise.all(recipients.map(uid => executeForward(uid, pendingForwardData)));
            showToast(`Messages forwarded to ${recipients.length} recipients`, "success");
            toggleSelectMode(false);
            if (elements.forwardModal) elements.forwardModal.style.display = 'none';
        } catch (error) {
            console.error("Failed to forward shared files/messages:", error);
            showToast("Failed to send shared content.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            pendingForwardData = [];
        }
    });

    elements.closeForwardModalBtn?.addEventListener('click', () => {
        if (elements.forwardModal) elements.forwardModal.style.display = 'none';
    });

    elements.closeReactionDetailModalBtn?.addEventListener('click', () => {
        if (elements.reactionDetailModal) elements.reactionDetailModal.style.display = 'none';
    });

    // Desktop Context Menu Handlers
    elements.messagesContainer?.addEventListener('contextmenu', (e) => {
        const group = e.target.closest('.message-group');
        if (!group) return;
        e.preventDefault();
        if (isSelectMode || window.blockContextMenu) return;
        openContextMenu(group.id, e.clientX, e.clientY);
    });

    // Create Reaction Picker if it doesn't exist
    if (!elements.reactionPicker) {
        document.body.insertAdjacentHTML('beforeend', `<div class="reaction-picker" data-ui="reaction-picker"><button class="reaction-picker-btn" data-emoji="👍">👍</button><button class="reaction-picker-btn" data-emoji="❤️">❤️</button><button class="reaction-picker-btn" data-emoji="😂">😂</button><button class="reaction-picker-btn" data-emoji="😮">😮</button><button class="reaction-picker-btn" data-emoji="😢">😢</button><button class="reaction-picker-btn" data-emoji="😡">😡</button></div>`);
    }

    elements.messageContextMenu?.addEventListener('click', async (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item || !contextMenuTargetId || !activeChatUid) return;

        const action = item.dataset.action;
        const msg = messages.find(m => m.id === contextMenuTargetId);
        const user = auth.currentUser;

        if (action === 'react') {
            if (elements.reactionPicker) {
                reactionPickerTargetId = contextMenuTargetId;
                elements.reactionPicker.style.display = 'flex';
                // Position the picker near the context menu
                const menuRect = elements.messageContextMenu.getBoundingClientRect();
                elements.reactionPicker.style.left = `${menuRect.left}px`;
                elements.reactionPicker.style.top = `${menuRect.top - elements.reactionPicker.offsetHeight - 10}px`;
            }
            if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
            return; // Don't close context menu yet, picker will handle it
        }

        // All other actions
        switch (action) {
            case 'reply':
                if (msg) {
                    const senderName = msg.senderId === user.uid ? 'You' : (elements.chatHeaderName?.textContent || 'Contact');
                    showReplyPreview(msg.id, msg.text || `[${msg.type}]`, senderName);
                }
                break;
            case 'edit':
                if (msg && msg.text) showEditPreview(msg.id, msg.text);
                break;
            case 'edit-image':
                if (msg && msg.url) {
                    if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
                    showToast("Downloading image for editing...", "info");
                    try {
                        const resp = await fetch(msg.url);
                        const blob = await resp.blob();
                        const editedBlob = await openImageEditor(blob);
                        if (editedBlob) {
                            showToast("Sending edited image...", "info");
                            await sendMedia('image', editedBlob, msg.fileName || 'edited_image.jpg');
                        }
                    } catch (err) {
                        console.error("Failed to download or edit image:", err);
                        showToast("Error loading image for editing.", "error");
                    }
                }
                break;
            case 'sign-document':
                if (msg && msg.url) {
                    if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
                    showToast("Downloading document for signing...", "info");
                    try {
                        const resp = await fetch(msg.url);
                        const blob = await resp.blob();
                        const signedBlob = await openDocSigner(blob);
                        if (signedBlob) {
                            showToast("Sending signed document...", "info");
                            await sendMedia('document', signedBlob, msg.fileName || 'signed_document.pdf');
                        }
                    } catch (err) {
                        console.error("Failed to download or sign document:", err);
                        showToast("Error loading document for signing.", "error");
                    }
                }
                break;
            case 'pin':
                handlePinMessage(contextMenuTargetId);
                break;
            case 'unpin':
                handleUnpinMessage();
                break;
            case 'info':
                if (msg) showMessageInfo(msg);
                break;
            case 'select':
                toggleSelectMode(true);
                selectedMessages.add(contextMenuTargetId);
                updateSelectionUI();
                break;
            case 'copy':
                if (msg && msg.text) {
                    try {
                        await navigator.clipboard.writeText(msg.text);
                        showToast("Text copied to clipboard", "success");
                    } catch (err) {
                        showToast("Failed to copy text", "error");
                    }
                }
                break;
            case 'star':
                await handleMassStar(); // Re-uses the existing logic (needs TargetId added to Set)
                break;
            case 'forward':
                selectedMessages.clear();
                selectedMessages.add(contextMenuTargetId);
                handleMassForward();
                break;
            case 'delete':
                selectedMessages.clear();
                selectedMessages.add(contextMenuTargetId);
                handleMassDelete();
                break;
        }
        if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
    });

    // Reaction Picker click handler
    elements.reactionPicker?.addEventListener('click', (e) => {
        const btn = e.target.closest('.reaction-picker-btn');
        if (btn && reactionPickerTargetId) {
            const emoji = btn.dataset.emoji;
            toggleReaction(reactionPickerTargetId, emoji);
            if (elements.reactionPicker) elements.reactionPicker.style.display = 'none';
            reactionPickerTargetId = null;
        }
    });

    const closeAllContextMenus = () => {
        if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
        if (elements.reactionPicker) elements.reactionPicker.style.display = 'none';
        if (elements.headerDropdownMenu) elements.headerDropdownMenu.style.display = 'none';
        if (elements.chatHeaderMenu) elements.chatHeaderMenu.style.display = 'none';
        if (elements.selectionEllipsisMenu) elements.selectionEllipsisMenu.style.display = 'none';
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
        if (elements.emojiPickerContent) elements.emojiPickerContent.style.display = 'none';
        if (elements.archivedChatContextMenu) elements.archivedChatContextMenu.style.display = 'none';
        if (elements.activeChatContextMenu) elements.activeChatContextMenu.style.display = 'none';
        if (elements.callDropdownMenu) elements.callDropdownMenu.style.display = 'none';
    };

    // Close reaction picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message-context-menu, .reaction-picker, .header-dropdown-menu, .chat-header-menu, .selection-ellipsis-menu, .attachment-menu, .emoji-picker-content')) {
            closeAllContextMenus();
        }
    });
    const isSendOnEnterEnabled = () => {
        const settings = JSON.parse(localStorage.getItem('hotmapp_chat_message_settings') || '{}');
        return settings.sendOnEnter === true;
    };

    elements.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && isSendOnEnterEnabled()) {
            e.preventDefault(); // Prevent new line on Enter
            sendMessage();
        }
    });

    // File Attachment interaction
    elements.attachBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.attachmentMenu) {
            const isHidden = elements.attachmentMenu.style.display === 'none';
            elements.attachmentMenu.style.display = isHidden ? 'flex' : 'none';
            // Hide other popups
            if (isHidden && elements.emojiPickerContent) elements.emojiPickerContent.style.display = 'none';
        }
    });

    // Attachment Menu Item Handlers
    elements.attachMediaBtn?.addEventListener('click', () => {
        if (elements.fileInput) {
            elements.fileInput.accept = 'image/*,video/*';
            elements.fileInput.click();
        }
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
    });

    elements.attachCameraBtn?.addEventListener('click', () => {
        elements.cameraBtn?.click();
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
    });

    elements.attachDocBtn?.addEventListener('click', () => {
        if (elements.fileInput) {
            elements.fileInput.accept = ALLOWED_DOC_EXTENSIONS.join(',');
            elements.fileInput.click();
        }
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
    });

    elements.attachEphemeralBtn?.addEventListener('click', () => {
        if (elements.ephemeralPickerModal) elements.ephemeralPickerModal.style.display = 'flex';
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
    });

    elements.attachLocationBtn?.addEventListener('click', () => {
        if (elements.locationModal) {
            elements.locationModal.style.display = 'flex';
            // Invalidate map size AFTER the modal is visible to ensure correct rendering
            if (selectionMap) {
                setTimeout(() => selectionMap.invalidateSize(), 10);
            }

            if (elements.locationSearchInput) elements.locationSearchInput.value = '';
            if (elements.locationSearchResults) elements.locationSearchResults.style.display = 'none';
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => initSelectionMap(pos.coords.latitude, pos.coords.longitude),
                    () => initSelectionMap(0, 0) // Default center if GPS blocked
                );
            } else {
                initSelectionMap(0, 0);
            }
        }
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
    });

    elements.fileInput?.addEventListener('change', async (e) => {
        const files = e.target.files;
        const user = auth.currentUser;

        if (!files || files.length === 0 || !user || !activeChatUid) return;

        const chatId = [user.uid, activeChatUid].sort().join('_');

        // Process files sequentially, prompting user for edit/sign choices when applicable
        for (const file of Array.from(files)) {
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                showToast(`"${file.name}" is too large! Max allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`, "warning");
                continue;
            }

            let messageType = '';

            if (file.type.startsWith('image/')) {
                messageType = 'image';
            } else if (file.type.startsWith('video/')) {
                messageType = 'video';
            } else {
                messageType = 'document';

                // Validate document extension
                const ext = '.' + file.name.split('.').pop().toLowerCase();
                if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
                    showToast(`Document type ${ext} is not allowed.`, "warning");
                    continue;
                }
            }

            try {
                await sendMedia(messageType, file, file.name);
            } catch (err) {
                console.error('File handling error', err);
                await sendMedia(messageType, file, file.name);
            }
        }

        if (elements.messagesContainer) {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }
        e.target.value = ''; // Reset input to allow re-uploading the same file
    });

    const renderEmojisForCategory = (category, searchTerm = '') => {
        const grid = elements.emojiGrid;
        if (!grid) return;
        grid.innerHTML = '';

        let list = [];
        if (searchTerm) {
            Object.values(emojiCategories).forEach(cat => list.push(...cat));
            list = [...new Set(list)].filter(emoji => {
                const keywords = (emojiKeywords[emoji] || '').toLowerCase();
                return keywords.includes(searchTerm.toLowerCase());
            });
        } else if (category === 'Recently Used') {
            list = JSON.parse(localStorage.getItem(FREQUENT_EMOJIS_KEY) || '[]');
        } else {
            list = emojiCategories[category] || [];
        }

        list.forEach(emoji => {
            let emojiToRender = emoji;
            // Apply skin tone only if it's supported and NOT the "Recently Used" tab 
            // (since Recently Used stores the actual emoji clicked with its tone)
            if (category !== 'Recently Used' && !searchTerm && currentSkinTone && supportsSkinTone(emoji)) {
                emojiToRender += currentSkinTone;
            }

            const span = document.createElement('span');
            span.textContent = emojiToRender;
            grid.appendChild(span);
        });

        if ((searchTerm || category === 'Recently Used') && list.length === 0) {
            const msg = searchTerm ? 'No matches' : 'Emojis you use often will appear here';
            grid.innerHTML = `<div style="grid-column: span 8; text-align:center; padding: 20px; font-size: 0.8rem; color: var(--muted);">${msg}</div>`;
        }
    };

    const renderSkinToneSelector = () => {
        const container = elements.emojiSkinTones;
        if (!container) return;
        container.innerHTML = '';

        SKIN_TONE_MODIFIERS.forEach(tone => {
            const btn = document.createElement('button');
            const toneClass = tone === '' ? 'default' : tone.codePointAt(0).toString(16);
            btn.className = `skin-tone-btn tone-${toneClass} ${currentSkinTone === tone ? 'active' : ''}`;
            btn.title = tone === '' ? 'Default Tone' : 'Skin Tone Modifier';

            btn.onclick = (e) => {
                e.stopPropagation();
                currentSkinTone = tone;
                localStorage.setItem(SKIN_TONE_STORAGE_KEY, tone);

                // Re-render the current category/search to show new tones
                const activeTab = elements.emojiCategories?.querySelector('.emoji-category-tab.active');
                const activeCat = activeTab?.title || 'Smileys & People';
                const searchTerm = elements.emojiSearchInput?.value.trim();

                renderSkinToneSelector(); // Refresh active state
                renderEmojisForCategory(searchTerm ? null : activeCat, searchTerm);
            };
            container.appendChild(btn);
        });
    };

    const renderEmojiCategories = () => {
        const container = elements.emojiCategories;
        if (!container) return;
        container.innerHTML = '';

        const frequent = JSON.parse(localStorage.getItem(FREQUENT_EMOJIS_KEY) || '[]');
        const defaultCat = frequent.length > 0 ? 'Recently Used' : 'Smileys & People';

        const icons = {
            'Recently Used': 'fa-regular fa-clock',
            'Smileys & People': 'fa-regular fa-face-smile',
            'Animals & Nature': 'fa-solid fa-leaf',
            'Food & Drink': 'fa-solid fa-utensils',
            'Activities': 'fa-solid fa-basketball',
            'Travel & Places': 'fa-solid fa-plane',
            'Objects': 'fa-solid fa-lightbulb',
            'Symbols': 'fa-solid fa-icons',
            'Flags': 'fa-solid fa-flag'
        };

        const categoryNames = ['Recently Used', ...Object.keys(emojiCategories)];

        categoryNames.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'emoji-category-tab';
            btn.innerHTML = `<i class="${icons[category] || 'fa-solid fa-icons'}"></i>`;
            btn.title = category;
            btn.onclick = (e) => {
                e.stopPropagation();
                container.querySelectorAll('.emoji-category-tab').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                if (elements.emojiSearchInput) elements.emojiSearchInput.value = '';
                renderEmojisForCategory(category);
            };
            if (category === defaultCat) btn.classList.add('active');
            container.appendChild(btn);
        });
    };

    elements.emojiSearchInput?.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        if (term) {
            elements.emojiCategories?.querySelectorAll('.emoji-category-tab').forEach(t => t.classList.remove('active'));
            renderEmojisForCategory(null, term);
        } else {
            const firstTab = elements.emojiCategories?.querySelector('.emoji-category-tab');
            firstTab?.click();
        }
    });

    // Emoji Picker Toggle
    elements.emojiBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.emojiPickerContent) {
            const isHidden = elements.emojiPickerContent.style.display === 'none';
            elements.emojiPickerContent.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) {
                if (elements.emojiSearchInput) elements.emojiSearchInput.value = '';
                renderSkinToneSelector();
                renderEmojiCategories();

                const frequent = JSON.parse(localStorage.getItem(FREQUENT_EMOJIS_KEY) || '[]');
                const startingCat = frequent.length > 0 ? 'Recently Used' : 'Smileys & People';
                renderEmojisForCategory(startingCat);
            }
        }
    });

    // Handle Emoji Selection
    elements.emojiPickerContent?.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            const emoji = e.target.textContent;
            const input = elements.messageInput;
            const start = input.selectionStart;
            const end = input.selectionEnd;

            input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
            input.focus();
            input.selectionStart = input.selectionEnd = start + emoji.length;

            updateFrequentEmojis(emoji);
            toggleInputButtons();
        }
    });

    // Close picker when clicking outside
    document.addEventListener('click', () => {
        if (elements.emojiPicker) elements.emojiPicker.style.display = 'none';
        if (elements.attachmentMenu) elements.attachmentMenu.style.display = 'none';
        if (elements.emojiPickerContent) elements.emojiPickerContent.style.display = 'none';
        if (elements.locationSearchResults) elements.locationSearchResults.style.display = 'none';
        if (elements.archivedChatContextMenu) elements.archivedChatContextMenu.style.display = 'none';
        if (elements.headerDropdownMenu) elements.headerDropdownMenu.style.display = 'none'; // Close header dropdown
        if (elements.ephemeralPickerModal) elements.ephemeralPickerModal.style.display = 'none';
        if (elements.reactionPicker) elements.reactionPicker.style.display = 'none';
        if (elements.messageContextMenu) elements.messageContextMenu.style.display = 'none';
        if (elements.chatHeaderMenu) elements.chatHeaderMenu.style.display = 'none';
        if (elements.audioSourceMenu) {
            elements.audioSourceMenu.style.display = 'none';
            elements.callAudioSourceBtn?.classList.remove('active');
        }
    });

    // Ephemeral Message Picker Logic
    const ephemeralOptions = [
        { label: 'Off', duration: 0 },
        { label: '5 seconds', duration: 5 * 1000 },
        { label: '1 minute', duration: 60 * 1000 },
        { label: '1 hour', duration: 60 * 60 * 1000 },
        { label: '1 day', duration: 24 * 60 * 60 * 1000 },
        { label: '1 week', duration: 7 * 24 * 60 * 60 * 1000 }
    ];

    const renderEphemeralPicker = () => {
        if (!elements.ephemeralOptions) return;
        elements.ephemeralOptions.innerHTML = '';

        ephemeralOptions.forEach(option => {
            const item = document.createElement('label');
            item.className = `ephemeral-option-item ${ephemeralExpiryDuration === option.duration ? 'active' : ''}`;
            item.innerHTML = `
                <span>${option.label}</span>
                <input type="radio" name="ephemeral-duration" value="${option.duration}" ${ephemeralExpiryDuration === option.duration ? 'checked' : ''}>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent modal closing immediately
                setEphemeralDuration(option.duration);
                if (elements.ephemeralPickerModal) elements.ephemeralPickerModal.style.display = 'none';
            });
            elements.ephemeralOptions.appendChild(item);
        });
    };

    const setEphemeralDuration = (duration) => {
        ephemeralExpiryDuration = duration;
        const attachBtn = elements.attachEphemeralBtn;
        if (attachBtn) {
            if (duration > 0) {
                attachBtn.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${formatDurationHuman(duration)}`;
                attachBtn.classList.add('active');
            } else {
                attachBtn.innerHTML = `<i class="fa-solid fa-hourglass-empty"></i> Ephemeral`;
                attachBtn.classList.remove('active');
            }
        }
        showToast(duration > 0 ? `Ephemeral messages set to ${formatDurationHuman(duration)}` : 'Ephemeral messages off', 'info');
    };

    elements.attachEphemeralBtn?.addEventListener('click', () => {
        renderEphemeralPicker();
        if (elements.ephemeralPickerModal) elements.ephemeralPickerModal.style.display = 'flex';
    });

    // Call Controls
    elements.voiceCallBtn?.addEventListener('click', () => {
        if (elements.callDropdownMenu) elements.callDropdownMenu.style.display = 'none';
        startVoiceCall();
    });
    elements.videoCallBtn?.addEventListener('click', () => {
        if (elements.callDropdownMenu) elements.callDropdownMenu.style.display = 'none';
        startVideoCall();
    });
    elements.callEndBtn?.addEventListener('click', endCall);
    elements.callVideoBtn?.addEventListener('click', switchCallToVideo);
    elements.callFlipCameraBtn?.addEventListener('click', flipCamera);
    elements.callPipBtn?.addEventListener('click', togglePiP);
    elements.callAudioSourceBtn?.addEventListener('click', toggleAudioSourceMenu);
    elements.callSpeakerBtn?.addEventListener('click', toggleSpeaker);
    elements.callCamMuteBtn?.addEventListener('click', toggleCameraMute);
    elements.callFlashBtn?.addEventListener('click', toggleFlash);
    elements.callRetryBtn?.addEventListener('click', retryCallHandshake);
    elements.callMuteBtn?.addEventListener('click', toggleCallMute);
    elements.callAddUserBtn?.addEventListener('click', showAddParticipantModal);
    elements.callScreenShareBtn?.addEventListener('click', toggleScreenSharing);

    // Call More Options Bottom Sheet
    elements.callMoreBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.callMoreSheet?.classList.add('show');
        if (elements.callMoreBackdrop) elements.callMoreBackdrop.style.display = 'block';

        // Dynamically compute the bottom sheet height to offset video elements on real mobile screens
        setTimeout(() => {
            const sheet = elements.callMoreSheet;
            if (sheet) {
                const sheetHeight = sheet.offsetHeight;
                const offsetValue = `${sheetHeight + 16}px`;
                elements.localVideo?.style.setProperty('--sheet-offset', offsetValue);
                elements.remoteVideo?.style.setProperty('--sheet-offset', offsetValue);
                elements.remoteMuteOverlay?.style.setProperty('--sheet-offset', offsetValue);
                elements.localClickCatcher?.style.setProperty('--sheet-offset', offsetValue);
                elements.remoteClickCatcher?.style.setProperty('--sheet-offset', offsetValue);
            }
        }, 50);
    });

    const closeCallMoreSheet = () => {
        elements.callMoreSheet?.classList.remove('show');
        if (elements.callMoreBackdrop) elements.callMoreBackdrop.style.display = 'none';
        if (elements.audioSourceMenu) {
            elements.audioSourceMenu.style.display = 'none';
            elements.callAudioSourceBtn?.classList.remove('active');
        }

        // Reset video offsets
        elements.localVideo?.style.removeProperty('--sheet-offset');
        elements.remoteVideo?.style.removeProperty('--sheet-offset');
        elements.remoteMuteOverlay?.style.removeProperty('--sheet-offset');
        elements.localClickCatcher?.style.removeProperty('--sheet-offset');
        elements.remoteClickCatcher?.style.removeProperty('--sheet-offset');
    };

    elements.callMoreBackdrop?.addEventListener('click', closeCallMoreSheet);

    // Video feed swap click listeners (using transparent catchers for touchscreen compatibility)
    elements.localClickCatcher?.addEventListener('click', toggleVideoSwap);
    elements.remoteClickCatcher?.addEventListener('click', toggleVideoSwap);

    elements.callMoreSheet?.addEventListener('click', (e) => {
        const clickedBtn = e.target.closest('.call-btn');
        if (!clickedBtn) return;

        const isAddUser = clickedBtn.classList.contains('add-participant');
        const isPip = clickedBtn.classList.contains('pip');
        const isRetry = clickedBtn.classList.contains('retry');
        const isScreenShare = clickedBtn.classList.contains('screen-share');

        if (isAddUser || isPip || isRetry || isScreenShare) {
            setTimeout(closeCallMoreSheet, 250);
        }
    });

    // Switch Call Badge Logic
    elements.switchCallBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!waitingCallSignal) return;

        const signalToAccept = { ...waitingCallSignal };
        waitingCallSignal = null;
        stopWaitingBeeps();
        if (elements.waitingCallBadge) elements.waitingCallBadge.style.display = 'none';

        // 1. Terminate current session
        await endCall();

        // 2. Accept the waiting call
        currentCallType = signalToAccept.callType || 'voice';
        if (elements.callOverlay) {
            elements.callOverlay.style.display = 'flex';
            elements.callOverlayName.textContent = signalToAccept.fromName;
            elements.callStatus.textContent = "Connecting...";
            if (currentCallType === 'video') {
                showVideoCallLayout();
            } else {
                elements.callOverlay?.classList.remove('video-mode');
                if (elements.videoContainer) elements.videoContainer.style.display = 'none';
                if (elements.callFlipCameraBtn) elements.callFlipCameraBtn.style.display = 'none';
                if (elements.callCamMuteBtn) elements.callCamMuteBtn.style.display = 'none';
                if (elements.callPipBtn) elements.callPipBtn.style.display = 'none';
                if (elements.callFlashBtn) elements.callFlashBtn.style.display = 'none';
                if (elements.callScreenShareBtn) elements.callScreenShareBtn.style.display = 'none';
            }
        }

        if (isSettingRemoteDescription) return;
        try {
            isSettingRemoteDescription = true;
            currentCallPartnerUid = signalToAccept.from;
            callParticipants.add(signalToAccept.from);

            const pc = await setupWebRTC(signalToAccept.from, false, currentCallType);
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signalToAccept.offer }));
            processCandidatesQueue(signalToAccept.from);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendCallSignal(signalToAccept.from, auth.currentUser.uid, {
                status: 'accepted',
                answer: answer.sdp,
                from: auth.currentUser.uid
            });
            if (elements.callStatus) elements.callStatus.textContent = "Connected";
            if (currentCallType === 'video') {
                showVideoCallLayout();
            } else if (currentCallType === 'voice' && elements.callVideoBtn) {
                elements.callVideoBtn.style.display = 'flex';
            }
        } catch (err) {
            console.error("Error setting remote offer on accept:", err);
        } finally {
            isSettingRemoteDescription = false;
        }

        // Select the caller's chat in the UI
        const item = document.querySelector(`.conversation-item[data-uid="${signalToAccept.from}"]`);
        if (item) item.click();

        updateCallUI();
    });

    // Reject Waiting Call Logic
    elements.rejectWaitingCallBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!waitingCallSignal) return;

        const fromUid = waitingCallSignal.from;
        // Inform the caller that the recipient is busy
        stopWaitingBeeps();
        await sendCallSignal(fromUid, { status: 'busy', from: auth.currentUser.uid });

        waitingCallSignal = null;
        if (elements.waitingCallBadge) elements.waitingCallBadge.style.display = 'none';
        showToast("Waiting call rejected", "info");
    });

    // Call Minimize Handlers
    elements.minimizeCallBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCallMinimize(true);
    });

    elements.pipEndCallBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        endCall();
    });
    elements.pipEndCallBtn?.addEventListener('mousedown', (e) => e.stopPropagation());
    elements.pipEndCallBtn?.addEventListener('touchstart', (e) => e.stopPropagation());

    elements.minimizedCallBar?.addEventListener('click', (e) => {
        if (!e.target.closest('.min-action-btn')) toggleCallMinimize(false);
    });

    // Draggable Pip Logic for Video Calls
    let isPipDragging = false;
    let pipStartX, pipStartY;
    let pipInitialLeft, pipInitialTop;
    let lastTapTime = 0;
    let tapTimeout = null;

    const onPipDragStart = (e) => {
        if (!elements.callOverlay?.classList.contains('minimized')) return;

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        pipStartX = clientX;
        pipStartY = clientY;

        const rect = elements.callOverlay.getBoundingClientRect();
        pipInitialLeft = rect.left;
        pipInitialTop = rect.top;

        isPipDragging = false;

        document.addEventListener('mousemove', onPipDragging);
        document.addEventListener('touchmove', onPipDragging, { passive: false });
        document.addEventListener('mouseup', onPipDragEnd);
        document.addEventListener('touchend', onPipDragEnd);
    };

    const onPipDragging = (e) => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const dx = clientX - pipStartX;
        const dy = clientY - pipStartY;

        if (!isPipDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            isPipDragging = true;
            if (elements.callOverlay) elements.callOverlay.style.transition = 'none';
        }

        if (isPipDragging) {
            if (e.cancelable) e.preventDefault();
            let newLeft = pipInitialLeft + dx;
            let newTop = pipInitialTop + dy;

            // Keep the PiP window within viewport bounds
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - elements.callOverlay.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - elements.callOverlay.offsetHeight));

            elements.callOverlay.style.left = `${newLeft}px`;
            elements.callOverlay.style.top = `${newTop}px`;
            elements.callOverlay.style.right = 'auto';
            elements.callOverlay.style.bottom = 'auto';
        }
    };

    const onPipDragEnd = () => {
        if (isPipDragging && elements.callOverlay) {
            elements.callOverlay.style.transition = ''; // Restore CSS transitions from style.css

            const rect = elements.callOverlay.getBoundingClientRect();
            const padding = 16;
            const width = elements.callOverlay.offsetWidth;
            const height = elements.callOverlay.offsetHeight;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            // Snap horizontally to the closest edge (left or right)
            const centerX = rect.left + width / 2;
            const snapX = centerX < winW / 2 ? padding : winW - width - padding;

            // Keep the vertical height where it was dropped, bounded by window size
            let snapY = rect.top;
            snapY = Math.max(padding, Math.min(snapY, winH - height - padding));

            elements.callOverlay.style.left = `${snapX}px`;
            elements.callOverlay.style.top = `${snapY}px`;
            elements.callOverlay.style.right = 'auto';
            elements.callOverlay.style.bottom = 'auto';

            // Provide a subtle haptic "click" on snap
            if (navigator.vibrate) navigator.vibrate(20);
        }

        if (elements.callOverlay) elements.callOverlay.style.transition = '';
        document.removeEventListener('mousemove', onPipDragging);
        document.removeEventListener('touchmove', onPipDragging);
        document.removeEventListener('mouseup', onPipDragEnd);
        document.removeEventListener('touchend', onPipDragEnd);

        // Reset dragging flag after a small delay to prevent drag release from triggering expansion
        setTimeout(() => { isPipDragging = false; }, 100);
    };

    elements.callOverlay?.addEventListener('mousedown', onPipDragStart);
    elements.callOverlay?.addEventListener('touchstart', onPipDragStart, { passive: true });

    elements.callOverlay?.addEventListener('click', (e) => {
        if (isPipDragging) return;

        // Single tap to restore call screen
        if (elements.callOverlay?.classList.contains('minimized')) {
            toggleCallMinimize(false);
            if (navigator.vibrate) navigator.vibrate(20);
            return;
        }

        const now = Date.now();
        const timespan = now - lastTapTime;

        if (timespan < 300 && timespan > 0) {
            // Double tap detected
            clearTimeout(tapTimeout);
            lastTapTime = 0;
            flipCamera();
            if (navigator.vibrate) navigator.vibrate(30);
        } else {
            // Single tap - wait for a potential double tap
            lastTapTime = now;
            tapTimeout = setTimeout(() => {
                lastTapTime = 0;
            }, 300);
        }
    });

    // Draggable Local Video Preview Logic (My Picture) in Call Screen
    let localVideoStartX, localVideoStartY;
    let localVideoInitialLeft, localVideoInitialTop;

    const onLocalVideoDragStart = (e) => {
        // Only allow dragging in full-screen mode and when not swapped
        if (elements.callOverlay?.classList.contains('minimized')) return;
        if (elements.videoContainer?.classList.contains('swapped')) return;

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        localVideoStartX = clientX;
        localVideoStartY = clientY;

        const rect = elements.localVideo.getBoundingClientRect();
        localVideoInitialLeft = rect.left;
        localVideoInitialTop = rect.top;

        isLocalVideoDragging = false;

        document.addEventListener('mousemove', onLocalVideoDragging);
        document.addEventListener('touchmove', onLocalVideoDragging, { passive: false });
        document.addEventListener('mouseup', onLocalVideoDragEnd);
        document.addEventListener('touchend', onLocalVideoDragEnd);
    };

    const onLocalVideoDragging = (e) => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const dx = clientX - localVideoStartX;
        const dy = clientY - localVideoStartY;

        if (!isLocalVideoDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            isLocalVideoDragging = true;
            if (elements.localVideo) elements.localVideo.style.transition = 'none';
            if (elements.localClickCatcher) elements.localClickCatcher.style.transition = 'none';
        }

        if (isLocalVideoDragging) {
            if (e.cancelable) e.preventDefault();
            let newLeft = localVideoInitialLeft + dx;
            let newTop = localVideoInitialTop + dy;

            // Constrain within window viewport bounds
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - elements.localVideo.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - elements.localVideo.offsetHeight));

            if (elements.localVideo) {
                elements.localVideo.style.left = `${newLeft}px`;
                elements.localVideo.style.top = `${newTop}px`;
                elements.localVideo.style.bottom = 'auto';
                elements.localVideo.style.right = 'auto';
            }

            if (elements.localClickCatcher) {
                elements.localClickCatcher.style.left = `${newLeft}px`;
                elements.localClickCatcher.style.top = `${newTop}px`;
                elements.localClickCatcher.style.bottom = 'auto';
                elements.localClickCatcher.style.right = 'auto';
            }
        }
    };

    const onLocalVideoDragEnd = () => {
        if (isLocalVideoDragging) {
            if (elements.localVideo) elements.localVideo.style.transition = '';
            if (elements.localClickCatcher) elements.localClickCatcher.style.transition = '';

            const rect = elements.localVideo.getBoundingClientRect();
            const padding = 16;
            const width = elements.localVideo.offsetWidth;
            const height = elements.localVideo.offsetHeight;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            // Snap horizontally to the closest edge (left or right)
            const centerX = rect.left + width / 2;
            const snapX = centerX < winW / 2 ? padding : winW - width - padding;

            // Snap vertically bounded with room for call controls at the bottom
            let snapY = rect.top;
            snapY = Math.max(padding, Math.min(snapY, winH - height - padding - 90));

            if (elements.localVideo) {
                elements.localVideo.style.left = `${snapX}px`;
                elements.localVideo.style.top = `${snapY}px`;
                elements.localVideo.style.bottom = 'auto';
                elements.localVideo.style.right = 'auto';
            }

            if (elements.localClickCatcher) {
                elements.localClickCatcher.style.left = `${snapX}px`;
                elements.localClickCatcher.style.top = `${snapY}px`;
                elements.localClickCatcher.style.bottom = 'auto';
                elements.localClickCatcher.style.right = 'auto';
            }

            if (navigator.vibrate) navigator.vibrate(20);
        }

        document.removeEventListener('mousemove', onLocalVideoDragging);
        document.removeEventListener('touchmove', onLocalVideoDragging);
        document.removeEventListener('mouseup', onLocalVideoDragEnd);
        document.removeEventListener('touchend', onLocalVideoDragEnd);

        setTimeout(() => { isLocalVideoDragging = false; }, 100);
    };

    elements.localClickCatcher?.addEventListener('mousedown', onLocalVideoDragStart);
    elements.localClickCatcher?.addEventListener('touchstart', onLocalVideoDragStart, { passive: false });

    // PiP Resizing Logic
    let isPipResizing = false;
    let pipResizeStartX;
    let pipInitialWidth, pipInitialHeight;

    const onPipResizeStart = (e) => {
        e.stopPropagation();
        isPipResizing = true;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        pipResizeStartX = clientX;

        const rect = elements.callOverlay.getBoundingClientRect();
        pipInitialWidth = rect.width;
        pipInitialHeight = rect.height;
        pipInitialLeft = rect.left;
        pipInitialTop = rect.top;

        if (elements.callOverlay) elements.callOverlay.style.transition = 'none';

        document.addEventListener('mousemove', onPipResizing);
        document.addEventListener('touchmove', onPipResizing, { passive: false });
        document.addEventListener('mouseup', onPipResizeEnd);
        document.addEventListener('touchend', onPipResizeEnd);
    };

    const onPipResizing = (e) => {
        if (!isPipResizing) return;
        if (e.cancelable) e.preventDefault();

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;

        // Scaling from bottom-left anchors the bottom-right corner
        const dx = pipResizeStartX - clientX;
        const newWidth = Math.max(120, Math.min(350, pipInitialWidth + dx));
        const newHeight = newWidth * 1.5; // Maintain 2:3 aspect ratio

        elements.callOverlay.style.width = `${newWidth}px`;
        elements.callOverlay.style.height = `${newHeight}px`;
        elements.callOverlay.style.left = `${pipInitialLeft - (newWidth - pipInitialWidth)}px`;
        elements.callOverlay.style.top = `${pipInitialTop - (newHeight - pipInitialHeight)}px`;
    };

    const onPipResizeEnd = () => {
        isPipResizing = false;
        if (elements.callOverlay) elements.callOverlay.style.transition = '';
        document.removeEventListener('mousemove', onPipResizing);
        document.removeEventListener('touchmove', onPipResizing);
        document.removeEventListener('mouseup', onPipResizeEnd);
        document.removeEventListener('touchend', onPipResizeEnd);
    };

    elements.pipResizeHandle?.addEventListener('mousedown', onPipResizeStart);
    elements.pipResizeHandle?.addEventListener('touchstart', onPipResizeStart, { passive: false });

    elements.minimizedMuteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCallMute();
    });

    elements.minimizedEndBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        endCall();
    });

    // Back button for mobile view
    elements.backBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (activeChatUid) {
            showChatListView();
            if (elements.chatHeaderName) elements.chatHeaderName.textContent = '';
            if (elements.chatHeaderAvatar) elements.chatHeaderAvatar.innerHTML = '';
            activeChatUid = null;
            if (elements.chatArea) elements.chatArea.classList.remove('active-chat-selected');
            if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
            if (elements.chatActions) elements.chatActions.style.display = 'none';
            if (elements.privacyBlockNotice) elements.privacyBlockNotice.style.display = 'none';
            if (elements.chatHeader) elements.chatHeader.style.display = 'none';
            if (elements.messageInput) elements.messageInput.value = '';
            if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
        } else {
            window.history.back();
        }
    });

    elements.closeReplyBtn?.addEventListener('click', hideReplyPreview);
    elements.closeEditBtn?.addEventListener('click', hideEditPreview);

    elements.closeCallDetailsModalBtn?.addEventListener('click', () => {
        if (elements.callDetailsModal) elements.callDetailsModal.style.display = 'none';
    });

    elements.callDetailsModal?.addEventListener('click', (e) => {
        if (e.target === elements.callDetailsModal) elements.callDetailsModal.style.display = 'none';
    });

    elements.closeMessageInfoModalBtn?.addEventListener('click', () => {
        if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
    });

    elements.messageInfoModal?.addEventListener('click', (e) => {
        if (e.target === elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
    });

    elements.messageInfoContent?.addEventListener('click', (e) => {
        const img = e.target.closest('.view-profile-photo');
        if (img) {
            if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
            openLightboxImage(img.src);
            e.stopPropagation();
        }

        // Handle Accept/Decline from within the Profile View
        if (e.target.classList.contains('accept-profile-req')) {
            const uid = e.target.dataset.uid;
            const user = auth.currentUser;
            if (uid && user) {
                acceptFriendRequest(user.uid, uid).then(() => {
                    showToast("Request accepted!", "success");
                    if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
                });
            }
        } else if (e.target.classList.contains('decline-profile-req')) {
            const uid = e.target.dataset.uid;
            const user = auth.currentUser;
            if (uid && user) {
                declineFriendRequest(user.uid, uid).then(() => {
                    showToast("Request declined", "info");
                    if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
                });
            }
        } else if (e.target.closest('.send-profile-request-btn')) {
            const btn = e.target.closest('.send-profile-request-btn');
            const uid = btn.dataset.uid;
            const user = auth.currentUser;
            if (uid && user) {
                btn.disabled = true;
                btn.textContent = 'Sending...';
                sendFriendRequest(user.uid, uid).then(() => {
                    showToast("Request sent!", "success");
                    currentSentRequests[uid] = Date.now();
                    currentOutgoingRequests[uid] = Date.now();
                    updateRequestActionButtonState(uid);
                    refreshChatSidebars();
                    updateCustomerSidebar();
                    if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
                }).catch(() => {
                    btn.disabled = false;
                    btn.textContent = 'Send Request';
                    showToast("Failed to send request", "error");
                });
            }
        } else if (e.target.closest('.cancel-profile-request-btn')) {
            const btn = e.target.closest('.cancel-profile-request-btn');
            const uid = btn.dataset.uid;
            const user = auth.currentUser;
            if (uid && user) {
                btn.disabled = true;
                btn.textContent = 'Canceling...';
                declineFriendRequest(uid, user.uid).then(() => {
                    showToast("Request canceled", "info");
                    delete currentSentRequests[uid];
                    delete currentOutgoingRequests[uid];
                    updateRequestActionButtonState(uid);
                    refreshChatSidebars();
                    updateCustomerSidebar();
                    if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
                }).catch(() => {
                    btn.disabled = false;
                    btn.textContent = 'Cancel Request';
                    showToast("Failed to cancel request", "error");
                });
            }
        } else if (e.target.classList.contains('unfriend-btn')) {
            const uid = e.target.dataset.uid;
            const user = auth.currentUser;
            if (uid && user && confirm("Are you sure you want to remove this user? You will no longer be able to message each other.")) {
                unfriendUser(user.uid, uid).then(() => {
                    showToast("User removed", "info");
                    if (elements.messageInfoModal) elements.messageInfoModal.style.display = 'none';
                    if (activeChatUid === uid) {
                        if (elements.messageInputArea) elements.messageInputArea.style.display = 'none';
                        if (elements.chatActions) elements.chatActions.style.display = 'none';
                    }
                });
            }
        }
    });

    // QR Scanner Implementation for Adding Customers
    let qrScanner = null;

    const stopQrScanner = async () => {
        if (qrScanner) {
            try {
                await qrScanner.stop();
            } catch (err) {
                console.warn("Scanner stop warning:", err);
            }
        }
        if (elements.qrScannerModal) elements.qrScannerModal.style.display = 'none';
    };

    const startQrScanner = async () => {
        if (!elements.qrScannerModal || !elements.qrReader) return;

        elements.qrScannerModal.style.display = 'flex';

        try {
            if (typeof Html5Qrcode === 'undefined') {
                throw new Error("QR scanner library not loaded. Please verify internet connection.");
            }
            if (!qrScanner) {
                qrScanner = new Html5Qrcode("qr-reader");
            }

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
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    // Expected format: "hotmapp_uid:USER_ID" or "hotma_uid:USER_ID"
                    if (decodedText.startsWith('hotmapp_uid:') || decodedText.startsWith('hotma_uid:')) {
                        const cleanText = decodedText.replace('hotma_uid:', 'hotmapp_uid:');
                        const targetUid = cleanText.split(':')[1];
                        const user = auth.currentUser;
                        if (user && targetUid !== user.uid) {
                            await sendFriendRequest(user.uid, targetUid);
                            showToast("Friend request sent via QR!", "success");
                        } else if (targetUid === user.uid) {
                            showToast("You can't add yourself!", "warning");
                        }
                    } else {
                        showToast("Invalid Hotmapp QR code", "warning");
                    }
                    stopQrScanner();
                },
                () => { } // Silent parse errors
            );
        } catch (err) {
            console.error("QR Start Error:", err);
            showToast(err.message || "Failed to access camera for QR", "error");
            elements.qrScannerModal.style.display = 'none';
        }
    };

    elements.scanQrBtn?.addEventListener('click', startQrScanner);
    elements.closeQrScannerBtn?.addEventListener('click', stopQrScanner);
    elements.qrScannerModal?.addEventListener('click', (e) => { if (e.target === elements.qrScannerModal) stopQrScanner(); });

    // Manual UID Entry Logic
    elements.sendManualRequestBtn?.addEventListener('click', async () => {
        const targetUid = elements.manualUidInput?.value.trim();
        const user = auth.currentUser;

        if (!targetUid) {
            showToast("Please enter a User ID", "warning");
            return;
        }

        if (!user) return;

        if (targetUid === user.uid) {
            showToast("You can't add yourself!", "warning");
            return;
        }

        const btn = elements.sendManualRequestBtn;
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin:0;"></span>';

            const userSnap = await get(ref(db, `publicProfiles/${targetUid}`));
            if (!userSnap.exists()) {
                showToast("User ID not found", "error");
                return;
            }

            await sendFriendRequest(user.uid, targetUid);
            showToast("Friend request sent!", "success");
            if (elements.manualUidInput) elements.manualUidInput.value = '';
        } catch (error) {
            console.error("Manual UID Error:", error);
            showToast("Failed to send request", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });

    // Profile QR Generation Logic
    elements.showMyQrBtn?.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user || !elements.myQrContainer) return;

        // Clear previous QR instance/content
        elements.myQrContainer.innerHTML = '';

        // Generate new QR using qrcodejs
        new QRCode(elements.myQrContainer, {
            text: `hotmapp_uid:${user.uid}`,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        if (elements.myQrModal) elements.myQrModal.style.display = 'flex';
    });

    elements.copyMyUidBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            await navigator.clipboard.writeText(user.uid);
            showToast("User ID copied to clipboard!", "success");
        } catch (err) {
            showToast("Failed to copy User ID", "error");
        }
    });

    elements.closeMyQrModalBtn?.addEventListener('click', () => {
        if (elements.myQrModal) elements.myQrModal.style.display = 'none';
    });

    elements.myQrModal?.addEventListener('click', (e) => {
        if (e.target === elements.myQrModal) elements.myQrModal.style.display = 'none';
    });

    // New Group Modal Triggers & Form Handlers
    const populateNewGroupContacts = () => {
        if (!elements.newGroupContactsList || !moduleFriendsList || !allUsersCache) return;

        elements.newGroupContactsList.innerHTML = '';

        const friendIds = Object.keys(moduleFriendsList);
        if (friendIds.length === 0) {
            elements.newGroupContactsList.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 10px;">No contacts found. Add some contacts first!</div>';
            return;
        }

        friendIds.forEach(id => {
            const friend = allUsersCache[id];
            if (!friend) return;

            const avatarUrl = friend.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80';

            const item = document.createElement('label');
            item.className = 'settings-menu-item';
            item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: background 0.2s; background: var(--panel-soft); margin-bottom: 8px;';
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                    <span style="font-weight: 500; color: var(--text);">${friend.fullname || 'User'}</span>
                </div>
                <input type="checkbox" name="group-member" value="${id}" style="width: 18px; height: 18px; accent-color: var(--brand); cursor: pointer;">
            `;

            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    item.style.borderColor = 'var(--brand)';
                    item.style.background = 'rgba(var(--brand-rgb, 9, 132, 227), 0.1)';
                } else {
                    item.style.borderColor = 'var(--border)';
                    item.style.background = 'var(--panel-soft)';
                }
            });

            elements.newGroupContactsList.appendChild(item);
        });
    };

    const openNewGroupModal = () => {
        if (!elements.newGroupModal) return;
        if (elements.newGroupName) elements.newGroupName.value = '';
        populateNewGroupContacts();
        elements.newGroupModal.style.display = 'flex';
    };

    elements.closeNewGroupModalBtn?.addEventListener('click', () => {
        if (elements.newGroupModal) elements.newGroupModal.style.display = 'none';
    });

    elements.newGroupModal?.addEventListener('click', (e) => {
        if (e.target === elements.newGroupModal) elements.newGroupModal.style.display = 'none';
    });

    elements.newGroupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const groupName = elements.newGroupName?.value?.trim();
        if (!groupName) {
            showToast("Please enter a group name", "warning");
            return;
        }

        const checkedCheckboxes = elements.newGroupContactsList.querySelectorAll('input[name="group-member"]:checked');
        const selectedMemberIds = Array.from(checkedCheckboxes).map(cb => cb.value);

        if (selectedMemberIds.length === 0) {
            showToast("Please select at least one contact to join the group", "warning");
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            showToast("Creating group...", "info");
            const groupId = await createGroup(groupName, selectedMemberIds, currentUser.uid);
            showToast("Group created successfully!", "success");

            if (elements.newGroupModal) elements.newGroupModal.style.display = 'none';

            // Click Chats nav to return to main Chat list view
            elements.chatsNav?.click();

            // Select and activate newly created group chat room
            activeChatUid = groupId;
            startMessageListener(groupId);

            // Add active styling & scroll to the new item once loaded
            setTimeout(() => {
                const item = document.querySelector(`.conversation-item[data-uid="${groupId}"]`);
                if (item) {
                    const parentList = item.closest('.conversations-list');
                    parentList?.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 300);

        } catch (error) {
            console.error("Error creating group:", error);
            showToast("Failed to create group", "error");
        }
    });

    // Group Info Modal & Actions Logic
    let selectedMemberIdForAction = null;
    let activeGroupInfoId = null;

    const openGroupInfoModal = async (groupId) => {
        console.log("openGroupInfoModal called with:", groupId);
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.warn("openGroupInfoModal: no authenticated user found");
            return;
        }
        if (!elements.groupInfoModal) {
            console.warn("openGroupInfoModal: elements.groupInfoModal not found in DOM");
            return;
        }

        activeGroupInfoId = groupId;
        try {
            console.log("Fetching snapshot from groups/" + groupId);
            const groupSnapshot = await get(ref(db, `groups/${groupId}`));
            if (!groupSnapshot.exists()) {
                console.warn("Group does not exist in the database:", groupId);
                showToast("Group details not found in database", "error");
                return;
            }
            const groupData = groupSnapshot.val();
            console.log("Loaded groupData:", groupData);

            // Set Group Name
            if (elements.groupInfoName) elements.groupInfoName.textContent = groupData.name || "Group Chat";

            // Determine if current user is admin
            const isCurrentUserAdmin = (groupData.admins && groupData.admins[currentUser.uid]) || (groupData.createdBy === currentUser.uid);
            console.log("Is current user group admin:", isCurrentUserAdmin);

            const editNameBtn = document.getElementById('group-info-edit-name-btn');
            if (editNameBtn) {
                editNameBtn.style.display = isCurrentUserAdmin ? 'inline-block' : 'none';
            }

            // Set Avatar Initials or Profile Image
            if (elements.groupInfoAvatar) {
                if (groupData.profilePhoto) {
                    if (elements.groupInfoAvatarInitials) elements.groupInfoAvatarInitials.style.display = 'none';
                    if (elements.groupInfoAvatarImg) {
                        elements.groupInfoAvatarImg.src = groupData.profilePhoto;
                        elements.groupInfoAvatarImg.style.display = 'block';
                    }
                } else {
                    const initials = (groupData.name || 'G').charAt(0).toUpperCase();
                    if (elements.groupInfoAvatarInitials) {
                        elements.groupInfoAvatarInitials.textContent = initials;
                        elements.groupInfoAvatarInitials.style.display = 'block';
                    }
                    if (elements.groupInfoAvatarImg) elements.groupInfoAvatarImg.style.display = 'none';
                }

                if (isCurrentUserAdmin) {
                    elements.groupInfoAvatar.classList.add('is-admin');
                    if (elements.groupInfoAvatarEditOverlay) elements.groupInfoAvatarEditOverlay.style.display = 'block';
                } else {
                    elements.groupInfoAvatar.classList.remove('is-admin');
                    if (elements.groupInfoAvatarEditOverlay) elements.groupInfoAvatarEditOverlay.style.display = 'none';
                }
                elements.groupInfoAvatar.style.cursor = isCurrentUserAdmin ? 'pointer' : 'default';
            }

            // Set Creator Meta
            if (elements.groupInfoMeta) {
                console.log("Fetching creator profile for:", groupData.createdBy);
                const creatorProfile = allUsersCache[groupData.createdBy] || await getUserProfile(groupData.createdBy);
                const creatorName = creatorProfile ? creatorProfile.fullname : 'Unknown';
                const createdDate = groupData.createdAt ? new Date(groupData.createdAt).toLocaleDateString() : '';
                elements.groupInfoMeta.textContent = `Created by ${creatorName} on ${createdDate}`;
            }

            // Toggle Add Participant Button
            if (elements.groupInfoAddMemberBtn) {
                elements.groupInfoAddMemberBtn.style.display = isCurrentUserAdmin ? 'block' : 'none';
            }

            // Populate Members List
            if (elements.groupInfoMembersList) {
                elements.groupInfoMembersList.innerHTML = '';
                const memberIds = groupData.members ? Object.keys(groupData.members) : [];
                if (elements.groupInfoMembersCount) elements.groupInfoMembersCount.textContent = memberIds.length;

                for (const memberId of memberIds) {
                    console.log("Loading group member profile:", memberId);
                    const profile = allUsersCache[memberId] || await getUserProfile(memberId);
                    if (!profile) continue;

                    const isMemberAdmin = (groupData.admins && groupData.admins[memberId]) || (groupData.createdBy === memberId);
                    const isMe = memberId === currentUser.uid;
                    const nameText = isMe ? `${profile.fullname} (You)` : profile.fullname;

                    const row = document.createElement('div');
                    row.className = 'settings-menu-item';
                    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; background: var(--panel-soft); transition: background 0.2s; cursor: pointer; margin-bottom: 8px;';

                    const avatarUrl = profile.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80';
                    const onlineStatusDot = profile.online ? '<span style="width: 8px; height: 8px; background: #2ecc71; border-radius: 50%; display: inline-block; margin-left: 5px;" title="Online"></span>' : '';

                    row.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 4px;">
                                    ${nameText} ${onlineStatusDot}
                                </span>
                            </div>
                        </div>
                        ${isMemberAdmin ? '<span style="font-size: 0.72rem; color: var(--brand); border: 1px solid var(--brand); border-radius: 4px; padding: 2px 6px; font-weight: 600; text-transform: uppercase;">Group Admin</span>' : ''}
                    `;

                    // All members can click other members to view individual options
                    if (!isMe) {
                        row.addEventListener('click', () => {
                            selectedMemberIdForAction = memberId;
                            if (elements.participantActionsModal) {
                                const title = document.getElementById('participant-actions-title');
                                if (title) title.textContent = profile.fullname;

                                if (elements.actionMakeAdminBtn) {
                                    elements.actionMakeAdminBtn.style.display = isCurrentUserAdmin ? 'block' : 'none';
                                    elements.actionMakeAdminBtn.textContent = isMemberAdmin ? 'Dismiss as Admin' : 'Make Group Admin';
                                }
                                if (elements.actionRemoveMemberBtn) {
                                    elements.actionRemoveMemberBtn.style.display = isCurrentUserAdmin ? 'block' : 'none';
                                }
                                if (elements.actionMessageMemberBtn) {
                                    elements.actionMessageMemberBtn.textContent = `Message ${profile.fullname}`;
                                }
                                elements.participantActionsModal.style.display = 'flex';
                            }
                        });
                    }

                    elements.groupInfoMembersList.appendChild(row);
                }
            }

            console.log("Opening Group Info Modal - setting display to flex");
            elements.groupInfoModal.style.display = 'flex';
        } catch (error) {
            console.error("Error opening group info:", error);
            showToast("Failed to load group details: " + error.message, "error");
        }
    };

    // Header click logic to open profile / group info
    elements.chatHeaderInfo?.addEventListener('click', (e) => {
        if (e.target.closest('.back-btn')) {
            return;
        }

        if (activeChatUid) {
            if (activeChatUid.startsWith('group_')) {
                console.log("Triggering openGroupInfoModal with activeChatUid:", activeChatUid);
                openGroupInfoModal(activeChatUid);
            } else {
                console.log("Triggering getUserProfile and showUserProfileInfo with activeChatUid:", activeChatUid);
                getUserProfile(activeChatUid).then(profile => {
                    if (profile) showUserProfileInfo(activeChatUid, profile, false);
                });
            }
        } else {
            console.warn("No activeChatUid set!");
        }
    });

    // Add Participant Logic
    elements.groupInfoAddMemberBtn?.addEventListener('click', async () => {
        if (!activeGroupInfoId || !elements.addParticipantModal || !elements.addParticipantList) return;

        try {
            const groupSnapshot = await get(ref(db, `groups/${activeGroupInfoId}`));
            if (!groupSnapshot.exists()) return;
            const groupData = groupSnapshot.val();

            elements.addParticipantList.innerHTML = '';

            const friendIds = Object.keys(moduleFriendsList || {});
            const eligibleFriendIds = friendIds.filter(id => !(groupData.members && groupData.members[id]));

            if (eligibleFriendIds.length === 0) {
                elements.addParticipantList.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 15px;">All contacts are already in this group.</div>';
            } else {
                eligibleFriendIds.forEach(id => {
                    const friend = allUsersCache[id];
                    if (!friend) return;

                    const avatarUrl = friend.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80';
                    const item = document.createElement('label');
                    item.className = 'settings-menu-item';
                    item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; cursor: pointer; background: var(--panel-soft); margin-bottom: 8px;';
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <span style="font-weight: 500; color: var(--text);">${friend.fullname || 'User'}</span>
                        </div>
                        <input type="checkbox" name="add-member-opt" value="${id}" style="width: 18px; height: 18px; accent-color: var(--brand); cursor: pointer;">
                    `;

                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            item.style.borderColor = 'var(--brand)';
                            item.style.background = 'rgba(var(--brand-rgb, 9, 132, 227), 0.1)';
                        } else {
                            item.style.borderColor = 'var(--border)';
                            item.style.background = 'var(--panel-soft)';
                        }
                    });

                    elements.addParticipantList.appendChild(item);
                });
            }

            elements.addParticipantModal.style.display = 'flex';
        } catch (error) {
            console.error("Error opening add participant modal:", error);
            showToast("Failed to fetch contacts", "error");
        }
    });

    elements.closeAddParticipantModalBtn?.addEventListener('click', () => {
        if (elements.addParticipantModal) elements.addParticipantModal.style.display = 'none';
    });

    elements.addParticipantModal?.addEventListener('click', (e) => {
        if (e.target === elements.addParticipantModal) elements.addParticipantModal.style.display = 'none';
    });

    elements.addParticipantForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeGroupInfoId) return;

        const checked = elements.addParticipantList.querySelectorAll('input[name="add-member-opt"]:checked');
        const selectedIds = Array.from(checked).map(cb => cb.value);

        if (selectedIds.length === 0) {
            showToast("Please select at least one contact", "warning");
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            showToast("Adding participants...", "info");
            await addGroupMembers(activeGroupInfoId, selectedIds, currentUser.uid);
            showToast("Participants added successfully!", "success");

            if (elements.addParticipantModal) elements.addParticipantModal.style.display = 'none';
            openGroupInfoModal(activeGroupInfoId);
        } catch (err) {
            console.error("Error adding members:", err);
            showToast("Failed to add participants", "error");
        }
    });

    // Participant Actions Modal Handlers
    elements.closeParticipantActionsModalBtn?.addEventListener('click', () => {
        if (elements.participantActionsModal) elements.participantActionsModal.style.display = 'none';
    });

    elements.participantActionsModal?.addEventListener('click', (e) => {
        if (e.target === elements.participantActionsModal) elements.participantActionsModal.style.display = 'none';
    });

    elements.actionMakeAdminBtn?.addEventListener('click', async () => {
        if (!activeGroupInfoId || !selectedMemberIdForAction) return;

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            const groupSnapshot = await get(ref(db, `groups/${activeGroupInfoId}`));
            if (!groupSnapshot.exists()) return;
            const groupData = groupSnapshot.val();

            const isTargetAdmin = groupData.admins && groupData.admins[selectedMemberIdForAction];

            if (isTargetAdmin) {
                await demoteFromAdmin(activeGroupInfoId, selectedMemberIdForAction, currentUser.uid);
                showToast("Admin status removed", "success");
            } else {
                await promoteToAdmin(activeGroupInfoId, selectedMemberIdForAction, currentUser.uid);
                showToast("Promoted to admin successfully!", "success");
            }

            if (elements.participantActionsModal) elements.participantActionsModal.style.display = 'none';
            openGroupInfoModal(activeGroupInfoId);
        } catch (err) {
            console.error("Error toggling admin status:", err);
            showToast("Action failed", "error");
        }
    });

    elements.actionRemoveMemberBtn?.addEventListener('click', async () => {
        if (!activeGroupInfoId || !selectedMemberIdForAction) return;

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        if (!confirm("Are you sure you want to remove this participant from the group?")) return;

        try {
            await removeGroupMember(activeGroupInfoId, selectedMemberIdForAction, currentUser.uid);
            showToast("Participant removed from group", "success");

            if (elements.participantActionsModal) elements.participantActionsModal.style.display = 'none';
            openGroupInfoModal(activeGroupInfoId);
        } catch (err) {
            console.error("Error removing member:", err);
            showToast("Failed to remove participant", "error");
        }
    });

    elements.actionMessageMemberBtn?.addEventListener('click', () => {
        if (!selectedMemberIdForAction) return;

        const targetUid = selectedMemberIdForAction;

        if (elements.participantActionsModal) elements.participantActionsModal.style.display = 'none';
        if (elements.groupInfoModal) elements.groupInfoModal.style.display = 'none';

        elements.chatsNav?.click();

        const contactItem = document.querySelector(`.conversation-item[data-uid="${targetUid}"]`);
        if (contactItem) {
            contactItem.click();
        } else {
            const currentUser = auth.currentUser;
            if (currentUser) {
                addToChatList(currentUser.uid, targetUid).then(() => {
                    setTimeout(() => {
                        const newContactItem = document.querySelector(`.conversation-item[data-uid="${targetUid}"]`);
                        if (newContactItem) newContactItem.click();
                    }, 300);
                });
            }
        }
    });

    // Copy Invite Link Handler
    elements.groupInfoInviteBtn?.addEventListener('click', async () => {
        if (!activeGroupInfoId) return;

        let baseDomain = window.location.origin;
        // On Android/Capacitor native platforms, the origin is localhost.
        // We override it with the public web domain so shared links are valid for other users.
        if (baseDomain.includes('localhost') || baseDomain.includes('capacitor://')) {
            baseDomain = 'https://www.hotmapp.shop';
        }
        const inviteLink = `${baseDomain}${window.location.pathname}?invite=${activeGroupInfoId}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Join our group on Hotmapp`,
                    text: `Use this link to join my group chat on Hotmapp:`,
                    url: inviteLink
                });
            } else {
                await navigator.clipboard.writeText(inviteLink);
                showToast("Group invite link copied to clipboard!", "success");
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(inviteLink);
                    showToast("Group invite link copied to clipboard!", "success");
                } catch (clipErr) {
                    console.error("Failed to copy invite link:", clipErr);
                    showToast("Failed to copy invite link.", "error");
                }
            }
        }
    });

    // Exit Group Handler
    elements.groupInfoExitBtn?.addEventListener('click', async () => {
        if (!activeGroupInfoId) return;

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        if (!confirm("Are you sure you want to exit this group?")) return;

        try {
            await exitGroup(activeGroupInfoId, currentUser.uid);
            showToast("You left the group", "success");

            if (elements.groupInfoModal) elements.groupInfoModal.style.display = 'none';

            elements.chatsNav?.click();

            activeChatUid = null;
            if (elements.chatArea) elements.chatArea.style.display = 'none';
        } catch (err) {
            console.error("Error exiting group:", err);
            showToast("Failed to exit group", "error");
        }
    });

    // Close listeners
    elements.closeGroupInfoModalBtn?.addEventListener('click', () => {
        if (elements.groupInfoModal) elements.groupInfoModal.style.display = 'none';
    });

    elements.groupInfoModal?.addEventListener('click', (e) => {
        if (e.target === elements.groupInfoModal) elements.groupInfoModal.style.display = 'none';
    });

    // Group Photo Edit Event Listeners
    elements.groupInfoAvatar?.addEventListener('click', () => {
        const currentUser = auth.currentUser;
        if (!activeGroupInfoId || !currentUser) return;

        get(ref(db, `groups/${activeGroupInfoId}`)).then((snapshot) => {
            if (!snapshot.exists()) return;
            const groupData = snapshot.val();
            const isCurrentUserAdmin = (groupData.admins && groupData.admins[currentUser.uid]) || (groupData.createdBy === currentUser.uid);
            if (isCurrentUserAdmin && elements.groupInfoPhotoInput) {
                elements.groupInfoPhotoInput.click();
            }
        });
    });

    elements.groupInfoPhotoInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !activeGroupInfoId) return;

        const img = document.getElementById('cropper-image');
        if (!img) {
            console.error('Cropper image element not found');
            e.target.value = '';
            return;
        }

        const url = URL.createObjectURL(file);
        img.src = url;

        const modal = document.querySelector('[data-ui="image-cropper-modal"]');
        if (modal) {
            modal.dataset.skipPush = 'true';
            modal.style.display = 'flex';
            modal.style.zIndex = '12000'; // ensure it appears above group info modal
        }

        let cropper = new Cropper(img, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
        });

        const cleanup = () => {
            if (cropper) cropper.destroy();
            URL.revokeObjectURL(url);
            if (modal) modal.style.display = 'none';
            e.target.value = '';
        };

        const confirmBtn = document.querySelector('[data-ui="cropper-confirm"]');
        const cancelBtn = document.querySelector('[data-ui="cropper-cancel"]');

        const controller = new AbortController();
        const { signal } = controller;

        confirmBtn?.addEventListener('click', async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                cleanup();
                controller.abort();
                return;
            }

            try {
                showToast("Uploading group photo...", "info");
                const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));

                const photoUrl = await uploadFile(`group_avatars/${activeGroupInfoId}`, blob);
                await updateGroupProfilePhoto(activeGroupInfoId, photoUrl, currentUser.uid);

                showToast("Group photo updated successfully!", "success");
                openGroupInfoModal(activeGroupInfoId);
            } catch (err) {
                console.error("Error updating group photo:", err);
                showToast("Failed to upload group photo", "error");
            }
            cleanup();
            controller.abort();
        }, { signal });

        cancelBtn?.addEventListener('click', () => {
            cleanup();
            controller.abort();
        }, { signal });
    });

    document.getElementById('group-info-edit-name-btn')?.addEventListener('click', async () => {
        const currentUser = auth.currentUser;
        if (!activeGroupInfoId || !currentUser) return;

        try {
            const groupSnapshot = await get(ref(db, `groups/${activeGroupInfoId}`));
            if (!groupSnapshot.exists()) return;
            const groupData = groupSnapshot.val();

            const isCurrentUserAdmin = (groupData.admins && groupData.admins[currentUser.uid]) || (groupData.createdBy === currentUser.uid);
            if (!isCurrentUserAdmin) {
                showToast("Only admins can change the group name", "warning");
                return;
            }

            const newName = prompt("Enter new group name:", groupData.name || "");
            if (newName === null) return; // User cancelled prompt

            const trimmedName = newName.trim();
            if (trimmedName === "") {
                showToast("Group name cannot be empty", "warning");
                return;
            }

            if (trimmedName === groupData.name) return;

            showToast("Updating group name...", "info");
            await updateGroupName(activeGroupInfoId, trimmedName, currentUser.uid);
            showToast("Group name updated successfully!", "success");
            openGroupInfoModal(activeGroupInfoId);
        } catch (err) {
            console.error("Error updating group name:", err);
            showToast("Failed to update group name", "error");
        }
    });

    // Ephemeral Picker Modal Close
    elements.closeEphemeralPickerModalBtn?.addEventListener('click', () => {
        if (elements.ephemeralPickerModal) elements.ephemeralPickerModal.style.display = 'none';
    });

    // Request to Message Button Logic
    elements.requestToMessageBtn?.addEventListener('click', async () => {
        const uid = elements.requestToMessageBtn.dataset.uid;
        const user = auth.currentUser;
        if (!uid || !user) return;

        const btn = elements.requestToMessageBtn;
        const originalText = btn.textContent;

        try {
            // Handle unblock via the block notice button
            if (!!blockedUsers[uid]) {
                if (confirm("Unblock this contact?")) {
                    await toggleBlockUser(user.uid, uid, false);
                    showToast("User unblocked", "success");
                }
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="border-top-color:white; width:12px; height:12px; margin:0;"></span> Sending...';
            await sendFriendRequest(user.uid, uid);
            showToast("Chat request sent!", "success");
            currentOutgoingRequests[uid] = Date.now();
            updateRequestActionButtonState(uid);
        } catch (error) {
            showToast("Failed to send request", "error");
            btn.disabled = false;
            btn.textContent = originalText;
            btn.style.opacity = '1';
        }
    });

    // Settings Modal Handlers
    elements.closeSettingsModalBtn?.addEventListener('click', () => {
        if (elements.settingsModal) elements.settingsModal.style.display = 'none';
    });

    elements.settingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) elements.settingsModal.style.display = 'none';
    });

    elements.settingsChatBtn?.addEventListener('click', () => {
        if (elements.settingsModal) elements.settingsModal.style.display = 'none';
        if (elements.chatSettingsModal) elements.chatSettingsModal.style.display = 'flex';
    });

    // Privacy Settings Modal Handlers
    document.querySelector('[data-ui="settings-privacy-btn"]')?.addEventListener('click', async () => {
        if (elements.settingsModal) elements.settingsModal.style.display = 'none';
        if (elements.privacyModal) {
            elements.privacyModal.style.display = 'flex';
            // Load current privacy settings
            try {
                const user = auth.currentUser;
                if (user) {
                    const dbRef = ref(db);
                    const snapshot = await get(child(dbRef, `users/${user.uid}`));
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        if (elements.privacyWhoCanMessageInput && data.whoCanMessage) {
                            elements.privacyWhoCanMessageInput.value = data.whoCanMessage;
                        }
                        if (elements.privacyWhoCanViewShopInput && data.whoCanViewShop) {
                            elements.privacyWhoCanViewShopInput.value = data.whoCanViewShop;
                        }
                        if (elements.privacyProfilePhotoInput && data.profilePhotoPrivacy) {
                            elements.privacyProfilePhotoInput.value = data.profilePhotoPrivacy;
                        }
                        if (elements.privacyAboutInput && data.aboutPrivacy) {
                            elements.privacyAboutInput.value = data.aboutPrivacy;
                        }
                        if (elements.privacyLastSeenInput && data.lastSeenPrivacy) {
                            elements.privacyLastSeenInput.value = data.lastSeenPrivacy;
                        }
                        if (elements.privacyOnlineInput && data.onlinePrivacy) {
                            elements.privacyOnlineInput.value = data.onlinePrivacy;
                        }
                        if (elements.privacyProfilePhotoInput && data.excludedContacts) {
                            excludedContacts = data.excludedContacts;
                        }
                        if (elements.privacyReadReceiptsInput) {
                            elements.privacyReadReceiptsInput.checked = data.readReceipts !== false;
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading privacy settings:', error);
            }
        }
    });

    elements.closePrivacyModalBtn?.addEventListener('click', () => {
        if (elements.privacyModal) elements.privacyModal.style.display = 'none';
        // Open settings modal again
        if (elements.settingsModal) elements.settingsModal.style.display = 'flex';
    });

    elements.privacyForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const user = auth.currentUser;
            if (user && elements.privacyWhoCanMessageInput) {
                const whoCanMessage = elements.privacyWhoCanMessageInput.value;
                const lastSeenPrivacy = elements.privacyLastSeenInput?.value || 'anyone';
                const onlinePrivacy = elements.privacyOnlineInput?.value || 'anyone';
                const excludedContactsArray = Object.keys(excludedContacts); // Get current excluded contacts
                const profilePhotoPrivacy = elements.privacyProfilePhotoInput?.value || 'anyone';
                const whoCanViewShop = elements.privacyWhoCanViewShopInput?.value || 'anyone'; // Get whoCanViewShop value
                const aboutPrivacy = elements.privacyAboutInput?.value || 'anyone';
                const readReceipts = !!elements.privacyReadReceiptsInput?.checked;
                await updateUserProfile(user.uid, {
                    whoCanMessage,
                    whoCanViewShop,
                    excludedContacts: excludedContactsArray.length > 0 ? excludedContacts : null, // Save as object or null
                    lastSeenPrivacy,
                    onlinePrivacy,
                    profilePhotoPrivacy,
                    aboutPrivacy,
                    readReceipts
                });
                showToast('Privacy settings updated successfully', 'success');
                if (elements.privacyModal) elements.privacyModal.style.display = 'none';
                if (elements.settingsModal) elements.settingsModal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error saving privacy settings:', error);
            showToast('Failed to save privacy settings', 'error');
        }
    });

    // Blocked Users Modal Logic
    const renderBlockedUsersList = (searchTerm = '') => {
        const user = auth.currentUser;
        if (!user || !elements.blockedUsersList) return;

        elements.blockedUsersList.innerHTML = '';
        const term = searchTerm.toLowerCase().trim();

        const blockedUserIds = Object.keys(blockedUsers);
        if (elements.blockedUsersCountLabel) elements.blockedUsersCountLabel.textContent = blockedUserIds.length;

        if (blockedUserIds.length === 0) {
            elements.blockedUsersList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">No users blocked.</div>';
            if (elements.unblockAllBtn) elements.unblockAllBtn.style.display = 'none';
            return;
        }
        if (elements.unblockAllBtn) elements.unblockAllBtn.style.display = 'block';

        const filteredBlockedUsers = blockedUserIds.filter(uid => {
            const profile = allUsersCache[uid];
            if (!profile) return false;
            const name = (profile.fullname || '').toLowerCase();
            const email = (profile.email || '').toLowerCase();
            const phone = (profile.phoneNumber || '').toLowerCase();
            return name.includes(term) || email.includes(term) || phone.includes(term) || uid.toLowerCase().includes(term);
        });

        if (filteredBlockedUsers.length === 0) {
            elements.blockedUsersList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--muted);">No blocked users found for "${searchTerm}".</div>`;
            return;
        }

        filteredBlockedUsers.forEach(uid => {
            const profile = allUsersCache[uid];
            const name = profile?.fullname || 'Unknown User';
            const avatarHtml = profile?.profilePhoto ? `<img src="${profile.profilePhoto}" class="avatar-img">` : (name.charAt(0).toUpperCase());
            const blockReason = blockedUsers[uid]?.reason || 'Other';

            const html = `
                <div class="conversation-item" data-uid="${uid}">
                    <div class="conversation-avatar">${avatarHtml}</div>
                    <div class="conversation-info">
                        <div class="conversation-name">${name}</div>
                        <div class="conversation-preview" style="font-size: 0.8rem; color: var(--muted);">Blocked: ${blockReason}</div>
                    </div>
                    <button class="customer-toggle-btn unblock-btn" data-uid="${uid}" style="background:var(--brand);color:white;">Unblock</button>
                </div>
            `;
            elements.blockedUsersList.insertAdjacentHTML('beforeend', html);
        });
    };

    elements.manageBlockedUsersBtn?.addEventListener('click', () => {
        if (elements.privacyModal) elements.privacyModal.style.display = 'none';
        if (elements.blockedUsersModal) {
            elements.blockedUsersModal.style.display = 'flex';
            renderBlockedUsersList();
        }
    });

    elements.closeBlockedUsersModalBtn?.addEventListener('click', () => {
        if (elements.blockedUsersModal) elements.blockedUsersModal.style.display = 'none';
        if (elements.privacyModal) elements.privacyModal.style.display = 'flex';
    });

    elements.blockedUsersList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.unblock-btn');
        if (!btn) return;
        const uid = btn.dataset.uid;
        const user = auth.currentUser;
        if (user && uid && confirm(`Are you sure you want to unblock ${allUsersCache[uid]?.fullname || 'this user'}?`)) {
            await toggleBlockUser(user.uid, uid, false);
            showToast("User unblocked", "success");
            renderBlockedUsersList(elements.blockedUsersSearch?.value || '');
        }
    });

    elements.unblockAllBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (user && confirm("Are you sure you want to unblock ALL users?")) {
            await unblockAllUsers(user.uid);
            showToast("All users unblocked", "success");
            renderBlockedUsersList();
        }
    });

    elements.blockedUsersSearch?.addEventListener('input', debounce((e) => {
        renderBlockedUsersList(e.target.value);
        if (elements.clearBlockedSearchBtn) elements.clearBlockedSearchBtn.style.display = e.target.value ? 'block' : 'none';
    }, 300));

    elements.clearBlockedSearchBtn?.addEventListener('click', () => {
        if (elements.blockedUsersSearch) elements.blockedUsersSearch.value = '';
        if (elements.clearBlockedSearchBtn) elements.clearBlockedSearchBtn.style.display = 'none';
        renderBlockedUsersList();
    });

    elements.closeBlockReasonModalBtn?.addEventListener('click', () => {
        if (elements.blockReasonModal) elements.blockReasonModal.style.display = 'none';
    });

    elements.cancelBlockReasonBtn?.addEventListener('click', () => {
        if (elements.blockReasonModal) elements.blockReasonModal.style.display = 'none';
    });

    elements.blockReasonModal?.addEventListener('click', (e) => {
        if (e.target === elements.blockReasonModal) elements.blockReasonModal.style.display = 'none';
    });

    elements.confirmBlockBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !activeChatUid) return;

        const btn = elements.confirmBlockBtn;
        const originalContent = btn.innerHTML;
        const reasonEl = elements.blockReasonOptions?.querySelector('input[name="block-reason"]:checked');
        const reason = reasonEl ? reasonEl.value : 'other';

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin:0;"></span> Blocking...';

            await toggleBlockUser(user.uid, activeChatUid, true, reason);
            showToast("User blocked", "info");

            if (elements.blockReasonModal) elements.blockReasonModal.style.display = 'none';

            // Keep the blocked contact in the conversation list and only block messaging.
            // This preserves the existing chat entry instead of forcing a UI navigation away.
            refreshChatSidebars();
            updateCustomerSidebar();
        } catch (error) {
            showToast("Failed to block user", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });

    // Initial setup for "Manage Excluded Contacts" buttons when privacy modal opens
    elements.settingsPrivacyBtn?.addEventListener('click', () => {
        // Ensure the dropdowns are populated first, then check their values
        setTimeout(() => {
            toggleManageExcludedButton(elements.privacyProfilePhotoInput, elements.privacyProfilePhotoManageExcludedBtn, elements.privacyProfilePhotoExcludedCountLabel);
            toggleManageExcludedButton(elements.privacyAboutInput, elements.privacyAboutManageExcludedBtn, elements.privacyAboutExcludedCountLabel);
            toggleManageExcludedButton(elements.privacyLastSeenInput, elements.privacyLastSeenManageExcludedBtn, elements.privacyLastSeenExcludedCountLabel);
            toggleManageExcludedButton(elements.privacyOnlineInput, elements.privacyOnlineManageExcludedBtn, elements.privacyOnlineExcludedCountLabel);
            toggleManageExcludedButton(elements.privacyWhoCanViewShopInput, elements.privacyWhoCanViewShopManageExcludedBtn, elements.privacyWhoCanViewShopExcludedCountLabel); // ADDED
        }, 0); // Use setTimeout to ensure dropdowns are rendered and populated
    });

    // Helper function to toggle visibility of "Manage Excluded Contacts" button and update its count
    const toggleManageExcludedButton = (selectElement, manageButton, countLabel) => {
        if (selectElement && manageButton) {
            if (selectElement.value === 'excluded') {
                manageButton.style.display = 'flex';
                if (countLabel) countLabel.textContent = `${Object.keys(excludedContacts).length} / ${Object.keys(moduleFriendsList).length}`;
            } else {
                manageButton.style.display = 'none';
            }
        }
    };

    // Add change listeners to privacy dropdowns to show/hide the "Manage Excluded Contacts" button
    elements.privacyProfilePhotoInput?.addEventListener('change', (e) => toggleManageExcludedButton(e.target, elements.privacyProfilePhotoManageExcludedBtn, elements.privacyProfilePhotoExcludedCountLabel));
    elements.privacyAboutInput?.addEventListener('change', (e) => toggleManageExcludedButton(e.target, elements.privacyAboutManageExcludedBtn, elements.privacyAboutExcludedCountLabel));
    elements.privacyLastSeenInput?.addEventListener('change', (e) => toggleManageExcludedButton(e.target, elements.privacyLastSeenManageExcludedBtn, elements.privacyLastSeenExcludedCountLabel));
    elements.privacyOnlineInput?.addEventListener('change', (e) => toggleManageExcludedButton(e.target, elements.privacyOnlineManageExcludedBtn, elements.privacyOnlineExcludedCountLabel));
    elements.privacyWhoCanViewShopInput?.addEventListener('change', (e) => toggleManageExcludedButton(e.target, elements.privacyWhoCanViewShopManageExcludedBtn, elements.privacyWhoCanViewShopExcludedCountLabel)); // ADDED

    // Add click listeners to the new "Manage Excluded Contacts" buttons
    elements.privacyProfilePhotoManageExcludedBtn?.addEventListener('click', () => { elements.privacyModal.style.display = 'none'; elements.excludedContactsModal.style.display = 'flex'; renderExcludedContactsList(); });
    elements.privacyAboutManageExcludedBtn?.addEventListener('click', () => { elements.privacyModal.style.display = 'none'; elements.excludedContactsModal.style.display = 'flex'; renderExcludedContactsList(); });
    elements.privacyLastSeenManageExcludedBtn?.addEventListener('click', () => { elements.privacyModal.style.display = 'none'; elements.excludedContactsModal.style.display = 'flex'; renderExcludedContactsList(); });
    elements.privacyOnlineManageExcludedBtn?.addEventListener('click', () => { elements.privacyModal.style.display = 'none'; elements.excludedContactsModal.style.display = 'flex'; renderExcludedContactsList(); });
    elements.privacyWhoCanViewShopManageExcludedBtn?.addEventListener('click', () => { elements.privacyModal.style.display = 'none'; elements.excludedContactsModal.style.display = 'flex'; renderExcludedContactsList(); });

    elements.closeExcludedContactsModalBtn?.addEventListener('click', () => {
        if (elements.excludedContactsModal) elements.excludedContactsModal.style.display = 'none';
        if (elements.privacyModal) elements.privacyModal.style.display = 'flex';
    });

    elements.excludedContactsList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.toggle-exclude-btn');
        if (!btn) return;
        const uid = btn.dataset.uid;
        const isExcluded = !!excludedContacts[uid];
        if (isExcluded) delete excludedContacts[uid];
        else excludedContacts[uid] = true;
        renderExcludedContactsList(elements.excludedContactsSearch?.value || '');
    });

    elements.excludedContactsSelectAll?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const searchTerm = elements.excludedContactsSearch?.value || '';
        const term = searchTerm.toLowerCase().trim();
        const allFriends = Object.keys(moduleFriendsList);

        const filteredFriends = allFriends.filter(uid => {
            const profile = allUsersCache[uid];
            if (!profile) return false;
            const name = (profile.fullname || '').toLowerCase();
            const email = (profile.email || '').toLowerCase();
            const phone = (profile.phoneNumber || '').toLowerCase();
            return name.includes(term) || email.includes(term) || phone.includes(term) || uid.toLowerCase().includes(term);
        });

        filteredFriends.forEach(uid => { if (isChecked) excludedContacts[uid] = true; else delete excludedContacts[uid]; });
        renderExcludedContactsList(searchTerm);
    });

    elements.saveExcludedContactsBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateUserProfile(user.uid, { excludedContacts: excludedContacts });
            showToast("Excluded contacts saved!", "success");
            if (elements.excludedContactsModal) elements.excludedContactsModal.style.display = 'none';
            if (elements.privacyModal) elements.privacyModal.style.display = 'flex';
        } catch (error) {
            showToast("Failed to save excluded contacts", "error");
        }
    });

    elements.excludedContactsSearch?.addEventListener('input', debounce((e) => {
        renderExcludedContactsList(e.target.value);
        if (elements.clearExcludedSearchBtn) elements.clearExcludedSearchBtn.style.display = e.target.value ? 'block' : 'none';
    }, 300));

    elements.clearExcludedSearchBtn?.addEventListener('click', () => {
        if (elements.excludedContactsSearch) elements.excludedContactsSearch.value = '';
        if (elements.clearExcludedSearchBtn) elements.clearExcludedSearchBtn.style.display = 'none';
        renderExcludedContactsList();
    });

    elements.manageExcludedUsersBtn?.addEventListener('click', () => {
        if (elements.privacyModal) elements.privacyModal.style.display = 'none';
        if (elements.excludedContactsModal) {
            elements.excludedContactsModal.style.display = 'flex';
            renderExcludedContactsList();
        }
    });

    // Auto-open excluded contacts list when "My Contacts Except..." is selected in any privacy dropdown
    [
        elements.privacyProfilePhotoInput,
        elements.privacyAboutInput,
        elements.privacyLastSeenInput,
        elements.privacyOnlineInput
    ].forEach(select => {
        select?.addEventListener('change', (e) => {
            if (e.target.value === 'excluded') {
                elements.manageExcludedUsersBtn?.click();
            }
        });
    });

    // Excluded Contacts Modal Logic (The original, correct one)
    const renderExcludedContactsList = (searchTerm = '') => {
        const user = auth.currentUser;
        if (!user || !elements.excludedContactsList) return;

        elements.excludedContactsList.innerHTML = '';
        const term = searchTerm.toLowerCase().trim();

        const allFriends = Object.keys(moduleFriendsList);
        const excludedFriendIds = Object.keys(excludedContacts);

        // Update count labels on all relevant buttons
        [elements.privacyProfilePhotoExcludedCountLabel, elements.privacyAboutExcludedCountLabel, elements.privacyLastSeenExcludedCountLabel, elements.privacyOnlineExcludedCountLabel, elements.privacyWhoCanViewShopExcludedCountLabel]
            .forEach(label => { if (label) label.textContent = `${excludedFriendIds.length} / ${allFriends.length}`; });

        if (allFriends.length === 0) {
            elements.excludedContactsList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">You have no friends to exclude.</div>';
            return;
        }

        const filteredFriends = allFriends.filter(uid => {
            const profile = allUsersCache[uid];
            if (!profile) return false;
            const name = (profile.fullname || '').toLowerCase();
            const email = (profile.email || '').toLowerCase();
            const phone = (profile.phoneNumber || '').toLowerCase();
            return name.includes(term) || email.includes(term) || phone.includes(term) || uid.toLowerCase().includes(term);
        });

        // Update Select All checkbox state
        if (elements.excludedContactsSelectAll) {
            const allFilteredExcluded = filteredFriends.length > 0 && filteredFriends.every(uid => !!excludedContacts[uid]);
            elements.excludedContactsSelectAll.checked = allFilteredExcluded;
        }

        if (filteredFriends.length === 0) {
            elements.excludedContactsList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--muted);">No friends found for "${searchTerm}".</div>`;
            return;
        }

        filteredFriends.forEach(uid => {
            const profile = allUsersCache[uid];
            const name = profile?.fullname || 'Unknown User';
            const avatarHtml = profile?.profilePhoto ? `<img src="${profile.profilePhoto}" class="avatar-img">` : (name.charAt(0).toUpperCase());
            const isExcluded = !!excludedContacts[uid];

            const html = `
                <div class="conversation-item" data-uid="${uid}">
                    <div class="conversation-avatar">${avatarHtml}</div>
                    <div class="conversation-info">
                        <div class="conversation-name">${name}</div>
                        <div class="conversation-preview" style="font-size: 0.8rem; color: var(--muted);"></div>
                    </div>
                    <button class="customer-toggle-btn toggle-exclude-btn" data-uid="${uid}" style="background:${isExcluded ? '#ff4d4d' : 'var(--brand)'};color:white;">${isExcluded ? 'Excluded' : 'Exclude'}</button>
                </div>
            `;
            elements.excludedContactsList.insertAdjacentHTML('beforeend', html);
        });
    };

    elements.closeExcludedContactsModalBtn?.addEventListener('click', () => {
        if (elements.excludedContactsModal) elements.excludedContactsModal.style.display = 'none';
        if (elements.privacyModal) elements.privacyModal.style.display = 'flex';
    });

    initVoiceRecording();
    initCamera();
    initLocation();

    const closePdfViewer = () => {
        if (elements.pdfViewerModal) elements.pdfViewerModal.style.display = 'none';
        if (elements.pdfViewerIframe) elements.pdfViewerIframe.src = '';
        if (elements.pdfViewerScrollContainer) elements.pdfViewerScrollContainer.innerHTML = '';
        currentPdfZoom = 100;
        currentPdfPanX = 0;
        currentPdfPanY = 0;
        updatePdfZoomUI();
        if (activePdfBlobUrl) {
            URL.revokeObjectURL(activePdfBlobUrl);
            activePdfBlobUrl = null;
        }
    };

    elements.closePdfViewerBtn?.addEventListener('click', closePdfViewer);

    const handleZoomIn = () => {
        if (currentPdfZoom < 300) {
            currentPdfZoom += 25;
            updatePdfZoomUI(true);
        }
    };

    const handleZoomOut = () => {
        if (currentPdfZoom > 50) {
            currentPdfZoom -= 25;
            updatePdfZoomUI(true);
        }
    };

    elements.pdfViewerZoomInBtn?.addEventListener('click', handleZoomIn);
    elements.pdfViewerZoomOutBtn?.addEventListener('click', handleZoomOut);

    if (elements.pdfViewerScrollContainer) {
        let isDraggingPdf = false;
        let startPdfDragX = 0;
        let startPdfDragY = 0;

        let pdfPinchStartDist = 0;
        let pdfPinchBaseZoom = 100;
        let pdfPinchMidX = 0;
        let pdfPinchMidY = 0;

        const togglePdfZoom = (clientX, clientY) => {
            if (currentPdfZoom > 100) {
                currentPdfZoom = 100;
                currentPdfPanX = 0;
                currentPdfPanY = 0;
                updatePdfZoomUI(true);
            } else {
                currentPdfZoom = 200;
                const viewCenterX = window.innerWidth / 2;
                const viewCenterY = window.innerHeight / 2;
                currentPdfPanX = (viewCenterX - clientX) / 2;
                currentPdfPanY = (viewCenterY - clientY) / 2;
                updatePdfZoomUI(true);
            }
        };

        // Double-click to toggle zoom
        elements.pdfViewerScrollContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            togglePdfZoom(e.clientX, e.clientY);
        });

        // Touch event handling for pinch-to-zoom and pan
        elements.pdfViewerScrollContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const now = Date.now();
                if (now - lastPdfTapTime < 300) {
                    e.preventDefault();
                    togglePdfZoom(e.touches[0].clientX, e.touches[0].clientY);
                    lastPdfTapTime = 0;
                    return;
                }
                lastPdfTapTime = now;

                if (currentPdfZoom > 100) {
                    isDraggingPdf = true;
                    startPdfDragX = e.touches[0].clientX - currentPdfPanX * (currentPdfZoom / 100);
                    startPdfDragY = e.touches[0].clientY - currentPdfPanY * (currentPdfZoom / 100);
                }
            } else if (e.touches.length === 2) {
                isDraggingPdf = false;
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                pdfPinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                pdfPinchBaseZoom = currentPdfZoom;
                pdfPinchMidX = (t1.clientX + t2.clientX) / 2;
                pdfPinchMidY = (t1.clientY + t2.clientY) / 2;
            }
        });

        elements.pdfViewerScrollContainer.addEventListener('touchmove', (e) => {
            const scale = currentPdfZoom / 100;
            if (isDraggingPdf && e.touches.length === 1 && currentPdfZoom > 100) {
                e.preventDefault();
                currentPdfPanX = (e.touches[0].clientX - startPdfDragX) / scale;
                currentPdfPanY = (e.touches[0].clientY - startPdfDragY) / scale;
                updatePdfZoomUI(false);
            } else if (e.touches.length === 2 && pdfPinchStartDist > 0) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const factor = dist / pdfPinchStartDist;

                let targetZoom = Math.round((pdfPinchBaseZoom * factor) / 5) * 5;
                targetZoom = Math.max(50, Math.min(300, targetZoom));

                if (targetZoom !== currentPdfZoom) {
                    currentPdfZoom = targetZoom;
                    const viewCenterX = window.innerWidth / 2;
                    const viewCenterY = window.innerHeight / 2;
                    currentPdfPanX = (viewCenterX - pdfPinchMidX) * (1 - 100 / currentPdfZoom);
                    currentPdfPanY = (viewCenterY - pdfPinchMidY) * (1 - 100 / currentPdfZoom);
                    updatePdfZoomUI(false);
                }
            }
        }, { passive: false });

        elements.pdfViewerScrollContainer.addEventListener('touchend', (e) => {
            isDraggingPdf = false;
            if (e.touches.length < 2) {
                pdfPinchStartDist = 0;
            }
        });

        // Mouse dragging / panning when zoomed in
        elements.pdfViewerScrollContainer.addEventListener('mousedown', (e) => {
            if (currentPdfZoom > 100 && e.button === 0) {
                e.preventDefault();
                isDraggingPdf = true;
                const pdfZoomEl = elements.pdfViewerScrollContainer.querySelector('.pdf-zoom-container');
                if (pdfZoomEl) pdfZoomEl.style.cursor = 'grabbing';
                const scale = currentPdfZoom / 100;
                startPdfDragX = e.clientX - currentPdfPanX * scale;
                startPdfDragY = e.clientY - currentPdfPanY * scale;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingPdf && currentPdfZoom > 100) {
                e.preventDefault();
                const scale = currentPdfZoom / 100;
                currentPdfPanX = (e.clientX - startPdfDragX) / scale;
                currentPdfPanY = (e.clientY - startPdfDragY) / scale;
                updatePdfZoomUI(false);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingPdf) {
                isDraggingPdf = false;
                const pdfZoomEl = elements.pdfViewerScrollContainer.querySelector('.pdf-zoom-container');
                if (pdfZoomEl) {
                    pdfZoomEl.style.cursor = currentPdfZoom > 100 ? 'grab' : 'default';
                }
            }
        });

        // Ctrl + Mouse Wheel Zoom
        elements.pdfViewerScrollContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 15 : -15;
                let targetZoom = currentPdfZoom + zoomFactor;
                targetZoom = Math.max(50, Math.min(300, targetZoom));
                if (targetZoom !== currentPdfZoom) {
                    currentPdfZoom = targetZoom;
                    const viewCenterX = window.innerWidth / 2;
                    const viewCenterY = window.innerHeight / 2;
                    currentPdfPanX = (viewCenterX - e.clientX) * (1 - 100 / currentPdfZoom);
                    currentPdfPanY = (viewCenterY - e.clientY) * (1 - 100 / currentPdfZoom);
                    updatePdfZoomUI(true);
                }
            }
        }, { passive: false });
    }

    elements.pdfViewerModal?.addEventListener('click', (e) => {
        if (e.target === elements.pdfViewerModal) {
            closePdfViewer();
        }
    });

    elements.closeChatInvoicesModalBtn?.addEventListener('click', () => {
        if (elements.chatInvoicesModal) elements.chatInvoicesModal.style.display = 'none';
    });

    elements.chatInvoicesModal?.addEventListener('click', (e) => {
        if (e.target === elements.chatInvoicesModal) {
            elements.chatInvoicesModal.style.display = 'none';
        }
    });

    document.querySelector('[data-ui="chat-invoices-search"]')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === "") {
            renderInvoices(loadedInvoices);
        } else {
            const filtered = loadedInvoices.filter(inv => inv.searchText.includes(query));
            renderInvoices(filtered);
        }
    });

    elements.downloadPdfViewerBtn?.addEventListener('click', () => {
        const url = elements.downloadPdfViewerBtn.dataset.url;
        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank'; // Opens in new tab which usually triggers download for PDF blobs
            link.download = 'document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });

    elements.printPdfViewerBtn?.addEventListener('click', () => {
        const url = elements.printPdfViewerBtn.dataset.url;
        if (url) {
            window.open(url, '_blank');
        }
    });

    // Lightbox image/video view implementation for chat messages
    const openLightboxImage = (url, msg = null, isProfilePhoto = false) => {
        if (!msg) {
            isProfilePhoto = true;
        }
        const imgEl = elements.lightboxImage;
        const videoEl = elements.lightboxVideo;

        if (videoEl) {
            videoEl.style.display = 'none';
            videoEl.pause();
            videoEl.src = '';
        }

        if (imgEl) {
            window.currentLightboxImages = [url];
            window.currentLightboxIndex = 0;
            const spinner = document.getElementById('lightbox-spinner');
            if (spinner) spinner.style.display = 'block';
            imgEl.style.opacity = '0.3';

            imgEl.onload = () => {
                if (spinner) spinner.style.display = 'none';
                imgEl.style.opacity = '1';
                imgEl.onload = null;
            };

            imgEl.onerror = () => {
                if (spinner) spinner.style.display = 'none';
                imgEl.style.opacity = '1';
                imgEl.onerror = null;
            };

            imgEl.src = url;
            imgEl.style.display = 'block';
        }

        if (elements.lightboxPrev) elements.lightboxPrev.style.display = 'none';
        if (elements.lightboxNext) elements.lightboxNext.style.display = 'none';

        const usernameEl = elements.lightboxUsername;
        const timeEl = elements.lightboxTime;
        const avatarEl = elements.lightboxAvatar;

        setupLightboxUI(msg, url, isProfilePhoto);
        if (msg) {
            if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'flex';
            if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'flex';
            const profile = allUsersCache[msg.senderId] || {};
            const name = profile.fullname || msg.senderName || 'Contact';

            if (usernameEl) {
                usernameEl.textContent = name;
                usernameEl.style.display = 'block';
            }
            if (timeEl) {
                timeEl.textContent = getRelativeTime(msg.timestamp);
                timeEl.style.display = 'block';
            }
            if (avatarEl) {
                avatarEl.src = getAvatarUrl(name, profile.profilePhoto);
                avatarEl.style.display = 'block';
            }

            if (elements.lightboxEditBtn) {
                elements.lightboxEditBtn.style.display = msg.type === 'image' && !msg.deleted ? 'flex' : 'none';
                elements.lightboxEditBtn.onclick = async () => {
                    if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                    showToast("Downloading image for editing...", "info");
                    try {
                        const resp = await fetch(msg.url || url);
                        const blob = await resp.blob();
                        const editedBlob = await openImageEditor(blob);
                        if (editedBlob) {
                            showToast("Sending edited image...", "info");
                            await sendMedia('image', editedBlob, msg.fileName || 'edited_image.jpg');
                        }
                    } catch (err) {
                        console.error("Failed to download or edit image:", err);
                        showToast("Error loading image for editing.", "error");
                    }
                };
            }

            if (elements.lightboxStarBtn) {
                elements.lightboxStarBtn.style.display = 'flex';
                elements.lightboxStarBtn.onclick = async () => {
                    selectedMessages.clear();
                    selectedMessages.add(msg.id);
                    await handleMassStar();
                };
            }

            if (elements.lightboxForwardBtn) {
                elements.lightboxForwardBtn.style.display = 'flex';
                elements.lightboxForwardBtn.onclick = async () => {
                    if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                    pendingForwardData = [{
                        text: msg.text || '',
                        type: msg.type,
                        url: msg.url || null,
                        fileName: msg.fileName || null,
                        fileSize: msg.fileSize || null
                    }];
                    selectedForwardRecipients.clear();
                    updateForwardButton();

                    if (elements.forwardModal) {
                        elements.forwardModal.style.display = 'flex';
                        if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';
                    }
                    await populateForwardUserList();
                };
            }

            if (elements.lightboxDeleteBtn) {
                elements.lightboxDeleteBtn.style.display = 'flex';
                elements.lightboxDeleteBtn.onclick = () => {
                    try {
                        if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                        selectedMessages.clear();
                        selectedMessages.add(msg.id);
                        handleMassDelete();
                    } catch (err) {
                        console.error("lightboxDeleteBtn error:", err);
                        showToast("Lightbox Delete Error: " + err.message, "error");
                    }
                };
            }

            if (elements.lightboxDownloadBtn) {
                elements.lightboxDownloadBtn.style.display = isProfilePhoto ? 'none' : 'flex';
                elements.lightboxDownloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = msg.url || url;
                    a.download = msg.fileName || 'download.jpg';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            }
        } else {
            if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'flex';
            if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'none';
            if (usernameEl) usernameEl.textContent = 'Preview';
            if (timeEl) timeEl.textContent = '';
            if (avatarEl) avatarEl.style.display = 'none';
            if (elements.lightboxUsername) elements.lightboxUsername.textContent = 'Preview';
            if (elements.lightboxTime) elements.lightboxTime.textContent = '';
            if (elements.lightboxAvatar) elements.lightboxAvatar.style.display = 'none';
            if (elements.lightboxEditBtn) elements.lightboxEditBtn.style.display = 'none';
            if (elements.lightboxStarBtn) elements.lightboxStarBtn.style.display = 'none';
            if (elements.lightboxForwardBtn) elements.lightboxForwardBtn.style.display = 'none';
            if (elements.lightboxDeleteBtn) elements.lightboxDeleteBtn.style.display = 'none';
            if (elements.lightboxDownloadBtn) {
                elements.lightboxDownloadBtn.style.display = isProfilePhoto ? 'none' : 'flex';
                elements.lightboxDownloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'download.jpg';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            }
        }

        if (elements.lightboxModal) elements.lightboxModal.style.display = 'flex';
    };
    window.openLightboxImage = openLightboxImage;

    const openLightboxVideo = (url, msg = null) => {
        window.currentLightboxImages = [];
        window.currentLightboxIndex = 0;
        const imgEl = elements.lightboxImage;
        const videoEl = elements.lightboxVideo;

        if (imgEl) {
            imgEl.style.display = 'none';
            imgEl.src = '';
        }

        if (videoEl) {
            videoEl.src = url;
            videoEl.style.display = 'block';
            videoEl.load();
            videoEl.play().catch(e => console.log('Video autoplay blocked:', e));
        }

        if (elements.lightboxPrev) elements.lightboxPrev.style.display = 'none';
        if (elements.lightboxNext) elements.lightboxNext.style.display = 'none';

        const usernameEl = elements.lightboxUsername;
        const timeEl = elements.lightboxTime;
        const avatarEl = elements.lightboxAvatar;

        setupLightboxUI(msg, url, false);
        if (elements.lightboxEditBtn) elements.lightboxEditBtn.style.display = 'none';

        if (msg) {
            if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'flex';
            if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'flex';
            const profile = allUsersCache[msg.senderId] || {};
            const name = profile.fullname || msg.senderName || 'Contact';

            if (usernameEl) {
                usernameEl.textContent = name;
                usernameEl.style.display = 'block';
            }
            if (timeEl) {
                timeEl.textContent = getRelativeTime(msg.timestamp);
                timeEl.style.display = 'block';
            }
            if (avatarEl) {
                avatarEl.src = getAvatarUrl(name, profile.profilePhoto);
                avatarEl.style.display = 'block';
            }

            if (elements.lightboxStarBtn) {
                elements.lightboxStarBtn.style.display = 'flex';
                elements.lightboxStarBtn.onclick = async () => {
                    selectedMessages.clear();
                    selectedMessages.add(msg.id);
                    await handleMassStar();
                };
            }

            if (elements.lightboxForwardBtn) {
                elements.lightboxForwardBtn.style.display = 'flex';
                elements.lightboxForwardBtn.onclick = async () => {
                    if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                    pendingForwardData = [{
                        text: msg.text || '',
                        type: msg.type,
                        url: msg.url || null,
                        fileName: msg.fileName || null,
                        fileSize: msg.fileSize || null
                    }];
                    selectedForwardRecipients.clear();
                    updateForwardButton();

                    if (elements.forwardModal) {
                        elements.forwardModal.style.display = 'flex';
                        if (elements.forwardSearchInput) elements.forwardSearchInput.value = '';
                    }
                    await populateForwardUserList();
                };
            }

            if (elements.lightboxDeleteBtn) {
                elements.lightboxDeleteBtn.style.display = 'flex';
                elements.lightboxDeleteBtn.onclick = () => {
                    try {
                        if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
                        selectedMessages.clear();
                        selectedMessages.add(msg.id);
                        handleMassDelete();
                    } catch (err) {
                        console.error("lightboxDeleteBtn error:", err);
                        showToast("Lightbox Delete Error: " + err.message, "error");
                    }
                };
            }

            if (elements.lightboxDownloadBtn) {
                elements.lightboxDownloadBtn.style.display = 'flex';
                elements.lightboxDownloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = msg.url || url;
                    a.download = msg.fileName || 'download.mp4';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            }
        } else {
            if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'flex';
            if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'none';
            if (usernameEl) usernameEl.textContent = 'Preview';
            if (timeEl) timeEl.textContent = '';
            if (avatarEl) avatarEl.style.display = 'none';
            if (elements.lightboxUsername) elements.lightboxUsername.textContent = 'Preview';
            if (elements.lightboxTime) elements.lightboxTime.textContent = '';
            if (elements.lightboxAvatar) elements.lightboxAvatar.style.display = 'none';
            if (elements.lightboxStarBtn) elements.lightboxStarBtn.style.display = 'none';
            if (elements.lightboxForwardBtn) elements.lightboxForwardBtn.style.display = 'none';
            if (elements.lightboxDeleteBtn) elements.lightboxDeleteBtn.style.display = 'none';
            if (elements.lightboxDownloadBtn) {
                elements.lightboxDownloadBtn.style.display = 'flex';
                elements.lightboxDownloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'download.mp4';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            }
        }

        if (elements.lightboxModal) elements.lightboxModal.style.display = 'flex';
    };
    window.openLightboxVideo = openLightboxVideo;

    // Click listener on messages container for images/videos
    elements.messagesContainer?.addEventListener('click', (e) => {
        if (isSelectMode) return;

        const stopSharingBtn = e.target.closest('.stop-live-sharing-bubble-btn');
        if (stopSharingBtn) {
            e.stopPropagation();
            const msgId = stopSharingBtn.dataset.msgId;
            if (msgId) {
                currentLiveLocationMessageId = msgId;
            }
            if (stopLiveSharingFn) stopLiveSharingFn();
            showToast("Live location sharing stopped.", "success");
            return;
        }

        const videoPlaceholder = e.target.closest('.video-loader-placeholder');
        if (videoPlaceholder) {
            e.stopPropagation();
            const group = videoPlaceholder.closest('.message-group');
            const msg = messages.find(m => m.id === group.id);
            const fullUrl = videoPlaceholder.dataset.fullUrl || msg?.url;
            if (fullUrl) {
                openLightboxVideo(fullUrl, msg);
            }
            return;
        }

        const imageWrapper = e.target.closest('.image-loader-wrapper');
        const messageImage = imageWrapper?.querySelector('.message-image');
        if (messageImage) {
            e.stopPropagation();
            const group = imageWrapper.closest('.message-group');
            const msg = messages.find(m => m.id === group.id);
            const fullUrl = messageImage.dataset.fullUrl || msg?.url;
            if (fullUrl) {
                openLightboxImage(fullUrl, msg);
            }
            return;
        }
    });

    // MutationObserver on lightboxModal to automatically stop/reset video when closed
    if (elements.lightboxModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = elements.lightboxModal.style.display === 'flex';
                    const videoEl = elements.lightboxVideo;
                    const imgEl = elements.lightboxImage;

                    if (!isVisible) {
                        // Exit fullscreen if active (e.g. video was playing in fullscreen) to prevent freeze on back navigation
                        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                            try {
                                if (document.exitFullscreen) {
                                    document.exitFullscreen();
                                } else if (document.webkitExitFullscreen) {
                                    document.webkitExitFullscreen();
                                } else if (document.mozCancelFullScreen) {
                                    document.mozCancelFullScreen();
                                } else if (document.msExitFullscreen) {
                                    document.msExitFullscreen();
                                }
                            } catch (err) {
                                console.error("Error exiting fullscreen on close:", err);
                            }
                        }
                        if (videoEl) {
                            videoEl.pause();
                            videoEl.src = '';
                            videoEl.removeAttribute('src');
                            videoEl.load();
                            videoEl.style.display = 'none';
                        }
                        if (imgEl) {
                            imgEl.src = '';
                            imgEl.style.display = 'none';
                        }
                    } else {
                        // Lightbox opened: if image has src, ensure video is hidden and image is shown
                        if (imgEl && imgEl.src && !imgEl.src.endsWith('/undefined') && imgEl.style.display !== 'none') {
                            if (videoEl) {
                                videoEl.style.display = 'none';
                                videoEl.pause();
                                videoEl.src = '';
                            }
                            imgEl.style.display = 'block';
                        }
                    }
                }
            });
        });
        observer.observe(elements.lightboxModal, { attributes: true, attributeFilter: ['style'] });
    }

    // Close Lightbox on Close Button click
    elements.lightboxClose?.addEventListener('click', () => {
        if (elements.lightboxModal) elements.lightboxModal.style.display = 'none';
    });

    // Close Lightbox on backdrop click
    elements.lightboxModal?.addEventListener('click', (e) => {
        if (e.target === elements.lightboxModal) {
            elements.lightboxModal.style.display = 'none';
        }
    });
};

/**
 * Opens an image editor modal where user can draw/sign over the image.
 * Returns a Promise that resolves with a Blob of the edited image or null if cancelled.
 */
const openImageEditor = (file) => {
    return new Promise(async (resolve) => {
        const modal = elements.imageEditorModal;
        const canvas = elements.imageEditorCanvas;
        const brushSizeEl = elements.imageEditorBrushSize;
        const brushColorEl = elements.imageEditorBrushColor;
        const saveBtn = elements.imageEditorSaveBtn;
        const cancelBtn = elements.imageEditorCancelBtn;
        const clearBtn = elements.imageEditorClearBtn;
        const undoBtn = elements.imageEditorUndoBtn;
        if (!modal || !canvas) return resolve(null);

        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            // Resize canvas to fit image while keeping max dimensions
            const maxW = 1200;
            const scale = Math.min(1, maxW / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            modal.style.display = 'flex';
        };
        img.src = URL.createObjectURL(file);

        let drawing = false;
        let last = null;
        const history = [];
        let cropMode = false;
        let rotateAngle = 0; // degrees

        let isZooming = false;
        let initialTouchDist = 0;
        let initialScale = 1;
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let initialPanX = 0;
        let initialPanY = 0;
        let initialTouchCenter = { x: 0, y: 0 };

        const pushHistory = () => {
            history.push(canvas.toDataURL());
            if (history.length > 20) history.shift();
        };

        const restoreFromDataUrl = (dataUrl) => {
            const tmp = new Image();
            tmp.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(tmp, 0, 0); };
            tmp.src = dataUrl;
        };

        const startDraw = (x, y) => { drawing = true; last = { x, y }; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = brushColorEl.value; ctx.lineWidth = parseInt(brushSizeEl.value, 10); ctx.beginPath(); ctx.moveTo(last.x, last.y); };
        const moveDraw = (x, y) => { if (!drawing) return; ctx.lineTo(x, y); ctx.stroke(); last = { x, y }; };
        const endDraw = () => { if (drawing) { drawing = false; pushHistory(); } };

        let cropSelection = null;
        const getPointer = (e) => {
            const rect = canvas.getBoundingClientRect();
            const p = e.touches ? e.touches[0] : e;
            return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) };
        };

        const pointerDown = (e) => {
            if (e.touches && e.touches.length === 2) {
                isZooming = true;
                drawing = false;
                last = null;
                initialTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                initialScale = scale;
                initialPanX = panX;
                initialPanY = panY;
                e.preventDefault();
                return;
            }
            if (e.touches && e.touches.length === 1 && isZooming) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const p = getPointer(e);
            if (cropMode) {
                cropSelection = { x: p.x, y: p.y, w: 0, h: 0, startX: p.x, startY: p.y };
                draggingCrop = true;
                return;
            }
            startDraw(p.x, p.y);
        };
        const pointerMove = (e) => {
            if (e.touches && e.touches.length === 2) {
                if (!isZooming) {
                    isZooming = true;
                    drawing = false;
                    last = null;
                    initialTouchDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    initialTouchCenter = {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                    };
                    initialScale = scale;
                    initialPanX = panX;
                    initialPanY = panY;
                }
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const currentCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                const newScale = Math.max(1, Math.min(4, initialScale * (currentDist / initialTouchDist)));
                const deltaX = currentCenter.x - initialTouchCenter.x;
                const deltaY = currentCenter.y - initialTouchCenter.y;
                panX = initialPanX + deltaX;
                panY = initialPanY + deltaY;
                scale = newScale;
                if (scale === 1) {
                    panX = 0;
                    panY = 0;
                }
                canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                e.preventDefault();
                return;
            }
            if (e.touches && e.touches.length === 1 && isZooming) {
                e.preventDefault();
                return;
            }

            const p = getPointer(e);
            if (cropMode && cropSelection && draggingCrop) {
                cropSelection.w = Math.abs(p.x - cropSelection.startX);
                cropSelection.h = Math.abs(p.y - cropSelection.startY);
                cropSelection.x = Math.min(p.x, cropSelection.startX);
                cropSelection.y = Math.min(p.y, cropSelection.startY);
                // visual overlay: redraw image and overlay selection rectangle
                restoreFromDataUrl(history[history.length - 1] || canvas.toDataURL());
                ctx.save(); ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(cropSelection.x, cropSelection.y, cropSelection.w, cropSelection.h); ctx.restore();
                return;
            }
            if (!drawing) return; e.preventDefault(); moveDraw(p.x, p.y);
        };
        let draggingCrop = false;
        const pointerUp = (e) => {
            if (e.touches && e.touches.length === 0) {
                isZooming = false;
            }
            if (isZooming) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            if (cropMode && draggingCrop) {
                draggingCrop = false;
                pushHistory();
            } else {
                endDraw();
            }
        };

        canvas.addEventListener('mousedown', pointerDown);
        canvas.addEventListener('touchstart', pointerDown, { passive: false });
        window.addEventListener('mousemove', pointerMove);
        canvas.addEventListener('touchmove', pointerMove, { passive: false });
        window.addEventListener('mouseup', pointerUp);
        canvas.addEventListener('touchend', pointerUp);

        clearBtn.onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); pushHistory(); };
        undoBtn.onclick = () => { if (history.length > 0) { history.pop(); const lastImg = history[history.length - 1]; if (lastImg) restoreFromDataUrl(lastImg); else { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); } } };

        // Crop handler
        elements.imageEditorCropBtn?.addEventListener('click', () => {
            cropMode = !cropMode;
            if (cropMode) {
                canvas.style.cursor = 'crosshair';
                showToast('Drag to select crop area, then click Crop again to apply', 'info');
            } else {
                // apply crop if selection exists
                if (cropSelection) {
                    const { x, y, w, h } = cropSelection;
                    const tmp = document.createElement('canvas');
                    tmp.width = w; tmp.height = h;
                    tmp.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
                    canvas.width = w; canvas.height = h;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(tmp, 0, 0);
                    pushHistory();
                    cropSelection = null;
                }
                canvas.style.cursor = '';
            }
        });

        // Rotate handler
        elements.imageEditorRotateBtn?.addEventListener('click', () => {
            rotateAngle = (rotateAngle + 90) % 360;
            const tmp = document.createElement('canvas');
            if (rotateAngle % 180 === 90) {
                tmp.width = canvas.height; tmp.height = canvas.width;
            } else {
                tmp.width = canvas.width; tmp.height = canvas.height;
            }
            const tctx = tmp.getContext('2d');
            tctx.save();
            tctx.translate(tmp.width / 2, tmp.height / 2);
            tctx.rotate((rotateAngle * Math.PI) / 180);
            tctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
            tctx.restore();
            canvas.width = tmp.width; canvas.height = tmp.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tmp, 0, 0);
            pushHistory();
        });

        // Add text
        elements.imageEditorAddTextBtn?.addEventListener('click', () => {
            const txt = prompt('Enter text to add:');
            if (txt) {
                ctx.save();
                ctx.fillStyle = brushColorEl.value;
                const fontSize = Math.max(18, (canvas.width / 20));
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillText(txt, 20, canvas.height - 40);
                ctx.restore();
                pushHistory();
            }
        });

        // Stickers toggle and placement
        let stickersVisible = false;
        elements.imageEditorStickersToggle?.addEventListener('click', () => {
            stickersVisible = !stickersVisible;
            if (elements.imageEditorStickers) elements.imageEditorStickers.style.display = stickersVisible ? 'flex' : 'none';
        });
        if (elements.imageEditorStickers) {
            elements.imageEditorStickers.querySelectorAll('.sticker-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const s = btn.textContent.trim();
                    ctx.save(); ctx.font = `${Math.max(24, canvas.width / 15)}px serif`; ctx.fillText(s, canvas.width / 2 - 20, canvas.height / 2);
                    ctx.restore(); pushHistory();
                });
            });
        }

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(null);
        };

        saveBtn.onclick = async () => {
            modal.style.display = 'none';
            canvas.toBlob((blob) => {
                cleanup();
                resolve(blob);
            }, 'image/jpeg', 0.9);
        };

        const cleanup = () => {
            canvas.removeEventListener('mousedown', pointerDown);
            canvas.removeEventListener('touchstart', pointerDown);
            window.removeEventListener('mousemove', pointerMove);
            canvas.removeEventListener('touchmove', pointerMove);
            window.removeEventListener('mouseup', pointerUp);
            canvas.removeEventListener('touchend', pointerUp);
            canvas.style.transform = '';
            img.src = '';
            URL.revokeObjectURL(img.src);
        };
    });
};

/**
 * Opens document signer for PDFs. Renders first page and lets user draw a signature.
 * Returns a Promise resolving to a Blob (signed PDF) or null if cancelled.
 */
const openDocSigner = (file) => {
    return new Promise(async (resolve) => {
        const modal = elements.docSignModal;
        const canvas = elements.docSignCanvas;
        const brushSizeEl = elements.docSignBrushSize;
        const brushColorEl = elements.docSignBrushColor;
        const saveBtn = elements.docSignSaveBtn;
        const cancelBtn = elements.docSignCancelBtn;
        const clearBtn = elements.docSignClearBtn;
        if (!modal || !canvas) return resolve(null);

        modal.style.display = 'flex';

        // Render first page
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsData = arrayBuffer.slice(0);
        const pdf = await pdfjsLib.getDocument({ data: pdfjsData }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Create a transparent offscreen canvas of the same size to capture ONLY the user's drawings
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        // Overlay drawing on top: reuse same canvas for simplicity (signature will be merged)
        let drawing = false; let last = null; const history = [];
        let isZooming = false;
        let initialTouchDist = 0;
        let initialScale = 1;
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let initialPanX = 0;
        let initialPanY = 0;
        let initialTouchCenter = { x: 0, y: 0 };

        const pushHistory = () => { history.push(canvas.toDataURL()); if (history.length > 20) history.shift(); };
        const startDraw = (x, y) => {
            drawing = true;
            last = { x, y };
            // Draw on visual canvas
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = brushColorEl.value; ctx.lineWidth = parseInt(brushSizeEl.value, 10); ctx.beginPath(); ctx.moveTo(last.x, last.y);
            // Draw on transparent offscreen canvas
            offscreenCtx.lineCap = 'round'; offscreenCtx.lineJoin = 'round'; offscreenCtx.strokeStyle = brushColorEl.value; offscreenCtx.lineWidth = parseInt(brushSizeEl.value, 10); offscreenCtx.beginPath(); offscreenCtx.moveTo(last.x, last.y);
        };
        const moveDraw = (x, y) => {
            if (!drawing) return;
            // Draw on visual canvas
            ctx.lineTo(x, y); ctx.stroke();
            // Draw on transparent offscreen canvas
            offscreenCtx.lineTo(x, y); offscreenCtx.stroke();
            last = { x, y };
        };
        const endDraw = () => { if (drawing) { drawing = false; pushHistory(); } };
        const getPointer = (e) => { const rect = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) }; };

        const pointerDown = (e) => {
            if (e.touches && e.touches.length === 2) {
                isZooming = true;
                drawing = false;
                last = null;
                initialTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                initialScale = scale;
                initialPanX = panX;
                initialPanY = panY;
                e.preventDefault();
                return;
            }
            if (e.touches && e.touches.length === 1 && isZooming) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const p = getPointer(e);
            startDraw(p.x, p.y);
        };

        const pointerMove = (e) => {
            if (e.touches && e.touches.length === 2) {
                if (!isZooming) {
                    isZooming = true;
                    drawing = false;
                    last = null;
                    initialTouchDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    initialTouchCenter = {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                    };
                    initialScale = scale;
                    initialPanX = panX;
                    initialPanY = panY;
                }
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const currentCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                const newScale = Math.max(1, Math.min(4, initialScale * (currentDist / initialTouchDist)));
                const deltaX = currentCenter.x - initialTouchCenter.x;
                const deltaY = currentCenter.y - initialTouchCenter.y;
                panX = initialPanX + deltaX;
                panY = initialPanY + deltaY;
                scale = newScale;
                if (scale === 1) {
                    panX = 0;
                    panY = 0;
                }
                canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                e.preventDefault();
                return;
            }
            if (e.touches && e.touches.length === 1 && isZooming) {
                e.preventDefault();
                return;
            }
            if (!drawing) return;
            e.preventDefault();
            const p = getPointer(e);
            moveDraw(p.x, p.y);
        };

        const pointerUp = (e) => {
            if (e.touches && e.touches.length === 0) {
                isZooming = false;
            }
            if (isZooming) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            endDraw();
        };

        canvas.addEventListener('mousedown', pointerDown);
        canvas.addEventListener('touchstart', pointerDown, { passive: false });
        window.addEventListener('mousemove', pointerMove);
        canvas.addEventListener('touchmove', pointerMove, { passive: false });
        window.addEventListener('mouseup', pointerUp);
        canvas.addEventListener('touchend', pointerUp);

        clearBtn.onclick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            page.render({ canvasContext: ctx, viewport }).promise.then(() => pushHistory());
        };

        cancelBtn.onclick = () => { modal.style.display = 'none'; cleanup(); resolve(null); };

        saveBtn.onclick = async () => {
            try {
                // Find bounding box of drawings
                const getBoundingBox = (canvas) => {
                    const ctx = canvas.getContext('2d');
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;
                    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < canvas.width; x++) {
                            const alpha = data[(y * canvas.width + x) * 4 + 3];
                            if (alpha > 0) {
                                if (x < minX) minX = x;
                                if (y < minY) minY = y;
                                if (x > maxX) maxX = x;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (maxX === -1) return null;
                    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
                };

                const bbox = getBoundingBox(offscreenCanvas);
                if (!bbox) {
                    modal.style.display = 'none'; cleanup(); resolve(null);
                    return;
                }

                // Create a cropped canvas containing only the signature
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = bbox.w;
                cropCanvas.height = bbox.h;
                const cropCtx = cropCanvas.getContext('2d');
                cropCtx.drawImage(offscreenCanvas, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h);

                const pngBlob = await new Promise(r => cropCanvas.toBlob(r, 'image/png'));
                const pngArrayBuf = await pngBlob.arrayBuffer();

                // Use pdf-lib to embed the signature image and save a new PDF
                const pdfLibDoc = await PDFLib.PDFDocument.load(new Uint8Array(arrayBuffer));
                const pngImage = await pdfLibDoc.embedPng(new Uint8Array(pngArrayBuf));
                const pages = pdfLibDoc.getPages();
                const firstPage = pages[0];
                const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();

                // Place signature at the exact mapped coordinate (PDF origin is bottom-left)
                const x = bbox.x;
                const y = pdfHeight - bbox.y - bbox.h;
                const sigWidth = bbox.w;
                const sigHeight = bbox.h;

                firstPage.drawImage(pngImage, { x, y, width: sigWidth, height: sigHeight });

                const newPdfBytes = await pdfLibDoc.save();
                const signedBlob = new Blob([newPdfBytes], { type: 'application/pdf' });

                modal.style.display = 'none'; cleanup(); resolve(signedBlob);
            } catch (err) {
                console.error('Signing failed', err);
                showToast("Signing failed: " + (err.message || err), "error");
                modal.style.display = 'none'; cleanup(); resolve(null);
            }
        };

        const cleanup = () => {
            canvas.removeEventListener('mousedown', pointerDown);
            canvas.removeEventListener('touchstart', pointerDown);
            window.removeEventListener('mousemove', pointerMove);
            canvas.removeEventListener('touchmove', pointerMove);
            window.removeEventListener('mouseup', pointerUp);
            canvas.removeEventListener('touchend', pointerUp);
            canvas.style.transform = '';
        };
    });
};

let loadedInvoices = [];

const renderInvoices = (invoices) => {
    const listContainer = elements.chatInvoicesList;
    if (!listContainer) return;

    if (invoices.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted); font-size: 0.9rem; width: 100%;">
                <i class="fa-solid fa-file-invoice-dollar" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.3;"></i>
                <p>No matching invoices found.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = invoices.map(inv => inv.itemHtml).join('');
};

const openChatInvoicesModal = async () => {
    console.log("openChatInvoicesModal called");
    const modal = elements.chatInvoicesModal;
    const listContainer = elements.chatInvoicesList;
    console.log("Modal element:", modal, "List container:", listContainer, "activeChatUid:", activeChatUid);
    if (!modal || !listContainer || !activeChatUid) return;

    // Reset search input
    const searchInput = document.querySelector('[data-ui="chat-invoices-search"]');
    if (searchInput) searchInput.value = '';

    listContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--muted); gap: 10px;">
            <span class="spinner" style="width: 24px; height: 24px; border-width: 3px; margin: 0;"></span>
            <span style="font-size: 0.9rem;">Fetching invoice history...</span>
        </div>
    `;
    modal.style.display = 'flex';

    try {
        const user = auth.currentUser;
        if (!user) return;
        const chatId = [user.uid, activeChatUid].sort().join('_');

        const messagesRef = ref(db, `messages/${chatId}`);
        const snapshot = await get(messagesRef);

        let allMsgs = [];
        if (snapshot.exists()) {
            const val = snapshot.val();
            allMsgs = Object.entries(val).map(([id, msg]) => ({ id, ...msg }));
        }

        const invoiceMessages = [];
        for (const msg of allMsgs) {
            const isInvoice = msg.type === 'invoice';
            const isPdfInvoice = msg.type === 'document' && msg.fileName && msg.fileName.startsWith('Invoice_');
            if (isInvoice || isPdfInvoice) {
                const decrypted = await decryptMessageInPlace({ ...msg });
                invoiceMessages.push(decrypted);
            }
        }

        invoiceMessages.sort((a, b) => b.id.localeCompare(a.id));

        if (invoiceMessages.length === 0) {
            loadedInvoices = [];
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--muted); font-size: 0.9rem; width: 100%;">
                    <i class="fa-solid fa-file-invoice-dollar" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.3;"></i>
                    <p>No invoices found in this chat.</p>
                </div>
            `;
            return;
        }

        loadedInvoices = [];

        for (const msg of invoiceMessages) {
            const dateStr = new Date(msg.timestamp).toLocaleString();
            let isConfirmed = msg.orderConfirmed;
            let totalHtml = '';
            let detailsHtml = '';
            let viewButtonHtml = '';
            let invoiceId = msg.invoiceId;
            let searchText = '';

            let orderNoText = '';
            let totalText = '';
            let fileText = '';

            if (msg.type === 'invoice' && invoiceId) {
                const order = await getOrder(invoiceId);
                if (order) {
                    if (order.status === 'confirmed') isConfirmed = true;
                    totalText = `${order.currency}${parseFloat(order.total).toFixed(2)}`;
                    totalHtml = `<span style="font-weight: 700; color: var(--brand-dark);">${totalText}</span>`;
                    orderNoText = order.orderNumber || invoiceId.substring(0, 8).toUpperCase();
                    detailsHtml = `
                        <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">
                            Order Number: <strong>${orderNoText}</strong>
                        </div>
                    `;
                    viewButtonHtml = `
                        <button onclick="openPdfViewer('${order.downloadURL}', '${msg.id}')" 
                            style="background: var(--brand-light); color: var(--brand-dark); border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.78rem; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-file-pdf"></i> View PDF
                        </button>
                    `;
                }
            } else if (msg.type === 'document') {
                totalText = formatFileSize(msg.fileSize);
                totalHtml = `<span style="font-size: 0.78rem; color: var(--muted);">${totalText}</span>`;
                fileText = msg.fileName;
                detailsHtml = `
                    <div style="font-size: 0.78rem; color: var(--muted); font-weight: 500; margin-top: 2px;">
                        File: <strong>${fileText}</strong>
                    </div>
                `;
                viewButtonHtml = `
                    <button onclick="openPdfViewer('${msg.url}', '${msg.id}')" 
                        style="background: var(--brand-light); color: var(--brand-dark); border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.78rem; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-file-pdf"></i> View PDF
                    </button>
                `;
            }

            const statusText = isConfirmed ? 'Confirmed' : 'Pending';
            const statusBadge = isConfirmed
                ? `<span style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Confirmed</span>`
                : `<span style="background: #fff3e0; color: #ef6c00; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Pending</span>`;

            const itemHtml = `
                <div style="border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel-soft); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.8rem; color: var(--muted);">${dateStr}</span>
                        ${statusBadge}
                    </div>
                    ${detailsHtml}
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; border-top: 1px dashed var(--border); padding-top: 8px;">
                        ${totalHtml}
                        ${viewButtonHtml}
                    </div>
                </div>
            `;

            searchText = `${orderNoText} ${invoiceId || ''} ${fileText} ${dateStr} ${totalText} ${statusText}`.toLowerCase();

            loadedInvoices.push({
                searchText,
                itemHtml
            });
        }

        renderInvoices(loadedInvoices);

    } catch (error) {
        console.error("Error loading chat invoices:", error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted); font-size: 0.9rem;">
                <i class="fa-solid fa-circle-xmark" style="font-size: 2rem; margin-bottom: 8px; color: #ff4d4d; opacity: 0.8;"></i>
                <p>Failed to load invoices. Please try again.</p>
            </div>
        `;
    }
};

/**
 * Programmatically opens a chat conversation with the target user Uid.
 * Adds them to the active chat list, activates the Chats navigation tab,
 * and triggers a programmatic click on the rendered conversation item.
 */
window.openChatWithUser = async (otherUid) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUid) return;

    try {
        // 1. Add to chat list in database
        await addToChatList(currentUser.uid, otherUid);

        // 2. Switch to Chats tab
        elements.chatsNav?.click();

        // 3. Programmatically find and click the item in the conversation list
        setTimeout(() => {
            const selectItem = () => {
                const item = elements.chatConversationList?.querySelector(`[data-uid="${otherUid}"]`);
                if (item) {
                    item.click();
                    return true;
                }
                return false;
            };

            if (!selectItem()) {
                let attempts = 0;
                const interval = setInterval(() => {
                    if (selectItem() || ++attempts > 20) {
                        clearInterval(interval);
                    }
                }, 100);
            }
        }, 100);
    } catch (err) {
        console.error("Error in openChatWithUser:", err);
    }
};

// Premium Lightbox Image Zoom implementation (Pinch-to-zoom for touch, wheel/drag/double-click for mouse)
const initLightboxZoom = () => {
    const imgEl = elements.lightboxImage;
    if (!imgEl) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    // Pinch-to-zoom variables
    let initialPinchDistance = 0;
    let initialScale = 1;
    let midX = 0;
    let midY = 0;

    const resetZoom = () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        isDragging = false;
        imgEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        imgEl.style.transform = 'none';
        imgEl.style.cursor = 'zoom-in';
    };

    const applyTransform = (smooth = false) => {
        if (smooth) {
            imgEl.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease';
        } else {
            imgEl.style.transition = 'opacity 0.2s ease';
        }

        const container = imgEl.parentElement;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (scale <= 1) {
            translateX = 0;
            translateY = 0;
            imgEl.style.transform = `scale(${scale}) translate(0px, 0px)`;
            imgEl.style.cursor = 'zoom-in';
        } else {
            const maxPanX = (containerWidth * (scale - 1)) / 2 / scale;
            const maxPanY = (containerHeight * (scale - 1)) / 2 / scale;

            translateX = Math.max(-maxPanX, Math.min(maxPanX, translateX));
            translateY = Math.max(-maxPanY, Math.min(maxPanY, translateY));

            imgEl.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
            imgEl.style.cursor = 'grab';
        }
    };

    imgEl.addEventListener('load', resetZoom);

    const modalObserver = new MutationObserver(() => {
        if (elements.lightboxModal && elements.lightboxModal.style.display !== 'flex') {
            resetZoom();
        }
    });
    if (elements.lightboxModal) {
        modalObserver.observe(elements.lightboxModal, { attributes: true, attributeFilter: ['style'] });
    }

    const toggleZoom = (clientX, clientY) => {
        if (scale > 1) {
            resetZoom();
        } else {
            scale = 2.5;
            const viewCenterX = window.innerWidth / 2;
            const viewCenterY = window.innerHeight / 2;
            translateX = (viewCenterX - clientX) / scale;
            translateY = (viewCenterY - clientY) / scale;
            applyTransform(true);
        }
    };

    imgEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleZoom(e.clientX, e.clientY);
    });

    let lastTapTime = 0;
    imgEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                e.preventDefault();
                toggleZoom(e.touches[0].clientX, e.touches[0].clientY);
                lastTapTime = 0;
                return;
            }
            lastTapTime = now;

            if (scale > 1) {
                isDragging = true;
                startX = e.touches[0].clientX - translateX * scale;
                startY = e.touches[0].clientY - translateY * scale;
            }
        } else if (e.touches.length === 2) {
            isDragging = false;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            initialScale = scale;
            midX = (t1.clientX + t2.clientX) / 2;
            midY = (t1.clientY + t2.clientY) / 2;
        }
    });

    imgEl.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1 && scale > 1) {
            e.preventDefault();
            translateX = (e.touches[0].clientX - startX) / scale;
            translateY = (e.touches[0].clientY - startY) / scale;
            applyTransform(false);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            if (initialPinchDistance > 0) {
                const ratio = dist / initialPinchDistance;
                scale = Math.max(1, Math.min(5, initialScale * ratio));
                const viewCenterX = window.innerWidth / 2;
                const viewCenterY = window.innerHeight / 2;
                translateX = (viewCenterX - midX) * (1 - 1 / scale);
                translateY = (viewCenterY - midY) * (1 - 1 / scale);
                applyTransform(false);
            }
        }
    });

    imgEl.addEventListener('touchend', (e) => {
        isDragging = false;
        if (e.touches.length < 2) {
            initialPinchDistance = 0;
        }
    });

    imgEl.addEventListener('mousedown', (e) => {
        if (scale > 1 && e.button === 0) {
            e.preventDefault();
            isDragging = true;
            imgEl.style.cursor = 'grabbing';
            startX = e.clientX - translateX * scale;
            startY = e.clientY - translateY * scale;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            translateX = (e.clientX - startX) / scale;
            translateY = (e.clientY - startY) / scale;
            applyTransform(false);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            imgEl.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
        }
    });

    imgEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 0.15;
        const prevScale = scale;
        if (e.deltaY < 0) {
            scale = Math.min(5, scale + zoomFactor);
        } else {
            scale = Math.max(1, scale - zoomFactor);
        }

        if (scale !== prevScale) {
            const viewCenterX = window.innerWidth / 2;
            const viewCenterY = window.innerHeight / 2;
            translateX = (viewCenterX - e.clientX) * (1 - 1 / scale);
            translateY = (viewCenterY - e.clientY) * (1 - 1 / scale);
            applyTransform(true);
        }
    }, { passive: false });
};

// Initialize zoom feature when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightboxZoom);
} else {
    initLightboxZoom();
}