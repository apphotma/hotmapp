import { initDb } from './db.js';

const DB_URL = "https://hotma-app-default-rtdb.firebaseio.com";

const migrate = async () => {
    console.log("==================================================");
    console.log("    STARTING FIREBASE RTDB -> SQLITE MIGRATION    ");
    console.log("==================================================");

    const db = await initDb();

    try {
        // 1. Migrate Users
        console.log("[Migration] Downloading user profiles from Firebase...");
        const usersRes = await fetch(`${DB_URL}/publicProfiles.json`);
        const users = await usersRes.json();
        
        if (users) {
            const uids = Object.keys(users);
            console.log(`[Migration] Found ${uids.length} user profiles. Importing to SQLite...`);
            for (const [uid, u] of Object.entries(users)) {
                const fullname = u.fullname || null;
                const phoneNumber = u.phoneNumber || u.phone_number || null;
                const profilePhoto = u.profilePhoto || u.profile_photo || null;
                const publicKey = u.publicKey ? (typeof u.publicKey === 'object' ? JSON.stringify(u.publicKey) : u.publicKey) : null;
                const encryptedKeyPair = u.encryptedKeyPair ? (typeof u.encryptedKeyPair === 'object' ? JSON.stringify(u.encryptedKeyPair) : u.encryptedKeyPair) : null;

                await db.run(
                    "INSERT INTO users (uid, fullname, phone_number, profile_photo, publicKey, encryptedKeyPair) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET fullname=?, phone_number=?, profile_photo=?, publicKey=?, encryptedKeyPair=?",
                    [uid, fullname, phoneNumber, profilePhoto, publicKey, encryptedKeyPair, fullname, phoneNumber, profilePhoto, publicKey, encryptedKeyPair]
                );
            }
            console.log("[Migration] User profiles imported successfully.");
        } else {
            console.log("[Migration] No user profiles found in Firebase RTDB.");
        }

        // 2. Migrate Friends
        console.log("[Migration] Downloading friends list from Firebase...");
        const friendsRes = await fetch(`${DB_URL}/friends.json`);
        const friends = await friendsRes.json();
        
        if (friends) {
            console.log("[Migration] Importing friends mapping to SQLite...");
            console.log("[Migration DEBUG] Friends list keys:", Object.keys(friends));
            const allDbUids = (await db.all("SELECT uid FROM users")).map(r => r.uid);
            console.log("[Migration DEBUG] SQLite users UIDs:", allDbUids);
            
            let friendCount = 0;
            for (const [userId, friendList] of Object.entries(friends)) {
                if (friendList) {
                    const userExists = await db.get("SELECT 1 FROM users WHERE uid = ?", [userId]);
                    if (!userExists) {
                        console.log(`[Migration DEBUG] userId ${userId} not found in users table`);
                        continue;
                    }

                    for (const [friendUid, isFriend] of Object.entries(friendList)) {
                        if (isFriend) {
                            const friendExists = await db.get("SELECT 1 FROM users WHERE uid = ?", [friendUid]);
                            if (friendExists) {
                                await db.run(
                                    "INSERT OR IGNORE INTO friends (userId, friendUid) VALUES (?, ?)",
                                    [userId, friendUid]
                                );
                                friendCount++;
                            }
                        }
                    }
                }
            }
            console.log(`[Migration] Imported ${friendCount} friend connections.`);
        } else {
            console.log("[Migration] No friends connections found.");
        }

        // 3. Migrate Chat Lists
        console.log("[Migration] Downloading active chat lists from Firebase...");
        const chatListRes = await fetch(`${DB_URL}/chatList.json`);
        const chatList = await chatListRes.json();
        
        if (chatList) {
            console.log("[Migration] Importing chat lists to SQLite...");
            let chatCount = 0;
            for (const [userId, chats] of Object.entries(chatList)) {
                if (chats) {
                    const userExists = await db.get("SELECT 1 FROM users WHERE uid = ?", [userId]);
                    if (!userExists) continue;

                    for (const [otherUserId, details] of Object.entries(chats)) {
                        const otherExists = await db.get("SELECT 1 FROM users WHERE uid = ?", [otherUserId]);
                        if (otherExists) {
                            await db.run(
                                "INSERT OR IGNORE INTO chat_list (userId, otherUserId, archived, pinned, muted) VALUES (?, ?, ?, ?, ?)",
                                [userId, otherUserId, details.archived ? 1 : 0, details.pinned ? 1 : 0, details.muted ? 1 : 0]
                            );
                            chatCount++;
                        }
                    }
                }
            }
            console.log(`[Migration] Imported ${chatCount} chat lists.`);
        } else {
            console.log("[Migration] No active chat lists found.");
        }

        console.log("==================================================");
        console.log(" MIGRATION FINISHED SUCCESSFULLY! SQLITE SYNCED.  ");
        console.log("==================================================");
        process.exit(0);
    } catch (e) {
        console.error("[Migration] Error during migration execution:", e);
        process.exit(1);
    }
};

migrate();
