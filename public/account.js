import { elements } from './elements.js';
import { showToast } from './toast.js';
import { auth } from './firebase-config.js';
import { 
    deleteAuthUser,
    subscribeToAuthChanges,
    setupRecaptcha,
    verifyNewPhoneNumber,
    changeUserPhoneNumber
} from './auth-service.js?v=1.1.4';
import { 
    deleteUserProducts, 
    deleteFullUserProfile,
    updateUserProfile,
    getUserProfile
} from './database-service.js?v=1.1.4';
import { hideElement, showElement } from './utils.js';

export const initAccount = () => {
    console.log("initAccount is running. settingsAccountBtn element is:", elements.settingsAccountBtn);
    let openedFromSettings = false;
    let changePhoneVerificationId = null;

    // Helper: Reset form state and error messages
    const resetFormState = () => {
        if (elements.accountForm) {
            elements.accountForm.reset();
        }
        document.querySelectorAll('.account-modal .error-msg').forEach(el => el.textContent = '');
        document.querySelectorAll('.account-modal input').forEach(el => el.classList.remove('invalid'));
    };

    // Helper: Check provider type (Social vs Email/Password) and update UI
    const configureAccountUI = (user) => {
        if (!user) return;

        const nameGroup = document.getElementById('account-name-group');
        const nameTitle = document.getElementById('account-name-title');

        if (nameGroup) showElement(nameGroup, 'block');
        if (nameTitle) showElement(nameTitle);
    };

    const openAccountModal = async (fromSettings = false) => {
        openedFromSettings = fromSettings;
        const user = auth.currentUser;
        if (!user) {
            showToast("Please sign in to view account settings.", "error");
            return;
        }

        resetFormState();
        configureAccountUI(user);

        // Pre-populate phone number
        if (elements.accountNewPhone) {
            elements.accountNewPhone.value = user.phoneNumber || '';
            elements.accountNewPhone.disabled = false;
        }
        
        // Reset change phone state
        changePhoneVerificationId = null;
        if (elements.accountPhoneOtpGroup) hideElement(elements.accountPhoneOtpGroup);
        if (elements.accountChangePhoneBtn) elements.accountChangePhoneBtn.textContent = 'Send Code';

        // Fetch user profile from DB to pre-populate current name
        try {
            const profile = await getUserProfile(user.uid);
            if (profile && elements.accountNewName) {
                elements.accountNewName.value = profile.fullname || '';
            }
        } catch (err) {
            console.error("Error fetching user profile for account settings:", err);
        }

        showElement(elements.accountModal, 'flex');
    };

    // Open Account settings from Main Settings Modal
    elements.settingsAccountBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        await openAccountModal(true);
    });

    // Close Account Modal
    elements.closeAccountModalBtn?.addEventListener('click', () => {
        hideElement(elements.accountModal);
        if (openedFromSettings) {
            showElement(elements.settingsModal, 'flex');
            openedFromSettings = false;
        }
    });

    // Handle form submit (update email/password/name)
    elements.accountForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const newName = elements.accountNewName?.value.trim();

        // Clear error classes
        document.querySelectorAll('.account-modal .error-msg').forEach(el => el.textContent = '');
        document.querySelectorAll('.account-modal input').forEach(el => el.classList.remove('invalid'));

        if (newName === "") {
            const err = document.querySelector('[data-ui="account-new-name-error"]');
            if (err) err.textContent = "Full name cannot be empty";
            elements.accountNewName?.classList.add('invalid');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving...';

        try {
            // Get current profile data to check for name changes
            const profile = await getUserProfile(user.uid);

            // Update Name if changed
            let nameUpdated = false;
            if (newName && newName !== (profile?.fullname || '')) {
                await updateUserProfile(user.uid, { fullname: newName });
                nameUpdated = true;
            }

            if (nameUpdated) {
                showToast("Name updated successfully!", "success");
                hideElement(elements.accountModal);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                showToast("No changes were made.", "info");
                hideElement(elements.accountModal);
                if (openedFromSettings) {
                    showElement(elements.settingsModal, 'flex');
                }
            }
        } catch (err) {
            console.error("Account update error:", err);
            showToast(err.message || "Failed to update account settings.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });

    // Handle change phone click (send OTP / verify and update number)
    elements.accountChangePhoneBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const phoneInput = elements.accountNewPhone;
        const otpInput = elements.accountPhoneOtp;
        const otpGroup = elements.accountPhoneOtpGroup;
        const btn = elements.accountChangePhoneBtn;
        
        const phoneError = elements.accountNewPhoneError;
        const otpError = elements.accountPhoneOtpError;

        if (phoneError) phoneError.textContent = '';
        if (otpError) otpError.textContent = '';

        const newPhone = phoneInput?.value.trim();

        if (!changePhoneVerificationId) {
            // Phase 1: Send SMS OTP
            if (!newPhone) {
                if (phoneError) phoneError.textContent = 'Phone number is required';
                return;
            }
            if (!newPhone.startsWith('+')) {
                if (phoneError) phoneError.textContent = 'Phone number must start with "+" and country code (e.g. +16505550101)';
                return;
            }
            if (newPhone === user.phoneNumber) {
                if (phoneError) phoneError.textContent = 'This is already your current phone number';
                return;
            }

            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Sending...';

            try {
                // Initialize Recaptcha
                const recaptchaVerifier = setupRecaptcha('recaptcha-container');
                
                // Trigger verification
                changePhoneVerificationId = await verifyNewPhoneNumber(newPhone, recaptchaVerifier);
                
                showToast("SMS verification code sent!", "info");
                
                if (phoneInput) phoneInput.disabled = true;
                if (otpGroup) showElement(otpGroup, 'block');
                if (otpInput) {
                    otpInput.required = true;
                    otpInput.focus();
                }
                
                btn.textContent = 'Verify Code';
            } catch (err) {
                console.error("Error sending verification code for number change:", err);
                if (phoneError) phoneError.textContent = err.message || 'Failed to send verification code.';
                changePhoneVerificationId = null;
            } finally {
                btn.disabled = false;
            }
        } else {
            // Phase 2: Verify code and update phone number
            const code = otpInput?.value.trim();
            if (!code) {
                if (otpError) otpError.textContent = 'Verification code is required';
                return;
            }

            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Verifying...';

            try {
                // Update phone in Auth
                await changeUserPhoneNumber(changePhoneVerificationId, code);
                
                // Update phone in Database
                await updateUserProfile(user.uid, { phoneNumber: newPhone });
                
                showToast("Phone number updated successfully!", "success");
                
                // Reset form state
                changePhoneVerificationId = null;
                if (phoneInput) phoneInput.disabled = false;
                if (otpGroup) hideElement(otpGroup);
                
                hideElement(elements.accountModal);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (err) {
                console.error("Error changing phone number:", err);
                if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/phone-number-already-exists') {
                    if (otpError) otpError.textContent = 'This phone number is already registered to another account.';
                } else {
                    if (otpError) otpError.textContent = err.message || 'Verification failed. Please try again.';
                }
            } finally {
                btn.disabled = false;
            }
        }
    });

    // Account Deletion Flow
    const openDeleteAccountModal = () => {
        hideElement(elements.settingsModal);
        hideElement(elements.accountModal);
        showElement(elements.deleteAccountModal, 'flex');
    };

    // Open from Account Modal
    document.querySelector('[data-ui="account-delete-trigger-btn"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        openDeleteAccountModal();
    });

    // Cancel / Close Deletion
    elements.cancelDeleteAccountBtn?.addEventListener('click', () => {
        hideElement(elements.deleteAccountModal);
        if (openedFromSettings) {
            showElement(elements.settingsModal, 'flex');
        }
    });

    elements.closeDeleteAccountModalBtn?.addEventListener('click', () => {
        hideElement(elements.deleteAccountModal);
        if (openedFromSettings) {
            showElement(elements.settingsModal, 'flex');
        }
    });

    // Perform Deletion
    elements.deleteAccountBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const btn = elements.deleteAccountBtn;
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Deleting Account...';

        try {
            // 1. Perform database cleanup
            showToast("Cleaning up user products...", "info");
            await deleteUserProducts(user.uid);

            showToast("Closing user profile...", "info");
            await deleteFullUserProfile(user.uid);

            // 2. Delete Firebase Auth account
            showToast("Deleting authentication record...", "info");
            await deleteAuthUser();

            // Clear local details on success
            localStorage.removeItem('hotmapp_cart_data');
            localStorage.removeItem('hotmapp_saved_data');
            localStorage.removeItem('hotmapp_app_lock_pin');
            localStorage.removeItem('hotmapp_app_lock_duration');

            showToast("Account deleted successfully.", "success");
            hideElement(elements.deleteAccountModal);
        } catch (err) {
            console.error("Account deletion error:", err);
            if (err.code === 'auth/requires-recent-login') {
                showToast("Please log out and sign in again to verify credentials before deleting.", "error");
            } else {
                showToast(err.message || "Failed to delete account. Please try again.", "error");
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });
};
