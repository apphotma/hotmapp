import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { getMessaging, isSupported } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging.js";

// Firebase configuration for project: HOTMA
// Replace these placeholders with your actual keys from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCpCuDfScVNNRwgl9eOzzV4vL1T0iSRYTk",
    authDomain: "hotmapp.shop",
    databaseURL: "https://hotma-app-default-rtdb.firebaseio.com",
    projectId: "hotma-app",
    storageBucket: "hotma-app.firebasestorage.app",
    messagingSenderId: "467171609873",
    appId: "1:467171609873:web:63a6817d6ef96eb8e9d0b0",
    measurementId: "G-43QE2W6C4K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export service instances
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

// Initialize messaging conditionally based on browser support
export const messagingPromise = isSupported().then((supported) => {
    if (supported) {
        return getMessaging(app);
    } else {
        console.warn("FCM is not supported in this browser environment.");
        return null;
    }
}).catch((err) => {
    console.error("Failed to determine FCM support:", err);
    return null;
});

// VAPID Key Placeholder - Replace with your actual Public Web Push Key from Firebase Console
export const VAPID_KEY = "BI0piwLzbMz9jxWY4d4o06OT7dgzpsAJOb8puJmdNkjzJIjQCkZuiLzWiF-vjeRixK8VWcrf_Kr6dxJfn4ho-a0";

// Force LocalStorage persistence so auth state can be read/written for QR code device linking
setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Failed to set auth persistence:", err);
});