import { validateDeliveryCoverage } from '../public/delivery-coverage-utils.js';

describe('Strict Delivery Coverage Validation', () => {
    describe('Country Coverage', () => {
        const coverage = {
            type: 'country',
            countries: ['United States', 'Canada', 'Nigeria']
        };

        it('should allow delivery when buyer address contains an allowed country', () => {
            const result = validateDeliveryCoverage('123 Main St, Lagos, Nigeria', null, coverage, null);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when buyer address is outside allowed countries', () => {
            const result = validateDeliveryCoverage('10 Downing Street, London, United Kingdom', null, coverage, null);
            expect(result.isCovered).toBe(false);
            expect(result.reason).toContain('United States, Canada, Nigeria');
        });
    });

    describe('State Coverage', () => {
        const coverage = {
            type: 'states',
            states: ['California', 'New York', 'Texas']
        };

        it('should allow delivery when buyer address contains an allowed state', () => {
            const result = validateDeliveryCoverage('500 Broadway, New York, NY', null, coverage, null);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when buyer address is in a different state', () => {
            const result = validateDeliveryCoverage('100 Miami Beach, Florida', null, coverage, null);
            expect(result.isCovered).toBe(false);
            expect(result.reason).toContain('California, New York, Texas');
        });
    });

    describe('City Coverage', () => {
        const coverage = {
            type: 'cities',
            cities: ['Los Angeles', 'San Francisco', 'San Diego']
        };

        it('should allow delivery when buyer address is in an allowed city', () => {
            const result = validateDeliveryCoverage('742 Evergreen Terrace, San Francisco, CA', null, coverage, null);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when buyer address is in another city', () => {
            const result = validateDeliveryCoverage('123 Orange Ave, Sacramento, CA', null, coverage, null);
            expect(result.isCovered).toBe(false);
            expect(result.reason).toContain('Los Angeles, San Francisco, San Diego');
        });
    });

    describe('Street / Neighborhood Coverage', () => {
        const coverage = {
            type: 'streets',
            streets: ['Wall Street', 'Broadway', '5th Avenue', 'Victoria Island'],
            streetPoints: [
                { name: 'Wall Street', lat: 40.7060, lng: -74.0088 }
            ]
        };

        it('should allow delivery when buyer address matches one of the allowed streets', () => {
            const result = validateDeliveryCoverage('11 Wall Street, Apt 4B, New York', null, coverage, null);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when buyer address is not on the allowed streets and has no nearby coordinates', () => {
            const result = validateDeliveryCoverage('88 Madison Avenue, New York', null, coverage, null);
            expect(result.isCovered).toBe(false);
            expect(result.reason).toContain('Wall Street, Broadway, 5th Avenue, Victoria Island');
        });

        it('should allow delivery when buyer is within 1 km spread radius of the allowed street point', () => {
            // ~0.3 km away from Wall Street point
            const nearbyCoords = { lat: 40.7075, lng: -74.0095 };
            const result = validateDeliveryCoverage('Pine Street, New York', nearbyCoords, coverage, null);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when buyer is beyond 1 km spread radius and does not match street name', () => {
            // ~3.5 km away from Wall Street point
            const farCoords = { lat: 40.7350, lng: -73.9900 };
            const result = validateDeliveryCoverage('88 Madison Avenue, New York', farCoords, coverage, null);
            expect(result.isCovered).toBe(false);
        });
    });

    describe('Radius / Distance Limit Coverage', () => {
        const coverage = {
            type: 'all',
            maxDistanceRadius: 10 // 10 km max
        };
        const storeCoords = { lat: 40.7128, lng: -74.0060 }; // New York City Hall

        it('should allow delivery when coordinates are within radius', () => {
            const buyerCoords = { lat: 40.7150, lng: -74.0080 }; // ~0.3 km away
            const result = validateDeliveryCoverage('Near City Hall', buyerCoords, coverage, storeCoords);
            expect(result.isCovered).toBe(true);
        });

        it('should reject delivery when coordinates exceed the radius limit', () => {
            const buyerCoords = { lat: 40.9000, lng: -74.0060 }; // ~20.8 km away
            const result = validateDeliveryCoverage('Far away', buyerCoords, coverage, storeCoords);
            expect(result.isCovered).toBe(false);
            expect(result.reason).toContain('exceeds the seller\'s maximum delivery radius of 10 km');
        });
    });
});
