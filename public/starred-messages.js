import { elements } from './elements.js';
import { auth } from './firebase-config.js';
import { getStarredMessages, clearAllStarredMessages, getUserProfile } from './database-service.js?v=1.1.8';
import { showToast } from './toast.js';
import { getOrDeriveSharedKey, decryptText } from './crypto-helper.js';

export const initStarredMessages = () => {
    const loadStarredMessages = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const starred = await getStarredMessages(user.uid);
        const list = elements.starredMessagesList;
        if (!list) return;

        const starredArray = Object.values(starred).sort((a, b) => 
            new Date(b.starredAt) - new Date(a.starredAt)
        );

        if (starredArray.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">No starred messages yet.</div>';
            if (elements.unstarAllBtn) elements.unstarAllBtn.style.display = 'none';
        } else {
            list.innerHTML = starredArray.map((msg, index) => {
                const isPending = msg.status === 'pending' || (msg.id && msg.id.startsWith && msg.id.startsWith('pending_'));
                const preview = (msg.isEncrypted && msg.previewText && !msg.isDecrypted) ? (msg.previewText + ' <small style="opacity:0.65; font-size:0.75rem; margin-left:6px;">🔒</small>') : (msg.isEncrypted ? '🔒 [Encrypted Message]' : (msg.text || (msg.type === 'image' ? '📷 Image' : '📄 File')));
                const pendingIcon = isPending ? ' <span style="margin-left:6px; opacity:0.85;">⏳</span>' : '';
                return `
                <div class="starred-item" id="starred-item-${index}">
                    <div class="starred-item-text">${preview}${pendingIcon}</div>
                    <div class="starred-item-date">Starred on: ${new Date(msg.starredAt).toLocaleDateString()}</div>
                </div>
            `;
            }).join('');
            if (elements.unstarAllBtn) elements.unstarAllBtn.style.display = 'block';

            // Decrypt encrypted messages asynchronously
            starredArray.forEach(async (msg, index) => {
                if (msg.isEncrypted && msg.text && msg.iv) {
                    const otherUid = msg.chatId ? msg.chatId.split('_').find(id => id !== user.uid) : msg.senderId;
                    if (!otherUid) return;
                    try {
                        const otherProfile = await getUserProfile(otherUid);
                        if (otherProfile && otherProfile.publicKey) {
                            const sharedKey = await getOrDeriveSharedKey(user.uid, otherProfile.publicKey);
                            if (sharedKey) {
                                const decrypted = await decryptText(msg.text, msg.iv, sharedKey);
                                let decryptedText = decrypted;
                                try {
                                    const parsed = JSON.parse(decrypted);
                                    decryptedText = parsed.text || '';
                                } catch (e) {
                                    // Fallback to raw decrypted text
                                }
                                const itemEl = document.getElementById(`starred-item-${index}`);
                                if (itemEl) {
                                    const textEl = itemEl.querySelector('.starred-item-text');
                                    if (textEl) {
                                        textEl.textContent = decryptedText || (msg.type === 'image' ? '📷 Image' : '📄 File');
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Failed to decrypt starred message:", err);
                    }
                }
            });
        }
    };

    elements.starredNav?.addEventListener('click', () => {
        loadStarredMessages();
    });

    elements.unstarAllBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (confirm("Are you sure you want to unstar all messages?")) {
            try {
                await clearAllStarredMessages(user.uid);
                showToast("All messages unstarred", "success");
                loadStarredMessages();
            } catch (error) {
                console.error("Error clearing starred messages:", error);
                showToast("Failed to unstar messages", "error");
            }
        }
    });
};