import { describe, it, expect } from '@jest/globals';

// Test implementation of waveform functions matching public/chat.js
export const generateFallbackWaveform = (seedStr = '', count = 34) => {
    let seed = 42;
    for (let i = 0; i < (seedStr || '').length; i++) {
        seed = (seed * 31 + seedStr.charCodeAt(i)) % 10000;
    }
    const waveform = [];
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const envelope = Math.sin(t * Math.PI);
        const rand = Math.sin(seed + i * 1.618) * 0.5 + 0.5;
        const voiceAccent = (i % 3 === 0) ? 0.3 : 0;
        const val = 0.18 + 0.72 * (envelope * 0.45 + rand * 0.35 + voiceAccent * 0.2);
        waveform.push(Number(Math.max(0.15, Math.min(1.0, val)).toFixed(2)));
    }
    return waveform;
};

export const renderWaveformBarsHtml = (waveform, barCount = 34) => {
    const data = (Array.isArray(waveform) && waveform.length > 0)
        ? waveform
        : generateFallbackWaveform('', barCount);

    return data.slice(0, barCount).map((val) => {
        const heightPx = Math.max(4, Math.min(24, Math.round(val * 24)));
        return `<span class="wa-waveform-bar" style="height: ${heightPx}px;" data-level="${val}"></span>`;
    }).join('');
};

describe('WhatsApp-style Voice Note Waveform Tests', () => {
    it('generates a realistic fallback waveform with peaks and valleys between 0.15 and 1.0', () => {
        const count = 34;
        const waveform = generateFallbackWaveform('msg_test_123', count);

        expect(Array.isArray(waveform)).toBe(true);
        expect(waveform.length).toBe(count);

        // Verify bounds
        waveform.forEach(val => {
            expect(typeof val).toBe('number');
            expect(val).toBeGreaterThanOrEqual(0.15);
            expect(val).toBeLessThanOrEqual(1.0);
        });

        // Ensure it is not a flat constant line (peaks and valleys exist)
        const uniqueValues = new Set(waveform);
        expect(uniqueValues.size).toBeGreaterThan(10);

        const maxVal = Math.max(...waveform);
        const minVal = Math.min(...waveform);
        expect(maxVal - minVal).toBeGreaterThan(0.2); // Has distinct vocal dynamics
    });

    it('renders HTML waveform bars matching amplitude heights between 4px and 24px', () => {
        const sampleWaveform = [0.15, 0.5, 0.95, 0.2, 0.8];
        const html = renderWaveformBarsHtml(sampleWaveform, 5);

        expect(html).toContain('class="wa-waveform-bar"');
        expect(html).toContain('style="height: 4px;"'); // 0.15 * 24 = 3.6 -> min clamped to 4px
        expect(html).toContain('style="height: 12px;"'); // 0.5 * 24 = 12px
        expect(html).toContain('style="height: 23px;"'); // 0.95 * 24 = 22.8 -> 23px
        expect(html).toContain('style="height: 5px;"');  // 0.2 * 24 = 4.8 -> 5px
        expect(html).toContain('style="height: 19px;"'); // 0.8 * 24 = 19.2 -> 19px
    });

    it('gracefully handles missing or invalid waveform input in renderWaveformBarsHtml', () => {
        const htmlNull = renderWaveformBarsHtml(null, 34);
        expect(htmlNull).toContain('class="wa-waveform-bar"');
        const matches = htmlNull.match(/class="wa-waveform-bar"/g);
        expect(matches.length).toBe(34);

        const htmlEmpty = renderWaveformBarsHtml([], 34);
        const matchesEmpty = htmlEmpty.match(/class="wa-waveform-bar"/g);
        expect(matchesEmpty.length).toBe(34);
    });
});
