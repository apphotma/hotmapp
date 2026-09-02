import { calculateDistance } from './utils.js';

/**
 * Strictly validates whether a buyer's delivery address or coordinates
 * fall within the seller's configured delivery coverage.
 * 
 * @param {string} buyerAddress - The full text of the buyer's address
 * @param {{lat: number, lng: number}|null} buyerCoords - Buyer GPS coordinates if available
 * @param {object|null} sellerCoverage - Seller's deliveryCoverage configuration
 * @param {{lat: number, lng: number}|null} storeCoords - Seller's store coordinates
 * @returns {{isCovered: boolean, reason?: string, allowed?: string}}
 */
export const validateDeliveryCoverage = (buyerAddress, buyerCoords, sellerCoverage, storeCoords) => {
    if (!sellerCoverage) {
        return { isCovered: true };
    }

    // 1. Distance Radius / Meter-level check (applies if maxDistanceRadius or radius is configured)
    const maxRadius = parseFloat(sellerCoverage.maxDistanceRadius || sellerCoverage.radius || 0);
    if (maxRadius > 0 && buyerCoords && storeCoords && storeCoords.lat && storeCoords.lng) {
        const dist = calculateDistance(buyerCoords.lat, buyerCoords.lng, storeCoords.lat, storeCoords.lng);
        if (dist > maxRadius) {
            return {
                isCovered: false,
                reason: `Distance (${dist.toFixed(1)} km) exceeds the seller's maximum delivery radius of ${maxRadius} km.`,
                allowed: `Within ${maxRadius} km of store`
            };
        }
    }

    if (!sellerCoverage.type || sellerCoverage.type === 'all' || sellerCoverage.type === 'worldwide') {
        return { isCovered: true };
    }

    const type = String(sellerCoverage.type).toLowerCase();

    const addrStr = String(buyerAddress || '').toLowerCase().trim();
    if (!addrStr) {
        return { isCovered: true };
    }

    const addrParts = addrStr.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);

    if (type === 'country' || type === 'countries') {
        const countries = (sellerCoverage.countries || []).map(c => String(c).toLowerCase().trim()).filter(Boolean);
        if (countries.length > 0) {
            const matches = countries.some(c => addrStr.includes(c) || addrParts.some(p => p === c || p.includes(c)));
            if (!matches) {
                return {
                    isCovered: false,
                    reason: `Delivery is only available in: ${sellerCoverage.countries.join(', ')}`,
                    allowed: sellerCoverage.countries.join(', ')
                };
            }
        }
    } else if (type === 'states' || type === 'state') {
        const states = (sellerCoverage.states || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
        if (states.length > 0) {
            const matches = states.some(s => addrStr.includes(s) || addrParts.some(p => p === s || p.includes(s)));
            if (!matches) {
                return {
                    isCovered: false,
                    reason: `Delivery is only available in states/regions: ${sellerCoverage.states.join(', ')}`,
                    allowed: sellerCoverage.states.join(', ')
                };
            }
        }
    } else if (type === 'cities' || type === 'city') {
        const cities = (sellerCoverage.cities || []).map(c => String(c).toLowerCase().trim()).filter(Boolean);
        if (cities.length > 0) {
            const matches = cities.some(c => addrStr.includes(c) || addrParts.some(p => p === c || p.includes(c)));
            if (!matches) {
                return {
                    isCovered: false,
                    reason: `Delivery is only available in cities: ${sellerCoverage.cities.join(', ')}`,
                    allowed: sellerCoverage.cities.join(', ')
                };
            }
        }
    } else if (type === 'streets' || type === 'street' || type === 'neighborhood') {
        const streets = (sellerCoverage.streets || sellerCoverage.neighborhoods || sellerCoverage.cities || []).map(st => String(st).toLowerCase().trim()).filter(Boolean);
        const spreadRadius = parseFloat(sellerCoverage.streetSpreadRadius || 1.0); // Default 1 km radius spread

        // Check 1: Textual match
        let isMatched = false;
        if (streets.length > 0) {
            isMatched = streets.some(st => addrStr.includes(st) || addrParts.some(p => p === st || p.includes(st)));
        }

        // Check 2: 1 km Radius Spread from Street / Location anchor points
        if (!isMatched && buyerCoords && buyerCoords.lat && buyerCoords.lng) {
            // Check against seller street points or store anchor coordinates
            const streetPoints = sellerCoverage.streetPoints || [];
            if (streetPoints.length > 0) {
                const withinSpread = streetPoints.some(pt => {
                    if (!pt.lat || !pt.lng) return false;
                    const d = calculateDistance(buyerCoords.lat, buyerCoords.lng, pt.lat, pt.lng);
                    return d <= spreadRadius;
                });
                if (withinSpread) isMatched = true;
            } else if (storeCoords && storeCoords.lat && storeCoords.lng) {
                const d = calculateDistance(buyerCoords.lat, buyerCoords.lng, storeCoords.lat, storeCoords.lng);
                if (d <= spreadRadius) isMatched = true;
            }
        }

        if (streets.length > 0 && !isMatched) {
            return {
                isCovered: false,
                reason: `Delivery is only available on streets/areas: ${(sellerCoverage.streets || sellerCoverage.neighborhoods || sellerCoverage.cities).join(', ')} (and within ${spreadRadius} km)`,
                allowed: (sellerCoverage.streets || sellerCoverage.neighborhoods || sellerCoverage.cities).join(', ')
            };
        }
    }

    return { isCovered: true };
};
