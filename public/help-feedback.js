import { elements } from './elements.js';
import { showToast } from './toast.js';
import { auth } from './firebase-config.js';
import {
    uploadFile,
    submitSupportTicket,
    getSupportTicketsPage,
    submitProblemReport,
    submitFeedback,
    submitFeatureRequest,
    submitBugReport,
    getHelpSyncMetadata,
    getHelpArticlesFromDb,
    getFaqsFromDb
} from './database-service.js?v=1.1.6';

// Global State
let panelHistory = [];
let cachedArticles = [];
let cachedFaqs = [];
let currentCategoryFilter = 'All';
let selectedAttachmentFiles = {
    support: { image: null, video: null },
    report: { image: null, video: null },
    bug: { image: null, video: null }
};

// Pagination State for Tickets
let ticketsPageSize = 5;
let ticketsNextKey = null;
let ticketsPageHistory = [null]; // stack of startAt keys for back navigation
let ticketsCurrentPageIndex = 0;

// Local Caching Keys
const ARTICLES_CACHE_KEY = 'hotma_help_articles_cache';
const FAQS_CACHE_KEY = 'hotma_faqs_cache';
const SYNC_CACHE_KEY = 'hotma_help_sync_metadata';
const RECENT_VIEWED_KEY = 'hotma_recently_viewed_help';
const OFFLINE_QUEUE_KEY = 'hotma_offline_submissions_queue';

// Categories List
const HELP_CATEGORIES = [
    'Getting Started', 'Account', 'Chat', 'Business Registration',
    'Products', 'Marketplace', 'Orders', 'Checkout',
    'Payments', 'Invoices', 'Notifications', 'Privacy',
    'Security', 'Troubleshooting'
];

// Fallback Articles (Production-Ready Content)
const FALLBACK_ARTICLES = [
    { id: 'h_gs1', title: 'Welcome to HOTMAPP', category: 'Getting Started', content: 'Welcome to HOTMAPP, the secure messaging and business marketplace app. Get started by validating your profile, setting up your device encryption key, and finding contacts on the interactive map.' },
    { id: 'h_gs2', title: 'Linking a secondary device', category: 'Getting Started', content: 'To securely link a secondary device (desktop or tablet), navigate to Menu > Linked Devices. Click "Link New Device" on your main mobile app to scan the generated QR code. All session messages will sync securely.' },
    { id: 'h_acc1', title: 'Updating your profile name', category: 'Account', content: 'You can update your name under Settings > Account. Enter the new name and click Save Account Changes to apply.' },
    { id: 'h_acc2', title: 'Deleting your account metadata', category: 'Account', content: 'To delete your account permanently, go to Settings > Account and select "Delete Account". This cleans up your products, chats, and files, and deletes your auth details. This action is irreversible.' },
    { id: 'h_chat1', title: 'End-to-End Chat Encryption', category: 'Chat', content: 'All chat conversations are protected with End-to-End Encryption (E2EE). The keys are generated on your device and are never shared. You can view the safety codes under chat info.' },
    { id: 'h_chat2', title: 'Starred messages', category: 'Chat', content: 'To save important details, right-click (or long-press on mobile) any message and click "Star". You can access all starred items via the header options menu.' },
    { id: 'h_chat3', title: 'Editing Group Profile and Name', category: 'Chat', content: 'Group administrators can change the group profile photo and edit the group name directly inside the active chat window by tapping the edit controls next to the name or photo.' },
    { id: 'h_biz1', title: 'Setting up a seller shop', category: 'Business Registration', content: 'Navigate to Menu > Store. Fill out your store title, address, tags, and optional business logo to build your storefront header. You can also supply optional identity verification documents to receive a verified shop badge.' },
    { id: 'h_biz2', title: 'Shop presence toggle', category: 'Business Registration', content: 'You can temporarily hide your shop from the marketplace or toggle your opening hours directly within the shop profile parameters.' },
    { id: 'h_prod1', title: 'Adding products to inventory', category: 'Products', content: 'Open Store Inventory Management, click "Add Product", and supply the title, description, price, and images. The quantity fields support text labels, so you can write descriptions like "packs", "boxes", or "bottles" alongside numerical counts.' },
    { id: 'h_prod2', title: 'Managing inventory refresh', category: 'Products', content: 'If the store layout does not refresh automatically after updating items, click the manual Refresh (reload icon) button in the inventory header to pull fresh database states.' },
    { id: 'h_mkt1', title: 'Browsing the interactive map', category: 'Marketplace', content: 'Open the Map interface to find registered sellers nearby. Clicking a seller pin allows you to view their shop details, browse products, or start a secure chat conversation.' },
    { id: 'h_ord1', title: 'Placing an order', category: 'Orders', content: 'Browse a store, add items to your cart, click the Cart icon, verify delivery address parameters, and click "Checkout" to place your invoice order.' },
    { id: 'h_ord2', title: 'Confirming order receipt', category: 'Orders', content: 'When a buyer confirms order receipt, they toggle the invoice status to Confirmed. This immediately updates the invoice card layout and generates an order confirmation alert.' },
    { id: 'h_chk1', title: 'Address autocomplete', category: 'Checkout', content: 'During checkout, you can select "Structured Mode" to input street, city, state, and country details, which can be saved for future transactions.' },
    { id: 'h_pay1', title: 'Supported payment methods', category: 'Payments', content: 'HOTMAPP currently supports checkout invoices and cash on delivery or seller-specified local payment channels.' },
    { id: 'h_inv1', title: 'Chat invoice history tracker', category: 'Invoices', content: 'Click the Chat Header menu ellipsis and select "Invoices" to view a scrollable chronological record of all checkout invoices and PDF documents. You can use the search bar at the top of the modal to search invoices by order number, invoice ID, date, status, or file name.' },
    { id: 'h_inv2', title: 'Configuring notification sounds', category: 'Notifications', content: 'Go to Settings > Notifications. You can customize audio tones, volume sliders, vibration states, and popup indicators for new messages and calls.' },
    { id: 'h_priv1', title: 'Online presence privacy', category: 'Privacy', content: 'You can control who sees your online and last-seen presence indicators under Settings > Privacy. Options include Everyone, Contacts, or Nobody.' },
    { id: 'h_priv2', title: 'Blocking Contacts and Security', category: 'Privacy', content: 'To block a user, select "Block User" in the chat settings context menu. Blocking a user instantly hides your chat box and blocks them from writing messages to you at the database level.' },
    { id: 'h_sec1', title: 'Key mismatch alerts', category: 'Security', content: 'If a contact reinstalls HOTMAPP or links a new device, their E2EE key changes and you will see a security notification block. Scan their QR code to verify the new keys.' },
    { id: 'h_troub1', title: 'Resolving slow delivery speeds', category: 'Troubleshooting', content: 'If messages take time to deliver, check your network connection, toggle airplane mode, or click the "Refresh connection" button in Settings.' }
];

// Fallback FAQs
const FALLBACK_FAQS = [
    { question: 'How do I create a shop and upload a logo?', answer: 'Go to Settings > Shop Setup or click Register Business. Provide your store details and choose to upload a logo (this is optional). Click Save to register.' },
    { question: 'How do I specify packaging formats like packs or boxes in product quantity?', answer: 'When adding or editing a product, the quantity fields are text inputs. You can type descriptive quantities such as "10 packs" or "5 boxes" directly.' },
    { question: 'How do I search for a specific invoice in chat?', answer: 'Open the active chat, click the header menu icon, select "Invoices", and use the search bar at the top to filter invoices by date, ID, cost, or file name.' },
    { question: 'What happens when I block a user?', answer: 'Blocked users cannot send you messages. The chat input area is hidden from them, and the database automatically blocks incoming messages from blocked senders.' },
    { question: 'How can group admins change the group name or photo?', answer: 'Open the group chat, tap the group name header to view details, and click the edit controls next to the name or avatar photo to update them.' },
    { question: 'Why can\'t I send messages?', answer: 'Ensure you are online. If delivery fails, it may mean the recipient has blocked you, your chat privacy limits are active, or E2EE keys are out of sync.' }
];

/**
 * Initializes the Help & Feedback Center
 */
export const initHelpFeedback = () => {
    setupNavigation();
    setupAttachmentPickers();
    setupFormSubmissions();
    setupStarRating();
    setupHelpSearchAndFilters();
    setupOfflineQueueListener();

    // Attach click listener to settings help button
    elements.settingsHelpFeedbackBtn?.addEventListener('click', () => {
        openHelpFeedbackModal();
    });

    // Close Modal Button
    elements.closeHelpFeedbackModalBtn?.addEventListener('click', () => {
        closeHelpFeedbackModal();
    });
};

/**
 * Opens the main modal
 */
const openHelpFeedbackModal = () => {
    const modal = elements.helpFeedbackModal;
    if (!modal) return;
    modal.style.display = 'flex';
    showPanel('help-main-menu', 'Help & Feedback');
    panelHistory = []; // Reset history

    // Load data from cache or db on start
    loadHelpData();
};

/**
 * Closes the main modal
 */
const closeHelpFeedbackModal = () => {
    const modal = elements.helpFeedbackModal;
    if (modal) modal.style.display = 'none';
};

/**
 * Panel Navigation System
 */
const showPanel = (panelId, titleText) => {
    const titleEl = document.getElementById('help-modal-title');
    const backBtn = elements.helpBackBtn;

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-circle-question"></i> ${titleText}`;
    }

    // Hide all panels
    document.querySelectorAll('.help-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    const activePanel = document.getElementById(panelId);
    if (activePanel) {
        activePanel.classList.add('active');
        activePanel.style.display = 'flex';
    }

    // Toggle Back button visibility
    if (panelId === 'help-main-menu') {
        if (backBtn) backBtn.style.display = 'none';
    } else {
        if (backBtn) backBtn.style.display = 'block';
    }
};

const setupNavigation = () => {
    const backBtn = elements.helpBackBtn;

    // Handle back clicks
    backBtn?.addEventListener('click', () => {
        if (panelHistory.length > 0) {
            const previous = panelHistory.pop();
            showPanel(previous.id, previous.title);
        } else {
            showPanel('help-main-menu', 'Help & Feedback');
        }
    });

    // Bind main menu clicks to panels
    document.querySelectorAll('#help-main-menu button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            let targetPanel = '';
            let targetTitle = '';

            switch (action) {
                case 'go-help-center':
                    targetPanel = 'help-panel-center';
                    targetTitle = 'Help Center';
                    break;
                case 'go-faq':
                    targetPanel = 'help-panel-faq';
                    targetTitle = 'Frequently Asked Questions';
                    break;
                case 'go-contact-support':
                    targetPanel = 'help-panel-support';
                    targetTitle = 'Contact Support';
                    loadUserTicketsList(); // Dynamic ticket track load
                    break;
                case 'go-report-problem':
                    targetPanel = 'help-panel-report';
                    targetTitle = 'Report a Problem';
                    break;
                case 'go-send-feedback':
                    targetPanel = 'help-panel-feedback';
                    targetTitle = 'Send Feedback';
                    break;
                case 'go-feature-request':
                    targetPanel = 'help-panel-feature';
                    targetTitle = 'Feature Request';
                    break;
                case 'go-bug-report':
                    targetPanel = 'help-panel-bug';
                    targetTitle = 'Bug Report';
                    break;
                case 'go-safety-privacy':
                    targetPanel = 'help-panel-safety-privacy';
                    targetTitle = 'Safety & Privacy';
                    break;
                case 'go-tos':
                    targetPanel = 'help-panel-tos';
                    targetTitle = 'Terms of Service';
                    break;
                case 'go-community-guidelines':
                    targetPanel = 'help-panel-community-guidelines';
                    targetTitle = 'Community Guidelines';
                    break;
                case 'go-about':
                    targetPanel = 'help-panel-about';
                    targetTitle = 'About HOTMAPP';
                    break;
            }

            if (targetPanel) {
                // Record history
                panelHistory.push({ id: 'help-main-menu', title: 'Help & Feedback' });
                showPanel(targetPanel, targetTitle);
            }
        });
    });

    // Setup support tickets tab navigation
    const newTicketTab = document.getElementById('support-new-ticket-tab');
    const myTicketsTab = document.getElementById('support-my-tickets-tab');
    const supportFormContainer = document.getElementById('support-form-container');
    const supportListContainer = document.getElementById('support-list-container');

    newTicketTab?.addEventListener('click', () => {
        newTicketTab.style.borderBottom = '2px solid var(--brand)';
        newTicketTab.style.color = 'var(--brand-dark)';
        myTicketsTab.style.borderBottom = '2px solid transparent';
        myTicketsTab.style.color = 'var(--muted)';
        if (supportFormContainer) supportFormContainer.style.display = 'block';
        if (supportListContainer) supportListContainer.style.display = 'none';
    });

    myTicketsTab?.addEventListener('click', () => {
        myTicketsTab.style.borderBottom = '2px solid var(--brand)';
        myTicketsTab.style.color = 'var(--brand-dark)';
        newTicketTab.style.borderBottom = '2px solid transparent';
        newTicketTab.style.color = 'var(--muted)';
        if (supportFormContainer) supportFormContainer.style.display = 'none';
        if (supportListContainer) supportListContainer.style.display = 'block';

        // Initial track load
        ticketsCurrentPageIndex = 0;
        ticketsPageHistory = [null];
        loadUserTicketsList();
    });
};

/**
 * Star Rating Selection System
 */
const setupStarRating = () => {
    const container = document.getElementById('feedback-stars');
    const inputVal = document.getElementById('feedback-rating-value');
    if (!container) return;

    const stars = container.querySelectorAll('i');

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-value'));
            if (inputVal) inputVal.value = val;

            // Highlight stars
            stars.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-value'));
                if (sVal <= val) {
                    s.className = 'fa-solid fa-star active';
                } else {
                    s.className = 'fa-regular fa-star';
                }
            });
        });
    });
};

/**
 * Image & Video Attachment Previews & Handlers
 */
const setupAttachmentPickers = () => {
    // Helper to register file change listener
    const bindPicker = (imgInputId, vidInputId, previewListId, type) => {
        const imgInput = document.getElementById(imgInputId);
        const vidInput = document.getElementById(vidInputId);
        const previewList = document.getElementById(previewListId);

        const updatePreview = () => {
            if (!previewList) return;
            previewList.innerHTML = '';

            const state = selectedAttachmentFiles[type];
            if (state.image) {
                previewList.innerHTML += `
                    <div style="display: flex; align-items: center; gap: 10px; background: var(--panel-soft); padding: 8px; border-radius: 8px; border: 1px solid var(--border);">
                        <i class="fa-solid fa-image" style="color: var(--brand);"></i>
                        <span style="flex:1; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${state.image.name} (~${(state.image.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button type="button" id="remove-img-${type}" style="background:none; border:none; color:var(--muted); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            }
            if (state.video) {
                previewList.innerHTML += `
                    <div style="display: flex; align-items: center; gap: 10px; background: var(--panel-soft); padding: 8px; border-radius: 8px; border: 1px solid var(--border);">
                        <i class="fa-solid fa-video" style="color: #ff9800;"></i>
                        <span style="flex:1; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${state.video.name} (~${(state.video.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button type="button" id="remove-vid-${type}" style="background:none; border:none; color:var(--muted); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            }

            // Bind remove button handlers
            document.getElementById(`remove-img-${type}`)?.addEventListener('click', () => {
                selectedAttachmentFiles[type].image = null;
                if (imgInput) imgInput.value = '';
                updatePreview();
            });
            document.getElementById(`remove-vid-${type}`)?.addEventListener('click', () => {
                selectedAttachmentFiles[type].video = null;
                if (vidInput) vidInput.value = '';
                updatePreview();
            });
        };

        imgInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedAttachmentFiles[type].image = file;
                updatePreview();
            }
        });

        vidInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Size validation: limit to 15MB to prevent heavy storage reads/costs
                if (file.size > 15 * 1024 * 1024) {
                    showToast("Video size exceeds the 15 MB limit.", "error");
                    vidInput.value = '';
                    return;
                }
                selectedAttachmentFiles[type].video = file;
                updatePreview();
            }
        });
    };

    bindPicker('support-image-file', 'support-video-file', 'support-file-preview-list', 'support');
    bindPicker('report-image-file', 'report-video-file', 'report-file-preview-list', 'report');
    bindPicker('bug-image-file', 'bug-video-file', 'bug-file-preview-list', 'bug');
};

/**
 * Image compression using HTML Canvas
 * Resizes images to max 1280px and compresses to 0.7 JPEG quality
 */
const compressImageFile = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1280;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', 0.7);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

/**
 * Compiles dynamic user agent, device, and browser information parameters
 */
const compileMetadata = () => {
    return {
        appVersion: '1.0.1',
        buildNumber: '10001',
        userAgent: navigator.userAgent,
        browser: getBrowserName(),
        os: getOSName(),
        screenSize: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        online: navigator.onLine,
        timestamp: new Date().toISOString()
    };
};

const getBrowserName = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung Browser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Trident")) return "Internet Explorer";
    if (ua.includes("Edge")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Unknown Browser";
};

const getOSName = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "macOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown OS";
};

/**
 * Form Submissions Handlers & Firebase Writers
 */
const setupFormSubmissions = () => {
    // 1. Support Form Submit
    const supportForm = document.getElementById('support-ticket-form');
    supportForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to submit support tickets", "error");
            return;
        }

        const subject = document.getElementById('support-subject').value.trim();
        const category = document.getElementById('support-category').value;
        const priority = document.getElementById('support-priority').value;
        const description = document.getElementById('support-description').value.trim();

        // Handle Offline State
        if (!navigator.onLine) {
            queueOfflineSubmission('support', { subject, category, priority, description });
            showToast("You are offline. Support request queued and will send on reconnect.", "info");
            supportForm.reset();
            clearAttachments('support');
            return;
        }

        const submitBtn = supportForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        setFormSubmitting(submitBtn, true);

        try {
            const urls = await uploadAttachmentFiles('support', user.uid);
            const metadata = compileMetadata();
            // Generate ticket number: T-YYYYMMDD-XXXX
            const rand = Math.floor(1000 + Math.random() * 9000);
            const ticketNum = `T-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${rand}`;

            const ticketPayload = {
                ticketNumber: ticketNum,
                subject,
                category,
                priority,
                description,
                status: 'open',
                attachments: urls,
                metadata,
                userId: user.uid,
                fullname: user.displayName || 'HOTMAPP User',
                email: user.email || user.phoneNumber || 'N/A'
            };

            await submitSupportTicket(user.uid, ticketPayload);
            sendEmailAlert('support', ticketPayload);
            showToast(`Support Ticket ${ticketNum} submitted successfully!`, "success");
            supportForm.reset();
            clearAttachments('support');

            // Reload list and switch to My Tickets tab
            ticketsCurrentPageIndex = 0;
            ticketsPageHistory = [null];
            loadUserTicketsList();
            document.getElementById('support-my-tickets-tab').click();
        } catch (error) {
            console.error("Support submit error:", error);
            showToast("Failed to submit support ticket. Please retry.", "error");
        } finally {
            setFormSubmitting(submitBtn, false, origText);
        }
    });

    // 2. Report a Problem Form Submit
    const reportForm = document.getElementById('report-problem-form');
    reportForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to submit problem reports", "error");
            return;
        }

        const category = document.getElementById('report-category').value;
        const description = document.getElementById('report-description').value.trim();

        if (!navigator.onLine) {
            queueOfflineSubmission('report', { category, description });
            showToast("Offline: Problem report queued to send on reconnect.", "info");
            reportForm.reset();
            clearAttachments('report');
            return;
        }

        const submitBtn = reportForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        setFormSubmitting(submitBtn, true);

        try {
            const urls = await uploadAttachmentFiles('report', user.uid);
            const metadata = compileMetadata();
            const reportPayload = {
                category,
                description,
                attachments: urls,
                metadata,
                userId: user.uid,
                email: user.email || user.phoneNumber || 'N/A'
            };

            await submitProblemReport(user.uid, reportPayload);
            sendEmailAlert('report', reportPayload);
            showToast("Problem report submitted successfully! Thank you.", "success");
            reportForm.reset();
            clearAttachments('report');
            showPanel('help-main-menu', 'Help & Feedback');
        } catch (error) {
            console.error("Problem report error:", error);
            showToast("Failed to submit problem report. Please retry.", "error");
        } finally {
            setFormSubmitting(submitBtn, false, origText);
        }
    });

    // 3. Send Feedback Form Submit
    const feedbackForm = document.getElementById('send-feedback-form');
    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to send feedback", "error");
            return;
        }

        const rating = document.getElementById('feedback-rating-value').value;
        const comments = document.getElementById('feedback-comments').value.trim();
        const suggestions = document.getElementById('feedback-suggestions').value.trim();

        if (!rating) {
            showToast("Please select a star rating first.", "warning");
            return;
        }

        if (!navigator.onLine) {
            queueOfflineSubmission('feedback', { rating, comments, suggestions });
            showToast("Offline: Feedback queued to send on reconnect.", "info");
            feedbackForm.reset();
            resetStars();
            return;
        }

        const submitBtn = feedbackForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        setFormSubmitting(submitBtn, true);

        try {
            const metadata = compileMetadata();
            const feedbackPayload = {
                rating: parseInt(rating),
                comments,
                suggestions,
                metadata,
                userId: user.uid,
                email: user.email || user.phoneNumber || 'N/A'
            };

            await submitFeedback(user.uid, feedbackPayload);
            showToast("Feedback submitted successfully. Thank you for rating us!", "success");
            feedbackForm.reset();
            resetStars();
            showPanel('help-main-menu', 'Help & Feedback');
        } catch (error) {
            console.error("Feedback submit error:", error);
            showToast("Failed to submit feedback.", "error");
        } finally {
            setFormSubmitting(submitBtn, false, origText);
        }
    });

    // 4. Feature Request Form Submit
    const featureForm = document.getElementById('feature-request-form');
    featureForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to suggest features", "error");
            return;
        }

        const title = document.getElementById('feature-title').value.trim();
        const category = document.getElementById('feature-category').value;
        const description = document.getElementById('feature-description').value.trim();

        if (!navigator.onLine) {
            queueOfflineSubmission('feature', { title, category, description });
            showToast("Offline: Feature request queued to send on reconnect.", "info");
            featureForm.reset();
            return;
        }

        const submitBtn = featureForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        setFormSubmitting(submitBtn, true);

        try {
            const metadata = compileMetadata();
            const requestPayload = {
                title,
                category,
                description,
                metadata,
                userId: user.uid,
                email: user.email || user.phoneNumber || 'N/A'
            };

            await submitFeatureRequest(user.uid, requestPayload);
            showToast("Feature request submitted successfully! We appreciate it.", "success");
            featureForm.reset();
            showPanel('help-main-menu', 'Help & Feedback');
        } catch (error) {
            console.error("Feature submit error:", error);
            showToast("Failed to submit feature request.", "error");
        } finally {
            setFormSubmitting(submitBtn, false, origText);
        }
    });

    // 5. Bug Report Form Submit
    const bugForm = document.getElementById('bug-report-form');
    bugForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to submit bug reports", "error");
            return;
        }

        const steps = document.getElementById('bug-reproduce').value.trim();
        const expected = document.getElementById('bug-expected').value.trim();
        const actual = document.getElementById('bug-actual').value.trim();

        if (!navigator.onLine) {
            queueOfflineSubmission('bug', { steps, expected, actual });
            showToast("Offline: Bug report queued to send on reconnect.", "info");
            bugForm.reset();
            clearAttachments('bug');
            return;
        }

        const submitBtn = bugForm.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        setFormSubmitting(submitBtn, true);

        try {
            const urls = await uploadAttachmentFiles('bug', user.uid);
            const metadata = compileMetadata();
            const bugPayload = {
                reproduceSteps: steps,
                expectedBehavior: expected,
                actualBehavior: actual,
                attachments: urls,
                metadata,
                userId: user.uid,
                email: user.email || user.phoneNumber || 'N/A'
            };

            await submitBugReport(user.uid, bugPayload);
            sendEmailAlert('bug', bugPayload);
            showToast("Bug report submitted. Thank you for helping us squash bugs!", "success");
            bugForm.reset();
            clearAttachments('bug');
            showPanel('help-main-menu', 'Help & Feedback');
        } catch (error) {
            console.error("Bug report submit error:", error);
            showToast("Failed to submit bug report. Please retry.", "error");
        } finally {
            setFormSubmitting(submitBtn, false, origText);
        }
    });
};

const setFormSubmitting = (btnEl, isSubmitting, originalText = '') => {
    if (!btnEl) return;
    btnEl.disabled = isSubmitting;
    if (isSubmitting) {
        btnEl.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; border-top-color:white; margin:0 8px 0 0; display:inline-block;"></span> Submitting...`;
    } else {
        btnEl.innerHTML = originalText;
    }
};

const clearAttachments = (type) => {
    selectedAttachmentFiles[type] = { image: null, video: null };
    const imgEl = document.getElementById(`${type}-image-file`);
    const vidEl = document.getElementById(`${type}-video-file`);
    const previewEl = document.getElementById(`${type}-file-preview-list`);

    if (imgEl) imgEl.value = '';
    if (vidEl) vidEl.value = '';
    if (previewEl) previewEl.innerHTML = '';
};

const resetStars = () => {
    const container = document.getElementById('feedback-stars');
    const inputVal = document.getElementById('feedback-rating-value');
    if (inputVal) inputVal.value = '';
    if (container) {
        container.querySelectorAll('i').forEach(s => {
            s.className = 'fa-regular fa-star';
            s.classList.remove('active');
        });
    }
};

/**
 * Performs attachment uploads to Firebase Storage
 * Compresses images before upload. Logs status.
 */
const uploadAttachmentFiles = async (type, userId) => {
    const state = selectedAttachmentFiles[type];
    const urls = { image: null, video: null };

    if (state.image) {
        showToast("Compressing image attachment...", "info");
        const compressed = await compressImageFile(state.image);
        const path = `help_attachments/${userId}/${Date.now()}_img_${compressed.name}`;
        showToast("Uploading compressed image...", "info");
        urls.image = await uploadFile(path, compressed);
    }

    if (state.video) {
        showToast("Uploading video attachment...", "info");
        const path = `help_attachments/${userId}/${Date.now()}_vid_${state.video.name}`;
        urls.video = await uploadFile(path, state.video);
    }

    return urls;
};

/**
 * Offline queueing system
 */
const queueOfflineSubmission = (type, payload) => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push({
        type,
        payload,
        metadata: compileMetadata(),
        userId: auth.currentUser?.uid
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const setupOfflineQueueListener = () => {
    window.addEventListener('online', () => {
        flushOfflineQueue();
    });
};

const flushOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`HOTMAPP Help: Online detected. Flushing ${queue.length} offline submissions...`);
    showToast("Reconnected: Sending queued offline reports...", "info");

    const failed = [];

    for (const item of queue) {
        try {
            if (item.type === 'support') {
                const rand = Math.floor(1000 + Math.random() * 9000);
                const ticketNum = `T-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${rand}`;
                await submitSupportTicket(item.userId, {
                    ticketNumber: ticketNum,
                    status: 'open',
                    attachments: { image: null, video: null },
                    ...item.payload,
                    metadata: item.metadata
                });
            } else if (item.type === 'report') {
                await submitProblemReport(item.userId, {
                    attachments: { image: null, video: null },
                    ...item.payload,
                    metadata: item.metadata
                });
            } else if (item.type === 'feedback') {
                await submitFeedback(item.userId, {
                    ...item.payload,
                    metadata: item.metadata
                });
            } else if (item.type === 'feature') {
                await submitFeatureRequest(item.userId, {
                    ...item.payload,
                    metadata: item.metadata
                });
            } else if (item.type === 'bug') {
                await submitBugReport(item.userId, {
                    attachments: { image: null, video: null },
                    ...item.payload,
                    metadata: item.metadata
                });
            }
        } catch (err) {
            console.error("Failed to flush queue item:", item, err);
            failed.push(item);
        }
    }

    if (failed.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        showToast("All offline submissions synced successfully!", "success");
    }
};

/**
 * Help Center Search and Categorization logic
 */
const setupHelpSearchAndFilters = () => {
    const filterContainer = document.getElementById('help-categories-filter');
    const searchInput = document.getElementById('help-search-input');

    if (!filterContainer || !searchInput) return;

    // Filter Category select handler
    const renderFilterPills = () => {
        filterContainer.innerHTML = '';

        // Add "All" pill
        const allActive = currentCategoryFilter === 'All' ? 'active' : '';
        filterContainer.innerHTML += `<div class="help-category-pill ${allActive}" data-category="All">All</div>`;

        HELP_CATEGORIES.forEach(cat => {
            const active = currentCategoryFilter === cat ? 'active' : '';
            filterContainer.innerHTML += `<div class="help-category-pill ${active}" data-category="${cat}">${cat}</div>`;
        });

        // Add event listeners
        filterContainer.querySelectorAll('.help-category-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                currentCategoryFilter = pill.getAttribute('data-category');
                renderFilterPills();
                renderFilteredArticles();
            });
        });
    };

    searchInput.addEventListener('input', () => {
        renderFilteredArticles();
    });

    renderFilterPills();
};

const renderFilteredArticles = () => {
    const container = document.getElementById('help-articles-list');
    const query = document.getElementById('help-search-input')?.value.toLowerCase().trim() || '';
    if (!container) return;

    container.innerHTML = '';

    const filtered = cachedArticles.filter(art => {
        const matchesCategory = currentCategoryFilter === 'All' || art.category === currentCategoryFilter;
        const matchesSearch = !query || art.title.toLowerCase().includes(query) || art.content.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--muted); font-size: 0.9rem;">
                <i class="fa-solid fa-face-frown" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>
                No help articles found. Try another search or filter.
            </div>
        `;
        return;
    }

    filtered.forEach(art => {
        const isRecent = isArticleRecent(art.id);
        const card = document.createElement('div');
        card.className = `help-article-card`;
        card.setAttribute('data-id', art.id);
        card.innerHTML = `
            <div class="help-article-header">
                <span style="font-size: 0.92rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-file-lines" style="color: var(--brand-dark);"></i>
                    ${art.title}
                </span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: var(--muted); transition: transform 0.2s;"></i>
            </div>
            <div class="help-article-body">
                <p style="margin: 0; line-height: 1.5;">${art.content}</p>
                <div style="margin-top: 10px; font-size:0.75rem; color:var(--muted); display:flex; justify-content:space-between; align-items:center;">
                    <span>Category: <strong>${art.category}</strong></span>
                    ${isRecent ? '<span style="color:var(--brand); font-weight:700;"><i class="fa-solid fa-clock-rotate-left"></i> Viewed recently</span>' : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            // Expand / Collapse Accordion
            const wasOpen = card.classList.contains('open');
            document.querySelectorAll('.help-article-card').forEach(c => c.classList.remove('open'));
            if (!wasOpen) {
                card.classList.add('open');
                addToRecentlyViewed(art.id);
                renderRecentlyViewed();
            }
        });

        container.appendChild(card);
    });
};

/**
 * Expandable FAQ rendering
 */
const renderFaqAccordion = () => {
    const container = document.getElementById('faq-accordion-list');
    if (!container) return;

    container.innerHTML = '';

    cachedFaqs.forEach((faq, index) => {
        const card = document.createElement('div');
        card.className = 'help-article-card';
        card.innerHTML = `
            <div class="help-article-header">
                <span style="font-size: 0.92rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-circle-question" style="color: #0288d1;"></i>
                    ${faq.question}
                </span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: var(--muted); transition: transform 0.2s;"></i>
            </div>
            <div class="help-article-body">
                <p style="margin: 0; line-height: 1.5;">${faq.answer}</p>
            </div>
        `;

        card.addEventListener('click', () => {
            const wasOpen = card.classList.contains('open');
            document.querySelectorAll('#faq-accordion-list .help-article-card').forEach(c => c.classList.remove('open'));
            if (!wasOpen) card.classList.add('open');
        });

        container.appendChild(card);
    });
};

/**
 * Dynamic Recently Viewed Articles tracker
 */
const isArticleRecent = (id) => {
    const recents = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || '[]');
    return recents.includes(id);
};

const addToRecentlyViewed = (id) => {
    let recents = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || '[]');
    recents = recents.filter(rid => rid !== id); // Remove duplicates
    recents.unshift(id); // Add to top
    if (recents.length > 3) recents.pop(); // Keep only latest 3
    localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(recents));
};

const renderRecentlyViewed = () => {
    const list = document.getElementById('recently-viewed-list');
    const container = document.getElementById('recently-viewed-container');
    if (!list || !container) return;

    const recents = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || '[]');
    if (recents.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    recents.forEach(id => {
        const art = cachedArticles.find(a => a.id === id);
        if (!art) return;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--panel-soft); padding:8px 12px; border-radius:8px; border:1px solid var(--border); font-size:0.85rem; cursor:pointer;';
        row.innerHTML = `
            <span><i class="fa-solid fa-file-lines" style="color:var(--muted); margin-right:8px;"></i> ${art.title}</span>
            <span style="font-size:0.75rem; color:var(--muted);">${art.category}</span>
        `;
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open Help Center panel and find this card to expand it
            showPanel('help-panel-center', 'Help Center');
            currentCategoryFilter = 'All';
            setupHelpSearchAndFilters();
            renderFilteredArticles();
            setTimeout(() => {
                const card = document.querySelector(`.help-article-card[data-id="${art.id}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.click();
                }
            }, 100);
        });
        list.appendChild(row);
    });
};

/**
 * Local Storage Caching Logic & Firebase Sync Checks
 */
const loadHelpData = async () => {
    // 1. Try to load cached data first
    const cachedArts = localStorage.getItem(ARTICLES_CACHE_KEY);
    const cachedF = localStorage.getItem(FAQS_CACHE_KEY);
    const localMeta = JSON.parse(localStorage.getItem(SYNC_CACHE_KEY) || '{}');

    if (cachedArts) cachedArticles = JSON.parse(cachedArts);
    else cachedArticles = FALLBACK_ARTICLES;

    if (cachedF) cachedFaqs = JSON.parse(cachedF);
    else cachedFaqs = FALLBACK_FAQS;

    // Redraw interface with local cached state immediately
    renderFilteredArticles();
    renderFaqAccordion();
    renderRecentlyViewed();

    // 2. Perform a one-time check against sync metadata (optimized: minimal DB reads)
    if (!navigator.onLine) return; // Keep cache if offline

    try {
        const serverMeta = await getHelpSyncMetadata();
        if (!serverMeta) return;

        // If local metadata is outdated or missing, download fresh state
        if (!localMeta.version || localMeta.version < serverMeta.version) {
            console.log(`HOTMAPP: Syncing help articles and FAQs (Local version: ${localMeta.version || 0}, Server version: ${serverMeta.version})...`);

            const dbArticles = await getHelpArticlesFromDb();
            if (dbArticles) {
                // If database has articles, load them
                const artList = Object.keys(dbArticles).map(key => ({ id: key, ...dbArticles[key] }));
                cachedArticles = artList;
                localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(artList));
            }

            const dbFaqs = await getFaqsFromDb();
            if (dbFaqs) {
                const faqList = Object.keys(dbFaqs).map(key => ({ id: key, ...dbFaqs[key] }));
                cachedFaqs = faqList;
                localStorage.setItem(FAQS_CACHE_KEY, JSON.stringify(faqList));
            }

            localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(serverMeta));

            // Refresh UI
            renderFilteredArticles();
            renderFaqAccordion();
        }
    } catch (err) {
        console.warn("Failed to check help sync metadata. Using local cache.", err);
    }
};

/**
 * Track user support tickets (paginated)
 */
const loadUserTicketsList = async () => {
    const user = auth.currentUser;
    const listEl = document.getElementById('support-tickets-list');
    const prevBtn = document.getElementById('support-prev-page');
    const nextBtn = document.getElementById('support-next-page');
    const pageInfo = document.getElementById('support-page-info');

    if (!user || !listEl) return;

    listEl.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; padding:30px;">
            <span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--brand-dark);"></span>
        </div>
    `;

    try {
        const startKey = ticketsPageHistory[ticketsCurrentPageIndex];
        const { tickets, nextKey } = await getSupportTicketsPage(user.uid, ticketsPageSize, startKey);

        listEl.innerHTML = '';

        if (tickets.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--muted); font-size:0.88rem;">
                    <i class="fa-solid fa-rectangle-list" style="font-size:2rem; display:block; margin-bottom:8px;"></i>
                    No support tickets submitted yet.
                </div>
            `;
            if (pageInfo) pageInfo.textContent = "No tickets";
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }

        tickets.forEach(t => {
            const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A';
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <strong style="color:var(--brand-dark); font-size:0.9rem;">${t.ticketNumber}</strong>
                    <span class="ticket-badge ${t.status}">${t.status.replace('_', ' ')}</span>
                </div>
                <div style="font-weight:600; font-size:0.95rem; color:var(--text); margin-top:2px;">${t.subject}</div>
                <div style="font-size:0.82rem; color:var(--muted); margin-top:4px; line-height:1.4; max-height:40px; overflow:hidden; text-overflow:ellipsis;">${t.description}</div>
                <div style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--muted);">
                    <span>Category: <strong>${t.category}</strong> | Priority: <strong>${t.priority}</strong></span>
                    <span>${dateStr}</span>
                </div>
            `;
            listEl.appendChild(card);
        });

        // Set Pagination State
        if (pageInfo) pageInfo.textContent = `Page ${ticketsCurrentPageIndex + 1}`;
        if (prevBtn) prevBtn.disabled = ticketsCurrentPageIndex === 0;
        if (nextBtn) {
            nextBtn.disabled = !nextKey;
            // Store nextKey for forward pagination
            if (nextKey && ticketsPageHistory.length <= ticketsCurrentPageIndex + 1) {
                ticketsPageHistory.push(nextKey);
            }
        }

        // Bind Pagination Clicks
        const handleNext = () => {
            if (nextKey) {
                ticketsCurrentPageIndex++;
                loadUserTicketsList();
            }
        };
        const handlePrev = () => {
            if (ticketsCurrentPageIndex > 0) {
                ticketsCurrentPageIndex--;
                loadUserTicketsList();
            }
        };

        nextBtn?.replaceWith(nextBtn.cloneNode(true));
        prevBtn?.replaceWith(prevBtn.cloneNode(true));

        document.getElementById('support-next-page')?.addEventListener('click', handleNext);
        document.getElementById('support-prev-page')?.addEventListener('click', handlePrev);

    } catch (error) {
        console.error("Error loading support tickets:", error);
        listEl.innerHTML = `<div style="color:var(--danger); text-align:center; padding:20px; font-size:0.85rem;">Error loading tickets. Please refresh.</div>`;
    }
};

const sendEmailAlert = async (type, payload) => {
    try {
        const body = {
            _subject: `Hotmapp Alert: [${type.toUpperCase()}] from ${payload.email}`,
            "Form Type": type.toUpperCase(),
            "User ID": payload.userId,
            "User Contact": payload.email,
            "Attachments": (payload.attachments && payload.attachments.length > 0) ? payload.attachments.join(", ") : "None"
        };

        if (type === 'support') {
            body["Ticket Number"] = payload.ticketNumber;
            body["Subject"] = payload.subject;
            body["Category"] = payload.category;
            body["Priority"] = payload.priority;
            body["Description"] = payload.description;
        } else if (type === 'report') {
            body["Problem Category"] = payload.category;
            body["Description"] = payload.description;
        } else if (type === 'bug') {
            body["Steps to Reproduce"] = payload.reproduceSteps;
            body["Expected Behavior"] = payload.expectedBehavior;
            body["Actual Behavior"] = payload.actualBehavior;
        }

        if (payload.metadata) {
            body["Device Platform"] = payload.metadata.platform || "Unknown";
            body["Browser/UserAgent"] = payload.metadata.userAgent || "Unknown";
        }

        await fetch("https://formsubmit.co/ajax/apphotma@gmail.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (err) {
        console.error("FormSubmit send error:", err);
    }
};
