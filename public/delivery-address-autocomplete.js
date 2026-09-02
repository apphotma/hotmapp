import { debounce } from './utils.js';

/**
 * Initializes delivery address autocomplete and nearest-landmark fallback detection.
 * 
 * @param {Object} config
 * @param {HTMLInputElement|HTMLTextAreaElement} config.inputElement - Target address input or textarea
 * @param {HTMLElement} config.suggestionsContainer - Container element where suggestions are rendered
 * @param {HTMLElement} [config.landmarkPromptContainer] - Banner container shown if no results found
 * @param {Function} [config.onSelect] - Callback when an address/landmark is selected: ({ address, lat, lng }) => void
 * @param {Function} [config.onUnresolved] - Callback when street could not be found
 */
export const initDeliveryAddressAutocomplete = ({
    inputElement,
    suggestionsContainer,
    landmarkPromptContainer = null,
    onSelect = null,
    onUnresolved = null
}) => {
    if (!inputElement || !suggestionsContainer) return;

    let isSelecting = false;

    const hideSuggestions = () => {
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.innerHTML = '';
    };

    const showLandmarkPrompt = (query) => {
        if (landmarkPromptContainer) {
            landmarkPromptContainer.style.display = 'block';
            const querySpan = landmarkPromptContainer.querySelector('[data-ui="unresolved-query-text"]');
            if (querySpan) querySpan.textContent = query;
        }
        if (typeof onUnresolved === 'function') {
            onUnresolved(query);
        }
    };

    const hideLandmarkPrompt = () => {
        if (landmarkPromptContainer) {
            landmarkPromptContainer.style.display = 'none';
        }
    };

    const searchLocations = debounce(async (query) => {
        if (isSelecting) return;
        const trimmed = (query || '').trim();
        if (trimmed.length < 3) {
            hideSuggestions();
            hideLandmarkPrompt();
            return;
        }

        suggestionsContainer.innerHTML = `
            <div style="padding: 10px 14px; color: var(--muted); font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; border-top-color: var(--brand); margin: 0;"></span>
                Searching street / area...
            </div>
        `;
        suggestionsContainer.style.display = 'block';

        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`);
            const results = await resp.json();

            if (!results || results.length === 0) {
                suggestionsContainer.innerHTML = `
                    <div style="padding: 10px 14px; color: var(--muted); font-size: 0.85rem;">
                        No exact match found on map.
                    </div>
                `;
                suggestionsContainer.style.display = 'block';
                showLandmarkPrompt(trimmed);
                return;
            }

            hideLandmarkPrompt();

            suggestionsContainer.innerHTML = results.map((item, idx) => {
                const parts = (item.display_name || '').split(',').map(p => p.trim());
                const mainTitle = parts[0] || item.display_name;
                const contextSubtitle = parts.slice(1).join(', ');

                return `
                    <div class="address-autocomplete-item" data-index="${idx}" data-lat="${item.lat}" data-lon="${item.lon}" data-display="${item.display_name.replace(/"/g, '&quot;')}"
                        style="padding: 9px 12px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 0.85rem; display: flex; align-items: flex-start; gap: 10px; transition: background 0.15s ease;">
                        <i class="fa-solid fa-location-dot" style="color: var(--brand); margin-top: 3px; font-size: 0.9rem; flex-shrink: 0;"></i>
                        <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; text-overflow: ellipsis;">
                            <span style="color: var(--text); font-weight: 600; line-height: 1.2;">${mainTitle}</span>
                            ${contextSubtitle ? `<span style="color: var(--muted); font-size: 0.76rem; line-height: 1.25;">${contextSubtitle}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            suggestionsContainer.style.display = 'block';

            suggestionsContainer.querySelectorAll('.address-autocomplete-item').forEach(el => {
                el.addEventListener('mouseenter', () => {
                    el.style.background = 'rgba(var(--brand-rgb, 12, 140, 233), 0.08)';
                });
                el.addEventListener('mouseleave', () => {
                    el.style.background = 'transparent';
                });
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const lat = parseFloat(el.dataset.lat);
                    const lng = parseFloat(el.dataset.lon);
                    const fullAddress = el.dataset.display;

                    isSelecting = true;
                    inputElement.value = fullAddress;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                    setTimeout(() => { isSelecting = false; }, 200);

                    hideSuggestions();
                    hideLandmarkPrompt();

                    if (typeof onSelect === 'function') {
                        onSelect({ address: fullAddress, lat, lng });
                    }
                });
            });

        } catch (err) {
            console.error("Autocomplete search error:", err);
            hideSuggestions();
        }
    }, 350);

    inputElement.addEventListener('input', (e) => {
        searchLocations(e.target.value);
    });

    inputElement.addEventListener('focus', () => {
        if (inputElement.value.trim().length >= 3 && suggestionsContainer.children.length > 0) {
            suggestionsContainer.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!inputElement.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            hideSuggestions();
        }
    });

    return {
        hideSuggestions,
        hideLandmarkPrompt,
        showLandmarkPrompt
    };
};
