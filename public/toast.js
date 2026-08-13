/**
 * Displays a toast notification with premium icons and micro-animations.
 * @param {string} message - The text to display
 * @param {'info' | 'success' | 'warning' | 'error'} type - The style of the toast
 * @param {number} duration - Time in ms before the toast disappears
 */
export const showToast = (message, type = 'info', duration = 3000) => {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add success animation elements or default icons
    if (type === 'success') {
        toast.innerHTML = `
            <div class="toast-success-icon-wrapper">
                <svg class="toast-success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="toast-success-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="toast-success-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
            </div>
            <span class="toast-message">${message}</span>
            <div class="toast-confetti-emitter"></div>
        `;
    } else {
        let iconHtml = '';
        if (type === 'error') {
            iconHtml = '<i class="fa-solid fa-circle-xmark toast-icon" style="color: #fff;"></i>';
        } else if (type === 'warning') {
            iconHtml = '<i class="fa-solid fa-circle-exclamation toast-icon" style="color: #fff;"></i>';
        } else {
            iconHtml = '<i class="fa-solid fa-circle-info toast-icon" style="color: #fff;"></i>';
        }
        toast.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                ${iconHtml}
                <span class="toast-message">${message}</span>
            </div>
        `;
    }
    
    container.appendChild(toast);
    
    // Trigger confetti burst for success toasts
    if (type === 'success') {
        const emitter = toast.querySelector('.toast-confetti-emitter');
        if (emitter) {
            for (let i = 0; i < 12; i++) {
                const particle = document.createElement('div');
                particle.className = 'toast-confetti-particle';
                particle.style.setProperty('--x', `${(Math.random() - 0.5) * 80}px`);
                particle.style.setProperty('--y', `${(Math.random() - 0.5) * 80}px`);
                particle.style.setProperty('--color', ['#fff', '#6fd3b8', '#ffeb3b', '#e91e63'][Math.floor(Math.random() * 4)]);
                particle.style.setProperty('--delay', `${Math.random() * 100}ms`);
                emitter.appendChild(particle);
            }
        }
    }
    
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

/**
 * Shows a full-screen premium visual checkmark and confetti explosion animation.
 * @param {string} title - The title of the successful action (e.g. "Order Placed!")
 * @param {string} subtitle - Extra descriptive text (e.g. "Your invoice has been sent to the chat.")
 */
export const showActionSuccessAnimation = (title, subtitle = '') => {
    const overlay = document.createElement('div');
    overlay.className = 'success-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="success-fullscreen-card">
            <div class="success-checkmark-wrapper">
                <svg class="success-large-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="success-large-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="success-large-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
            </div>
            <h2 class="success-large-title">${title}</h2>
            ${subtitle ? `<p class="success-large-subtitle">${subtitle}</p>` : ''}
        </div>
        <div class="success-confetti-canvas-container"></div>
    `;
    document.body.appendChild(overlay);

    // Emitters for confetti explosion
    const container = overlay.querySelector('.success-confetti-canvas-container');
    if (container) {
        const colors = ['#fff', '#6fd3b8', '#ffeb3b', '#e91e63', '#2196f3', '#4caf50'];
        for (let i = 0; i < 80; i++) {
            const particle = document.createElement('div');
            particle.className = 'success-large-confetti-particle';
            const angle = Math.random() * Math.PI * 2;
            const distance = 80 + Math.random() * 200;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance - 20; // Bias slightly upwards
            particle.style.setProperty('--x', `${x}px`);
            particle.style.setProperty('--y', `${y}px`);
            particle.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
            particle.style.setProperty('--delay', `${Math.random() * 200}ms`);
            particle.style.setProperty('--rotate', `${Math.random() * 360}deg`);
            container.appendChild(particle);
        }
    }

    // Fade out and remove
    setTimeout(() => {
        overlay.classList.add('success-overlay-out');
        setTimeout(() => overlay.remove(), 500);
    }, 2200);
};