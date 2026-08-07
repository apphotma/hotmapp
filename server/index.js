import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

import admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';

let fcmInitialized = false;
try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.cert(serviceAccount)
        });
        fcmInitialized = true;
        console.log("[FCM] Firebase Admin initialized successfully from service account file.");
    } else {
        console.log("[FCM] Firebase Admin not initialized: service-account.json not found.");
    }
} catch (e) {
    console.warn("[FCM] Failed to initialize Firebase Admin:", e.message);
}

const sendFCMNotification = async (recipientId, title, body, data = {}) => {
    if (!fcmInitialized) return;
    try {
        const rows = await db.all("SELECT value FROM firebase_paths WHERE path LIKE ?", [`users/${recipientId}/fcmTokens/%`]);
        const tokens = [];
        rows.forEach(r => {
            try {
                const val = JSON.parse(r.value);
                if (val && val.token) tokens.push(val.token);
            } catch (e) {}
        });

        if (tokens.length === 0) {
            console.log(`[FCM] No registered FCM tokens found for user: ${recipientId}`);
            return;
        }

        // Convert all data object properties to strings for FCM compatibility
        const stringData = {};
        Object.entries(data).forEach(([k, v]) => {
            stringData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        });

        const message = {
            notification: { title, body },
            data: {
                ...stringData,
                title,
                body
            },
            tokens: tokens
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`[FCM] Sent notification to ${response.successCount} devices of user: ${recipientId}`);
    } catch (error) {
        console.error("[FCM] Error sending multicast notification:", error);
    }
};

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[HTTP Request] ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log(`[HTTP Request Body]`, JSON.stringify(req.body));
    next();
});

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage setup
const storageConfig = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, name);
    }
});
const upload = multer({ storage: storageConfig });

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${backendUrl}/uploads/${req.file.filename}`;
        console.log(`[Upload] File uploaded successfully: ${fileUrl}`);
        res.json({ url: fileUrl });
    } catch (e) {
        console.error('[Upload] Error uploading file:', e);
        res.status(500).json({ error: e.message });
    }
});

// File delete endpoint
app.post('/api/delete-file', (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Missing url parameter' });

        const parts = url.split('/uploads/');
        if (parts.length === 2) {
            const filename = parts[1];
            const filepath = path.join(uploadsDir, filename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`[Upload] File deleted successfully: ${filepath}`);
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[Upload] Error deleting file:', e);
        res.status(500).json({ error: e.message });
    }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Map of active sockets for real-time presence
const activeSockets = new Map(); // socket.id -> userId

// Initialize database before starting server
let db;
initDb().then((database) => {
    db = database;
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`[Server] Node.js VPS server listening on port ${PORT}`);
    });
}).catch(err => {
    console.error("[Server] Failed to initialize database:", err);
});

// --- HELPER FUNCTION FOR USER DATA TRANSFORMATION ---
const formatUserRow = (row) => {
    if (!row) return null;
    let publicKey = undefined;
    let encryptedKeyPair = undefined;
    try {
        if (row.publicKey) publicKey = typeof row.publicKey === 'string' ? JSON.parse(row.publicKey) : row.publicKey;
    } catch (e) {}
    try {
        if (row.encryptedKeyPair) encryptedKeyPair = typeof row.encryptedKeyPair === 'string' ? JSON.parse(row.encryptedKeyPair) : row.encryptedKeyPair;
    } catch (e) {}

    return {
        uid: row.uid,
        fullname: row.fullname || '',
        phoneNumber: row.phone_number || '',
        profilePhoto: row.profile_photo || '',
        publicKey,
        encryptedKeyPair
    };
};

const parseUserProfileInput = (profile) => {
    if (!profile) return {};
    return {
        fullname: profile.fullname || null,
        phone_number: profile.phoneNumber || profile.phone_number || null,
        profile_photo: profile.profilePhoto || profile.profile_photo || null,
        publicKey: profile.publicKey ? (typeof profile.publicKey === 'object' ? JSON.stringify(profile.publicKey) : profile.publicKey) : null,
        encryptedKeyPair: profile.encryptedKeyPair ? (typeof profile.encryptedKeyPair === 'object' ? JSON.stringify(profile.encryptedKeyPair) : profile.encryptedKeyPair) : null
    };
};

// --- HELPER FUNCTION FOR GENERIC PATHS ---
const getPathValue = async (path) => {
    // 1. Try to read the exact path first
    const row = await db.get("SELECT value FROM firebase_paths WHERE path = ?", [path]);
    if (row) {
        return JSON.parse(row.value);
    }

    // 2. If not found, look for any sub-paths under this path to build parent object dynamically
    const prefix = path ? path + '/' : '';
    if (prefix) {
        const rows = await db.all("SELECT path, value FROM firebase_paths WHERE path LIKE ?", [prefix + '%']);
        if (rows.length > 0) {
            const result = {};
            rows.forEach(r => {
                const subKey = r.path.slice(prefix.length);
                const parts = subKey.split('/');
                let current = result;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (!current[p]) current[p] = {};
                    current = current[p];
                }
                const leaf = parts[parts.length - 1];
                try {
                    current[leaf] = JSON.parse(r.value);
                } catch (e) {
                    current[leaf] = r.value;
                }
            });
            return result;
        }
    }
    return null;
};

const setPathValue = async (path, value) => {
    const strValue = JSON.stringify(value);
    await db.run(
        "INSERT INTO firebase_paths (path, value) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET value = ?",
        [path, strValue, strValue]
    );
};

const deletePathValue = async (path) => {
    await db.run("DELETE FROM firebase_paths WHERE path = ?", [path]);
    const prefix = path ? path + '/' : '';
    if (prefix) {
        await db.run("DELETE FROM firebase_paths WHERE path LIKE ?", [prefix + '%']);
    }
};

const notifyPathUpdate = (path, value) => {
    if (path.startsWith('users/')) {
        const parts = path.split('/');
        const targetUserId = parts[1];
        if (targetUserId) {
            io.to(targetUserId).emit('db_ref_updated', { path, value });
            console.log(`[Socket.io] Emitted db_ref_updated for path ${path} to user room: ${targetUserId}`);
        }
    } else {
        io.emit('db_ref_updated', { path, value });
    }
};

// --- REST API ENDPOINTS ---

// Generic DB get/set fallback routes to cover any unmapped client requests automatically
app.get('/api/db/get', async (req, res) => {
    try {
        const { path } = req.query;
        if (path === undefined || path === null) return res.status(400).json({ error: "Missing path parameter" });

        // Root publicProfiles lookup redirection
        if (path === 'publicProfiles') {
            const rows = await db.all("SELECT * FROM users");
            const data = {};
            rows.forEach(r => {
                data[r.uid] = formatUserRow(r);
            });
            return res.json(data);
        }

        // User profiles lookup redirection
        if (path.startsWith('publicProfiles/')) {
            const uid = path.replace('publicProfiles/', '');
            const row = await db.get("SELECT * FROM users WHERE uid = ?", [uid]);
            return res.json(formatUserRow(row));
        }

        // Messages lookup redirection
        if (path.startsWith('messages/')) {
            const relative = path.replace('messages/', '');
            const parts = relative.split('/');
            if (parts.length === 1) {
                // Return all messages for chatId
                const rows = await db.all("SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC", [parts[0]]);
                // Map array to object structure like Firebase val()
                const data = {};
                rows.forEach(r => { data[r.id] = r; });
                return res.json(data);
            }
            if (parts.length === 2) {
                // Return specific message
                const row = await db.get("SELECT * FROM messages WHERE chatId = ? AND id = ?", [parts[0], parts[1]]);
                return res.json(row || null);
            }
        }

        // Default path lookup fallback
        const val = await getPathValue(path);
        res.json(val);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/db/set', async (req, res) => {
    try {
        const { path, value } = req.body;
        if (path === undefined || path === null) return res.status(400).json({ error: "Missing path parameter" });

        // User profiles set redirection
        if (path.startsWith('publicProfiles/')) {
            const uid = path.replace('publicProfiles/', '');
            const mapped = parseUserProfileInput(value);
            await db.run(
                "INSERT INTO users (uid, fullname, phone_number, profile_photo, publicKey, encryptedKeyPair) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET fullname=?, phone_number=?, profile_photo=?, publicKey=?, encryptedKeyPair=?",
                [uid, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair]
            );
            return res.json({ success: true });
        }

        // Messages set redirection
        if (path.startsWith('messages/')) {
            const relative = path.replace('messages/', '');
            const parts = relative.split('/');
            if (parts.length === 2) {
                const chatId = parts[0];
                const msgId = parts[1];
                await db.run(
                    "INSERT INTO messages (id, chatId, senderId, text, previewText, type, timestamp, ephemeralExpiry, isEncrypted, iv, url, fileName, fileSize, thumbnailUrl, latitude, longitude, address, staticMapUrl, mapUrl, replyTo, invoiceId, liveSharingEnded, duration, status, edited, deleted, orderConfirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET text=?, status=?, edited=?, deleted=?, orderConfirmed=?",
                    [msgId, chatId, value.senderId, value.text, value.previewText, value.type, value.timestamp, value.ephemeralExpiry, value.isEncrypted, value.iv, value.url, value.fileName, value.fileSize, value.thumbnailUrl, value.latitude, value.longitude, value.address, value.staticMapUrl, value.mapUrl, value.replyTo ? JSON.stringify(value.replyTo) : null, value.invoiceId, value.liveSharingEnded, value.duration, value.status, value.edited, value.deleted, value.orderConfirmed, value.text, value.status, value.edited, value.deleted, value.orderConfirmed]
                );

                // Notify room
                io.to(chatId).emit('message_added', { id: msgId, ...value, chatId });

                // Send FCM message notification
                if (!chatId.startsWith("group_")) {
                    const uids = chatId.split("_");
                    const recipientId = uids.find(uid => uid !== value.senderId);
                    if (recipientId) {
                        const senderRow = await db.get("SELECT fullname FROM users WHERE uid = ?", [value.senderId]);
                        const senderName = senderRow ? senderRow.fullname : "Someone";
                        const notificationBody = value.isEncrypted ? (value.previewText || "sent you an encrypted message") : (value.text || "");
                        sendFCMNotification(recipientId, senderName, notificationBody, { chatId, messageId: msgId, senderId: value.senderId });
                    }
                }

                return res.json({ success: true });
            }
        }

        // Default path fallback
        await setPathValue(path, value);
        notifyPathUpdate(path, value);

        if (path.startsWith('users/') && path.includes('/friendRequests/')) {
            const parts = path.split('/');
            const toUid = parts[1];
            const fromUid = parts[3];
            if (toUid && fromUid) {
                const senderRow = await db.get("SELECT fullname FROM users WHERE uid = ?", [fromUid]);
                const senderName = senderRow ? senderRow.fullname : "Someone";
                sendFCMNotification(toUid, "Friend Request", `${senderName} sent you a friend request.`, { type: "friend_request", fromUid });
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/db/update', async (req, res) => {
    try {
        const { path } = req.body;
        const updates = req.body.updates || req.body.value;
        if (path === undefined || path === null) return res.status(400).json({ error: "Missing path parameter" });

        // User profiles update redirection
        if (path.startsWith('publicProfiles/')) {
            const uid = path.replace('publicProfiles/', '');
            const mapped = {};
            if (updates.fullname !== undefined) mapped.fullname = updates.fullname;
            if (updates.phoneNumber !== undefined) mapped.phone_number = updates.phoneNumber;
            if (updates.profilePhoto !== undefined) mapped.profile_photo = updates.profilePhoto;
            if (updates.publicKey !== undefined) mapped.publicKey = typeof updates.publicKey === 'object' ? JSON.stringify(updates.publicKey) : updates.publicKey;
            if (updates.encryptedKeyPair !== undefined) mapped.encryptedKeyPair = typeof updates.encryptedKeyPair === 'object' ? JSON.stringify(updates.encryptedKeyPair) : updates.encryptedKeyPair;

            const fields = [];
            const params = [];
            Object.entries(mapped).forEach(([k, v]) => {
                fields.push(`${k} = ?`);
                params.push(v);
            });
            if (fields.length > 0) {
                params.push(uid);
                await db.run(`UPDATE users SET ${fields.join(', ')} WHERE uid = ?`, params);
            }
            return res.json({ success: true });
        }

        // Multi-path updates support
        if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
            for (const [subPath, subValue] of Object.entries(updates)) {
                const fullPath = path ? (subPath ? path + '/' + subPath : path) : subPath;
                if (subValue === null) {
                    await deletePathValue(fullPath);
                    notifyPathUpdate(fullPath, null);
                } else {
                    await setPathValue(fullPath, subValue);
                    notifyPathUpdate(fullPath, subValue);

                    if (fullPath.startsWith('users/') && fullPath.includes('/friendRequests/')) {
                        const parts = fullPath.split('/');
                        const toUid = parts[1];
                        const fromUid = parts[3];
                        if (toUid && fromUid) {
                            const senderRow = await db.get("SELECT fullname FROM users WHERE uid = ?", [fromUid]);
                            const senderName = senderRow ? senderRow.fullname : "Someone";
                            sendFCMNotification(toUid, "Friend Request", `${senderName} sent you a friend request.`, { type: "friend_request", fromUid });
                        }
                    }
                }
            }
        } else {
            if (updates === null) {
                await deletePathValue(path);
                notifyPathUpdate(path, null);
            } else {
                await setPathValue(path, updates);
                notifyPathUpdate(path, updates);

                if (path.startsWith('users/') && path.includes('/friendRequests/')) {
                    const parts = path.split('/');
                    const toUid = parts[1];
                    const fromUid = parts[3];
                    if (toUid && fromUid) {
                        const senderRow = await db.get("SELECT fullname FROM users WHERE uid = ?", [fromUid]);
                        const senderName = senderRow ? senderRow.fullname : "Someone";
                        sendFCMNotification(toUid, "Friend Request", `${senderName} sent you a friend request.`, { type: "friend_request", fromUid });
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/db/delete', async (req, res) => {
    try {
        const { path } = req.body;
        if (path === undefined || path === null) return res.status(400).json({ error: "Missing path" });

        await deletePathValue(path);
        notifyPathUpdate(path, null);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- STRUCTURED DEDICATED ROUTES ---

// Users profiles
app.get('/api/users/profile/:uid', async (req, res) => {
    try {
        const profile = await db.get("SELECT * FROM users WHERE uid = ?", [req.params.uid]);
        res.json(formatUserRow(profile));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users/profile/:uid', async (req, res) => {
    try {
        const uid = req.params.uid;
        const profile = req.body;
        const mapped = parseUserProfileInput(profile);
        await db.run(
            "INSERT INTO users (uid, fullname, phone_number, profile_photo, publicKey, encryptedKeyPair) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET fullname=?, phone_number=?, profile_photo=?, publicKey=?, encryptedKeyPair=?",
            [uid, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users/profile/:uid/update', async (req, res) => {
    try {
        const uid = req.params.uid;
        const updates = req.body;
        const mapped = {};
        if (updates.fullname !== undefined) mapped.fullname = updates.fullname;
        if (updates.phoneNumber !== undefined) mapped.phone_number = updates.phoneNumber;
        if (updates.profilePhoto !== undefined) mapped.profile_photo = updates.profilePhoto;
        if (updates.publicKey !== undefined) mapped.publicKey = typeof updates.publicKey === 'object' ? JSON.stringify(updates.publicKey) : updates.publicKey;
        if (updates.encryptedKeyPair !== undefined) mapped.encryptedKeyPair = typeof updates.encryptedKeyPair === 'object' ? JSON.stringify(updates.encryptedKeyPair) : updates.encryptedKeyPair;

        const fields = [];
        const params = [];
        Object.entries(mapped).forEach(([k, v]) => {
            fields.push(`${k} = ?`);
            params.push(v);
        });
        if (fields.length > 0) {
            params.push(uid);
            await db.run(`UPDATE users SET ${fields.join(', ')} WHERE uid = ?`, params);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users/sync-profile', async (req, res) => {
    try {
        const { uid, customerList, friendRequests, chatList, publicProfile } = req.body;
        if (!uid) return res.status(400).json({ error: "Missing uid" });

        // 1. Insert/update user profile in SQLite
        if (publicProfile) {
            const mapped = parseUserProfileInput(publicProfile);
            await db.run(
                "INSERT INTO users (uid, fullname, phone_number, profile_photo, publicKey, encryptedKeyPair) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET fullname=?, phone_number=?, profile_photo=?, publicKey=?, encryptedKeyPair=?",
                [uid, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair, mapped.fullname, mapped.phone_number, mapped.profile_photo, mapped.publicKey, mapped.encryptedKeyPair]
            );
        }

        // 2. Insert customer list as friends in SQLite
        if (customerList) {
            for (const [friendUid, timestamp] of Object.entries(customerList)) {
                if (timestamp) {
                    await db.run("INSERT OR IGNORE INTO users (uid) VALUES (?)", [friendUid]);
                    await db.run("INSERT OR IGNORE INTO friends (userId, friendUid) VALUES (?, ?)", [uid, friendUid]);
                    await db.run("INSERT OR IGNORE INTO friends (userId, friendUid) VALUES (?, ?)", [friendUid, uid]);
                }
            }
        }

        // 3. Insert chat list mappings in SQLite
        if (chatList) {
            for (const [otherUserId, details] of Object.entries(chatList)) {
                await db.run("INSERT OR IGNORE INTO users (uid) VALUES (?)", [otherUserId]);
                await db.run(
                    "INSERT OR IGNORE INTO chat_list (userId, otherUserId, archived, pinned, muted) VALUES (?, ?, ?, ?, ?)",
                    [uid, otherUserId, details.archived ? 1 : 0, details.pinned ? 1 : 0, details.muted ? 1 : 0]
                );
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Sync profile error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM users");
        res.json(rows.map(formatUserRow));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Messages and Chat Rooms
app.post('/api/messages/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const msg = req.body;
        const msgId = msg.id;

        await db.run(
            "INSERT INTO messages (id, chatId, senderId, text, previewText, type, timestamp, ephemeralExpiry, isEncrypted, iv, url, fileName, fileSize, thumbnailUrl, latitude, longitude, address, staticMapUrl, mapUrl, replyTo, invoiceId, liveSharingEnded, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [msgId, chatId, msg.senderId, msg.text, msg.previewText, msg.type, msg.timestamp, msg.ephemeralExpiry, msg.isEncrypted, msg.iv, msg.url, msg.fileName, msg.fileSize, msg.thumbnailUrl, msg.latitude, msg.longitude, msg.address, msg.staticMapUrl, msg.mapUrl, msg.replyTo ? JSON.stringify(msg.replyTo) : null, msg.invoiceId, msg.liveSharingEnded, msg.duration, msg.status || 'sent']
        );

        // Broadcast to Chat Room
        io.to(chatId).emit('message_added', { id: msgId, ...msg, chatId });
        res.json({ success: true, id: msgId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/messages/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const rows = await db.all("SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC", [chatId]);
        const mapped = rows.map(r => ({
            ...r,
            replyTo: r.replyTo ? JSON.parse(r.replyTo) : null,
            isEncrypted: !!r.isEncrypted,
            edited: !!r.edited,
            deleted: !!r.deleted,
            orderConfirmed: !!r.orderConfirmed,
            liveSharingEnded: !!r.liveSharingEnded
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/messages/:chatId/delete-batch', async (req, res) => {
    try {
        const { messageIds } = req.body;
        const placeholders = messageIds.map(() => '?').join(',');
        await db.run(`DELETE FROM messages WHERE id IN (${placeholders})`, messageIds);
        messageIds.forEach(id => {
            io.to(req.params.chatId).emit('message_removed', id);
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Products
app.post('/api/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const prod = req.body;
        const imagesStr = JSON.stringify(prod.images || []);

        await db.run(
            "INSERT INTO products (id, ownerId, title, description, price, images, category) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=?, description=?, price=?, images=?, category=?",
            [id, prod.ownerId, prod.title, prod.description, prod.price, imagesStr, prod.category, prod.title, prod.description, prod.price, imagesStr, prod.category]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM products ORDER BY created_at DESC");
        const mapped = rows.map(r => ({ ...r, images: JSON.parse(r.images || '[]') }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await db.run("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- SOCKET.IO SIGNALING & REAL-TIME CONNECTIONS ---
io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Register active user
    socket.on('register_user', async (userId) => {
        activeSockets.set(socket.id, userId);
        socket.join(userId);
        console.log(`[Socket.io] User ${userId} registered socket ${socket.id} and joined personal room.`);

        // Update online status in database
        await db.run("UPDATE users SET presence_status = 'online', lastSeen = ? WHERE uid = ?", [Date.now(), userId]);
        io.emit('presence_changed', { userId, status: 'online' });
    });

    // Join a Chat Room
    socket.on('join_room', (chatId) => {
        socket.join(chatId);
        console.log(`[Socket.io] Socket ${socket.id} joined room: ${chatId}`);
    });

    // Leave a Chat Room
    socket.on('leave_room', (chatId) => {
        socket.leave(chatId);
        console.log(`[Socket.io] Socket ${socket.id} left room: ${chatId}`);
    });

    // Typing presence events
    socket.on('typing_status', (data) => {
        // Broadcast typing indicator to other room listeners
        socket.to(data.chatId).emit('typing_status_changed', data);
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
        const userId = activeSockets.get(socket.id);
        if (userId) {
            activeSockets.delete(socket.id);
            console.log(`[Socket.io] User ${userId} disconnected.`);

            // Check if user has any other active connections
            const remainsOnline = Array.from(activeSockets.values()).includes(userId);
            if (!remainsOnline) {
                const lastSeen = Date.now();
                await db.run("UPDATE users SET presence_status = 'offline', lastSeen = ? WHERE uid = ?", [lastSeen, userId]);
                io.emit('presence_changed', { userId, status: 'offline', lastSeen });
            }
        }
    });
});
