const DB_NAME = 'hotmapp_crypto_keys';
const STORE_NAME = 'keys';

// Opens or upgrades IndexedDB database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Retrieves a key from IndexedDB
export async function getStoredKey(key) {
    const db = await openDB();
    const value = await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return value;
}

// Saves a key/value pair to IndexedDB
export async function setStoredKey(key, value) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// In-memory cache for derived AES keys (keys: recipient public key JWK string, values: CryptoKey)
const derivedKeysCache = new Map();

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Initializes keypair for a user. If it doesn't exist, generates one and stores it in IndexedDB.
 * Returns the public key (JWK format) for publishing.
 */
export async function initUserKeys(userId) {
    if (!userId) throw new Error("User ID is required for key initialization");

    if (!window.crypto || !window.crypto.subtle) {
        console.warn("Web Crypto API (subtle) is not supported in this browser context (unsecure HTTP origin?). E2EE is disabled.");
        return null;
    }

    // Check if keypair already exists
    const stored = await getStoredKey(userId);
    if (stored && stored.publicKey && stored.privateKey) {
        return stored.publicKey;
    }

    // Generate new ECDH P-256 key pair
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256"
        },
        true, // extractable
        ["deriveKey", "deriveBits"]
    );

    // Export keys as JWK
    const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Store in IndexedDB
    await setStoredKey(userId, {
        publicKey: publicJwk,
        privateKey: privateJwk
    });

    console.log(`Generated and stored new E2EE keys for user: ${userId}`);
    return publicJwk;
}

/**
 * Resolves a shared AES key, checking the cache first or deriving it if needed.
 */
export async function getOrDeriveSharedKey(userId, otherUserPublicJwk) {
    if (!userId || !otherUserPublicJwk) return null;
    if (!window.crypto || !window.crypto.subtle) return null;

    const jwkString = JSON.stringify(otherUserPublicJwk);
    if (derivedKeysCache.has(jwkString)) {
        return derivedKeysCache.get(jwkString);
    }

    // Get our keys
    const stored = await getStoredKey(userId);
    if (!stored || !stored.privateKey) {
        console.warn("Our private key not found in IndexedDB. Cannot derive shared key.");
        return null;
    }

    try {
        // Import our private key
        const ourPrivateKey = await window.crypto.subtle.importKey(
            "jwk",
            stored.privateKey,
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            ["deriveKey", "deriveBits"]
        );

        // Import their public key
        const theirPublicKey = await window.crypto.subtle.importKey(
            "jwk",
            otherUserPublicJwk,
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            []
        );

        // Derive shared AES-GCM 256 key
        const sharedKey = await window.crypto.subtle.deriveKey(
            {
                name: "ECDH",
                public: theirPublicKey
            },
            ourPrivateKey,
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );

        // Cache it
        derivedKeysCache.set(jwkString, sharedKey);
        return sharedKey;
    } catch (e) {
        console.error("Error deriving shared key:", e);
        return null;
    }
}

/**
 * Encrypts a plaintext string using an AES-GCM key.
 * Returns { ciphertext: base64, iv: base64 }
 */
export async function encryptText(plaintext, aesKey) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API (subtle) is not supported in this browser context.");
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for AES-GCM

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        data
    );

    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypts a base64 ciphertext using a base64 IV and an AES-GCM key.
 * Returns the decrypted plaintext string.
 */
export async function decryptText(ciphertextBase64, ivBase64, aesKey) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API (subtle) is not supported in this browser context.");
    }
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

// Derives an AES-GCM CryptoKey from a string (password or UID)
async function deriveKeyFromPassword(password) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const hash = await window.crypto.subtle.digest("SHA-256", passwordBytes);
    return window.crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a key pair object with a password/UID.
 * Returns the encrypted object { ciphertext: base64, iv: base64 }
 */
export async function encryptKeyPair(keyPair, password) {
    if (!window.crypto || !window.crypto.subtle) return null;
    const aesKey = await deriveKeyFromPassword(password);
    const plaintext = JSON.stringify(keyPair);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        data
    );

    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypts an encrypted key pair object with a password/UID.
 * Returns the decrypted key pair object.
 */
export async function decryptKeyPair(encryptedKeyPair, password) {
    if (!window.crypto || !window.crypto.subtle) return null;
    const aesKey = await deriveKeyFromPassword(password);
    const ciphertext = base64ToBuffer(encryptedKeyPair.ciphertext);
    const iv = base64ToBuffer(encryptedKeyPair.iv);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
}
