import {
    signInWithCustomToken,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    deleteUser,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    PhoneAuthProvider,
    updatePhoneNumber
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from './firebase-config.js';

/**
 * Logs in using a custom token (e.g. from QR linking session)
 */
export const loginWithCustomToken = async (token) => {
    const userCredential = await signInWithCustomToken(auth, token);
    return userCredential.user;
};

/**
 * Logs out the current user
 */
export const logoutUser = async () => {
    await signOut(auth);
};

/**
 * Listens for authentication state changes
 */
export const subscribeToAuthChanges = (callback) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Initializes ReCAPTCHA verification for Phone Auth
 */
export const setupRecaptcha = (containerId) => {
    console.log("DEBUG [setupRecaptcha]: auth =", auth, "typeof auth =", typeof auth);
    console.log("DEBUG [setupRecaptcha]: containerId =", containerId);
    
    // Recreate the widget element inside the container to avoid "already rendered" errors
    const container = document.getElementById(containerId);
    if (container) {
        if (window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier.clear();
            } catch (e) {
                console.warn("Error clearing old verifier:", e);
            }
            window.recaptchaVerifier = null;
        }
        container.innerHTML = '<div id="recaptcha-widget"></div>';
    }

    window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-widget', {
        'size': 'invisible',
        'callback': (response) => {
            // reCAPTCHA solved, will proceed to SMS
        }
    }, auth);
    return window.recaptchaVerifier;
};

/**
 * Sends an SMS verification code to the phone number
 */
export const sendSmsCode = async (phoneNumber) => {
    let verifier = window.recaptchaVerifier;
    if (!verifier) {
        verifier = setupRecaptcha('recaptcha-container');
    }
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return confirmationResult;
};

/**
 * Deletes the current authenticated user
 */
export const deleteAuthUser = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in.");
    await deleteUser(user);
};

/**
 * Sets auth persistence (local if rememberMe is true, session otherwise)
 */
export const setAuthPersistence = async (rememberMe) => {
    const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceType);
};

/**
 * Sends a verification code to a new phone number
 */
export const verifyNewPhoneNumber = async (newPhoneNumber, verifier) => {
    const provider = new PhoneAuthProvider(auth);
    return await provider.verifyPhoneNumber(newPhoneNumber, verifier);
};

/**
 * Updates the current user's phone number using verified credential
 */
export const changeUserPhoneNumber = async (verificationId, verificationCode) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in.");
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    await updatePhoneNumber(user, credential);
};