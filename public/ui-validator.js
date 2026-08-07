import { elements } from './elements.js';

/**
 * Validates the presence of critical UI elements marked with [data-ui] attributes.
 * Logs detailed errors to the console if essential components are missing.
 */
export const validateUI = () => {
    const criticalKeys = [
        'chatContainer',
        'chatSidebar',
        'chatArea',
        'storeArea',
        'messagesContainer',
        'messageInput',
        'sendBtn',
        'authOverlay',
        'mainAppContent'
    ];

    console.group('%c 🔍 UI System Validation', 'color: #00a884; font-weight: bold; font-size: 12px;');
    
    let errorCount = 0;

    criticalKeys.forEach(key => {
        const element = elements[key];
        if (!element) {
            errorCount++;
            console.error(
                `%c[Missing]%c Required UI component "%c${key}%c" not found. ` +
                `Ensure an element with [data-ui] exists in the HTML.`,
                'color: #ff4d4d; font-weight: bold;', 'color: inherit;', 'color: #333; font-weight: bold;', 'color: inherit;'
            );
        }
    });

    if (errorCount === 0) {
        console.log('%c✅ All critical UI data-attributes verified.', 'color: #00a884;');
    }

    console.groupEnd();
};