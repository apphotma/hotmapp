export const debounce = (func, delay) => {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

export const setElementDisplay = (element, display) => {
    if (element) element.style.display = display;
};

export const showElement = (element, display = 'block') => {
    setElementDisplay(element, display);
};

export const hideElement = (element) => {
    setElementDisplay(element, 'none');
};

export const setElementText = (element, text) => {
    if (element) element.textContent = text;
};

export const isEditableTextMessage = (msg, currentUserId) => {
    if (!msg || !currentUserId) return false;
    if (msg.senderId !== currentUserId) return false;
    if (msg.deleted) return false;

    const messageType = msg.type || 'text';
    const isTextLike = messageType === 'text' || messageType === 'sent' || messageType === '' || messageType === null || messageType === undefined;
    if (!isTextLike) return false;

    const timestamp = msg.timestamp;
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
        return (Date.now() - timestamp) < 15 * 60 * 1000;
    }

    if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp);
        if (!Number.isNaN(parsed)) {
            return (Date.now() - parsed) < 15 * 60 * 1000;
        }
    }

    if (timestamp && typeof timestamp === 'object') {
        if (typeof timestamp.seconds === 'number') {
            return (Date.now() - timestamp.seconds * 1000) < 15 * 60 * 1000;
        }
        if (typeof timestamp.timestamp === 'number') {
            return (Date.now() - timestamp.timestamp) < 15 * 60 * 1000;
        }
        if (typeof timestamp.toMillis === 'function') {
            const millis = timestamp.toMillis();
            if (Number.isFinite(millis)) {
                return (Date.now() - millis) < 15 * 60 * 1000;
            }
        }
    }

    return true;
};

/**
 * Calculates distance between two points in km using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Estimates travel time based on distance and travel mode.
 * Driving: 40 km/h (~1.5 mins per km)
 * Cycling: 15 km/h (4 mins per km)
 * Walking: 5 km/h (12 mins per km)
 */
export const getHeuristicTravelTime = (distanceKm, travelMode = 'driving') => {
    let factor = 1.5; // driving
    if (travelMode === 'walking') factor = 12;
    else if (travelMode === 'cycling') factor = 4;
    const mins = Math.round(distanceKm * factor);
    return mins < 1 ? "< 1 min away" : `${mins} mins away`;
};

export const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN'; // IMPORTANT: Replace with your actual Mapbox Access Token

/**
 * Fetches accurate travel time from Mapbox Directions API.
 * Falls back to heuristic if API key is missing or API call fails.
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {string} travelMode - 'driving', 'walking', 'cycling'
 * @returns {Promise<string>} Estimated travel time string (e.g., "5 mins away")
 */
export const getTravelTimeFromAPI = async (origin, destination, travelMode = 'driving') => {
    if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
        console.warn("Mapbox Access Token is not set. Using heuristic for travel time.");
        const dist = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        return getHeuristicTravelTime(dist, travelMode);
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/${travelMode}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=simplified&steps=false`;

    try {
        const response = await fetchWithTimeout(url, { timeout: 5000 }); // 5-second timeout for API call
        if (!response.ok) throw new Error(`Mapbox API error: ${response.statusText}`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const durationSeconds = data.routes[0].duration; // duration in seconds
            const minutes = Math.round(durationSeconds / 60);
            return minutes < 1 ? "< 1 min away" : `${minutes} mins away`;
        }
        throw new Error("No routes found");
    } catch (error) {
        console.error("Error fetching travel time from Mapbox:", error);
        const dist = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        return getHeuristicTravelTime(dist, travelMode); // Fallback to heuristic on error
    }
};

export const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 8000 } = options; // Default 8 seconds

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id); // Ensure timeout is cleared even if fetch fails before abort
        throw error; // Re-throw the error for the caller to handle
    }
};

/**
 * Compresses an image (either a File/Blob or a DataURL string) using Canvas.
 * @param {File|Blob|string} input - The File, Blob or DataURL string to compress
 * @param {number} maxWidth - Maximum width of the compressed image
 * @param {number} quality - Compression quality between 0 and 1
 * @returns {Promise<Blob>} A promise resolving to the compressed image Blob
 */
export const compressImage = (input, maxWidth = 1200, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const processImageSrc = (src) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
            };
            img.onerror = reject;
        };

        if (typeof input === 'string') {
            processImageSrc(input);
        } else if (input instanceof Blob) {
            const reader = new FileReader();
            reader.readAsDataURL(input);
            reader.onload = event => processImageSrc(event.target.result);
            reader.onerror = reject;
        } else {
            reject(new TypeError("compressImage input must be a File, Blob, or a DataURL string"));
        }
    });
};

/**
 * Helper to construct UI avatar URLs with optional user photo fallback.
 */
export const getAvatarUrl = (name, photo) => {
    if (photo) return photo;
    const cleanName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random`;
};

/**
 * Center-crops an image (DataURL, Blob or File) to a perfect 1:1 square,
 * resizes it to a specified size (width & height), and compresses it to a Blob.
 * @param {Blob|File|string} input - The image source (DataURL or Blob)
 * @param {number} [size=400] - The output width & height of the square image
 * @param {number} [quality=0.8] - JPEG quality (0 to 1)
 * @returns {Promise<Blob>} A promise resolving to the cropped and compressed square image Blob
 */
export const cropToSquare = (input, size = 400, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const processImageSrc = (src) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                // Center crop coordinates
                let sx = 0;
                let sy = 0;
                let sWidth = img.width;
                let sHeight = img.height;

                if (img.width > img.height) {
                    sWidth = img.height;
                    sx = (img.width - img.height) / 2;
                } else {
                    sHeight = img.width;
                    sy = (img.height - img.width) / 2;
                }

                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
            };
            img.onerror = reject;
        };

        if (typeof input === 'string') {
            processImageSrc(input);
        } else if (input instanceof Blob) {
            const reader = new FileReader();
            reader.readAsDataURL(input);
            reader.onload = event => processImageSrc(event.target.result);
            reader.onerror = reject;
        } else {
            reject(new TypeError("cropToSquare input must be a File, Blob, or a DataURL string"));
        }
    });
};

/**
 * Binds a debounced callback function to an input element's oninput event.
 */
export const bindDebouncedSearch = (input, fn, delay = 300) => {
    if (!input) return;
    const debounced = debounce(fn, delay);
    input.oninput = (e) => debounced(e.target.value);
};

/**
 * Parses a price string or number safely, removing any commas (thousands separators) before parsing
 */
export const parsePrice = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined || val === '') return 0;
    const cleaned = String(val).replace(/,/g, '');
    return parseFloat(cleaned) || 0;
};