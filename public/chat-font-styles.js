/**
 * Hotmapp Chat Font Styles Configuration & Utilities
 */

export const FONT_STYLES = {
    'default': {
        id: 'default',
        name: 'Default (System / Inter)',
        family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    'poppins': {
        id: 'poppins',
        name: 'Poppins (Modern Sans)',
        family: "'Poppins', sans-serif"
    },
    'roboto': {
        id: 'roboto',
        name: 'Roboto (Clean)',
        family: "'Roboto', sans-serif"
    },
    'montserrat': {
        id: 'montserrat',
        name: 'Montserrat (Geometric)',
        family: "'Montserrat', sans-serif"
    },
    'open-sans': {
        id: 'open-sans',
        name: 'Open Sans (Neutral)',
        family: "'Open Sans', sans-serif"
    },
    'playfair': {
        id: 'playfair',
        name: 'Playfair Display (Elegant Serif)',
        family: "'Playfair Display', Georgia, serif"
    },
    'lora': {
        id: 'lora',
        name: 'Lora (Classic Serif)',
        family: "'Lora', Georgia, serif"
    },
    'caveat': {
        id: 'caveat',
        name: 'Caveat (Handwritten)',
        family: "'Caveat', cursive"
    },
    'dancing-script': {
        id: 'dancing-script',
        name: 'Dancing Script (Cursive)',
        family: "'Dancing Script', cursive"
    },
    'comic-neue': {
        id: 'comic-neue',
        name: 'Comic Neue (Casual)',
        family: "'Comic Neue', cursive, sans-serif"
    },
    'fira-code': {
        id: 'fira-code',
        name: 'Fira Code (Monospace)',
        family: "'Fira Code', 'Courier New', monospace"
    }
};

export const DEFAULT_FONT_STYLE = 'default';

/**
 * Returns the font configuration object for the given font style key.
 * Falls back to DEFAULT_FONT_STYLE if invalid.
 * @param {string} key
 * @returns {{ id: string, name: string, family: string }}
 */
export const getFontStyleConfig = (key) => {
    if (key && FONT_STYLES[key]) {
        return FONT_STYLES[key];
    }
    return FONT_STYLES[DEFAULT_FONT_STYLE];
};
