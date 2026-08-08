import { elements } from './elements.js';
import { auth } from './firebase-config.js';
import { getUserProfile, updateUserProfile, uploadFile, deleteFile, getOrCreateInvitation, revokeAndGenerateInviteToken, getPlatformAnalytics } from './database-service.js?v=1.1.4';
import { showToast } from './toast.js';
import { hideElement, showElement, getAvatarUrl, compressImage, cropToSquare } from './utils.js';
import { subscribeToAuthChanges } from './auth-service.js';

export const initProfile = () => {
    const DEFAULT_SENT_COLOR = '#dcf8c6';
    const DEFAULT_RECEIVED_COLOR = '#ffffff';
    const DEFAULT_SEND_ON_ENTER = false;
    const DEFAULT_MESSAGE_FONT_SIZE = 18;
    const DEFAULT_SENT_TEXT_COLOR = '#000000';
    const DEFAULT_RECEIVED_TEXT_COLOR = '#000000';
    let openedFromSettings = false;

    const updateDeleteButtonVisibility = () => {
        const previewSrc = elements.profilePhotoPreview?.src || '';
        const isAvatar = previewSrc.includes('ui-avatars.com') || previewSrc === '';
        if (elements.deleteProfilePhotoBtn) {
            elements.deleteProfilePhotoBtn.style.display = isAvatar ? 'none' : 'inline-block';
        }
    };

    if (elements.profilePhotoPreview) {
        const observer = new MutationObserver(() => {
            updateDeleteButtonVisibility();
        });
        observer.observe(elements.profilePhotoPreview, { attributes: true, attributeFilter: ['src'] });
    }

    // Dynamically create and inject the "Refresh Location Data" button into the settings modal
    const settingsMenuList = elements.settingsModal?.querySelector('.settings-menu-list');
    if (settingsMenuList && !document.querySelector('[data-ui="refresh-location-cache-btn"]')) {
        const refreshButton = document.createElement('button');
        refreshButton.className = 'settings-menu-item';
        refreshButton.setAttribute('data-ui', 'refresh-location-cache-btn');
        refreshButton.innerHTML = `
            <i class="fa-solid fa-globe-americas"></i>
            <span>Refresh Location Data</span>
        `;
        
        // Find the "Help" button to insert the new button before it
        const helpButton = settingsMenuList.querySelector('[data-i18n="help"]')?.closest('.settings-menu-item');
        if (helpButton) {
            settingsMenuList.insertBefore(refreshButton, helpButton);
        } else {
            // Fallback to appending at the end if help button isn't found
            settingsMenuList.appendChild(refreshButton);
        }

        // Now that the element is in the DOM, elements.refreshLocationCacheBtn will find it.
    }

    // Dynamically create and inject the "Theme" button into the settings modal
    if (settingsMenuList && !document.querySelector('[data-ui="settings-theme-btn"]')) {
        const themeButton = document.createElement('button');
        themeButton.className = 'settings-menu-item';
        themeButton.setAttribute('data-ui', 'settings-theme-btn');
        themeButton.innerHTML = `
            <i class="fa-solid fa-palette"></i>
            <span data-i18n="theme">Theme</span>
        `;
        const langButton = settingsMenuList.querySelector('[data-ui="settings-app-language-btn"]');
        if (langButton) {
            settingsMenuList.insertBefore(themeButton, langButton);
        } else {
            settingsMenuList.appendChild(themeButton);
        }
    }

    // Dynamically create and inject the Theme selection modal
    if (!document.querySelector('[data-ui="theme-modal"]')) {
        const themeModalHtml = `
            <div class="modal-overlay" data-ui="theme-modal" style="display: none;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Theme</h3>
                        <button class="close-modal" data-ui="close-theme-modal">&times;</button>
                    </div>
                    <p style="color: var(--muted); font-size: 0.9rem; margin-top: 0;">Choose your preferred appearance.</p>
                    <div class="theme-options-list" data-ui="theme-options-list" style="display: flex; flex-direction: column; gap: 10px;">
                        <label class="settings-menu-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;">
                            <span><i class="fa-solid fa-desktop" style="margin-right: 8px;"></i> System Default</span>
                            <input type="radio" name="app-theme-opt" value="system" style="width: 20px; height: 20px; accent-color: var(--brand);">
                        </label>
                        <label class="settings-menu-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;">
                            <span><i class="fa-solid fa-sun" style="margin-right: 8px;"></i> Light</span>
                            <input type="radio" name="app-theme-opt" value="light" style="width: 20px; height: 20px; accent-color: var(--brand);">
                        </label>
                        <label class="settings-menu-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;">
                            <span><i class="fa-solid fa-moon" style="margin-right: 8px;"></i> Dark</span>
                            <input type="radio" name="app-theme-opt" value="dark" style="width: 20px; height: 20px; accent-color: var(--brand);">
                        </label>
                        <label class="settings-menu-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;">
                            <span><i class="fa-solid fa-mobile-screen" style="margin-right: 8px;"></i> OLED (True Black)</span>
                            <input type="radio" name="app-theme-opt" value="oled" style="width: 20px; height: 20px; accent-color: var(--brand);">
                        </label>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', themeModalHtml);
    }

    const applyTheme = (theme) => {
        let finalTheme = theme;
        if (theme === 'system') {
            // Treat system default as the app's default theme (light) on all devices.
            finalTheme = 'light';
        }

        document.body.classList.remove('dark-theme', 'oled-theme');
        if (finalTheme === 'dark') {
            document.body.classList.add('dark-theme');
        } else if (finalTheme === 'oled') {
            document.body.classList.add('oled-theme');
        }
    };

    const applyChatBackground = (settings) => {
        const container = elements.messagesContainer;
        if (!container) return;

        const backgroundColor = settings?.backgroundColor || '';

        container.style.setProperty('--chat-bg', backgroundColor || 'var(--bg)');
        container.style.setProperty('--chat-custom-bg', 'none');
        container.style.setProperty('--chat-pattern-opacity', '0');
        container.style.setProperty('--chat-bg-blur', '0px');

        if (elements.chatBgColorPicker) {
            elements.chatBgColorPicker.value = backgroundColor || '#ffffff';
        }
    };

    // Listen for OS theme changes to apply them if the user explicitly chose 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const savedTheme = localStorage.getItem('appTheme');
        if (savedTheme === 'system') applyTheme('system');
    });

    /** Applies bubble colors to CSS variables */
    const applyBubbleTheme = (settings) => {
        const sent = settings?.sentColor || DEFAULT_SENT_COLOR;
        const received = settings?.receivedColor || DEFAULT_RECEIVED_COLOR;
        const sentText = settings?.sentTextColor || 'var(--text)';
        const receivedText = settings?.receivedTextColor || 'var(--text)';

        document.documentElement.style.setProperty('--wa-sent', sent);
        document.documentElement.style.setProperty('--wa-received', received);
        document.documentElement.style.setProperty('--wa-sent-text', sentText);
        document.documentElement.style.setProperty('--wa-received-text', receivedText);
    };

    const applyMessageSettings = (settings = {}) => {
        const fontSize = Number(settings?.fontSize || DEFAULT_MESSAGE_FONT_SIZE);
        const clampedFontSize = Math.min(40, Math.max(12, fontSize));
        document.documentElement.style.setProperty('--chat-message-font-size', `${clampedFontSize}px`);

        if (elements.chatMessageFontSizeSlider) elements.chatMessageFontSizeSlider.value = clampedFontSize;
        if (elements.chatMessageFontSizeValue) elements.chatMessageFontSizeValue.textContent = clampedFontSize;
    };

    // Load and apply saved bubble colors on startup
    const savedBubbleSettings = JSON.parse(localStorage.getItem('hotmapp_bubble_settings') || '{}');
    applyBubbleTheme(savedBubbleSettings);

    // Load and apply saved message settings on startup
    const savedMessageSettings = JSON.parse(localStorage.getItem('hotmapp_chat_message_settings') || '{}');
    applyMessageSettings(savedMessageSettings);

    const initChatSettings = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const profile = await getUserProfile(user.uid);
        const bubbleSettings = profile?.chatBubbleSettings || {};
        const messageSettings = profile?.chatMessageSettings || {};

        if (elements.sentBubbleColorPicker) elements.sentBubbleColorPicker.value = bubbleSettings.sentColor || DEFAULT_SENT_COLOR;
        if (elements.receivedBubbleColorPicker) elements.receivedBubbleColorPicker.value = bubbleSettings.receivedColor || DEFAULT_RECEIVED_COLOR;
        if (elements.sentBubbleTextColorPicker) elements.sentBubbleTextColorPicker.value = bubbleSettings.sentTextColor || DEFAULT_SENT_TEXT_COLOR;
        if (elements.receivedBubbleTextColorPicker) elements.receivedBubbleTextColorPicker.value = bubbleSettings.receivedTextColor || DEFAULT_RECEIVED_TEXT_COLOR;
        if (elements.sendOnEnterCheckbox) elements.sendOnEnterCheckbox.checked = messageSettings.sendOnEnter === true;
        applyMessageSettings(messageSettings);
        
        applyBubbleTheme(bubbleSettings);

        // Also load chat background settings
        const bgSettings = profile?.chatBackgroundSettings || {};
        applyChatBackground(bgSettings);
    };

    elements.saveChatSettingsBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const backgroundSettings = {
            backgroundColor: elements.chatBgColorPicker?.value || ''
        };

        const chatBubbleSettings = {
            sentColor: elements.sentBubbleColorPicker.value,
            receivedColor: elements.receivedBubbleColorPicker.value,
            sentTextColor: elements.sentBubbleTextColorPicker?.value || '',
            receivedTextColor: elements.receivedBubbleTextColorPicker?.value || ''
        };

        const chatMessageSettings = {
            sendOnEnter: elements.sendOnEnterCheckbox?.checked ?? DEFAULT_SEND_ON_ENTER,
            fontSize: Number(elements.chatMessageFontSizeSlider?.value || DEFAULT_MESSAGE_FONT_SIZE)
        };

        try {
            await updateUserProfile(user.uid, { chatBubbleSettings, chatBackgroundSettings: backgroundSettings, chatMessageSettings });

            localStorage.setItem('hotmapp_chat_bg_settings', JSON.stringify(backgroundSettings));
            applyChatBackground(backgroundSettings);
            localStorage.setItem('hotmapp_bubble_settings', JSON.stringify(chatBubbleSettings));
            applyBubbleTheme(chatBubbleSettings);
            localStorage.setItem('hotmapp_chat_message_settings', JSON.stringify(chatMessageSettings));
            applyMessageSettings(chatMessageSettings);
            showToast("Chat settings updated!", "success");
            hideElement(elements.chatSettingsModal);
        } catch (err) {
            showToast("Failed to save settings", "error");
        }
    });

    elements.resetMessageFontBtn?.addEventListener('click', () => {
        applyMessageSettings({ fontSize: DEFAULT_MESSAGE_FONT_SIZE });
        localStorage.setItem('hotmapp_chat_message_settings', JSON.stringify({
            sendOnEnter: elements.sendOnEnterCheckbox?.checked ?? DEFAULT_SEND_ON_ENTER,
            fontSize: DEFAULT_MESSAGE_FONT_SIZE
        }));
        showToast("Message font size reset to default", "info");
    });

    elements.resetChatColorsBtn?.addEventListener('click', () => {
        if (elements.sentBubbleColorPicker) elements.sentBubbleColorPicker.value = DEFAULT_SENT_COLOR;
        if (elements.receivedBubbleColorPicker) elements.receivedBubbleColorPicker.value = DEFAULT_RECEIVED_COLOR;
            if (elements.sentBubbleTextColorPicker) elements.sentBubbleTextColorPicker.value = DEFAULT_SENT_TEXT_COLOR;
            if (elements.receivedBubbleTextColorPicker) elements.receivedBubbleTextColorPicker.value = DEFAULT_RECEIVED_TEXT_COLOR;
            if (elements.chatBgColorPicker) elements.chatBgColorPicker.value = '#ffffff';
            applyBubbleTheme({
                sentColor: DEFAULT_SENT_COLOR,
                receivedColor: DEFAULT_RECEIVED_COLOR,
                sentTextColor: DEFAULT_SENT_TEXT_COLOR,
                receivedTextColor: DEFAULT_RECEIVED_TEXT_COLOR
            });
            applyChatBackground({ backgroundColor: '#ffffff' });
            applyMessageSettings({ fontSize: DEFAULT_MESSAGE_FONT_SIZE });
            localStorage.removeItem('hotmapp_chat_bg_settings');

            localStorage.removeItem('hotmapp_bubble_settings');
            localStorage.setItem('hotmapp_chat_message_settings', JSON.stringify({ sendOnEnter: DEFAULT_SEND_ON_ENTER, fontSize: DEFAULT_MESSAGE_FONT_SIZE }));
            showToast("Chat settings reset to default", "info");
        });
    // Chat Background Settings Handlers
    // Live update for chat background color picker
    elements.chatBgColorPicker?.addEventListener('input', (e) => {
        const color = e.target.value;
        const container = elements.messagesContainer;
        if (container) container.style.setProperty('--chat-bg', color);
    });

    elements.sentBubbleTextColorPicker?.addEventListener('input', (e) => {
        const color = e.target.value;
        document.documentElement.style.setProperty('--wa-sent-text', color);
    });

    elements.receivedBubbleTextColorPicker?.addEventListener('input', (e) => {
        const color = e.target.value;
        document.documentElement.style.setProperty('--wa-received-text', color);
    });

    elements.chatMessageFontSizeSlider?.addEventListener('input', (e) => {
        const fontSize = Number(e.target.value || DEFAULT_MESSAGE_FONT_SIZE);
        if (elements.chatMessageFontSizeValue) elements.chatMessageFontSizeValue.textContent = fontSize;
        document.documentElement.style.setProperty('--chat-message-font-size', `${fontSize}px`);
    });

    const openProfileModal = async (fromSettings = false) => {
        openedFromSettings = fromSettings;
        const user = auth.currentUser;
        if (!user) {
            showToast("Please sign in to view profile.", "error");
            return;
        }

        const profile = await getUserProfile(user.uid);
        if (profile) {
            if (elements.profileNameInput) elements.profileNameInput.value = profile.fullname || '';
            if (elements.profileNotificationsInput) elements.profileNotificationsInput.checked = profile.notificationSounds !== false;
            if (elements.profilePhotoPreview) {
                elements.profilePhotoPreview.src = getAvatarUrl(profile.fullname, profile.profilePhoto);
            }
        }
        showElement(elements.profileModal, 'flex');
        updateDeleteButtonVisibility();
    };

    elements.profileNav?.addEventListener('click', (e) => {
        e.preventDefault();
        openProfileModal(false);
    });

    elements.settingsProfileBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        openProfileModal(true);
    });

    elements.closeProfileModalBtn?.addEventListener('click', () => {
        hideElement(elements.profileModal);
        if (openedFromSettings) {
            showElement(elements.settingsModal, 'flex');
            openedFromSettings = false;
        }
    });

    elements.uploadProfilePhotoBtn?.addEventListener('click', () => {
        elements.profilePhotoInput?.click();
    });

    // Handle profile photo selection with Cropper.js modal
    // Handle profile photo selection with Cropper.js modal
    elements.profilePhotoInput?.addEventListener('change', async (e) => {
        console.log('Profile photo input change triggered');
        const file = e.target.files[0];
        if (!file) return;

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
            // Prevent history manager from automatically hiding the modal
            modal.dataset.skipPush = 'true';
            modal.style.display = 'flex';
            modal.style.zIndex = '10000'; // ensure modal appears above other elements
            console.log('Cropper modal displayed');
        } else {
            console.warn('Cropper modal not found');
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
            // Clear any stored blob on cancel
            if (elements.croppedBlob) delete elements.croppedBlob;
        };

        const confirmBtn = document.querySelector('[data-ui="cropper-confirm"]');
        const cancelBtn = document.querySelector('[data-ui="cropper-cancel"]');

        const controller = new AbortController();
        const { signal } = controller;

        confirmBtn?.addEventListener('click', async () => {
            console.log('Cropper confirm clicked');
            try {
                const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                // Show preview using object URL
                const previewUrl = URL.createObjectURL(blob);
                console.log('Preview URL:', previewUrl);
                if (elements.profilePhotoPreview) {
                    elements.profilePhotoPreview.src = previewUrl;
                    // Ensure the preview element is visible
                    elements.profilePhotoPreview.style.display = 'block';
                }
                // Store blob for upload
                elements.croppedBlob = blob;
                showToast('Image ready!', 'success');
            } catch (err) {
                console.error('Cropper error:', err);
                showToast('Error processing image.', 'error');
            }
            cleanup();
            controller.abort();
        }, { signal });

        // Cancel crop
        cancelBtn?.addEventListener('click', () => {
            console.log('Cropper cancel clicked');
            cleanup();
            controller.abort();
        }, { signal });

        e.target.value = '';
    });


    elements.captureProfilePhotoBtn?.addEventListener('click', () => {
        if (elements.cameraModal) elements.cameraModal.dataset.mode = 'photo-only';
        elements.cameraBtn?.click();
    });

    elements.deleteProfilePhotoBtn?.addEventListener('click', () => {
        if (elements.profilePhotoPreview) {
            const fullname = elements.profileNameInput?.value || '';
            elements.profilePhotoPreview.src = getAvatarUrl(fullname, '');
        }
    });

    // Allow clicking the preview to view full size in lightbox
    elements.profilePhotoPreview?.addEventListener('click', () => {
        if (elements.profilePhotoPreview.src) {
            hideElement(elements.profileModal);
            if (window.openLightboxImage) {
                window.openLightboxImage(elements.profilePhotoPreview.src);
            } else {
                elements.lightboxImage.src = elements.profilePhotoPreview.src;
                showElement(elements.lightboxModal, 'flex');
                hideElement(elements.lightboxPrev);
                hideElement(elements.lightboxNext);
            }
        }
    });

    elements.profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const btn = e.target.querySelector('button[type="submit"]');
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Saving...';
            }

            const fullname = elements.profileNameInput.value;
            let profilePhoto = elements.profilePhotoPreview.src;
            const notificationSounds = elements.profileNotificationsInput.checked;

            // If the user deleted the photo, the preview has ui-avatars.com URL. In this case, save empty string.
            if (profilePhoto.includes('ui-avatars.com')) {
                const oldProfile = await getUserProfile(user.uid);
                if (oldProfile && oldProfile.profilePhoto) {
                    await deleteFile(oldProfile.profilePhoto);
                }
                profilePhoto = '';
            }

            // If the photo is a new base64 image (DataURL) or a Blob URL, upload it to Storage first
            if (profilePhoto.startsWith('data:') || profilePhoto.startsWith('blob:')) {
                // Prefer the cropped blob stored during the Cropper step to avoid double cropping
                let blobToUpload;
                if (elements.croppedBlob) {
                    blobToUpload = elements.croppedBlob;
                    // Clear the temporary reference after use
                    delete elements.croppedBlob;
                } else {
                    // Fallback: fetch the blob from the URL (might be uncropped)
                    if (profilePhoto.startsWith('blob:')) {
                        const resp = await fetch(profilePhoto);
                        blobToUpload = await resp.blob();
                    } else {
                        // For a DataURL, convert to Blob via cropToSquare (which also crops/compresses)
                        blobToUpload = await cropToSquare(profilePhoto, 400, 0.85);
                    }
                }

                // Save directly to static path using user's UID to overwrite the previous avatar
                const path = `avatars/${user.uid}.jpg`;
                profilePhoto = await uploadFile(path, blobToUpload);
            }

            await updateUserProfile(user.uid, { fullname, profilePhoto, notificationSounds });
            showToast("Profile updated successfully!", "success");
            hideElement(elements.profileModal);
            
            // Refresh the page to ensure all UI components load the updated profile data
            window.location.reload();
            
        } catch (error) {
            console.error("Profile Save Error:", error);
            showToast("Error updating profile.", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Save Changes';
            }
        }
    });

    elements.refreshLocationCacheBtn?.addEventListener('click', async () => {
        if (confirm("This will clear cached country, state, and city data and re-fetch it. Continue?")) {
            const { clearLocationCacheAndRefresh } = await import('./store.js');
            await clearLocationCacheAndRefresh();
        }
    });

    // Theme Modal Handlers
    elements.settingsThemeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        const currentTheme = localStorage.getItem('appTheme') || 'system';
        const themeRadios = document.querySelectorAll('input[name="app-theme-opt"]');
        themeRadios.forEach(radio => {
            radio.checked = radio.value === currentTheme;
        });
        showElement(elements.themeModal, 'flex');
    });

    const closeThemeModal = () => {
        hideElement(elements.themeModal);
        showElement(elements.settingsModal, 'flex');
    };

    document.querySelector('[data-ui="close-theme-modal"]')?.addEventListener('click', closeThemeModal);
    elements.themeModal?.addEventListener('click', (e) => {
        if (e.target === elements.themeModal) closeThemeModal();
    });

    document.querySelector('[data-ui="theme-options-list"]')?.addEventListener('change', async (e) => {
        const selectedTheme = e.target.value;
        applyTheme(selectedTheme);
        localStorage.setItem('appTheme', selectedTheme);

        const user = auth.currentUser;
        if (user) {
            try {
                await updateUserProfile(user.uid, { theme: selectedTheme });
                showToast("Theme updated!", "success");
            } catch (err) {
                showToast("Failed to sync theme preference", "error");
            }
        }
        setTimeout(closeThemeModal, 200); // Close modal after selection
    });

    // Load initial settings when auth is ready
    subscribeToAuthChanges(async (user) => { 
        if (user) initChatSettings(); 
    });

    // Because some devices may default to dark mode system-wide, treat the first-run theme
    // as the app's explicit default (light) unless the user has manually chosen a theme.
    const savedTheme = localStorage.getItem('appTheme');
    const startupTheme = savedTheme || 'light';
    applyTheme(startupTheme);

    // Reload App Handler
    elements.settingsReloadAppBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        showToast("Reloading application...", "info");
        setTimeout(() => {
            window.location.reload(true);
        }, 800);
    });

    let currentInviteToken = '';

    const renderInviteLinkDetails = (inviteData) => {
        if (!inviteData) return;
        currentInviteToken = inviteData.token;
        const inviteLink = `https://hotmapp.com/invite?ref=${inviteData.token}`;
        
        if (elements.inviteLinkInput) elements.inviteLinkInput.value = inviteLink;
        
        // Update stats labels
        if (elements.inviteStatsRegistrations) elements.inviteStatsRegistrations.textContent = inviteData.successRegistrations || 0;
        if (elements.inviteStatsFriendships) elements.inviteStatsFriendships.textContent = inviteData.successFriendships || 0;
        if (elements.inviteStatsClicks) elements.inviteStatsClicks.textContent = inviteData.clicks || 0;

        // Generate QR Code
        if (elements.inviteQrCode) {
            elements.inviteQrCode.innerHTML = '';
            new QRCode(elements.inviteQrCode, {
                text: inviteLink,
                width: 170,
                height: 170,
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        // Set up sharing URLs
        const shareText = "Join me on HOTMAPP to chat and shop securely!";
        if (elements.shareWhatsappBtn) {
            elements.shareWhatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + inviteLink)}`;
        }
        if (elements.shareTelegramBtn) {
            elements.shareTelegramBtn.href = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
        }
        if (elements.shareEmailBtn) {
            elements.shareEmailBtn.href = `mailto:?subject=Join%20me%20on%20HOTMAPP!&body=${encodeURIComponent(shareText + '\n\n' + inviteLink)}`;
        }
    };

    // Invite Contact Modal Handlers
    elements.settingsInviteContactBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);

        try {
            showToast("Loading invitation link details...", "info");
            const inviteData = await getOrCreateInvitation(auth.currentUser.uid);
            renderInviteLinkDetails(inviteData);
            showElement(elements.inviteContactModal, 'flex');
        } catch (error) {
            console.error("Error displaying invite details:", error);
            showToast("Failed to load invitation details.", "error");
            showElement(elements.settingsModal, 'flex');
        }
    });

    elements.generateNewInviteBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm("Are you sure you want to generate a new invitation link? The previous link will be revoked and become invalid.")) {
            return;
        }

        try {
            elements.generateNewInviteBtn.disabled = true;
            elements.generateNewInviteBtn.innerHTML = '<span class="spinner" style="border-top-color:var(--text); width:12px; height:12px; margin:0 6px 0 0;"></span> Generating...';
            
            const newInviteData = await revokeAndGenerateInviteToken(auth.currentUser.uid, currentInviteToken);
            renderInviteLinkDetails(newInviteData);
            showToast("New invite link generated successfully!", "success");
        } catch (error) {
            console.error("Error generating new invite:", error);
            showToast("Failed to generate new invite link.", "error");
        } finally {
            elements.generateNewInviteBtn.disabled = false;
            elements.generateNewInviteBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="margin-right: 6px;"></i> Generate New Link';
        }
    });

    const closeInviteModal = () => {
        hideElement(elements.inviteContactModal);
        showElement(elements.settingsModal, 'flex');
    };

    elements.closeInviteContactModalBtn?.addEventListener('click', closeInviteModal);
    elements.inviteContactModal?.addEventListener('click', (e) => {
        if (e.target === elements.inviteContactModal) closeInviteModal();
    });

    elements.copyInviteLinkBtn?.addEventListener('click', () => {
        const link = elements.inviteLinkInput?.value;
        if (link) {
            navigator.clipboard.writeText(link).then(() => {
                showToast("Invite link copied to clipboard!", "success");
            }).catch(err => {
                console.error("Failed to copy link:", err);
                showToast("Failed to copy link", "error");
            });
        }
    });

    // Admin Analytics Modal Handlers
    const loadPlatformAnalytics = async () => {
        try {
            const data = await getPlatformAnalytics();

            const linksGenerated = data.totalLinksGenerated || 0;
            const clicks = data.totalClicks || 0;
            const registrations = data.totalRegistrations || 0;
            const downloads = data.androidDownloads || 0;
            const friendships = data.totalFriendships || 0;

            const conversionRate = clicks > 0 ? Math.round((friendships / clicks) * 100) : 0;

            const updateVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            updateVal('analytics-links-generated', linksGenerated);
            updateVal('analytics-clicks', clicks);
            updateVal('analytics-web-registrations', registrations);
            updateVal('analytics-android-downloads', downloads);
            updateVal('analytics-friendships', friendships);
            updateVal('analytics-conversion-rate', `${conversionRate}%`);
        } catch (error) {
            console.error("Failed to load platform analytics:", error);
            showToast("Error loading analytics statistics", "error");
        }
    };

    elements.settingsAdminAnalyticsBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        showToast("Fetching analytics...", "info");
        await loadPlatformAnalytics();
        showElement(elements.adminAnalyticsModal, 'flex');
    });

    elements.refreshAnalyticsBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        elements.refreshAnalyticsBtn.disabled = true;
        elements.refreshAnalyticsBtn.innerHTML = '<span class="spinner" style="border-top-color:white; width:12px; height:12px; margin:0 6px 0 0;"></span> Refreshing...';
        await loadPlatformAnalytics();
        showToast("Analytics refreshed!", "success");
        elements.refreshAnalyticsBtn.disabled = false;
        elements.refreshAnalyticsBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="margin-right: 6px;"></i> Refresh Stats';
    });

    const closeAdminAnalyticsModal = () => {
        hideElement(elements.adminAnalyticsModal);
        showElement(elements.settingsModal, 'flex');
    };

    elements.closeAdminAnalyticsModalBtn?.addEventListener('click', closeAdminAnalyticsModal);
    elements.adminAnalyticsModal?.addEventListener('click', (e) => {
        if (e.target === elements.adminAnalyticsModal) closeAdminAnalyticsModal();
    });
};