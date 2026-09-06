import { elements } from './elements.js';
import { showToast, showActionSuccessAnimation } from './toast.js';
import { getActiveChatUid } from './chat.js';
import { debounce, calculateDistance, getHeuristicTravelTime, getTravelTimeFromAPI, getAvatarUrl, parsePrice } from './utils.js';
import { auth, db } from './firebase-config.js'; // Import db
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { openBusinessLocationPicker, openShopAccessRequestModal } from './store.js';
import { reportBusiness, getBusinessProfile, saveMessage, uploadFile, sendFriendRequest, getUserProfile, saveReview, subscribeToReviews, saveSavedItems, getSavedItems, saveOrder, updateOrder, generateOrderId, getProductsByOwner } from './database-service.js';
import { getOrDeriveSharedKey, encryptText } from './crypto-helper.js';
import { pushHistoryState, removeHistoryState, dismissHistoryState } from './history-manager.js';
import { subscribeToAuthChanges } from './auth-service.js';
import { getCachedProductsByOwner, cacheItem } from './cache-manager.js';
import { setShopModeVisibility } from './shop-mode.js';
import { resolveActiveSellerId } from './shop-seller-utils.js';
import { validateDeliveryCoverage } from './delivery-coverage-utils.js';
import { initDeliveryAddressAutocomplete } from './delivery-address-autocomplete.js';

let cart = [];
let savedItems = [];
let cachedShopLocations = [];
let currentShopSellerId = null;
let selectedPickupLocation = null;
let cachedBizProfile = null;
let cachedBizProfileOwnerId = null;
let cachedDeliveryFee = 0;
let currentTransportMode = 'driving';

// Distance-based delivery cache variables
let cachedUseTiers = false;
let cachedDeliveryRules = [];
let cachedAllowFallback = false;
let cachedFallbackFee = 0;
let cachedFallbackMinFreeOrder = 0;
let cachedStoreLatitude = 0;
let cachedStoreLongitude = 0;
export let selectedDeliveryCoordinates = null;

export const setSelectedDeliveryCoordinates = (coords) => {
    selectedDeliveryCoordinates = coords;
    if (typeof window._updateCartUI === 'function') {
        window._updateCartUI();
    }
};

let cachedDeliveryCoverage = null;
let lastDeliveryCoverageError = '';

export { validateDeliveryCoverage };

const calculateShippingFee = (subtotal) => {
    if (deliveryMethod !== 'delivery') return 0;
    
    // Check regional & street coverage
    const currentAddr = addressMode === 'simple' ? 
        (elements.deliveryAddressInput?.value.trim() || '') : 
        `${elements.addrStreet?.value.trim() || ''}, ${elements.addrCity?.value.trim() || ''}, ${elements.addrState?.value.trim() || ''}`;
        
    const coverageResult = validateDeliveryCoverage(
        currentAddr, 
        selectedDeliveryCoordinates, 
        cachedDeliveryCoverage, 
        { lat: cachedStoreLatitude, lng: cachedStoreLongitude }
    );

    if (!coverageResult.isCovered) {
        lastDeliveryCoverageError = coverageResult.reason;
        return -1; // Out of range / outside coverage area!
    }
    lastDeliveryCoverageError = '';

    const isFreeDelivery = cachedMinFreeDelivery > 0 && subtotal >= cachedMinFreeDelivery;
    let fee = isFreeDelivery ? 0 : cachedDeliveryFee;
    
    if (cachedUseTiers) {
        const userCoords = selectedDeliveryCoordinates;
        if (userCoords && cachedStoreLatitude && cachedStoreLongitude) {
            const distance = calculateDistance(userCoords.lat, userCoords.lng, cachedStoreLatitude, cachedStoreLongitude);
            
            // Find matching tier
            const matchingRule = cachedDeliveryRules.find(rule => distance <= rule.maxDistance);
            if (matchingRule) {
                const minFree = matchingRule.minFreeOrder;
                const isTierFree = minFree !== undefined && minFree > 0 && subtotal >= minFree;
                fee = isTierFree ? 0 : matchingRule.fee;
            } else {
                if (cachedAllowFallback) {
                    const minFree = cachedFallbackMinFreeOrder;
                    const isFallbackFree = minFree > 0 && subtotal >= minFree;
                    fee = isFallbackFree ? 0 : cachedFallbackFee;
                } else {
                    lastDeliveryCoverageError = `Store delivery distance (${distance.toFixed(1)} km) exceeds maximum delivery radius.`;
                    fee = -1; // Out of range!
                }
            }
        }
    }
    
    return fee;
};

const getCartOwnerId = () => currentShopSellerId || getActiveChatUid();
const resetSellerContext = (sellerId) => {
    const normalizedSellerId = sellerId ? String(sellerId).trim() : null;
    currentShopSellerId = normalizedSellerId;
    if (normalizedSellerId !== cachedBizProfileOwnerId) {
        cachedBizProfile = null;
        cachedBizProfileOwnerId = normalizedSellerId;
    }
    refreshCart();
};
let currentMapLocations = [];
let currentMapUserCoords = null;
let currentMapAllTravelTimes = []; // Stores travel times for all modes for each location
let activeMarkers = []; // Leaflet marker references
let currentReviewProductId = null;
let reviewsUnsubscribe = null;

const MAX_DELIVERY_ADDRESS_LENGTH = 200;

const formatPriceWithCommas = (priceVal) => {
    return parsePrice(priceVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Downloads an image from a URL and converts it to a base64 DataURL
 */
const getBase64ImageFromUrl = async (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    
    // 1. Try loading using an Image object with crossOrigin anonymous first (CORS-safe canvas draw)
    try {
        const imgPromise = new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg'));
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = (err) => reject(err);
            // Set 4-second timeout for image load
            setTimeout(() => reject(new Error("Timeout")), 4000);
            img.src = url;
        });
        const res = await imgPromise;
        if (res) return res;
    } catch (err) {
        console.warn("CORS canvas loading failed or timed out for:", url, err);
    }

    // 2. Fall back to direct fetch with a 5000ms timeout
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5000ms timeout
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Direct fetch fallback failed or timed out for:", url, e);
        return null;
    }
};

let cachedMinFreeDelivery = 0;
let deliveryMethod = 'pickup'; // State: 'pickup' or 'delivery'
let addressMode = 'simple'; // 'simple' or 'structured'

const normalizeServiceType = (value) => {
    return String(value || '').trim().toLowerCase();
};

let shopLocationsMapInstance = null;
let shopLocationsMarkers = L.layerGroup(); // To manage markers easily

/**
 * Refreshes the cart state from localStorage based on the active chat partner
 */
export const refreshCart = () => {
    selectedPickupLocation = null;
    addressMode = 'simple';
    cachedDeliveryFee = 0;
    cachedMinFreeDelivery = 0;
    deliveryMethod = 'pickup';
    const currentActiveChatUid = getCartOwnerId();
    const cartKey = currentActiveChatUid ? `hotmapp_cart_${currentActiveChatUid}` : 'hotmapp_cart_data';
    const savedKey = currentActiveChatUid ? `hotmapp_saved_${currentActiveChatUid}` : 'hotmapp_saved_data';

    cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    savedItems = JSON.parse(localStorage.getItem(savedKey) || '[]');

    const user = auth.currentUser;
    if (user && currentActiveChatUid) {
        getSavedItems(user.uid, currentActiveChatUid).then(dbSavedItems => {
            if (dbSavedItems && Array.isArray(dbSavedItems)) {
                savedItems = dbSavedItems;
                localStorage.setItem(savedKey, JSON.stringify(savedItems));
                if (window._updateCartUI) window._updateCartUI();
            }
        }).catch(err => console.warn("Failed to load saved items from DB", err));
    }

    // This function is defined inside initShop, but we need to trigger UI updates.
    // Since initShop hasn't finished setup yet, we'll check if the UI updater exists.
    if (window._updateCartUI) window._updateCartUI();
};

/**
 * Toggles between simple textarea and structured address fields in the UI
 */
const updateAddressUI = () => {
    if (!elements.simpleAddressContainer || !elements.structuredAddressContainer || !elements.toggleAddressModeBtn) return;

    const isSimple = addressMode === 'simple';
    elements.simpleAddressContainer.style.display = isSimple ? 'block' : 'none';
    elements.structuredAddressContainer.style.display = isSimple ? 'none' : 'flex';
    elements.toggleAddressModeBtn.textContent = isSimple ? 'Structured' : 'Simple';
    if (elements.deliveryAddressContainer) elements.deliveryAddressContainer.dataset.mode = addressMode;
};

/**
 * Updates the display of pickup locations in the shop view.
 * @param {object} bizProfile - The business profile object.
 * @param {object|null} userCoords - Current user location {lat, lng}.
 */
export const updateShopPickupLocations = async (bizProfile, userCoords = null, currentUserProfile = null, moduleFriendsList = {}, sellerProfile = null, { suppressShopAccessModal = false } = {}) => {
    cachedBizProfile = bizProfile || sellerProfile?.businessProfile || null;
    const locations = bizProfile?.pickupLocations || cachedBizProfile?.pickupLocations || [];
    let serviceType = normalizeServiceType(bizProfile?.serviceType || cachedBizProfile?.serviceType || 'pickup');
    if (!['pickup', 'delivery', 'both'].includes(serviceType)) {
        serviceType = 'pickup';
    }
    cachedDeliveryFee = parsePrice((bizProfile?.deliveryFee ?? cachedBizProfile?.deliveryFee) || 0);
    cachedMinFreeDelivery = parsePrice((bizProfile?.minFreeDelivery ?? cachedBizProfile?.minFreeDelivery) || 0);
    cachedUseTiers = !!(bizProfile?.useTiers ?? cachedBizProfile?.useTiers);
    cachedDeliveryRules = (bizProfile?.deliveryRules ?? cachedBizProfile?.deliveryRules) || [];
    cachedAllowFallback = !!(bizProfile?.allowFallback ?? cachedBizProfile?.allowFallback);
    cachedFallbackFee = parsePrice((bizProfile?.fallbackFee ?? cachedBizProfile?.fallbackFee) || 0);
    cachedFallbackMinFreeOrder = parsePrice((bizProfile?.fallbackMinFreeOrder ?? cachedBizProfile?.fallbackMinFreeOrder) || 0);
    cachedDeliveryCoverage = (bizProfile?.deliveryCoverage ?? cachedBizProfile?.deliveryCoverage) || null;

    const firstLoc = locations[0];
    if (firstLoc && firstLoc.latitude && firstLoc.longitude) {
        cachedStoreLatitude = firstLoc.latitude;
        cachedStoreLongitude = firstLoc.longitude;
    } else {
        cachedStoreLatitude = 0;
        cachedStoreLongitude = 0;
    }

    if (userCoords) {
        selectedDeliveryCoordinates = userCoords;
    }

    // Update Shop Header with Category and Name
    if (elements.shopCategoryDisplay) {
        const shopContainer = elements.shopContainer;
        const shopNoResultsMessage = elements.shopNoResultsMessage;

        const currentActiveChatUid = getActiveChatUid();
        const sellerWhoCanViewShop = sellerProfile?.whoCanViewShop || 'anyone';
        let isContactOfSeller = false;
        if (auth.currentUser && currentActiveChatUid) {
            const isFriendSnap = await get(ref(db, `users/${auth.currentUser.uid}/customerList/${currentActiveChatUid}`));
            isContactOfSeller = isFriendSnap.exists();
        }
        const isExcludedBySeller = !!(sellerProfile?.excludedContacts && auth.currentUser && sellerProfile.excludedContacts[auth.currentUser.uid]);

        let blockReason = '';
        let showRequestBtn = true;
        const isOwnShop = auth.currentUser && currentActiveChatUid === auth.currentUser.uid;
        if (isOwnShop) {
            blockReason = ''; // Always allow viewing your own shop
        } else if (sellerWhoCanViewShop === 'friends-only') {
            if (!isContactOfSeller) {
                blockReason = `You cannot view this shop because the seller allows only friends to view their shop.`;
                showRequestBtn = true;
            }
        } else if (sellerWhoCanViewShop === 'excluded') {
            if (!isContactOfSeller) {
                blockReason = `You cannot view this shop because the seller allows only approved contacts to view their shop.`;
                showRequestBtn = true;
            } else if (isExcludedBySeller) {
                blockReason = `You cannot view this shop because the seller has restricted access for this contact.`;
                showRequestBtn = false;
            }
        }

        if (blockReason) {
            if (!suppressShopAccessModal) {
                const isShopActive = elements.chatArea?.classList.contains('shop-mode-active') || false;
                if (isShopActive) {
                    if (shopContainer) shopContainer.style.display = 'none'; // Hide the shop content
                    if (shopNoResultsMessage) shopNoResultsMessage.style.display = 'none'; // Ensure search message is hidden
                    await openShopAccessRequestModal(currentActiveChatUid, sellerProfile, blockReason, null, showRequestBtn);
                }
            }
            return; // Block shop view entirely or skip the access prompt on resume
        } else {
            if (shopContainer) shopContainer.style.display = 'flex'; // Ensure shop is visible if not blocked
            if (shopNoResultsMessage) shopNoResultsMessage.style.display = 'none'; // Hide any previous block message
        }

        // Continue with normal shop rendering if not blocked
        const category = bizProfile?.category;
        if (category) {
            elements.shopCategoryDisplay.textContent = category;
            elements.shopCategoryDisplay.style.display = 'inline-block';
        } else {
            elements.shopCategoryDisplay.style.display = 'none';
        }
    }

    if (elements.shopNameDisplay) {
        elements.shopNameDisplay.textContent = bizProfile?.companyName ? bizProfile.companyName.trim() : (elements.chatHeaderName?.textContent || "Shop");
    }

    const headerLogo = document.querySelector('[data-ui="shop-header-logo"]');
    if (headerLogo) {
        if (bizProfile?.logoUrl) {
            headerLogo.src = bizProfile.logoUrl;
            headerLogo.style.display = 'block';
        } else {
            headerLogo.style.display = 'none';
        }
    }

    cachedShopLocations = locations;
    if (!elements.shopPickupLocations || !elements.shopPickupLocationsList) return;

    const canPickup = serviceType === 'pickup' || serviceType === 'both';
    const canDeliver = serviceType === 'delivery' || serviceType === 'both';

    // 1. Update Cart Fulfillment Options
    if (elements.cartDeliverySection) {
        if (!canPickup && !canDeliver) {
            elements.cartDeliverySection.style.display = 'none';
        } else {
            elements.cartDeliverySection.style.display = canDeliver ? 'block' : 'none';
        }

        if (elements.pickupOptionWrapper) {
            elements.pickupOptionWrapper.style.display = canPickup ? 'flex' : 'none';
        }

        if (!canPickup && canDeliver) {
            deliveryMethod = 'delivery';
        } else {
            deliveryMethod = 'pickup';
        }

        if (elements.deliveryMethodDelivery) {
            elements.deliveryMethodDelivery.checked = deliveryMethod === 'delivery';
        }
        if (elements.deliveryMethodPickup) {
            elements.deliveryMethodPickup.checked = deliveryMethod === 'pickup';
        }

        if (elements.deliveryAddressContainer) {
            elements.deliveryAddressContainer.style.display = deliveryMethod === 'delivery' ? 'block' : 'none';
        }

        const currentActiveChatUid = getActiveChatUid();
        const rawSaved = currentActiveChatUid ? localStorage.getItem(`hotmapp_address_${currentActiveChatUid}`) : null;
        if (rawSaved) {
            try {
                const parsed = JSON.parse(rawSaved);
                if (parsed && typeof parsed === 'object' && parsed.mode === 'structured') {
                    addressMode = 'structured';
                    if (elements.addrStreet) elements.addrStreet.value = parsed.street || '';
                    if (elements.addrApartment) elements.addrApartment.value = parsed.apt || '';
                    if (elements.addrCity) elements.addrCity.value = parsed.city || '';
                    if (elements.addrState) elements.addrState.value = parsed.state || '';
                } else {
                    addressMode = 'simple';
                    if (elements.deliveryAddressInput) elements.deliveryAddressInput.value = rawSaved;
                }
            } catch (e) {
                addressMode = 'simple';
                if (elements.deliveryAddressInput) elements.deliveryAddressInput.value = rawSaved;
            }
        } else {
            addressMode = 'simple';
            if (elements.deliveryAddressInput) elements.deliveryAddressInput.value = '';
            if (elements.addrStreet) elements.addrStreet.value = '';
            if (elements.addrApartment) elements.addrApartment.value = '';
            if (elements.addrCity) elements.addrCity.value = '';
            if (elements.addrState) elements.addrState.value = '';
        }

        updateAddressUI();
        if (elements.saveAddressCheckbox) elements.saveAddressCheckbox.checked = !!rawSaved;
        elements.deliveryAddressInput?.dispatchEvent(new Event('input'));
    }

    // 2. Render Pickup Locations List in Shop Header
    if (locations && locations.length > 0 && canPickup) {
        if (!selectedPickupLocation || !locations.find(l => l.address === selectedPickupLocation.address)) {
            selectedPickupLocation = locations[0];
        }
        elements.shopPickupLocations.style.display = 'block';
        elements.shopPickupLocationsList.innerHTML = locations.map((loc, index) => {
            const isSelected = selectedPickupLocation?.address === loc.address;

            let distLabel = '';
            if (userCoords && loc.latitude && loc.longitude) {
                const dist = calculateDistance(userCoords.lat, userCoords.lng, loc.latitude, loc.longitude);
                distLabel = `<span style="color: var(--brand); font-weight: 700; font-size: 0.75rem;">• ${dist.toFixed(1)}km away</span>`;
            }

            return `
                <div class="shop-pickup-location-item ${isSelected ? 'selected' : ''}" data-index="${index}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px dashed var(--border-light); cursor: pointer; border-radius: 12px; transition: all 0.2s ease; ${isSelected ? 'background: rgba(0, 168, 132, 0.08); border: 1.5px solid var(--brand);' : 'border: 1.5px solid transparent;'}">
                    <div class="selection-indicator" style="width: 20px; height: 20px; border: 2px solid ${isSelected ? 'var(--brand)' : 'var(--border)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: white;">
                        ${isSelected ? '<div style="width: 10px; height: 10px; background: var(--brand); border-radius: 50%;"></div>' : ''}
                    </div>
                    <div style="flex: 1;">
                        <strong style="display: block; font-size: 0.95rem; color: ${isSelected ? 'var(--brand-dark)' : 'var(--text)'};">${loc.name || 'Pickup Point'} ${distLabel}</strong>
                        <span style="font-size: 0.82rem; color: var(--muted); line-height: 1.3; display: block; margin-top: 2px;">${loc.address}</span>
                    </div>
                    <a href="https://www.google.com/maps?q=${loc.latitude},${loc.longitude}" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.8rem; padding: 6px 10px; background: #fff; border-radius: 6px; border: 1px solid var(--border); font-weight: 600;" onclick="event.stopPropagation()">Map <i class="fa-solid fa-external-link-alt"></i></a>
                </div>
            `;
        }).join('');
        // Remove last border
        if (elements.shopPickupLocationsList.lastElementChild) {
            elements.shopPickupLocationsList.lastElementChild.style.borderBottom = 'none';
        }
    } else {
        elements.shopPickupLocations.style.display = 'none';
        elements.shopPickupLocationsList.innerHTML = '';
    }
};

/**
 * Opens a modal displaying all provided pickup locations on an interactive Leaflet map.
 * @param {Array} locations - An array of pickup location objects.
 * @param {Object|null} userCoords - Optional user coordinates {lat, lng} to calculate distance.
 */
export const openShopLocationsMapModal = async (locations, userCoords = null) => {
    if (!elements.shopLocationsMapModal || !elements.shopLocationsMap) return;

    elements.shopLocationsMapModal.style.display = 'flex';
    currentMapLocations = locations;
    currentMapUserCoords = userCoords;

    // --- Fetch travel times for ALL modes concurrently for each location ---
    const allModes = ['driving', 'walking', 'cycling'];
    const allTravelTimesPromises = locations.map(async loc => {
        const locationTimes = {};
        for (const mode of allModes) {
            if (currentMapUserCoords && loc.latitude && loc.longitude) {
                locationTimes[mode] = await getTravelTimeFromAPI(currentMapUserCoords, { lat: loc.latitude, lng: loc.longitude }, mode);
            } else {
                const dist = calculateDistance(currentMapUserCoords?.lat || 0, currentMapUserCoords?.lng || 0, loc.latitude, loc.longitude);
                locationTimes[mode] = getHeuristicTravelTime(dist, mode);
            }
        }
        return locationTimes;
    });

    currentMapAllTravelTimes = await Promise.all(allTravelTimesPromises);
    // --- End fetch travel times ---

    // Initialize map if it hasn't been already
    if (!shopLocationsMapInstance) {
        shopLocationsMapInstance = L.map(elements.shopLocationsMap).setView([0, 0], 2); // Default view
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(shopLocationsMapInstance);
        shopLocationsMarkers.addTo(shopLocationsMapInstance); // Add layer group to map

        // Handle mode switching via event delegation on the map container
        elements.shopLocationsMap.addEventListener('click', (e) => {
            const modeBtn = e.target.closest('.map-mode-btn');
            if (modeBtn && !modeBtn.classList.contains('active')) {
                const newMode = modeBtn.dataset.mode;
                currentTransportMode = newMode;

                // 1. Update the active button styling in the open popup DOM instantly
                const selector = modeBtn.closest('.map-mode-selector');
                if (selector) {
                    selector.querySelectorAll('.map-mode-btn').forEach(btn => {
                        const isActive = btn.dataset.mode === newMode;
                        btn.classList.toggle('active', isActive);
                    });
                }

                // 2. Dynamically update icons for all markers to show the selected mode's estimated time
                activeMarkers.forEach((marker, idx) => {
                    const loc = currentMapLocations[idx];
                    const userCoords = currentMapUserCoords;

                    let distanceHtml = '';
                    if (userCoords && loc.latitude && loc.longitude) {
                        const dist = calculateDistance(userCoords.lat, userCoords.lng, loc.latitude, loc.longitude);
                        const timeStr = currentMapAllTravelTimes[idx][newMode];

                        let colorClass = 'far';
                        if (dist < 2) colorClass = 'very-near';
                        else if (dist < 10) colorClass = 'near';

                        distanceHtml = `<div class="marker-distance-label ${colorClass}">${dist.toFixed(1)}km • ${timeStr}</div>`;
                    }

                    const newIcon = L.divIcon({
                        html: `<div style="position: relative;"><i class="fa-solid fa-location-dot custom-map-marker"></i>${distanceHtml}</div>`,
                        className: 'custom-div-icon',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32]
                    });

                    marker.setIcon(newIcon);
                });
            }
        });
    }

    // Clear existing markers
    shopLocationsMarkers.clearLayers();
    activeMarkers = []; // Clear marker references

    const bounds = [];
    locations.forEach((loc, index) => {
        if (loc.latitude && loc.longitude) {
            const latLng = [loc.latitude, loc.longitude];

            let distanceHtml = '';
            let directionsLinksHtml = '';

            if (userCoords) {
                const dist = calculateDistance(userCoords.lat, userCoords.lng, loc.latitude, loc.longitude);
                const timeStr = currentMapAllTravelTimes[index][currentTransportMode]; // Use the fetched travel time for the current mode

                let colorClass = 'far';
                if (dist < 2) colorClass = 'very-near'; // Within 2km
                else if (dist < 10) colorClass = 'near'; // Within 10km

                distanceHtml = `<div class="marker-distance-label ${colorClass}">${dist.toFixed(1)}km • ${timeStr}</div>`;

                // Mode Selector UI
                const modes = [
                    { id: 'driving', icon: 'fa-car', label: 'Drive' },
                    { id: 'walking', icon: 'fa-person-walking', label: 'Walk' },
                    { id: 'cycling', icon: 'fa-bicycle', label: 'Cycle' }
                ];
                const modeSelectorHtml = `<div class="map-mode-selector">` +
                    modes.map(m => {
                        const modeTime = currentMapAllTravelTimes[index][m.id];
                        // Format time for button: "5 mins away" -> "5m", "< 1 min away" -> "<1m"
                        const shortTime = modeTime.replace(' mins away', 'm').replace(' min away', 'm').replace('< 1m away', '<1m').replace(' away', '');
                        return `<button class="map-mode-btn ${currentTransportMode === m.id ? 'active' : ''}" data-mode="${m.id}" title="${m.label}"><i class="fa-solid ${m.icon}"></i> ${shortTime}</button>`;
                    }).join('') +
                    `</div>`;

                // Generate directions links
                const originParam = `&origin=${userCoords.lat},${userCoords.lng}`;
                const destinationParam = `&destination=${loc.latitude},${loc.longitude}`;
                const baseDirectionsUrl = `https://www.google.com/maps/dir/?api=1${originParam}${destinationParam}`;

                directionsLinksHtml = `
                    ${modeSelectorHtml}
                    <div style="font-size: 0.75rem; color: var(--muted); margin: 8px 0 4px; font-weight: 600;">Open in Google Maps:</div>
                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                        <a href="${baseDirectionsUrl}&travelmode=driving" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.85rem; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid var(--brand); font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-car"></i> Drive</a>
                        <a href="${baseDirectionsUrl}&travelmode=walking" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.85rem; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid var(--brand); font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-person-walking"></i> Walk</a>
                        <a href="${baseDirectionsUrl}&travelmode=bicycling" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.85rem; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid var(--brand); font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-person-biking"></i> Cycle</a>
                        <a href="${baseDirectionsUrl}&travelmode=transit" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.85rem; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid var(--brand); font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-bus"></i> Transit</a>
                    </div>
                `;
            } else {
                // If user location is not available, provide a general "Get Directions" link
                directionsLinksHtml = `
                    <div style="margin-top: 10px;">
                        <a href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}" target="_blank" style="color: var(--brand-dark); text-decoration: none; font-size: 0.85rem; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid var(--brand); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;"><i class="fa-solid fa-map-location-dot"></i> Get Directions</a>
                    </div>
                `;
            }

            const icon = L.divIcon({
                html: `<div style="position: relative;"><i class="fa-solid fa-location-dot custom-map-marker"></i>${distanceHtml}</div>`,
                className: 'custom-div-icon',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            const marker = L.marker(latLng, { icon }).bindPopup(`
                <b>${loc.name || loc.address}</b>
                ${directionsLinksHtml}
            `);
            activeMarkers.push(marker); // Keep reference to marker
            shopLocationsMarkers.addLayer(marker);
            bounds.push(latLng);
        }
    });

    if (bounds.length > 0) {
        shopLocationsMapInstance.fitBounds(bounds, { padding: [50, 50] });
    } else {
        shopLocationsMapInstance.setView([0, 0], 2); // Default view if no locations
    }

    // Invalidate size to ensure map renders correctly after modal display
    setTimeout(() => shopLocationsMapInstance.invalidateSize(), 100); // Small delay to ensure modal is fully rendered
};

/**
 * Generates an official jsPDF invoice document for an order.
 * Works entirely client-side with zero dependencies on remote storage.
 */
export const generateOrderInvoiceDoc = async (order, options = {}) => {
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass) {
        throw new Error("jsPDF library is not loaded on this device.");
    }
    const doc = new jsPDFClass();
    const invoiceBlue = [0, 0, 255];
    doc.setFont(undefined, 'normal');

    let transparentLogoBase64 = null;
    let bizProfile = null;
    let sellerProfile = null;
    let bizAddress = "Not specified";

    if (order.sellerId) {
        try {
            bizProfile = await getBusinessProfile(order.sellerId);
        } catch (e) {
            console.warn("Failed to get business profile for invoice:", e);
        }
        if (!bizProfile) {
            try {
                const snap = await get(ref(db, `businesses/${order.sellerId}`));
                if (snap && snap.exists()) bizProfile = snap.val();
            } catch (e) {}
        }
        try {
            sellerProfile = await getUserProfile(order.sellerId);
        } catch (e) {}
    }

    if (bizProfile) {
        if (bizProfile.pickupLocations && bizProfile.pickupLocations.length > 0) {
            bizAddress = bizProfile.pickupLocations[0].address;
        } else if (bizProfile.pickupAddress) {
            bizAddress = bizProfile.pickupAddress;
        } else if (bizProfile.address) {
            bizAddress = bizProfile.address;
        }
    } else if (cachedBizProfile) {
        if (cachedBizProfile.pickupLocations && cachedBizProfile.pickupLocations.length > 0) {
            bizAddress = cachedBizProfile.pickupLocations[0].address;
        } else if (cachedBizProfile.pickupAddress) {
            bizAddress = cachedBizProfile.pickupAddress;
        }
    }

    // Create a semi-transparent Hotmapp watermark logo using a client-side canvas
    try {
        // 1. Try DOM canvas drawing first (synchronous & works offline/file://)
        const logoImgEl = document.querySelector('.app-logo') || document.querySelector('img[src*="hotmapp-logo"]');
        if (logoImgEl && logoImgEl.complete && logoImgEl.naturalWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = logoImgEl.naturalWidth;
            canvas.height = logoImgEl.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 0.15; // 15% opacity acts as a subtle yet visible trademark watermark
            ctx.drawImage(logoImgEl, 0, 0);
            transparentLogoBase64 = canvas.toDataURL('image/png');
        }
    } catch (e) {
        console.warn("DOM canvas watermark failed, falling back to image load:", e);
    }

    if (!transparentLogoBase64) {
        try {
            // 2. Load hotmapp-logo.png directly
            transparentLogoBase64 = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width || 300;
                        canvas.height = img.naturalHeight || img.height || 300;
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.globalAlpha = 0.15;
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (err) {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = 'hotmapp-logo.png';
                setTimeout(() => resolve(null), 3000);
            });
        } catch (e) {
            console.warn("Direct image load watermark failed:", e);
        }
    }

    if (!transparentLogoBase64) {
        try {
            // 3. Fallback via getBase64ImageFromUrl
            const rawBase64 = await getBase64ImageFromUrl('hotmapp-logo.png');
            if (rawBase64) {
                transparentLogoBase64 = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width || 300;
                            canvas.height = img.height || 300;
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.globalAlpha = 0.15;
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } catch (err) {
                            resolve(null);
                        }
                    };
                    img.onerror = () => resolve(null);
                    img.src = rawBase64;
                    setTimeout(() => resolve(null), 3000);
                });
            }
        } catch (e) {}
    }

    // Add transparent watermark logo in the middle of the invoice page
    // A4 dimensions: 210 x 297 mm. Center: x = 105 - 50 = 55, y = 148.5 - 50 = 98.5
    if (transparentLogoBase64) {
        try {
            doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
        } catch (err) {
            console.warn("Error adding watermark logo to PDF:", err);
        }
    }

    // Resolve seller business name for invoice header
    const candidateBizName = 
        options.sellerBusinessName ||
        options.businessName ||
        options.sellerName ||
        order.businessName ||
        order.companyName ||
        order.sellerName ||
        bizProfile?.companyName ||
        bizProfile?.businessName ||
        bizProfile?.name ||
        cachedBizProfile?.companyName ||
        cachedBizProfile?.businessName ||
        sellerProfile?.businessProfile?.companyName ||
        sellerProfile?.businessProfile?.businessName ||
        sellerProfile?.companyName ||
        sellerProfile?.businessName ||
        sellerProfile?.fullname ||
        sellerProfile?.displayName ||
        sellerProfile?.username;

    const bizName = (candidateBizName && candidateBizName.trim()) 
        ? candidateBizName.trim().toUpperCase() 
        : "HOTMAPP";

    doc.setFontSize(22);
    doc.setTextColor(18, 140, 126);
    doc.text(`${bizName} ORDER INVOICE`, 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const orderDate = order.timestamp ? new Date(order.timestamp).toLocaleString() : new Date().toLocaleString();
    doc.text(`Date: ${orderDate}`, 20, 32);
    const orderNumber = order.orderNumber || ('HTM-' + (order.id ? String(order.id).substring(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)));
    doc.text(`Order Number: ${orderNumber}`, 190, 32, { align: "right" });

    const chatName = options.chatName || elements.chatHeaderName?.textContent || "Customer";
    doc.text(`Customer: ${chatName}`, 20, 39);

    let currentY = 44;
    if (order.deliveryMethod === 'delivery' && order.deliveryAddress) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'bold');
        doc.text("DELIVERY ADDRESS:", 20, 46);
        const wrappedAddr = doc.splitTextToSize(order.deliveryAddress, 170);
        doc.text(wrappedAddr, 20, 51);
        currentY = 51 + (wrappedAddr.length * 5) + 2;

        doc.setFillColor(232, 245, 233);
        doc.rect(160, 35, 30, 7, 'F');
        doc.setTextColor(46, 125, 50);
        doc.text("DELIVERY", 175, 40, { align: "center" });
    } else if (order.pickupLocation) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'bold');
        doc.text("PICKUP LOCATION:", 20, 46);
        const locInfo = typeof order.pickupLocation === 'string' ? order.pickupLocation : `${order.pickupLocation.name || 'Store'} - ${order.pickupLocation.address || ''}`;
        const wrappedInfo = doc.splitTextToSize(locInfo, 170);
        doc.text(wrappedInfo, 20, 51);
        currentY = 51 + (wrappedInfo.length * 5) + 2;
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(20, currentY, 190, currentY);

    let y = currentY + 11;
    const items = order.items || [];
    const currency = order.currency || '$';

    // Pre-load all item images in parallel as base64 data URLs
    const base64Images = await Promise.all(
        items.map(async (item) => {
            const imgUrl = item.image || item.imageUrl || (Array.isArray(item.images) && item.images[0]) || (Array.isArray(item.photos) && item.photos[0]) || item.photo || null;
            if (imgUrl) {
                try {
                    return await getBase64ImageFromUrl(imgUrl);
                } catch (e) {
                    return null;
                }
            }
            return null;
        })
    );

    items.forEach((item, index) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity, 10) || 1;
        const itemTotal = formatPriceWithCommas(itemPrice * itemQty);
        const imgBase64 = base64Images[index];
        const textX = imgBase64 ? 35 : 20;

        const prefix = `${index + 1}. `;
        const prefixWidth = doc.getTextWidth(prefix);
        const productName = item.name || 'Product';

        const nameLines = doc.splitTextToSize(productName, 135 - (textX + prefixWidth));

        const detailsParts = [];
        if (item.form) detailsParts.push(`(${item.form.trim()})`);
        if (item.productQty) detailsParts.push(`(${item.productQty})`);
        detailsParts.push(`(Quantity: ${itemQty})`);
        detailsParts.push(`(${currency}${formatPriceWithCommas(itemPrice)} x ${itemQty})`);
        const detailsText = detailsParts.join(' ');
        const detailsLines = doc.splitTextToSize(detailsText, 135 - (textX + prefixWidth));

        const lineSpacing = 5;
        const totalLinesCount = nameLines.length + detailsLines.length;
        const itemHeight = Math.max(13, 5 + (totalLinesCount * lineSpacing));

        if (y + itemHeight > 270) {
            doc.addPage();
            if (transparentLogoBase64) {
                try {
                    doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
                } catch (err) {}
            }
            y = 25;
        }

        // Draw product thumbnail if available
        if (imgBase64) {
            try {
                let format = 'JPEG';
                if (imgBase64.startsWith('data:image/png')) {
                    format = 'PNG';
                } else if (imgBase64.startsWith('data:image/webp')) {
                    format = 'WEBP';
                }
                doc.addImage(imgBase64, format, 20, y - 5, 11, 11);
            } catch (err) {
                console.warn("Could not draw product thumbnail in invoice:", err);
            }
        }

        doc.setTextColor(0, 0, 0);
        doc.text(prefix, textX, y);

        doc.setTextColor(...invoiceBlue);
        nameLines.forEach((line, lineIdx) => {
            doc.text(line, textX + prefixWidth, y + (lineIdx * 5));
        });

        const detailsStartY = y + (nameLines.length * 5);
        doc.setTextColor(0, 0, 0);
        detailsLines.forEach((line, lineIdx) => {
            doc.text(line, textX + prefixWidth, detailsStartY + (lineIdx * 5));
        });

        doc.setTextColor(...invoiceBlue);
        doc.text(`${currency}${itemTotal}`, 190, y, { align: 'right' });

        y += itemHeight;
    });

    if (y + 10 > 270) {
        doc.addPage();
        if (transparentLogoBase64) {
            try {
                doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
            } catch (err) {}
        }
        y = 25;
    }
    doc.line(20, y, 190, y);
    y += 10;

    const subtotal = order.subtotal !== undefined ? order.subtotal : items.reduce((acc, it) => acc + ((parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 1)), 0);
    const shipping = order.shipping !== undefined ? order.shipping : 0;
    const total = order.total !== undefined ? order.total : (subtotal + (shipping > 0 ? shipping : 0));
    const isFreeDelivery = (order.deliveryMethod === 'delivery' && shipping === 0);
    const totalItemsCount = items.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 1), 0);

    if (y + 35 > 270) {
        doc.addPage();
        if (transparentLogoBase64) {
            try {
                doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
            } catch (err) {}
        }
        y = 25;
    }

    // 1. Items Total
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Items Total (${totalItemsCount} item${totalItemsCount > 1 ? 's' : ''}):`, 90, y);
    doc.setTextColor(...invoiceBlue);
    doc.text(`${currency}${formatPriceWithCommas(subtotal)}`, 190, y, { align: 'right' });
    y += 7;

    // 2. Delivery Fee
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (order.deliveryMethod === 'delivery') {
        doc.text(`Delivery Fee:`, 90, y);
        if (isFreeDelivery) {
            doc.setTextColor(18, 140, 126);
            doc.text(`FREE (${currency}0.00)`, 190, y, { align: 'right' });
        } else {
            doc.setTextColor(...invoiceBlue);
            doc.text(`${currency}${formatPriceWithCommas(shipping)}`, 190, y, { align: 'right' });
        }
    } else {
        doc.text(`Delivery Fee:`, 90, y);
        doc.setTextColor(100, 100, 100);
        doc.text(`${currency}0.00 (Self Pickup)`, 190, y, { align: 'right' });
    }
    y += 8;

    // Dividing line
    doc.setDrawColor(210, 210, 210);
    doc.line(90, y, 190, y);
    y += 7;

    // 3. Total Payment
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL PAYMENT:`, 90, y);
    doc.setTextColor(...invoiceBlue);
    doc.text(`${currency}${formatPriceWithCommas(total)}`, 190, y, { align: 'right' });
    doc.setFont(undefined, 'normal');

    if (y + 25 > 270) {
        doc.addPage();
        if (transparentLogoBase64) {
            try {
                doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
            } catch (err) {}
        }
        y = 25;
    }
    y += 20;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(`Business Address: ${bizAddress}`, 105, y, { align: "center" });
    y += 6;
    doc.text("Thank you for your business! We hope to see you again soon.", 105, y, { align: "center" });

    if (y + 35 > 270) {
        doc.addPage();
        if (transparentLogoBase64) {
            try {
                doc.addImage(transparentLogoBase64, 'PNG', 55, 98.5, 100, 100);
            } catch (err) {}
        }
        y = 25;
    }
    y += 25;
    doc.setDrawColor(100, 100, 100);
    doc.line(20, y, 70, y);
    doc.text("Customer Signature", 45, y + 5, { align: "center" });
    doc.line(140, y, 190, y);
    doc.text("Authorized Signature", 165, y + 5, { align: "center" });

    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    return { doc, blob: pdfBlob, blobUrl, orderNumber };
};

export const initShop = () => {
    let currentShopProducts = [];
    const openShopMode = () => {
        const activeUid = getActiveChatUid();
        const activeConversationUid = document.querySelector('.conversation-item.active')?.dataset.uid || null;
        const sellerId = resolveActiveSellerId({
            shopSellerId: currentShopSellerId,
            activeChatUid: activeUid,
            activeConversationUid,
            currentUserId: auth.currentUser?.uid || null
        });
        if (sellerId) {
            currentShopSellerId = sellerId;
        }
        const chatAreaEl = elements.chatArea;
        const shopContainerEl = elements.shopContainer;
        if (!chatAreaEl) return;

        setShopModeVisibility({
            chatAreaEl,
            shopContainerEl,
            isActive: true,
            isMobile: window.innerWidth <= 768,
            onEnter: () => {
                if (window.innerWidth <= 768) {
                    pushHistoryState('shop-view', () => {
                        setShopModeVisibility({ chatAreaEl, shopContainerEl, isActive: false, isMobile: true });
                    });
                }
            }
        });

        if (sellerId) {
            resetSellerContext(sellerId);
            loadAndRenderSellerShop(sellerId);
        } else {
            resetSellerContext(null);
            if (elements.shopProductGrid) {
                elements.shopProductGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">Select a chat to view its shop.</div>';
            }
        }
    };

    const loadAndRenderSellerShop = async (sellerId) => {
        const grid = elements.shopProductGrid;
        if (!grid || !sellerId) return;

        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);"><span class="spinner" style="margin: 0 auto 10px;"></span> Loading Shop...</div>';

        try {
            const safeSellerId = String(sellerId).trim();
            const cachedProducts = await getCachedProductsByOwner(safeSellerId);
            if (cachedProducts.length > 0) {
                renderShopProducts(cachedProducts);
            }

            const productsMap = await getProductsByOwner(safeSellerId);
            const productsList = Object.values(productsMap || {});
            renderShopProducts(productsList);
        } catch (err) {
            console.error("Error loading seller shop:", err);
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">Failed to load products.</div>';
        }
    };

    const renderShopProducts = (productsList) => {
        const normalizedProducts = Array.isArray(productsList) ? productsList : Object.values(productsList || {});
        currentShopProducts = normalizedProducts;
        const grid = elements.shopProductGrid;
        if (!grid) return;

        grid.innerHTML = '';
        
        if (normalizedProducts.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted); font-size: 0.95rem;">No products available in this shop.</div>';
            return;
        }
        
        normalizedProducts.forEach(product => {
            const mainImg = product.images?.[0] || '';
            const imagesAttr = JSON.stringify(product.images || []);
            const priceHtml = `<span class="product-currency">${product.currency}</span>${parsePrice(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            const soldOutBadge = product.soldOut ? '<div class="sold-out-badge" style="position: absolute; top: 10px; left: 10px; transform: none; background: #e0a800; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; z-index: 10; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">READY SOON</div>' : '';
            const cardClass = product.soldOut ? 'product-card is-sold-out' : 'product-card';
            const cardStyle = product.soldOut ? 'style="opacity: 0.65; position: relative;"' : 'style="position: relative;"';
            const btnHtml = product.soldOut 
                ? '<button class="add-to-cart-btn" disabled style="background: var(--muted); border-color: var(--muted); cursor: not-allowed; opacity: 0.6;">Ready Soon</button>'
                : '<button class="add-to-cart-btn">Add to Cart</button>';

            const shopHtml = `
                <div class="${cardClass}" data-id="${product.id}" data-images=\'${imagesAttr}\' ${cardStyle} data-ui="product-card">
                    ${soldOutBadge}
                    <div class="image-loader-wrapper">
                        <div class="spinner"></div>
                        <img src="${mainImg}" alt="${product.name}" class="product-img" onload="this.classList.add(\'loaded\'); this.previousElementSibling.style.display=\'none\';">
                    </div>
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-desc">${product.desc}</p>
                    ${product.desc && product.desc.length > 60 ? `<span class="view-details-link" style="color: var(--brand, #0066cc); font-size: 0.78rem; cursor: pointer; display: inline-block; margin-bottom: 8px; font-weight: 500;">Read more</span>` : ''}
                    <div class="product-meta">
                        <span class="product-form">Form: ${product.form || ''}</span>
                        <span class="product-quantity">Quantity: ${product.qty || ''}</span>
                        <div class="product-price">${priceHtml}</div>
                    </div>
                    ${btnHtml}
                </div>`;
            grid.insertAdjacentHTML('beforeend', shopHtml);
        });
    };

    const closeShopMode = () => {
        const chatAreaEl = elements.chatArea;
        const shopContainerEl = elements.shopContainer;
        setShopModeVisibility({
            chatAreaEl,
            shopContainerEl,
            isActive: false,
            isMobile: window.innerWidth <= 768,
            onExit: () => {
                if (window.innerWidth <= 768) {
                    removeHistoryState('shop-view');
                    if (window.history.state && window.history.state.hotmappState === 'shop-view') {
                        window.history.back();
                    }
                }
            }
        });
    };

    window.openShopMode = openShopMode;
    window.closeShopMode = closeShopMode;
    window.showProductDetails = showProductDetails;
    window.setActiveShopSellerId = (sellerId) => {
        resetSellerContext(sellerId);
        return currentShopSellerId;
    };
    window.getActiveShopSellerId = () => currentShopSellerId;

    // Create Scroll to Top Button if it doesn't exist
    if (elements.chatArea && !elements.scrollToTopBtn) {
        const btn = document.createElement('button');
        btn.className = 'scroll-to-top-btn';
        btn.dataset.ui = 'scroll-to-top-btn';
        btn.innerHTML = '↑';
        btn.title = 'Scroll to top';
        elements.chatArea.appendChild(btn);
    }

    // Draggable Floating Shop Button Logic
    let isDragging = false;
    let dragStartX, dragStartY;
    let initialLeft, initialTop;
    const dragButton = elements.floatingShopBtn;

    const onDragStart = (e) => {
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        dragStartX = clientX;
        dragStartY = clientY;

        const rect = dragButton.getBoundingClientRect();
        const containerRect = elements.chatArea.getBoundingClientRect();

        initialLeft = rect.left - containerRect.left;
        initialTop = rect.top - containerRect.top;

        dragButton.style.transition = 'none';
        isDragging = false;

        document.addEventListener('mousemove', onDragging);
        document.addEventListener('touchmove', onDragging, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    };

    const onDragging = (e) => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            isDragging = true;
        }

        if (isDragging) {
            if (e.cancelable) e.preventDefault();
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const containerRect = elements.chatArea.getBoundingClientRect();
            newLeft = Math.max(0, Math.min(newLeft, containerRect.width - dragButton.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, containerRect.height - dragButton.offsetHeight));

            dragButton.style.left = `${newLeft}px`;
            dragButton.style.top = `${newTop}px`;
            dragButton.style.right = 'auto';
            dragButton.style.bottom = 'auto';
        }
    };

    let lastClickTime = 0;
    const triggerShopOpen = async () => {
        const now = Date.now();
        if (now - lastClickTime < 400) return;
        lastClickTime = now;

        const user = auth.currentUser;
        const currentActiveChatUid = getActiveChatUid();
        const activeConversationUid = document.querySelector('.conversation-item.active')?.dataset.uid || null;
        const resolvedSellerUid = resolveActiveSellerId({
            activeChatUid: currentActiveChatUid,
            activeConversationUid,
            currentUserId: user?.uid || null
        });

        if (!resolvedSellerUid || !user) {
            openShopMode();
            return;
        }

        if (resolvedSellerUid === user.uid) {
            openShopMode();
            return;
        }

        const sellerProfile = await getUserProfile(resolvedSellerUid);
        const sellerWhoCanViewShop = sellerProfile?.whoCanViewShop || 'anyone';
        const isFriendSnap = await get(ref(db, `users/${user.uid}/customerList/${resolvedSellerUid}`));
        const isContactOfSeller = isFriendSnap.exists();
        const isExcludedBySeller = !!(sellerProfile?.excludedContacts && sellerProfile.excludedContacts[user.uid]);

        let blockReason = '';
        let showRequestBtn = true;

        if (sellerWhoCanViewShop === 'friends-only') {
            if (!isContactOfSeller) {
                blockReason = `You cannot view this shop because the seller allows only friends to view their shop.`;
                showRequestBtn = true;
            }
        } else if (sellerWhoCanViewShop === 'excluded') {
            if (!isContactOfSeller) {
                blockReason = `You cannot view this shop because the seller allows only approved contacts to view their shop.`;
                showRequestBtn = true;
            } else if (isExcludedBySeller) {
                blockReason = `You cannot view this shop because the seller has restricted access for this contact.`;
                showRequestBtn = false;
            }
        }

        if (blockReason) {
            await openShopAccessRequestModal(resolvedSellerUid, sellerProfile, blockReason, null, showRequestBtn);
        } else {
            openShopMode();
        }
    };

    const onDragEnd = () => {
        dragButton.style.transition = '';
        document.removeEventListener('mousemove', onDragging);
        document.removeEventListener('touchmove', onDragging);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);

        if (!isDragging) {
            triggerShopOpen();
        }
    };

    dragButton?.addEventListener('mousedown', onDragStart);
    dragButton?.addEventListener('touchstart', onDragStart, { passive: true });

    elements.cartDeliverySection?.addEventListener('change', (e) => {
        if (e.target.name === 'delivery-method') {
            deliveryMethod = e.target.value;
            if (elements.deliveryAddressContainer) {
                elements.deliveryAddressContainer.style.display = deliveryMethod === 'delivery' ? 'block' : 'none';
            }
            updateCartUI();
        }
    });

    elements.toggleAddressModeBtn?.addEventListener('click', () => {
        addressMode = addressMode === 'simple' ? 'structured' : 'simple';
        updateAddressUI();
    });

    elements.pickDeliveryLocationBtn?.addEventListener('click', () => {
        if (elements.businessLocationPickerModal) {
            elements.businessLocationPickerModal.dataset.mode = 'delivery-address';
            const currentAddr = elements.deliveryAddressInput?.value.trim();
            const coords = selectedDeliveryCoordinates ? { latitude: selectedDeliveryCoordinates.lat, longitude: selectedDeliveryCoordinates.lng } : (cachedStoreLatitude && cachedStoreLongitude ? { latitude: cachedStoreLatitude, longitude: cachedStoreLongitude } : null);
            openBusinessLocationPicker('delivery-address', coords ? { ...coords, address: currentAddr } : (currentAddr ? { address: currentAddr } : null));
        }
    });

    elements.gpsAddressBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "error");
            return;
        }

        const btn = elements.gpsAddressBtn;
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:10px; height:10px; border-width:2px; margin:0;"></span>';

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            setSelectedDeliveryCoordinates({ lat, lng });
            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await resp.json();
                const address = data.display_name || `${lat}, ${lng}`;

                if (addressMode === 'simple') {
                    if (elements.deliveryAddressInput) {
                        elements.deliveryAddressInput.value = address;
                        elements.deliveryAddressInput.dispatchEvent(new Event('input'));
                        elements.deliveryAddressInput.dispatchEvent(new Event('change'));
                    }
                } else {
                    if (elements.addrStreet) {
                        elements.addrStreet.value = address;
                        elements.addrStreet.dispatchEvent(new Event('input'));
                        elements.addrStreet.dispatchEvent(new Event('change'));
                    }
                    showToast("Street address set. Please verify City/State.", "info");
                }

                showToast("Address set from GPS", "success");
            } catch (error) {
                showToast("Failed to resolve address", "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        }, (error) => {
            showToast("GPS access denied", "error");
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }, { enableHighAccuracy: true });
    });

    elements.deliveryAddressInput?.addEventListener('input', () => {
        const input = elements.deliveryAddressInput;
        const count = input.value.length;
        if (elements.deliveryAddressCharCount) {
            elements.deliveryAddressCharCount.textContent = `${count}/${MAX_DELIVERY_ADDRESS_LENGTH}`;
            if (count > MAX_DELIVERY_ADDRESS_LENGTH) {
                elements.deliveryAddressCharCount.style.color = 'var(--error)';
            } else {
                elements.deliveryAddressCharCount.style.color = 'var(--muted)';
            }
        }
        if (window._updateCartUI) window._updateCartUI();
    });

    ['input', 'change'].forEach(evt => {
        elements.addrStreet?.addEventListener(evt, () => { if (window._updateCartUI) window._updateCartUI(); });
        elements.addrCity?.addEventListener(evt, () => { if (window._updateCartUI) window._updateCartUI(); });
        elements.addrState?.addEventListener(evt, () => { if (window._updateCartUI) window._updateCartUI(); });
    });

    // Initialize Autocomplete & Landmark detection
    const suggestionsDropdown = document.querySelector('[data-ui="delivery-address-suggestions"]');
    const landmarkPrompt = document.querySelector('[data-ui="delivery-landmark-prompt"]');
    const landmarkInput = document.querySelector('[data-ui="delivery-landmark-input"]');
    const applyLandmarkBtn = document.querySelector('[data-ui="apply-landmark-btn"]');
    const landmarkSuggestionsList = document.querySelector('[data-ui="landmark-suggestions-list"]');

    if (elements.deliveryAddressInput && suggestionsDropdown) {
        initDeliveryAddressAutocomplete({
            inputElement: elements.deliveryAddressInput,
            suggestionsContainer: suggestionsDropdown,
            landmarkPromptContainer: landmarkPrompt,
            onSelect: ({ address, lat, lng }) => {
                setSelectedDeliveryCoordinates({ lat, lng });
                if (window._updateCartUI) window._updateCartUI();
            }
        });
    }

    if (elements.addrStreet && suggestionsDropdown) {
        initDeliveryAddressAutocomplete({
            inputElement: elements.addrStreet,
            suggestionsContainer: suggestionsDropdown,
            landmarkPromptContainer: landmarkPrompt,
            onSelect: ({ address, lat, lng }) => {
                setSelectedDeliveryCoordinates({ lat, lng });
                if (window._updateCartUI) window._updateCartUI();
            }
        });
    }

    // Handle Landmark detection when street could not be pinpointed
    const resolveLandmark = async () => {
        const query = landmarkInput?.value.trim();
        if (!query) {
            showToast("Please enter a landmark (e.g. school, bank, junction).", "warning");
            return;
        }

        if (applyLandmarkBtn) {
            applyLandmarkBtn.disabled = true;
            applyLandmarkBtn.innerHTML = '<span class="spinner" style="width:10px; height:10px; border-width:2px; margin:0;"></span>';
        }

        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`);
            const results = await resp.json();

            if (results && results.length > 0) {
                const best = results[0];
                const lat = parseFloat(best.lat);
                const lng = parseFloat(best.lon);

                setSelectedDeliveryCoordinates({ lat, lng });

                // Append landmark to current address
                if (addressMode === 'simple' && elements.deliveryAddressInput) {
                    const currentVal = elements.deliveryAddressInput.value.trim();
                    if (currentVal && !currentVal.toLowerCase().includes(query.toLowerCase())) {
                        elements.deliveryAddressInput.value = `${currentVal} (Near: ${best.display_name})`;
                    } else if (!currentVal) {
                        elements.deliveryAddressInput.value = best.display_name;
                    }
                    elements.deliveryAddressInput.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (elements.addrStreet) {
                    const currentVal = elements.addrStreet.value.trim();
                    if (currentVal && !currentVal.toLowerCase().includes(query.toLowerCase())) {
                        elements.addrStreet.value = `${currentVal} (Near ${query})`;
                    }
                    elements.addrStreet.dispatchEvent(new Event('input', { bubbles: true }));
                }

                if (landmarkPrompt) landmarkPrompt.style.display = 'none';
                if (landmarkSuggestionsList) landmarkSuggestionsList.style.display = 'none';
                if (landmarkInput) landmarkInput.value = '';

                showToast("Nearest landmark detected & coordinates resolved!", "success");
                if (window._updateCartUI) window._updateCartUI();
            } else {
                showToast("Could not locate this landmark. Try a different landmark or pick on map.", "warning");
            }
        } catch (err) {
            console.error("Landmark detection error:", err);
            showToast("Error locating landmark.", "error");
        } finally {
            if (applyLandmarkBtn) {
                applyLandmarkBtn.disabled = false;
                applyLandmarkBtn.textContent = 'Detect';
            }
        }
    };

    applyLandmarkBtn?.addEventListener('click', resolveLandmark);
    landmarkInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            resolveLandmark();
        }
    });

    elements.shopPickupLocationsList?.addEventListener('click', (e) => {
        const item = e.target.closest('.shop-pickup-location-item');
        if (!item) return;

        const index = parseInt(item.dataset.index);
        if (!isNaN(index) && cachedShopLocations[index]) {
            selectedPickupLocation = cachedShopLocations[index];
            updateShopPickupLocations(cachedShopLocations);
            if (navigator.vibrate) navigator.vibrate(10);
        }
    });

    dragButton?.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            return;
        }
        triggerShopOpen();
    });

    /**
     * Opens a read-only modal displaying the seller's business profile details.
     */
    const openSellerBusinessProfileModal = async () => {
        const sellerId = currentShopSellerId || getActiveChatUid();
        if (!cachedBizProfile || sellerId !== cachedBizProfileOwnerId) {
            if (sellerId) {
                cachedBizProfile = null;
                cachedBizProfileOwnerId = sellerId;
                try {
                    const sellerProfile = await getUserProfile(sellerId);
                    if (sellerProfile?.businessProfile) {
                        cachedBizProfile = sellerProfile.businessProfile;
                    } else {
                        const fetchedProfile = await getBusinessProfile(sellerId);
                        if (fetchedProfile) {
                            cachedBizProfile = fetchedProfile;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch seller business profile for Buz Info:', error);
                }
            }
        }

        if (!cachedBizProfile) {
            showToast("No business profile data available for this seller.", "error");
            return;
        }

        const modal = elements.businessProfileModal;
        const content = elements.businessProfileContent;
        if (!modal || !content) return;

        const data = cachedBizProfile;
        const countryName = data.businessCountry || 'N/A';

        let html = `
            <div class="business-profile-view" style="display: flex; flex-direction: column; gap: 15px;">
                ${data.logoUrl ? `
                    <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid var(--brand); box-shadow: var(--shadow); background: var(--panel-soft); margin: 0 auto;">
                        <img src="${data.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                ` : ''}
                <div class="info-group">
                    <label>Company Name</label>
                    <p style="font-weight: 700; ${data.logoUrl ? 'text-align: center;' : ''}">${data.companyName || 'N/A'}</p>
                </div>
                <div class="info-row">
                    <div class="info-group">
                        <label>Category</label>
                        <p>${data.category || 'General'}</p>
                    </div>
                    <div class="info-group">
                        <label>Business base</label>
                        <p>${countryName}</p>
                    </div>
                </div>
                <div class="info-group">
                    <label>Service Type</label>
                    <p style="text-transform: capitalize;">${data.serviceType || 'N/A'}</p>
                </div>
                <div class="info-group">
                    <label>Pickup Locations</label>
                    <div class="locations-summary">
                        ${data.pickupLocations?.length ? data.pickupLocations.map(loc => `
                            <div class="loc-summary-item" style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                                <strong>${loc.name}</strong>
                                <div style="font-size: 0.85rem; color: var(--muted); margin-top: 2px;">${loc.address}</div>
                            </div>
                        `).join('') : '<p class="muted">No pickup locations set.</p>'}
                    </div>
                </div>
                <div class="info-group">
                    <label>Delivery Coverage</label>
                    ${data.deliveryCoverage?.countries?.length ? `<p style="margin-top: 4px;"><strong>Countries:</strong> ${data.deliveryCoverage.countries.join(', ')}</p>` : ''}
                    ${data.deliveryCoverage?.states?.length ? `<p style="margin-top: 4px;"><strong>States:</strong> ${data.deliveryCoverage.states.join(', ')}</p>` : ''}
                    ${data.deliveryCoverage?.cities?.length ? `<p style="margin-top: 4px;"><strong>Cities:</strong> ${data.deliveryCoverage.cities.join(', ')}</p>` : ''}
                    ${data.deliveryCoverage?.streets?.length ? `<p style="margin-top: 4px;"><strong>Streets / Areas:</strong> ${data.deliveryCoverage.streets.join(', ')}</p>` : ''}
                    ${data.deliveryFee ? `<p style="margin-top: 4px;">Base Fee: ${data.currency || '$'}${formatPriceWithCommas(data.deliveryFee)}</p>` : ''}
                    ${data.minFreeDelivery ? `<p style="margin-top: 4px;">Free Delivery threshold: ${data.currency || '$'}${formatPriceWithCommas(data.minFreeDelivery)}</p>` : ''}
                </div>
            </div>
        `;

        content.innerHTML = html;
        modal.style.display = 'flex';
    };

    elements.shopBuzInfoBtn?.addEventListener('click', openSellerBusinessProfileModal);

    elements.shopCloseBtn?.addEventListener('click', () => {
        closeShopMode();
    });

    elements.reportBusinessBtn?.addEventListener('click', () => {
        if (elements.reportBusinessModal) {
            elements.reportBusinessModal.style.display = 'flex';
            if (elements.reportReasonInput) elements.reportReasonInput.value = '';
        }
    });

    elements.closeReportBusinessModalBtn?.addEventListener('click', () => {
        if (elements.reportBusinessModal) elements.reportBusinessModal.style.display = 'none';
    });

    elements.submitReportBusinessBtn?.addEventListener('click', async () => {
        const reason = elements.reportReasonInput?.value.trim();
        const user = auth.currentUser;

        if (!reason) {
            showToast("Please provide a reason for the report.", "warning");
            return;
        }

        const currentActiveChatUid = getActiveChatUid();
        if (!user || !currentActiveChatUid) return;

        try {
            elements.submitReportBusinessBtn.disabled = true;
            elements.submitReportBusinessBtn.textContent = 'Submitting...';
            await reportBusiness(user.uid, currentActiveChatUid, reason);
            showToast("Business reported. Thank you for your feedback.", "success");
            if (elements.reportBusinessModal) elements.reportBusinessModal.style.display = 'none';
        } catch (error) {
            console.error("Report error:", error);
            showToast("Failed to submit report. Please try again.", "error");
        } finally {
            elements.submitReportBusinessBtn.disabled = false;
            elements.submitReportBusinessBtn.textContent = 'Submit Report';
        }
    });

    // Shrink search bar on scroll
    elements.shopContainer?.addEventListener('scroll', () => {
        if (elements.shopSearchBar) {
            elements.shopSearchBar.classList.toggle('scrolled', elements.shopContainer.scrollTop > 20);
        }

        // Show scroll-to-top button after scrolling 300px
        if (elements.scrollToTopBtn) {
            elements.scrollToTopBtn.classList.toggle('visible', elements.shopContainer.scrollTop > 300);
        }
    });

    elements.scrollToTopBtn?.addEventListener('click', () => {
        elements.shopContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /**
     * Animates an item clone flying from source to target
     */
    const animateFlyingItem = (sourceEl, targetEl) => {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const img = sourceEl.querySelector('img');

        const flyer = document.createElement('img');
        flyer.src = img ? img.src : '';
        flyer.className = 'flying-item';
        flyer.style.left = `${sourceRect.left}px`;
        flyer.style.top = `${sourceRect.top}px`;
        flyer.style.width = `${sourceRect.width}px`;
        flyer.style.height = `${sourceRect.height}px`;

        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left + (targetRect.width / 2) - 15}px`;
            flyer.style.top = `${targetRect.top + (targetRect.height / 2) - 15}px`;
            flyer.style.width = '30px';
            flyer.style.height = '30px';
            flyer.style.opacity = '0.5';
        });

        flyer.addEventListener('transitionend', () => flyer.remove());
    };

    // Cart Resizing Logic
    let isResizing = false;
    let hasVibratedAtMax = false;
    let startY, startHeight;

    const initCartResizer = () => {
        const handle = elements.cartDragHandle;
        const content = elements.cartContent;

        if (!handle || !content) return;

        const startResize = (e) => {
            isResizing = true;
            hasVibratedAtMax = false;
            handle.classList.add('resizing');
            startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            startHeight = content.offsetHeight;
            content.style.transition = 'none'; // Disable transition for real-time dragging
            document.addEventListener('mousemove', resize);
            document.addEventListener('touchmove', resize, { passive: false });
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchend', stopResize);
        };

        const resize = (e) => {
            if (!isResizing) return;
            if (e.cancelable) e.preventDefault();

            const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            const diff = startY - currentY; // Moving up decreases Y, so diff is positive

            // Limit expansion to leave room for the header using the usable viewport height.
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const maxAllowedHeight = viewportHeight - 60;
            // Allow dragging down slightly lower than min height for visual feedback before snap
            const newHeight = Math.min(maxAllowedHeight, Math.max(150, startHeight + diff));

            const isAtMax = newHeight >= maxAllowedHeight - 5;

            // Trigger haptic feedback when hitting maximum height
            if (isAtMax && !hasVibratedAtMax) {
                if (navigator.vibrate) navigator.vibrate(15);
                hasVibratedAtMax = true;
            } else if (!isAtMax) {
                hasVibratedAtMax = false;
            }

            content.style.height = `${newHeight}px`;
            content.classList.toggle('full-screen', isAtMax);
        };

        const stopResize = () => {
            isResizing = false;
            handle.classList.remove('resizing');
            content.style.transition = ''; // Restore transitions

            const currentHeight = content.offsetHeight;
            // Snap to bottom: If dragged below 250px, close the cart
            if (currentHeight < 250) {
                closeCart();
            } else if (currentHeight < 300) {
                // Ensure it stays at a minimum usable height if not snapped closed
                content.style.height = '300px';
            }

            document.removeEventListener('mousemove', resize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchend', stopResize);
        };

        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', startResize, { passive: true });
    };

    let isProgrammaticScroll = false;
    let activeCartTab = 'cart'; // Tracks the active view: 'cart' or 'saved'
    let lastDeletedData = null;
    let snackbarTimeout = null;

    /**
     * Displays a snackbar with an Undo action for deletions
     */
    const showUndoSnackbar = (message) => {
        document.querySelector('.undo-snackbar')?.remove();
        clearTimeout(snackbarTimeout);

        const snackbar = document.createElement('div');
        snackbar.className = 'undo-snackbar';
        snackbar.innerHTML = `<span>${message}</span><button class="undo-btn">Undo</button>`;
        document.body.appendChild(snackbar);

        snackbar.querySelector('.undo-btn').onclick = () => {
            if (lastDeletedData) {
                if (lastDeletedData.list === 'saved') savedItems.push(lastDeletedData.item);
                else cart.push(lastDeletedData.item);
                updateCartUI();
                lastDeletedData = null;
                snackbar.remove();
            }
        };

        snackbarTimeout = setTimeout(() => {
            snackbar.classList.add('fade-out');
            setTimeout(() => snackbar.remove(), 300);
        }, 4000);
    };

    /**
 * Renders the list of reviews for a product.
 * @param {Array<object>} reviews - An array of review objects.
 */
const renderReviews = (reviews) => {
    if (!elements.reviewsList) return;

    if (!reviews || reviews.length === 0) {
        elements.reviewsList.innerHTML = '<p style="color: var(--muted); font-size: 0.9rem; text-align: center;">No reviews yet. Be the first!</p>';
        return;
    }

    elements.reviewsList.innerHTML = reviews.sort((a, b) => b.timestamp - a.timestamp).map(review => {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const date = new Date(review.timestamp).toLocaleDateString();
        const avatar = getAvatarUrl(review.userName, review.userAvatar);

        return `
            <div class="review-item" style="padding: 12px 0; border-bottom: 1px solid var(--panel-soft);">
                <div class="review-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <img src="${avatar}" alt="${review.userName}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <strong style="font-size: 0.9rem;">${review.userName}</strong>
                        <div class="star" style="color: #ffa41c; font-size: 0.9rem;">${stars}</div>
                    </div>
                    <span style="margin-left: auto; font-size: 0.75rem; color: var(--muted);">${date}</span>
                </div>
                <p style="font-size: 0.9rem; color: var(--text); margin: 0; line-height: 1.5;">${review.text}</p>
            </div>
        `;
    }).join('');
};

/**
 * Handles the star rating input interaction.
 */
const handleStarRating = (e) => {
    const star = e.target.closest('i');
    if (!star) return;

    const rating = parseInt(star.dataset.value);
    if (elements.reviewRatingValue) {
        elements.reviewRatingValue.value = rating;
    }

    const stars = elements.reviewStarRating.querySelectorAll('i');
    stars.forEach(s => {
        const sValue = parseInt(s.dataset.value);
        s.classList.toggle('fa-solid', sValue <= rating);
        s.classList.toggle('fa-regular', sValue > rating);
        s.style.color = sValue <= rating ? '#ffa41c' : 'var(--muted)';
    });
};


    /**
     * Opens the product details modal
     */
    function showProductDetails(item) {
        if (!item || !elements.productDetailsModal) return;

        // Track recently viewed product ID
        if (item.id && typeof window.trackRecentlyViewed === 'function') {
            window.trackRecentlyViewed(item.id);
        }

        if (elements.detailsImg) elements.detailsImg.src = item.image;
        if (elements.detailsName) elements.detailsName.textContent = item.name;
        if (elements.detailsDesc) elements.detailsDesc.textContent = item.description || 'No description available.';
        if (elements.detailsPrice) elements.detailsPrice.textContent = `${item.currency}${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        if (elements.detailsMeta) {
            elements.detailsMeta.innerHTML = `
                <span class="product-form">${item.form}</span>
                <span class="product-quantity">${item.productQty}</span>
            `;
        }

        if (elements.detailsRating) {
            const rating = item.avgRating || 0;
            const reviews = item.reviewCount || 0;
            let stars = '';
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            for (let i = 0; i < 5; i++) {
                if (i < fullStars) stars += '★';
                else if (i === fullStars && halfStar) stars += '★'; // Represent half as full for simplicity
                else stars += '☆';
            }
            elements.detailsRating.innerHTML = `<span class="star">${stars}</span> <span class="rating-count">${reviews} ratings</span>`;
        }

        // Handle reviews
        currentReviewProductId = item.id;
        if (reviewsUnsubscribe) reviewsUnsubscribe(); // Unsubscribe from previous product's reviews

        if (elements.reviewFormContainer) {
            const user = auth.currentUser;
            // For now, allow any logged-in user to review.
            // A real-world app would check if the user has purchased the item.
            elements.reviewFormContainer.style.display = user ? 'block' : 'none';
        }

        if (elements.reviewForm) elements.reviewForm.reset();
        if (elements.reviewRatingValue) elements.reviewRatingValue.value = '';
        elements.reviewStarRating?.querySelectorAll('i').forEach(s => {
            s.className = 'fa-regular fa-star';
            s.style.color = 'var(--muted)';
        });

        reviewsUnsubscribe = subscribeToReviews(item.id, renderReviews);

        elements.productDetailsModal.style.display = 'flex';
    };

    const updateCartUI = () => {
        const count = cart.reduce((acc, item) => acc + item.quantity, 0);
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const currency = cart.length > 0 ? cart[0].currency : (savedItems.length > 0 ? savedItems[0].currency : '$');

        const shipping = calculateShippingFee(subtotal);
        const isOutOfRange = (deliveryMethod === 'delivery' && shipping === -1);
        const total = subtotal + (isOutOfRange ? 0 : shipping);
        const isFreeDelivery = (deliveryMethod === 'delivery' && !isOutOfRange && shipping === 0);

        // Update Tab UI and counts
        if (elements.cartTabCount) elements.cartTabCount.textContent = cart.length;
        if (elements.savedTabCount) elements.savedTabCount.textContent = savedItems.length;

        elements.cartTabCart?.classList.toggle('active', activeCartTab === 'cart');
        elements.cartTabSaved?.classList.toggle('active', activeCartTab === 'saved');

        // Toggle view containers
        if (elements.cartItemsList) {
            const isShowing = activeCartTab === 'cart';
            const wasHidden = elements.cartItemsList.style.display === 'none';
            elements.cartItemsList.style.display = isShowing ? 'block' : 'none';
            if (isShowing && wasHidden) elements.cartItemsList.classList.add('animate-cart-left');
            else if (!isShowing) elements.cartItemsList.classList.remove('animate-cart-left');
        }

        if (elements.savedLaterSection) {
            const isShowing = activeCartTab === 'saved';
            const wasHidden = elements.savedLaterSection.style.display === 'none';
            elements.savedLaterSection.style.display = isShowing ? 'block' : 'none';
            if (isShowing && wasHidden) elements.savedLaterSection.classList.add('animate-cart-right');
            else if (!isShowing) elements.savedLaterSection.classList.remove('animate-cart-right');
        }

        // Only show the checkout footer when on the cart tab
        if (elements.cartFooter) elements.cartFooter.style.display = activeCartTab === 'cart' ? 'grid' : 'none';

        if (elements.moveAllToSavedBtn) {
            elements.moveAllToSavedBtn.style.display = (activeCartTab === 'cart' && cart.length > 0) ? 'block' : 'none';
        }

        if (elements.cartCountBadge) {
            elements.cartCountBadge.textContent = count;
        }

        // Update shop header button to show a running total price
        if (elements.cartToggleBtn) {
            let totalDisplay = elements.cartToggleBtn.querySelector('.shop-cart-total-display');
            if (!totalDisplay) {
                totalDisplay = document.createElement('span');
                totalDisplay.className = 'shop-cart-total-display';
                totalDisplay.style.marginLeft = '8px';
                totalDisplay.style.borderLeft = '1px solid rgba(255,255,255,0.3)';
                totalDisplay.style.paddingLeft = '8px';
                elements.cartToggleBtn.appendChild(totalDisplay);
            }
            totalDisplay.textContent = count > 0 ? `${currency}${formatPriceWithCommas(total)}` : '';
        }

        if (elements.shopBadge) {
            elements.shopBadge.textContent = count;
            elements.shopBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        if (elements.cartItemsList) {
            elements.cartItemsList.innerHTML = cart.length === 0
                ? '<div style="text-align: center; padding: 40px 0;"><p style="color: var(--muted);">Your cart is empty</p></div>'
                : cart.map((item, index) => `
                    <div class="cart-item-swipe-wrapper">
                        <div class="cart-swipe-background">🗑️</div>
                        <div class="cart-item" data-id="${item.id}">
                            <div class="cart-item-header">
                                <div class="cart-item-name">${item.name}</div>
                                <div class="cart-item-meta">
                                    <small>${item.form || ''} ${item.productQty ? '• ' + item.productQty : ''} • <strong>${item.currency}${formatPriceWithCommas(item.price)}</strong></small>
                                </div>
                            </div>
                            <div class="cart-item-controls-row">
                                <img src="${item.image}" alt="${item.name}" class="cart-item-img" title="View Details">
                                <div class="cart-item-qty-selector">
                                    <button class="cart-qty-btn decrease" data-id="${item.id}">-</button>
                                    <span class="cart-qty-value">${item.quantity}</span>
                                    <button class="cart-qty-btn increase" data-id="${item.id}">+</button>
                                </div>
                                <div class="cart-item-price">${item.currency}${formatPriceWithCommas(item.price * item.quantity)}</div>
                                <button class="remove-cart-item" data-id="${item.id}">🗑</button>
                            </div>
                            <div class="cart-item-footer">
                                <button class="save-later-btn" data-id="${item.id}">Save for later</button>
                            </div>
                        </div>
                    </div>
                `).join('');
        }

        if (elements.savedItemsList && elements.savedLaterSection) {
            if (elements.savedCountBadge) {
                elements.savedCountBadge.textContent = savedItems.length;
            }
            elements.savedItemsList.innerHTML = savedItems.map(item => `
                <div class="cart-item-swipe-wrapper">
                    <div class="cart-swipe-background">🗑️</div>
                    <div class="cart-item" data-id="${item.id}">
                        <img src="${item.image}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 6px; border: 1px solid #eee; background: white; filter: grayscale(0.5); flex-shrink: 0; cursor: pointer;" title="View Details">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-meta">
                                <small>${item.form || ''} ${item.productQty ? '• ' + item.productQty : ''} • <span style="font-weight: 700; color: var(--muted);">${item.currency}${formatPriceWithCommas(item.price)}</span></small>
                            </div>
                            <button class="move-to-cart-btn" data-id="${item.id}" style="background:white; border:1px solid #d5d9d9; border-radius:6px; padding:2px 8px; font-size:0.7rem; cursor:pointer;">Move to cart</button>
                        </div>
                        <button class="remove-saved-item" data-id="${item.id}" style="background:none; border:none; cursor:pointer; color:#ff4d4d; margin-left: auto; font-size: 1rem;">🗑</button>
                    </div>
                </div>
            `).join('');
        }

        if (elements.cartTotalDisplay) {
            let html = `<div>Total: ${currency}${formatPriceWithCommas(total)}</div>`;
            if (deliveryMethod === 'delivery') {
                if (isOutOfRange) {
                    html = `
                        <div style="font-size: 0.85rem; color: var(--danger); margin-bottom: 2px; font-weight: 600;">
                            ⚠️ Outside Delivery Area
                        </div>
                        <div style="font-size: 0.75rem; color: var(--muted);">
                            Store does not deliver to your location.
                        </div>
                    `;
                } else if (isFreeDelivery) {
                    const freeThreshold = cachedUseTiers ? 
                        (cachedDeliveryRules.find(r => calculateDistance(selectedDeliveryCoordinates?.lat || 0, selectedDeliveryCoordinates?.lng || 0, cachedStoreLatitude, cachedStoreLongitude) <= r.maxDistance)?.minFreeOrder || cachedMinFreeDelivery) : 
                        cachedMinFreeDelivery;
                    html = `
                        <div style="font-size: 0.85rem; color: var(--brand); margin-bottom: 2px; font-weight: 600;">
                            🎉 Free Delivery Applied! ${freeThreshold > 0 ? `(Subtotal over ${currency}${formatPriceWithCommas(freeThreshold)})` : ''}
                        </div>
                        <div style="font-weight: 700;">Total: ${currency}${formatPriceWithCommas(total)}</div>
                    `;
                } else if (shipping > 0) {
                    const activeRule = cachedUseTiers ? 
                        cachedDeliveryRules.find(r => calculateDistance(selectedDeliveryCoordinates?.lat || 0, selectedDeliveryCoordinates?.lng || 0, cachedStoreLatitude, cachedStoreLongitude) <= r.maxDistance) : 
                        null;
                    const freeThreshold = activeRule ? activeRule.minFreeOrder : cachedMinFreeDelivery;
                    html = `
                        <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 2px;">
                            Subtotal: ${currency}${formatPriceWithCommas(subtotal)} + Delivery: ${currency}${formatPriceWithCommas(shipping)}
                        </div>
                        ${freeThreshold > 0 ? `<div style="font-size: 0.75rem; color: var(--muted); margin-bottom: 2px;">Add ${currency}${formatPriceWithCommas(freeThreshold - subtotal)} more for free delivery</div>` : ''}
                        <div style="font-weight: 700;">Total: ${currency}${formatPriceWithCommas(total)}</div>
                    `;
                }
            }
            elements.cartTotalDisplay.innerHTML = html;
        }

        // Enable or disable checkout button
        const checkoutBtn = document.querySelector('[data-ui="checkout-btn"]') || document.querySelector('.checkout-btn');
        if (checkoutBtn) {
            if (deliveryMethod === 'delivery' && isOutOfRange) {
                checkoutBtn.disabled = true;
                checkoutBtn.style.opacity = '0.5';
                checkoutBtn.style.cursor = 'not-allowed';
                checkoutBtn.title = "Store does not deliver to your location";
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.style.opacity = '1';
                checkoutBtn.style.cursor = 'pointer';
                checkoutBtn.title = "Proceed to Checkout";
            }
        }

        // Persist to user-specific localStorage
        const currentActiveChatUid = getCartOwnerId();
        const cartKey = currentActiveChatUid ? `hotmapp_cart_${currentActiveChatUid}` : 'hotmapp_cart_data';
        const savedKey = currentActiveChatUid ? `hotmapp_saved_${currentActiveChatUid}` : 'hotmapp_saved_data';

        localStorage.setItem(cartKey, JSON.stringify(cart));
        localStorage.setItem(savedKey, JSON.stringify(savedItems));

        const user = auth.currentUser;
        if (user && currentActiveChatUid) {
            saveSavedItems(user.uid, currentActiveChatUid, savedItems);
        }
    };

    // Expose UI updater globally for the refresh function
    window._updateCartUI = updateCartUI;

    // Initial UI update to load items from localStorage
    refreshCart();

    // Listen for auth changes to load user's saved items from DB on login
    subscribeToAuthChanges(() => {
        refreshCart();
    });

    elements.shopProductGrid?.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const btn = e.target;
            const card = btn.closest('.product-card');
            const productId = card.dataset.id;
            const name = card.querySelector('.product-name').textContent;
            const description = card.querySelector('.product-desc')?.textContent || '';
            const priceText = card.querySelector('.product-price').textContent;
            const currencySymbol = card.querySelector('.product-currency')?.textContent || '$';
            const priceValue = parsePrice(priceText.replace(currencySymbol, ''));
            const image = card.querySelector('.product-img').src;
            const form = card.querySelector('.product-form')?.textContent || '';
            const productQty = card.querySelector('.product-quantity')?.textContent || '';
            const qtyInput = card.querySelector('.shop-item-qty-input');
            const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

            const existing = cart.find(item => item.id === productId);
            if (existing) { existing.quantity += quantity; }
            else { cart.push({ id: productId, name, description, price: priceValue, currency: currencySymbol, quantity, image, form, productQty }); }

            updateCartUI();

            // Provide visual feedback for successful addition
            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Added ✓';
            btn.classList.add('added-success');

            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                btn.classList.remove('added-success');
            }, 1000);
        } else {
            const card = e.target.closest('.product-card');
            if (card) {
                const isInteractive = e.target.closest('button') || e.target.closest('a') || e.target.closest('input');
                if (isInteractive) return;

                const productId = card.dataset.id;
                const product = currentShopProducts.find(p => p.id === productId);
                if (product) {
                    const isImgClick = e.target.closest('.product-img') || e.target.closest('.image-loader-wrapper');
                    if (isImgClick) {
                        if (typeof window.openProductImageLightbox === 'function') {
                            window.openProductImageLightbox(product);
                        }
                        return;
                    }

                    // Otherwise, show details modal
                    const mappedItem = {
                        id: product.id,
                        name: product.name,
                        description: product.desc,
                        image: product.images?.[0] || 'https://via.placeholder.com/200',
                        price: parsePrice(product.price || 0),
                        currency: product.currency || '$',
                        form: product.form || '',
                        productQty: product.qty || '',
                        avgRating: product.avgRating || 0,
                        reviewCount: product.reviewCount || 0
                    };
                    showProductDetails(mappedItem);
                }
            }
        }
    });

    const performShopSearch = debounce((term) => {
        const cards = elements.shopProductGrid?.querySelectorAll('.product-card');
        let visibleCount = 0;

        cards?.forEach(card => {
            const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
            const desc = card.querySelector('.product-desc')?.textContent.toLowerCase() || '';
            const isVisible = (name.includes(term) || desc.includes(term));
            card.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) visibleCount++;
        });
        if (elements.shopNoResultsMessage) elements.shopNoResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }, 200);

    elements.shopSearchInput?.addEventListener('input', (e) => {
        performShopSearch(e.target.value.toLowerCase());
    });

    elements.cartItemsList?.addEventListener('click', (e) => {
        const target = e.target;
        const removeBtn = target.closest('.remove-cart-item');
        const decreaseBtn = target.closest('.decrease');
        const increaseBtn = target.closest('.increase');
        const saveLaterBtn = target.closest('.save-later-btn');

        // Handle image or name click for details
        const isNameClick = target.classList.contains('cart-item-name');
        const isImgClick = target.tagName === 'IMG';

        if ((isImgClick || isNameClick) && !removeBtn && !decreaseBtn && !increaseBtn && !saveLaterBtn) {
            const productId = target.closest('.cart-item')?.dataset.id;
            const item = cart.find(i => i.id === productId);
            if (item) {
                showProductDetails(item);
                return;
            }
        }

        if (saveLaterBtn) {
            const productId = saveLaterBtn.dataset.id;
            const item = cart.find(i => i.id === productId);
            const itemEl = saveLaterBtn.closest('.cart-item');
            const targetEl = elements.savedLaterSection;

            if (item && itemEl && targetEl) {
                animateFlyingItem(itemEl, targetEl);

                setTimeout(() => {
                    cart = cart.filter(i => i.id !== productId);
                    if (!savedItems.find(i => i.id === productId)) {
                        savedItems.push(item);
                    }
                    updateCartUI();
                    showToast("Item saved for later", "info");
                }, 300);
            }
            return;
        } else if (removeBtn) {
            const productId = removeBtn.dataset.id;
            const itemEl = removeBtn.closest('.cart-item');
            itemEl.classList.add('removing');
            setTimeout(() => {
                cart = cart.filter(item => item.id !== productId);
                updateCartUI();
            }, 300);
            return;
        } else if (decreaseBtn) {
            const productId = decreaseBtn.dataset.id;
            const item = cart.find(i => i.id === productId);
            if (!item) return;

            if (item.quantity > 1) {
                item.quantity--;
            } else {
                const itemEl = decreaseBtn.closest('.cart-item');
                itemEl.classList.add('removing');
                setTimeout(() => {
                    cart = cart.filter(i => i.id !== productId);
                    updateCartUI();
                }, 300);
                return;
            }
        } else if (increaseBtn) {
            const productId = increaseBtn.dataset.id;
            const item = cart.find(i => i.id === productId);
            if (item) item.quantity++;
        } else {
            return;
        }

        updateCartUI();
    });

    elements.savedItemsList?.addEventListener('click', (e) => {
        const target = e.target;
        const moveToCartBtn = target.closest('.move-to-cart-btn');
        const removeSavedBtn = target.closest('.remove-saved-item');

        const isNameClick = target.classList.contains('cart-item-name');
        const isImgClick = target.tagName === 'IMG';

        if ((isImgClick || isNameClick) && !moveToCartBtn && !removeSavedBtn) {
            const productId = target.closest('.cart-item')?.dataset.id;
            const item = savedItems.find(i => i.id === productId);
            if (item) {
                showProductDetails(item);
                return;
            }
        }

        if (moveToCartBtn) {
            const productId = moveToCartBtn.dataset.id;
            const item = savedItems.find(i => i.id === productId);
            if (item) {
                savedItems = savedItems.filter(i => i.id !== productId);
                const existing = cart.find(i => i.id === productId);
                if (existing) {
                    existing.quantity += 1;
                } else {
                    cart.push({ ...item, quantity: 1 });
                }
                updateCartUI();
                showToast("Item moved to cart", "success");
            }
        } else if (removeSavedBtn) {
            const productId = removeSavedBtn.dataset.id;
            const itemEl = removeSavedBtn.closest('.cart-item');
            itemEl.classList.add('removing');
            setTimeout(() => {
                savedItems = savedItems.filter(i => i.id !== productId);
                updateCartUI();
            }, 300);
        }
    });

    elements.closeDetailsModalBtn?.addEventListener('click', () => {
        if (elements.productDetailsModal) elements.productDetailsModal.style.display = 'none';
    });
    elements.productDetailsModal?.addEventListener('click', (e) => {
        if (e.target === elements.productDetailsModal) elements.productDetailsModal.style.display = 'none';
    });

    elements.cartTabCart?.addEventListener('click', () => {
        activeCartTab = 'cart';
        updateCartUI();
    });

    elements.cartTabSaved?.addEventListener('click', () => {
        activeCartTab = 'saved';
        updateCartUI();
    });

    elements.cartToggleBtn?.addEventListener('click', () => {
        if (elements.cartOverlay) {
            isProgrammaticScroll = true;
            elements.cartOverlay.style.display = 'flex';
            elements.shopContainer?.classList.add('cart-open');
            // Scroll the cart content to the top so items are visible immediately
            if (elements.cartContent) {
                elements.cartContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Scroll the main shop container to the top as well
            elements.shopContainer?.scrollTo({ top: 0, behavior: 'smooth' });

            // Allow auto-close on scroll again after programmatic scroll-to-top is finished
            setTimeout(() => { isProgrammaticScroll = false; }, 1000);
        }
    });

    const closeCart = () => {
        if (elements.cartOverlay) elements.cartOverlay.style.display = 'none';
        elements.shopContainer?.classList.remove('cart-open');
        // Reset height so it opens at default next time
        if (elements.cartContent) {
            elements.cartContent.style.height = '';
            elements.cartContent.classList.remove('full-screen');
        }
    };

    elements.closeShopLocationsMapModalBtn?.addEventListener('click', () => {
        if (elements.shopLocationsMapModal) elements.shopLocationsMapModal.style.display = 'none';
        if (elements.cartContent) {
            elements.cartContent.style.height = '';
            elements.cartContent.classList.remove('full-screen');
        }
    });

    elements.shopLocationsMapModal?.addEventListener('click', (e) => {
        if (e.target === elements.shopLocationsMapModal) elements.shopLocationsMapModal.style.display = 'none';
    });

    elements.closeCartBtn?.addEventListener('click', closeCart);

    // Resizer is disabled since cart is now full-screen and stable
    // initCartResizer();

    if (elements.cartOverlay) {
        const cartObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    const isVisible = elements.cartOverlay.style.display === 'flex';
                    if (!isVisible) {
                        elements.shopContainer?.classList.remove('cart-open');
                        if (elements.cartContent) {
                            elements.cartContent.style.height = '';
                            elements.cartContent.classList.remove('full-screen');
                        }
                    }
                }
            });
        });
        cartObserver.observe(elements.cartOverlay, { attributes: true, attributeFilter: ['style'] });
    }

    elements.clearCartBtn?.addEventListener('click', () => {
        if (cart.length === 0) return;
        if (confirm('Are you sure you want to clear your cart?')) {
            const items = elements.cartItemsList?.querySelectorAll('.cart-item');
            if (items && items.length > 0) {
                items.forEach(item => item.classList.add('removing'));
                setTimeout(() => {
                    cart = [];
                    updateCartUI();
                }, 300); // Matches the CSS transition duration
            } else {
                cart = [];
                updateCartUI();
            }
        }
    });

    elements.moveAllToSavedBtn?.addEventListener('click', () => {
        if (cart.length === 0) return;

        if (confirm('Are you sure you want to move all items in your cart to Save for Later?')) {
            const cartEls = elements.cartItemsList?.querySelectorAll('.cart-item');
            const targetEl = elements.savedLaterSection;

            if (cartEls && targetEl) {
                cartEls.forEach((el, index) => {
                    // Stagger the flying animation for a more natural flow
                    setTimeout(() => animateFlyingItem(el, targetEl), index * 100);
                });
            }

            // Delay the state update to allow the animations to commence
            setTimeout(() => {
                cart.forEach(item => {
                    if (!savedItems.find(i => i.id === item.id)) {
                        savedItems.push({ ...item });
                    }
                });
                cart = [];
                updateCartUI();
                showToast("All items moved to Save for later", "info");
            }, 300);
        }
    });

    elements.moveAllToCartBtn?.addEventListener('click', () => {
        if (savedItems.length === 0) return;

        savedItems.forEach(item => {
            const existing = cart.find(i => i.id === item.id);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                cart.push({ ...item });
            }
        });

        savedItems = [];
        updateCartUI();
        showToast("All items moved to cart", "success");
    });

    elements.clearSavedBtn?.addEventListener('click', () => {
        if (savedItems.length === 0) return;
        if (confirm('Are you sure you want to clear all saved items?')) {
            const items = elements.savedItemsList?.querySelectorAll('.cart-item');
            if (items && items.length > 0) {
                items.forEach(item => item.classList.add('removing'));
                setTimeout(() => {
                    savedItems = [];
                    updateCartUI();
                    showToast("Saved items cleared", "info");
                }, 300);
            } else {
                savedItems = [];
                updateCartUI();
                showToast("Saved items cleared", "info");
            }
        }
    });

    elements.checkoutBtn?.addEventListener('click', () => {
        if (cart.length === 0) return;

        let deliveryAddress = '';
        let addressToSave = '';

        if (deliveryMethod === 'delivery') {
            if (addressMode === 'simple') {
                deliveryAddress = elements.deliveryAddressInput?.value.trim();
                addressToSave = deliveryAddress;
            } else {
                const street = elements.addrStreet?.value.trim();
                const apt = elements.addrApartment?.value.trim();
                const city = elements.addrCity?.value.trim();
                const state = elements.addrState?.value.trim();

                if (!street || !city || !state) {
                    showToast("Please fill in all required address fields.", "warning");
                    return;
                }
                deliveryAddress = `${street}${apt ? ', ' + apt : ''}, ${city}, ${state}`;
                addressToSave = JSON.stringify({ street, apt, city, state, mode: 'structured' });
            }

            if (!deliveryAddress) {
                showToast("Please provide a delivery address.", "warning");
                if (addressMode === 'simple') elements.deliveryAddressInput?.focus();
                else elements.addrStreet?.focus();
                return;
            }
            if (deliveryAddress.length > MAX_DELIVERY_ADDRESS_LENGTH) {
                showToast(`Aggregated delivery address exceeds ${MAX_DELIVERY_ADDRESS_LENGTH} characters.`, "warning");
                return;
            }

            const coverageCheck = validateDeliveryCoverage(
                deliveryAddress,
                selectedDeliveryCoordinates,
                cachedDeliveryCoverage,
                { lat: cachedStoreLatitude, lng: cachedStoreLongitude }
            );
            if (!coverageCheck.isCovered) {
                showToast(coverageCheck.reason || "Your delivery address is outside the seller's delivery coverage area.", "error");
                return;
            }
        }

        const btn = elements.checkoutBtn;
        const originalContent = btn.innerHTML;

        // Disable button and show spinner immediately
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Generating...';

        // Use setTimeout to allow the browser to render the spinner before the main thread is blocked
        setTimeout(async () => {
            try {
                // 0. Fetch business profile for payment details and actual address
                const currentActiveChatUid = resolveActiveSellerId({
                    activeChatUid: getActiveChatUid(),
                    activeConversationUid: document.querySelector('.conversation-item.active')?.dataset.uid || null,
                    currentUserId: auth.currentUser?.uid || null,
                    shopSellerId: currentShopSellerId
                });
                if (!currentActiveChatUid) {
                    throw new Error("No active chat target found. Please open a chat with the seller first.");
                }

                const user = auth.currentUser;
                const chatId = currentActiveChatUid.startsWith('group_') ? currentActiveChatUid : [user.uid, currentActiveChatUid].sort().join('_');
                const orderId = generateOrderId();

                const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                const shipping = calculateShippingFee(subtotal);
                const total = subtotal + (shipping === -1 ? 0 : shipping);
                const currency = cart[0]?.currency || '$';

                const rawOrderData = {
                    id: orderId,
                    buyerId: user.uid,
                    sellerId: currentActiveChatUid,
                    businessName: cachedBizProfile?.companyName || cachedBizProfile?.businessName || null,
                    chatId: chatId,
                    timestamp: Date.now(),
                    deliveryMethod: deliveryMethod,
                    deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
                    pickupLocation: deliveryMethod === 'pickup' ? selectedPickupLocation : null,
                    subtotal: subtotal,
                    shipping: shipping,
                    total: total,
                    currency: currency,
                    items: cart.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        form: item.form || '',
                        productQty: item.productQty || '',
                        image: item.image || item.imageUrl || (Array.isArray(item.images) && item.images[0]) || (Array.isArray(item.photos) && item.photos[0]) || item.photo || ''
                    }))
                };

                btn.innerHTML = '<span class="spinner"></span> Sending Order...';

                // Generate PDF client-side
                const { doc, blob: pdfBlob, blobUrl: localUrl, orderNumber } = await generateOrderInvoiceDoc(rawOrderData);
                const fileName = `Invoice_${orderNumber}.pdf`;
                const storagePath = `chat_media/${chatId}/${Date.now()}_${user.uid}.pdf`;

                const orderData = {
                    ...rawOrderData,
                    orderNumber: orderNumber,
                    downloadURL: null,
                    fileName: fileName,
                    fileSize: pdfBlob.size,
                    status: 'pending'
                };

                // 3. Save Order and Message immediately (Zero Latency)
                await saveOrder(orderId, orderData);

                // Cache the order locally with a local Blob URL so the buyer can view it instantly
                const localOrderData = {
                    ...orderData,
                    id: orderId,
                    downloadURL: localUrl
                };
                await cacheItem('orders', localOrderData);

                // Send the invoice as a visible document message so it appears in the chat stream
                const messageData = {
                    senderId: user.uid,
                    chatId: chatId,
                    type: 'document',
                    invoiceId: orderId,
                    url: localUrl,
                    fileName: fileName,
                    fileSize: pdfBlob.size,
                    timestamp: Date.now(),
                    previewText: `📄 Invoice ${orderNumber}`,
                    status: chatId.startsWith('group_') ? 'notified' : 'sent'
                };

                await saveMessage(chatId, messageData);

                // 4. Upload PDF file in the background (Non-blocking)
                uploadFile(storagePath, pdfBlob).then(async (downloadURL) => {
                    await updateOrder(orderId, { downloadURL: downloadURL });
                    // Update local cache with final downloadURL
                    const finalOrderData = {
                        ...orderData,
                        id: orderId,
                        downloadURL: downloadURL
                    };
                    await cacheItem('orders', finalOrderData);
                    console.log(`PDF successfully uploaded in background for order: ${orderId}`);
                }).catch((err) => {
                    console.error(`Failed to upload PDF invoice in background for order ${orderId}:`, err);
                });

                // Save or clear delivery address if requested
                if (deliveryMethod === 'delivery' && currentActiveChatUid) {
                    if (elements.saveAddressCheckbox?.checked) {
                        localStorage.setItem(`hotmapp_address_${currentActiveChatUid}`, addressToSave);
                    } else {
                        localStorage.removeItem(`hotmapp_address_${currentActiveChatUid}`);
                    }
                }

                // Success Animation
                if (typeof showActionSuccessAnimation === 'function') {
                    showActionSuccessAnimation("Order Placed Successfully!", "Your invoice and order details have been sent to the chat.");
                }
                btn.innerHTML = 'Order Placed ✓';
                btn.classList.add('success');

                // Wait for the user to see the success state
                setTimeout(() => {
                    // Reset cart and UI on success
                    cart = [];
                    updateCartUI();

                    if (window.innerWidth <= 768) {
                        // On mobile, dismiss 'shop-view' which will automatically close both the cart overlay and the shop
                        dismissHistoryState('shop-view');
                    } else {
                        // On desktop, close cart and shop mode directly
                        if (elements.cartOverlay) elements.cartOverlay.style.display = 'none';
                        elements.shopContainer?.classList.remove('cart-open');
                        closeShopMode();
                    }

                    if (typeof window.openChatWithUser === 'function' && currentActiveChatUid) {
                        window.openChatWithUser(currentActiveChatUid);
                    }

                    // Reset button state immediately when overlay is closed
                    btn.disabled = false;
                    btn.innerHTML = 'Checkout';
                    btn.classList.remove('success');
                }, 1500);

                // Fallback: Ensure button resets to default "Checkout" state within 10 seconds max
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = 'Checkout';
                    btn.classList.remove('success');
                }, 10000);

            } catch (error) {
                console.error("Invoice generation error:", error);
                showToast(`Error generating invoice: ${error.message || error}`, "error");
                btn.disabled = false;
                btn.innerHTML = originalContent;
            } finally {
                // We handle the restoration inside the success timeout or catch block
            }
        }, 100);
    });

    // Swipe to Delete Logic
    let touchStartX = 0;
    let touchStartY = 0;
    let currentItem = null;
    let isHorizontalSwipe = false;

    const handleSwipe = (e) => {
        const item = e.target.closest('.cart-item');
        if (!item) return;

        if (e.type === 'touchstart') {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            item.style.transition = 'none';
            currentItem = item;
            isHorizontalSwipe = false;
        } else if (e.type === 'touchmove') {
            if (!currentItem) return;
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const diffX = x - touchStartX;
            const diffY = y - touchStartY;

            // Determine if the user is swiping horizontally vs vertically
            if (!isHorizontalSwipe && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                isHorizontalSwipe = true;
            }

            if (isHorizontalSwipe) {
                const moveX = Math.min(0, diffX);
                currentItem.style.transform = `translateX(${moveX}px)`;
            }
        } else if (e.type === 'touchend') {
            if (!currentItem) return;
            const x = e.changedTouches[0].clientX;
            const diff = x - touchStartX;

            currentItem.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';

            if (isHorizontalSwipe && diff < -100) {
                currentItem.style.transform = 'translateX(-100%)';
                const id = currentItem.querySelector('[data-id]')?.dataset.id;
                const isSaved = currentItem.closest('.saved-items-list');
                const targetList = isSaved ? savedItems : cart;
                const itemToBackup = targetList.find(i => i.id === id);

                setTimeout(() => {
                    if (itemToBackup) {
                        lastDeletedData = {
                            item: { ...itemToBackup },
                            list: isSaved ? 'saved' : 'cart'
                        };
                        if (isSaved) savedItems = savedItems.filter(i => i.id !== id);
                        else cart = cart.filter(i => i.id !== id);
                        updateCartUI();
                        showUndoSnackbar(`${itemToBackup.name} removed`);
                    }
                }, 300);
            } else {
                currentItem.style.transform = 'translateX(0)';
            }
            currentItem = null;
        }
    };

    [elements.cartItemsList, elements.savedItemsList].forEach(list => {
        list?.addEventListener('touchstart', handleSwipe, { passive: true });
        list?.addEventListener('touchmove', handleSwipe, { passive: true });
        list?.addEventListener('touchend', handleSwipe);
    });

    // Star rating input handler
    elements.reviewStarRating?.addEventListener('click', handleStarRating);

    // Review form submission handler
    elements.reviewForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ratingVal = elements.reviewRatingValue?.value;
        if (!ratingVal) {
            showToast("Please select a star rating", "warning");
            return;
        }

        const textarea = elements.reviewForm.querySelector('[data-ui="review-text"]');
        const textVal = textarea ? textarea.value.trim() : "";
        if (!textVal) {
            showToast("Please write a review comment", "warning");
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            showToast("You must be logged in to leave a review", "error");
            return;
        }

        const submitBtn = elements.reviewForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
        }

        try {
            const userProfile = await getUserProfile(user.uid);
            const userName = userProfile?.fullname || user.displayName || "Anonymous User";
            const userAvatar = userProfile?.profilePhoto || user.photoURL || "";

            const reviewData = {
                userId: user.uid,
                userName,
                userAvatar,
                rating: parseInt(ratingVal),
                text: textVal,
                timestamp: Date.now()
            };

            await saveReview(currentReviewProductId, reviewData);
            showToast("Review submitted successfully!", "success");

            // Reset form
            elements.reviewForm.reset();
            if (elements.reviewRatingValue) elements.reviewRatingValue.value = "";
            elements.reviewStarRating?.querySelectorAll('i').forEach(s => {
                s.className = 'fa-regular fa-star';
                s.style.color = 'var(--muted)';
            });

        } catch (error) {
            console.error("Failed to submit review:", error);
            showToast("Failed to submit review. Please try again.", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Review";
            }
        }
    });
};