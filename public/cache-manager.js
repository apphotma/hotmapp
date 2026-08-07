const DB_NAME = 'hotmapp_cache_db';
const DB_VERSION = 1;

let dbPromise = null;

export async function getDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            // Messages store: key is message id, with index on chatId
            if (!db.objectStoreNames.contains('messages')) {
                const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                messageStore.createIndex('chatId', 'chatId', { unique: false });
                messageStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Products store: key is product id, with indexes on ownerId and category
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'id' });
                productStore.createIndex('ownerId', 'ownerId', { unique: false });
                productStore.createIndex('category', 'category', { unique: false });
            }

            // Shops (Business profiles): key is userId
            if (!db.objectStoreNames.contains('shops')) {
                db.createObjectStore('shops', { keyPath: 'userId' });
            }

            // User profiles: key is uid
            if (!db.objectStoreNames.contains('profiles')) {
                db.createObjectStore('profiles', { keyPath: 'uid' });
            }

            // Orders (Invoices): key is id
            if (!db.objectStoreNames.contains('orders')) {
                db.createObjectStore('orders', { keyPath: 'id' });
            }

            // Recently viewed: key is id
            if (!db.objectStoreNames.contains('recently_viewed')) {
                db.createObjectStore('recently_viewed', { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });

    return dbPromise;
}


// Generic get helper
export async function getCachedItem(storeName, key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Cache Get Error in ${storeName} for key ${key}:`, err);
        return null;
    }
}

// Generic put helper
export async function cacheItem(storeName, item) {
    if (!item) return;
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Cache Put Error in ${storeName}:`, err);
    }
}

// Generic delete helper
export async function deleteCachedItem(storeName, key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Cache Delete Error in ${storeName} for key ${key}:`, err);
    }
}

// Retrieve multiple messages by chatId sorted by timestamp
export async function getCachedMessages(chatId) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('messages', 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('chatId');
            const request = index.getAll(chatId);

            request.onsuccess = () => {
                const results = request.result || [];
                // Sort by ID (chronological push ID) ascending
                results.sort((a, b) => a.id.localeCompare(b.id));
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Error getting cached messages for chat ${chatId}:`, err);
        return [];
    }
}

// Retrieve multiple products by ownerId
export async function getCachedProductsByOwner(ownerId) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('products', 'readonly');
            const store = transaction.objectStore('products');
            const index = store.index('ownerId');
            const request = index.getAll(ownerId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Error getting cached products for owner ${ownerId}:`, err);
        return [];
    }
}

// Retrieve all cached products
export async function getAllCachedProducts() {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('products', 'readonly');
            const store = transaction.objectStore('products');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("Error getting all cached products:", err);
        return [];
    }
}

// Generic clear store helper
export async function clearStore(storeName) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`Error clearing store ${storeName}:`, err);
    }
}
