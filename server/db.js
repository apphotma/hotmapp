import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'database.sqlite');

let dbInstance = null;

export const initDb = async () => {
    if (dbInstance) return dbInstance;

    // Open SQLite database file
    dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log(`[Database] SQLite connected at: ${dbPath}`);

    // Enable foreign keys
    await dbInstance.run('PRAGMA foreign_keys = ON;');

    // Initialize all tables
    await dbInstance.exec(`
        -- Users profile table
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            fullname TEXT,
            phone_number TEXT,
            profile_photo TEXT,
            profile_photo_privacy TEXT DEFAULT 'anyone',
            publicKey TEXT,
            encryptedKeyPair TEXT,
            typingTo TEXT,
            presence_status TEXT DEFAULT 'offline',
            lastSeen BIGINT,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chatId TEXT NOT NULL,
            senderId TEXT,
            text TEXT,
            previewText TEXT,
            type TEXT DEFAULT 'text',
            timestamp INTEGER NOT NULL,
            ephemeralExpiry INTEGER,
            isEncrypted BOOLEAN DEFAULT 0,
            iv TEXT,
            url TEXT,
            fileName TEXT,
            fileSize INTEGER,
            thumbnailUrl TEXT,
            latitude REAL,
            longitude REAL,
            address TEXT,
            staticMapUrl TEXT,
            mapUrl TEXT,
            replyTo TEXT,
            invoiceId TEXT,
            liveSharingEnded BOOLEAN DEFAULT 0,
            duration REAL,
            status TEXT DEFAULT 'sent',
            edited BOOLEAN DEFAULT 0,
            deleted BOOLEAN DEFAULT 0,
            orderConfirmed BOOLEAN DEFAULT 0,
            FOREIGN KEY(senderId) REFERENCES users(uid) ON DELETE SET NULL
        );

        -- Message reactions table
        CREATE TABLE IF NOT EXISTS message_reactions (
            messageId TEXT,
            userId TEXT,
            reaction TEXT,
            PRIMARY KEY (messageId, userId),
            FOREIGN KEY(messageId) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Starred messages table
        CREATE TABLE IF NOT EXISTS starred_messages (
            userId TEXT,
            messageId TEXT,
            chatId TEXT,
            text TEXT,
            type TEXT,
            timestamp INTEGER,
            PRIMARY KEY (userId, messageId)
        );

        -- Chat list mapping table
        CREATE TABLE IF NOT EXISTS chat_list (
            userId TEXT,
            otherUserId TEXT,
            archived BOOLEAN DEFAULT 0,
            pinned BOOLEAN DEFAULT 0,
            muted BOOLEAN DEFAULT 0,
            PRIMARY KEY (userId, otherUserId),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Blocked users table
        CREATE TABLE IF NOT EXISTS blocked_users (
            userId TEXT,
            blockedUid TEXT,
            reason TEXT,
            PRIMARY KEY (userId, blockedUid),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Muted users table
        CREATE TABLE IF NOT EXISTS muted_users (
            userId TEXT,
            mutedUid TEXT,
            PRIMARY KEY (userId, mutedUid),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Excluded contacts table
        CREATE TABLE IF NOT EXISTS excluded_contacts (
            userId TEXT,
            excludedUid TEXT,
            PRIMARY KEY (userId, excludedUid),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Customer list table
        CREATE TABLE IF NOT EXISTS customer_list (
            userId TEXT,
            customerUid TEXT,
            PRIMARY KEY (userId, customerUid),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Friends mapping table
        CREATE TABLE IF NOT EXISTS friends (
            userId TEXT,
            friendUid TEXT,
            PRIMARY KEY (userId, friendUid),
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Friend requests table
        CREATE TABLE IF NOT EXISTS friend_requests (
            fromUid TEXT,
            toUid TEXT,
            status TEXT DEFAULT 'pending',
            PRIMARY KEY (fromUid, toUid),
            FOREIGN KEY(fromUid) REFERENCES users(uid) ON DELETE CASCADE,
            FOREIGN KEY(toUid) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Groups metadata table
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            profilePhoto TEXT,
            description TEXT,
            createdBy TEXT,
            createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );

        -- Group members mapping table
        CREATE TABLE IF NOT EXISTS group_members (
            groupId TEXT,
            userId TEXT,
            role TEXT DEFAULT 'member', -- member, admin
            PRIMARY KEY (groupId, userId),
            FOREIGN KEY(groupId) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Products table
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            ownerId TEXT,
            title TEXT,
            description TEXT,
            price REAL,
            images TEXT, -- JSON stringified array of URLs
            category TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            FOREIGN KEY(ownerId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Business profiles table
        CREATE TABLE IF NOT EXISTS business_profiles (
            userId TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            phone TEXT,
            address TEXT,
            category TEXT,
            logo TEXT,
            deliveryCoverage TEXT, -- JSON stringified coverage
            pickupLocations TEXT, -- JSON stringified locations
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Product reviews table
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            productId TEXT,
            reviewerId TEXT,
            reviewerName TEXT,
            reviewerPhoto TEXT,
            rating INTEGER,
            comment TEXT,
            timestamp INTEGER,
            FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        );

        -- Saved items/collections table
        CREATE TABLE IF NOT EXISTS saved_items (
            userId TEXT,
            sellerId TEXT,
            items TEXT, -- JSON stringified items
            PRIMARY KEY (userId, sellerId)
        );

        -- Orders table
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            buyerId TEXT,
            sellerId TEXT,
            items TEXT, -- JSON stringified items
            total REAL,
            status TEXT DEFAULT 'pending',
            timestamp INTEGER,
            deliveryDetails TEXT, -- JSON stringified details
            paymentDetails TEXT, -- JSON stringified details
            FOREIGN KEY(buyerId) REFERENCES users(uid) ON DELETE SET NULL
        );

        -- Call logs table
        CREATE TABLE IF NOT EXISTS call_logs (
            id TEXT PRIMARY KEY,
            userId TEXT,
            otherUid TEXT,
            type TEXT, -- audio, video
            direction TEXT, -- incoming, outgoing, missed
            timestamp INTEGER,
            duration INTEGER,
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Active call signals table for WebRTC
        CREATE TABLE IF NOT EXISTS call_signals (
            targetUid TEXT PRIMARY KEY,
            senderUid TEXT,
            signalData TEXT, -- JSON stringified signal
            timestamp INTEGER
        );

        -- Active ICE candidates for WebRTC
        CREATE TABLE IF NOT EXISTS ice_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            targetUid TEXT,
            senderUid TEXT,
            candidate TEXT, -- JSON stringified candidate
            timestamp INTEGER
        );

        -- Linked Web App devices sessions
        CREATE TABLE IF NOT EXISTS linked_devices (
            sessionId TEXT PRIMARY KEY,
            userId TEXT,
            deviceInfo TEXT, -- JSON stringified device details
            encryptedSession TEXT,
            status TEXT DEFAULT 'pending', -- pending, authorized
            customToken TEXT,
            lastSeen INTEGER,
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Support tickets table
        CREATE TABLE IF NOT EXISTS support_tickets (
            id TEXT PRIMARY KEY,
            userId TEXT,
            title TEXT,
            description TEXT,
            status TEXT DEFAULT 'open',
            category TEXT,
            created_at INTEGER,
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE SET NULL
        );

        -- Feature requests, problem reports, bug reports
        CREATE TABLE IF NOT EXISTS problem_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            report TEXT,
            timestamp INTEGER
        );

        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            feedback TEXT,
            timestamp INTEGER
        );

        CREATE TABLE IF NOT EXISTS feature_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            request TEXT,
            timestamp INTEGER
        );

        CREATE TABLE IF NOT EXISTS bug_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            bug TEXT,
            timestamp INTEGER
        );

        -- Invitations table
        CREATE TABLE IF NOT EXISTS invitations (
            token TEXT PRIMARY KEY,
            userId TEXT,
            usedBy TEXT,
            status TEXT DEFAULT 'active',
            createdAt INTEGER,
            FOREIGN KEY(userId) REFERENCES users(uid) ON DELETE CASCADE
        );

        -- Generic key-value table for path fallbacks
        CREATE TABLE IF NOT EXISTS firebase_paths (
            path TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    console.log("[Database] All SQLite tables initialized successfully.");
    return dbInstance;
};

export const getDb = () => {
    if (!dbInstance) throw new Error("Database not initialized. Call initDb() first.");
    return dbInstance;
};
