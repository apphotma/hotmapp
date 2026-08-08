import { elements } from './elements.js';
import { auth, db } from './firebase-config.js';
import { 
    getUserProfile, 
    getAllUsers, 
    getChatList, 
    deleteFile, 
    deleteMessagesBatch 
} from './database-service.js?v=1.1.6';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { showToast } from './toast.js';
import { hideElement, showElement } from './utils.js';
import { subscribeToAuthChanges } from './auth-service.js';

// Default mock offsets for premium dashboard feel
const DEFAULT_FREE_SPACE = 64 * 1024 * 1024 * 1024; // 64 GB
const MOCK_OTHER_APPS_USAGE = 12 * 1024 * 1024 * 1024; // 12 GB

// Fallback media file size estimations
const ESTIMATED_SIZES = {
    image: 1.5 * 1024 * 1024,      // 1.5 MB
    video: 5.0 * 1024 * 1024,      // 5.0 MB
    audio: 800 * 1024,             // 800 KB
    document: 2.0 * 1024 * 1024    // 2.0 MB
};

// State Variables
let totalAppUsage = 0;
let chatsStorageData = []; // Array of { otherUid, name, avatar, size, messages: [] }
let largeFiles = []; // Media messages > 5MB
let selectedMediaForDeletion = new Set();
let activeStorageChatId = null;
let activeStorageChatUid = null;
let currentAutoDownloadType = 'mobile'; // 'mobile', 'wifi', 'roaming'

// Helper: Format Bytes beautifully
export const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Calculate real-time storage stats from DB
const calculateStorageStats = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const [chatListIds, allUsers] = await Promise.all([
            getChatList(user.uid),
            getAllUsers()
        ]);

        totalAppUsage = 0;
        chatsStorageData = [];
        largeFiles = [];

        const chatUids = Object.keys(chatListIds);
        
        for (const otherUid of chatUids) {
            const chatId = [user.uid, otherUid].sort().join('_');
            const messagesRef = ref(db, `messages/${chatId}`);
            const snapshot = await get(messagesRef);
            
            let chatSize = 0;
            const mediaMessages = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnap) => {
                    const msg = childSnap.val();
                    // Identify media messages
                    if (msg.url && msg.type !== 'text' && msg.type !== 'system' && !msg.deleted) {
                        // Use actual size if available in metadata, otherwise fallback to estimation
                        const size = msg.fileSize || ESTIMATED_SIZES[msg.type] || 1024 * 100;
                        chatSize += size;
                        
                        const msgData = {
                            id: childSnap.key,
                            size: size,
                            ...msg
                        };
                        mediaMessages.push(msgData);
                        totalAppUsage += size;

                        // Check if file is larger than 5 MB
                        if (size > 5 * 1024 * 1024) {
                            largeFiles.push({
                                ...msgData,
                                chatId,
                                chatName: allUsers[otherUid]?.fullname || 'Unknown User'
                            });
                        }
                    }
                });
            }

            if (mediaMessages.length > 0) {
                const profile = allUsers[otherUid] || {};
                chatsStorageData.push({
                    otherUid,
                    chatId,
                    name: profile.fullname || 'Unknown User',
                    avatar: profile.profilePhoto || '',
                    size: chatSize,
                    messages: mediaMessages
                });
            }
        }

        // Sort chats by storage size descending
        chatsStorageData.sort((a, b) => b.size - a.size);
        
        // Update storage summaries in Main Storage and Data menu
        const summaryText = document.querySelector('[data-ui="storage-usage-summary-text"]');
        if (summaryText) {
            summaryText.textContent = `${formatBytes(totalAppUsage)} used`;
        }

        // Update Network Usage Stats summary briefly
        const networkSummaryText = document.querySelector('[data-ui="network-usage-summary-text"]');
        if (networkSummaryText) {
            // Read simulated data bytes
            const sent = parseInt(localStorage.getItem('hotmapp_net_sent_bytes') || '5324800'); // ~5.1 MB default
            const rcvd = parseInt(localStorage.getItem('hotmapp_net_received_bytes') || '14889700'); // ~14.2 MB default
            networkSummaryText.textContent = `${formatBytes(sent + rcvd)} total sent & received`;
        }

        updateStorageDashboardUI();

    } catch (error) {
        console.error("Error calculating storage stats:", error);
    }
};

// Update Manage Storage Modal dashboard view
const updateStorageDashboardUI = () => {
    // 1. Text displays
    if (elements.storageUsageAppText) {
        elements.storageUsageAppText.textContent = `${formatBytes(totalAppUsage)} Used`;
    }
    if (elements.storageUsageFreeText) {
        const free = Math.max(0, DEFAULT_FREE_SPACE - totalAppUsage - MOCK_OTHER_APPS_USAGE);
        elements.storageUsageFreeText.textContent = `${formatBytes(free)} Free`;
    }

    // 2. Progress bars
    if (elements.storageProgressApp && elements.storageProgressOther) {
        const appPercent = (totalAppUsage / DEFAULT_FREE_SPACE) * 100;
        const otherPercent = (MOCK_OTHER_APPS_USAGE / DEFAULT_FREE_SPACE) * 100;
        
        elements.storageProgressApp.style.width = `${appPercent}%`;
        elements.storageProgressOther.style.width = `${otherPercent}%`;
    }

    // 3. Update Review Large Files count
    const largeFilesCountText = document.querySelector('[data-ui="large-files-count-text"]');
    if (largeFilesCountText) {
        largeFilesCountText.textContent = `${largeFiles.length} file${largeFiles.length === 1 ? '' : 's'}`;
    }

    // 4. Render chats list sorted by size
    const chatsContainer = elements.manageStorageChatsList;
    if (!chatsContainer) return;

    if (chatsStorageData.length === 0) {
        chatsContainer.innerHTML = `
            <div style="text-align: center; color: var(--muted); padding: 40px 20px;">
                <i class="fa-solid fa-cloud" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 12px;"></i>
                <p style="font-size: 0.95rem; margin: 0;">No media storage found in your chats</p>
            </div>
        `;
        return;
    }

    chatsContainer.innerHTML = chatsStorageData.map(chat => {
        const initials = chat.name.charAt(0).toUpperCase();
        const avatarHtml = chat.avatar 
            ? `<img src="${chat.avatar}" class="avatar-img">` 
            : `<div class="avatar-placeholder" style="width:100%; height:100%; display:grid; place-items:center; background:var(--brand); color:white; font-weight:700;">${initials}</div>`;

        return `
            <div class="conversation-item storage-chat-row" data-uid="${chat.otherUid}" data-chat-id="${chat.chatId}" style="border-bottom: 1px solid var(--border);">
                <div class="conversation-avatar">${avatarHtml}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${chat.name}</div>
                    <div class="conversation-preview" style="font-size: 0.8rem;">${chat.messages.length} media file${chat.messages.length === 1 ? '' : 's'}</div>
                </div>
                <span class="chat-storage-size-label">${formatBytes(chat.size)}</span>
                <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; color: var(--muted); margin-left: 10px;"></i>
            </div>
        `;
    }).join('');
};

// Render media grid of a specific chat inside the sub-modal
const openChatStorageView = (name, chatId, otherUid, messagesList) => {
    activeStorageChatId = chatId;
    activeStorageChatUid = otherUid;
    selectedMediaForDeletion.clear();

    if (elements.chatStorageTitle) {
        elements.chatStorageTitle.textContent = name;
    }

    const totalChatBytes = messagesList.reduce((acc, m) => acc + m.size, 0);
    if (elements.chatStorageUsage) {
        elements.chatStorageUsage.textContent = `${formatBytes(totalChatBytes)} • ${messagesList.length} files`;
    }

    // Uncheck select all
    const selectAllCheckbox = elements.chatStorageSelectAllBtn;
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    // Hide delete button initially
    if (elements.chatStorageDeleteBtn) elements.chatStorageDeleteBtn.style.display = 'none';

    // Populate media grid
    const grid = elements.chatStorageMediaGrid;
    if (!grid) return;

    if (messagesList.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--muted)">No files found</div>`;
        return;
    }

    grid.innerHTML = messagesList.map(msg => {
        let contentHtml = '';
        const sizeLabel = formatBytes(msg.size);

        if (msg.type === 'image') {
            contentHtml = `<img src="${msg.url}" alt="Image">`;
        } else if (msg.type === 'video') {
            contentHtml = `
                <video src="${msg.url}"></video>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white; font-size:1.5rem; text-shadow:0 2px 4px rgba(0,0,0,0.5);">
                    <i class="fa-solid fa-play"></i>
                </div>
            `;
        } else {
            // Audio or Document placeholder
            const icon = msg.type === 'audio' ? 'fa-music' : 'fa-file-pdf';
            const color = msg.type === 'audio' ? '#2196f3' : '#e74c3c';
            contentHtml = `
                <div class="storage-media-placeholder">
                    <i class="fa-solid ${icon}" style="color: ${color};"></i>
                    <span title="${msg.fileName || 'file'}">${msg.fileName || 'file'}</span>
                </div>
            `;
        }

        return `
            <div class="storage-media-item" data-msg-id="${msg.id}" data-url="${msg.url}">
                ${contentHtml}
                <div class="storage-media-badge">${sizeLabel}</div>
            </div>
        `;
    }).join('');

    showElement(elements.chatStorageViewModal, 'flex');
};

// Handle Selection inside Chat Storage media grid
const handleMediaGridClick = (e) => {
    const item = e.target.closest('.storage-media-item');
    if (!item) return;

    const msgId = item.dataset.msgId;
    if (selectedMediaForDeletion.has(msgId)) {
        selectedMediaForDeletion.delete(msgId);
        item.classList.remove('selected');
    } else {
        selectedMediaForDeletion.add(msgId);
        item.classList.add('selected');
    }

    updateDeleteBtnState();
};

const updateDeleteBtnState = () => {
    const btn = elements.chatStorageDeleteBtn;
    if (!btn) return;

    const count = selectedMediaForDeletion.size;
    if (count > 0) {
        btn.style.display = 'block';
        btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (${count})`;
    } else {
        btn.style.display = 'none';
    }

    // Update select all state
    const selectAllCheckbox = elements.chatStorageSelectAllBtn;
    if (selectAllCheckbox) {
        const totalItems = elements.chatStorageMediaGrid.querySelectorAll('.storage-media-item').length;
        selectAllCheckbox.checked = count === totalItems && totalItems > 0;
    }
};

// Select All / Deselect All trigger
const handleSelectAllMedia = (e) => {
    const checked = e.target.checked;
    const items = elements.chatStorageMediaGrid.querySelectorAll('.storage-media-item');

    selectedMediaForDeletion.clear();
    items.forEach(item => {
        const msgId = item.dataset.msgId;
        if (checked) {
            selectedMediaForDeletion.add(msgId);
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    updateDeleteBtnState();
};

// Delete media action
const executeMediaDeletion = async () => {
    if (selectedMediaForDeletion.size === 0 || !activeStorageChatId) return;

    const count = selectedMediaForDeletion.size;
    const confirmMessage = `Are you sure you want to delete these ${count} file${count === 1 ? '' : 's'}? This will permanently reclaim storage space.`;
    
    if (!confirm(confirmMessage)) return;

    showToast("Deleting files...", "info");

    try {
        const chatData = chatsStorageData.find(c => c.chatId === activeStorageChatId) || { messages: largeFiles };
        const msgIds = Array.from(selectedMediaForDeletion);

        // Delete from Firebase Storage first
        const deletePromises = msgIds.map(id => {
            const msg = chatData.messages.find(m => m.id === id);
            if (msg && msg.url) {
                return deleteFile(msg.url);
            }
            return Promise.resolve();
        });

        await Promise.all(deletePromises);

        // Delete references from Realtime Database (which deletes for everyone)
        await deleteMessagesBatch(activeStorageChatId, msgIds);

        showToast("Storage space reclaimed successfully!", "success");

        // Close sub-modal
        hideElement(elements.chatStorageViewModal);

        // Recalculate stats & refresh view
        await calculateStorageStats();

    } catch (err) {
        console.error("Deletion error:", err);
        showToast("Failed to delete some files", "error");
    }
};

// NETWORK USAGE LOGIC
const getNetworkStats = () => {
    // Return saved values or generate realistic mocks if empty
    let sentMsgs = parseInt(localStorage.getItem('hotmapp_net_sent_msgs') || '245');
    let rcvdMsgs = parseInt(localStorage.getItem('hotmapp_net_received_msgs') || '892');
    let sentCallBytes = parseInt(localStorage.getItem('hotmapp_net_sent_calls') || '3670016'); // ~3.5 MB
    let rcvdCallBytes = parseInt(localStorage.getItem('hotmapp_net_received_calls') || '6291456'); // ~6.0 MB
    let sentMediaBytes = parseInt(localStorage.getItem('hotmapp_net_sent_media') || '5324800'); // ~5.1 MB
    let rcvdMediaBytes = parseInt(localStorage.getItem('hotmapp_net_received_media') || '14889700'); // ~14.2 MB
    let statusSent = parseInt(localStorage.getItem('hotmapp_net_sent_status') || '14');
    let statusRcvd = parseInt(localStorage.getItem('hotmapp_net_received_status') || '128');

    return {
        messages: { title: 'Messages', icon: 'fa-message', sentText: `${sentMsgs} sent`, rcvdText: `${rcvdMsgs} received`, sentVal: sentMsgs, rcvdVal: rcvdMsgs, total: sentMsgs + rcvdMsgs },
        calls: { title: 'Calls', icon: 'fa-phone', sentText: formatBytes(sentCallBytes), rcvdText: formatBytes(rcvdCallBytes), sentVal: sentCallBytes, rcvdVal: rcvdCallBytes, total: sentCallBytes + rcvdCallBytes },
        media: { title: 'Media', icon: 'fa-photo-film', sentText: formatBytes(sentMediaBytes), rcvdText: formatBytes(rcvdMediaBytes), sentVal: sentMediaBytes, rcvdVal: rcvdMediaBytes, total: sentMediaBytes + rcvdMediaBytes },
        status: { title: 'Status', icon: 'fa-circle-notch', sentText: `${statusSent} sent`, rcvdText: `${statusRcvd} received`, sentVal: statusSent, rcvdVal: statusRcvd, total: statusSent + statusRcvd },
    };
};

const saveNetworkStats = (stats) => {
    localStorage.setItem('hotmapp_net_sent_msgs', stats.messages.sentVal);
    localStorage.setItem('hotmapp_net_received_msgs', stats.messages.rcvdVal);
    localStorage.setItem('hotmapp_net_sent_calls', stats.calls.sentVal);
    localStorage.setItem('hotmapp_net_received_calls', stats.calls.rcvdVal);
    localStorage.setItem('hotmapp_net_sent_media', stats.calls.sentVal);
    localStorage.setItem('hotmapp_net_received_media', stats.calls.rcvdVal);
    localStorage.setItem('hotmapp_net_sent_status', stats.status.sentVal);
    localStorage.setItem('hotmapp_net_received_status', stats.status.rcvdVal);
};

const renderNetworkUsage = () => {
    const container = elements.networkUsageList;
    if (!container) return;

    const stats = getNetworkStats();

    container.innerHTML = Object.values(stats).map(stat => {
        // Calculate progress bars percentages
        const total = stat.total || 1;
        const sentPercent = (stat.sentVal / total) * 100;
        const rcvdPercent = (stat.rcvdVal / total) * 100;

        return `
            <div class="network-usage-card">
                <i class="fa-solid ${stat.icon}"></i>
                <div class="network-usage-info">
                    <div class="network-usage-title">${stat.title}</div>
                    <div class="network-usage-details">
                        <span>Sent: ${stat.sentText}</span>
                        <span>Received: ${stat.rcvdText}</span>
                    </div>
                    <div class="network-usage-stats-bar">
                        <div class="network-usage-sent-bar" style="width: ${sentPercent}%;"></div>
                        <div class="network-usage-received-bar" style="width: ${rcvdPercent}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const resetNetworkStats = () => {
    if (!confirm("Are you sure you want to reset all network usage statistics? This will reset your stats to 0.")) return;
    
    localStorage.setItem('hotmapp_net_sent_msgs', '0');
    localStorage.setItem('hotmapp_net_received_msgs', '0');
    localStorage.setItem('hotmapp_net_sent_calls', '0');
    localStorage.setItem('hotmapp_net_received_calls', '0');
    localStorage.setItem('hotmapp_net_sent_media', '0');
    localStorage.setItem('hotmapp_net_received_media', '0');
    localStorage.setItem('hotmapp_net_sent_status', '0');
    localStorage.setItem('hotmapp_net_received_status', '0');

    renderNetworkUsage();
    calculateStorageStats();
    showToast("Network statistics reset", "success");
};

// AUTO-DOWNLOAD SETTINGS
const loadAutoDownloadSettings = () => {
    const mobile = JSON.parse(localStorage.getItem('hotmapp_auto_download_mobile') || '["photos"]');
    const wifi = JSON.parse(localStorage.getItem('hotmapp_auto_download_wifi') || '["photos", "audio", "videos", "documents"]');
    const roaming = JSON.parse(localStorage.getItem('hotmapp_auto_download_roaming') || '[]');

    const formatDesc = (opts) => {
        if (opts.length === 0) return 'No media';
        if (opts.length === 4) return 'All media';
        return opts.map(o => o.charAt(0).toUpperCase() + o.slice(1)).join(', ');
    };

    const mobileDesc = document.querySelector('[data-ui="auto-download-mobile-desc"]');
    const wifiDesc = document.querySelector('[data-ui="auto-download-wifi-desc"]');
    const roamingDesc = document.querySelector('[data-ui="auto-download-roaming-desc"]');

    if (mobileDesc) mobileDesc.textContent = formatDesc(mobile);
    if (wifiDesc) wifiDesc.textContent = formatDesc(wifi);
    if (roamingDesc) roamingDesc.textContent = formatDesc(roaming);
};

const openAutoDownloadDialog = (type) => {
    currentAutoDownloadType = type;
    const titleEl = elements.autoDownloadTitle;
    if (titleEl) {
        titleEl.textContent = type === 'mobile' ? 'When using mobile data' : (type === 'wifi' ? 'When connected on Wi-Fi' : 'When roaming');
    }

    const saved = JSON.parse(localStorage.getItem(`hotmapp_auto_download_${type}`) || (type === 'wifi' ? '["photos","audio","videos","documents"]' : (type === 'mobile' ? '["photos"]' : '[]')));
    
    // Check checkboxes accordingly
    const checklist = elements.autoDownloadOptions.querySelectorAll('input[type="checkbox"]');
    checklist.forEach(cb => {
        cb.checked = saved.includes(cb.value);
    });

    showElement(elements.autoDownloadModal, 'flex');
};

const saveAutoDownloadSettings = () => {
    const checklist = elements.autoDownloadOptions.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checklist.forEach(cb => {
        if (cb.checked) selected.push(cb.value);
    });

    localStorage.setItem(`hotmapp_auto_download_${currentAutoDownloadType}`, JSON.stringify(selected));
    loadAutoDownloadSettings();
    hideElement(elements.autoDownloadModal);
    showToast("Preferences saved", "success");
};

// MEDIA UPLOAD QUALITY
const loadUploadQualitySettings = () => {
    const quality = localStorage.getItem('hotmapp_media_upload_quality') || 'auto';
    const labelMap = {
        auto: 'Auto (recommended)',
        best: 'Best quality',
        saver: 'Data saver'
    };

    const desc = document.querySelector('[data-ui="upload-quality-desc"]');
    if (desc) desc.textContent = labelMap[quality];
};

const openUploadQualityDialog = () => {
    const current = localStorage.getItem('hotmapp_media_upload_quality') || 'auto';
    const radios = elements.uploadQualityModal.querySelectorAll('input[name="upload-quality"]');
    
    radios.forEach(r => {
        r.checked = r.value === current;
    });

    showElement(elements.uploadQualityModal, 'flex');
};

const saveUploadQualitySettings = () => {
    const radios = elements.uploadQualityModal.querySelectorAll('input[name="upload-quality"]');
    let selected = 'auto';
    
    radios.forEach(r => {
        if (r.checked) selected = r.value;
    });

    localStorage.setItem('hotmapp_media_upload_quality', selected);
    loadUploadQualitySettings();
    hideElement(elements.uploadQualityModal);
    showToast("Preferences saved", "success");
};

// PROXY SETTINGS
const loadProxySettings = () => {
    const proxy = JSON.parse(localStorage.getItem('hotmapp_proxy_settings') || '{"enabled":false,"host":"","port":"","username":"","password":""}');
    const desc = document.querySelector('[data-ui="proxy-settings-desc"]');
    if (desc) {
        desc.textContent = proxy.enabled ? `Enabled (${proxy.host}:${proxy.port})` : 'Off';
    }

    if (elements.proxyEnabledCheckbox) {
        elements.proxyEnabledCheckbox.checked = proxy.enabled;
    }
    if (elements.proxyHostInput) elements.proxyHostInput.value = proxy.host || '';
    if (elements.proxyPortInput) elements.proxyPortInput.value = proxy.port || '';
    if (elements.proxyUsernameInput) elements.proxyUsernameInput.value = proxy.username || '';
    if (elements.proxyPasswordInput) elements.proxyPasswordInput.value = proxy.password || '';

    const fields = document.getElementById('proxy-fields');
    if (fields) {
        fields.style.display = proxy.enabled ? 'flex' : 'none';
    }
};

const openProxySettingsDialog = () => {
    loadProxySettings();
    showElement(elements.proxySettingsModal, 'flex');
};

const handleProxySubmit = (e) => {
    e.preventDefault();
    const enabled = elements.proxyEnabledCheckbox?.checked || false;
    const host = elements.proxyHostInput?.value.trim() || '';
    const port = elements.proxyPortInput?.value.trim() || '';
    const username = elements.proxyUsernameInput?.value.trim() || '';
    const password = elements.proxyPasswordInput?.value || '';

    if (enabled && (!host || !port)) {
        showToast("Host and Port are required to enable proxy", "warning");
        return;
    }

    const proxyData = { enabled, host, port, username, password };
    localStorage.setItem('hotmapp_proxy_settings', JSON.stringify(proxyData));
    loadProxySettings();
    hideElement(elements.proxySettingsModal);
    showToast("Proxy settings saved", "success");
};

// INITIALIZE MODULE
export const initStorageSettings = () => {
    // 1. Initial configuration loading
    loadAutoDownloadSettings();
    loadUploadQualitySettings();
    loadProxySettings();

    const useLess = localStorage.getItem('hotmapp_use_less_data_calls') === 'true';
    if (elements.useLessDataCallsCheckbox) {
        elements.useLessDataCallsCheckbox.checked = useLess;
    }

    // 2. Main Open Settings Button Click
    elements.settingsStorageDataBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        showElement(elements.storageSettingsModal, 'flex');
        showToast("Calculating storage stats...", "info");
        await calculateStorageStats();
    });

    // 3. Close Button click triggers
    const closeStorageModal = () => {
        hideElement(elements.storageSettingsModal);
        showElement(elements.settingsModal, 'flex');
    };

    elements.closeStorageSettingsModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeStorageModal();
    });

    elements.storageSettingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.storageSettingsModal) {
            closeStorageModal();
        }
    });

    // 4. Sub-modals Navigation: Manage Storage
    elements.manageStorageBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.storageSettingsModal);
        updateStorageDashboardUI();
        showElement(elements.manageStorageModal, 'flex');
    });

    const closeManageStorage = () => {
        hideElement(elements.manageStorageModal);
        showElement(elements.storageSettingsModal, 'flex');
    };

    elements.closeManageStorageModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeManageStorage();
    });

    elements.manageStorageModal?.addEventListener('click', (e) => {
        if (e.target === elements.manageStorageModal) {
            closeManageStorage();
        }
    });

    // Clicking a Chat row inside Manage Storage lists
    elements.manageStorageChatsList?.addEventListener('click', (e) => {
        const row = e.target.closest('.storage-chat-row');
        if (!row) return;

        const otherUid = row.dataset.uid;
        const chatId = row.dataset.chatId;
        const chatData = chatsStorageData.find(c => c.chatId === chatId);

        if (chatData) {
            openChatStorageView(chatData.name, chatId, otherUid, chatData.messages);
        }
    });

    // Review Large Files trigger (>5MB)
    elements.manageStorageReview5mb?.addEventListener('click', (e) => {
        e.preventDefault();
        if (largeFiles.length === 0) {
            showToast("No files larger than 5 MB found", "info");
            return;
        }
        openChatStorageView("Files Larger than 5 MB", activeStorageChatId || 'all_chats', 'all', largeFiles);
    });

    // Close Chat Storage sub-modal
    const closeChatStorage = () => {
        hideElement(elements.chatStorageViewModal);
        showElement(elements.manageStorageModal, 'flex');
    };

    elements.closeChatStorageViewBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeChatStorage();
    });

    elements.chatStorageViewModal?.addEventListener('click', (e) => {
        if (e.target === elements.chatStorageViewModal) {
            closeChatStorage();
        }
    });

    // Multi-select & delete handlers for media grid
    elements.chatStorageMediaGrid?.addEventListener('click', handleMediaGridClick);
    elements.chatStorageSelectAllBtn?.addEventListener('change', handleSelectAllMedia);
    elements.chatStorageDeleteBtn?.addEventListener('click', executeMediaDeletion);

    // 5. Network Usage Modal Toggle
    elements.networkUsageBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.storageSettingsModal);
        renderNetworkUsage();
        showElement(elements.networkUsageModal, 'flex');
    });

    const closeNetworkUsage = () => {
        hideElement(elements.networkUsageModal);
        showElement(elements.storageSettingsModal, 'flex');
    };

    elements.closeNetworkUsageModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeNetworkUsage();
    });

    elements.networkUsageModal?.addEventListener('click', (e) => {
        if (e.target === elements.networkUsageModal) {
            closeNetworkUsage();
        }
    });

    elements.resetNetworkStatsBtn?.addEventListener('click', resetNetworkStats);

    // 6. Use Less Data toggle
    elements.useLessDataCallsCheckbox?.addEventListener('change', (e) => {
        localStorage.setItem('hotmapp_use_less_data_calls', e.target.checked ? 'true' : 'false');
        showToast("Call data preference updated", "success");
    });

    // 7. Auto-download dialog triggers
    elements.autoDownloadMobileBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openAutoDownloadDialog('mobile');
    });
    elements.autoDownloadWifiBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openAutoDownloadDialog('wifi');
    });
    elements.autoDownloadRoamingBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openAutoDownloadDialog('roaming');
    });

    document.querySelectorAll('[data-ui="close-auto-download-modal"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            hideElement(elements.autoDownloadModal);
        });
    });

    elements.autoDownloadModal?.addEventListener('click', (e) => {
        if (e.target === elements.autoDownloadModal) {
            hideElement(elements.autoDownloadModal);
        }
    });

    elements.saveAutoDownloadBtn?.addEventListener('click', saveAutoDownloadSettings);

    // 8. Upload quality dialog triggers
    elements.uploadQualityBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openUploadQualityDialog();
    });

    document.querySelectorAll('[data-ui="close-upload-quality-modal"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            hideElement(elements.uploadQualityModal);
        });
    });

    elements.uploadQualityModal?.addEventListener('click', (e) => {
        if (e.target === elements.uploadQualityModal) {
            hideElement(elements.uploadQualityModal);
        }
    });

    elements.saveUploadQualityBtn?.addEventListener('click', saveUploadQualitySettings);

    // 9. Proxy settings toggles & form submit
    elements.proxySettingsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openProxySettingsDialog();
    });

    document.querySelectorAll('[data-ui="close-proxy-settings-modal"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            hideElement(elements.proxySettingsModal);
        });
    });

    elements.proxySettingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.proxySettingsModal) {
            hideElement(elements.proxySettingsModal);
        }
    });

    elements.proxyEnabledCheckbox?.addEventListener('change', (e) => {
        const fields = document.getElementById('proxy-fields');
        if (fields) {
            fields.style.display = e.target.checked ? 'flex' : 'none';
        }
    });

    document.getElementById('proxy-settings-form')?.addEventListener('submit', handleProxySubmit);

    // 10. Automatically sync/increment message count
    subscribeToAuthChanges((user) => {
        if (user) {
            // Recalculate stats occasionally
            calculateStorageStats().catch(() => {});
        }
    });
};
