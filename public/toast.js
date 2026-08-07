/**
 * Displays a toast notification
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
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
};