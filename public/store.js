import { elements } from './elements.js';
import { showToast } from './toast.js';
import { saveProduct, subscribeToProducts, deleteProduct, uploadFile, deleteFile, getBusinessProfile, saveBusinessProfile, updateUserProfile, deleteBusinessProfile, getAllUsers, subscribeToAllUsers, sendFriendRequest, getUserProfile, addToChatList, getProductsPage, getProductsByCategory, getProductsBySearch, getProductsByOwner, subscribeToSellerProducts, subscribeToUserProfile } from './database-service.js?v=1.1.6';
import { auth, db } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { subscribeToAuthChanges } from './auth-service.js';
import { getAllCachedProducts, cacheItem, getCachedItem } from './cache-manager.js';
import { getActiveChatUid, moduleFriendsList } from './chat.js';
import { updateShopPickupLocations, openShopLocationsMapModal } from './shop.js';
import { debounce, fetchWithTimeout, calculateDistance, compressImage, bindDebouncedSearch, parsePrice } from './utils.js';
import { resolveActiveSellerId } from './shop-seller-utils.js';

let editingProductId = null;
let cachedProducts = {};
let isSelectMode = false;
const selectedProductIds = new Set();
window.currentLightboxImages = [];
window.currentLightboxIndex = 0;
let productToDelete = null;
let allUsersCache = {}; // Cache for all user profiles
let distanceFilterRadius = 0; // 0 means no distance filter applied
const RECENTLY_VIEWED_KEY = 'hotmapp_recently_viewed';
const MAX_RECENTLY_VIEWED = 6;
let userLocation = null; // Store user coordinates for distance sorting
let pendingShopAccessUid = null;
let pendingShopAccessBtn = null;

let generalMarketCategoryDropdownControl = null;
let marketCategoryMobileDropdownControl = null;

const categoryEmojis = {
    "Agriculture and Farming": "🌾",
    "Animals and Pets": "🐾",
    "Beauty and Personal Care": "💅",
    "Commercial Equipment and Tools": "🛠️",
    "Electronics": "💻",
    "Fashion": "👗",
    "Grocery": "🛒",
    "Home Furniture and Appliances": "🛋️",
    "Pharmacy": "💊",
    "Phone": "📱",
    "Property": "🏠",
    "Repair and Construction": "🔨",
    "Restaurant": "🍔",
    "Service": "💼",
    "Vehicles": "🚗",
    "Other": "✨"
};

const makeCustomDropdownSearchable = (wrapperDataUi, hiddenInputDataUi, triggerDataUi, dropdownDataUi, searchInputDataUi, optionsListDataUi) => {
    const wrapper = document.querySelector(`[data-ui="${wrapperDataUi}"]`);
    if (!wrapper) return null;
    const trigger = wrapper.querySelector(`[data-ui="${triggerDataUi}"]`);
    const dropdown = wrapper.querySelector(`[data-ui="${dropdownDataUi}"]`);
    const searchInput = wrapper.querySelector(`[data-ui="${searchInputDataUi}"]`);
    const hiddenInput = wrapper.querySelector(`[data-ui="${hiddenInputDataUi}"]`);
    const optionsList = wrapper.querySelector(`[data-ui="${optionsListDataUi}"]`);

    if (!trigger || !dropdown || !searchInput || !hiddenInput || !optionsList) return null;

    let availableOptions = ['all'];

    const renderOptions = (filter = '') => {
        optionsList.innerHTML = '';
        const filtered = availableOptions.filter(opt => 
            opt === 'all' || opt.toLowerCase().includes(filter.toLowerCase())
        );

        filtered.forEach(opt => {
            const isAll = opt === 'all';
            const displayName = isAll ? 'All Categories' : opt;
            const emoji = isAll ? '🔍' : (categoryEmojis[opt] ? categoryEmojis[opt] + ' ' : '🏷️ ');
            
            const div = document.createElement('div');
            div.className = `option-item ${hiddenInput.value === opt ? 'selected' : ''}`;
            div.innerHTML = `<span>${emoji}${displayName}</span>`;
            div.onclick = (e) => {
                e.stopPropagation();
                hiddenInput.value = opt;
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                dropdown.classList.remove('active');
            };
            optionsList.appendChild(div);
        });

        if (filtered.length === 0) {
            optionsList.innerHTML = `<div style="padding:15px; color:var(--muted); font-size:0.85rem; text-align:center;">No results for "${filter}"</div>`;
        }
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        const wasActive = dropdown.classList.contains('active');
        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('active'));
        if (!wasActive) {
            dropdown.classList.add('active');
            searchInput.value = '';
            renderOptions();
            setTimeout(() => searchInput.focus(), 50);
        }
    };

    searchInput.onclick = (e) => e.stopPropagation();
    searchInput.oninput = (e) => {
        renderOptions(e.target.value);
    };

    // Override value property on this specific element instance
    const originalValueProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(hiddenInput, 'value', {
        get() {
            return originalValueProp.get.call(this);
        },
        set(val) {
            originalValueProp.set.call(this, val);
            const isAll = val === 'all';
            const displayName = isAll ? 'All Categories' : val;
            const emoji = isAll ? '🔍' : (categoryEmojis[val] ? categoryEmojis[val] + ' ' : '🏷️ ');
            const span = trigger.querySelector('span');
            if (span) span.textContent = `${emoji}${displayName}`;
        }
    });

    return {
        updateOptions(newOptions) {
            availableOptions = ['all', ...Array.from(newOptions).sort()];
            renderOptions();
            // Update trigger UI text by running setter
            hiddenInput.value = hiddenInput.value || 'all';
        }
    };
};

/**
 * Opens the shop access request modal when a user is restricted from viewing a shop.
 * @param {string} ownerId - The UID of the shop owner.
 * @param {object} ownerProfile - The profile object of the shop owner.
 * @param {string} blockReason - The reason why access is blocked.
 * @param {HTMLElement|null} [pendingBtn=null] - Optional: The button element that triggered the modal, to update its state.
 */
export const openShopAccessRequestModal = async (ownerId, ownerProfile, blockReason, pendingBtn = null, showRequestBtn = true) => {
    const user = auth.currentUser;
    if (!user) return;

    pendingShopAccessUid = ownerId;
    pendingShopAccessBtn = pendingBtn;

    if (elements.shopAccessText) elements.shopAccessText.textContent = blockReason;
    if (elements.shopAccessAvatar) {
        const name = ownerProfile.fullname || 'U';
        elements.shopAccessAvatar.innerHTML = ownerProfile.profilePhoto ? `<img src="${ownerProfile.profilePhoto}" class="avatar-img">` : name.charAt(0).toUpperCase();
    }
    const sentReqSnap = await get(ref(db, `users/${user.uid}/sentRequests/${ownerId}`));
    const hasSent = sentReqSnap.exists();
    if (elements.confirmShopAccessBtn) {
        if (showRequestBtn) {
            elements.confirmShopAccessBtn.style.display = 'block';
            elements.confirmShopAccessBtn.textContent = hasSent ? 'Request Sent' : 'Send Request';
            elements.confirmShopAccessBtn.disabled = hasSent;
            elements.confirmShopAccessBtn.style.opacity = hasSent ? '0.6' : '1';
        } else {
            elements.confirmShopAccessBtn.style.display = 'none';
        }
    }
    if (elements.shopAccessModal) elements.shopAccessModal.style.display = 'flex';
};

export const getBuyerLocation = () => {
    // 1. First, check if the logged-in buyer has their own shop pickup location configured
    const buyerId = auth.currentUser?.uid;
    if (buyerId) {
        const buyerProfile = allUsersCache[buyerId]?.businessProfile;
        const locations = buyerProfile?.pickupLocations;
        if (Array.isArray(locations) && locations.length > 0) {
            const loc = locations[0];
            if (loc.latitude && loc.longitude) {
                return { lat: loc.latitude, lng: loc.longitude };
            }
        }
    }

    // 2. Fall back to GPS user location if available
    if (userLocation) return userLocation;

    return null;
};

export const getNearestDistance = (ownerId) => {
    const refLoc = getBuyerLocation();
    if (!refLoc) return Infinity;
    const profile = allUsersCache[ownerId]?.businessProfile;
    const locations = profile?.pickupLocations;
    if (!profile || !Array.isArray(locations) || locations.length === 0) return Infinity;

    return locations.reduce((min, loc) => {
        if (!loc.latitude || !loc.longitude) return min;
        const dist = calculateDistance(refLoc.lat, refLoc.lng, loc.latitude, loc.longitude);
        return dist < min ? dist : min;
    }, Infinity);
};

/**
 * Finds the nearest pickup location object for a specific seller.
 * Fallbacks to the first registered location if GPS or shop location is unavailable.
 */
const getNearestLocation = (ownerId) => {
    const profile = allUsersCache[ownerId]?.businessProfile;
    const locations = profile?.pickupLocations || [];
    if (locations.length === 0) return null;
    const refLoc = getBuyerLocation();
    if (!refLoc) return locations[0];

    let nearest = null;
    let minDist = Infinity;
    locations.forEach(loc => {
        if (!loc.latitude || !loc.longitude) return;
        const dist = calculateDistance(refLoc.lat, refLoc.lng, loc.latitude, loc.longitude);
        if (dist < minDist) { minDist = dist; nearest = loc; }
    });
    return nearest || locations[0];
};

/**
 * Adds a product to the user's recently viewed list in localStorage.
 * @param {string} productId - The ID of the product to add.
 */
const addProductToRecentlyViewed = async (productId) => {
    if (!productId) return;
    try {
        let recentlyViewed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
        // Remove the item if it already exists to move it to the front
        recentlyViewed = recentlyViewed.filter(id => id !== productId);
        // Add the new item to the beginning of the list
        recentlyViewed.unshift(productId);
        // Trim the list to the maximum allowed size
        if (recentlyViewed.length > MAX_RECENTLY_VIEWED) {
            recentlyViewed = recentlyViewed.slice(0, MAX_RECENTLY_VIEWED);
        }
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
        // Re-render the section to reflect the change
        await renderRecentlyViewedProducts();
    } catch (error) {
        console.error("Failed to update recently viewed products:", error);
    }
};

window.trackRecentlyViewed = addProductToRecentlyViewed;

/**
 * Creates the HTML for a single product card.
 * @param {object} product - The product data object.
 * @param {string} context - The context ('general-market', 'shop', 'admin').
 * @returns {string} The HTML string for the product card.
 */
const createProductCard = (product, context) => {
    const mainImg = product.images?.[0] || 'https://via.placeholder.com/200';
    const priceHtml = `<span class="product-currency">${product.currency || '$'}</span>${parsePrice(product.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const seller = allUsersCache[product.ownerId]?.fullname || 'Unknown Seller';

    let distanceHtml = '';
    const refLoc = getBuyerLocation();
    if (refLoc) {
        const dist = getNearestDistance(product.ownerId);
        if (dist !== Infinity) {
            distanceHtml = `<span style="font-size: 0.72rem; color: var(--brand); font-weight: 800; margin-left: 6px;">(${dist.toFixed(1)}km away)</span>`;
        }
    }

    // The card is simplified for the recently viewed section, similar to the general market view
    return `
        <div class="product-card" data-id="${product.id}" data-owner="${product.ownerId}" data-category="${product.category || ''}">
            <div class="image-loader-wrapper">
                <div class="spinner"></div>
                <img src="${mainImg}" alt="${product.name}" class="product-img" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';">
            </div>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-desc">${product.desc}</p>
            ${product.desc && product.desc.length > 60 ? `<span class="view-details-link" style="color: var(--brand, #0066cc); font-size: 0.78rem; cursor: pointer; display: inline-block; margin-bottom: 8px; font-weight: 500;">Read more</span>` : ''}
            <div class="product-meta">
                <div class="product-price">${priceHtml}</div>
            </div>
            <strong style="font-size: 0.85rem; color: var(--muted); margin-top: 10px;">Seller: ${seller}${distanceHtml}</strong>
            <button class="add-to-cart-btn" data-product-owner="${product.ownerId}" style="background: var(--brand); border-color: var(--brand-dark); margin-top: 10px;">View Shop</button>
        </div>`;
};

/**
 * Renders the "Recently Viewed" products section based on localStorage.
 */
const renderRecentlyViewedProducts = async () => {
    const container = elements.recentlyViewedContainer;
    const grid = elements.recentlyViewedGrid;
    if (!container || !grid) return;

    try {
        const recentlyViewedIds = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
        if (recentlyViewedIds.length === 0) {
            container.style.display = 'none';
            return;
        }

        grid.innerHTML = '';
        let renderedCount = 0;
        for (const productId of recentlyViewedIds) {
            let product = cachedProducts[productId];
            if (!product) {
                try {
                    const snap = await get(ref(db, `products/${productId}`));
                    if (snap.exists()) {
                        product = snap.val();
                        cachedProducts[productId] = product;
                    }
                } catch (dbErr) {
                    console.error(`Failed to fetch product details for ${productId} from DB:`, dbErr);
                }
            }

            if (product) {
                const cardHtml = createProductCard(product, 'general-market');
                grid.insertAdjacentHTML('beforeend', cardHtml);
                renderedCount++;
            }
        }

        container.style.display = renderedCount > 0 ? 'block' : 'none';

    } catch (error) {
        console.error("Failed to render recently viewed products:", error);
        container.style.display = 'none';
    }
};


const MAX_PRODUCT_IMG_SIZE = 5 * 1024 * 1024; // 5MB limit per image
const HIGH_VALUE_THRESHOLD = 100; // Price threshold for confirmation for product deletion 
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const FALLBACK_STATES = {
    US: ["California", "New York", "Texas", "Florida", "Illinois"],
    AE: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"],
    GB: ["England", "Scotland", "Wales", "Northern Ireland"],
    CA: ["Ontario", "Quebec", "British Columbia", "Alberta"],
    IN: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana"],
    NG: ["Lagos", "Abuja", "Kano", "Oyo", "Rivers"],
    DEFAULT: ["State A", "State B", "State C"]
};

const FALLBACK_CITIES = {
    "California": ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento"],
    "New York": ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse"],
    "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth"],
    "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville", "Tallahassee"],
    "Illinois": ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville"],
    "Abu Dhabi": ["Abu Dhabi City", "Al Ain", "Ruwais"],
    "Dubai": ["Dubai City", "Hatta"],
    "Sharjah": ["Sharjah City", "Khor Fakkan", "Kalba"],
    "Ajman": ["Ajman City"],
    "Umm Al Quwain": ["Umm Al Quwain City"],
    "Ras Al Khaimah": ["Ras Al Khaimah City"],
    "Fujairah": ["Fujairah City"],
    "England": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool"],
    "Scotland": ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"],
    "Wales": ["Cardiff", "Swansea", "Newport"],
    "Northern Ireland": ["Belfast", "Derry", "Lisburn"],
    "Ontario": ["Toronto", "Ottawa", "Mississauga", "Hamilton"],
    "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau"],
    "British Columbia": ["Vancouver", "Victoria", "Surrey", "Burnaby"],
    "Alberta": ["Calgary", "Edmonton", "Red Deer", "Lethbridge"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane"],
    "Delhi": ["New Delhi", "Dwarka", "Rohini"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Trichy"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad"],
    "Lagos": ["Lagos City", "Ikeja", "Lekki", "Surulere"],
    "Abuja": ["Garki", "Wuse", "Maitama", "Asokoro"],
    DEFAULT: ["City 1", "City 2", "City 3"]
};

const MAX_PICKUP_LOCATIONS = 5; // Maximum number of pickup locations a business can register

/** Populates all country selects in the app by fetching from RestCountries API */
let fetchedCountries = null;
let countryFetchPromise = null;
let userDetectedCountry = null;
const COUNTRIES_CACHE_KEY = 'hotmapp_countries_cache';

/** Detects user's country code based on IP address */
const detectUserCountry = async () => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) return null;
        const data = await response.json();
        return data.country_code; // Returns 2-letter code like "US", "NG"
    } catch (error) {
        console.warn('Automatic country detection failed:', error);
        return null;
    }
};

const populateCountries = async () => {
    const wrappers = document.querySelectorAll('[data-ui="country-picker-wrapper"]');
    if (wrappers.length === 0) return;

    const fallbackCountries = [
        { name: 'Afghanistan', code: 'AF' },
        { name: 'Åland Islands', code: 'AX' },
        { name: 'Albania', code: 'AL' },
        { name: 'Algeria', code: 'DZ' },
        { name: 'American Samoa', code: 'AS' },
        { name: 'Andorra', code: 'AD' },
        { name: 'Angola', code: 'AO' },
        { name: 'Anguilla', code: 'AI' },
        { name: 'Antarctica', code: 'AQ' },
        { name: 'Antigua and Barbuda', code: 'AG' },
        { name: 'Argentina', code: 'AR' },
        { name: 'Armenia', code: 'AM' },
        { name: 'Aruba', code: 'AW' },
        { name: 'Australia', code: 'AU' },
        { name: 'Austria', code: 'AT' },
        { name: 'Azerbaijan', code: 'AZ' },
        { name: 'Bahamas', code: 'BS' },
        { name: 'Bahrain', code: 'BH' },
        { name: 'Bangladesh', code: 'BD' },
        { name: 'Barbados', code: 'BB' },
        { name: 'Belarus', code: 'BY' },
        { name: 'Belgium', code: 'BE' },
        { name: 'Belize', code: 'BZ' },
        { name: 'Benin', code: 'BJ' },
        { name: 'Bermuda', code: 'BM' },
        { name: 'Bhutan', code: 'BT' },
        { name: 'Bolivia', code: 'BO' },
        { name: 'Bosnia and Herzegovina', code: 'BA' },
        { name: 'Botswana', code: 'BW' },
        { name: 'Bouvet Island', code: 'BV' },
        { name: 'Brazil', code: 'BR' },
        { name: 'British Indian Ocean Territory', code: 'IO' },
        { name: 'Brunei Darussalam', code: 'BN' },
        { name: 'Bulgaria', code: 'BG' },
        { name: 'Burkina Faso', code: 'BF' },
        { name: 'Burundi', code: 'BI' },
        { name: 'Cambodia', code: 'KH' },
        { name: 'Cameroon', code: 'CM' },
        { name: 'Canada', code: 'CA' },
        { name: 'Cape Verde', code: 'CV' },
        { name: 'Cayman Islands', code: 'KY' },
        { name: 'Central African Republic', code: 'CF' },
        { name: 'Chad', code: 'TD' },
        { name: 'Chile', code: 'CL' },
        { name: 'China', code: 'CN' },
        { name: 'Christmas Island', code: 'CX' },
        { name: 'Cocos (Keeling) Islands', code: 'CC' },
        { name: 'Colombia', code: 'CO' },
        { name: 'Comoros', code: 'KM' },
        { name: 'Congo', code: 'CG' },
        { name: 'Congo, The Democratic Republic of the', code: 'CD' },
        { name: 'Cook Islands', code: 'CK' },
        { name: 'Costa Rica', code: 'CR' },
        { name: 'Cote D\'Ivoire', code: 'CI' },
        { name: 'Croatia', code: 'HR' },
        { name: 'Cuba', code: 'CU' },
        { name: 'Cyprus', code: 'CY' },
        { name: 'Czech Republic', code: 'CZ' },
        { name: 'Denmark', code: 'DK' },
        { name: 'Djibouti', code: 'DJ' },
        { name: 'Dominica', code: 'DM' },
        { name: 'Dominican Republic', code: 'DO' },
        { name: 'Ecuador', code: 'EC' },
        { name: 'Egypt', code: 'EG' },
        { name: 'El Salvador', code: 'SV' },
        { name: 'Equatorial Guinea', code: 'GQ' },
        { name: 'Eritrea', code: 'ER' },
        { name: 'Estonia', code: 'EE' },
        { name: 'Ethiopia', code: 'ET' },
        { name: 'Falkland Islands (Malvinas)', code: 'FK' },
        { name: 'Faroe Islands', code: 'FO' },
        { name: 'Fiji', code: 'FJ' },
        { name: 'Finland', code: 'FI' },
        { name: 'France', code: 'FR' },
        { name: 'French Guiana', code: 'GF' },
        { name: 'French Polynesia', code: 'PF' },
        { name: 'French Southern Territories', code: 'TF' },
        { name: 'Gabon', code: 'GA' },
        { name: 'Gambia', code: 'GM' },
        { name: 'Georgia', code: 'GE' },
        { name: 'Germany', code: 'DE' },
        { name: 'Ghana', code: 'GH' },
        { name: 'Gibraltar', code: 'GI' },
        { name: 'Greece', code: 'GR' },
        { name: 'Greenland', code: 'GL' },
        { name: 'Grenada', code: 'GD' },
        { name: 'Guadeloupe', code: 'GP' },
        { name: 'Guam', code: 'GU' },
        { name: 'Guatemala', code: 'GT' },
        { name: 'Guernsey', code: 'GG' },
        { name: 'Guinea', code: 'GN' },
        { name: 'Guinea-Bissau', code: 'GW' },
        { name: 'Guyana', code: 'GY' },
        { name: 'Haiti', code: 'HT' },
        { name: 'Heard Island and Mcdonald Islands', code: 'HM' },
        { name: 'Holy See (Vatican City State)', code: 'VA' },
        { name: 'Honduras', code: 'HN' },
        { name: 'Hong Kong', code: 'HK' },
        { name: 'Hungary', code: 'HU' },
        { name: 'Iceland', code: 'IS' },
        { name: 'India', code: 'IN' },
        { name: 'Indonesia', code: 'ID' },
        { name: 'Iran, Islamic Republic Of', code: 'IR' },
        { name: 'Iraq', code: 'IQ' },
        { name: 'Ireland', code: 'IE' },
        { name: 'Isle of Man', code: 'IM' },
        { name: 'Israel', code: 'IL' },
        { name: 'Italy', code: 'IT' },
        { name: 'Jamaica', code: 'JM' },
        { name: 'Japan', code: 'JP' },
        { name: 'Jersey', code: 'JE' },
        { name: 'Jordan', code: 'JO' },
        { name: 'Kazakhstan', code: 'KZ' },
        { name: 'Kenya', code: 'KE' },
        { name: 'Kiribati', code: 'KI' },
        { name: 'Korea, Democratic People\'s Republic of', code: 'KP' },
        { name: 'Korea, Republic of', code: 'KR' },
        { name: 'Kuwait', code: 'KW' },
        { name: 'Kyrgyzstan', code: 'KG' },
        { name: 'Lao People\'s Democratic Republic', code: 'LA' },
        { name: 'Latvia', code: 'LV' },
        { name: 'Lebanon', code: 'LB' },
        { name: 'Lesotho', code: 'LS' },
        { name: 'Liberia', code: 'LR' },
        { name: 'Libyan Arab Jamahiriya', code: 'LY' },
        { name: 'Liechtenstein', code: 'LI' },
        { name: 'Lithuania', code: 'LT' },
        { name: 'Luxembourg', code: 'LU' },
        { name: 'Macao', code: 'MO' },
        { name: 'Macedonia, The Former Yugoslav Republic of', code: 'MK' },
        { name: 'Madagascar', code: 'MG' },
        { name: 'Malawi', code: 'MW' },
        { name: 'Malaysia', code: 'MY' },
        { name: 'Maldives', code: 'MV' },
        { name: 'Mali', code: 'ML' },
        { name: 'Malta', code: 'MT' },
        { name: 'Marshall Islands', code: 'MH' },
        { name: 'Martinique', code: 'MQ' },
        { name: 'Mauritania', code: 'MR' },
        { name: 'Mauritius', code: 'MU' },
        { name: 'Mayotte', code: 'YT' },
        { name: 'Mexico', code: 'MX' },
        { name: 'Micronesia, Federated States of', code: 'FM' },
        { name: 'Moldova, Republic of', code: 'MD' },
        { name: 'Monaco', code: 'MC' },
        { name: 'Mongolia', code: 'MN' },
        { name: 'Montserrat', code: 'MS' },
        { name: 'Morocco', code: 'MA' },
        { name: 'Mozambique', code: 'MZ' },
        { name: 'Myanmar', code: 'MM' },
        { name: 'Namibia', code: 'NA' },
        { name: 'Nauru', code: 'NR' },
        { name: 'Nepal', code: 'NP' },
        { name: 'Netherlands', code: 'NL' },
        { name: 'Netherlands Antilles', code: 'AN' },
        { name: 'New Caledonia', code: 'NC' },
        { name: 'New Zealand', code: 'NZ' },
        { name: 'Nicaragua', code: 'NI' },
        { name: 'Niger', code: 'NE' },
        { name: 'Nigeria', code: 'NG' },
        { name: 'Niue', code: 'NU' },
        { name: 'Norfolk Island', code: 'NF' },
        { name: 'Northern Mariana Islands', code: 'MP' },
        { name: 'Norway', code: 'NO' },
        { name: 'Oman', code: 'OM' },
        { name: 'Pakistan', code: 'PK' },
        { name: 'Palau', code: 'PW' },
        { name: 'Palestinian Territory, Occupied', code: 'PS' },
        { name: 'Panama', code: 'PA' },
        { name: 'Papua New Guinea', code: 'PG' },
        { name: 'Paraguay', code: 'PY' },
        { name: 'Peru', code: 'PE' },
        { name: 'Philippines', code: 'PH' },
        { name: 'Pitcairn', code: 'PN' },
        { name: 'Poland', code: 'PL' },
        { name: 'Portugal', code: 'PT' },
        { name: 'Puerto Rico', code: 'PR' },
        { name: 'Qatar', code: 'QA' },
        { name: 'Reunion', code: 'RE' },
        { name: 'Romania', code: 'RO' },
        { name: 'Russian Federation', code: 'RU' },
        { name: 'Rwanda', code: 'RW' },
        { name: 'Saint Helena', code: 'SH' },
        { name: 'Saint Kitts and Nevis', code: 'KN' },
        { name: 'Saint Lucia', code: 'LC' },
        { name: 'Saint Pierre and Miquelon', code: 'PM' },
        { name: 'Saint Vincent and the Grenadines', code: 'VC' },
        { name: 'Samoa', code: 'WS' },
        { name: 'San Marino', code: 'SM' },
        { name: 'Sao Tome and Principe', code: 'ST' },
        { name: 'Saudi Arabia', code: 'SA' },
        { name: 'Senegal', code: 'SN' },
        { name: 'Serbia and Montenegro', code: 'CS' },
        { name: 'Seychelles', code: 'SC' },
        { name: 'Sierra Leone', code: 'SL' },
        { name: 'Singapore', code: 'SG' },
        { name: 'Slovakia', code: 'SK' },
        { name: 'Slovenia', code: 'SI' },
        { name: 'Solomon Islands', code: 'SB' },
        { name: 'Somalia', code: 'SO' },
        { name: 'South Africa', code: 'ZA' },
        { name: 'South Georgia and the South Sandwich Islands', code: 'GS' },
        { name: 'Spain', code: 'ES' },
        { name: 'Sri Lanka', code: 'LK' },
        { name: 'Sudan', code: 'SD' },
        { name: 'Suriname', code: 'SR' },
        { name: 'Svalbard and Jan Mayen', code: 'SJ' },
        { name: 'Swaziland', code: 'SZ' },
        { name: 'Sweden', code: 'SE' },
        { name: 'Switzerland', code: 'CH' },
        { name: 'Syrian Arab Republic', code: 'SY' },
        { name: 'Taiwan, Province of China', code: 'TW' },
        { name: 'Tajikistan', code: 'TJ' },
        { name: 'Tanzania, United Republic of', code: 'TZ' },
        { name: 'Thailand', code: 'TH' },
        { name: 'Timor-Leste', code: 'TL' },
        { name: 'Togo', code: 'TG' },
        { name: 'Tokelau', code: 'TK' },
        { name: 'Tonga', code: 'TO' },
        { name: 'Trinidad and Tobago', code: 'TT' },
        { name: 'Tunisia', code: 'TN' },
        { name: 'Turkey', code: 'TR' },
        { name: 'Turkmenistan', code: 'TM' },
        { name: 'Turks and Caicos Islands', code: 'TC' },
        { name: 'Tuvalu', code: 'TV' },
        { name: 'Uganda', code: 'UG' },
        { name: 'Ukraine', code: 'UA' },
        { name: 'United Arab Emirates', code: 'AE' },
        { name: 'United Kingdom', code: 'GB' },
        { name: 'United States', code: 'US' },
        { name: 'United States Minor Outlying Islands', code: 'UM' },
        { name: 'Uruguay', code: 'UY' },
        { name: 'Uzbekistan', code: 'UZ' },
        { name: 'Vanuatu', code: 'VU' },
        { name: 'Venezuela', code: 'VE' },
        { name: 'Vietnam', code: 'VN' },
        { name: 'Virgin Islands, British', code: 'VG' },
        { name: 'Virgin Islands, U.S.', code: 'VI' },
        { name: 'Wallis and Futuna', code: 'WF' },
        { name: 'Western Sahara', code: 'EH' },
        { name: 'Yemen', code: 'YE' },
        { name: 'Zambia', code: 'ZM' },
        { name: 'Zimbabwe', code: 'ZW' }
    ].sort((a, b) => a.name.localeCompare(b.name));

    // --- Caching Logic ---
    try {
        const cached = JSON.parse(localStorage.getItem(COUNTRIES_CACHE_KEY));
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
            fetchedCountries = cached.data;
            console.log("Using cached country list.");
        }
    } catch (e) {
        console.error("Failed to read country cache:", e);
    }

    const setupCountryPicker = (wrapper, countriesToRender, showRetryButton) => {
        const trigger = wrapper.querySelector('[data-ui="country-trigger"]');
        const dropdown = wrapper.querySelector('[data-ui="country-dropdown"]');
        const list = wrapper.querySelector('[data-ui="country-options-list"]');
        const searchInput = wrapper.querySelector('[data-ui="country-search-input"]');
        const hiddenInput = wrapper.querySelector('[data-ui="business-country"]');
        const selectedText = wrapper.querySelector('[data-ui="country-selected-text"]');

        // Re-enable the trigger button in case it was disabled during loading
        if (trigger) trigger.disabled = false;

        if (!trigger || !dropdown || !list || !hiddenInput || !selectedText) return;

        const renderOptions = (filter = '') => {
            list.innerHTML = '';
            const filtered = countriesToRender.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

            if (filtered.length === 0) {
                list.innerHTML = `<div style="padding:15px; color:var(--muted); font-size:0.85rem; text-align:center;">No results for "${filter}"</div>`;
            } else {
                filtered.forEach(country => {
                    const div = document.createElement('div');
                    div.className = `option-item ${hiddenInput.value === country.code ? 'selected' : ''}`;
                    div.textContent = country.name;
                    div.onclick = (e) => {
                        e.stopPropagation();
                        hiddenInput.value = country.code;
                        selectedText.textContent = country.name;
                        dropdown.classList.remove('active');
                        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                    };
                    list.appendChild(div);
                });
            }

            if (showRetryButton) {
                const retryWrapper = document.createElement('div');
                retryWrapper.style.padding = '10px 15px';
                retryWrapper.style.borderTop = '1px solid var(--border)';
                retryWrapper.innerHTML = `<button type="button" class="retry-countries-btn" style="width:100%; background:var(--brand); color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Retry Full List</button>`;
                retryWrapper.querySelector('.retry-countries-btn').onclick = (e) => {
                    e.stopPropagation();
                    countryFetchPromise = null;
                    clearLocationCacheAndRefresh(false); // This function already calls populateCountries
                };
                list.appendChild(retryWrapper);
            }
        };

        renderOptions();

        if (!hiddenInput.value && userDetectedCountry) {
            const country = countriesToRender.find(c => c.code === userDetectedCountry);
            if (country) {
                hiddenInput.value = country.code;
                selectedText.textContent = country.name;
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        trigger.onclick = (e) => {
            e.stopPropagation();
            const wasActive = dropdown.classList.contains('active');
            document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('active'));
            if (!wasActive) {
                dropdown.classList.add('active');
                if (searchInput) {
                    searchInput.value = '';
                    renderOptions();
                    searchInput.focus();
                }
            }
        };

        if (searchInput) {
            searchInput.onclick = (e) => e.stopPropagation();
            bindDebouncedSearch(searchInput, renderOptions, 300);
        }

        // Add event listener for the search input
        if (searchInput) {
            searchInput.addEventListener('input', () => renderOptions(searchInput.value));
        }
    };



    /**
     * Opens a read-only modal displaying the full business profile details.
     */
    const openBusinessProfileModal = () => {
        if (!currentBusinessProfile) {
            showToast("No business profile data available.", "error");
            return;
        }

        const modal = elements.businessProfileModal;
        const content = elements.businessProfileContent;
        if (!modal || !content) return;

        const data = currentBusinessProfile;
        const countryName = fetchedCountries?.find(c => c.code === data.businessCountry)?.name || data.businessCountry;

        let html = `
            <div class="business-profile-view">
                <div class="info-group">
                    <label>Company Name</label>
                    <p>${data.companyName}</p>
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
                    <p style="text-transform: capitalize;">${data.serviceType}</p>
                </div>
                <div class="info-group">
                    <label>Pickup Locations</label>
                    <div class="locations-summary">
                        ${data.pickupLocations?.length ? data.pickupLocations.map(loc => `
                            <div class="loc-summary-item">
                                <strong>${loc.name}</strong>
                                <span>${loc.address}</span>
                            </div>
                        `).join('') : '<p class="muted">No pickup locations set.</p>'}
                    </div>
                </div>
                <div class="info-group">
                    <label>Delivery Coverage</label>
                    ${data.deliveryCoverage?.countries?.length ? `<p><strong>Countries:</strong> ${data.deliveryCoverage.countries.join(', ')}</p>` : ''}
                    ${data.deliveryCoverage?.states?.length ? `<p><strong>States:</strong> ${data.deliveryCoverage.states.join(', ')}</p>` : ''}
                    ${data.deliveryCoverage?.cities?.length ? `<p><strong>Cities:</strong> ${data.deliveryCoverage.cities.join(', ')}</p>` : ''}
                    ${data.deliveryFee ? `<p>Base Fee: ${data.deliveryFee.toFixed(2)}</p>` : ''}
                    ${data.minFreeDelivery ? `<p>Free Delivery threshold: ${data.minFreeDelivery.toFixed(2)}</p>` : ''}
                </div>
            </div>
        `;

        content.innerHTML = html;
        modal.style.display = 'flex';
    };



    if (!fetchedCountries && !countryFetchPromise) {
        wrappers.forEach(wrapper => {
            const trigger = wrapper.querySelector('[data-ui="country-trigger"]');
            const selectedText = wrapper.querySelector('[data-ui="country-selected-text"]');
            if (trigger && selectedText) {
                trigger.disabled = true;
                selectedText.innerHTML = '<span class="spinner" style="border-top-color:var(--brand); width:14px; height:14px; margin-right:8px;"></span>Loading countries...';
            }
        });

        countryFetchPromise = (async () => {
            const response = await fetchWithTimeout('https://restcountries.com/v3.1/all?fields=name,cca2', { timeout: 7000 });
            if (!response.ok) throw new Error('Fetch failed');
            const data = await response.json();
            fetchedCountries = data.map(c => ({ code: c.cca2, name: c.name.common })).sort((a, b) => a.name.localeCompare(b.name));
            // Save to cache
            try {
                localStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ data: fetchedCountries, timestamp: Date.now() }));
            } catch (e) { console.error("Failed to save country cache:", e); }
            return fetchedCountries;
        })();
    }

    try {
        await countryFetchPromise;
        if (!userDetectedCountry) userDetectedCountry = await detectUserCountry();
        wrappers.forEach(wrapper => setupCountryPicker(wrapper, fetchedCountries, false));
    } catch (error) {
        console.error('Populate countries error:', error);
        countryFetchPromise = null;
        if (!userDetectedCountry) userDetectedCountry = await detectUserCountry();
        wrappers.forEach(wrapper => setupCountryPicker(wrapper, fallbackCountries, true));
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('active'));
    });
};

let pickupLocations = [];
let currentPickingLocationType = ''; // 'pickup'

// Business Registration State
let isBusinessRegistered = false;
let currentBusinessProfile = null;
let businessLocationMap = null;
let currentWizardStep = 1; // Tracks the current step in the business registration wizard
let isEditingBusinessProfile = false; // New flag to track if we are editing an existing profile
let businessLocationMarker = null;
let currentEditingLocationIndex = -1; // -1 for new, >=0 for editing existing
let locationIndexToDelete = -1; // Tracks which location index is pending removal
let pendingBusinessRegistrationData = null; // Stores data while confirmation modal is open
let pendingLogoBlob = null; // Stores cropped business logo blob before upload

let isLoadingProducts = true; // New state variable to track loading

/**
 * Renders skeleton cards to indicate loading state
 */
const renderSkeleton = () => {
    const grid = elements.productGrid;
    const shopGrid = elements.shopProductGrid;
    if (!grid || !shopGrid) return;

    grid.innerHTML = '';
    shopGrid.innerHTML = '';

    const skeletonCardHtml = `
        <div class="product-skeleton-card">
            <div class="skeleton-image"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line price"></div>
        </div>`;

    for (let i = 0; i < 6; i++) { // Render 6 skeleton cards
        grid.insertAdjacentHTML('beforeend', skeletonCardHtml);
        shopGrid.insertAdjacentHTML('beforeend', skeletonCardHtml);
    }
};

/**
 * Converts a DataURL (Base64) to a Blob for Firebase Storage upload
 */
const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
};

/**
 * Updates the grid filters based on search input
 */
const updateFilters = () => {
    const searchTerm = elements.storeSearchInput?.value.toLowerCase() || '';
    const categoryFilter = elements.storeCategoryFilter?.value || 'all';

    elements.productCards.forEach(card => {
        const product = cachedProducts[card.dataset.id];
        const productName = card.querySelector('.product-name').textContent.toLowerCase();
        const productDesc = card.querySelector('.product-desc').textContent.toLowerCase();
        const productCategory = product?.category || '';

        const matchesSearch = productName.includes(searchTerm) || productDesc.includes(searchTerm);
        const matchesCategory = categoryFilter === 'all' || productCategory === categoryFilter;

        card.style.display = (matchesSearch && matchesCategory) ? 'flex' : 'none';
    });

    if (isSelectMode) updateSelectionUI();
};

export const checkMarketLocationStatus = () => {
    const loc = getBuyerLocation();
    const hasLocation = !!loc;

    const warningEl = document.querySelector('[data-ui="market-location-warning"]');
    const mainEl = document.querySelector('[data-ui="market-main-content"]');

    if (warningEl && mainEl) {
        if (hasLocation) {
            warningEl.style.display = 'none';
            mainEl.style.display = 'block';
        } else {
            warningEl.style.display = 'flex';
            mainEl.style.display = 'none';
        }
    }
};

/**
 * Renders the seller-specific shop grid for the currently active chat partner.
 */
const renderSellerShopProducts = (products) => {
    const shopGrid = elements.shopProductGrid;
    if (!shopGrid) return;

    shopGrid.innerHTML = '';
    const currentActiveChatUid = getActiveChatUid();
    const currentUserId = auth.currentUser?.uid;
    const activeConversationUid = document.querySelector('.conversation-item.active')?.dataset.uid || null;
    const sellerId = resolveActiveSellerId({
        activeChatUid: currentActiveChatUid,
        activeConversationUid,
        currentUserId
    });

    const productList = Object.values(products || {}).filter(product => {
        if (!product) return false;
        return product.ownerId === sellerId;
    });

    productList.forEach(product => {
        const mainImg = product.images?.[0] || '';
        const imagesAttr = JSON.stringify(product.images || []);
        const priceHtml = `<span class="product-currency">${product.currency}</span>${parsePrice(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const soldOutBadge = product.soldOut ? '<div class="sold-out-badge" style="position: absolute; top: 10px; left: 10px; background: #e0a800; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; z-index: 10; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">ON THE WAY</div>' : '';
        const cardClass = product.soldOut ? 'product-card is-sold-out' : 'product-card';
        const cardStyle = product.soldOut ? 'style="opacity: 0.65; position: relative;"' : 'style="position: relative;"';
        const btnHtml = product.soldOut 
            ? '<button class="add-to-cart-btn" disabled style="background: var(--muted); border-color: var(--muted); cursor: not-allowed; opacity: 0.6;">On the Way</button>'
            : '<button class="add-to-cart-btn">Add to Cart</button>';

        const shopHtml = `
            <div class="${cardClass}" data-id="${product.id}" data-images='${imagesAttr}' ${cardStyle}>
                ${soldOutBadge}
                <div class="image-loader-wrapper">
                    <div class="spinner"></div>
                    <img src="${mainImg}" alt="${product.name}" class="product-img" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';">
                </div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-desc">${product.desc}</p>
                ${product.desc && product.desc.length > 60 ? `<span class="view-details-link" style="color: var(--brand, #0066cc); font-size: 0.78rem; cursor: pointer; display: inline-block; margin-bottom: 8px; font-weight: 500;">Read more</span>` : ''}
                <div class="product-meta">
                    <span class="product-form">Form: ${product.form}</span>
                    <span class="product-quantity">Quantity: ${product.qty}</span>
                    <div class="product-price">${priceHtml}</div>
                </div>
                ${btnHtml}
            </div>`;
        shopGrid.insertAdjacentHTML('beforeend', shopHtml);
    });

    if (productList.length === 0) {
        shopGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted); font-size: 0.95rem;">No products available from this seller.</div>';
    }
};

/**
 * Renders all products from all businesses in the general market grid.
 */
const renderGeneralMarketProducts = (products) => {
    checkMarketLocationStatus();

    const grid = elements.generalMarketProductGrid;
    if (!grid) return;

    grid.innerHTML = '';
    const userCategories = new Set(); // For category filter dropdown
    const sortVal = elements.generalMarketSortSelect?.value || 'name';

    const productList = Object.values(products).sort((a, b) => {
        if (sortVal === 'price-low') return (a.price || 0) - (b.price || 0);
        if (sortVal === 'price-high') return (b.price || 0) - (a.price || 0);
        if (sortVal === 'distance') {
            const distA = getNearestDistance(a.ownerId);
            const distB = getNearestDistance(b.ownerId);
            if (distA === distB) return (a.name || '').localeCompare(b.name || '');
            return distA - distB;
        }
        if (a.searchScore !== undefined || b.searchScore !== undefined) {
            const scoreA = a.searchScore || 0;
            const scoreB = b.searchScore || 0;
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    let finalProductsToRender = productList;

    // Apply distance filter if active and user location is available
    const refLoc = getBuyerLocation();
    if (distanceFilterRadius > 0 && refLoc) {
        finalProductsToRender = productList.filter(product => {
            const dist = getNearestDistance(product.ownerId);
            return dist !== Infinity && dist <= distanceFilterRadius;
        });
    }

    // Apply seller's visibility radius filter (sellers see own, friends bypass, others filtered by distance)
    finalProductsToRender = finalProductsToRender.filter(product => {
        const sellerId = product.ownerId;
        const isMe = auth.currentUser && sellerId === auth.currentUser.uid;
        const isFriend = !!moduleFriendsList[sellerId];

        if (isMe || isFriend) return true;

        const sellerProfile = allUsersCache[sellerId]?.businessProfile;
        const visibilityRadius = sellerProfile?.visibilityRadius || 0;

        if (visibilityRadius > 0) {
            const currentBuyerLoc = getBuyerLocation();
            if (!currentBuyerLoc) return false; // Hide if buyer has not shared location
            const dist = getNearestDistance(sellerId);
            if (dist === Infinity || dist > visibilityRadius) {
                return false;
            }
        }
        return true;
    });

    finalProductsToRender.forEach(product => {
        const mainImg = product.images?.[0] || '';
        const priceHtml = `<span class="product-currency">${product.currency}</span>${parsePrice(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const seller = allUsersCache[product.ownerId]?.fullname || 'Unknown Seller';

        let distanceHtml = '';
        let buttonDist = '';
        const currentBuyerLoc = getBuyerLocation();
        if (currentBuyerLoc) {
            const dist = getNearestDistance(product.ownerId);
            if (dist !== Infinity) {
                distanceHtml = `<span style="font-size: 0.72rem; color: var(--brand); font-weight: 800; margin-left: 6px;">(${dist.toFixed(1)}km away)</span>`;
                buttonDist = ` (${dist.toFixed(1)}km)`;
            }
        }

        // Update unique categories list for filter
        if (product.category) userCategories.add(product.category);

        const hasLocations = allUsersCache[product.ownerId]?.businessProfile?.pickupLocations?.length > 0;
        const showMapHtml = (hasLocations && !product.soldOut) ? `<button type="button" class="add-to-cart-btn" data-action="show-on-map" data-owner-id="${product.ownerId}" style="background: white; color: var(--brand-dark); border: 1px solid var(--border); text-decoration: none; text-align: center; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.82rem; height: 36px; padding: 0;"><i class="fa-solid fa-map-location-dot"></i> Show on Map${buttonDist}</button>` : '';

        let locationHtml = '';
        if (hasLocations) {
            const locations = allUsersCache[product.ownerId].businessProfile.pickupLocations;
            const primaryLoc = locations[0];
            const extraLocsCount = locations.length - 1;
            const labelText = extraLocsCount > 0 
                ? `${primaryLoc.name || primaryLoc.address} (+${extraLocsCount} more)` 
                : (primaryLoc.name || primaryLoc.address);

            locationHtml = `
                <div style="font-size: 0.78rem; color: var(--muted); margin-top: 8px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-solid fa-location-dot" style="color: var(--brand); font-size: 0.85rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${primaryLoc.address}">${labelText}</span>
                </div>
            `;
        }

        const soldOutBadge = product.soldOut ? '<div class="sold-out-badge" style="position: absolute; top: 10px; left: 10px; background: #e0a800; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; z-index: 10; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">ON THE WAY</div>' : '';
        const cardClass = product.soldOut ? 'product-card is-sold-out' : 'product-card';
        const cardStyle = product.soldOut ? 'style="opacity: 0.65; position: relative;"' : 'style="position: relative;"';
        const btnHtml = product.soldOut 
            ? '<button class="add-to-cart-btn" disabled style="background: var(--muted); border-color: var(--muted); cursor: not-allowed; opacity: 0.6; margin-top: 10px;">On the Way</button>'
            : `<button class="add-to-cart-btn" data-product-owner="${product.ownerId}" style="background: var(--brand); border-color: var(--brand-dark); margin-top: 10px;">View Shop</button>`;

        const generalMarketHtml = `
            <div class="${cardClass}" data-id="${product.id}" data-owner="${product.ownerId}" data-category="${product.category}" ${cardStyle}>
                ${soldOutBadge}
                <img src="${mainImg}" alt="${product.name}" class="product-img">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-desc">${product.desc}</p>
                ${product.desc && product.desc.length > 60 ? `<span class="view-details-link" style="color: var(--brand, #0066cc); font-size: 0.78rem; cursor: pointer; display: inline-block; margin-bottom: 8px; font-weight: 500;">Read more</span>` : ''}
                <div class="product-meta">
                    <span class="product-form">Form: ${product.form}</span>
                    <span class="product-quantity">Quantity: ${product.qty}</span>
                    <div class="product-price">${priceHtml}</div>
                </div>
                ${locationHtml}
                <strong style="font-size: 0.85rem; color: var(--muted); margin-top: 10px;">Seller: ${seller}${distanceHtml}</strong>
                ${btnHtml}
                ${showMapHtml}
            </div>`;
        grid.insertAdjacentHTML('beforeend', generalMarketHtml);
    });

    // Populate category filter for general market
    if (generalMarketCategoryDropdownControl) {
        generalMarketCategoryDropdownControl.updateOptions(userCategories);
    }
    if (marketCategoryMobileDropdownControl) {
        marketCategoryMobileDropdownControl.updateOptions(userCategories);
    }
};

/**
 * Refreshes both the Admin and Customer grids
 */
const renderGrids = (products) => {
    const grid = elements.productGrid;
    const shopGrid = elements.shopProductGrid;
    if (!grid || !shopGrid) return;

    renderGeneralMarketProducts(products);

    // Clear inventory grid and rebuild shop grid from seller-specific products only
    grid.innerHTML = '';
    shopGrid.innerHTML = '';
    renderSellerShopProducts(products);
    const currentUserId = auth.currentUser?.uid;
    const userCategories = new Set();

    if (isLoadingProducts) { // If still loading, re-render skeletons
        renderSkeleton();
        return;
    }

    const productList = Object.values(products).sort((a, b) => {
        const catA = a.category || '';
        const catB = b.category || '';
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.name || '').localeCompare(b.name || '');
    });

    // Update unique categories list for filter and datalist
    productList.forEach(p => {
        if (p.ownerId === currentUserId && p.category) userCategories.add(p.category);
    });

    if (elements.storeCategoryFilter) {
        const currentVal = elements.storeCategoryFilter.value;
        let options = '<option value="all">🔍 All Categories</option>';
        Array.from(userCategories).sort().forEach(cat => {
            const emoji = categoryEmojis[cat] ? categoryEmojis[cat] + ' ' : '🏷️ ';
            options += `<option value="${cat}">${emoji}${cat}</option>`;
        });
        elements.storeCategoryFilter.innerHTML = options;
        elements.storeCategoryFilter.value = userCategories.has(currentVal) ? currentVal : 'all';
    }

    if (elements.existingCategoriesList) {
        elements.existingCategoriesList.innerHTML = Array.from(userCategories).sort().map(cat => `<option value="${cat}">`).join('');
    }

    productList.forEach(product => {
        const mainImg = product.images?.[0] || '';
        const imagesAttr = JSON.stringify(product.images || []);
        const priceHtml = `<span class="product-currency">${product.currency}</span>${parsePrice(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Store Admin View Card - Filtered by owner (Inventory Management)
        if (product.ownerId === currentUserId) {
            const soldOutBadge = product.soldOut ? '<div class="sold-out-badge" style="background: #e0a800;">ON THE WAY</div>' : '';
            const storeHtml = `
                <div class="product-card ${product.soldOut ? 'is-sold-out' : ''} ${selectedProductIds.has(product.id) ? 'selected' : ''}" data-id="${product.id}" data-images='${imagesAttr}' data-sold-out="${!!product.soldOut}" data-ui="product-card">
                    <div class="product-checkbox"></div>
                    ${soldOutBadge}
                    <div class="product-actions">
                        <button type="button" class="toggle-sold-out-btn" title="${product.soldOut ? 'Mark as Available' : 'Mark as On the Way'}">${product.soldOut ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-ban"></i>'}</button>
                        <button type="button" class="edit-product-card-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="delete-product-card-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div class="image-loader-wrapper">
                        <div class="spinner"></div>
                        <img src="${mainImg}" alt="${product.name}" class="product-img" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';">
                    </div>
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-desc">${product.desc}</p>
                    <div class="product-meta">
                        <span class="product-form">Form: ${product.form}</span>
                        <span class="product-quantity">Quantity: ${product.qty}</span>
                        <span class="product-store-qty" style="display: block; font-size: 0.8rem; color: var(--muted); margin-top: 4px;">In Store: ${product.storeQty || 0}</span>
                        <div class="product-price">${priceHtml}</div>
                    </div>
                </div>`;
            grid.insertAdjacentHTML('beforeend', storeHtml);
        }

    });

    updateFilters();
};

/**
 * Updates the selection UI state
 */
const updateSelectionUI = () => {
    if (elements.storeSelectionCount) elements.storeSelectionCount.textContent = selectedProductIds.size;

    const visibleCards = Array.from(elements.productCards).filter(card => card.style.display !== 'none');
    const allVisibleSelected = visibleCards.length > 0 && visibleCards.every(card => selectedProductIds.has(card.dataset.id));

    if (elements.storeSelectAllCheckbox) elements.storeSelectAllCheckbox.checked = allVisibleSelected;

    elements.productCards.forEach(el => {
        el.classList.toggle('selected', selectedProductIds.has(el.dataset.id));
    });
};

/**
 * Triggers a full grid refresh using cached data
 */
export const refreshStoreGrids = async () => {
    // Render products for both Admin (Inventory) and Shop grids
    renderGrids(cachedProducts);

    // Update shop logic based on the active chat partner (the business profile)
    const user = auth.currentUser;
    let currentUserProfile = null;
    if (user) {
        currentUserProfile = await getUserProfile(user.uid);
    }
    const currentActiveChatUid = getActiveChatUid();
    const sellerProfile = currentActiveChatUid ? allUsersCache[currentActiveChatUid] : null;

    const activeBuyerLoc = getBuyerLocation();
    if (currentActiveChatUid) { // If there's an active chat, fetch the business profile of the other user
        try {
            const bizProfile = await getBusinessProfile(currentActiveChatUid);
            await updateShopPickupLocations(bizProfile, activeBuyerLoc, currentUserProfile, moduleFriendsList, sellerProfile);
        } catch (error) {
            console.error("Error fetching business profile for shop:", error);
            await updateShopPickupLocations(null, activeBuyerLoc, currentUserProfile, moduleFriendsList, sellerProfile);
        }
    } else if (user) { // If no active chat, but user is logged in, still pass current user profile
        await updateShopPickupLocations(null, activeBuyerLoc, currentUserProfile, moduleFriendsList, null);
    } else {
        await updateShopPickupLocations(null, activeBuyerLoc, null, moduleFriendsList); // No active user, no active chat
    }
};

const formatNumberWithCommas = (value) => {
    if (value === null || value === undefined) return '';
    let clean = String(value).replace(/[^\d.]/g, '');
    let parts = clean.split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + decimalPart;
};

export const initStore = () => {
    // Initialize product form numeric formatting
    const setupProductFormFormatting = () => {
        const priceInput = elements.addProductForm?.querySelector('#p-price');
        const qtyInput = elements.addProductForm?.querySelector('#p-qty');
        const storeQtyInput = elements.addProductForm?.querySelector('#p-store-qty');

        const handleNumericInput = (e) => {
            const input = e.target;
            const value = input.value;
            let cursor = input.selectionStart;
            let clean = value.replace(/[^\d.]/g, '');
            let parts = clean.split('.');
            let integerPart = parts[0];
            let decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';
            let formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            let formattedValue = formattedInteger + decimalPart;
            input.value = formattedValue;
            let digitsOnlyBefore = value.slice(0, cursor).replace(/[^\d.]/g, '');
            let newCursor = 0;
            let digitsFound = 0;
            for (let i = 0; i < formattedValue.length; i++) {
                if (digitsFound === digitsOnlyBefore.length) {
                    newCursor = i;
                    break;
                }
                if (formattedValue[i] !== ',') {
                    digitsFound++;
                }
                newCursor = i + 1;
            }
            input.setSelectionRange(newCursor, newCursor);
        };

        if (priceInput) priceInput.addEventListener('input', handleNumericInput);
    };
    setupProductFormFormatting();

    const setupBusinessLogoUpload = () => {
        const modalUploadBtn = document.querySelector('[data-ui="modal-upload-logo-btn"]');
        const modalLogoInput = document.querySelector('[data-ui="modal-logo-input"]');
        const viewUploadBtn = document.querySelector('[data-ui="view-upload-logo-btn"]');
        const viewLogoInput = document.querySelector('[data-ui="view-logo-input"]');

        const handleUploadClick = (inputEl) => {
            inputEl?.click();
        };

        modalUploadBtn?.addEventListener('click', () => handleUploadClick(modalLogoInput));
        viewUploadBtn?.addEventListener('click', () => handleUploadClick(viewLogoInput));

        const handleLogoFileChange = async (e) => {
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

            const cropperModal = document.querySelector('[data-ui="image-cropper-modal"]');
            if (cropperModal) {
                cropperModal.dataset.skipPush = 'true';
                cropperModal.style.display = 'flex';
                cropperModal.style.zIndex = '12000'; // Make sure it sits on top of everything
            }

            let cropper = new Cropper(img, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
            });

            const cleanup = () => {
                if (cropper) cropper.destroy();
                URL.revokeObjectURL(url);
                if (cropperModal) cropperModal.style.display = 'none';
                e.target.value = '';
            };

            const confirmBtn = document.querySelector('[data-ui="cropper-confirm"]');
            const cancelBtn = document.querySelector('[data-ui="cropper-cancel"]');

            const controller = new AbortController();
            const { signal } = controller;

            confirmBtn?.addEventListener('click', async () => {
                try {
                    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
                    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                    
                    pendingLogoBlob = blob;

                    const logoUrl = URL.createObjectURL(blob);

                    // Update modal preview
                    const modalPreview = document.querySelector('[data-ui="modal-logo-preview"]');
                    const modalIcon = document.querySelector('[data-ui="modal-logo-icon"]');
                    if (modalPreview) {
                        modalPreview.src = logoUrl;
                        modalPreview.style.display = 'block';
                    }
                    if (modalIcon) modalIcon.style.display = 'none';

                    // Update view preview
                    const viewPreview = document.querySelector('[data-ui="view-logo-preview"]');
                    const viewIcon = document.querySelector('[data-ui="view-logo-icon"]');
                    if (viewPreview) {
                        viewPreview.src = logoUrl;
                        viewPreview.style.display = 'block';
                    }
                    if (viewIcon) viewIcon.style.display = 'none';

                    showToast("Logo cropped and ready!", "success");
                } catch (err) {
                    console.error("Error cropping business logo:", err);
                    showToast("Failed to process logo", "error");
                }
                cleanup();
                controller.abort();
            }, { signal });

            cancelBtn?.addEventListener('click', () => {
                cleanup();
                controller.abort();
            }, { signal });
        };

        modalLogoInput?.addEventListener('change', handleLogoFileChange);
        viewLogoInput?.addEventListener('change', handleLogoFileChange);
    };
    setupBusinessLogoUpload();
    // Initialize custom category dropdowns
    generalMarketCategoryDropdownControl = makeCustomDropdownSearchable(
        'general-market-category-wrapper',
        'general-market-category-filter',
        'general-market-category-trigger',
        'general-market-category-dropdown',
        'general-market-category-search',
        'general-market-category-options-list'
    );

    marketCategoryMobileDropdownControl = makeCustomDropdownSearchable(
        'market-category-mobile-wrapper',
        'market-category-filter-mobile',
        'market-category-mobile-trigger',
        'market-category-mobile-dropdown',
        'market-category-mobile-search',
        'market-category-mobile-options-list'
    );



    /**
     * Proactively requests the user's location to enable distance-based features.
     */
    const requestUserLocation = () => {
        if (!navigator.geolocation || userLocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                renderRecentlyViewedProducts();
                renderGeneralMarketProducts(cachedProducts);
                refreshStoreGrids(); // Update distances in the Shop view too
            },
            (err) => console.warn("Location access denied or unavailable", err),
            { enableHighAccuracy: true }
        );
    };

    // Trigger location request when entering Market or Store views
    elements.generalMarketNav?.addEventListener('click', requestUserLocation);
    elements.generalMarketNav?.addEventListener('click', checkMarketLocationStatus);
    elements.generalMarketNav?.addEventListener('click', renderRecentlyViewedProducts);
    elements.storeNav?.addEventListener('click', requestUserLocation);

    // Prompt for location when Enable Location button is clicked on warning screen
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-ui="market-enable-location-btn"]')) {
            if (navigator.geolocation) {
                showToast("Requesting browser location...", "info");
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        showToast("Location sharing enabled!", "success");
                        checkMarketLocationStatus();
                        renderGeneralMarketProducts(cachedProducts);
                    },
                    (err) => {
                        console.warn("Location permission denied or failed:", err);
                        showToast("Failed to fetch location. Please enable location permissions in your browser or register a shop location.", "error");
                        checkMarketLocationStatus();
                    },
                    { enableHighAccuracy: true }
                );
            } else {
                showToast("Geolocation is not supported by your browser.", "error");
            }
        }
    });

    // Store Ellipsis Menu Toggles
    elements.storeMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = elements.storeHeaderMenu;
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Store Refresh Button
    elements.storeRefreshBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const user = auth.currentUser;
        if (!user) return;

        const btn = elements.storeRefreshBtn;
        const icon = btn.querySelector('i');
        if (btn.disabled) return;

        try {
            btn.disabled = true;
            if (icon) icon.classList.add('fa-spin');

            const myProducts = await getProductsByOwner(user.uid);

            // Sync cachedProducts by removing stale owner items first, then merging fresh ones
            for (const key in cachedProducts) {
                if (cachedProducts[key].ownerId === user.uid) {
                    delete cachedProducts[key];
                }
            }
            Object.assign(cachedProducts, myProducts);

            // Re-render
            renderGrids(myProducts);
            showToast("Inventory refreshed!", "success");
        } catch (error) {
            console.error("Failed to refresh inventory:", error);
            showToast("Refresh failed. Please check your connection.", "error");
        } finally {
            btn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
    });

    // General Market Refresh Button
    elements.marketRefreshBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = elements.marketRefreshBtn;
        const icon = btn.querySelector('i');
        if (btn.disabled) return;

        try {
            btn.disabled = true;
            if (icon) icon.classList.add('fa-spin');

            const searchTerm = elements.generalMarketSearchInput?.value.trim() || '';

            if (searchTerm === '') {
                // Reset desktop & mobile search inputs
                if (elements.generalMarketSearchInput) elements.generalMarketSearchInput.value = '';
                if (elements.marketSearchInputMobile) elements.marketSearchInputMobile.value = '';
                
                // Reset category filters
                if (elements.generalMarketCategoryFilter) elements.generalMarketCategoryFilter.value = 'all';
                if (elements.marketCategoryFilterMobile) elements.marketCategoryFilterMobile.value = 'all';
                if (generalMarketCategoryDropdownControl) generalMarketCategoryDropdownControl.setValue('all');
                if (marketCategoryMobileDropdownControl) marketCategoryMobileDropdownControl.setValue('all');

                // Reset distance filters
                if (elements.generalMarketDistanceFilterSlider) {
                    elements.generalMarketDistanceFilterSlider.value = 0;
                    if (elements.generalMarketDistanceFilterValue) elements.generalMarketDistanceFilterValue.textContent = 'No filter';
                }
                if (elements.marketDistanceFilterSliderMobile) {
                    elements.marketDistanceFilterSliderMobile.value = 0;
                    if (elements.marketDistanceFilterValueMobile) elements.marketDistanceFilterValueMobile.textContent = 'No filter';
                }

                distanceFilterRadius = 0;
                isFilteredMode = false;

                // Load fresh market page of all products
                await loadNextMarketPage(true);
                showToast("Market refreshed successfully", "success");
            } else {
                // Refresh active search results
                await updateMarketView(true);
                showToast("Search results refreshed", "success");
            }
        } catch (err) {
            console.error("Failed to refresh market:", err);
            showToast("Refresh failed. Please check your connection.", "error");
        } finally {
            btn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
        if (elements.storeHeaderMenu) {
            elements.storeHeaderMenu.style.display = 'none';
        }
    });

    // Trigger actions from ellipsis menu
    elements.storeMenuAddProduct?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.storeHeaderMenu) elements.storeHeaderMenu.style.display = 'none';
        elements.addProductBtn?.click();
    });

    elements.storeMenuUpdateBusiness?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.storeHeaderMenu) elements.storeHeaderMenu.style.display = 'none';
        elements.updateBusinessInfoBtn?.click();
    });

    // Mobile Search toggle events
    elements.storeSearchToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.storeHeaderTitle) elements.storeHeaderTitle.style.display = 'none';
        if (elements.storeSearchToggleBtn) elements.storeSearchToggleBtn.style.display = 'none';
        if (elements.storeMenuBtn) elements.storeMenuBtn.style.display = 'none';
        if (elements.storeSearchOverlay) {
            elements.storeSearchOverlay.style.display = 'flex';
            const input = elements.storeSearchInputMobile;
            if (input) {
                input.focus();
            }
        }
    });

    elements.closeStoreSearchBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.storeSearchOverlay) elements.storeSearchOverlay.style.display = 'none';
        if (elements.storeHeaderTitle) elements.storeHeaderTitle.style.display = 'block';
        if (elements.storeSearchToggleBtn) elements.storeSearchToggleBtn.style.display = 'flex';
        if (elements.storeMenuBtn) elements.storeMenuBtn.style.display = 'flex';

        // Clear mobile search input
        if (elements.storeSearchInputMobile) {
            elements.storeSearchInputMobile.value = '';
        }
        // Reset main search input
        if (elements.storeSearchInput) {
            elements.storeSearchInput.value = '';
            elements.storeSearchInput.dispatchEvent(new Event('input'));
        }
    });

    // Synchronize inputs
    elements.storeSearchInputMobile?.addEventListener('input', (e) => {
        if (elements.storeSearchInput) {
            elements.storeSearchInput.value = e.target.value;
            elements.storeSearchInput.dispatchEvent(new Event('input'));
        }
    });

    /**
     * Opens the business registration modal in "Update" mode with existing profile data.
     */
    const openBusinessUpdateModal = () => {
        if (!currentBusinessProfile) {
            showToast("Loading business details...", "info");
            checkBusinessRegistrationStatus();
            return;
        }

        pendingLogoBlob = null;
        isEditingBusinessProfile = true;
        const modal = elements.businessRegistrationModal;
        if (modal) {
            modal.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
            modal.querySelectorAll('input.invalid').forEach(el => el.classList.remove('invalid'));

            modal.style.display = 'flex';
            const modalTitle = modal.querySelector('h3');
            if (modalTitle) modalTitle.textContent = 'Update Business Information';

            const submitBtn = modal.querySelector('[data-ui="register-business-submit-btn"]');
            if (submitBtn) submitBtn.textContent = 'Confirm & Update';

            if (elements.closeBusinessRegistrationModalBtn) elements.closeBusinessRegistrationModalBtn.style.display = 'block';
            elements.skipToReviewBtns.forEach(btn => btn.style.display = 'block');
            const form = modal.querySelector('form');
            if (form) {
                form.dataset.populating = "true";
                populateBusinessRegistrationForm(currentBusinessProfile, form).finally(() => {
                    showStep(1); // Always start at step 1 when opening for update
                    delete form.dataset.populating;
                });
            }
        }
    };

    const handleDeleteBusiness = async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (confirm("Are you sure you want to delete your business account? This will remove your profile and delivery settings. Your products will remain in your inventory but your shop will be hidden from customers.")) {
            const btn = elements.deleteBusinessBtn;
            const originalContent = btn ? btn.innerHTML : '';

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner"></span> Deleting...';
                }

                await deleteBusinessProfile(user.uid);
                showToast("Business account deleted.", "info");

                // Re-evaluate registration status which handles UI visibility
                await checkBusinessRegistrationStatus();

                // Refresh grids to hide the customer-facing shop
                refreshStoreGrids();
            } catch (error) {
                console.error("Delete Business Error:", error);
                showToast("Failed to delete business account. Please check your connection.", "error");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        }
    };

    // Close handler for the profile modal
    elements.closeBusinessProfileModalBtn?.addEventListener('click', () => {
        if (elements.businessProfileModal) elements.businessProfileModal.style.display = 'none';
    });

    // Robust event delegation for management buttons
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-ui="update-business-info-btn"], [data-ui="delete-business-btn"], [data-ui="view-business-profile-btn"]');
        if (!target) return;
        e.preventDefault();

        if (target.dataset.ui === "update-business-info-btn") {
            openBusinessUpdateModal();
        } else if (target.dataset.ui === "view-business-profile-btn") {
            openBusinessProfileModal();
        } else {
            handleDeleteBusiness();
        }
    });

    // Inject Bulk Selection Bar
    if (!document.querySelector('.store-selection-bar')) {
        const barHtml = `
            <div class="store-selection-bar" data-ui="store-selection-bar" style="display: none;">
                <input type="checkbox" class="store-select-all-checkbox" data-ui="store-select-all-checkbox" style="margin-right: 10px; cursor: pointer; width: 18px; height: 18px;" title="Select or deselect all visible products">
                <span class="store-selection-count" data-ui="store-selection-count">0</span> Selected
                <div class="selection-actions" style="margin-left: auto; display: flex; gap: 10px;">
                    <button class="store-cancel-selection-btn" data-ui="store-cancel-selection-btn" style="background: #6c757d; border: none; color: white; padding: 5px 15px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Exit selection mode"><i class="fa-solid fa-xmark"></i><span class="btn-text">Cancel</span></button>
                    <button class="store-mass-sold-out-btn" data-ui="store-mass-sold-out-btn" style="background: #00a884; border: none; color: white; padding: 5px 15px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Toggle On the Way status for all selected items"><i class="fa-solid fa-toggle-on"></i><span class="btn-text">Toggle On the Way</span></button>
                    <button class="store-mass-delete-btn" data-ui="store-mass-delete-btn" style="background: #cc0000; border: none; color: white; padding: 5px 15px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Permanently delete all selected items"><i class="fa-solid fa-trash"></i><span class="btn-text">Delete</span></button>
                </div>
            </div>`;
        elements.storeArea?.insertAdjacentHTML('afterbegin', barHtml);
    }



    // Start populating countries and check status without blocking listener registration
    populateCountries();
    subscribeToAuthChanges((user) => {
        if (user) checkBusinessRegistrationStatus();
    });


    const toggleSelectMode = (active) => {
        isSelectMode = active;
        selectedProductIds.clear();
        elements.storeArea?.classList.toggle('select-mode', active);
        if (elements.storeSelectionBar) elements.storeSelectionBar.style.display = active ? 'flex' : 'none';
        if (elements.storeSelectAllCheckbox) elements.storeSelectAllCheckbox.checked = false;
        updateSelectionUI();
    };

    // Initially render skeletons
    renderSkeleton();
    renderGeneralMarketProducts({}); // Render skeletons for general market too


    // Create Delete Confirmation Modal dynamically if not in HTML
    if (!document.querySelector('.delete-product-modal')) {
        const modalHtml = `
            <div class="delete-product-modal" data-ui="delete-product-modal">
                <div class="delete-modal-content">
                    <h3>Confirm Deletion</h3>
                    <p>Are you sure you want to delete this product? This action cannot be undone.</p>
                    <div class="delete-preview-info">
                        <img src="" alt="" class="delete-preview-img" data-ui="delete-preview-img">
                        <strong class="delete-product-name" data-ui="delete-product-name"></strong>
                    </div>
                    <div class="delete-modal-actions">
                        <button class="cancel-delete-btn" data-ui="cancel-delete-btn">Cancel</button>
                        <button class="confirm-delete-btn" data-ui="confirm-delete-btn">Delete Product</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Change quantity input to text to allow descriptive values (e.g., "30 Tablets", "250ml")
    const qtyInput = elements.addProductForm?.querySelector('[name="qty"]');
    if (qtyInput) qtyInput.type = 'text';

    const updateImageButtonsState = (count) => {
        const isLimitReached = count >= 5;
        if (elements.uploadProductBtn) elements.uploadProductBtn.disabled = isLimitReached;
        if (elements.captureProductBtn) elements.captureProductBtn.disabled = isLimitReached;
        if (elements.searchWebImgBtn) elements.searchWebImgBtn.disabled = isLimitReached;
        if (elements.pasteUrlImgBtn) elements.pasteUrlImgBtn.disabled = isLimitReached;
    };

    const renderPreviews = (images) => {
        if (!elements.productImgPreview) return;
        if (images.length === 0) {
            elements.productImgPreview.innerHTML = '<span>No image selected</span>';
        } else {
            elements.productImgPreview.innerHTML = images.map((img, index) =>
                `<div class="preview-item" data-index="${index}">
                    <img src="${img}" alt="Preview">
                    <button type="button" class="remove-img-btn">×</button>
                </div>`
            ).join('');
        }
        updateImageButtonsState(images.length);
    };

    const updateLightboxImage = () => {
        if (elements.lightboxImage) {
            const spinner = document.getElementById('lightbox-spinner');
            if (spinner) spinner.style.display = 'block';
            elements.lightboxImage.style.opacity = '0.3';

            elements.lightboxImage.onload = () => {
                if (spinner) spinner.style.display = 'none';
                elements.lightboxImage.style.opacity = '1';
                elements.lightboxImage.onload = null;
            };

            elements.lightboxImage.onerror = () => {
                if (spinner) spinner.style.display = 'none';
                elements.lightboxImage.style.opacity = '1';
                elements.lightboxImage.onerror = null;
            };

            elements.lightboxImage.src = window.currentLightboxImages[window.currentLightboxIndex];
        }
    };

    /**
     * Opens the lightbox modal to view product images.
     * @param {object} product - The product object.
     * @param {number} initialIndex - The index of the image to show first.
     */
    const openProductImageLightbox = (product, initialIndex = 0) => {
        if (!product || !elements.lightboxModal) return;

        // Get images array, fallback to a single-item array using the first image or placeholder
        const images = (product.images && product.images.length > 0) 
            ? product.images 
            : [product.image || (product.images?.[0]) || 'https://via.placeholder.com/200'];

        window.currentLightboxImages = images;
        window.currentLightboxIndex = initialIndex;

        // Make sure the image element is visible and video element is hidden (just in case)
        if (elements.lightboxImage) elements.lightboxImage.style.display = 'block';
        const lightboxVideo = document.querySelector('[data-ui="lightbox-video"]');
        if (lightboxVideo) lightboxVideo.style.display = 'none';

        updateLightboxImage();

        if (elements.lightboxHeader) elements.lightboxHeader.style.display = 'none';
        if (elements.lightboxUserInfo) elements.lightboxUserInfo.style.display = 'none';
        if (elements.lightboxEditBtn) elements.lightboxEditBtn.style.display = 'none';
        if (elements.lightboxStarBtn) elements.lightboxStarBtn.style.display = 'none';
        if (elements.lightboxForwardBtn) elements.lightboxForwardBtn.style.display = 'none';
        if (elements.lightboxDeleteBtn) elements.lightboxDeleteBtn.style.display = 'none';
        if (elements.lightboxDownloadBtn) {
            elements.lightboxDownloadBtn.style.display = 'flex';
            elements.lightboxDownloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = window.currentLightboxImages[window.currentLightboxIndex];
                a.download = 'download.jpg';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
        }

        // Show/hide navigation arrows based on the number of images
        if (elements.lightboxPrev) elements.lightboxPrev.style.display = images.length > 1 ? 'block' : 'none';
        if (elements.lightboxNext) elements.lightboxNext.style.display = images.length > 1 ? 'block' : 'none';

        elements.lightboxModal.style.display = 'flex';
    };

    window.openProductImageLightbox = openProductImageLightbox;

    /**
     * Click handler to open the product details modal when clicking on a card's details
     * (excluding interactive elements like buttons, links, inputs).
     * @param {Event} e - The click event.
     */
    const handleProductCardClick = (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;

        // Check if the click target is or is inside an interactive element
        const isButton = e.target.closest('button') || e.target.closest('a') || e.target.closest('input');
        if (isButton) return;

        const productId = card.dataset.id;
        if (!productId) return;

        // Record recently viewed product
        addProductToRecentlyViewed(productId);

        const product = cachedProducts[productId];
        if (product) {
            // If image or loader wrapper is clicked, view product image in lightbox
            const isImgClick = e.target.closest('.product-img') || e.target.closest('.image-loader-wrapper');
            if (isImgClick) {
                openProductImageLightbox(product);
                return;
            }

            // Map store product object format to shop product details format
            const mappedItem = {
                id: product.id,
                name: product.name,
                description: product.desc,
                image: product.images?.[0] || 'https://via.placeholder.com/200',
                price: parsePrice(product.price || 0),
                currency: product.currency || '$',
                form: product.form || '',
                productQty: product.qty || ''
            };
            if (typeof window.showProductDetails === 'function') {
                window.showProductDetails(mappedItem);
            }
        }
    };

    let lastKey = null;
    let isMarketEndReached = false;
    let isLoadingMarketPage = false;
    let isFilteredMode = false;
    let marketProducts = [];

    const loadNextMarketPage = async (reset = false) => {
        if (isLoadingMarketPage) return;
        if (!reset && (isMarketEndReached || isFilteredMode)) return;

        isLoadingMarketPage = true;
        if (reset) {
            lastKey = null;
            isMarketEndReached = false;
            marketProducts = [];
            if (elements.generalMarketProductGrid) elements.generalMarketProductGrid.innerHTML = '';
        }

        let loader = elements.generalMarketProductGrid?.querySelector('.market-scroll-loader');
        if (!loader && elements.generalMarketProductGrid) {
            elements.generalMarketProductGrid.insertAdjacentHTML('beforeend', '<div class="market-scroll-loader" style="grid-column: 1/-1; text-align: center; padding: 20px;"><span class="spinner" style="margin: 0 auto 10px;"></span> Loading...</div>');
            loader = elements.generalMarketProductGrid.querySelector('.market-scroll-loader');
        }

        try {
            if (reset) {
                const localProducts = await getAllCachedProducts();
                if (localProducts.length > 0) {
                    const localMap = {};
                    localProducts.forEach(p => {
                        localMap[p.id] = p;
                        if (!marketProducts.some(mp => mp.id === p.id)) {
                            marketProducts.push(p);
                        }
                    });
                    Object.assign(cachedProducts, localMap);
                    marketProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    renderGeneralMarketProducts(localMap);
                    
                    const keys = marketProducts.map(p => p.id).sort();
                    if (keys.length > 0) {
                        lastKey = keys[0];
                    }
                }
            }

            const pageData = await getProductsPage(lastKey, 20);
            if (loader) loader.remove();

            const productsList = Object.values(pageData);
            if (productsList.length === 0) {
                isMarketEndReached = true;
                if (marketProducts.length === 0 && elements.generalMarketProductGrid) {
                    elements.generalMarketProductGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">No products found in the market.</div>';
                }
                return;
            }

            Object.assign(cachedProducts, pageData);

            const keys = Object.keys(pageData).sort();
            if (keys.length > 0) {
                lastKey = keys[0];
            }

            productsList.forEach(p => {
                if (!marketProducts.some(mp => mp.id === p.id)) {
                    marketProducts.push(p);
                }
            });

            marketProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            const marketMap = {};
            marketProducts.forEach(p => {
                marketMap[p.id] = p;
            });

            renderGeneralMarketProducts(marketMap);

            if (productsList.length < 20) {
                isMarketEndReached = true;
            }
        } catch (err) {
            console.error("Error loading market page:", err);
            if (loader) loader.remove();
        } finally {
            isLoadingMarketPage = false;
        }
    };

    const updateMarketView = async (reset = false) => {
        const term = elements.generalMarketSearchInput?.value.trim().toLowerCase() || '';
        const cat = elements.generalMarketCategoryFilter?.value || 'all';

        if (term !== '' || cat !== 'all') {
            isFilteredMode = true;
            if (elements.generalMarketProductGrid) {
                elements.generalMarketProductGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);"><span class="spinner" style="margin: 0 auto 10px;"></span> Searching Market...</div>';
            }

            try {
                let filteredProducts = {};
                if (term !== '') {
                    filteredProducts = await getProductsBySearch(term);
                } else {
                    filteredProducts = await getProductsByCategory(cat);
                }

                if (term !== '' && cat !== 'all') {
                    const temp = {};
                    Object.entries(filteredProducts).forEach(([id, p]) => {
                        if (p.category === cat) {
                            temp[id] = p;
                        }
                    });
                    filteredProducts = temp;
                }

                Object.assign(cachedProducts, filteredProducts);
                renderGeneralMarketProducts(filteredProducts);
            } catch (err) {
                console.error("Error updating market view:", err);
                if (elements.generalMarketProductGrid) {
                    elements.generalMarketProductGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">Error searching products.</div>';
                }
            }
        } else {
            isFilteredMode = false;
            await loadNextMarketPage(reset);
        }
    };

    const loadSubscriptionUI = async (userId) => {
        const box = document.getElementById('subscription-status-box');
        if (!box) return;
        box.style.display = 'none';
        box.innerHTML = '';
    };
    window.loadSubscriptionUI = loadSubscriptionUI;

    let sellerProductsUnsubscribe = null;
    let currentUserProfileUnsubscribe = null;
    let allUsersUnsubscribe = null;
    let currentUserSubscribed = true; // Default to true to prevent screen flickering

    subscribeToAuthChanges((user) => {
        if (user) {
            if (allUsersUnsubscribe) allUsersUnsubscribe();
            allUsersUnsubscribe = subscribeToAllUsers(users => {
                allUsersCache = users;
                if (Object.keys(cachedProducts).length > 0) {
                    renderRecentlyViewedProducts();
                    renderGeneralMarketProducts(cachedProducts);
                }
            });

            if (currentUserProfileUnsubscribe) currentUserProfileUnsubscribe();
            currentUserProfileUnsubscribe = subscribeToUserProfile(user.uid, (profile) => {
                currentUserSubscribed = true; // Hardcoded to true for a free application model
                loadSubscriptionUI(user.uid);
            });

            if (sellerProductsUnsubscribe) sellerProductsUnsubscribe();
            sellerProductsUnsubscribe = subscribeToSellerProducts(user.uid, (myProducts) => {
                isLoadingProducts = false;
                Object.assign(cachedProducts, myProducts);
                renderGrids(myProducts);
            });
            loadNextMarketPage(true);
        } else {
            if (allUsersUnsubscribe) {
                allUsersUnsubscribe();
                allUsersUnsubscribe = null;
            }
            if (currentUserProfileUnsubscribe) {
                currentUserProfileUnsubscribe();
                currentUserProfileUnsubscribe = null;
            }
            if (sellerProductsUnsubscribe) {
                sellerProductsUnsubscribe();
                sellerProductsUnsubscribe = null;
            }
        }
    });

    const performGeneralMarketSearch = debounce((term) => {
        updateMarketView(true);
    }, 300);

    elements.generalMarketSearchInput?.addEventListener('input', (e) => {
        performGeneralMarketSearch(e.target.value.toLowerCase());
    });

    elements.generalMarketCategoryFilter?.addEventListener('change', () => {
        updateMarketView(true);
    });

    elements.storeSearchInput?.addEventListener('input', updateFilters);
    elements.storeCategoryFilter?.addEventListener('change', updateFilters);

    const handleStoreAreaScroll = () => {
        const storeVisible = elements.storeArea && window.getComputedStyle(elements.storeArea).display !== 'none';
        const isMarketTab = elements.generalMarketTabBtn && elements.generalMarketTabBtn.classList.contains('active');
        if (storeVisible && isMarketTab && !isFilteredMode && !isLoadingMarketPage && !isMarketEndReached) {
            const container = elements.storeArea;
            if (container.scrollHeight - container.scrollTop - container.clientHeight < 300) {
                loadNextMarketPage(false);
            }
        }
    };
    elements.storeArea?.addEventListener('scroll', handleStoreAreaScroll);

    window.addEventListener('scroll', () => {
        const storeVisible = elements.storeArea && window.getComputedStyle(elements.storeArea).display !== 'none';
        const isMarketTab = elements.generalMarketTabBtn && elements.generalMarketTabBtn.classList.contains('active');
        if (storeVisible && isMarketTab && !isFilteredMode && !isLoadingMarketPage && !isMarketEndReached) {
            if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 300) {
                loadNextMarketPage(false);
            }
        }
    });

    elements.generalMarketSortSelect?.addEventListener('change', () => {
        if (elements.generalMarketSortSelect.value === 'distance' && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    renderGeneralMarketProducts(cachedProducts);
                    renderRecentlyViewedProducts();
                },
                () => {
                    showToast("Distance sorting requires location access.", "warning");
                    elements.generalMarketSortSelect.value = 'name';
                    renderGeneralMarketProducts(cachedProducts);
                }
            );
        } else {
            renderGeneralMarketProducts(cachedProducts);
        }
    });

    elements.generalMarketDistanceFilterSlider?.addEventListener('input', (e) => {
        const radius = parseInt(e.target.value);
        distanceFilterRadius = radius;

        if (elements.generalMarketDistanceFilterValue) {
            elements.generalMarketDistanceFilterValue.textContent = radius > 0 ? `${radius}km` : 'No filter';
        }

        if (radius > 0 && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    renderGeneralMarketProducts(cachedProducts);
                    renderRecentlyViewedProducts();
                },
                () => {
                    showToast("Distance filtering requires location access.", "warning");
                    distanceFilterRadius = 0;
                    e.target.value = 0;
                    if (elements.generalMarketDistanceFilterValue) elements.generalMarketDistanceFilterValue.textContent = 'No filter';
                    renderGeneralMarketProducts(cachedProducts);
                }
            );
        } else {
            renderRecentlyViewedProducts();
            renderGeneralMarketProducts(cachedProducts);
        }
    });

    // General Market Mobile Search & Filters Toggles
    elements.marketSearchToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.marketHeaderTitle) elements.marketHeaderTitle.style.display = 'none';
        if (elements.marketSearchToggleBtn) elements.marketSearchToggleBtn.style.display = 'none';
        if (elements.marketFilterToggleBtn) elements.marketFilterToggleBtn.style.display = 'none';
        if (elements.marketSearchOverlay) {
            elements.marketSearchOverlay.style.display = 'flex';
            const input = elements.marketSearchInputMobile;
            if (input) {
                input.focus();
            }
        }
    });

    elements.closeMarketSearchBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.marketSearchOverlay) elements.marketSearchOverlay.style.display = 'none';
        if (elements.marketHeaderTitle) elements.marketHeaderTitle.style.display = 'block';
        if (elements.marketSearchToggleBtn) elements.marketSearchToggleBtn.style.display = 'flex';
        if (elements.marketFilterToggleBtn) elements.marketFilterToggleBtn.style.display = 'flex';

        // Clear inputs
        if (elements.marketSearchInputMobile) elements.marketSearchInputMobile.value = '';
        if (elements.generalMarketSearchInput) {
            elements.generalMarketSearchInput.value = '';
            elements.generalMarketSearchInput.dispatchEvent(new Event('input'));
        }
    });

    elements.marketFilterToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const drawer = elements.marketFilterDrawer;
        if (drawer) {
            drawer.style.display = drawer.style.display === 'none' ? 'flex' : 'none';
        }
    });

    // Synchronize Mobile Search Input
    elements.marketSearchInputMobile?.addEventListener('input', (e) => {
        if (elements.generalMarketSearchInput) {
            elements.generalMarketSearchInput.value = e.target.value;
            elements.generalMarketSearchInput.dispatchEvent(new Event('input'));
        }
    });

    // Synchronize Mobile Category filter
    elements.marketCategoryFilterMobile?.addEventListener('change', (e) => {
        if (elements.generalMarketCategoryFilter) {
            elements.generalMarketCategoryFilter.value = e.target.value;
            elements.generalMarketCategoryFilter.dispatchEvent(new Event('change'));
        }
        updateMarketFilterBadge();
    });

    // Synchronize Mobile Sort select
    elements.marketSortSelectMobile?.addEventListener('change', (e) => {
        if (elements.generalMarketSortSelect) {
            elements.generalMarketSortSelect.value = e.target.value;
            elements.generalMarketSortSelect.dispatchEvent(new Event('change'));
        }
        updateMarketFilterBadge();
    });

    // Synchronize Mobile Distance slider
    elements.marketDistanceFilterSliderMobile?.addEventListener('input', (e) => {
        const radius = parseInt(e.target.value);
        if (elements.marketDistanceFilterValueMobile) {
            elements.marketDistanceFilterValueMobile.textContent = radius > 0 ? `${radius}km` : 'No filter';
        }
        if (elements.generalMarketDistanceFilterSlider) {
            elements.generalMarketDistanceFilterSlider.value = e.target.value;
            elements.generalMarketDistanceFilterSlider.dispatchEvent(new Event('input'));
        }
        updateMarketFilterBadge();
    });

    // Helper to update active filter indicator badge
    const updateMarketFilterBadge = () => {
        const hasActiveFilter =
            (elements.marketCategoryFilterMobile?.value && elements.marketCategoryFilterMobile.value !== 'all') ||
            (elements.marketSortSelectMobile?.value && elements.marketSortSelectMobile.value !== 'name') ||
            (parseInt(elements.marketDistanceFilterSliderMobile?.value || 0) > 0);

        if (elements.marketFilterBadge) {
            elements.marketFilterBadge.style.display = hasActiveFilter ? 'block' : 'none';
        }
    };

    // Scroll to top arrow utility helper
    const setupScrollToTop = (scrollContainer, button) => {
        if (!scrollContainer || !button) return;

        scrollContainer.addEventListener('scroll', () => {
            if (scrollContainer.scrollTop > 300) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        });

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            scrollContainer.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    };

    setupScrollToTop(elements.generalMarketArea, elements.marketScrollTopBtn);
    setupScrollToTop(elements.storeArea, elements.storeScrollTopBtn);
    setupScrollToTop(elements.shopContainer, elements.shopScrollTopBtn);

    // Open details modal when clicking product card in General Market or Recently Viewed
    elements.generalMarketProductGrid?.addEventListener('click', handleProductCardClick);
    elements.recentlyViewedGrid?.addEventListener('click', handleProductCardClick);

    // Click on details image in details modal to open lightbox
    elements.detailsImg?.addEventListener('click', () => {
        const productId = elements.detailsImg.dataset.productId;
        if (!productId) return;
        const product = cachedProducts[productId];
        if (product) {
            openProductImageLightbox(product);
        } else {
            // Fallback for cart/saved items details
            const fallbackProduct = {
                id: productId,
                images: [elements.detailsImg.src],
                name: elements.detailsName?.textContent || '',
                desc: elements.detailsDesc?.textContent || ''
            };
            openProductImageLightbox(fallbackProduct);
        }
    });

    // Handle "Show on Map" button click in General Market
    elements.generalMarketProductGrid?.addEventListener('click', (e) => {
        const mapBtn = e.target.closest('[data-action="show-on-map"]');
        if (mapBtn) {
            const ownerId = mapBtn.dataset.ownerId;
            const card = mapBtn.closest('.product-card');
            if (card) {
                const productId = card.dataset.id;
                addProductToRecentlyViewed(productId);
            }

            const profile = allUsersCache[ownerId]?.businessProfile;
            if (profile && profile.pickupLocations) {
                openShopLocationsMapModal(profile.pickupLocations, getBuyerLocation());
            }
        }
    });

    // Handle "View Shop" button click
    const handleViewShopClick = async (e) => {
        const viewShopBtn = e.target.closest('.add-to-cart-btn');
        if (viewShopBtn && !viewShopBtn.dataset.action) {
            const ownerId = viewShopBtn.dataset.productOwner;
            const card = viewShopBtn.closest('.product-card');
            if (card) {
                const productId = card.dataset.id;
                addProductToRecentlyViewed(productId);
            }

            const user = auth.currentUser;

            const originalContent = viewShopBtn.innerHTML;

            if (ownerId && user) {
                // Ensure we have the latest profiles to check privacy
                viewShopBtn.disabled = true;
                viewShopBtn.innerHTML = '<span class="spinner" style="border-top-color:white; width:12px; height:12px; margin:0;"></span> Checking...';

                const ownerProfile = await getUserProfile(ownerId);
                const currentUserProfile = await getUserProfile(user.uid);

                const isFriendSnap = await get(ref(db, `users/${user.uid}/customerList/${ownerId}`));
                const isContactOfSeller = isFriendSnap.exists();
                const isExcludedBySeller = !!(ownerProfile?.excludedContacts && ownerProfile.excludedContacts[user.uid]);
                const sellerWhoCanViewShop = ownerProfile?.whoCanViewShop || 'anyone';

                let blockReason = '';
                let showRequestBtn = true;

                if (ownerId === user.uid) {
                    blockReason = '';
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
                    viewShopBtn.disabled = false;
                    viewShopBtn.innerHTML = originalContent;

                    await openShopAccessRequestModal(ownerId, ownerProfile, blockReason, viewShopBtn, showRequestBtn);
                    return;
                }

                if (typeof window.setActiveShopSellerId === 'function') {
                    window.setActiveShopSellerId(ownerId);
                }

                // Simulate clicking on the chat item for that business owner
                // This will switch to chat view and open their shop
                await addToChatList(user.uid, ownerId);

                // Switch to Chat tab
                elements.chatsNav?.click();

                // Give the UI a moment to render the new conversation item in the sidebar
                setTimeout(() => {
                    const chatItem = document.querySelector(`[data-ui="chat-conversation-list"] .conversation-item[data-uid="${ownerId}"]`);
                    if (chatItem) {
                        chatItem.click();
                    }
                    // Activate shop mode on the chat area
                    if (typeof window.openShopMode === 'function') {
                        window.openShopMode();
                    } else {
                        elements.chatArea?.classList.add('shop-mode-active');
                    }

                    viewShopBtn.disabled = false;
                    viewShopBtn.innerHTML = originalContent;
                }, 300); // Increased delay to ensure Firebase listener updates the sidebar DOM
            }
        }
    };

    elements.generalMarketProductGrid?.addEventListener('click', handleViewShopClick);
    elements.recentlyViewedGrid?.addEventListener('click', handleViewShopClick);

    elements.addProductBtn?.addEventListener('click', (e) => {
        if (!isBusinessRegistered) {
            showToast("Please register your business first!", "warning");
            e.stopPropagation();
        } else {
            const today = new Date();
            const date = today.getDate(); // 1 to 31
            if (!currentUserSubscribed && date >= 20) {
                if (window.Capacitor) {
                    alert("To manage your seller account subscription, please use our web platform on a desktop or mobile browser.");
                } else {
                    alert("To manage your seller account subscription, please log into your dashboard on our web platform at hotmapp.shop using any mobile or desktop browser.");
                }
                return;
            }

            editingProductId = null;
            elements.addProductForm?.reset();
            if (elements.productImgData) elements.productImgData.value = '';
            renderPreviews([]);
            if (elements.productCustomCurrencyInput) elements.productCustomCurrencyInput.style.display = 'none';

            // Auto-fill category with business registration category
            if (elements.productCategoryInput && currentBusinessProfile?.category) {
                elements.productCategoryInput.value = currentBusinessProfile.category;
            }

            const modalTitle = elements.productModal?.querySelector('h3');
            if (modalTitle) modalTitle.textContent = 'Add New Product';
            if (elements.productModal) elements.productModal.style.display = 'flex';
        }
    });

    elements.storeBulkBtn?.addEventListener('click', () => toggleSelectMode(true));
    elements.storeCancelSelectionBtn?.addEventListener('click', () => toggleSelectMode(false));

    elements.storeSelectAllCheckbox?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleCards = Array.from(elements.productCards).filter(card => card.style.display !== 'none');

        if (isChecked) {
            visibleCards.forEach(card => selectedProductIds.add(card.dataset.id));
        } else {
            visibleCards.forEach(card => selectedProductIds.delete(card.dataset.id));
        }

        updateSelectionUI();
    });

    elements.storeMassSoldOutBtn?.addEventListener('click', async () => {
        if (selectedProductIds.size === 0) return;

        // Check if any selected product is high-value and currently available (being marked as on the way)
        let hasHighValueMarkingSoldOut = false;
        selectedProductIds.forEach(id => {
            const product = cachedProducts[id];
            if (product && !product.soldOut && parsePrice(product.price) >= HIGH_VALUE_THRESHOLD) {
                hasHighValueMarkingSoldOut = true;
            }
        });

        if (hasHighValueMarkingSoldOut) {
            if (!confirm("One or more high-value products are selected to be marked as on the way. Proceed?")) return;
        }

        const btn = elements.storeMassSoldOutBtn;
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Updating...';

            const updates = Array.from(selectedProductIds).map(id => {
                const product = cachedProducts[id];
                return saveProduct(id, { soldOut: !product?.soldOut });
            });

            await Promise.all(updates);
            showToast(`${selectedProductIds.size} products updated`, "info");
            toggleSelectMode(false);
        } catch (error) {
            showToast("Failed to update some products", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    elements.storeMassDeleteBtn?.addEventListener('click', async () => {
        if (selectedProductIds.size === 0) return;

        if (confirm(`Are you sure you want to delete ${selectedProductIds.size} products?`)) {
            const btn = elements.storeMassDeleteBtn;
            const originalText = btn.textContent;

            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Deleting...';

                const deletePromises = Array.from(selectedProductIds).map(id => {
                    const product = cachedProducts[id];
                    return deleteProduct(id, product?.images || []);
                });

                await Promise.all(deletePromises);
                showToast(`${selectedProductIds.size} products deleted`, "info");
                toggleSelectMode(false);
            } catch (error) {
                showToast("Failed to delete some products", "error");
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    });

    elements.closeModalBtn?.addEventListener('click', () => {
        if (elements.productModal) elements.productModal.style.display = 'none';
    });

    elements.productModal?.addEventListener('click', (e) => {
        if (e.target === elements.productModal) elements.productModal.style.display = 'none';
    });

    elements.productCurrencySelect?.addEventListener('change', (e) => {
        if (elements.productCustomCurrencyInput) {
            elements.productCustomCurrencyInput.style.display =
                e.target.value === 'custom' ? 'block' : 'none';
        }
    });

    elements.uploadProductBtn?.addEventListener('click', () => {
        elements.productFileInput?.click();
    });

    elements.productFileInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        let currentImages = [];
        try { currentImages = JSON.parse(elements.productImgData.value || '[]'); }
        catch (err) { currentImages = elements.productImgData.value ? [elements.productImgData.value] : []; }

        const validFiles = files.filter(file => {
            if (file.size > MAX_PRODUCT_IMG_SIZE) {
                showToast(`"${file.name}" is too large (max 5MB)`, "warning");
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        const readFiles = (index) => {
            if (index >= validFiles.length) {
                elements.productImgData.value = JSON.stringify(currentImages);
                renderPreviews(currentImages);
                return;
            }

            if (currentImages.length >= 5) {
                showToast("Maximum 5 images allowed.", "warning");
                elements.productImgData.value = JSON.stringify(currentImages);
                renderPreviews(currentImages);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImages.push(event.target.result);
                readFiles(index + 1);
            };
            reader.readAsDataURL(validFiles[index]);
        };

        readFiles(0);
    });

    elements.captureProductBtn?.addEventListener('click', () => {
        if (elements.cameraModal) elements.cameraModal.dataset.mode = 'photo-only';
        elements.cameraBtn?.click();
    });

    // Image Search Modal Handlers
    elements.searchWebImgBtn?.addEventListener('click', () => {
        if (elements.imageSearchModal) elements.imageSearchModal.style.display = 'flex';
        if (elements.imageSearchInput) {
            elements.imageSearchInput.value = '';
            elements.imageSearchInput.focus();
        }
        if (elements.imageSearchResults) elements.imageSearchResults.innerHTML = '';
        if (elements.imageSearchStatus) elements.imageSearchStatus.style.display = 'none';
    });

    const closeImageSearch = () => {
        if (elements.imageSearchModal) elements.imageSearchModal.style.display = 'none';
    };

    elements.closeImageSearchModalBtn?.addEventListener('click', closeImageSearch);
    elements.imageSearchModal?.addEventListener('click', (e) => {
        if (e.target === elements.imageSearchModal) closeImageSearch();
    });

    elements.openGoogleImagesBtn?.addEventListener('click', () => {
        const query = elements.imageSearchInput?.value?.trim() || '';
        const baseUrl = 'https://www.google.com/search?tbm=isch';
        const finalUrl = query ? `${baseUrl}&q=${encodeURIComponent(query)}` : 'https://images.google.com';
        if (elements.openGoogleImagesBtn) {
            elements.openGoogleImagesBtn.href = finalUrl;
        }
    });

    const performImageSearch = async () => {
        const query = elements.imageSearchInput?.value?.trim();
        if (!query) return showToast("Please enter a search term", "warning");

        if (elements.imageSearchStatus) {
            elements.imageSearchStatus.style.display = 'block';
            const statusText = elements.imageSearchStatus.querySelector('[data-ui="image-search-status-text"]');
            if (statusText) statusText.textContent = 'Searching free images...';
        }
        if (elements.imageSearchResults) elements.imageSearchResults.innerHTML = '';

        try {
            // Fetch from Wikimedia Commons API (CORS-friendly, no keys needed)
            const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=50&prop=imageinfo&iiprop=url&format=json&origin=*`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Search request failed");
            
            const data = await response.json();
            const pages = data.query?.pages || {};
            const urls = [];
            
            for (const id in pages) {
                const imgInfo = pages[id].imageinfo?.[0];
                if (imgInfo?.url) {
                    const ext = imgInfo.url.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        urls.push(imgInfo.url);
                    }
                }
            }

            if (elements.imageSearchStatus) elements.imageSearchStatus.style.display = 'none';

            if (urls.length === 0) {
                if (elements.imageSearchResults) {
                    elements.imageSearchResults.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--muted); padding: 20px;">No images found. Try a different search term.</div>';
                }
                return;
            }

            if (elements.imageSearchResults) {
                elements.imageSearchResults.innerHTML = urls.map(imgUrl => `
                    <div class="web-img-result-item" style="cursor: pointer; position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; border: 1px solid var(--border); transition: transform 0.2s;">
                        <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                        <div class="web-img-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;">
                            <i class="fa-solid fa-plus" style="color: white; font-size: 1.5rem;"></i>
                        </div>
                    </div>
                `).join('');

                const items = elements.imageSearchResults.querySelectorAll('.web-img-result-item');
                items.forEach(item => {
                    item.onmouseenter = () => {
                        item.style.transform = 'scale(1.05)';
                        item.querySelector('.web-img-overlay').style.opacity = '1';
                    };
                    item.onmouseleave = () => {
                        item.style.transform = 'scale(1)';
                        item.querySelector('.web-img-overlay').style.opacity = '0';
                    };
                    item.onclick = () => selectWebImage(item.querySelector('img').src, item);
                });
            }

        } catch (error) {
            console.error("Image search error:", error);
            if (elements.imageSearchStatus) elements.imageSearchStatus.style.display = 'none';
            showToast("Failed to search images.", "error");
        }
    };

    elements.imageSearchSubmitBtn?.addEventListener('click', performImageSearch);
    elements.imageSearchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performImageSearch();
    });

    const selectWebImage = async (imgUrl, itemElement) => {
        let currentImages = [];
        try {
            currentImages = JSON.parse(elements.productImgData.value || '[]');
        } catch (e) {
            currentImages = elements.productImgData.value ? [elements.productImgData.value] : [];
        }

        if (currentImages.length >= 5) {
            showToast("Maximum 5 images allowed.", "warning");
            closeImageSearch();
            return;
        }

        const overlay = itemElement.querySelector('.web-img-overlay');
        if (overlay) {
            overlay.innerHTML = '<span class="spinner" style="border-top-color: white; width: 20px; height: 20px; margin: 0;"></span>';
            overlay.style.opacity = '1';
        }

        try {
            const response = await fetch(imgUrl);
            if (!response.ok) throw new Error("Failed to download image");
            
            const blob = await response.blob();
            
            if (blob.size > MAX_PRODUCT_IMG_SIZE) {
                showToast("This image is too large (max 5MB)", "warning");
                if (overlay) overlay.innerHTML = '<i class="fa-solid fa-plus" style="color: white; font-size: 1.5rem;"></i>';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImages.push(event.target.result);
                elements.productImgData.value = JSON.stringify(currentImages);
                renderPreviews(currentImages);
                showToast("Image added!", "success");
                closeImageSearch();
            };
            reader.readAsDataURL(blob);

        } catch (err) {
            console.error("Error fetching web image:", err);
            showToast("Could not download image. Try another one.", "error");
            if (overlay) overlay.innerHTML = '<i class="fa-solid fa-plus" style="color: white; font-size: 1.5rem;"></i>';
        }
    };

    elements.pasteUrlImgBtn?.addEventListener('click', async () => {
        let currentImages = [];
        try {
            currentImages = JSON.parse(elements.productImgData.value || '[]');
        } catch (e) {
            currentImages = elements.productImgData.value ? [elements.productImgData.value] : [];
        }

        if (currentImages.length >= 5) {
            return showToast("Maximum 5 images allowed.", "warning");
        }

        const url = prompt("Paste the direct image URL from the internet:");
        if (!url) return;

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return showToast("Please enter a valid URL starting with http:// or https://", "warning");
        }

        showToast("Processing image URL...", "info");

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to download image");
            
            const blob = await response.blob();
            
            if (blob.size > MAX_PRODUCT_IMG_SIZE) {
                showToast("This image is too large (max 5MB)", "warning");
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImages.push(event.target.result);
                elements.productImgData.value = JSON.stringify(currentImages);
                renderPreviews(currentImages);
                showToast("Image added successfully!", "success");
            };
            reader.readAsDataURL(blob);

        } catch (err) {
            console.warn("CORS fetch failed, using original direct URL:", err);
            // Fallback: Hotlink the URL directly if CORS blocks downloading
            currentImages.push(url);
            elements.productImgData.value = JSON.stringify(currentImages);
            renderPreviews(currentImages);
            showToast("Added image via direct link!", "info");
        }
    });

    elements.productImgPreview?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-img-btn');
        if (!removeBtn) return;

        const item = removeBtn.closest('.preview-item');
        const index = parseInt(item.dataset.index);

        let currentImages = [];
        try {
            currentImages = JSON.parse(elements.productImgData.value || '[]');
        } catch (err) {
            currentImages = elements.productImgData.value ? [elements.productImgData.value] : [];
        }

        currentImages.splice(index, 1);
        elements.productImgData.value = JSON.stringify(currentImages);
        renderPreviews(currentImages);
    });

    // Lightbox Controls
    elements.lightboxClose?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.lightboxModal.style.display = 'none';
    });

    elements.lightboxHeader?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    elements.lightboxActions?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    elements.lightboxPrev?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.currentLightboxIndex = (window.currentLightboxIndex - 1 + window.currentLightboxImages.length) % window.currentLightboxImages.length;
        updateLightboxImage();
    });

    elements.lightboxNext?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.currentLightboxIndex = (window.currentLightboxIndex + 1) % window.currentLightboxImages.length;
        updateLightboxImage();
    });

    // Touch swipe gestures on Lightbox Modal for easy sliding through images
    let lightboxTouchStartX = 0;
    let lightboxTouchStartY = 0;

    elements.lightboxModal?.addEventListener('touchstart', (e) => {
        if (!window.currentLightboxImages || window.currentLightboxImages.length <= 1) return;
        const touch = e.touches[0];
        lightboxTouchStartX = touch.clientX;
        lightboxTouchStartY = touch.clientY;
    }, { passive: true });

    elements.lightboxModal?.addEventListener('touchend', (e) => {
        if (!window.currentLightboxImages || window.currentLightboxImages.length <= 1) return;
        const touch = e.changedTouches[0];
        const diffX = touch.clientX - lightboxTouchStartX;
        const diffY = touch.clientY - lightboxTouchStartY;

        // Check horizontal swipe threshold (50px) and compare with vertical motion
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            e.stopPropagation();
            if (diffX > 0) {
                // Swipe Right -> Previous image
                window.currentLightboxIndex = (window.currentLightboxIndex - 1 + window.currentLightboxImages.length) % window.currentLightboxImages.length;
            } else {
                // Swipe Left -> Next image
                window.currentLightboxIndex = (window.currentLightboxIndex + 1) % window.currentLightboxImages.length;
            }
            updateLightboxImage();
        }
    }, { passive: true });

    elements.lightboxModal?.addEventListener('click', (e) => {
        const isHeaderHidden = !elements.lightboxHeader || elements.lightboxHeader.style.display === 'none';
        if (isHeaderHidden) {
            elements.lightboxModal.style.display = 'none';
        } else {
            if (e.target === elements.lightboxModal) elements.lightboxModal.style.display = 'none';
        }
    });

    elements.cancelDeleteProductBtn?.addEventListener('click', () => {
        if (elements.deleteProductModal) elements.deleteProductModal.style.display = 'none';
        productToDelete = null;
    });

    elements.confirmDeleteProductBtn?.addEventListener('click', async () => {
        if (!productToDelete) return;

        const btn = elements.confirmDeleteProductBtn;
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Deleting...';

            await deleteProduct(productToDelete.id, productToDelete.images);
            showToast("Product deleted successfully", "info");
            if (elements.deleteProductModal) elements.deleteProductModal.style.display = 'none';
        } catch (error) {
            showToast("Failed to delete product", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            productToDelete = null;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (elements.lightboxModal?.style.display !== 'flex') return;

        if (e.key === 'ArrowLeft') {
            currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
            updateLightboxImage();
        } else if (e.key === 'ArrowRight') {
            currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
            updateLightboxImage();
        } else if (e.key === 'Escape') {
            elements.lightboxModal.style.display = 'none';
        }
    });

    elements.productGrid?.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;

        if (isSelectMode) {
            const productId = card.dataset.id;
            selectedProductIds.has(productId) ? selectedProductIds.delete(productId) : selectedProductIds.add(productId);
            updateSelectionUI();
            return;
        }

        const isBadge = e.target.closest('.gallery-badge');
        const isImg = e.target.closest('.product-img');

        if (isBadge || isImg) {
            const productId = card.dataset.id;
            const product = cachedProducts[productId];
            if (product) {
                openProductImageLightbox(product);
                return;
            }
        } else if (e.target.closest('.toggle-sold-out-btn')) {
            const isSoldOut = card.dataset.soldOut === 'true';
            const productId = card.dataset.id;

            // Add confirmation for high-value products when marking as on the way
            if (!isSoldOut) {
                const product = cachedProducts[productId];
                if (product && parsePrice(product.price) >= HIGH_VALUE_THRESHOLD) {
                    const confirmed = confirm(`This is a high-value product (${product.currency}${parsePrice(product.price).toFixed(2)}). Are you sure you want to mark it as on the way?`);
                    if (!confirmed) return;
                }
            }

            // Update only the soldOut status in the database
            saveProduct(productId, { soldOut: !isSoldOut }).then(() => {
                showToast(isSoldOut ? "Product is now available" : "Product marked as on the way", "info");
            });
        } else if (e.target.closest('.delete-product-card-btn')) {
            const productId = card.dataset.id;
            const images = JSON.parse(card.getAttribute('data-images') || '[]');
            const name = card.querySelector('.product-name').textContent;

            if (elements.deleteProductPreviewImg) elements.deleteProductPreviewImg.src = images[0] || '';
            if (elements.deleteProductName) elements.deleteProductName.textContent = name;

            productToDelete = { id: productId, images };
            if (elements.deleteProductModal) elements.deleteProductModal.style.display = 'flex';
        } else if (e.target.closest('.edit-product-card-btn')) {
            editingProductId = card.dataset.id;

            const name = card.querySelector('.product-name').textContent;
            const product = cachedProducts[editingProductId];
            const desc = card.querySelector('.product-desc').textContent;
            const formValue = product ? product.form : card.querySelector('.product-form').textContent.replace(/^Form:\s*/i, '');
            const qtyValue = product ? product.qty : card.querySelector('.product-quantity').textContent.replace(/^Quantity:\s*/i, '');
            const storeQtyValue = product ? (product.storeQty || 0) : 0;
            const priceText = card.querySelector('.product-price').textContent;
            const currencySymbol = priceText.match(/^[^0-9]*/)[0] || '$';
            const priceValue = priceText.slice(currencySymbol.length);
            const imgUrl = card.querySelector('.product-img').src;
            const cardImagesAttr = card.getAttribute('data-images');

            let images = [];
            if (cardImagesAttr) {
                try { images = JSON.parse(cardImagesAttr); } catch (e) { images = [imgUrl]; }
            } else {
                images = [imgUrl];
            }

            const form = elements.addProductForm;
            form['name'].value = name;
            if (form['category']) form['category'].value = product?.category || '';
            form['desc'].value = desc;
            form['form'].value = formValue;
            form['qty'].value = qtyValue || '';
            if (form['store_qty']) form['store_qty'].value = storeQtyValue || '';

            const hasPreset = Array.from(elements.productCurrencySelect?.options || [])
                .some(opt => opt.value === currencySymbol);

            if (hasPreset) {
                form['currency'].value = currencySymbol;
                elements.productCustomCurrencyInput.style.display = 'none';
            } else {
                form['currency'].value = 'custom';
                form['custom_currency'].value = currencySymbol;
                elements.productCustomCurrencyInput.style.display = 'block';
            }

            form['price'].value = formatNumberWithCommas(priceValue);
            elements.productImgData.value = JSON.stringify(images);
            renderPreviews(images);

            const modalTitle = elements.productModal?.querySelector('h3');
            if (modalTitle) modalTitle.textContent = 'Edit Product';
            if (elements.productModal) elements.productModal.style.display = 'flex';
        }
    });

    elements.addProductForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return showToast("User not authenticated", "error");

        if (!editingProductId) {
            const today = new Date();
            const date = today.getDate();
            if (!currentUserSubscribed && date >= 20) {
                if (window.Capacitor) {
                    alert("To manage your seller account subscription, please use our web platform on a desktop or mobile browser.");
                } else {
                    alert("To manage your seller account subscription, please log into your dashboard on our web platform at hotmapp.shop using any mobile or desktop browser.");
                }
                return;
            }
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const category = formData.get('category');
        const desc = formData.get('desc');
        const form = formData.get('form');
        const cleanNumber = (val) => val ? String(val).replace(/,/g, '') : '';
        const qty = formData.get('qty') || '';
        const storeQty = formData.get('store_qty') || '';
        let currency = formData.get('currency');
        if (currency === 'custom') currency = formData.get('custom_currency') || '';
        const price = cleanNumber(formData.get('price'));
        const imagesJson = formData.get('img_data');
        let images = [];
        try { images = JSON.parse(imagesJson || '[]'); } catch (e) { images = imagesJson ? [imagesJson] : []; }

        if (images.length < 2) return showToast("Please upload at least 2 images.", "warning");

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Saving...';

            // 1. Upload new images to Storage first
            const hasNewImages = images.some(img => img.startsWith('data:') || img.startsWith('blob:'));
            const progressContainer = hasNewImages ? document.createElement('div') : null;
            if (progressContainer) {
                progressContainer.className = 'product-uploads-container';
                elements.productModal?.querySelector('.modal-content')?.appendChild(progressContainer);
            }

            const finalImageUrls = await Promise.all(images.map(async (img, idx) => {
                if (img.startsWith('data:') || img.startsWith('blob:')) {
                    const progressRow = document.createElement('div');
                    progressRow.className = 'upload-progress-row';
                    progressRow.innerHTML = `
                        <div class="progress-text">Uploading image ${idx + 1}...</div>
                        <div class="progress-bar"><div class="progress-bar-fill"></div></div>
                    `;
                    progressContainer.appendChild(progressRow);
                    const fill = progressRow.querySelector('.progress-bar-fill');

                    // Compress the image before converting to Blob and uploading
                    let blob;
                    if (img.startsWith('blob:')) {
                        const resp = await fetch(img);
                        blob = await resp.blob();
                    } else {
                        blob = await compressImage(img);
                    }
                    const path = `products/${Date.now()}_${idx}.jpg`;
                    return await uploadFile(path, blob, (progress) => {
                        if (fill) fill.style.width = `${progress}%`;
                    });
                }
                return img; // Keep existing URLs
            }));

            if (progressContainer) progressContainer.remove();

            // 1.5. Clean up old images if we are updating and images were removed from the selection
            if (editingProductId) {
                const oldProduct = cachedProducts[editingProductId];
                if (oldProduct && oldProduct.images) {
                    const removedImages = oldProduct.images.filter(url => !finalImageUrls.includes(url));
                    await Promise.all(removedImages.map(url => deleteFile(url)));
                }
            }

            // 2. Save metadata to Realtime Database
            const productData = {
                name,
                category,
                desc,
                form,
                qty: qty,
                currency,
                price: parsePrice(price) || 0,
                images: finalImageUrls,
                ownerId: user.uid, // Indicate the owner
                storeQty: storeQty
            };

            const savedProductId = await saveProduct(editingProductId, productData);
            cachedProducts[savedProductId] = {
                ...productData,
                id: savedProductId,
                ownerId: user.uid
            };
            refreshStoreGrids();

            showToast(editingProductId ? "Product updated!" : "Product added!", "success");
            if (elements.productModal) elements.productModal.style.display = 'none';
            if (elements.productImgData) elements.productImgData.value = '';
            renderPreviews([]);
            e.target.reset();
            editingProductId = null;
        } catch (error) {
            console.error("Save Error:", error);
            showToast("Failed to save product.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = editingProductId ? 'Update Product' : 'Add Product';
        }
    });

    // --- Business Registration dynamic logic (handles both Modal and Landing Page) ---

    document.querySelectorAll('[data-ui="service-type"]').forEach(select => {
        select.addEventListener('change', async (e) => {
            const type = e.target.value;
            const form = e.target.closest('form');
            const pickupSec = form.querySelector('[data-ui="pickup-locations-section"]');
            const deliverySec = form.querySelector('[data-ui="delivery-coverage-section"]');

            if (pickupSec) pickupSec.style.display = type ? 'block' : 'none'; // Pickup section is mandatory for all service types
            if (deliverySec) { // Delivery section visibility
                deliverySec.style.display = (type === 'delivery' || type === 'both') ? 'block' : 'none';
                if (type === 'delivery' || type === 'both') {
                    refreshStatesList(form);
                }
            }
        });
    });

    // Handle the new Button Group for Delivery Coverage Type
    document.querySelectorAll('[data-ui="delivery-type-button-group"]').forEach(group => {
        group.addEventListener('click', (e) => {
            const btn = e.target.closest('.type-btn');
            if (!btn) return;

            const val = btn.dataset.value;
            const form = group.closest('form');
            const hiddenInput = form.querySelector('[data-ui="delivery-coverage-type"]');

            // Update visual state of buttons
            group.querySelectorAll('.type-btn').forEach(b => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.style.background = isActive ? 'var(--brand)' : 'white';
                b.style.color = isActive ? 'white' : 'var(--text)';
                b.style.borderColor = isActive ? 'var(--brand)' : 'var(--border)';
            });

            // Update hidden input and trigger change
            if (hiddenInput) {
                hiddenInput.value = val;
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });

    document.querySelectorAll('[data-ui="business-country"]').forEach(select => {
        select.addEventListener('change', async (e) => { // Made async to await fetchStatesForCountry
            const form = e.target.closest('form');
            const isPopulating = form.dataset.populating === "true";

            const countryCode = e.target.value;
            if (!isPopulating) {
                const coverageType = form.querySelector('[data-ui="delivery-coverage-type"]');
                if (coverageType) {
                    coverageType.value = '';
                    coverageType.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Reset Coverage Type buttons to inactive state
                const typeGroup = form.querySelector('[data-ui="delivery-type-button-group"]');
                if (typeGroup) {
                    typeGroup.querySelectorAll('.type-btn').forEach(b => {
                        b.classList.remove('active');
                        b.style.background = 'white';
                        b.style.color = 'var(--text)';
                        b.style.borderColor = 'var(--border)';
                    });
                }

                // Clear hidden inputs for multi-selects
                const countriesInput = form.querySelector('[data-ui="delivery-countries"]');
                const statesInput = form.querySelector('[data-ui="delivery-states"]');
                const citiesInput = form.querySelector('[data-ui="delivery-cities"]');
                if (countriesInput) { countriesInput.value = '[]'; }
                if (statesInput) { statesInput.value = '[]'; statesInput.dispatchEvent(new Event('change')); }
                if (citiesInput) { citiesInput.value = '[]'; }

                const countriesSec = form.querySelector('[data-ui="delivery-countries-section"]');
                const statesSec = form.querySelector('[data-ui="delivery-states-section"]');
                const citiesSec = form.querySelector('[data-ui="delivery-cities-section"]');
                if (countriesSec) countriesSec.style.display = 'none';
                if (statesSec) statesSec.style.display = 'none';
                if (citiesSec) citiesSec.style.display = 'none'; // Always hide cities when country changes
            }

            // Refresh the states list for the new country
            refreshStatesList(form);
        });
    });

    document.querySelectorAll('[data-ui="delivery-coverage-type"]').forEach(select => {
        select.addEventListener('change', async (e) => {
            const type = e.target.value;
            const form = e.target.closest('form');
            const isPopulating = form.dataset.populating === "true";
            const country = form.querySelector('[data-ui="business-country"]')?.value;
            const countriesSec = form.querySelector('[data-ui="delivery-countries-section"]'); // Section visibility
            const statesSec = form.querySelector('[data-ui="delivery-states-section"]'); // Section visibility
            const citiesSec = form.querySelector('[data-ui="delivery-cities-section"]'); // Section visibility
            const countriesWrapper = form.querySelector('[data-ui="countries-picker-wrapper"]');
            const statesWrapper = form.querySelector('[data-ui="states-picker-wrapper"]'); // For setupMultiSelect
            const citiesWrapper = form.querySelector('[data-ui="cities-picker-wrapper"]'); // For setupMultiSelect

            if (countriesSec) countriesSec.style.display = (type === 'country') ? 'block' : 'none';
            if (statesSec) statesSec.style.display = (type === 'states' || type === 'cities') ? 'block' : 'none'; // Show states section if type is states or cities
            if (citiesSec) citiesSec.style.display = (type === 'cities') ? 'block' : 'none'; // Show cities section only if type is cities

            if (type === 'country') {
                if (countriesWrapper) setupMultiSelect(countriesWrapper, []);
                if (!isPopulating) {
                    if (statesWrapper) setupMultiSelect(statesWrapper, []);
                    if (citiesWrapper) setupMultiSelect(citiesWrapper, []);
                }
            } else if (type === 'states' || type === 'cities') {
                if (!isPopulating) {
                    if (countriesWrapper) setupMultiSelect(countriesWrapper, []);
                }
                refreshStatesList(form);

                if (type === 'cities') {
                    refreshCitiesList(form);
                } else {
                    // If switching to 'states' only, clear cities unless populating
                    if (!isPopulating && citiesWrapper) setupMultiSelect(citiesWrapper, []);
                }
            } else {
                // If coverage type is other, clear selections unless populating
                if (!isPopulating) {
                    if (countriesWrapper) setupMultiSelect(countriesWrapper, []);
                    if (statesWrapper) setupMultiSelect(statesWrapper, []);
                    if (citiesWrapper) setupMultiSelect(citiesWrapper, []);
                }
            }
        });
    });

    document.querySelectorAll('[data-ui="delivery-states"]').forEach(input => {
        input.addEventListener('change', (e) => refreshCitiesList(e.target.closest('form')));
    });

    // Attach listeners to all instances of registration buttons (Landing Page and Modal)
    document.querySelectorAll('[data-ui="add-pickup-location-btn"]').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Add Pickup Location button clicked!'); // Debug log
            openBusinessLocationPicker('pickup'); // Only pickup uses map picker now
        });
    });


    elements.closeBusinessLocationPickerModalBtn?.addEventListener('click', () => {
        if (elements.businessLocationPickerModal) {
            elements.businessLocationPickerModal.style.display = 'none';
            // Clear search results when closing
            if (elements.businessLocationSearchResults) {
                elements.businessLocationSearchResults.innerHTML = '';
                elements.businessLocationSearchResults.style.display = 'none';
            }
            // Clear search input
            if (elements.businessLocationSearchInput) elements.businessLocationSearchInput.value = '';
            delete elements.businessLocationPickerModal.dataset.mode;
        }
        if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
    });

    elements.confirmBusinessLocationBtn?.addEventListener('click', handleConfirmLocationSelection);

    // Add event listeners to clear validation glow on user input
    elements.businessRegistrationModal?.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', () => {
            const uiKey = field.dataset.ui;
            const targetEl = field.closest('[data-ui$="-picker-wrapper"]') || field; // For custom selects, target the wrapper
            const trigger = targetEl.querySelector('[data-ui$="-trigger"]'); // For custom selects, target the trigger button

            targetEl.classList.remove('invalid', 'valid', 'input-shake');
            if (trigger) trigger.classList.remove('invalid', 'valid', 'input-shake');
            const errorEl = field.closest('.form-group')?.querySelector(`[data-ui="${uiKey}-error"]`);
            if (errorEl) errorEl.textContent = '';
        });
    });
    // --- Business Registration Wizard Navigation ---
    const showStep = (stepNum) => {
        currentWizardStep = stepNum;
        elements.wizardSteps.forEach(step => {
            step.style.display = 'none';
            step.classList.remove('active');
        });
        const targetStep = document.querySelector(`[data-ui="wizard-step-${stepNum}"]`);
        if (targetStep) {
            targetStep.style.display = 'block';
            targetStep.classList.add('active');
            // Scroll to top of modal content when changing steps
            elements.businessRegistrationModal?.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });
        } 

        elements.progressSteps.forEach(pStep => {
            const step = parseInt(pStep.dataset.step);
            pStep.classList.toggle('active', step === stepNum);
            pStep.classList.toggle('completed', step < stepNum);
        });

        // Update progress bar percentage
        if (elements.wizardProgressBarFill) {
            const totalSteps = elements.wizardSteps.length || 3;
            elements.wizardProgressBarFill.style.width = `${(stepNum / totalSteps) * 100}%`;
            elements.wizardProgressBarFill.classList.remove('warning'); // Reset color when moving to a new step
        }

        if (stepNum === 3) {
            // Populate review content for step 3
            // This needs to be called every time we enter step 3 to get the latest form data
            prepareRegistrationData();
            populateReviewContent();
        }
    };

    const validateStep = (stepNum) => {
        const form = elements.businessRegistrationModal?.querySelector('form');
        if (!form) return false;

        let isValid = true;
        const stepFields = form.querySelectorAll(`[data-ui="wizard-step-${stepNum}"] [required], [data-ui="wizard-step-${stepNum}"] input, [data-ui="wizard-step-${stepNum}"] select, [data-ui="wizard-step-${stepNum}"] textarea`);

        stepFields.forEach(field => {
            // Clear previous errors
            const uiKey = field.dataset.ui;
            const errorEl = form.querySelector(`[data-ui="${uiKey}-error"]`);
            const targetEl = form.querySelector(`[data-ui="${uiKey}-trigger"]`) || field;

            if (errorEl) errorEl.textContent = '';
            targetEl.classList.remove('invalid', 'valid', 'input-shake');
            void targetEl.offsetWidth; // Reflow to allow re-triggering animation

            let isFieldValid = true;
            if (field.hasAttribute('required') && !field.value.trim()) {
                isFieldValid = false;
                isValid = false;
                targetEl.classList.add('invalid', 'input-shake');
                if (errorEl) errorEl.textContent = `${field.labels?.[0]?.textContent || field.placeholder || field.name} is required.`;
            } else if (uiKey === 'business-country' && (!field.value || field.value === '')) {
                isFieldValid = false;
                isValid = false;
                targetEl.classList.add('invalid', 'input-shake');
                if (errorEl) errorEl.textContent = "Country is required.";
            }

            if (isFieldValid) targetEl.classList.add('valid');
        });

        // Specific validation for step 1
        if (stepNum === 1) {
            const serviceType = form.querySelector('[data-ui="service-type"]')?.value;
            if (!serviceType) {
                isValid = false;
                const errorEl = form.querySelector('[data-ui="service-type-error"]');
                if (errorEl) errorEl.textContent = "Service Type is required.";
            }
        }

        // Specific validation for step 2
        if (stepNum === 2) {
            const serviceType = form.querySelector('[data-ui="service-type"]')?.value;
            const pickupBtn = form.querySelector('[data-ui="add-pickup-location-btn"]');
            const pickupError = form.querySelector('[data-ui="pickup-location-error"]');
            if (pickupBtn) pickupBtn.classList.remove('invalid', 'valid', 'input-shake');
            if (pickupError) pickupError.textContent = "";

            if (pickupLocations.length === 0) {
                showToast("Please add at least one pickup location.", "error");
                isValid = false;
                if (pickupBtn) { void pickupBtn.offsetWidth; pickupBtn.classList.add('invalid', 'input-shake'); }
                if (pickupError) pickupError.textContent = "Please add at least one pickup location.";
            } else if (pickupBtn) {
                pickupBtn.classList.add('valid');
            }

            const coverageType = form.querySelector('[data-ui="delivery-coverage-type"]')?.value;
            const deliveryCountries = JSON.parse(form.querySelector('[data-ui="delivery-countries"]')?.value || '[]');
            const deliveryStates = JSON.parse(form.querySelector('[data-ui="delivery-states"]')?.value || '[]');
            const deliveryCities = JSON.parse(form.querySelector('[data-ui="delivery-cities"]')?.value || '[]');

            const countriesTrigger = form.querySelector('[data-ui="countries-trigger"]');
            const statesTrigger = form.querySelector('[data-ui="states-trigger"]');
            const citiesTrigger = form.querySelector('[data-ui="cities-trigger"]');
            const deliveryCoverageError = form.querySelector('[data-ui="delivery-coverage-error"]');
            if (countriesTrigger) countriesTrigger.classList.remove('invalid', 'valid', 'input-shake');
            if (statesTrigger) statesTrigger.classList.remove('invalid', 'valid', 'input-shake');
            if (citiesTrigger) citiesTrigger.classList.remove('invalid', 'valid', 'input-shake');
            if (deliveryCoverageError) deliveryCoverageError.textContent = "";

            if (serviceType === 'delivery' || serviceType === 'both') {
                if (!coverageType || coverageType === "") {
                    showToast("Please select a delivery coverage type.", "error");
                    isValid = false;
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select a delivery coverage type.";
                } else if (coverageType === 'country' && deliveryCountries.length === 0) {
                    showToast("Please select at least one country for delivery coverage.", "error");
                    isValid = false;
                    if (countriesTrigger) { void countriesTrigger.offsetWidth; countriesTrigger.classList.add('invalid', 'input-shake'); }
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one country.";
                } else if (countriesTrigger && coverageType === 'country') {
                    countriesTrigger.classList.add('valid');
                } else if (coverageType === 'states' && deliveryStates.length === 0) {
                    showToast("Please select at least one state for delivery coverage.", "error");
                    isValid = false;
                    if (statesTrigger) { void statesTrigger.offsetWidth; statesTrigger.classList.add('invalid', 'input-shake'); }
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one state.";
                } else if (statesTrigger && coverageType === 'states') {
                    statesTrigger.classList.add('valid');
                } else if (coverageType === 'cities' && deliveryCities.length === 0) {
                    showToast("Please select at least one city for delivery coverage.", "error");
                    isValid = false;
                    if (citiesTrigger) { void citiesTrigger.offsetWidth; citiesTrigger.classList.add('invalid', 'input-shake'); }
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one city.";
                } else if (citiesTrigger && coverageType === 'cities') {
                    citiesTrigger.classList.add('valid');
                }
            }
        }

        if (!isValid) {
            showToast("Please fill in all required fields correctly.", "error");
            elements.wizardProgressBarFill?.classList.add('warning'); // Turn bar yellow on error
        } else {
            elements.wizardProgressBarFill?.classList.remove('warning');
        }
        return isValid;
    };

    elements.skipToReviewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Validate current step before jumping to ensure no invalid partial changes
            if (validateStep(currentWizardStep)) {
                showStep(3);
            }
        });
    });

    elements.nextStepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentWizardStep)) {
                const nextStep = parseInt(btn.dataset.targetStep);
                showStep(nextStep);
            }
        });
    });
    
    elements.prevStepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = parseInt(btn.dataset.targetStep);
            showStep(prevStep);
        });
    });

    const performBusinessLocationSearch = debounce(async (query) => {
        if (query.length < 3) {
            if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
            return;
        }
        if (elements.businessLocationSearchResults) {
            elements.businessLocationSearchResults.innerHTML = '<div style="padding:10px 15px; color:var(--muted); font-size:0.85rem;"><span class="spinner" style="border-top-color:var(--brand); width:14px; height:14px; margin:0 8px 0 0;"></span>Searching...</div>';
            elements.businessLocationSearchResults.style.display = 'block';
        }
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const results = await response.json();
            const container = elements.businessLocationSearchResults;
            if (!container) return;

            if (results.length === 0) {
                container.innerHTML = '<div class="location-search-results-item" style="padding:10px 15px; color:var(--muted); font-size:0.85rem;">No results found</div>';
            } else {
                container.innerHTML = results.map(res => `
                    <div class="location-search-results-item" data-lat="${res.lat}" data-lon="${res.lon}">
                        <i class="fa-solid fa-location-dot" style="color: var(--muted);"></i>
                        <span>${res.display_name}</span>
                    </div>
                `).join('');
            }
            container.style.display = 'block';
        } catch (err) { console.error("Business location search error:", err); }
    }, 500); // Debounce delay for business location search

    elements.businessLocationSearchInput?.addEventListener('input', (e) => {
        performBusinessLocationSearch(e.target.value.trim());
    });

    elements.businessLocationSearchResults?.addEventListener('click', (e) => {
        const item = e.target.closest('.location-search-results-item');
        if (!item || !item.dataset.lat) return;
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        if (businessLocationMap && businessLocationMarker) {
            businessLocationMap.setView([lat, lon], 15);
            businessLocationMarker.setLatLng([lat, lon]);
        }
        if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
        if (elements.businessLocationSearchInput) elements.businessLocationSearchInput.value = item.querySelector('span').textContent;
    });

    elements.businessUseCurrentLocationBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "error");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (businessLocationMap && businessLocationMarker) {
                    businessLocationMap.setView([latitude, longitude], 15);
                    businessLocationMarker.setLatLng([latitude, longitude]);
                }
                showToast("Map recentered to your location", "info");
            },
            (error) => showToast("Unable to retrieve current location. Check permissions.", "error")
        );
    });

    // Unified Event delegation for all instances of location lists
    document.querySelectorAll('[data-ui="pickup-locations-list"]').forEach(list => { // Only pickup locations have a list now
        list.addEventListener('click', handleLocationUiEvent);
    });

    // Business Registration Form Submission (Handles both Modal and Landing Page)
    document.querySelectorAll('[data-ui="business-registration-form"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return showToast("User not authenticated", "error");


            const companyName = form.querySelector('[data-ui="company-name"]')?.value.trim();
            const country = form.querySelector('[data-ui="business-country"]')?.value;
            const serviceType = form.querySelector('[data-ui="service-type"]')?.value;
            const category = form.querySelector('[data-ui="business-category"]')?.value;
            const deliveryFee = parsePrice(form.querySelector('[data-ui="delivery-fee"]')?.value || 0);
            const minFreeDelivery = parsePrice(form.querySelector('[data-ui="min-free-delivery"]')?.value || 0);

            // The pickupAddress field was removed in a previous step to unify location management
            // All pickup locations are now managed via the map picker.
            // const pickupAddress = form.querySelector('[data-ui="pickup-address"]')?.value.trim();

            const companyNameError = form.querySelector('[data-ui="company-name-error"]');
            const countryError = form.querySelector('[data-ui="business-country-error"]');
            const serviceTypeError = form.querySelector('[data-ui="service-type-error"]');
            const pickupAddressError = form.querySelector('[data-ui="pickup-address-error"]');

            let isValid = true;
            if (!companyName) { if (companyNameError) companyNameError.textContent = "Company Name is required"; isValid = false; } else { if (companyNameError) companyNameError.textContent = ""; }
            if (!country || country === "") { if (countryError) countryError.textContent = "Business base is required"; isValid = false; } else { if (countryError) countryError.textContent = ""; }
            if (!serviceType) { if (serviceTypeError) serviceTypeError.textContent = "Service Type is required"; isValid = false; } else { if (serviceTypeError) serviceTypeError.textContent = ""; }

            const pickupError = form.querySelector('[data-ui="pickup-location-error"]');
            const deliveryCoverageError = form.querySelector('[data-ui="delivery-coverage-error"]');
            if (pickupError) pickupError.textContent = "";
            if (deliveryCoverageError) deliveryCoverageError.textContent = "";

            if (pickupLocations.length === 0) {
                showToast("Please add at least one pickup location.", "error");
                if (pickupError) pickupError.textContent = "Please add at least one pickup location.";
                return;
            }
            const coverageType = form.querySelector('[data-ui="delivery-coverage-type"]')?.value;
            const deliveryCountries = JSON.parse(form.querySelector('[data-ui="delivery-countries"]')?.value || '[]');
            const deliveryStates = JSON.parse(form.querySelector('[data-ui="delivery-states"]')?.value || '[]');
            const deliveryCities = JSON.parse(form.querySelector('[data-ui="delivery-cities"]')?.value || '[]');

            if (serviceType === 'delivery' || serviceType === 'both') {
                if (!coverageType || coverageType === "") {
                    showToast("Please select a delivery coverage type.", "error");
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select a delivery coverage type.";
                    return;
                }
                if (coverageType === 'country' && deliveryCountries.length === 0) {
                    showToast("Please select at least one country for delivery coverage.", "error");
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one country.";
                    return;
                }
                if (coverageType === 'states' && deliveryStates.length === 0) {
                    showToast("Please select at least one state for delivery coverage.", "error");
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one state.";
                    return;
                }
                if (coverageType === 'cities' && deliveryCities.length === 0) {
                    showToast("Please select at least one city for delivery coverage.", "error");
                    if (deliveryCoverageError) deliveryCoverageError.textContent = "Please select at least one city.";
                    return;
                }
            }

            if (!isValid) { showToast("Please fill in all required fields.", "error"); return; }

            prepareRegistrationData(form);
            
            // If we reach here, it means it's the final step (Step 3) and validation passed.
            // Proceed with registration.
            // The submit button is now directly the "Register Business" button on Step 3.

            // Original logic from confirmRegistrationBtn
            const btn = e.submitter; // Get the button that triggered the submit
            if (!btn) return;

            const originalContent = btn.innerHTML;

            if (!pendingBusinessRegistrationData) return;
            try {
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner"></span> ${isEditingBusinessProfile ? 'Updating...' : 'Registering...'}`;
                if (elements.closeBusinessRegistrationModalBtn) elements.closeBusinessRegistrationModalBtn.style.display = 'none'; // Hide close button during submission

                if (pendingLogoBlob) {
                    const logoPath = `business_logos/${user.uid}.jpg`;
                    const logoUrl = await uploadFile(logoPath, pendingLogoBlob);
                    pendingBusinessRegistrationData.logoUrl = logoUrl;
                } else if (isEditingBusinessProfile && currentBusinessProfile?.logoUrl) {
                    pendingBusinessRegistrationData.logoUrl = currentBusinessProfile.logoUrl;
                }

                await saveBusinessProfile(user.uid, pendingBusinessRegistrationData);
                await updateUserProfile(user.uid, { isBusinessRegistered: true }); // Mark user as registered

                isBusinessRegistered = true;
                currentBusinessProfile = pendingBusinessRegistrationData; // Update current profile
                showToast(isEditingBusinessProfile ? "Business profile updated!" : "Business registered successfully!", "success");

                // Directly update view and re-enable navigation
                if (elements.businessRegistrationView) elements.businessRegistrationView.style.display = 'none';
                if (elements.storeManagementView) elements.storeManagementView.style.display = 'block';
                document.querySelectorAll('.navbar .nav-item').forEach(item => { item.classList.remove('disabled'); });
                refreshStoreGrids(); // Render products

                if (elements.businessRegistrationConfirmationModal) elements.businessRegistrationConfirmationModal.style.display = 'none'; // Close confirmation modal
                if (elements.businessRegistrationModal) elements.businessRegistrationModal.style.display = 'none'; // Close main registration modal
            } catch (error) {
                console.error("Business Registration Error:", error);
                showToast(`${isEditingBusinessProfile ? 'Update' : 'Registration'} failed. Please check your connection and try again.`, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                if (elements.closeBusinessRegistrationModalBtn) elements.closeBusinessRegistrationModalBtn.style.display = 'block'; // Re-show if editing
                pendingBusinessRegistrationData = null; 
                isEditingBusinessProfile = false; // Reset flag
                elements.skipToReviewBtns.forEach(btn => btn.style.display = 'none');
                showStep(1); // Reset wizard to first step
            }
        });
    });

    elements.closeBusinessRegistrationModalBtn?.addEventListener('click', () => {
        if (elements.businessRegistrationModal) elements.businessRegistrationModal.style.display = 'none';
    });

    // Shop Access Request Modal Listeners
    elements.closeShopAccessModalBtn?.addEventListener('click', () => {
        if (elements.shopAccessModal) elements.shopAccessModal.style.display = 'none';
        pendingShopAccessUid = null;
        pendingShopAccessBtn = null;
    });

    elements.cancelShopAccessBtn?.addEventListener('click', () => {
        if (elements.shopAccessModal) elements.shopAccessModal.style.display = 'none';
        pendingShopAccessUid = null;
        pendingShopAccessBtn = null;
    });

    elements.confirmShopAccessBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !pendingShopAccessUid) return;

        const btn = elements.confirmShopAccessBtn;
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Sending...';
            await sendFriendRequest(user.uid, pendingShopAccessUid);
            showToast("Friend request sent!", "success");
            if (pendingShopAccessBtn) {
                pendingShopAccessBtn.disabled = true;
                pendingShopAccessBtn.textContent = 'Request Sent';
            }
            if (elements.shopAccessModal) elements.shopAccessModal.style.display = 'none';
        } catch (err) { showToast("Failed to send request", "error"); } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            pendingShopAccessUid = null;
            pendingShopAccessBtn = null;
        }
    });

    // Handle Custom Location Deletion Confirmation
    elements.confirmDeleteLocationBtn?.addEventListener('click', () => {
        if (locationIndexToDelete >= 0) {
            pickupLocations.splice(locationIndexToDelete, 1);
            refreshLocationUI('pickup');
            if (elements.deleteLocationModal) elements.deleteLocationModal.style.display = 'none';
            locationIndexToDelete = -1;
            showToast("Location removed.", "info");
        }
    });

    elements.cancelDeleteLocationBtn?.addEventListener('click', () => {
        if (elements.deleteLocationModal) elements.deleteLocationModal.style.display = 'none';
        locationIndexToDelete = -1;
    });


};

/**
 * Initializes the dynamic sections of the business registration form based on current selections.
 */
const initializeRegistrationFormUI = (formElement) => {
    console.log('initializeRegistrationFormUI called for:', formElement);
    if (!formElement) return;
    const serviceTypeSelect = formElement.querySelector('[data-ui="service-type"]');
    if (serviceTypeSelect) {
        serviceTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const deliveryCoverageTypeSelect = formElement.querySelector('[data-ui="delivery-coverage-type"]');
    if (deliveryCoverageTypeSelect) {
        deliveryCoverageTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refreshLocationUI('pickup'); // Ensure pickup locations are rendered
};

/**
 * Gathers current form data into the pending registration object.
 */
const prepareRegistrationData = (form = null) => {
    if (!form) {
        form = elements.businessRegistrationModal?.querySelector('form');
    }
    if (!form) return;

    const serviceType = form.querySelector('[data-ui="service-type"]')?.value;

    pendingBusinessRegistrationData = {
        companyName: form.querySelector('[data-ui="company-name"]')?.value.trim(),
        businessCountry: form.querySelector('[data-ui="business-country"]')?.value,
        serviceType: serviceType,
        category: form.querySelector('[data-ui="business-category"]')?.value,
        deliveryFee: parsePrice(form.querySelector('[data-ui="delivery-fee"]')?.value || 0),
        minFreeDelivery: parsePrice(form.querySelector('[data-ui="min-free-delivery"]')?.value || 0),
        pickupLocations: (serviceType === 'pickup' || serviceType === 'both') ? pickupLocations : [],
        visibilityRadius: parseInt(form.querySelector('[data-ui="visibility-radius"]')?.value || '0', 10),
        deliveryCoverage: {
            type: form.querySelector('[data-ui="delivery-coverage-type"]')?.value || 'country',
            countries: JSON.parse(form.querySelector('[data-ui="delivery-countries"]')?.value || '[]'),
            states: JSON.parse(form.querySelector('[data-ui="delivery-states"]')?.value || '[]'),
            cities: JSON.parse(form.querySelector('[data-ui="delivery-cities"]')?.value || '[]')
        }
    };
};

// --- Business Registration Logic (Moved outside initStore) ---
const checkBusinessRegistrationStatus = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const businessProfile = await getBusinessProfile(user.uid);
    currentBusinessProfile = businessProfile;

    const updateButton = elements.updateBusinessInfoBtn;
    if (updateButton) {
        updateButton.disabled = !businessProfile;
        updateButton.style.opacity = businessProfile ? '1' : '0.5';
        updateButton.style.cursor = businessProfile ? 'pointer' : 'not-allowed';
    }

    if (businessProfile && businessProfile.companyName) {
        isBusinessRegistered = true;
        // Sync local state for locations from the saved profile
        pickupLocations = businessProfile.pickupLocations || [];

        // Auto-sync business profile to publicProfiles if not already synced
        const user = auth.currentUser;
        if (user) {
            get(ref(db, `publicProfiles/${user.uid}/businessProfile`)).then(snapshot => {
                if (!snapshot.exists()) {
                    console.log("Auto-syncing business profile to publicProfiles...");
                    saveBusinessProfile(user.uid, businessProfile).catch(err => {
                        console.error("Failed to auto-sync business profile:", err);
                    });
                }
            });
        }
        // deliveryHubLocations is no longer used for map-picked locations

        // Show Management, Hide Registration Landing Page
        if (elements.businessRegistrationView) elements.businessRegistrationView.style.display = 'none';
        if (elements.storeManagementView) elements.storeManagementView.style.display = 'block';

        // No need to populate the landing page form here, it's hidden.
        // The modal form will be populated when the "Update Business Info" button is clicked.
        if (elements.closeBusinessRegistrationModalBtn) elements.closeBusinessRegistrationModalBtn.style.display = 'block'; // Show close button when registered (for modal)
        // Refresh UI lists across all forms
        refreshLocationUI('pickup');
        refreshStoreGrids(); // This will also trigger updateShopPickupLocations
    } else {
        isBusinessRegistered = false;
        currentBusinessProfile = null;
        isEditingBusinessProfile = false;
        elements.skipToReviewBtns.forEach(btn => btn.style.display = 'none');

        // Reset business logo state and previews
        pendingLogoBlob = null;
        const modalPreview = document.querySelector('[data-ui="modal-logo-preview"]');
        const modalIcon = document.querySelector('[data-ui="modal-logo-icon"]');
        const viewPreview = document.querySelector('[data-ui="view-logo-preview"]');
        const viewIcon = document.querySelector('[data-ui="view-logo-icon"]');
        if (modalPreview) { modalPreview.src = ''; modalPreview.style.display = 'none'; }
        if (modalIcon) modalIcon.style.display = 'block';
        if (viewPreview) { viewPreview.src = ''; viewPreview.style.display = 'none'; }
        if (viewIcon) viewIcon.style.display = 'block';

        // Show Registration View, Hide Management
        if (elements.businessRegistrationView) elements.businessRegistrationView.style.display = 'block';
        if (elements.closeBusinessRegistrationModalBtn) elements.closeBusinessRegistrationModalBtn.style.display = 'none'; // Hide close button for initial registration
        initializeRegistrationFormUI(elements.businessRegistrationModal.querySelector('form')); // Initialize the modal form
        if (elements.storeManagementView) elements.storeManagementView.style.display = 'none';
    }
};

/**
 * Shared helper to refresh the states list for a given form.
 */
const refreshStatesList = async (form) => {
    console.log('refreshStatesList called');
    const countryCode = form.querySelector('[data-ui="business-country"]')?.value;
    const statesWrapper = form.querySelector('[data-ui="states-picker-wrapper"]');
    if (!statesWrapper || !countryCode) return;

    const refresh = async () => {
        setupMultiSelect(statesWrapper, [], null, true, refresh);
        const states = await fetchStatesForCountry(countryCode);
        console.log(`refreshStatesList: Fetched states for ${countryCode}:`, states);
        setupMultiSelect(statesWrapper, states, null, false, refresh);
    };
    await refresh();
};

/**
 * Shared helper to refresh the cities list for a given form.
 */
const refreshCitiesList = async (form) => {
    const countryCode = form.querySelector('[data-ui="business-country"]')?.value;
    const statesInput = form.querySelector('[data-ui="delivery-states"]');
    const citiesWrapper = form.querySelector('[data-ui="cities-picker-wrapper"]');
    const citiesTrigger = citiesWrapper?.querySelector('[data-ui="cities-trigger"]');
    const citiesHiddenInput = citiesWrapper?.querySelector('input[type="hidden"]');
    const citiesOptionsList = citiesWrapper?.querySelector('[data-ui="cities-options-list"]');
    const dropdown = citiesWrapper?.querySelector('[data-ui$="-dropdown"]'); // Ensure dropdown is accessible
    if (!citiesWrapper || !countryCode || !statesInput || !citiesTrigger || !citiesHiddenInput || !citiesOptionsList) return;

    let selectedStates = [];
    try { selectedStates = JSON.parse(statesInput.value || '[]'); } catch (e) { selectedStates = []; }

    const isPopulating = form.dataset.populating === "true";
    if (!isPopulating) {
        // Always clear current city selection when states change
        citiesHiddenInput.value = '[]';
        // Call setupMultiSelect with empty options to reset UI and chips display
        setupMultiSelect(citiesWrapper, [], null, false, null);
    }

    // Disable cities selection by default and set visual cues
    citiesTrigger.disabled = true;
    citiesTrigger.style.opacity = '0.6';
    citiesTrigger.style.cursor = 'not-allowed';
    citiesOptionsList.innerHTML = ''; // Clear previous options

    if (selectedStates.length > 1) {
        citiesOptionsList.innerHTML = `<div style="padding:15px; color:var(--muted); font-size:0.85rem; text-align:center;">Select only one state to choose cities.</div>`;
        return;
    }

    if (selectedStates.length === 0) {
        citiesOptionsList.innerHTML = `<div style="padding:15px; color:var(--muted); font-size:0.85rem; text-align:center;">Select a state to choose cities.</div>`;
        return;
    }

    // If exactly one state is selected
    const selectedState = selectedStates[0];
    citiesTrigger.disabled = false;
    citiesTrigger.style.opacity = '1';
    citiesTrigger.style.cursor = 'pointer';

    // Fetch and populate cities for the single selected state
    const refreshCities = async () => {
        setupMultiSelect(citiesWrapper, [], null, true, refreshCities); // Show loading state
        const cities = await fetchCitiesForState(countryCode, selectedState);
        setupMultiSelect(citiesWrapper, cities, null, false, refreshCities); // Populate with fetched cities
    };
    await refreshCities();
};

/**
 * Populates the business registration form with existing profile data.
 * @param {object} profileData - The business profile data.
 * @param {HTMLElement} formElement - The form element to populate.
 */
const populateBusinessRegistrationForm = async (profileData, formElement) => {
    if (!formElement || !profileData) return;

    // Set business logo if exists
    const modalPreview = formElement.querySelector('[data-ui="modal-logo-preview"]');
    const modalIcon = formElement.querySelector('[data-ui="modal-logo-icon"]');
    const viewPreview = formElement.querySelector('[data-ui="view-logo-preview"]');
    const viewIcon = formElement.querySelector('[data-ui="view-logo-icon"]');

    if (profileData.logoUrl) {
        if (modalPreview) {
            modalPreview.src = profileData.logoUrl;
            modalPreview.style.display = 'block';
        }
        if (modalIcon) modalIcon.style.display = 'none';

        if (viewPreview) {
            viewPreview.src = profileData.logoUrl;
            viewPreview.style.display = 'block';
        }
        if (viewIcon) viewIcon.style.display = 'none';
    } else {
        if (modalPreview) {
            modalPreview.src = '';
            modalPreview.style.display = 'none';
        }
        if (modalIcon) modalIcon.style.display = 'block';

        if (viewPreview) {
            viewPreview.src = '';
            viewPreview.style.display = 'none';
        }
        if (viewIcon) viewIcon.style.display = 'block';
    }

    // Set company name
    const companyNameInput = formElement.querySelector('[data-ui="company-name"]');
    if (companyNameInput) companyNameInput.value = profileData.companyName || '';

    // Set delivery fee
    const deliveryFeeInput = formElement.querySelector('[data-ui="delivery-fee"]');
    if (deliveryFeeInput) deliveryFeeInput.value = profileData.deliveryFee || '';

    // Set min free delivery
    const minFreeDeliveryInput = formElement.querySelector('[data-ui="min-free-delivery"]');
    if (minFreeDeliveryInput) minFreeDeliveryInput.value = profileData.minFreeDelivery || '';

    // Set category
    const categorySelect = formElement.querySelector('[data-ui="business-category"]');
    if (categorySelect) categorySelect.value = profileData.category || '';

    // Set country
    const countryInput = formElement.querySelector('[data-ui="business-country"]');
    const countrySelectedText = formElement.querySelector('[data-ui="country-selected-text"]');
    if (countryInput && profileData.businessCountry) {
        countryInput.value = profileData.businessCountry;
        // Ensure fetchedCountries is available before trying to find the name
        if (!fetchedCountries) await populateCountries();
        if (countrySelectedText && fetchedCountries) {
            const c = fetchedCountries.find(c => c.code === profileData.businessCountry);
            if (c) countrySelectedText.textContent = c.name;
        }
    }

    // Set service type
    const serviceTypeSelect = formElement.querySelector('[data-ui="service-type"]');
    if (serviceTypeSelect && profileData.serviceType) {
        serviceTypeSelect.value = profileData.serviceType;
    }

    // Set visibility radius
    const visibilityRadiusSelect = formElement.querySelector('[data-ui="visibility-radius"]');
    if (visibilityRadiusSelect) {
        visibilityRadiusSelect.value = profileData.visibilityRadius !== undefined ? profileData.visibilityRadius : '0';
    }

    // Set delivery countries
    const countriesInput = formElement.querySelector('[data-ui="delivery-countries"]');
    if (countriesInput && profileData.deliveryCoverage?.countries) {
        countriesInput.value = JSON.stringify(profileData.deliveryCoverage.countries);
    }

    // Set delivery states
    const statesInput = formElement.querySelector('[data-ui="delivery-states"]');
    if (statesInput && profileData.deliveryCoverage?.states) {
        statesInput.value = JSON.stringify(profileData.deliveryCoverage.states);
    }

    // Set delivery cities
    const citiesInput = formElement.querySelector('[data-ui="delivery-cities"]');
    if (citiesInput && profileData.deliveryCoverage?.cities) {
        citiesInput.value = JSON.stringify(profileData.deliveryCoverage.cities);
    }

    // Now trigger the country, service type and coverage events (once everything is set)
    if (countryInput && profileData.businessCountry) {
        countryInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (serviceTypeSelect && profileData.serviceType) {
        serviceTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Set delivery coverage type and trigger its change event
    const deliveryCoverageTypeSelect = formElement.querySelector('[data-ui="delivery-coverage-type"]');
    const deliveryTypeButtonGroup = formElement.querySelector('[data-ui="delivery-type-button-group"]');
    if (deliveryCoverageTypeSelect && deliveryTypeButtonGroup && profileData.deliveryCoverage?.type) {
        const targetBtn = deliveryTypeButtonGroup.querySelector(`[data-value="${profileData.deliveryCoverage.type}"]`);
        if (targetBtn) targetBtn.click(); // Programmatically click the button to set active state and trigger change
    }

    // Update pickup locations UI
    pickupLocations = profileData.pickupLocations || [];
    refreshLocationUI('pickup');
};

/**
 * Populates the review content for the final step of the business registration wizard.
 */
const populateReviewContent = () => {
    if (!elements.registrationReviewContent || !pendingBusinessRegistrationData) return;

    const data = pendingBusinessRegistrationData;
    const countryName = fetchedCountries?.find(c => c.code === data.businessCountry)?.name || data.businessCountry;

    let html = `
        <div class="business-profile-view">
            <div class="info-group">
                <label>Company Name</label>
                <p>${data.companyName}</p>
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
                <p style="text-transform: capitalize;">${data.serviceType}</p>
            </div>
            <div class="info-group">
                <label>General Market Visibility Limit</label>
                <p>${data.visibilityRadius ? `${data.visibilityRadius} km` : 'No limit (Show to everyone)'}</p>
            </div>
            <div class="info-group">
                <label>Pickup Locations</label>
                <div class="locations-summary">
                    ${data.pickupLocations?.length ? data.pickupLocations.map(loc => `
                        <div class="loc-summary-item">
                            <strong>${loc.name}</strong>
                            <span>${loc.address}</span>
                        </div>
                    `).join('') : '<p class="muted">No pickup locations set.</p>'}
                </div>
            </div>
            <div class="info-group">
                <label>Delivery Coverage</label>
                ${data.deliveryCoverage?.countries?.length ? `<p><strong>Countries:</strong> ${data.deliveryCoverage.countries.join(', ')}</p>` : ''}
                ${data.deliveryCoverage?.states?.length ? `<p><strong>States:</strong> ${data.deliveryCoverage.states.join(', ')}</p>` : ''}
                ${data.deliveryCoverage?.cities?.length ? `<p><strong>Cities:</strong> ${data.deliveryCoverage.cities.join(', ')}</p>` : ''}
                ${data.deliveryFee ? `<p>Base Fee: ${data.deliveryFee.toFixed(2)}</p>` : ''}
                ${data.minFreeDelivery ? `<p>Free Delivery threshold: ${data.minFreeDelivery.toFixed(2)}</p>` : ''}
            </div>
        </div>
    `;
    elements.registrationReviewContent.innerHTML = html;
};

/**
 * Clears all cached location data (countries, states, cities) and triggers a refresh.
 * @param {boolean} showSuccessToast - Whether to display a success toast message.
 */
export const clearLocationCacheAndRefresh = async (showSuccessToast = true) => {
    // Clear in-memory caches
    cachedStates = {};
    cachedCities = {};
    fetchedCountries = null;
    countryFetchPromise = null; // Ensure a new fetch is triggered

    // Clear localStorage caches
    localStorage.removeItem('hotmapp_states_cache');
    localStorage.removeItem('hotmapp_cities_cache');

    // Re-populate countries. This will trigger a fresh fetch.
    await populateCountries();

    if (showSuccessToast) showToast("Location data cache refreshed!", "success");
};

let cachedStates = JSON.parse(localStorage.getItem('hotmapp_states_cache') || '{}');
let cachedCities = JSON.parse(localStorage.getItem('hotmapp_cities_cache') || '{}');

/**
 * Fetches states for a given country using an external API.
 * @param {string} countryCode - The 2-letter country code (e.g., 'US').
 * @returns {Promise<string[]>} An array of state names.
 */
const fetchStatesForCountry = async (countryCode) => {
    if (!countryCode) return [];
    const cached = cachedStates[countryCode];
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    if (countryFetchPromise) await countryFetchPromise;
    const country = fetchedCountries?.find(c => c.code === countryCode);
    if (!country) return [];

    try {
        console.log(`fetchStatesForCountry: Requesting states for country: ${country.name}`);
        const response = await fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/states', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: country.name }),
            timeout: 10000 // 10 second timeout for states API
        });
        if (!response.ok) throw new Error('Failed to fetch states');
        const data = await response.json();
        console.log(`fetchStatesForCountry: API response for ${country.name}:`, data);
        if (data.error) throw new Error(data.msg || 'API returned error');

        const states = (data.data?.states || []).map(s => s.name).sort();
        cachedStates[countryCode] = { data: states, timestamp: Date.now() };
        localStorage.setItem('hotmapp_states_cache', JSON.stringify(cachedStates));
        return states;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Fetch for states for ${country.name} timed out.`, error);
            showToast(`Loading states for ${country.name} timed out. Falling back to local state list.`, "info");
        } else {
            console.error(`Error fetching states for ${country.name}:`, error);
            showToast(`Failed to load states for ${country.name}. Falling back to local state list.`, "info");
        }
        const states = FALLBACK_STATES[countryCode] || FALLBACK_STATES.DEFAULT;
        return states;
    }
};

/**
 * Fetches cities for a given state in a country using an external API.
 * @param {string} countryCode - The 2-letter country code (e.g., 'US').
 * @param {string} stateName - The name of the state (e.g., 'California').
 * @returns {Promise<string[]>} An array of city names.
 */
const fetchCitiesForState = async (countryCode, stateName) => {
    if (!countryCode || !stateName) return [];
    const cacheKey = `${countryCode}-${stateName}`;
    const cached = cachedCities[cacheKey];
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    if (countryFetchPromise) await countryFetchPromise; // Ensure countries are loaded to get country name
    const country = fetchedCountries?.find(c => c.code === countryCode);
    if (!country) return [];

    try {
        const response = await fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/state/cities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: country.name, state: stateName }),
            timeout: 10000 // 10 second timeout for cities API
        });
        if (!response.ok) throw new Error('Failed to fetch cities');
        const data = await response.json();
        if (data.error) throw new Error(data.msg || 'API returned error');

        const cities = (data.data || []).sort();
        cachedCities[cacheKey] = { data: cities, timestamp: Date.now() };
        localStorage.setItem('hotmapp_cities_cache', JSON.stringify(cachedCities));
        return cities;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Fetch for cities for ${stateName}, ${country.name} timed out.`, error);
            showToast(`Loading cities for ${stateName} timed out. Falling back to local city list.`, "info");
        } else {
            console.error(`Error fetching cities for ${stateName}, ${country.name}:`, error);
            showToast(`Failed to load cities for ${stateName}. Falling back to local city list.`, "info");
        }
        const cities = FALLBACK_CITIES[stateName] || FALLBACK_CITIES.DEFAULT;
        return cities;
    }
};

/**
 * Helper to initialize a searchable multi-select component.
 */
const setupMultiSelect = (wrapper, options, onChange = null, isLoading = false, onRefresh = null) => {
    const trigger = wrapper.querySelector('[data-ui$="-trigger"]');
    const dropdown = wrapper.querySelector('[data-ui$="-dropdown"]');
    const list = wrapper.querySelector('[data-ui$="-options-list"]');
    const searchInput = wrapper.querySelector('[data-ui$="-search-input"]');
    const hiddenInput = wrapper.querySelector('input[type="hidden"]'); 
    let chipsContainer = wrapper.querySelector('[data-ui$="-selected-chips"]');
    const selectAllCheckbox = wrapper.querySelector('[data-ui$="-select-all-checkbox"]');
    const placeholder = trigger.dataset.placeholder || 'Select...';
    wrapper.dataset.initialized = "true";
    let selected = [];
    try { selected = JSON.parse(hiddenInput.value || '[]'); } catch (e) { selected = []; }

    // Sanitize current selection (remove values no longer in options) 
    console.log(`setupMultiSelect: Initial options for wrapper ${wrapper.dataset.ui}:`, options);
    // Skip this check while loading to prevent wiping selections during API transitions
    // Also skip for states and cities to allow manual entries to coexist with API results
    const isLocationPicker = wrapper.dataset.ui === 'countries-picker-wrapper' || wrapper.dataset.ui === 'states-picker-wrapper' || wrapper.dataset.ui === 'cities-picker-wrapper';
    if (!isLoading && options.length > 0 && !isLocationPicker) {
        selected = selected.filter(v => options.includes(v));
    }

    const updateUI = () => {
        if (selected.length === 0) {
            chipsContainer.textContent = "";
            chipsContainer.style.color = 'var(--muted)';
        } else {
            chipsContainer.innerHTML = '';
            chipsContainer.style.color = 'var(--text)';
            selected.forEach(val => {
                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.innerHTML = `${val} <span class="chip-remove">&times;</span>`;
                chip.querySelector('.chip-remove').onclick = (e) => { e.stopPropagation(); toggleVal(val); };
                chipsContainer.appendChild(chip);
            });
        }
        if (selectAllCheckbox) {
            const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase()));
            selectAllCheckbox.checked = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));
        }
        hiddenInput.value = JSON.stringify(selected);
        if (onChange) onChange(selected);
    };

    const toggleVal = (val) => {
        if (selected.includes(val)) {
            selected = selected.filter(v => v !== val);
        } else {
            selected.push(val);
        }
        updateUI();
    };
    
    if (isLocationPicker) {
        // Replace the complex dropdown trigger with a simple input and an "Add" button.
        trigger.innerHTML = `
            <div class="selected-chips" data-ui="${wrapper.dataset.ui.replace('-wrapper', '-selected-chips')}"></div>
        `;
        
        const manualEntryContainer = document.createElement('div');
        manualEntryContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
        manualEntryContainer.innerHTML = `
            <input type="text" class="form-group" placeholder="Type and click Add" style="flex-grow: 1; margin: 0; padding: 8px 12px; border-radius: 6px;">
            <button type="button" class="auth-submit-btn" style="flex-shrink: 0; padding: 8px 16px; margin: 0; font-size: 0.85rem;">Add</button>
        `;
        
        dropdown.innerHTML = ''; // Clear dropdown content
        dropdown.appendChild(manualEntryContainer);
        dropdown.style.cssText = 'display: block; position: static; border: none; box-shadow: none; padding: 0; margin-top: 4px;';

        const manualInput = manualEntryContainer.querySelector('input');
        const addButton = manualEntryContainer.querySelector('button');

        addButton.onclick = () => {
            const value = manualInput.value.trim().replace(/,$/, '').trim(); // Trim and remove trailing comma
            const lowerCaseSelected = selected.map(s => s.toLowerCase());
            const lowerCaseValue = value.toLowerCase();
            const hasLetters = /[a-zA-Z]/.test(value); // Check if the string contains at least one letter

            if (!value) return; // Ignore empty submissions

            if (!hasLetters) {
                showToast('Entry must contain at least one letter.', 'warning');
                manualInput.classList.add('input-shake');
                setTimeout(() => manualInput.classList.remove('input-shake'), 400);
            } else if (lowerCaseSelected.includes(lowerCaseValue)) {
                showToast(`"${value}" has already been added.`, 'warning');
                manualInput.classList.add('input-shake');
                setTimeout(() => manualInput.classList.remove('input-shake'), 400);
            } else {
                toggleVal(value);
                manualInput.value = '';
                manualInput.focus();
            }
        };

        manualInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addButton.click();
            }
        };

        // Re-assign chipsContainer as it was replaced
        const newChipsContainer = wrapper.querySelector('[data-ui$="-selected-chips"]');
        if (newChipsContainer) {
            chipsContainer = newChipsContainer;
        }
        updateUI(); // Initial UI update
        return; // Exit here to bypass the rest of the multi-select logic
    }

    const renderOptions = (filter = '') => {
        list.innerHTML = '';
        const filtered = options.filter(opt => opt.toLowerCase().includes(filter.toLowerCase()));
        filtered.forEach(opt => {
            const isSelected = selected.includes(opt);
            const div = document.createElement('div');
            div.className = `option-item multi-select-item ${isSelected ? 'selected' : ''}`;
            div.innerHTML = `<div class="checkbox"></div><span>${opt}</span>`;
            div.onclick = (e) => { 
                e.stopPropagation(); 
                toggleVal(opt); 
                renderOptions(searchInput.value); // Re-render to update checkbox state
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            };
            list.appendChild(div);
        });

        if (filtered.length === 0) {
            let emptyMsg = isLoading ? '<span class="spinner" style="border-top-color:var(--brand); width:14px; height:14px;"></span> Loading options...' : (options.length === 0 ? 'No options available' : `No results for "${filter}"`);

            if (!isLoading && options.length === 0) {
                if (onRefresh) {
                    emptyMsg = `Failed to load data. <button type="button" class="retry-inline-btn" style="background:var(--brand); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem; margin-top:5px; display:block; margin-left:auto; margin-right:auto; margin-bottom: 5px;">Retry</button>`;
                }
                if (isLocationPicker) {
                    emptyMsg += `<div style="font-size:0.75rem; color:var(--muted); margin-top:5px;">Type a name above to add it manually.</div>`;
                }
            }

            list.innerHTML = `<div style="padding:15px; color:var(--muted); font-size:0.85rem; text-align:center;">${emptyMsg}</div>`;

            const retryBtn = list.querySelector('.retry-inline-btn');
            if (retryBtn) retryBtn.onclick = (e) => { e.stopPropagation(); onRefresh(); };
        }

        // Add Manual Entry option for States and Cities if no exact match found
        const cleanFilter = filter.trim();
        if (isLocationPicker && cleanFilter !== '' && !options.some(opt => opt.toLowerCase() === cleanFilter.toLowerCase())) {
            const manualDiv = document.createElement('div');
            manualDiv.className = 'option-item multi-select-item';
            manualDiv.style.borderTop = '1px dashed var(--border)';
            manualDiv.style.marginTop = '5px';
            manualDiv.innerHTML = `<i class="fa-solid fa-plus" style="font-size: 0.75rem; margin-right: 8px; color: var(--brand);"></i><span>Add "<strong>${cleanFilter}</strong>" manually</span>`;
            manualDiv.onclick = (e) => {
                e.stopPropagation();
                toggleVal(cleanFilter);
                searchInput.value = '';
                renderOptions('');
            };
            list.appendChild(manualDiv);
        }
    };

    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = (e) => {
            const isChecked = e.target.checked;
            const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase()));
            if (isChecked) {
                filteredOptions.forEach(opt => {
                    if (!selected.includes(opt)) selected.push(opt);
                });
            } else {
                selected = selected.filter(opt => !filteredOptions.includes(opt));
            }
            updateUI();
            renderOptions(searchInput.value);
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        };
    }

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('active');
        document.querySelectorAll('.custom-select-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) { searchInput.value = ''; renderOptions(); searchInput.focus(); }
    };
    bindDebouncedSearch(searchInput, renderOptions, 300);
    updateUI();
};
/**
 * Refreshes all instances of a location list in the UI (Landing Page and Modal).
 */
const refreshLocationUI = (type) => {
    const isPickup = type === 'pickup';
    const list = pickupLocations; // Only pickup locations are managed this way now
    const selector = isPickup ? '[data-ui="pickup-locations-list"]' : '[data-ui="delivery-hub-locations-list"]';

    document.querySelectorAll(selector).forEach(container => {
        container.innerHTML = '';
        // Removed: if (isPickup) return; 
        // We now allow pickup locations to render in the list to expose Edit/Delete actions

        if (list.length === 0) {
            container.innerHTML = `<p style="color: var(--muted); font-size: 0.85rem;">No ${type} locations added yet.</p>`;
            return;
        }
        list.forEach((loc, index) => {
            const html = `
                <div class="location-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;">
                    <i class="fa-solid fa-location-dot" style="color: var(--brand);"></i>
                    <span style="flex: 1; font-size: 0.9rem;">${loc.name || loc.address}</span>
                    <button type="button" class="edit-location-btn" data-index="${index}" data-type="${type}" style="background: none; border: none; color: var(--brand); cursor: pointer;"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="delete-location-btn" data-index="${index}" data-type="${type}" style="background: none; border: none; color: #ff4d4d; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
    });
};

export const initBusinessLocationMap = (lat, lng) => {
    console.log('initBusinessLocationMap entered. Lat:', lat, 'Lng:', lng); // Debug log
    if (typeof L === 'undefined') return;

    const brandIcon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot custom-map-marker"></i>',
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    if (businessLocationMap) {
        businessLocationMap.setView([lat, lng], 15, { animate: false });
        businessLocationMarker.setLatLng([lat, lng]);
        setTimeout(() => businessLocationMap.invalidateSize(), 200);
        return;
    }

    const mapContainer = elements.businessLocationMap;
    if (!mapContainer) { console.error('Map container element (elements.businessLocationMap) not found!'); return; }

    businessLocationMap = L.map(mapContainer).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(businessLocationMap);

    businessLocationMarker = L.marker([lat, lng], {
        draggable: true,
        icon: brandIcon
    }).addTo(businessLocationMap);

    businessLocationMap.on('click', (e) => {
        businessLocationMarker.setLatLng(e.latlng);
    });

    businessLocationMarker.on('dragend', () => {
        const { lat, lng } = businessLocationMarker.getLatLng();
        businessLocationMap.setView([lat, lng], businessLocationMap.getZoom());
    });
};

export const openBusinessLocationPicker = (type, locationData = null, index = -1) => {
    if (type !== 'delivery-address') currentPickingLocationType = type;

    if (type === 'pickup' && index === -1 && pickupLocations.length >= MAX_PICKUP_LOCATIONS) {
        showToast(`You can register a maximum of ${MAX_PICKUP_LOCATIONS} pickup locations.`, "warning");
        return;
    }

    // If editing/changing pickup location, pre-load the existing one
    // The index parameter now correctly indicates if it's an edit or a new location
    currentEditingLocationIndex = index;
    if (elements.businessLocationPickerModal) elements.businessLocationPickerModal.style.display = 'flex';

    // Initialize map with current location or default
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => initBusinessLocationMap(locationData?.latitude || position.coords.latitude, locationData?.longitude || position.coords.longitude),
            () => initBusinessLocationMap(locationData?.latitude || 0, locationData?.longitude || 0) // Default if GPS blocked
        );
    } else {
        initBusinessLocationMap(locationData?.latitude || 0, locationData?.longitude || 0);
    }

    if (elements.businessLocationSearchInput) elements.businessLocationSearchInput.value = locationData?.address || '';
    if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
};

/**
 * Displays the business registration confirmation modal with a summary of the data.
 */
const showRegistrationConfirmation = (data) => {
    if (!elements.businessRegistrationConfirmationModal || !elements.registrationConfirmationContent) return;

    let logoHtml = '';
    const logoSrc = pendingLogoBlob ? URL.createObjectURL(pendingLogoBlob) : data.logoUrl;
    if (logoSrc) {
        logoHtml = `
            <div style="display: flex; justify-content: center; margin-bottom: 15px;">
                <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border); background: var(--panel-soft);">
                    <img src="${logoSrc}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            </div>
        `;
    }

    let html = `
        <div style="padding: 10px 0;">
            ${logoHtml}
            <p><strong>Company Name:</strong> ${data.companyName}</p>
            <p><strong>Business base:</strong> ${data.businessCountry}</p>
            <p><strong>Category:</strong> ${data.category || 'Not specified'}</p>
            <p><strong>Service Type:</strong> ${data.serviceType.charAt(0).toUpperCase() + data.serviceType.slice(1)}</p>
            ${data.deliveryFee > 0 ? `<p><strong>Delivery Fee:</strong> ${data.deliveryFee.toFixed(2)}</p>` : ''}
            ${data.minFreeDelivery > 0 ? `<p><strong>Min Order for Free Delivery:</strong> ${data.minFreeDelivery.toFixed(2)}</p>` : ''}
    `;

    if (data.pickupLocations && data.pickupLocations.length > 0) {
        html += `<p><strong>Pickup Locations:</strong></p><ul>`;
        data.pickupLocations.forEach(loc => {
            html += `<li>${loc.name || loc.address} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})</li>`;
        });
        html += `</ul>`;
    }

    if (data.deliveryCoverage) {
        html += `<p><strong>Delivery Coverage:</strong> ${data.deliveryCoverage.type}</p>`;
        if (data.deliveryCoverage.countries && data.deliveryCoverage.countries.length > 0) {
            html += `<p><strong>Countries:</strong> ${data.deliveryCoverage.countries.join(', ')}</p>`;
        }
        if (data.deliveryCoverage.states && data.deliveryCoverage.states.length > 0) {
            html += `<p><strong>States:</strong> ${data.deliveryCoverage.states.join(', ')}</p>`;
        }
        if (data.deliveryCoverage.cities && data.deliveryCoverage.cities.length > 0) {
            html += `<p><strong>Cities:</strong> ${data.deliveryCoverage.cities.join(', ')}</p>`;
        }
    }
    html += `</div>`;

    elements.registrationConfirmationContent.innerHTML = html;
    elements.businessRegistrationConfirmationModal.style.display = 'flex';
};
/**
 * Unified handler for Edit and Delete actions within location lists.
 */
const handleLocationUiEvent = (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const index = parseInt(target.dataset.index); // This will only be for pickup locations now
    const type = target.dataset.type; // 'pickup'
    const list = pickupLocations; // Only pickup locations are managed this way now

    if (target.classList.contains('edit-location-btn')) {
        openBusinessLocationPicker(type, list[index], index);
    } else if (target.classList.contains('delete-location-btn')) {
        // Trigger custom confirmation modal instead of native confirm()
        locationIndexToDelete = index;
        const loc = list[index];
        if (elements.deleteLocationPreview) elements.deleteLocationPreview.textContent = loc.address || "Selected Location";
        if (elements.deleteLocationModal) elements.deleteLocationModal.style.display = 'flex';
    }
};

/**
 * Helper to update the state arrays and UI lists for business locations.
 */
const updateBusinessLocationState = (location) => {
    const mode = elements.businessLocationPickerModal?.dataset.mode;
    if (mode === 'delivery-address') {
        const addrMode = elements.deliveryAddressContainer?.dataset.mode || 'simple';

        if (addrMode === 'simple') {
            if (elements.deliveryAddressInput) {
                elements.deliveryAddressInput.value = location.address;
                elements.deliveryAddressInput.dispatchEvent(new Event('input'));
            }
        } else {
            if (elements.addrStreet) elements.addrStreet.value = location.address;
            showToast("Street set. Please verify City and State.", "info");
        }
        return;
    }

    // This function is now only for pickup locations
    if (currentPickingLocationType !== 'pickup') return;
    if (currentEditingLocationIndex === -1) { pickupLocations.push(location); } else { pickupLocations[currentEditingLocationIndex] = location; }
    refreshLocationUI(currentPickingLocationType);
};

/**
 * Handles the confirmation of a location selection from the map picker modal.
 * It extracts the coordinates and address, performs reverse geocoding if needed,
 * creates a new location object, updates the global state, and closes the modal.
 */
const handleConfirmLocationSelection = async () => {
    const btn = elements.confirmBusinessLocationBtn;
    const originalContent = btn.innerHTML;
    const mode = elements.businessLocationPickerModal?.dataset.mode;
    const cartBtn = elements.pickDeliveryLocationBtn;
    const isDeliveryMode = mode === 'delivery-address';

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Confirming...';

    if (!businessLocationMarker) {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        return;
    }

    const { lat, lng } = businessLocationMarker.getLatLng();
    let address = elements.businessLocationSearchInput.value.trim();

    if (isDeliveryMode && cartBtn) {
        if (elements.businessLocationPickerModal) elements.businessLocationPickerModal.style.display = 'none';
        cartBtn.disabled = true;
        cartBtn.dataset.originalContent = cartBtn.innerHTML;
        cartBtn.innerHTML = '<span class="spinner" style="width:10px; height:10px; border-width:2px; margin:0;"></span> Geocoding...';
    }

    try {
        // Reverse geocode if address is empty or just lat/lng
        if (!address || address === `${lat}, ${lng}`) {
            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await resp.json();
                address = data.display_name || `${lat}, ${lng}`;
            } catch (e) {
                console.warn("Reverse geocoding failed", e);
                address = `${lat}, ${lng}`;
            }
        }

        const newLocation = { name: address.split(',')[0], latitude: lat, longitude: lng, address: address };
        updateBusinessLocationState(newLocation);
        if (!isDeliveryMode) {
            setTimeout(() => {
                if (elements.businessLocationPickerModal) {
                    elements.businessLocationPickerModal.style.display = 'none';
                    delete elements.businessLocationPickerModal.dataset.mode;
                }
                if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
            }, 50);
        } else {
            delete elements.businessLocationPickerModal?.dataset.mode;
            if (elements.businessLocationSearchResults) elements.businessLocationSearchResults.style.display = 'none';
        }
    } catch (error) {
        console.error("Error confirming location:", error);
        showToast("Failed to confirm location. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;

        if (isDeliveryMode && cartBtn) {
            cartBtn.disabled = false;
            cartBtn.innerHTML = cartBtn.dataset.originalContent || '<i class="fa-solid fa-map-location-dot"></i> Pick from Map';
            delete cartBtn.dataset.originalContent;
        }
    }
};