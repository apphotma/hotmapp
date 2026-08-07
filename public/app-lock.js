import { elements } from './elements.js';
import { auth } from './firebase-config.js';
import { showToast } from './toast.js';
import { logoutUser } from './auth-service.js';

let currentPin = ''; // PIN entered on lock screen
let lastHiddenTime = 0; // Timestamp of when the app was minimized/backgrounded

export const initAppLock = () => {
    // 1. Setup UI fields in Privacy Settings Modal when privacy settings are loaded/opened
    elements.settingsPrivacyBtn?.addEventListener('click', () => {
        setTimeout(loadAppLockSettings, 50);
    });

    // Show/hide PIN fields on checkbox change
    elements.privacyAppLockInput?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const savedPin = localStorage.getItem('hotmapp_app_lock_pin');

        if (isChecked) {
            if (elements.appLockPinGroup) elements.appLockPinGroup.style.display = 'block';
            if (elements.appLockDurationGroup) elements.appLockDurationGroup.style.display = 'block';
            if (elements.pinInputLabel) elements.pinInputLabel.textContent = 'New 4-Digit PIN';
            if (elements.verifyCurrentPinGroup) {
                elements.verifyCurrentPinGroup.style.display = savedPin ? 'block' : 'none';
            }
            // Restore new PIN form-group visibility if it was hidden
            const newPinFormGroup = elements.privacyAppLockPinInput?.closest('.form-group');
            if (newPinFormGroup) newPinFormGroup.style.display = 'block';
        } else {
            // If unchecking but we have a saved PIN, they must verify the current PIN to turn it off
            if (savedPin) {
                if (elements.appLockPinGroup) elements.appLockPinGroup.style.display = 'block';
                if (elements.verifyCurrentPinGroup) elements.verifyCurrentPinGroup.style.display = 'block';
                if (elements.appLockDurationGroup) elements.appLockDurationGroup.style.display = 'none';
                // Hide new pin input since we're just disabling
                const newPinFormGroup = elements.privacyAppLockPinInput?.closest('.form-group');
                if (newPinFormGroup) newPinFormGroup.style.display = 'none';
            } else {
                // No PIN was saved, just hide everything
                if (elements.appLockPinGroup) elements.appLockPinGroup.style.display = 'none';
                if (elements.appLockDurationGroup) elements.appLockDurationGroup.style.display = 'none';
            }
        }
    });

    // Add submit hook to validate the App Lock options on privacyForm submit
    elements.privacyForm?.addEventListener('submit', (e) => {
        const enabled = elements.privacyAppLockInput?.checked;
        const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
        const newPin = elements.privacyAppLockPinInput?.value || '';
        const inputCurrentPin = elements.privacyCurrentPinInput?.value || '';
        const duration = elements.privacyAppLockDurationInput?.value || '0';

        if (enabled) {
            if (savedPin) {
                // Check if they are trying to change the PIN
                if (newPin) {
                    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                        showToast("New PIN must be exactly 4 digits", "warning");
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }
                    if (inputCurrentPin !== savedPin) {
                        showToast("Incorrect Current PIN", "error");
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }
                    // PIN verified and changed!
                    localStorage.setItem('hotmapp_app_lock_pin', newPin);
                    showToast("PIN updated successfully", "success");
                }
            } else {
                // No PIN set yet. They MUST set a new 4-digit PIN.
                if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                    showToast("Please enter a 4-digit numeric PIN to enable App Lock", "warning");
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                localStorage.setItem('hotmapp_app_lock_pin', newPin);
                showToast("App Lock enabled successfully", "success");
            }
            // Save duration
            localStorage.setItem('hotmapp_app_lock_duration', duration);
        } else {
            // Disabling App Lock
            if (savedPin) {
                if (inputCurrentPin !== savedPin) {
                    showToast("Incorrect Current PIN to disable App Lock", "error");
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                // Disable confirmed
                localStorage.removeItem('hotmapp_app_lock_pin');
                localStorage.removeItem('hotmapp_app_lock_duration');
                showToast("App Lock disabled successfully", "success");
            }
        }

        // Reset inputs
        if (elements.privacyAppLockPinInput) elements.privacyAppLockPinInput.value = '';
        if (elements.privacyCurrentPinInput) elements.privacyCurrentPinInput.value = '';
    });

    // 2. Lock Screen Event Listeners (Numeric Keypad clicks)
    const lockOverlay = elements.appLockOverlay;
    if (lockOverlay) {
        const keypadBtns = lockOverlay.querySelectorAll('.keypad-btn');
        keypadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.val;
                const action = btn.dataset.action;

                if (val !== undefined) {
                    handlePinDigit(val);
                } else if (action === 'clear') {
                    handleClear();
                } else if (action === 'delete') {
                    handleDelete();
                }
            });
        });

        // Focus overlay to catch physical keyboard inputs
        document.addEventListener('keydown', (e) => {
            if (lockOverlay.style.display === 'flex') {
                if (e.key >= '0' && e.key <= '9') {
                    handlePinDigit(e.key);
                } else if (e.key === 'Backspace') {
                    handleDelete();
                } else if (e.key === 'Escape' || e.key === 'Delete') {
                    handleClear();
                }
            }
        });

        // Logout recovery link on lock screen
        elements.appLockLogoutBtn?.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout? The App Lock PIN will be cleared.")) {
                try {
                    await logoutUser();
                    localStorage.removeItem('hotmapp_app_lock_pin');
                    localStorage.removeItem('hotmapp_app_lock_duration');
                    lockOverlay.style.display = 'none';
                    showToast("Logged out and PIN cleared.", "info");
                    setTimeout(() => window.location.reload(), 500);
                } catch (error) {
                    showToast("Error logging out", "error");
                }
            }
        });
    }

    // 3. Tab Visibility Background Locking
    document.addEventListener('visibilitychange', () => {
        const enabled = localStorage.getItem('hotmapp_app_lock_pin');
        if (!enabled || !auth.currentUser) return;

        if (document.visibilityState === 'hidden') {
            lastHiddenTime = Date.now();
        } else if (document.visibilityState === 'visible') {
            const duration = parseInt(localStorage.getItem('hotmapp_app_lock_duration') || '0', 10);
            const elapsed = (Date.now() - lastHiddenTime) / 1000; // in seconds

            if (elapsed >= duration) {
                showLockScreen();
            }
        }
    });

    // Check on bootstrap if we should display lock screen immediately
    setTimeout(() => {
        if (auth.currentUser && localStorage.getItem('hotmapp_app_lock_pin')) {
            showLockScreen();
        }
    }, 600);
};

const loadAppLockSettings = () => {
    const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
    const savedDuration = localStorage.getItem('hotmapp_app_lock_duration') || '0';

    const checkbox = elements.privacyAppLockInput;
    const durationSelect = elements.privacyAppLockDurationInput;

    if (checkbox) {
        checkbox.checked = !!savedPin;
        // Trigger change event to set visible fields
        checkbox.dispatchEvent(new Event('change'));
    }

    if (durationSelect) {
        durationSelect.value = savedDuration;
    }

    // Reset text fields
    if (elements.privacyAppLockPinInput) elements.privacyAppLockPinInput.value = '';
    if (elements.privacyCurrentPinInput) elements.privacyCurrentPinInput.value = '';
    
    // Reset new PIN form-group display just in case it was hidden previously
    const newPinFormGroup = elements.privacyAppLockPinInput?.closest('.form-group');
    if (newPinFormGroup) newPinFormGroup.style.display = 'block';
};

export const showLockScreen = () => {
    const lockOverlay = elements.appLockOverlay;
    if (lockOverlay && lockOverlay.style.display !== 'flex') {
        currentPin = '';
        updateDots();
        if (elements.appLockErrorMsg) elements.appLockErrorMsg.textContent = '';
        lockOverlay.style.display = 'flex';
        lockOverlay.classList.remove('fade-out');
    }
};

const handlePinDigit = (digit) => {
    if (currentPin.length < 4) {
        currentPin += digit;
        updateDots();

        if (currentPin.length === 4) {
            // Wait a tiny bit so the user sees the final dot filled, then verify
            setTimeout(verifyPin, 150);
        }
    }
};

const handleDelete = () => {
    if (currentPin.length > 0) {
        currentPin = currentPin.slice(0, -1);
        updateDots();
    }
};

const handleClear = () => {
    currentPin = '';
    updateDots();
};

const updateDots = () => {
    const lockOverlay = elements.appLockOverlay;
    if (!lockOverlay) return;

    const dots = lockOverlay.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('filled', index < currentPin.length);
    });
};

const verifyPin = () => {
    const savedPin = localStorage.getItem('hotmapp_app_lock_pin');
    const lockOverlay = elements.appLockOverlay;
    const lockCard = lockOverlay?.querySelector('.lock-card');

    if (currentPin === savedPin) {
        // Success! Unlock app
        currentPin = '';
        updateDots();
        if (lockOverlay) {
            lockOverlay.classList.add('fade-out');
            setTimeout(() => {
                lockOverlay.style.display = 'none';
            }, 400);
        }
        showToast("App unlocked", "success");
    } else {
        // Failure: Shake and show error
        currentPin = '';
        updateDots();
        if (elements.appLockErrorMsg) elements.appLockErrorMsg.textContent = "Incorrect PIN. Try again.";
        
        if (lockCard) {
            lockCard.classList.add('shake');
            // Play a light vibration if on mobile
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            setTimeout(() => {
                lockCard.classList.remove('shake');
            }, 400);
        }
    }
};
