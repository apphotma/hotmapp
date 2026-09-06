// Centralized DOM element cache
export const elements = {
    get chatContainer() {
        return document.querySelector('[data-ui="chat-container"]');
    },
    get custSidebar() {
        return document.querySelector('[data-ui="cust-sidebar"]');
    },
    get custConversationList() {
        return document.querySelector('[data-ui="cust-conversation-list"]');
    },
    get chatConversationList() {
        return document.querySelector('[data-ui="chat-conversation-list"]');
    },
    get chatSidebar() {
        return document.querySelector('[data-ui="chat-sidebar"]');
    },
    get chatArea() {
        return document.querySelector('[data-ui="chat-area"]');
    },
    get storeArea() {
        return document.querySelector('[data-ui="store-area"]');
    },
    get chatHeaderName() {
        return document.querySelector('[data-ui="chat-name"]');
    },
    get userStatus() {
        return document.querySelector('[data-ui="user-status"]');
    },
    get chatHeaderAvatar() {
        return document.querySelector('[data-ui="chat-avatar"]');
    },
    get conversationItems() {
        return document.querySelectorAll('[data-ui="conversation-item"]');
    },
    get shopContainer() {
        return document.querySelector('[data-ui="shop-container"]');
    },
    get typingIndicator() {
        return document.querySelector('[data-ui="typing-indicator"]');
    },
    get floatingShopBtn() {
        return document.querySelector('[data-ui="floating-shop-btn"]');
    },
    get shopBadge() {
        return document.querySelector('[data-ui="shop-badge"]');
    },
    get shopProductGrid() {
        return document.querySelector('[data-ui="shop-product-grid"]');
    },
    get cartToggleBtn() {
        return document.querySelector('[data-ui="cart-toggle-btn"]');
    },
    get cartCountBadge() {
        return document.querySelector('[data-ui="cart-count"]');
    },
    get cartOverlay() {
        return document.querySelector('[data-ui="cart-overlay"]');
    },
    get cartContent() {
        return document.querySelector('[data-ui="cart-content"]');
    },
    get cartDragHandle() {
        return document.querySelector('[data-ui="cart-drag-handle"]');
    },
    get cartItemsList() {
        return document.querySelector('[data-ui="cart-items-list"]');
    },
    get cartTabCart() {
        return document.querySelector('[data-ui="cart-tab-cart"]');
    },
    get cartTabSaved() {
        return document.querySelector('[data-ui="cart-tab-saved"]');
    },
    get cartTabCount() {
        return document.querySelector('[data-ui="cart-tab-count"]');
    },
    get savedTabCount() {
        return document.querySelector('[data-ui="saved-tab-count"]');
    },
    get savedItemsList() {
        return document.querySelector('[data-ui="saved-items-list"]');
    },
    get savedLaterSection() {
        return document.querySelector('[data-ui="saved-later-section"]');
    },
    get savedCountBadge() {
        return document.querySelector('[data-ui="saved-count-badge"]');
    },
    get cartTotalDisplay() {
        return document.querySelector('[data-ui="cart-total"]');
    },
    get moveAllToSavedBtn() {
        return document.querySelector('[data-ui="move-all-to-saved-btn"]');
    },
    get moveAllToCartBtn() {
        return document.querySelector('[data-ui="move-all-to-cart-btn"]');
    },
    get shopPickupLocations() {
        return document.querySelector('[data-ui="shop-pickup-locations"]');
    },
    get shopPickupLocationsList() {
        return document.querySelector('[data-ui="shop-pickup-locations-list"]');
    },
    get clearSavedBtn() {
        return document.querySelector('[data-ui="clear-saved-btn"]');
    },
    get shopLocationsMapModal() {
        return document.querySelector('[data-ui="shop-locations-map-modal"]');
    },
    get shopLocationsMap() {
        return document.querySelector('[data-ui="shop-locations-map"]');
    },
    get closeShopLocationsMapModalBtn() {
        return document.querySelector('[data-ui="close-shop-locations-map-modal"]');
    },
    get checkoutBtn() {
        return document.querySelector('[data-ui="checkout-btn"]');
    },
    get clearCartBtn() {
        return document.querySelector('[data-ui="clear-cart-btn"]');
    },
    get productDetailsModal() {
        return document.querySelector('[data-ui="product-details-modal"]');
    },
    get detailsImg() {
        return document.querySelector('[data-ui="details-img"]');
    },
    get detailsName() {
        return document.querySelector('[data-ui="details-name"]');
    },
    get detailsDesc() {
        return document.querySelector('[data-ui="details-desc"]');
    },
    get detailsRating() {
        return document.querySelector('[data-ui="details-rating"]');
    },
    get detailsPrice() {
        return document.querySelector('[data-ui="details-price"]');
    },
    get detailsMeta() {
        return document.querySelector('[data-ui="details-meta"]');
    },
    get closeDetailsModalBtn() {
        return document.querySelector('[data-ui="close-details-modal"]');
    },
    get reviewsList() {
        return document.querySelector('[data-ui="reviews-list"]');
    },
    get reviewFormContainer() {
        return document.querySelector('[data-ui="review-form-container"]');
    },
    get reviewForm() {
        return document.querySelector('[data-ui="review-form"]');
    },
    get reviewStarRating() {
        return document.querySelector('[data-ui="review-star-rating"]');
    },
    get reviewRatingValue() {
        return document.querySelector('[data-ui="review-rating-value"]');
    },
    get closeCartBtn() {
        return document.querySelector('[data-ui="close-cart-btn"]');
    },
    get scrollToTopBtn() {
        return document.querySelector('[data-ui="scroll-to-top-btn"]');
    },
    get shopSearchBar() {
        return document.querySelector('[data-ui="shop-search-bar"]');
    },
    get shopSearchInput() {
        return document.querySelector('[data-ui="shop-search-input"]');
    },
    get shopCloseBtn() {
        return document.querySelector('[data-ui="shop-close-btn"]');
    },
    get shopBuzInfoBtn() {
        return document.querySelector('[data-ui="shop-buz-info-btn"]');
    },
    get shopNoResultsMessage() {
        return document.querySelector('[data-ui="shop-no-results-message"]');
    },
    get messageInputArea() {
        return document.querySelector('[data-ui="message-input-area"]');
    },
    get chatHeaderInfo() {
        return document.querySelector('[data-ui="chat-header-info"]');
    },
    get chatSearchBar() {
        return document.querySelector('[data-ui="chat-search-bar"]');
    },
    get chatSearchInput() {
        return document.querySelector('[data-ui="chat-search-input"]');
    },
    get searchResultsCount() {
        return document.querySelector('[data-ui="search-results-count"]');
    },
    get clearChatSearchBtn() {
        return document.querySelector('[data-ui="clear-chat-search-btn"]');
    },
    get prevSearchBtn() {
        return document.querySelector('[data-ui="prev-search-btn"]');
    },
    get nextSearchBtn() {
        return document.querySelector('[data-ui="next-search-btn"]');
    },
    get closeChatSearchBtn() {
        return document.querySelector('[data-ui="close-chat-search-btn"]');
    },
    get chatActions() {
        return document.querySelector('[data-ui="chat-actions"]');
    },
    get exportChatBtn() {
        return document.querySelector('[data-ui="export-chat-btn"]');
    },
    get chatMenuBtn() {
        return document.querySelector('[data-ui="chat-menu-btn"]');
    },
    get chatHeaderMenu() {
        return document.querySelector('[data-ui="chat-header-menu"]');
    },
    get storeSearchInput() {
        return document.querySelector('[data-ui="store-search-input"]');
    },
    get addProductBtn() {
        return document.querySelector('[data-ui="add-product-btn"]');
    },
    get productCards() {
        return document.querySelectorAll('[data-ui="product-card"]');
    },
    get productGrid() {
        return document.querySelector('[data-ui="product-grid"]');
    },
    get productModal() {
        return document.querySelector('[data-ui="product-modal"]');
    },
    get addProductForm() {
        return document.querySelector('[data-ui="add-product-form"]');
    },
    get closeModalBtn() {
        return document.querySelector('[data-ui="close-product-modal"]');
    },
    get productImgPreview() {
        return document.querySelector('[data-ui="product-img-preview"]');
    },
    get productImgData() {
        return document.querySelector('[data-ui="product-img-data"]');
    },
    get productFileInput() {
        return document.querySelector('[data-ui="product-file-input"]');
    },
    get uploadProductBtn() {
        return document.querySelector('[data-ui="upload-product-img"]');
    },
    get captureProductBtn() {
        return document.querySelector('[data-ui="capture-product-img"]');
    },
    get productCurrencySelect() {
        return document.querySelector('[data-ui="p-currency"]');
    },
    get productCategoryInput() {
        return document.querySelector('[data-ui="p-category"]');
    },
    get productCustomCurrencyInput() {
        return document.querySelector('[data-ui="p-custom-currency"]');
    },
    get searchWebImgBtn() {
        return document.querySelector('[data-ui="search-web-img"]');
    },
    get pasteUrlImgBtn() {
        return document.querySelector('[data-ui="paste-url-img"]');
    },
    get openGoogleImagesBtn() {
        return document.querySelector('[data-ui="open-google-images-btn"]');
    },
    get imageSearchModal() {
        return document.querySelector('[data-ui="image-search-modal"]');
    },
    get closeImageSearchModalBtn() {
        return document.querySelector('[data-ui="close-image-search-modal"]');
    },
    get imageSearchInput() {
        return document.querySelector('[data-ui="image-search-input"]');
    },
    get imageSearchSubmitBtn() {
        return document.querySelector('[data-ui="image-search-submit-btn"]');
    },
    get imageSearchResults() {
        return document.querySelector('[data-ui="image-search-results"]');
    },
    get imageSearchStatus() {
        return document.querySelector('[data-ui="image-search-status"]');
    },
    get deleteProductModal() {
        return document.querySelector('[data-ui="delete-product-modal"]');
    },
    get confirmDeleteProductBtn() {
        return document.querySelector('[data-ui="confirm-delete-btn"]');
    },
    get cancelDeleteProductBtn() {
        return document.querySelector('[data-ui="cancel-delete-btn"]');
    },
    get deleteProductPreviewImg() {
        return document.querySelector('[data-ui="delete-preview-img"]');
    },
    get deleteProductName() {
        return document.querySelector('[data-ui="delete-product-name"]');
    },
    get storeBulkBtn() {
        return document.querySelector('[data-ui="store-bulk-btn"]');
    },
    get storeSelectionBar() {
        return document.querySelector('[data-ui="store-selection-bar"]');
    },
    get storeSelectionCount() {
        return document.querySelector('[data-ui="store-selection-count"]');
    },
    get storeMassDeleteBtn() {
        return document.querySelector('[data-ui="store-mass-delete-btn"]');
    },
    get storeMassSoldOutBtn() {
        return document.querySelector('[data-ui="store-mass-sold-out-btn"]');
    },
    get storeCancelSelectionBtn() {
        return document.querySelector('[data-ui="store-cancel-selection-btn"]');
    },
    get storeSelectAllCheckbox() {
        return document.querySelector('[data-ui="store-select-all-checkbox"]');
    },
    get messagesContainer() {
        return document.querySelector('[data-ui="messages-container"]');
    },
    get messageInput() {
        return document.querySelector('[data-ui="message-input"]');
    },
    get sendBtn() {
        return document.querySelector('[data-ui="send-btn"]');
    },
    get recordBtn() {
        return document.querySelector('[data-ui="record-btn"]');
    },
    get emojiBtn() {
        return document.querySelector('[data-ui="emoji-btn"]');
    },
    get attachBtn() {
        return document.querySelector('[data-ui="attach-btn"]');
    },
    get fileInput() {
        return document.querySelector('[data-ui="file-input"]');
    },
    get locationBtn() {
        return document.querySelector('[data-ui="location-btn"]');
    },
    get liveLocationHeaderBtn() {
        return document.querySelector('[data-ui="live-location-header-btn"]');
    },
    get liveLocationBtn() {
        return document.querySelector('[data-ui="live-location-btn"]');
    },
    get cameraBtn() {
        return document.querySelector('[data-ui="camera-btn"]');
    },
    get voicePreview() {
        return document.querySelector('[data-ui="voice-preview"]');
    },
    get previewPlayBtn() {
        return document.querySelector('[data-ui="preview-play"]');
    },
    get previewSendBtn() {
        return document.querySelector('[data-ui="preview-send"]');
    },
    get previewCancelBtn() {
        return document.querySelector('[data-ui="preview-cancel"]');
    },
    get previewStatus() {
        return document.querySelector('[data-ui="preview-status"]');
    },
    get backBtn() {
        return document.querySelector('[data-ui="back-btn"]');
    },
    get emojiPicker() {
        return document.querySelector('[data-ui="emoji-picker"]');
    },
    get emojiPickerContent() {
        return document.querySelector('[data-ui="emoji-picker-content"]');
    },
    get emojiSearchInput() {
        return document.querySelector('[data-ui="emoji-search-input"]');
    },
    get emojiCategories() {
        return document.querySelector('[data-ui="emoji-categories"]');
    },
    get emojiSkinTones() {
        return document.querySelector('[data-ui="emoji-skin-tones"]');
    },
    get emojiGrid() {
        return document.querySelector('[data-ui="emoji-grid"]');
    },
    get attachmentMenu() {
        return document.querySelector('[data-ui="attachment-menu"]');
    },
    get messageContextMenu() {
        return document.querySelector('[data-ui="message-context-menu"]');
    },
    get attachMediaBtn() {
        return document.querySelector('[data-ui="attach-media"]');
    },
    get attachCameraBtn() {
        return document.querySelector('[data-ui="attach-camera"]');
    },
    get attachDocBtn() {
        return document.querySelector('[data-ui="attach-doc"]');
    },
    get attachEphemeralBtn() {
        return document.querySelector('[data-ui="attach-ephemeral"]');
    },
    get attachLocationBtn() {
        return document.querySelector('[data-ui="attach-location"]');
    },
    get locationModal() {
        return document.querySelector('[data-ui="location-modal"]');
    },
    get voiceCallBtn() {
        return document.querySelector('[data-ui="voice-call-btn"]');
    },
    get videoCallBtn() {
        return document.querySelector('[data-ui="video-call-btn"]');
    },
    get callMenuBtn() {
        return document.querySelector('[data-ui="call-menu-btn"]');
    },
    get callDropdownMenu() {
        return document.querySelector('[data-ui="call-dropdown-menu"]');
    },
    get videoContainer() {
        return document.querySelector('[data-ui="video-container"]');
    },
    get remoteVideosGrid() {
        return document.querySelector('[data-ui="remote-videos-grid"]') || document.querySelector('[data-ui="video-container"]');
    },
    get localVideo() {
        return document.querySelector('[data-ui="local-video"]');
    },
    get remoteVideo() {
        return document.querySelector('[data-ui="remote-video"]');
    },
    get remoteMuteOverlay() {
        return document.querySelector('[data-ui="remote-mute-overlay"]');
    },
    get remoteAudio() {
        return document.getElementById('remote-audio');
    },
    get callOverlay() {
        return document.querySelector('[data-ui="call-overlay"]');
    },
    get callOverlayName() {
        return document.querySelector('[data-ui="call-overlay-name"]');
    },
    get callOverlayAvatar() {
        return document.querySelector('[data-ui="call-overlay-avatar"]');
    },
    get callStatus() {
        return document.querySelector('[data-ui="call-status"]');
    },
    get callOverlayPulse() {
        return document.querySelector('.pulse-ring');
    },
    get callMuteBtn() {
        return document.querySelector('[data-ui="call-mute-btn"]');
    },
    get callCamMuteBtn() {
        return document.querySelector('[data-ui="call-cam-mute-btn"]');
    },
    get callFlashBtn() {
        return document.querySelector('[data-ui="call-flash-btn"]');
    },
    get callFlipCameraBtn() {
        return document.querySelector('[data-ui="call-flip-btn"]');
    },
    get callAudioSourceBtn() {
        return document.querySelector('[data-ui="call-audio-source-btn"]');
    },
    get audioSourceMenu() {
        return document.querySelector('[data-ui="audio-source-menu"]');
    },
    get callPipBtn() {
        return document.querySelector('[data-ui="call-pip-btn"]');
    },
    get pipMuteIndicator() {
        return document.querySelector('[data-ui="pip-mute-indicator"]');
    },
    get pipResizeHandle() {
        return document.querySelector('[data-ui="pip-resize-handle"]');
    },
    get pipEndCallBtn() {
        return document.querySelector('[data-ui="pip-end-call-btn"]');
    },
    get callSpeakerBtn() {
        return document.querySelector('[data-ui="call-speaker-btn"]');
    },
    get callVideoBtn() {
        return document.querySelector('[data-ui="call-video-btn"]');
    },
    get callRetryBtn() {
        return document.querySelector('[data-ui="call-retry-btn"]');
    },
    get callAddUserBtn() {
        return document.querySelector('[data-ui="call-add-user-btn"]');
    },
    get callScreenShareBtn() {
        return document.querySelector('[data-ui="call-screen-share-btn"]');
    },
    get callMoreBtn() {
        return document.querySelector('[data-ui="call-more-btn"]');
    },
    get callMoreSheet() {
        return document.querySelector('[data-ui="call-more-sheet"]');
    },
    get callMoreBackdrop() {
        return document.querySelector('[data-ui="call-more-backdrop"]');
    },
    get localClickCatcher() {
        return document.querySelector('[data-ui="local-click-catcher"]');
    },
    get remoteClickCatcher() {
        return document.querySelector('[data-ui="remote-click-catcher"]');
    },
    get callEndBtn() {
        return document.querySelector('[data-ui="call-end-btn"]');
    },
    get incomingCallOverlay() {
        return document.querySelector('[data-ui="incoming-call-overlay"]');
    },
    get incomingName() {
        return document.querySelector('[data-ui="incoming-name"]');
    },
    get incomingAvatar() {
        return document.querySelector('[data-ui="incoming-avatar"]');
    },
    get callAcceptBtn() {
        return document.querySelector('[data-ui="call-accept-btn"]');
    },
    get callRejectBtn() {
        return document.querySelector('[data-ui="call-reject-btn"]');
    },
    get waitingCallBadge() {
        return document.querySelector('[data-ui="waiting-call-badge"]');
    },
    get waitingCallName() {
        return document.querySelector('[data-ui="waiting-call-name"]');
    },
    get switchCallBtn() {
        return document.querySelector('[data-ui="switch-call-btn"]');
    },
    get rejectWaitingCallBtn() {
        return document.querySelector('[data-ui="reject-waiting-btn"]');
    },
    get reportBusinessBtn() {
        return document.querySelector('[data-ui="report-business"]');
    },
    get reportBusinessModal() {
        return document.querySelector('[data-ui="report-business-modal"]');
    },
    get reportReasonInput() {
        return document.querySelector('[data-ui="report-reason"]');
    },
    get closeReportBusinessModalBtn() {
        return document.querySelector('[data-ui="close-report-business-modal"]');
    },
    get submitReportBusinessBtn() {
        return document.querySelector('[data-ui="submit-report-business"]');
    },
    get nearbyPlacesList() {
        return document.querySelector('[data-ui="nearby-places-list"]');
    },
    get minimizedCallBar() {
        return document.querySelector('[data-ui="minimized-call-bar"]');
    },
    get minimizedCallName() {
        return document.querySelector('[data-ui="minimized-call-name"]');
    },
    get minimizedCallTimer() {
        return document.querySelector('[data-ui="minimized-call-timer"]');
    },
    get minimizedMuteBtn() {
        return document.querySelector('[data-ui="min-mute-btn"]');
    },
    get minimizedEndBtn() {
        return document.querySelector('[data-ui="min-end-btn"]');
    },
    get minimizeCallBtn() {
        return document.querySelector('[data-ui="minimize-call-btn"]');
    },
    get callOverlayContent() {
        return document.querySelector('.call-content');
    },
    get sendCurrentLocBtn() {
        return document.querySelector('[data-ui="send-current-loc"]');
    },
    get sendLiveLocBtn() {
        return document.querySelector('[data-ui="send-live-loc"]');
    },
    get sendThisLocationBtn() {
        return document.querySelector('[data-ui="send-this-location-btn"]');
    },
    get sendThisLocationAddress() {
        return document.querySelector('[data-ui="send-this-location-address"]');
    },
    get closeLocationModalBtn() {
        return document.querySelector('[data-ui="close-location-modal"]');
    },
    get qrScannerModal() {
        return document.querySelector('[data-ui="qr-scanner-modal"]');
    },
    get qrReader() {
        return document.querySelector('[data-ui="qr-reader"]');
    },
    get closeQrScannerBtn() {
        return document.querySelector('[data-ui="close-qr-scanner"]');
    },
    get showMyQrBtn() {
        return document.querySelector('[data-ui="show-my-qr-btn"]');
    },
    get copyMyUidBtn() {
        return document.querySelector('[data-ui="copy-my-uid-btn"]');
    },
    get myQrModal() {
        return document.querySelector('[data-ui="my-qr-modal"]');
    },
    get myQrContainer() {
        return document.querySelector('[data-ui="my-qr-container"]');
    },
    get closeMyQrModalBtn() {
        return document.querySelector('[data-ui="close-my-qr-modal"]');
    },
    get linkedDevicesModal() {
        return document.querySelector('[data-ui="linked-devices-modal"]');
    },
    get closeLinkedDevicesModalBtn() {
        return document.querySelector('[data-ui="close-linked-devices-modal"]');
    },
    get linkedDevicesList() {
        return document.querySelector('[data-ui="linked-devices-list"]');
    },
    get linkNewDeviceBtn() {
        return document.querySelector('[data-ui="link-new-device-btn"]');
    },
    get chatHeader() {
        return document.querySelector('[data-ui="chat-header"]');
    },
    get linkNewDeviceModal() {
        return document.querySelector('[data-ui="link-new-device-modal"]');
    },
    get closeLinkNewDeviceModalBtn() {
        return document.querySelector('[data-ui="close-link-new-device-modal"]');
    },
    get linkDeviceScanner() {
        return document.getElementById('link-device-scanner');
    },
    get linkDeviceLoginBtn() {
        return document.querySelector('[data-ui="link-device-login-btn"]');
    },
    get linkQrDisplayModal() {
        return document.querySelector('[data-ui="link-qr-display-modal"]');
    },
    get closeLinkQrDisplayModalBtn() {
        return document.querySelector('[data-ui="close-link-qr-display-modal"]');
    },
    get linkQrContainer() {
        return document.querySelector('[data-ui="link-qr-container"]');
    },
    get linkQrLoading() {
        return document.querySelector('[data-ui="link-qr-loading"]');
    },
    get revokeAllDevicesBtn() {
        return document.querySelector('[data-ui="revoke-all-devices-btn"]');
    },
    get callDetailsModal() {
        return document.querySelector('[data-ui="call-details-modal"]');
    },
    get callDetailsContent() {
        return document.querySelector('[data-ui="call-details-content"]');
    },
    get closeCallDetailsModalBtn() {
        return document.querySelector('[data-ui="close-call-details-modal"]');
    },
    get locationSearchInput() {
        return document.querySelector('[data-ui="location-search-input"]');
    },
    get messageInfoModal() {
        return document.querySelector('[data-ui="message-info-modal"]');
    },
    get resetMapToCurrentLocBtn() {
        return document.querySelector('[data-ui="reset-map-to-current-loc-btn"]');
    },
    get messageInfoContent() {
        return document.querySelector('[data-ui="message-info-content"]');
    },
    get pinnedMessageBar() {
        return document.querySelector('[data-ui="pinned-message-bar"]');
    },
    get pinnedPreview() {
        return document.querySelector('[data-ui="pinned-preview"]');
    },
    get unpinBtn() {
        return document.querySelector('[data-ui="unpin-btn"]');
    },
    get deleteConfirmationModal() {
        return document.querySelector('[data-ui="delete-confirmation-modal"]');
    },
    get deleteEveryoneBtn() {
        return document.querySelector('[data-ui="delete-everyone-btn"]');
    },
    get deleteMeBtn() {
        return document.querySelector('[data-ui="delete-me-btn"]');
    },
    get deleteTimeLimitMsg() {
        return document.querySelector('[data-ui="delete-time-limit-msg"]');
    },
    get cancelDeleteBtn() {
        return document.querySelector('[data-ui="cancel-delete-btn"]');
    },
    get closeMessageInfoModalBtn() {
        return document.querySelector('[data-ui="close-message-info-modal"]');
    },
    get locationSearchResults() {
        return document.querySelector('[data-ui="location-search-results"]');
    },
    get locationMap() {
        return document.getElementById('location-map');
    },
    get profilePhotoInput() {
        return document.querySelector('[data-ui="profile-photo-input"]');
    },
    get cameraModal() {
        return document.querySelector('[data-ui="camera-modal"]');
    },
    get cameraStream() {
        return document.querySelector('[data-ui="camera-stream"]');
    },
    get camPhotoBtn() {
        return document.querySelector('[data-ui="cam-photo"]');
    },
    get camVideoBtn() {
        return document.querySelector('[data-ui="cam-video"]');
    },
    get camCloseBtn() {
        return document.querySelector('[data-ui="cam-close"]');
    },
    get camSwitchBtn() {
        return document.querySelector('[data-ui="cam-switch"]');
    },
    get lightboxModal() {
        return document.querySelector('[data-ui="lightbox-modal"]');
    },
    get lightboxImage() {
        return document.querySelector('[data-ui="lightbox-img"]');
    },
    get lightboxVideo() {
        return document.querySelector('[data-ui="lightbox-video"]');
    },
    get lightboxEditBtn() {
        return document.querySelector('[data-ui="lightbox-edit-btn"]');
    },
    get lightboxHeader() {
        return document.querySelector('[data-ui="lightbox-header"]');
    },
    get lightboxActions() {
        return document.querySelector('[data-ui="lightbox-actions"]');
    },
    get lightboxUserInfo() {
        return document.querySelector('[data-ui="lightbox-user-info"]');
    },
    get lightboxAvatar() {
        return document.querySelector('[data-ui="lightbox-avatar"]');
    },
    get lightboxUsername() {
        return document.querySelector('[data-ui="lightbox-username"]');
    },
    get lightboxTime() {
        return document.querySelector('[data-ui="lightbox-time"]');
    },
    get lightboxStarBtn() {
        return document.querySelector('[data-ui="lightbox-star-btn"]');
    },
    get lightboxForwardBtn() {
        return document.querySelector('[data-ui="lightbox-forward-btn"]');
    },
    get lightboxDeleteBtn() {
        return document.querySelector('[data-ui="lightbox-delete-btn"]');
    },
    get lightboxDownloadBtn() {
        return document.querySelector('[data-ui="lightbox-download-btn"]');
    },
    get lightboxClose() {
        return document.querySelector('[data-ui="lightbox-close"]');
    },
    get lightboxPrev() {
        return document.querySelector('[data-ui="lightbox-prev"]');
    },
    get lightboxNext() {
        return document.querySelector('[data-ui="lightbox-next"]');
    },
    get appLoadingScreen() {
        return document.querySelector('[data-ui="app-loading-screen"]');
    },
    get mainAppContent() {
        return document.querySelector('[data-ui="main-app-content"]');
    },
    // Auth Elements
    get authOverlay() {
        return document.querySelector('[data-ui="auth-overlay"]');
    },
    get authForm() {
        return document.querySelector('[data-ui="auth-form"]');
    },
    get authTitle() {
        return document.querySelector('[data-ui="auth-title"]');
    },
    get authSubtitle() {
        return document.querySelector('[data-ui="auth-subtitle"]');
    },
    get authSubmitBtn() {
        return document.querySelector('[data-ui="auth-submit-btn"]');
    },
    get authToggleBtn() {
        return document.querySelector('[data-ui="auth-toggle-btn"]');
    },
    get authPhoneInput() {
        return document.querySelector('[data-ui="auth-phone"]');
    },
    get authOtpInput() {
        return document.querySelector('[data-ui="auth-otp"]');
    },
    get otpGroup() {
        return document.getElementById('otp-group');
    },
    get editPhoneBtn() {
        return document.getElementById('edit-phone-btn');
    },
    get resendOtpBtn() {
        return document.getElementById('resend-otp-btn');
    },
    get recaptchaContainer() {
        return document.getElementById('recaptcha-container');
    },
    get authFullnameInput() {
        return document.querySelector('[data-ui="auth-fullname"]');
    },
    get authProfilePhotoPreview() {
        return document.querySelector('[data-ui="auth-profile-photo-preview"]');
    },
    get uploadAuthProfilePhotoBtn() {
        return document.querySelector('[data-ui="upload-auth-profile-photo"]');
    },
    get authProfilePhotoInput() {
        return document.querySelector('[data-ui="auth-profile-photo-input"]');
    },
    get removeAuthProfilePhotoBtn() {
        return document.querySelector('[data-ui="remove-auth-profile-photo"]');
    },
    get logoutBtn() {
        return document.querySelector('[data-ui="nav-logout"]');
    },
    get rememberMeCheckbox() {
        return document.querySelector('[data-ui="remember-me"]');
    },
    get authOptions() {
        return document.querySelector('[data-ui="auth-options"]');
    },
    // Profile Elements
    get profileNav() {
        return document.querySelector('[data-ui="nav-profile"]');
    },
    get profileModal() {
        return document.querySelector('[data-ui="profile-modal"]');
    },
    get profileForm() {
        return document.querySelector('[data-ui="profile-form"]');
    },
    get profileNameInput() {
        return document.querySelector('[data-ui="profile-name"]');
    },
    get profileNotificationsInput() {
        return document.querySelector('[data-ui="profile-notifications"]');
    },
    get profileSecurityNotifsInput() {
        return document.querySelector('[data-ui="profile-security-notifs"]');
    },
    get notificationSettingsModal() {
        return document.querySelector('[data-ui="notification-settings-modal"]');
    },
    get closeNotificationSettingsModalBtn() {
        return document.querySelector('[data-ui="close-notification-settings-modal"]');
    },
    get privacyWhoCanMessageInput() {
        return document.querySelector('[data-ui="privacy-who-can-message"]');
    },
    get privacyWhoCanViewShopInput() {
        return document.querySelector('[data-ui="privacy-who-can-view-shop"]');
    },
    get privacyReadReceiptsInput() {
        return document.querySelector('[data-ui="privacy-read-receipts"]');
    },
    get privacyLastSeenInput() {
        return document.querySelector('[data-ui="privacy-last-seen"]');
    },
    get privacyOnlineInput() {
        return document.querySelector('[data-ui="privacy-online"]');
    },
    get privacyProfilePhotoInput() {
        return document.querySelector('[data-ui="privacy-profile-photo"]');
    },
    get privacyAboutInput() {
        return document.querySelector('[data-ui="privacy-about"]');
    },
    get privacyDefaultTimerInput() {
        return document.querySelector('[data-ui="privacy-default-timer"]');
    },
    get notificationSettingsForm() {
        return document.querySelector('[data-ui="notification-settings-form"]');
    },
    get notificationToneSelect() {
        return document.querySelector('[data-ui="notification-tone-select"]');
    },
    get vibrateOnNotificationInput() {
        return document.querySelector('[data-ui="vibrate-on-notification"]');
    },
    get pushNotificationsToggle() {
        return document.querySelector('[data-ui="push-notifications-toggle"]');
    },
    get fcmTokenSection() {
        return document.getElementById('fcm-token-section');
    },
    get fcmStatusText() {
        return document.getElementById('fcm-status-text');
    },
    get copyFcmTokenBtn() {
        return document.querySelector('[data-ui="copy-fcm-token-btn"]');
    },
    get fcmTokenPreview() {
        return document.getElementById('fcm-token-preview');
    },
    get deleteCustomToneBtn() {
        return document.querySelector('[data-ui="delete-custom-tone-btn"]');
    },
    get uploadCustomToneBtn() {
        return document.querySelector('[data-ui="upload-custom-tone-btn"]');
    },
    get customNotificationToneInput() {
        return document.querySelector('[data-ui="custom-notification-tone-input"]');
    },
    get callRingtoneSelect() {
        return document.querySelector('[data-ui="call-ringtone-select"]');
    },
    get shopAccessModal() {
        return document.querySelector('[data-ui="shop-access-modal"]');
    },
    get closeShopAccessModalBtn() {
        return document.querySelector('[data-ui="close-shop-access-modal"]');
    },
    get confirmShopAccessBtn() {
        return document.querySelector('[data-ui="confirm-shop-access-btn"]');
    },
    get cancelShopAccessBtn() {
        return document.querySelector('[data-ui="cancel-shop-access-btn"]');
    },
    get shopAccessText() {
        return document.querySelector('[data-ui="shop-access-text"]');
    },
    get shopAccessAvatar() {
        return document.querySelector('[data-ui="shop-access-avatar"]');
    },
    get vibrateOnCallInput() {
        return document.querySelector('[data-ui="vibrate-on-call"]');
    },
    // New Settings Modal Elements
    get settingsModal() {
        return document.querySelector('[data-ui="settings-modal"]');
    },
    get closeSettingsModalBtn() {
        return document.querySelector('[data-ui="close-settings-modal"]');
    },
    get settingsProfileBtn() {
        return document.querySelector('[data-ui="settings-profile-btn"]');
    },
    get settingsAccountBtn() {
        return document.querySelector('[data-ui="settings-account-btn"]');
    },
    get settingsPrivacyBtn() {
        return document.querySelector('[data-ui="settings-privacy-btn"]');
    },
    get settingsNotificationBtn() {
        return document.querySelector('[data-ui="settings-notification-btn"]');
    },
    get privacyRestrictedModal() {
        return document.querySelector('[data-ui="privacy-restricted-modal"]');
    },
    get privacyRestrictedAvatar() {
        return document.querySelector('[data-ui="privacy-restricted-avatar"]');
    },
    get privacyRestrictedMessage() {
        return document.querySelector('[data-ui="privacy-restricted-message"]');
    },
    get viewRestrictedProfileBtn() {
        return document.querySelector('[data-ui="view-restricted-profile-btn"]');
    },
    get unblockRestrictedBtn() {
        return document.querySelector('[data-ui="unblock-restricted-btn"]');
    },
    get goToPrivacySettingsBtn() {
        return document.querySelector('[data-ui="go-to-privacy-settings-btn"]');
    },
    get goToPrivacyRestrictedSettingsBtn() {
        return document.querySelector('[data-ui="go-to-privacy-restricted-settings-btn"]');
    },
    get closePrivacyRestrictedModalBtn() {
        return document.querySelector('[data-ui="close-privacy-restricted-modal"]');
    },
    get sendRestrictedRequestBtn() {
        return document.querySelector('[data-ui="send-restricted-request-btn"]');
    },
    get cancelRestrictedRequestBtn() {
        return document.querySelector('[data-ui="cancel-restricted-request-btn"]');
    },
    get cancelRestrictedModalBtn() {
        return document.querySelector('[data-ui="cancel-restricted-modal-btn"]');
    },
    get whyRestrictedLink() {
        return document.querySelector('[data-ui="why-restricted-link"]');
    },
    get whyRestrictedRestrictedLink() {
        return document.querySelector('[data-ui="why-restricted-restricted-link"]');
    },
    get chatSettingsModal() {
        return document.querySelector('[data-ui="chat-settings-modal"]');
    },
    get imageEditorModal() {
        return document.querySelector('[data-ui="image-editor-modal"]');
    },
    get imageEditorCanvas() {
        return document.querySelector('[data-ui="image-editor-canvas"]');
    },
    get imageEditorCropBtn() {
        return document.querySelector('[data-ui="image-editor-crop"]');
    },
    get imageEditorRotateBtn() {
        return document.querySelector('[data-ui="image-editor-rotate"]');
    },
    get imageEditorAddTextBtn() {
        return document.querySelector('[data-ui="image-editor-add-text"]');
    },
    get imageEditorStickersToggle() {
        return document.querySelector('[data-ui="image-editor-stickers-toggle"]');
    },
    get imageEditorStickers() {
        return document.querySelector('[data-ui="image-editor-stickers"]');
    },
    get imageEditorBrushSize() {
        return document.querySelector('[data-ui="image-editor-brush-size"]');
    },
    get imageEditorBrushColor() {
        return document.querySelector('[data-ui="image-editor-brush-color"]');
    },
    get imageEditorSaveBtn() {
        return document.querySelector('[data-ui="image-editor-save"]');
    },
    get imageEditorCancelBtn() {
        return document.querySelector('[data-ui="image-editor-cancel"]');
    },
    get imageEditorClearBtn() {
        return document.querySelector('[data-ui="image-editor-clear"]');
    },
    get imageEditorUndoBtn() {
        return document.querySelector('[data-ui="image-editor-undo"]');
    },
    get sentBubbleColorPicker() {
        return document.querySelector('[data-ui="sent-bubble-color-picker"]');
    },
    get receivedBubbleColorPicker() {
        return document.querySelector('[data-ui="received-bubble-color-picker"]');
    },
    get sendOnEnterCheckbox() {
        return document.querySelector('[data-ui="send-on-enter-checkbox"]');
    },
    get chatMessageFontSizeSlider() {
        return document.querySelector('[data-ui="chat-message-font-size-slider"]');
    },
    get chatMessageFontSizeValue() {
        return document.querySelector('[data-ui="chat-message-font-size-value"]');
    },
    get chatFontStyleSelect() {
        return document.querySelector('[data-ui="chat-font-style-select"]');
    },
    get chatFontPreview() {
        return document.querySelector('[data-ui="chat-font-preview"]');
    },
    get saveChatSettingsBtn() {
        return document.querySelector('[data-ui="save-chat-settings-btn"]');
    },
    get resetMessageFontBtn() {
        return document.querySelector('[data-ui="reset-message-font-btn"]');
    },
    get resetChatColorsBtn() {
        return document.querySelector('[data-ui="reset-chat-colors-btn"]');
    },
    get closeChatSettingsModalBtn() {
        return document.querySelector('[data-ui="close-chat-settings-modal"]');
    },
    get chatBgPreviewContainer() {
        return document.querySelector('[data-ui="chat-bg-preview-container"]');
    },
    get docSignModal() {
        return document.querySelector('[data-ui="doc-sign-modal"]');
    },
    get docSignCanvas() {
        return document.querySelector('[data-ui="doc-sign-canvas"]');
    },
    get docSignBrushSize() {
        return document.querySelector('[data-ui="doc-sign-brush-size"]');
    },
    get docSignBrushColor() {
        return document.querySelector('[data-ui="doc-sign-brush-color"]');
    },
    get docSignSaveBtn() {
        return document.querySelector('[data-ui="doc-sign-save"]');
    },
    get docSignCancelBtn() {
        return document.querySelector('[data-ui="doc-sign-cancel"]');
    },
    get docSignClearBtn() {
        return document.querySelector('[data-ui="doc-sign-clear"]');
    },
    get attachChoiceModal() {
        return document.querySelector('[data-ui="attach-choice-modal"]');
    },
    get attachChoiceEditBtn() {
        return document.querySelector('[data-ui="attach-choice-edit"]');
    },
    get attachChoiceSignBtn() {
        return document.querySelector('[data-ui="attach-choice-sign"]');
    },
    get attachChoiceSendOriginalBtn() {
        return document.querySelector('[data-ui="attach-choice-send-original"]');
    },
    get attachChoiceCancelBtn() {
        return document.querySelector('[data-ui="attach-choice-cancel"]');
    },
    get uploadChatBgBtn() {
        return document.querySelector('[data-ui="upload-chat-bg-btn"]');
    },
    get removeChatBgBtn() {
        return document.querySelector('[data-ui="remove-chat-bg-btn"]');
    },
    get chatBgImageInput() {
        return document.querySelector('[data-ui="chat-bg-image-input"]');
    },
    get chatBgOpacitySlider() {
        return document.querySelector('[data-ui="chat-bg-opacity-slider"]');
    },
    get chatBgColorPicker() {
        return document.querySelector('[data-ui="chat-bg-color-picker"]');
    },
    get sentBubbleTextColorPicker() {
        return document.querySelector('[data-ui="sent-bubble-text-color-picker"]');
    },
    get receivedBubbleTextColorPicker() {
        return document.querySelector('[data-ui="received-bubble-text-color-picker"]');
    },
    get resetChatBgBtn() {
        return document.querySelector('[data-ui="reset-chat-bg-btn"]');
    },
    get chatGradientPresets() {
        return document.querySelector('[data-ui="chat-gradient-presets"]');
    },
    get chatBgOpacitySlider() {
        return document.querySelector('[data-ui="chat-bg-opacity-slider"]');
    },
    get chatBgOpacityValue() {
        return document.querySelector('[data-ui="chat-bg-opacity-value"]');
    },
    get chatBgBlurSlider() {
        return document.querySelector('[data-ui="chat-bg-blur-slider"]');
    },
    get chatBgBlurValue() {
        return document.querySelector('[data-ui="chat-bg-blur-value"]');
    },
    get chatBgPreviewContainer() {
        return document.querySelector('[data-ui="chat-bg-preview-container"]');
    },
    get uploadChatBgBtn() {
        return document.querySelector('[data-ui="upload-chat-bg-btn"]');
    },
    get removeChatBgBtn() {
        return document.querySelector('[data-ui="remove-chat-bg-btn"]');
    },
    get chatBgImageInput() {
        return document.querySelector('[data-ui="chat-bg-image-input"]');
    },
    get settingsStorageDataBtn() {
        return document.querySelector('[data-ui="settings-storage-data-btn"]');
    },
    get storageSettingsModal() {
        return document.querySelector('[data-ui="storage-settings-modal"]');
    },
    get closeStorageSettingsModalBtn() {
        return document.querySelector('[data-ui="close-storage-settings-modal"]');
    },
    get manageStorageBtn() {
        return document.querySelector('[data-ui="settings-manage-storage-btn"]');
    },
    get networkUsageBtn() {
        return document.querySelector('[data-ui="settings-network-usage-btn"]');
    },
    get useLessDataCallsCheckbox() {
        return document.querySelector('[data-ui="use-less-data-calls"]');
    },
    get autoDownloadMobileBtn() {
        return document.querySelector('[data-ui="auto-download-mobile-btn"]');
    },
    get autoDownloadWifiBtn() {
        return document.querySelector('[data-ui="auto-download-wifi-btn"]');
    },
    get autoDownloadRoamingBtn() {
        return document.querySelector('[data-ui="auto-download-roaming-btn"]');
    },
    get uploadQualityBtn() {
        return document.querySelector('[data-ui="upload-quality-btn"]');
    },
    get proxySettingsBtn() {
        return document.querySelector('[data-ui="proxy-settings-btn"]');
    },
    get manageStorageModal() {
        return document.querySelector('[data-ui="manage-storage-modal"]');
    },
    get closeManageStorageModalBtn() {
        return document.querySelector('[data-ui="close-manage-storage-modal"]');
    },
    get storageProgressApp() {
        return document.querySelector('[data-ui="storage-progress-app"]');
    },
    get storageProgressOther() {
        return document.querySelector('[data-ui="storage-progress-other"]');
    },
    get storageProgressFree() {
        return document.querySelector('[data-ui="storage-progress-free"]');
    },
    get storageUsageAppText() {
        return document.querySelector('[data-ui="storage-usage-app-text"]');
    },
    get storageUsageFreeText() {
        return document.querySelector('[data-ui="storage-usage-free-text"]');
    },
    get manageStorageChatsList() {
        return document.querySelector('[data-ui="manage-storage-chats-list"]');
    },
    get manageStorageReview5mb() {
        return document.querySelector('[data-ui="manage-storage-review-5mb"]');
    },
    get chatStorageViewModal() {
        return document.querySelector('[data-ui="chat-storage-view-modal"]');
    },
    get closeChatStorageViewBtn() {
        return document.querySelector('[data-ui="close-chat-storage-view"]');
    },
    get chatStorageTitle() {
        return document.querySelector('[data-ui="chat-storage-title"]');
    },
    get chatStorageUsage() {
        return document.querySelector('[data-ui="chat-storage-usage"]');
    },
    get chatStorageMediaGrid() {
        return document.querySelector('[data-ui="chat-storage-media-grid"]');
    },
    get chatStorageSelectAllBtn() {
        return document.querySelector('[data-ui="chat-storage-select-all"]');
    },
    get chatStorageDeleteBtn() {
        return document.querySelector('[data-ui="chat-storage-delete"]');
    },
    get networkUsageModal() {
        return document.querySelector('[data-ui="network-usage-modal"]');
    },
    get closeNetworkUsageModalBtn() {
        return document.querySelector('[data-ui="close-network-usage-modal"]');
    },
    get networkUsageList() {
        return document.querySelector('[data-ui="network-usage-list"]');
    },
    get resetNetworkStatsBtn() {
        return document.querySelector('[data-ui="reset-network-stats-btn"]');
    },
    get autoDownloadModal() {
        return document.querySelector('[data-ui="auto-download-modal"]');
    },
    get closeAutoDownloadModalBtn() {
        return document.querySelector('[data-ui="close-auto-download-modal"]');
    },
    get autoDownloadTitle() {
        return document.querySelector('[data-ui="auto-download-title"]');
    },
    get autoDownloadOptions() {
        return document.querySelector('[data-ui="auto-download-options"]');
    },
    get saveAutoDownloadBtn() {
        return document.querySelector('[data-ui="save-auto-download-btn"]');
    },
    get uploadQualityModal() {
        return document.querySelector('[data-ui="upload-quality-modal"]');
    },
    get closeUploadQualityModalBtn() {
        return document.querySelector('[data-ui="close-upload-quality-modal"]');
    },
    get saveUploadQualityBtn() {
        return document.querySelector('[data-ui="save-upload-quality-btn"]');
    },
    get proxySettingsModal() {
        return document.querySelector('[data-ui="proxy-settings-modal"]');
    },
    get closeProxySettingsModalBtn() {
        return document.querySelector('[data-ui="close-proxy-settings-modal"]');
    },
    get proxyEnabledCheckbox() {
        return document.querySelector('[data-ui="proxy-enabled"]');
    },
    get proxyHostInput() {
        return document.querySelector('[data-ui="proxy-host"]');
    },
    get proxyPortInput() {
        return document.querySelector('[data-ui="proxy-port"]');
    },
    get proxyUsernameInput() {
        return document.querySelector('[data-ui="proxy-username"]');
    },
    get proxyPasswordInput() {
        return document.querySelector('[data-ui="proxy-password"]');
    },
    get saveProxySettingsBtn() {
        return document.querySelector('[data-ui="save-proxy-settings-btn"]');
    },
    get settingsChatBtn() {
        return document.querySelector('[data-ui="settings-chat-btn"]');
    },
    get settingsThemeBtn() {
        return document.querySelector('[data-ui="settings-theme-btn"]');
    },
    get themeModal() {
        return document.querySelector('[data-ui="theme-modal"]');
    },
    get closeThemeModalBtn() {
        return document.querySelector('[data-ui="close-theme-modal"]');
    },
    get themeOptionsList() {
        return document.querySelector('[data-ui="theme-options-list"]');
    },
    get settingsAppLanguageBtn() {
        return document.querySelector('[data-ui="settings-app-language-btn"]');
    },
    get languageModal() {
        return document.querySelector('[data-ui="language-modal"]');
    },
    get closeLanguageModalBtn() {
        return document.querySelector('[data-ui="close-language-modal"]');
    },
    get saveLanguageBtn() {
        return document.getElementById('save-language-btn');
    },
    get languageOptions() {
        return document.querySelectorAll('[name="app-language-opt"]');
    },
    get shopCategoryDisplay() {
        return document.querySelector('[data-ui="shop-category-display"]');
    },
    get shopNameDisplay() {
        return document.querySelector('[data-ui="shop-name-display"]');
    },
    get settingsInviteContactBtn() {
        return document.querySelector('[data-ui="settings-invite-contact-btn"]');
    },
    get settingsReloadAppBtn() {
        return document.querySelector('[data-ui="settings-reload-app-btn"]');
    },
    get deleteAccountModal() {
        return document.querySelector('[data-ui="delete-account-modal"]');
    },
    get closeDeleteAccountModalBtn() {
        return document.querySelector('[data-ui="close-delete-account-modal"]');
    },
    get cancelDeleteAccountBtn() {
        return document.querySelector('[data-ui="cancel-delete-account-btn"]');
    },
    get settingsSwitchAccountBtn() {
        return document.querySelector('[data-ui="settings-switch-account-btn"]');
    },
    // Account Modal Elements
    get accountModal() {
        return document.querySelector('[data-ui="account-modal"]');
    },
    get accountForm() {
        return document.querySelector('[data-ui="account-form"]');
    },
    get closeAccountModalBtn() {
        return document.querySelector('[data-ui="close-account-modal"]');
    },
    get accountNewName() {
        return document.querySelector('[data-ui="account-new-name"]');
    },
    get accountNewPhone() {
        return document.querySelector('[data-ui="account-new-phone"]');
    },
    get accountNewPhoneError() {
        return document.querySelector('[data-ui="account-new-phone-error"]');
    },
    get accountPhoneOtp() {
        return document.querySelector('[data-ui="account-phone-otp"]');
    },
    get accountPhoneOtpError() {
        return document.querySelector('[data-ui="account-phone-otp-error"]');
    },
    get accountPhoneOtpGroup() {
        return document.querySelector('[data-ui="account-phone-otp-group"]');
    },
    get accountChangePhoneBtn() {
        return document.querySelector('[data-ui="account-change-phone-btn"]');
    },
    get deleteAccountBtn() {
        return document.querySelector('[data-ui="delete-account-btn"]');
    },
    // Privacy Modal Elements
    get privacyModal() {
        return document.querySelector('[data-ui="privacy-modal"]');
    },
    get privacyForm() {
        return document.querySelector('[data-ui="privacy-form"]');
    },
    get closePrivacyModalBtn() {
        return document.querySelector('[data-ui="close-privacy-modal"]');
    },
    get manageBlockedUsersBtn() {
        return document.querySelector('[data-ui="manage-blocked-users-btn"]');
    },
    get blockedUsersModal() {
        return document.querySelector('[data-ui="blocked-users-modal"]');
    },
    get closeBlockedUsersModalBtn() {
        return document.querySelector('[data-ui="close-blocked-users-modal"]');
    },
    get blockedUsersCountLabel() {
        return document.querySelector('[data-ui="blocked-users-count-label"]');
    },
    get unblockAllBtn() {
        return document.querySelector('[data-ui="unblock-all-btn"]');
    },
    // App Lock Elements
    get privacyAppLockInput() {
        return document.querySelector('[data-ui="privacy-app-lock"]');
    },
    get privacyBiometricInput() {
        return document.querySelector('[data-ui="privacy-biometric-lock"]');
    },
    get privacyAppLockPinInput() {
        return document.querySelector('[data-ui="privacy-app-lock-pin"]');
    },
    get privacyCurrentPinInput() {
        return document.querySelector('[data-ui="privacy-current-pin"]');
    },
    get verifyCurrentPinGroup() {
        return document.querySelector('[data-ui="verify-current-pin-group"]');
    },
    get toggleCurrentPinBtn() {
        return document.querySelector('[data-ui="toggle-current-pin-btn"]');
    },
    get copyPrivacyPinBtn() {
        return document.querySelector('[data-ui="copy-privacy-pin-btn"]');
    },
    get clearPrivacyPinBtn() {
        return document.querySelector('[data-ui="clear-privacy-pin-btn"]');
    },
    get pinInputLabel() {
        return document.getElementById('pin-input-label');
    },
    get generatePrivacyPinBtn() {
        return document.querySelector('[data-ui="generate-privacy-pin-btn"]');
    },
    get togglePrivacyPinBtn() {
        return document.querySelector('[data-ui="toggle-privacy-pin-btn"]');
    },
    get appLockPinGroup() {
        return document.querySelector('[data-ui="app-lock-pin-group"]');
    },
    get privacyAppLockDurationInput() {
        return document.querySelector('[data-ui="privacy-app-lock-duration"]');
    },
    get appLockDurationGroup() {
        return document.querySelector('[data-ui="app-lock-duration-group"]');
    },
    get appLockOverlay() {
        return document.querySelector('[data-ui="app-lock-overlay"]');
    },
    get appLockInput() {
        return document.querySelector('[data-ui="app-lock-input"]');
    },
    get appLockInputGroup() {
        return document.querySelector('[data-ui="app-lock-input-group"]');
    },
    get toggleAppLockPinBtn() {
        return document.querySelector('[data-ui="toggle-app-lock-pin-btn"]');
    },
    get appLockRecoveryInput() {
        return document.querySelector('[data-ui="app-lock-recovery-input"]');
    },
    get appLockRecoveryGroup() {
        return document.querySelector('[data-ui="app-lock-recovery-group"]');
    },
    get toggleAppLockRecoveryBtn() {
        return document.querySelector('[data-ui="toggle-app-lock-recovery-btn"]');
    },
    get appLockHeader() {
        return document.querySelector('[data-ui="app-lock-header"]');
    },
    get appLockRecoveryHeader() {
        return document.querySelector('[data-ui="app-lock-recovery-header"]');
    },
    get unlockAppBtn() {
        return document.querySelector('[data-ui="unlock-app-btn"]');
    },
    get biometricUnlockBtn() {
        return document.querySelector('[data-ui="biometric-unlock-btn"]');
    },
    get appLockErrorMsg() {
        return document.querySelector('[data-ui="app-lock-error-msg"]');
    },
    get appLockAttemptsMsg() {
        return document.querySelector('[data-ui="app-lock-attempts-msg"]');
    },
    get verifyRecoveryCodeBtn() {
        return document.querySelector('[data-ui="verify-recovery-code-btn"]');
    },
    get forgotAppLockPinBtn() {
        return document.querySelector('[data-ui="forgot-app-lock-pin-btn"]');
    },
    get backToAppLockBtn() {
        return document.querySelector('[data-ui="back-to-app-lock-btn"]');
    },
    get appLockLogoutBtn() {
        return document.querySelector('[data-ui="app-lock-logout-btn"]');
    },
    get clearBlockedSearchBtn() {
        return document.querySelector('[data-ui="clear-blocked-search-btn"]');
    },
    get blockedUsersSearch() {
        return document.querySelector('[data-ui="blocked-users-search"]');
    },
    get blockedUsersList() {
        return document.querySelector('[data-ui="blocked-users-list"]');
    },
    get blockUserText() {
        return document.querySelector('[data-ui="block-user-text"]');
    },
    get profileLogoutBtn() {
        return document.querySelector('[data-ui="profile-logout-btn"]');
    },
    get profilePhotoPreview() {
        return document.querySelector('[data-ui="profile-photo-preview"]');
    },
    get profilePhotoInput() {
        return document.querySelector('[data-ui="profile-photo-input"]');
    },
    get uploadProfilePhotoBtn() {
        return document.querySelector('[data-ui="upload-profile-photo"]');
    },
    get captureProfilePhotoBtn() {
        return document.querySelector('[data-ui="capture-profile-photo"]');
    },
    get deleteProfilePhotoBtn() {
        return document.querySelector('[data-ui="delete-profile-photo"]');
    },
    get updateBusinessInfoBtn() {
        return document.querySelector('[data-ui="update-business-info-btn"]');
    },
    get storeMenuBtn() {
        return document.querySelector('[data-ui="store-menu-btn"]');
    },
    get storeRefreshBtn() {
        return document.querySelector('[data-ui="store-refresh-btn"]');
    },
    get storeHeaderMenu() {
        return document.querySelector('[data-ui="store-header-menu"]');
    },
    get storeMenuAddProduct() {
        return document.querySelector('[data-ui="store-menu-add-product"]');
    },
    get storeMenuUpdateBusiness() {
        return document.querySelector('[data-ui="store-menu-update-business"]');
    },
    get storeSearchToggleBtn() {
        return document.querySelector('[data-ui="store-search-toggle-btn"]');
    },
    get storeSearchOverlay() {
        return document.querySelector('[data-ui="store-search-overlay"]');
    },
    get closeStoreSearchBtn() {
        return document.querySelector('[data-ui="close-store-search-btn"]');
    },
    get storeSearchInputMobile() {
        return document.querySelector('[data-ui="store-search-input-mobile"]');
    },
    get storeSearchContainer() {
        return document.querySelector('[data-ui="store-search-container"]');
    },
    get storeHeaderTitle() {
        return document.querySelector('[data-ui="store-header-title"]');
    },
    get businessRegistrationModal() {
        return document.querySelector('[data-ui="business-registration-modal"]');
    },
    get viewBusinessProfileBtn() {
        return document.querySelector('[data-ui="view-business-profile-btn"]');
    },
    // Wizard elements
    get wizardProgress() {
        return document.querySelector('[data-ui="wizard-progress"]');
    },
    get wizardProgressBarFill() {
        return document.querySelector('[data-ui="wizard-progress-bar-fill"]');
    },
    get progressSteps() {
        return document.querySelectorAll('.wizard-progress .progress-step');
    },
    get wizardSteps() {
        return document.querySelectorAll('.wizard-step');
    },
    get nextStepBtns() {
        return document.querySelectorAll('[data-ui="next-step-btn"]');
    },
    get prevStepBtns() {
        return document.querySelectorAll('[data-ui="prev-step-btn"]');
    },
    get skipToReviewBtns() {
        return document.querySelectorAll('[data-ui="skip-to-review-btn"]');
    },
    get registrationReviewContent() {
        return document.querySelector('[data-ui="registration-review-content"]');
    },
    get businessProfileModal() {
        return document.querySelector('[data-ui="business-profile-modal"]');
    },
    get businessProfileContent() {
        return document.querySelector('[data-ui="business-profile-content"]');
    },
    get closeBusinessProfileModalBtn() {
        return document.querySelector('[data-ui="close-business-profile-modal"]');
    },
    get deleteBusinessBtn() {
        return document.querySelector('[data-ui="delete-business-btn"]');
    },
    get refreshLocationCacheBtn() {
        return document.querySelector('[data-ui="refresh-location-cache-btn"]');
    },
    get starredNav() {
        return document.querySelector('[data-ui="nav-starred"]');
    },
    get chatsNav() {
        return document.querySelector('[data-ui="nav-chats"]');
    },
    get headerEllipsisBtn() {
        return document.querySelector('[data-ui="header-ellipsis-btn"]');
    },
    get headerDropdownMenu() {
        return document.querySelector('[data-ui="header-dropdown-menu"]');
    },
    get callsNav() {
        return document.querySelector('[data-ui="nav-calls"]');
    },
    get generalMarketNav() {
        return document.querySelector('[data-ui="nav-general-market"]');
    },
    get customersNav() {
        return document.querySelector('[data-ui="nav-customers"]');
    },
    get generalMarketArea() {
        return document.querySelector('[data-ui="general-market-area"]');
    },
    get generalMarketProductGrid() {
        return document.querySelector('[data-ui="general-market-product-grid"]');
    },
    get generalMarketSearchInput() {
        return document.querySelector('[data-ui="general-market-search-input"]');
    },
    get generalMarketCategoryFilter() {
        return document.querySelector('[data-ui="general-market-category-filter"]');
    },
    get generalMarketSortSelect() {
        return document.querySelector('[data-ui="general-market-sort-select"]');
    },
    get generalMarketDistanceFilterSlider() {
        return document.querySelector('[data-ui="general-market-distance-filter-slider"]');
    },
    get generalMarketVerifiedFilter() {
        return document.querySelector('[data-ui="general-market-verified-filter"]');
    },
    get generalMarketClearFiltersBtn() {
        return document.querySelector('[data-ui="general-market-clear-filters-btn"]');
    },
    get generalMarketVerifiedCount() {
        return document.querySelector('[data-ui="general-market-verified-count"]');
    },
    get generalMarketDistanceFilterValue() {
        return document.querySelector('[data-ui="general-market-distance-filter-value"]');
    },
    get marketHeaderTitle() {
        return document.querySelector('[data-ui="market-header-title"]');
    },
    get marketSearchOverlay() {
        return document.querySelector('[data-ui="market-search-overlay"]');
    },
    get closeMarketSearchBtn() {
        return document.querySelector('[data-ui="close-market-search-btn"]');
    },
    get marketSearchInputMobile() {
        return document.querySelector('[data-ui="market-search-input-mobile"]');
    },
    get marketMenuWrapper() {
        return document.querySelector('[data-ui="market-menu-wrapper"]');
    },
    get marketSearchToggleBtn() {
        return document.querySelector('[data-ui="market-search-toggle-btn"]');
    },
    get marketRefreshBtn() {
        return document.querySelector('[data-ui="market-refresh-btn"]');
    },
    get marketScrollTopBtn() {
        return document.querySelector('[data-ui="market-scroll-top-btn"]');
    },
    get storeScrollTopBtn() {
        return document.querySelector('[data-ui="store-scroll-top-btn"]');
    },
    get shopScrollTopBtn() {
        return document.querySelector('[data-ui="shop-scroll-top-btn"]');
    },
    get marketFilterToggleBtn() {
        return document.querySelector('[data-ui="market-filter-toggle-btn"]');
    },
    get marketFilterBadge() {
        return document.querySelector('[data-ui="market-filter-badge"]');
    },
    get marketFilterDrawer() {
        return document.querySelector('[data-ui="market-filter-drawer"]');
    },
    get marketCategoryFilterMobile() {
        return document.querySelector('[data-ui="market-category-filter-mobile"]');
    },
    get marketSortSelectMobile() {
        return document.querySelector('[data-ui="market-sort-select-mobile"]');
    },
    get marketDistanceFilterSliderMobile() {
        return document.querySelector('[data-ui="market-distance-filter-slider-mobile"]');
    },
    get marketDistanceFilterValueMobile() {
        return document.querySelector('[data-ui="market-distance-filter-value-mobile"]');
    },
    // Recently Viewed
    get recentlyViewedContainer() {
        return document.querySelector('[data-ui="recently-viewed-container"]');
    },
    get recentlyViewedGrid() {
        return document.querySelector('[data-ui="recently-viewed-grid"]');
    },
    get storeCategoryFilter() {
        return document.querySelector('[data-ui="store-category-filter"]');
    },
    get existingCategoriesList() {
        return document.getElementById('existing-categories');
    },
    get archivedNav() {
        return document.querySelector('[data-ui="nav-archived"]');
    },
    get archivedSidebar() {
        return document.querySelector('[data-ui="archived-sidebar"]');
    },
    get archivedConversationList() {
        return document.querySelector('[data-ui="archived-conversation-list"]');
    },
    get generalMarketNoResultsMessage() {
        return document.querySelector('[data-ui="general-market-no-results-message"]');
    },
    get storeNav() {
        return document.querySelector('[data-ui="nav-store"]');
    },
    get clearCallHistoryBtn() {
        return document.querySelector('[data-ui="clear-call-history-btn"]');
    },
    get starredSidebar() {
        return document.querySelector('[data-ui="starred-sidebar"]');
    },
    get callsSidebar() {
        return document.querySelector('[data-ui="calls-sidebar"]');
    },
    get callHistorySearch() {
        return document.querySelector('[data-ui="call-history-search"]');
    },
    get callHistoryList() {
        return document.querySelector('[data-ui="call-history-list"]');
    },
    get starredMessagesList() {
        return document.querySelector('[data-ui="starred-messages-list"]');
    },
    get unstarAllBtn() {
        return document.querySelector('[data-ui="unstar-all-btn"]');
    },
    get closeProfileModalBtn() {
        return document.querySelector('[data-ui="close-profile-modal"]');
    },
    get logoutModal() {
        return document.querySelector('[data-ui="logout-modal"]');
    },
    get confirmLogoutBtn() {
        return document.querySelector('[data-ui="confirm-logout-btn"]');
    },
    get cancelLogoutBtn() {
        return document.querySelector('[data-ui="cancel-logout-btn"]');
    },
    get headerUserName() {
        return document.querySelector('[data-ui="header-user-name"]');
    },
    get headerUserAvatar() {
        return document.querySelector('[data-ui="header-user-avatar"]');
    },
    get replyPreview() {
        return document.querySelector('[data-ui="reply-preview"]');
    },
    get scrollToBottomBtn() {
        return document.querySelector('[data-ui="scroll-to-bottom-btn"]');
    },
    get jumpUnreadBtn() {
        return document.querySelector('[data-ui="jump-unread-btn"]');
    },
    get replyPreviewText() {
        return document.querySelector('[data-ui="reply-preview-text"]');
    },
    get closeReplyBtn() {
        return document.querySelector('[data-ui="close-reply-preview"]');
    },
    get editPreview() {
        return document.querySelector('[data-ui="edit-preview"]');
    },
    get editPreviewText() {
        return document.querySelector('[data-ui="edit-preview-text"]');
    },
    get closeEditBtn() {
        return document.querySelector('[data-ui="close-edit-preview"]');
    },
    get selectionBar() {
        return document.querySelector('[data-ui="selection-bar"]');
    },
    get selectionCount() {
        return document.querySelector('[data-ui="selection-count"]');
    },
    get massDeleteBtn() {
        return document.querySelector('[data-ui="mass-delete-btn"]');
    },
    get massStarBtn() {
        return document.querySelector('[data-ui="mass-star-btn"]');
    },
    get massForwardBtn() {
        return document.querySelector('[data-ui="mass-forward-btn"]');
    },
    get massReplyBtn() {
        return document.querySelector('[data-ui="mass-reply-btn"]');
    },
    get massPinBtn() {
        return document.querySelector('[data-ui="mass-pin-btn"]');
    },
    get selectionEditImageBtn() {
        return document.querySelector('[data-ui="selection-edit-image-btn"]');
    },
    get selectionSignDocumentBtn() {
        return document.querySelector('[data-ui="selection-sign-document-btn"]');
    },
    get selectionEllipsisBtn() {
        return document.querySelector('[data-ui="selection-ellipsis-btn"]');
    },
    get selectionEllipsisMenu() {
        return document.querySelector('[data-ui="selection-ellipsis-menu"]');
    },
    get forwardModal() {
        return document.querySelector('[data-ui="forward-modal"]');
    },
    get closeForwardModalBtn() {
        return document.querySelector('[data-ui="close-forward-modal"]');
    },
    get confirmForwardBtn() {
        return document.querySelector('[data-ui="confirm-forward-btn"]');
    },
    get forwardUserList() {
        return document.querySelector('[data-ui="forward-user-list"]');
    },
    get headerIncomingRequestsBtn() {
        return document.querySelector('[data-ui="header-incoming-requests-btn"]');
    },
    get headerOutgoingRequestsBtn() {
        return document.querySelector('[data-ui="header-outgoing-requests-btn"]');
    },
    get headerRequestsBtn() {
        return this.headerIncomingRequestsBtn || this.headerOutgoingRequestsBtn;
    },
    get headerIncomingRequestBadge() {
        return document.querySelector('[data-ui="header-incoming-request-badge"]');
    },
    get headerOutgoingRequestBadge() {
        return document.querySelector('[data-ui="header-outgoing-request-badge"]');
    },
    get requestCountBadge() {
        return document.querySelector('[data-ui="request-count-badge"]');
    },
    get ephemeralPickerModal() {
        return document.querySelector('[data-ui="ephemeral-picker-modal"]');
    },
    get closeEphemeralPickerModalBtn() {
        return document.querySelector('[data-ui="close-ephemeral-picker-modal"]');
    },
    get ephemeralOptions() {
        return document.querySelector('[data-ui="ephemeral-options"]');
    },
    get muteChatBtn() {
        return document.querySelector('[data-ui="mute-chat-btn"]');
    },
    get forwardSearchInput() {
        return document.querySelector('[data-ui="forward-search-input"]');
    },
    get cartFooter() {
        return document.querySelector('[data-ui="cart-footer"]');
    },
    get cancelSelectionBtn() {
        return document.querySelector('[data-ui="cancel-selection-btn"]');
    },
    get addCustomerBtn() {
        return document.querySelector('[data-ui="add-customer-btn"]');
    },
    get manageCustomersModal() {
        return document.querySelector('[data-ui="manage-customers-modal"]');
    },
    get closeManageCustomersBtn() {
        return document.querySelector('[data-ui="close-manage-customers"]');
    },
    get manageCustomersTabRequests() {
        return document.querySelector('[data-ui="manage-customers-tab-requests"]');
    },
    get manageCustomersTabAdded() {
        return document.querySelector('[data-ui="manage-customers-tab-added"]');
    },
    get manageCustomersTabNew() {
        return document.querySelector('[data-ui="manage-customers-tab-new"]');
    },
    // New PDF Viewer elements
    get pdfViewerModal() {
        return document.querySelector('[data-ui="pdf-viewer-modal"]');
    },
    get pdfViewerTitle() {
        return document.querySelector('[data-ui="pdf-viewer-title"]');
    },
    get pdfViewerSignBtn() {
        return document.querySelector('[data-ui="pdf-viewer-sign-btn"]');
    },
    get pdfViewerIframe() {
        return document.querySelector('[data-ui="pdf-viewer-iframe"]');
    },
    get pdfViewerScrollContainer() {
        return document.querySelector('[data-ui="pdf-viewer-scroll-container"]');
    },
    get closePdfViewerBtn() {
        return document.querySelector('[data-ui="close-pdf-viewer"]');
    },
    get downloadPdfViewerBtn() {
        return document.querySelector('[data-ui="download-pdf-viewer"]');
    },
    get printPdfViewerBtn() {
        return document.querySelector('[data-ui="print-pdf-viewer"]');
    },
    get pdfViewerZoomInBtn() {
        return document.querySelector('[data-ui="pdf-viewer-zoom-in"]');
    },
    get pdfViewerZoomOutBtn() {
        return document.querySelector('[data-ui="pdf-viewer-zoom-out"]');
    },
    get pdfViewerZoomLevel() {
        return document.querySelector('[data-ui="pdf-viewer-zoom-level"]');
    },
    get manageCustomersSelectionBar() {
        return document.querySelector('[data-ui="manage-customers-selection-bar"]');
    },
    // Keep existing elements
    get manageCustomersSelectAll() {
        return document.querySelector('[data-ui="manage-customers-select-all"]');
    },
    // Keep existing elements
    get manageCustomersSelectedCount() {
        return document.querySelector('[data-ui="manage-customers-selected-count"]');
    },
    // Keep existing elements
    get bulkAddCustomersBtn() {
        return document.querySelector('[data-ui="bulk-add-customers"]');
    },
    // Keep existing elements
    get bulkRemoveCustomersBtn() {
        return document.querySelector('[data-ui="bulk-remove-customers"]');
    },
    // Keep existing elements
    get manageUsersList() {
        return document.querySelector('[data-ui="manage-users-list"]');
    },
    get scanQrBtn() {
        return document.querySelector('[data-ui="scan-qr-btn"]');
    },
    get manualUidInput() {
        return document.querySelector('[data-ui="manual-uid-input"]');
    },
    get recentCustomerSearches() {
        return document.querySelector('[data-ui="recent-customer-searches"]');
    },
    get sendManualRequestBtn() {
        return document.querySelector('[data-ui="send-manual-request-btn"]');
    },
    get manageCustomersSearch() {
        return document.querySelector('[data-ui="manage-customers-search"]');
    },
    get reactionPicker() {
        return document.querySelector('[data-ui="reaction-picker"]');
    },
    get reactionDetailModal() {
        return document.querySelector('[data-ui="reaction-detail-modal"]');
    },
    get archivedChatContextMenu() {
        return document.querySelector('[data-ui="archived-chat-context-menu"]');
    },
    get activeChatContextMenu() {
        return document.querySelector('[data-ui="active-chat-context-menu"]');
    },
    get reactionDetailList() {
        return document.querySelector('[data-ui="reaction-detail-list"]');
    },
    get closeReactionDetailModalBtn() {
        return document.querySelector('[data-ui="close-reaction-detail-modal"]');
    },
    // Business Registration Landing Page elements
    get businessRegistrationView() {
        return document.querySelector('[data-ui="business-registration-view"]');
    },
    get storeManagementView() {
        return document.querySelector('[data-ui="store-management-view"]');
    },
    get businessRegistrationForm() {
        return document.querySelector('[data-ui="business-registration-form"]');
    },
    get companyNameInput() {
        return document.querySelector('[data-ui="company-name"]');
    },
    get businessCountrySelect() {
        return document.querySelector('[data-ui="business-country"]');
    },
    get serviceTypeSelect() {
        return document.querySelector('[data-ui="service-type"]');
    },
    get pickupLocationsSection() {
        return document.querySelector('[data-ui="pickup-locations-section"]');
    },
    get pickupLocationsList() {
        return document.querySelector('[data-ui="pickup-locations-list"]');
    },
    get deliveryCoverageSection() {
        return document.querySelector('[data-ui="delivery-coverage-section"]');
    },
    // Removed: deliveryHubLocationsList and addDeliveryHubBtn as they are no longer used for map selection
    get deliveryCoverageTypeSelect() {
        return document.querySelector('[data-ui="delivery-coverage-type"]');
    },
    get deliveryCountriesSection() {
        return document.querySelector('[data-ui="delivery-countries-section"]');
    },
    get deliveryCountriesSelect() {
        return document.querySelector('[data-ui="delivery-countries"]');
    },
    get deliveryStatesSection() {
        return document.querySelector('[data-ui="delivery-states-section"]');
    },
    get deliveryStatesSelect() {
        return document.querySelector('[data-ui="delivery-states"]');
    },
    get deliveryCitiesSection() {
        return document.querySelector('[data-ui="delivery-cities-section"]');
    },
    get deliveryCitiesSelect() {
        return document.querySelector('[data-ui="delivery-cities"]');
    },
    get addPickupLocationBtn() {
        return document.querySelector('[data-ui="add-pickup-location-btn"]');
    },
    get registerBusinessSubmitBtn() {
        return document.querySelector('[data-ui="register-business-submit-btn"]');
    },
    get businessLocationPickerModal() {
        return document.querySelector('[data-ui="business-location-picker-modal"]');
    },
    get closeBusinessLocationPickerModalBtn() {
        return document.querySelector('[data-ui="close-business-location-picker-modal"]');
    },
    get businessLocationSearchInput() {
        return document.querySelector('[data-ui="business-location-search-input"]');
    },
    get businessLocationSearchResults() {
        return document.querySelector('[data-ui="business-location-search-results"]');
    },
    get confirmBusinessLocationBtn() {
        return document.querySelector('[data-ui="confirm-business-location-btn"]');
    },
    get businessLocationMap() {
        return document.querySelector('[data-ui="business-location-map"]');
    },
    get closeBusinessRegistrationModalBtn() {
        return document.querySelector('[data-ui="close-business-registration-modal"]');
    },
    get companyNameError() {
        return document.querySelector('[data-ui="company-name-error"]');
    },
    get businessCountryError() {
        return document.querySelector('[data-ui="business-country-error"]');
    },
    get serviceTypeError() {
        return document.querySelector('[data-ui="service-type-error"]');
    },
    get pickupLocationError() {
        return document.querySelector('[data-ui="pickup-location-error"]');
    },
    get deliveryCoverageError() {
        return document.querySelector('[data-ui="delivery-coverage-error"]');
    },
    get businessUseCurrentLocationBtn() {
        return document.querySelector('[data-ui="business-use-current-location-btn"]');
    },
    // Business Registration Confirmation Modal
    get businessRegistrationConfirmationModal() {
        return document.querySelector('[data-ui="business-registration-confirmation-modal"]');
    },
    get closeRegistrationConfirmationModal() {
        return document.querySelector('[data-ui="close-registration-confirmation-modal"]');
    },
    get registrationConfirmationContent() {
        return document.querySelector('[data-ui="registration-confirmation-content"]');
    },
    get confirmRegistrationBtn() {
        return document.querySelector('[data-ui="confirm-registration-btn"]');
    },
    get cancelRegistrationConfirmationBtn() {
        return document.querySelector('[data-ui="cancel-registration-confirmation-btn"]');
    },
    get deleteLocationModal() {
        return document.querySelector('[data-ui="delete-location-modal"]');
    },
    get confirmDeleteLocationBtn() {
        return document.querySelector('[data-ui="confirm-delete-location-btn"]');
    },
    get cancelDeleteLocationBtn() {
        return document.querySelector('[data-ui="cancel-delete-location-btn"]');
    },
    get deleteLocationPreview() {
        return document.querySelector('[data-ui="delete-location-preview"]');
    },
    get cartDeliverySection() {
        return document.querySelector('[data-ui="cart-delivery-section"]');
    },
    get deliveryMethodPickup() {
        return document.querySelector('[data-ui="delivery-method-pickup"]');
    },
    get deliveryMethodDelivery() {
        return document.querySelector('[data-ui="delivery-method-delivery"]');
    },
    get pickupOptionWrapper() {
        return document.querySelector('[data-ui="pickup-option-wrapper"]');
    },
    get deliveryOptionWrapper() {
        return document.querySelector('[data-ui="delivery-option-wrapper"]');
    },
    get deliveryAddressContainer() {
        return document.querySelector('[data-ui="delivery-address-container"]');
    },
    get deliveryAddressInput() {
        return document.querySelector('[data-ui="delivery-address-input"]');
    },
    get deliveryFeeInput() {
        return document.querySelector('[data-ui="delivery-fee"]');
    },
    get deliveryFeeError() {
        return document.querySelector('[data-ui="delivery-fee-error"]');
    },
    get minFreeDeliveryInput() {
        return document.querySelector('[data-ui="min-free-delivery"]');
    },
    get minFreeDeliveryError() {
        return document.querySelector('[data-ui="min-free-delivery-error"]');
    },
    get deliveryAddressCharCount() {
        return document.querySelector('[data-ui="delivery-address-char-count"]');
    },
    get pickDeliveryLocationBtn() {
        return document.querySelector('[data-ui="pick-delivery-location-btn"]');
    },
    get gpsAddressBtn() {
        return document.querySelector('[data-ui="gps-address-btn"]');
    },
    get saveAddressCheckbox() {
        return document.querySelector('[data-ui="save-address-checkbox"]');
    },
    get toggleAddressModeBtn() {
        return document.querySelector('[data-ui="toggle-address-mode-btn"]');
    },
    get simpleAddressContainer() {
        return document.querySelector('[data-ui="simple-address-container"]');
    },
    get structuredAddressContainer() {
        return document.querySelector('[data-ui="structured-address-container"]');
    },
    get addrStreet() {
        return document.querySelector('[data-ui="addr-street"]');
    },
    get addrApartment() {
        return document.querySelector('[data-ui="addr-apartment"]');
    },
    get addrCity() {
        return document.querySelector('[data-ui="addr-city"]');
    },
    get addrState() {
        return document.querySelector('[data-ui="addr-state"]');
    },
    get privacyBlockNotice() {
        return document.querySelector('[data-ui="privacy-block-notice"]');
    },
    get blockReasonModal() {
        return document.querySelector('[data-ui="block-reason-modal"]');
    },
    get closeBlockReasonModalBtn() {
        return document.querySelector('[data-ui="close-block-reason-modal"]');
    },
    get confirmBlockBtn() {
        return document.querySelector('[data-ui="confirm-block-btn"]');
    },
    get cancelBlockReasonBtn() {
        return document.querySelector('[data-ui="cancel-block-reason-btn"]');
    },
    get blockReasonOptions() {
        return document.querySelector('[data-ui="block-reason-options"]');
    },
    get privacyBlockText() {
        return document.querySelector('[data-ui="privacy-block-text"]');
    },
    get requestToMessageBtn() {
        return document.querySelector('[data-ui="request-to-message-btn"]');
    },
    get unblockDirectBtn() {
        return document.querySelector('[data-ui="unblock-direct-btn"]');
    },
    // Excluded Contacts Modal (main modal elements)
    get excludedContactsModal() {
        return document.querySelector('[data-ui="excluded-contacts-modal"]');
    },
    get closeExcludedContactsModalBtn() {
        return document.querySelector('[data-ui="close-excluded-contacts-modal"]');
    },
    get excludedContactsSearch() {
        return document.querySelector('[data-ui="excluded-contacts-search"]');
    },
    get clearExcludedSearchBtn() {
        return document.querySelector('[data-ui="clear-excluded-search-btn"]');
    },
    get excludedContactsList() {
        return document.querySelector('[data-ui="excluded-contacts-list"]');
    },
    get saveExcludedContactsBtn() {
        return document.querySelector('[data-ui="save-excluded-contacts-btn"]');
    },
    get excludedContactsSelectAll() {
        return document.querySelector('[data-ui="excluded-contacts-select-all"]');
    },
    // Specific "Manage Excluded Contacts" buttons for each privacy setting
    get privacyProfilePhotoManageExcludedBtn() {
        return document.querySelector('[data-ui="privacy-profile-photo-manage-excluded-btn"]');
    },
    get privacyProfilePhotoExcludedCountLabel() {
        return document.querySelector('[data-ui="privacy-profile-photo-excluded-count-label"]');
    },
    get privacyAboutManageExcludedBtn() {
        return document.querySelector('[data-ui="privacy-about-manage-excluded-btn"]');
    },
    get privacyAboutExcludedCountLabel() {
        return document.querySelector('[data-ui="privacy-about-excluded-count-label"]');
    },
    get privacyLastSeenManageExcludedBtn() {
        return document.querySelector('[data-ui="privacy-last-seen-manage-excluded-btn"]');
    },
    get privacyLastSeenExcludedCountLabel() {
        return document.querySelector('[data-ui="privacy-last-seen-excluded-count-label"]');
    },
    get privacyOnlineManageExcludedBtn() {
        return document.querySelector('[data-ui="privacy-online-manage-excluded-btn"]');
    },
    get privacyOnlineExcludedCountLabel() {
        return document.querySelector('[data-ui="privacy-online-excluded-count-label"]');
    },
    get privacyWhoCanViewShopManageExcludedBtn() {
        return document.querySelector('[data-ui="privacy-who-can-view-shop-manage-excluded-btn"]');
    },
    get privacyWhoCanViewShopExcludedCountLabel() {
        return document.querySelector('[data-ui="privacy-who-can-view-shop-excluded-count-label"]');
    },
    // Chat Lock Elements
    get lockedChatsTrigger() {
        return document.querySelector('[data-ui="locked-chats-trigger"]');
    },
    get lockedChatsSidebar() {
        return document.querySelector('[data-ui="locked-chats-sidebar"]');
    },
    get lockedConversationList() {
        return document.querySelector('[data-ui="locked-conversation-list"]');
    },
    get closeLockedChatsSidebarBtn() {
        return document.querySelector('[data-ui="close-locked-chats-sidebar-btn"]');
    },
    get lockedChatsAuthModal() {
        return document.querySelector('[data-ui="locked-chats-auth-modal"]');
    },
    get closeLockedChatsAuthModalBtn() {
        return document.querySelector('[data-ui="close-locked-chats-auth-modal"]');
    },
    get lockedChatsErrorMsg() {
        return document.querySelector('[data-ui="locked-chats-error-msg"]');
    },
    // New Group Elements
    get newGroupModal() {
        return document.querySelector('[data-ui="new-group-modal"]');
    },
    get closeNewGroupModalBtn() {
        return document.querySelector('[data-ui="close-new-group-modal"]');
    },
    get newGroupForm() {
        return document.querySelector('[data-ui="new-group-form"]');
    },
    get newGroupName() {
        return document.querySelector('[data-ui="new-group-name"]');
    },
    get newGroupContactsList() {
        return document.querySelector('[data-ui="new-group-contacts-list"]');
    },
    // Group Info Elements
    get groupInfoModal() {
        return document.querySelector('[data-ui="group-info-modal"]');
    },
    get closeGroupInfoModalBtn() {
        return document.querySelector('[data-ui="close-group-info-modal"]');
    },
    get groupInfoAvatar() {
        return document.getElementById('group-info-avatar');
    },
    get groupInfoAvatarInitials() {
        return document.getElementById('group-info-avatar-initials');
    },
    get groupInfoAvatarImg() {
        return document.getElementById('group-info-avatar-img');
    },
    get groupInfoAvatarEditOverlay() {
        return document.getElementById('group-info-avatar-edit-overlay');
    },
    get groupInfoPhotoInput() {
        return document.getElementById('group-info-photo-input');
    },
    get groupInfoName() {
        return document.getElementById('group-info-name');
    },
    get groupInfoMeta() {
        return document.getElementById('group-info-meta');
    },
    get groupInfoAddMemberBtn() {
        return document.getElementById('group-info-add-member-btn');
    },
    get groupInfoMembersCount() {
        return document.getElementById('group-info-members-count');
    },
    get groupInfoMembersList() {
        return document.getElementById('group-info-members-list');
    },
    get groupInfoExitBtn() {
        return document.getElementById('group-info-exit-btn');
    },
    get groupInfoInviteBtn() {
        return document.getElementById('group-info-invite-btn');
    },
    get joinGroupOverlay() {
        return document.querySelector('[data-ui="join-group-overlay"]');
    },
    get closeJoinGroupModalBtn() {
        return document.querySelector('[data-ui="close-join-group-modal"]');
    },
    get joinGroupName() {
        return document.getElementById('join-group-name');
    },
    get joinGroupMembersCount() {
        return document.getElementById('join-group-members-count');
    },
    get joinGroupConfirmBtn() {
        return document.getElementById('join-group-confirm-btn');
    },
    get joinGroupCancelBtn() {
        return document.getElementById('join-group-cancel-btn');
    },
    get joinGroupAvatarInitials() {
        return document.getElementById('join-group-avatar-initials');
    },
    // Add Participant Elements
    get addParticipantModal() {
        return document.querySelector('[data-ui="add-participant-modal"]');
    },
    get closeAddParticipantModalBtn() {
        return document.querySelector('[data-ui="close-add-participant-modal"]');
    },
    get addParticipantForm() {
        return document.getElementById('add-participant-form');
    },
    get addParticipantList() {
        return document.getElementById('add-participant-list');
    },
    // Participant Actions Elements
    get participantActionsModal() {
        return document.querySelector('[data-ui="participant-actions-modal"]');
    },
    get closeParticipantActionsModalBtn() {
        return document.querySelector('[data-ui="close-participant-actions-modal"]');
    },
    get actionMakeAdminBtn() {
        return document.getElementById('action-make-admin-btn');
    },
    get actionRemoveMemberBtn() {
        return document.getElementById('action-remove-member-btn');
    },
    get actionMessageMemberBtn() {
        return document.getElementById('action-message-member-btn');
    },
    // Invite Contact Elements
    get settingsInviteContactBtn() {
        return document.querySelector('[data-ui="settings-invite-contact-btn"]');
    },
    get inviteContactModal() {
        return document.querySelector('[data-ui="invite-contact-modal"]');
    },
    get closeInviteContactModalBtn() {
        return document.querySelector('[data-ui="close-invite-contact-modal"]');
    },
    get inviteLinkInput() {
        return document.getElementById('invite-link-input');
    },
    get copyInviteLinkBtn() {
        return document.getElementById('copy-invite-link-btn');
    },
    get inviteQrCode() {
        return document.getElementById('invite-qrcode');
    },
    get shareWhatsappBtn() {
        return document.getElementById('share-whatsapp-btn');
    },
    get shareTelegramBtn() {
        return document.getElementById('share-telegram-btn');
    },
    get shareEmailBtn() {
        return document.getElementById('share-email-btn');
    },
    get generateNewInviteBtn() {
        return document.getElementById('generate-new-invite-btn');
    },
    get inviteStatsRegistrations() {
        return document.getElementById('invite-stats-registrations');
    },
    get inviteStatsFriendships() {
        return document.getElementById('invite-stats-friendships');
    },
    get inviteStatsClicks() {
        return document.getElementById('invite-stats-clicks');
    },
    get settingsAdminAnalyticsBtn() {
        return document.querySelector('[data-ui="settings-admin-analytics-btn"]');
    },
    get adminAnalyticsModal() {
        return document.querySelector('[data-ui="admin-analytics-modal"]');
    },
    get closeAdminAnalyticsModalBtn() {
        return document.querySelector('[data-ui="close-admin-analytics-modal"]');
    },
    get refreshAnalyticsBtn() {
        return document.getElementById('refresh-analytics-btn');
    },
    // WhatsApp Voice Recording getters
    get inputPill() {
        return document.querySelector('[data-ui="input-pill"]');
    },
    get recordingOverlay() {
        return document.querySelector('[data-ui="recording-overlay"]');
    },
    get recordingTimer() {
        return document.querySelector('[data-ui="recording-timer"]');
    },
    get lockIndicatorContainer() {
        return document.querySelector('[data-ui="lock-indicator-container"]');
    },
    get chatInvoicesModal() {
        return document.querySelector('[data-ui="chat-invoices-modal"]');
    },
    get closeChatInvoicesModalBtn() {
        return document.querySelector('[data-ui="close-chat-invoices-modal"]');
    },
    get chatInvoicesList() {
        return document.querySelector('[data-ui="chat-invoices-list"]');
    },
    get helpFeedbackModal() {
        return document.querySelector('[data-ui="help-feedback-modal"]');
    },
    get closeHelpFeedbackModalBtn() {
        return document.querySelector('[data-ui="close-help-feedback-modal"]');
    },
    get helpBackBtn() {
        return document.querySelector('[data-ui="help-back-btn"]');
    },
    get settingsHelpFeedbackBtn() {
        return document.querySelector('[data-ui="settings-help-feedback-btn"]');
    },
    get forceUpdateModal() {
        return document.querySelector('[data-ui="force-update-modal"]');
    },
    get updateModalTitle() {
        return document.querySelector('[data-ui="update-modal-title"]');
    },
    get updateModalMessage() {
        return document.querySelector('[data-ui="update-modal-message"]');
    },
    get updateCurrentVer() {
        return document.querySelector('[data-ui="update-current-ver"]');
    },
    get updateLatestVer() {
        return document.querySelector('[data-ui="update-latest-ver"]');
    },
    get updateReleaseNotes() {
        return document.querySelector('[data-ui="update-release-notes"]');
    },
    get updateNowBtn() {
        return document.querySelector('[data-ui="update-now-btn"]');
    }
};
