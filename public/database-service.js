import { ref, set, get, child, update, push, serverTimestamp, onChildAdded, onChildChanged, onChildRemoved, onValue, onDisconnect, increment, runTransaction, query, orderByChild, orderByKey, limitToLast, limitToFirst, endBefore, startAfter, startAt, endAt, equalTo } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
export { ref, set, get, child, update, push, serverTimestamp, onChildAdded, onChildChanged, onChildRemoved, onValue, onDisconnect, increment, runTransaction, query, orderByChild, orderByKey, limitToLast, limitToFirst, endBefore, startAfter, startAt, endAt, equalTo };

import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { db, storage, auth } from './firebase-config.js';
import { cacheItem, getCachedItem, deleteCachedItem, getCachedMessages } from './cache-manager.js';


/**
 * Uploads a file to Firebase Storage and returns the download URL
 */
export const uploadFile = (path, file, onProgress) => {
    const storageRef = sRef(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const promise = new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(resolve);
            }
        );
    });

    promise.cancel = () => uploadTask.cancel();
    return promise;
};

/**
 * Deletes a file from Firebase Storage given its download URL
 */
export const deleteFile = async (url) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
    try {
        const storageRef = sRef(storage, url);
        await deleteObject(storageRef);
    } catch (error) {
        console.error("Error deleting file from storage:", error);
    }
};

/**
 * Saves or updates a user profile in the Realtime Database
 * Structure: users/userId/
 */
export const saveUserProfile = async (userId, profileData) => {
    const userRef = ref(db, `users/${userId}`);
    const publicRef = ref(db, `publicProfiles/${userId}`);
    const data = {
        ...profileData,
        updatedAt: new Date().toISOString()
    };
    const { fullname, phoneNumber, photoURL, profilePhoto, isSubscribed, online, lastSeen, typingTo, updatedAt, publicKey, createdAt } = data;
    const publicData = {};
    if (fullname !== undefined) publicData.fullname = fullname;
    if (phoneNumber !== undefined) publicData.phoneNumber = phoneNumber;
    if (isSubscribed !== undefined) publicData.isSubscribed = isSubscribed;
    if (online !== undefined) publicData.online = online;
    if (lastSeen !== undefined) publicData.lastSeen = lastSeen;
    if (typingTo !== undefined) publicData.typingTo = typingTo;
    if (updatedAt !== undefined) publicData.updatedAt = updatedAt;
    if (publicKey !== undefined) publicData.publicKey = publicKey;
    if (createdAt !== undefined) publicData.createdAt = createdAt;

    // Handle photo url / profile photo naming consistently
    const photo = profilePhoto !== undefined ? profilePhoto : photoURL;
    if (photo !== undefined) {
        publicData.profilePhoto = photo;
        publicData.photoURL = photo;
    }

    await Promise.all([
        set(userRef, data),
        set(publicRef, publicData)
    ]);
    await cacheItem('profiles', { uid: userId, ...data });
};

/**
 * Updates specific fields in a user profile
 */
export const updateUserProfile = async (userId, updates) => {
    const userRef = ref(db, `users/${userId}`);
    const publicRef = ref(db, `publicProfiles/${userId}`);
    const timeStr = new Date().toISOString();
    const dataUpdates = {
        ...updates,
        updatedAt: timeStr
    };
    const { 
        fullname, phoneNumber, photoURL, profilePhoto, isSubscribed, online, lastSeen, typingTo, updatedAt, publicKey,
        whoCanMessage, whoCanViewShop, lastSeenPrivacy, onlinePrivacy, profilePhotoPrivacy, aboutPrivacy, readReceipts, excludedContacts,
        createdAt
    } = dataUpdates;
    const publicUpdates = {};
    if (fullname !== undefined) publicUpdates.fullname = fullname;
    if (phoneNumber !== undefined) publicUpdates.phoneNumber = phoneNumber;
    if (isSubscribed !== undefined) publicUpdates.isSubscribed = isSubscribed;
    if (online !== undefined) publicUpdates.online = online;
    if (lastSeen !== undefined) publicUpdates.lastSeen = lastSeen;
    if (typingTo !== undefined) publicUpdates.typingTo = typingTo;
    if (updatedAt !== undefined) publicUpdates.updatedAt = updatedAt;
    if (publicKey !== undefined) publicUpdates.publicKey = publicKey;
    if (createdAt !== undefined) publicUpdates.createdAt = createdAt;

    // Handle photo url / profile photo naming consistently
    const photo = profilePhoto !== undefined ? profilePhoto : photoURL;
    if (photo !== undefined) {
        publicUpdates.profilePhoto = photo;
        publicUpdates.photoURL = photo;
    }

    // Privacy Settings
    if (whoCanMessage !== undefined) publicUpdates.whoCanMessage = whoCanMessage;
    if (whoCanViewShop !== undefined) publicUpdates.whoCanViewShop = whoCanViewShop;
    if (lastSeenPrivacy !== undefined) publicUpdates.lastSeenPrivacy = lastSeenPrivacy;
    if (onlinePrivacy !== undefined) publicUpdates.onlinePrivacy = onlinePrivacy;
    if (profilePhotoPrivacy !== undefined) publicUpdates.profilePhotoPrivacy = profilePhotoPrivacy;
    if (aboutPrivacy !== undefined) publicUpdates.aboutPrivacy = aboutPrivacy;
    if (readReceipts !== undefined) publicUpdates.readReceipts = readReceipts;
    if (excludedContacts !== undefined) publicUpdates.excludedContacts = excludedContacts;

    await Promise.all([
        update(userRef, dataUpdates),
        update(publicRef, publicUpdates)
    ]);
    const cached = await getCachedItem('profiles', userId) || {};
    await cacheItem('profiles', { uid: userId, ...cached, ...updates, updatedAt: timeStr });
};

/**
 * Monitors connection state and updates user presence in real-time
 */
export const monitorPresence = (userId) => {
    const connectedRef = ref(db, ".info/connected");
    const userRef = ref(db, `users/${userId}`);
    const publicRef = ref(db, `publicProfiles/${userId}`);

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            // Set up onDisconnect: this runs on the server when the client goes away
            onDisconnect(userRef).update({
                online: false,
                lastSeen: serverTimestamp()
            });
            onDisconnect(publicRef).update({
                online: false,
                lastSeen: serverTimestamp()
            });

            // Mark user as online now
            const onlineData = {
                online: true,
                lastSeen: serverTimestamp()
            };
            update(userRef, onlineData);
            update(publicRef, onlineData);
        }
    });
};

/**
 * Updates the user's typing status
 */
export const setTypingStatus = async (userId, targetUid, isTyping) => {
    const userRef = ref(db, `users/${userId}`);
    const publicRef = ref(db, `publicProfiles/${userId}`);
    const typingData = { typingTo: isTyping ? targetUid : null };
    await Promise.all([
        update(userRef, typingData),
        update(publicRef, typingData)
    ]);
};

/**
 * Pushes a new message to a specific chat room
 */
export const saveMessage = async (chatId, messageData, preGeneratedId = null) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = preGeneratedId ? child(messagesRef, preGeneratedId) : push(messagesRef);
    const timestamp = messageData.timestamp || serverTimestamp();

    // Prefer a plaintext preview if supplied
    let lastMsgPreview = null;
    let lastMsgIv = null;
    let lastMsgEncryptedFlag = messageData.isEncrypted || null;

    if (messageData.previewText) {
        lastMsgPreview = messageData.previewText;
    } else if (messageData.isEncrypted) {
        lastMsgPreview = messageData.text || '[Encrypted Message]';
        lastMsgIv = messageData.iv !== undefined && messageData.iv !== null ? messageData.iv : null;
    } else if (messageData.type === 'text' || messageData.type === 'system') {
        lastMsgPreview = messageData.text || '';
    } else if (messageData.type === 'audio') {
        lastMsgPreview = '🎵 Voice Note';
    } else if (messageData.type === 'image') {
        lastMsgPreview = '📷 Image';
    } else if (messageData.type === 'video') {
        lastMsgPreview = '🎥 Video';
    } else if (messageData.type === 'document') {
        lastMsgPreview = `📄 ${messageData.fileName || 'Document'}`;
    } else if (messageData.type === 'location') {
        lastMsgPreview = '📍 Location';
    } else {
        lastMsgPreview = `[${messageData.type || 'Message'}]`;
    }

    const participants = chatId.split('_');

    if (!chatId.startsWith('group_')) {
        const recipientId = participants.find(id => id !== messageData.senderId);
        if (recipientId) {
            const blockedRef = ref(db, `publicProfiles/${recipientId}/blockedUsers/${messageData.senderId}`);
            const blockedSnapshot = await get(blockedRef);
            if (blockedSnapshot.exists()) {
                console.warn(`Blocked message sending attempt from ${messageData.senderId} to ${recipientId}`);
                throw new Error("You are blocked by this user.");
            }
        }
    }

    // Sanitize messageData to strip any undefined values that would cause Firebase set() to fail
    const sanitizedMessageData = {};
    for (const [k, v] of Object.entries(messageData)) {
        if (v !== undefined) {
            sanitizedMessageData[k] = v;
        }
    }

    await set(newMessageRef, {
        ...sanitizedMessageData,
        timestamp: timestamp,
        status: messageData.status || 'notified',
        isEncrypted: messageData.isEncrypted !== undefined && messageData.isEncrypted !== null ? messageData.isEncrypted : null,
        iv: messageData.iv !== undefined && messageData.iv !== null ? messageData.iv : null,
        chatId: messageData.chatId || chatId
    });

    // Update the last interaction timestamp for both users in their chat lists
    if (chatId.startsWith('group_')) {
        try {
            const groupSnapshot = await get(ref(db, `groups/${chatId}`));
            if (groupSnapshot.exists()) {
                const groupData = groupSnapshot.val();
                if (groupData && groupData.members) {
                    const updates = {};
                    Object.keys(groupData.members).forEach(memberId => {
                        updates[`users/${memberId}/chatList/${chatId}/lastInteraction`] = timestamp;
                        updates[`users/${memberId}/chatList/${chatId}/lastMessage`] = lastMsgPreview || '';
                        updates[`users/${memberId}/chatList/${chatId}/lastMessageIsEncrypted`] = lastMsgEncryptedFlag;
                        updates[`users/${memberId}/chatList/${chatId}/lastMessageIv`] = lastMsgIv;
                        updates[`users/${memberId}/chatList/${chatId}/lastSenderId`] = messageData.senderId || null;
                        updates[`users/${memberId}/chatList/${chatId}/lastMessageType`] = messageData.type || 'text';
                        updates[`users/${memberId}/chatList/${chatId}/lastMessageFileName`] = messageData.fileName || null;
                        updates[`users/${memberId}/chatList/${chatId}/messageCount`] = increment(1);
                        updates[`users/${memberId}/chatList/${chatId}/isGroup`] = true;
                        updates[`users/${memberId}/chatList/${chatId}/groupName`] = groupData.name || "Group Chat";
                    });
                    await update(ref(db), updates);
                }
            }
        } catch (e) {
            console.error("Failed to update group chat list updates:", e);
        }
    } else if (participants.length === 2) {
        const updates = {};
        [
            { me: participants[0], other: participants[1] },
            { me: participants[1], other: participants[0] }
        ].forEach(pair => {
            updates[`users/${pair.me}/chatList/${pair.other}/lastInteraction`] = timestamp;
            updates[`users/${pair.me}/chatList/${pair.other}/lastMessage`] = lastMsgPreview || '';
            updates[`users/${pair.me}/chatList/${pair.other}/lastMessageIsEncrypted`] = lastMsgEncryptedFlag;
            updates[`users/${pair.me}/chatList/${pair.other}/lastMessageIv`] = lastMsgIv;
            updates[`users/${pair.me}/chatList/${pair.other}/lastSenderId`] = messageData.senderId || null;
            updates[`users/${pair.me}/chatList/${pair.other}/lastMessageType`] = messageData.type || 'text';
            updates[`users/${pair.me}/chatList/${pair.other}/lastMessageFileName`] = messageData.fileName || null;
            updates[`users/${pair.me}/chatList/${pair.other}/messageCount`] = increment(1);
        });
        await update(ref(db), updates);
    }

    return newMessageRef.key;
};

/**
 * Creates a new group chat and initializes the members' chat lists
 */
export const createGroup = async (groupName, memberIds, creatorId) => {
    const groupId = 'group_' + push(ref(db, 'groups')).key;
    const groupRef = ref(db, `groups/${groupId}`);
    const timestamp = serverTimestamp();

    const membersMap = {};
    memberIds.forEach(id => {
        membersMap[id] = true;
    });
    // Ensure creator is also in the group
    membersMap[creatorId] = true;

    const adminsMap = {};
    adminsMap[creatorId] = true; // Creator is the first admin

    // Create group meta in the database
    await set(groupRef, {
        id: groupId,
        name: groupName,
        createdBy: creatorId,
        members: membersMap,
        admins: adminsMap,
        createdAt: timestamp
    });

    // Write group reference to each member's chatList node
    const updates = {};
    Object.keys(membersMap).forEach(memberId => {
        updates[`users/${memberId}/chatList/${groupId}`] = {
            lastInteraction: timestamp,
            lastMessage: "Group created",
            lastSenderId: creatorId,
            lastMessageType: 'system',
            isGroup: true,
            groupName: groupName,
            messageCount: 0
        };
    });
    await update(ref(db), updates);

    return groupId;
};

/**
 * Promotes a group member to admin
 */
export const promoteToAdmin = async (groupId, memberId, promoterId) => {
    const adminRef = ref(db, `groups/${groupId}/admins/${memberId}`);
    await set(adminRef, true);

    await saveMessage(groupId, {
        senderId: promoterId,
        text: `made admin`,
        type: 'system',
        targetUserId: memberId
    });
};

/**
 * Demotes a group member from admin status
 */
export const demoteFromAdmin = async (groupId, memberId, demoterId) => {
    const adminRef = ref(db, `groups/${groupId}/admins/${memberId}`);
    await set(adminRef, null);

    await saveMessage(groupId, {
        senderId: demoterId,
        text: `dismissed as admin`,
        type: 'system',
        targetUserId: memberId
    });
};

/**
 * Adds new members to an existing group
 */
export const addGroupMembers = async (groupId, memberIds, addedById) => {
    const groupSnapshot = await get(ref(db, `groups/${groupId}`));
    if (!groupSnapshot.exists()) return;
    const groupData = groupSnapshot.val();

    const timestamp = serverTimestamp();

    // 1. Add members to the group path first so that security rules check for membership passes
    const memberUpdates = {};
    memberIds.forEach(memberId => {
        memberUpdates[`groups/${groupId}/members/${memberId}`] = true;
    });
    await update(ref(db), memberUpdates);

    // 2. Write group reference to each added member's chatList node
    const chatListUpdates = {};
    memberIds.forEach(memberId => {
        chatListUpdates[`users/${memberId}/chatList/${groupId}`] = {
            lastInteraction: timestamp,
            lastMessage: "Added to group",
            lastSenderId: addedById,
            lastMessageType: 'system',
            isGroup: true,
            groupName: groupData.name || "Group Chat",
            messageCount: 0
        };
    });
    await update(ref(db), chatListUpdates);

    for (const memberId of memberIds) {
        await saveMessage(groupId, {
            senderId: addedById,
            text: `added member`,
            type: 'system',
            targetUserId: memberId
        });
    }
};

/**
 * Removes a member from the group
 */
export const removeGroupMember = async (groupId, memberId, removedById) => {
    await set(ref(db, `users/${memberId}/chatList/${groupId}`), null);
    await set(ref(db, `groups/${groupId}/members/${memberId}`), null);
    await set(ref(db, `groups/${groupId}/admins/${memberId}`), null);

    await saveMessage(groupId, {
        senderId: removedById,
        text: `removed member`,
        type: 'system',
        targetUserId: memberId
    });
};

/**
 * Exit group chat room
 */
export const exitGroup = async (groupId, userId) => {
    await set(ref(db, `groups/${groupId}/members/${userId}`), null);
    await set(ref(db, `groups/${groupId}/admins/${userId}`), null);
    await set(ref(db, `users/${userId}/chatList/${groupId}`), null);

    await saveMessage(groupId, {
        senderId: userId,
        text: `left the group`,
        type: 'system'
    });

    // Check if group is now empty
    const membersSnap = await get(ref(db, `groups/${groupId}/members`));
    if (!membersSnap.exists() || Object.keys(membersSnap.val() || {}).length === 0) {
        await set(ref(db, `groups/${groupId}`), null);
        await set(ref(db, `messages/${groupId}`), null);
    } else {
        // If exiting user was an admin, check if any admins remain
        const adminsSnap = await get(ref(db, `groups/${groupId}/admins`));
        if (!adminsSnap.exists() || Object.keys(adminsSnap.val() || {}).length === 0) {
            const members = Object.keys(membersSnap.val());
            if (members.length > 0) {
                // Promote the first remaining member to admin
                await set(ref(db, `groups/${groupId}/admins/${members[0]}`), true);
                await saveMessage(groupId, {
                    senderId: members[0],
                    text: `became admin`,
                    type: 'system',
                    targetUserId: members[0]
                });
            }
        }
    }
};

/**
 * Updates a group's profile photo
 */
export const updateGroupProfilePhoto = async (groupId, photoUrl, updaterId) => {
    await set(ref(db, `groups/${groupId}/profilePhoto`), photoUrl);

    await saveMessage(groupId, {
        senderId: updaterId,
        text: `changed group photo`,
        type: 'system'
    });
};

/**
 * Updates a group's name
 */
export const updateGroupName = async (groupId, newName, updaterId) => {
    const groupSnapshot = await get(ref(db, `groups/${groupId}`));
    if (!groupSnapshot.exists()) return;
    const groupData = groupSnapshot.val();

    const updates = {};
    updates[`groups/${groupId}/name`] = newName;

    if (groupData.members) {
        Object.keys(groupData.members).forEach(memberId => {
            updates[`users/${memberId}/chatList/${groupId}/groupName`] = newName;
        });
    }

    await update(ref(db), updates);

    await saveMessage(groupId, {
        senderId: updaterId,
        text: `changed the group name to "${newName}"`,
        type: 'system'
    });
};

/**
 * Saves a message block to everyone (Deleted For Everyone)
 */

/**
 * Marks all unread messages in a chat as read
 */
export const markMessagesAsRead = async (chatId, currentUserId) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    const snapshot = await get(messagesRef);
    if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach((childSnap) => {
            if (childSnap.key === 'pinnedMessage') return;
            const msg = childSnap.val();
            if (msg.senderId !== currentUserId && msg.status !== 'read') {
                updates[`${childSnap.key}/status`] = 'read';
            }
        });
        if (Object.keys(updates).length > 0) {
            await update(messagesRef, updates);
        }
    }
};

/**
 * Marks all 'sent' messages in a chat as 'delivered' for the recipient
 */
export const markMessagesAsDelivered = async (chatId, currentUserId) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    const snapshot = await get(messagesRef);
    if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach((childSnap) => {
            if (childSnap.key === 'pinnedMessage') return;
            const msg = childSnap.val();
            // If the message was sent to me and is still only 'sent' or 'notified', upgrade it to 'delivered'
            if (msg.senderId !== currentUserId && (msg.status === 'sent' || msg.status === 'notified')) {
                updates[`${childSnap.key}/status`] = 'delivered';
            }
        });
        if (Object.keys(updates).length > 0) {
            await update(messagesRef, updates);
        }
    }
};

/**
 * Updates a message's text content
 */
export const updateMessage = async (chatId, msgId, updates) => {
    const msgRef = ref(db, `messages/${chatId}/${msgId}`);
    // Normalize updates parameter (handles legacy string signature from chat.js)
    let updatesObj = typeof updates === 'string' ? { text: updates } : { ...updates };

    await update(msgRef, {
        ...updatesObj,
        updatedAt: serverTimestamp()
    });
};

/**
 * Marks a specific message as unread by reverting its status
 */
export const markMessageAsUnread = async (chatId, msgId) => {
    const msgRef = ref(db, `messages/${chatId}/${msgId}`);
    await update(msgRef, { status: 'delivered' });
};

/**
 * Finds the ID of the first unread message in a chat for the current user
 */
export const getFirstUnreadMessageId = async (chatId, currentUserId) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    const snapshot = await get(messagesRef);
    let firstId = null;
    if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
            if (childSnap.key === 'pinnedMessage') return;
            const msg = childSnap.val();
            if (!firstId && msg.senderId !== currentUserId && msg.status !== 'read') {
                firstId = childSnap.key;
            }
        });
    }
    return firstId;
};

/**
 * Listens for the unread message count in a chat room
 */
export const subscribeToUnreadCount = (chatId, currentUserId, callback) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    return onValue(messagesRef, (snapshot) => {
        let count = 0;
        let hasUnreadOrder = false;
        snapshot.forEach((childSnap) => {
            if (childSnap.key === 'pinnedMessage') return;
            const msg = childSnap.val();
            if (msg.senderId !== currentUserId && msg.status !== 'read') {
                count++;
                const isInvoiceMsg = msg.type === 'invoice';
                const isPdfInvoiceMsg = msg.type === 'document' && msg.fileName && msg.fileName.startsWith('Invoice_');
                if ((isInvoiceMsg || isPdfInvoiceMsg) && !msg.orderConfirmed) {
                    hasUnreadOrder = true;
                }
            }
        });
        callback(count, hasUnreadOrder);
    });
};

/**
 * Listens for new messages in a specific chat room
 */
export const subscribeToMessages = (chatId, callback) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    // onChildAdded returns an unsubscribe function in some SDK versions, 
    // but in v9 modular we typically use it directly.
    return onChildAdded(messagesRef, (snapshot) => {
        callback({ id: snapshot.key, ...snapshot.val() });
    });
};

/**
 * Listens for message deletions (onChildRemoved)
 */
export const subscribeToMessageRemovals = (chatId, callback) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    return onChildRemoved(messagesRef, (snapshot) => {
        callback(snapshot.key);
    });
};

/**
 * Pins a specific message in a chat
 */
export const pinMessage = async (chatId, msgId, messageData) => {
    const pinRef = ref(db, `messages/${chatId}/pinnedMessage`);
    const textToSave = messageData.isEncrypted ? (messageData.ciphertext || messageData.text) : messageData.text;
    await set(pinRef, {
        msgId,
        text: textToSave || `[${messageData.type}]`,
        senderId: messageData.senderId,
        timestamp: serverTimestamp(),
        isEncrypted: messageData.isEncrypted || null,
        iv: messageData.iv || null
    });
};

/**
 * Unpins the current pinned message in a chat
 */
export const unpinMessage = async (chatId) => {
    const pinRef = ref(db, `messages/${chatId}/pinnedMessage`);
    await set(pinRef, null);
};

/**
 * Listens for changes to the pinned message in a chat
 */
export const subscribeToPinnedMessage = (chatId, callback) => {
    const pinRef = ref(db, `messages/${chatId}/pinnedMessage`);
    return onValue(pinRef, (snapshot) => callback(snapshot.val()));
};

/**
 * Listens for updates (like status changes) to existing messages
 */
export const subscribeToMessageUpdates = (chatId, callback) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    return onChildChanged(messagesRef, (snapshot) => {
        callback({ id: snapshot.key, ...snapshot.val(), chatId: chatId });
    });
};

/**
 * Toggles the starred status of a message in the database
 */
export const updateMessageStarStatus = async (userId, msgId, isStarred, messageData = null) => {
    const starRef = ref(db, `users/${userId}/starredMessages/${msgId}`);
    // If isStarred is true, save a timestamp; if false, remove the record
    await set(starRef, isStarred ? {
        ...messageData,
        starredAt: new Date().toISOString()
    } : null);
};

/**
 * Fetches all starred messages for a user
 */
export const getStarredMessages = async (userId) => {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}/starredMessages`));
    return snapshot.exists() ? snapshot.val() : {};
};

/**
 * Removes all starred messages for a user
 */
export const clearAllStarredMessages = async (userId) => {
    const starRef = ref(db, `users/${userId}/starredMessages`);
    await set(starRef, null);
};

/**
 * Batch deletes multiple messages (Deletes for me)
 */
export const deleteMessagesBatch = async (chatId, messageIds) => {
    const updates = {};
    messageIds.forEach(id => {
        updates[`messages/${chatId}/${id}`] = null;
    });
    await update(ref(db), updates);
};

/**
 * Marks multiple messages as deleted for everyone (placeholders)
 */
export const deleteMessagesForEveryoneBatch = async (chatId, messageIds) => {
    const updates = {};
    messageIds.forEach(id => {
        updates[`messages/${chatId}/${id}/text`] = "This message was deleted";
        updates[`messages/${chatId}/${id}/type`] = "text";
        updates[`messages/${chatId}/${id}/deleted`] = true;
        updates[`messages/${chatId}/${id}/url`] = null;
        updates[`messages/${chatId}/${id}/deletedAt`] = serverTimestamp();
        updates[`messages/${chatId}/${id}/fileName`] = null;
        updates[`messages/${chatId}/${id}/replyTo`] = null;
    });
    await update(ref(db), updates);
};

/**
 * Batch stars multiple messages
 */
export const starMessagesBatch = async (userId, messages) => {
    const updates = {};
    const timestamp = new Date().toISOString();
    messages.forEach(msg => {
        updates[`users/${userId}/starredMessages/${msg.id}`] = {
            ...msg.data,
            starredAt: timestamp
        };
    });
    await update(ref(db), updates);
};

/**
 * Adds a user to the current user's active chat list
 */
export const addToChatList = async (userId, otherUserId) => {
    const chatListRef = ref(db, `users/${userId}/chatList/${otherUserId}`);
    await set(chatListRef, serverTimestamp());
};

/**
 * Removes a chat from the current user's chat list.
 */
export const deleteChatFromList = async (userUid, otherUid) => {
    const chatListRef = ref(db, `users/${userUid}/chatList/${otherUid}`);
    await set(chatListRef, null);
};

/**
 * Updates the archive status of a chat for the current user.
 */
export const updateChatArchiveStatus = async (userUid, otherUid, isArchived) => {
    const chatListRef = ref(db, `users/${userUid}/chatList/${otherUid}`);
    await update(chatListRef, { isArchived: isArchived });
};

/**
 * Toggles the blocked status of a user in the current user's preferences
 */
export const toggleBlockUser = async (userId, targetUid, isBlocked, reason = null) => {
    const blockRef = ref(db, `users/${userId}/blockedUsers/${targetUid}`);
    const publicBlockRef = ref(db, `publicProfiles/${userId}/blockedUsers/${targetUid}`);
    if (isBlocked) {
        const blockData = {
            reason: reason || 'other',
            timestamp: serverTimestamp()
        };
        await Promise.all([
            set(blockRef, blockData),
            set(publicBlockRef, blockData)
        ]);
    } else {
        await Promise.all([
            set(blockRef, null),
            set(publicBlockRef, null)
        ]);
    }
};

/**
 * Removes all blocked users from the current user's preferences
 */
export const unblockAllUsers = async (userId) => {
    const blockRef = ref(db, `users/${userId}/blockedUsers`);
    const publicBlockRef = ref(db, `publicProfiles/${userId}/blockedUsers`);
    await Promise.all([
        set(blockRef, null),
        set(publicBlockRef, null)
    ]);
};

/**
 * Listens for changes in the user's blocked list
 */
export const subscribeToBlockedUsers = (userId, callback) => {
    const blockRef = ref(db, `users/${userId}/blockedUsers`);
    return onValue(blockRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};

/**
 * Listens for changes in the user's excluded contacts list
 */
export const subscribeToExcludedContacts = (userId, callback) => {
    const excludedRef = ref(db, `users/${userId}/excludedContacts`);
    return onValue(excludedRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};
/**
 * Manages a user in the current user's customer list
 */
export const toggleCustomerList = async (userId, otherUserId, isAdding) => {
    const updates = {};
    updates[`users/${userId}/customerList/${otherUserId}`] = isAdding ? serverTimestamp() : null;
    if (isAdding) {
        updates[`users/${userId}/customerHistory/${otherUserId}`] = true;
    }
    await update(ref(db), updates);
};

/**
 * Records a friend request in the target user's incoming requests
 */
export const sendFriendRequest = async (fromUid, toUid) => {
    const updates = {};
    const now = serverTimestamp();
    // Request for the recipient
    updates[`users/${toUid}/friendRequests/${fromUid}`] = {
        fromUid,
        timestamp: now,
        status: 'pending'
    };
    // Track the outgoing request for the sender
    updates[`users/${fromUid}/sentRequests/${toUid}`] = now;

    await update(ref(db), updates);
};

/**
 * Accepts a request: Adds both users to each other's customer list and removes the request
 */
export const acceptFriendRequest = async (uid, fromUid) => {
    const updates = {};
    const now = serverTimestamp();
    updates[`users/${uid}/customerList/${fromUid}`] = now;
    updates[`users/${uid}/customerHistory/${fromUid}`] = true;
    updates[`users/${fromUid}/customerList/${uid}`] = now;
    updates[`users/${fromUid}/customerHistory/${uid}`] = true;
    updates[`users/${uid}/friendRequests/${fromUid}`] = null;
    updates[`users/${fromUid}/sentRequests/${uid}`] = null;
    await update(ref(db), updates);

    // Automatically notify the sender by starting a chat with an acceptance message
    const chatId = [uid, fromUid].sort().join('_');
    await saveMessage(chatId, {
        senderId: uid, // The acceptor is the sender of this auto-message
        text: "I've accepted your request. Let's chat!",
        type: 'system'
    });
};

/**
 * Removes both users from each other's customer list (Unfriend)
 */
export const unfriendUser = async (uid, targetUid) => {
    const updates = {};
    updates[`users/${uid}/customerList/${targetUid}`] = null;
    updates[`users/${targetUid}/customerList/${uid}`] = null;
    await update(ref(db), updates);
};

/**
 * Declines a request by removing it from the database
 */
export const declineFriendRequest = async (uid, fromUid) => {
    const updates = {};
    updates[`users/${uid}/friendRequests/${fromUid}`] = null;
    updates[`users/${fromUid}/sentRequests/${uid}`] = null;
    await update(ref(db), updates);
};

// Local cache and subscriptions for user profiles to bypass global /users restrictions
const localAllUsersCache = {};
const allUsersCallbacks = new Set();
const activeProfileSubscriptions = new Map();

const notifyAllUsersCallbacks = () => {
    const cacheCopy = { ...localAllUsersCache };
    for (const callback of allUsersCallbacks) {
        try {
            callback(cacheCopy);
        } catch (e) {
            console.error("Error in subscribeToAllUsers callback:", e);
        }
    }
};

export const requestUserProfile = (uid) => {
    if (!uid || uid === 'undefined') return;
    if (activeProfileSubscriptions.has(uid)) return;

    const unsubscribe = subscribeToUserProfile(uid, () => {});
    activeProfileSubscriptions.set(uid, unsubscribe);
};

/**
 * Listens for incoming friend requests
 */
export const subscribeToFriendRequests = (uid, callback) => {
    const requestsRef = ref(db, `users/${uid}/friendRequests`);
    return onValue(requestsRef, (snapshot) => {
        const val = snapshot.val() || {};
        Object.keys(val).forEach(otherUid => requestUserProfile(otherUid));
        callback(val);
    });
};

/**
 * Listens for outgoing friend requests
 */
export const subscribeToSentRequests = (uid, callback) => {
    const sentRef = ref(db, `users/${uid}/sentRequests`);
    return onValue(sentRef, (snapshot) => {
        const val = snapshot.val() || {};
        Object.keys(val).forEach(otherUid => requestUserProfile(otherUid));
        callback(val);
    });
};

/**
 * Listens for changes in the user's active customer list
 */
export const subscribeToCustomerList = (userId, callback) => {
    console.log("[Customer List Debug] Subscribing to customerList for user:", userId);
    const customerRef = ref(db, `users/${userId}/customerList`);
    return onValue(customerRef, (snapshot) => {
        const val = snapshot.val() || {};
        console.log("[Customer List Debug] customerList snapshot received. Data:", val);
        Object.keys(val).forEach(otherUid => requestUserProfile(otherUid));
        callback(val);
    }, (error) => {
        console.error("[Customer List Debug] Error in subscribeToCustomerList listener:", error);
    });
};

/**
 * Listens for changes to the entire users directory
 */
export const subscribeToAllUsers = (callback) => {
    console.log("[All Users Debug] Subscribing to publicProfiles...");
    const usersRef = ref(db, 'publicProfiles');
    return onValue(usersRef, (snapshot) => {
        const val = snapshot.val() || {};
        console.log("[All Users Debug] publicProfiles snapshot received. Count:", Object.keys(val).length);
        const parsedUsers = {};
        Object.entries(val).forEach(([uid, profile]) => {
            parsedUsers[uid] = { uid, ...profile };
            localAllUsersCache[uid] = { uid, ...profile };
        });
        callback(parsedUsers);
    }, (error) => {
        console.error("[All Users Debug] Error in subscribeToAllUsers database listener:", error);
    });
};

/**
 * Listens for real-time changes to a specific user's profile
 */
export const subscribeToUserProfile = (userId, callback) => {
    console.log("[User Profile Debug] Subscribing to profile for user:", userId);
    const userRef = ref(db, `publicProfiles/${userId}`);
    return onValue(userRef, (snapshot) => {
        const val = snapshot.val();
        console.log("[User Profile Debug] Profile snapshot received for user:", userId, "Data:", val);
        if (val) {
            const profile = { uid: userId, ...val };
            cacheItem('profiles', profile);
            localAllUsersCache[userId] = profile;
            notifyAllUsersCallbacks();
        }
        callback(val);
    }, (error) => {
        console.error("[User Profile Debug] Error in subscribeToUserProfile listener for:", userId, error);
    });
};

/**
 * Listens for real-time changes to a specific group's profile/metadata
 */
export const subscribeToGroupProfile = (groupId, callback) => {
    const groupRef = ref(db, `groups/${groupId}`);
    return onValue(groupRef, (snapshot) => {
        callback(snapshot.val());
    });
};

/**
 * Fetches the current user's chat list IDs once
 */
export const getChatList = async (userId) => {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}/chatList`));
    const val = snapshot.exists() ? snapshot.val() : {};
    Object.keys(val).forEach(otherUid => requestUserProfile(otherUid));
    return val;
};

/**
 * Listens for changes in the user's active chat list
 */
export const subscribeToChatList = (userId, callback) => {
    const chatListRef = ref(db, `users/${userId}/chatList`);
    return onValue(chatListRef, (snapshot) => {
        const val = snapshot.val() || {};
        Object.keys(val).forEach(otherUid => requestUserProfile(otherUid));
        callback(val);
    });
};

/**
 * Fetches all users from the database
 */
export const getAllUsers = async () => {
    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, 'publicProfiles'));
        if (snapshot.exists()) {
            const val = snapshot.val() || {};
            Object.entries(val).forEach(([uid, profile]) => {
                localAllUsersCache[uid] = { uid, ...profile };
            });
        }
    } catch (e) {
        console.error("Error in getAllUsers:", e);
    }
    return { ...localAllUsersCache };
};

/**
 * Fetches user profile data from the Realtime Database
 */
export const getUserProfile = async (userId) => {
    let cached = await getCachedItem('profiles', userId);
    
    // Start background revalidation to ensure the local profile cache doesn't stay stale forever
    const revalidatePromise = (async () => {
        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `publicProfiles/${userId}`));
            if (snapshot.exists()) {
                const val = snapshot.val();
                
                // Auto-heal/migrate missing createdAt
                if (val && !val.createdAt) {
                    try {
                        const userSnapshot = await get(child(dbRef, `users/${userId}/createdAt`));
                        if (userSnapshot.exists() && userSnapshot.val()) {
                            val.createdAt = userSnapshot.val();
                            await set(ref(db, `publicProfiles/${userId}/createdAt`), val.createdAt);
                        } else {
                            val.createdAt = Date.now();
                            await set(ref(db, `users/${userId}/createdAt`), val.createdAt);
                            await set(ref(db, `publicProfiles/${userId}/createdAt`), val.createdAt);
                        }
                    } catch (e) {
                        console.warn("Could not auto-heal public profile createdAt for user:", userId, e);
                    }
                }

                const profile = { uid: userId, ...val };
                await cacheItem('profiles', profile);
                
                const isDifferent = !cached || JSON.stringify(cached) !== JSON.stringify(profile);
                if (isDifferent) {
                    localAllUsersCache[userId] = profile;
                    notifyAllUsersCallbacks();
                }
                return profile;
            }
        } catch (err) {
            console.error("Error revalidating profile for user:", userId, err);
        }
        return null;
    })();

    if (cached && cached.createdAt) {
        if (userId && !localAllUsersCache[userId]) {
            localAllUsersCache[userId] = cached;
            notifyAllUsersCallbacks();
        }
        return cached;
    }

    return await revalidatePromise;
};

export const getUserIdByPhoneNumber = async (phoneNumber) => {
    if (!phoneNumber) return null;
    try {
        const userQuery = query(ref(db, 'publicProfiles'), orderByChild('phoneNumber'), equalTo(phoneNumber));
        const snapshot = await get(userQuery);
        if (!snapshot.exists()) return null;

        const profiles = snapshot.val();
        if (!profiles || typeof profiles !== 'object') return null;

        const userIds = Object.keys(profiles);
        return userIds.length > 0 ? userIds[0] : null;
    } catch (error) {
        console.error('Failed to look up user by phone number:', error);
        return null;
    }
};

export const saveProduct = async (productId, productData) => {
    const id = productId || push(ref(db, 'products')).key;
    const productRef = ref(db, `products/${id}`);

    // If updating, get ownerId from productData, auth, or query db/cache if needed
    let ownerId = productData.ownerId || auth.currentUser?.uid;
    if (!ownerId && productId) {
        const cached = await getCachedItem('products', productId);
        if (cached && cached.ownerId) {
            ownerId = cached.ownerId;
        } else {
            const snap = await get(ref(db, `products/${productId}/ownerId`));
            if (snap.exists()) {
                ownerId = snap.val();
            }
        }
    }

    const data = {
        ...productData,
        id: id,
        updatedAt: serverTimestamp(),
        isActive: true, // Mark active upon adding or updating
    };

    if (!productId) data.createdAt = serverTimestamp();
    await update(productRef, data);
    
    if (ownerId) {
        data.ownerId = ownerId;
        await update(ref(db, `sellerProducts/${ownerId}/${id}`), data);
    }
    
    // Save to IndexedDB cache
    const cacheData = { 
        ...data, 
        createdAt: data.createdAt === serverTimestamp() ? Date.now() : (data.createdAt || Date.now()),
        updatedAt: Date.now()
    };
    await cacheItem('products', cacheData);
    return id;
};

/**
 * Listens for all products in real-time (Deprecated - use getProductsPage or subscribeToSellerProducts instead)
 */
export const subscribeToProducts = (callback) => {
    const productsRef = ref(db, 'products');
    return onValue(productsRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};

/**
 * Deletes a product from the database and local cache
 */
export const deleteProduct = async (productId, imageUrls = []) => {
    if (imageUrls && imageUrls.length > 0) {
        // Delete all associated images from Storage
        await Promise.all(imageUrls.map(url => deleteFile(url)));
    }

    try {
        const snap = await get(ref(db, `products/${productId}`));
        if (snap.exists()) {
            const product = snap.val();
            if (product && product.ownerId) {
                await set(ref(db, `sellerProducts/${product.ownerId}/${productId}`), null);
            }
        }
    } catch (e) {
        console.error("Error deleting from sellerProducts:", e);
    }

    await set(ref(db, `products/${productId}`), null);
    await deleteCachedItem('products', productId);
};

/**
 * Fetches a single page of products sorted by creation time
 */
export const getProductsPage = async (lastKey = null, limit = 20) => {
    let productsQuery;
    if (lastKey) {
        productsQuery = query(
            ref(db, 'products'),
            orderByKey(),
            endBefore(lastKey),
            limitToLast(limit)
        );
    } else {
        productsQuery = query(
            ref(db, 'products'),
            orderByKey(),
            limitToLast(limit)
        );
    }
    const snapshot = await get(productsQuery);
    if (snapshot.exists()) {
        const val = snapshot.val();
        for (const key in val) {
            await cacheItem('products', val[key]);
            if (val[key].ownerId) {
                requestUserProfile(val[key].ownerId);
            }
        }
        return val;
    }
    return {};
};

/**
 * Fetches products in a specific category
 */
export const getProductsByCategory = async (category) => {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'products'));
    if (!snapshot.exists()) return {};

    const allProducts = snapshot.val();
    const matchedProducts = {};

    for (const key in allProducts) {
        const product = allProducts[key];
        const prodCat = product.category || '';

        // Check product category
        let matches = prodCat.toLowerCase() === category.toLowerCase();

        // Check seller's business category
        if (!matches && product.ownerId) {
            const sellerProfile = localAllUsersCache[product.ownerId] || {};
            const bizProfile = sellerProfile.businessProfile || {};
            const bizCat = bizProfile.category || '';
            if (bizCat) {
                const sellerCategories = bizCat.split(', ').map(s => s.trim().toLowerCase());
                if (sellerCategories.includes(category.toLowerCase())) {
                    matches = true;
                }
            }
        }

        if (matches) {
            matchedProducts[key] = product;
        }
    }

    // Cache results and fetch profiles
    for (const key in matchedProducts) {
        const product = matchedProducts[key];
        await cacheItem('products', product);
        if (product.ownerId) {
            requestUserProfile(product.ownerId);
        }
    }

    return matchedProducts;
};

// Helper for Bigram Jaccard fuzzy string similarity
const getFuzzySearchBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
};

const getFuzzySearchScore = (queryStr, targetStr) => {
    const q = queryStr.trim().toLowerCase();
    const t = targetStr.trim().toLowerCase();
    if (!q || !t) return 0;

    // 1. Direct substring check (highest relevance)
    if (t.includes(q)) return 1.0;

    // 2. Word-by-word prefix/substring check
    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);
    let wordsMatched = 0;
    qWords.forEach(qw => {
        if (tWords.some(tw => tw.includes(qw))) {
            wordsMatched++;
        }
    });
    if (wordsMatched === qWords.length) {
        return 0.9;
    }

    // 3. Bigram Jaccard similarity for misspelling tolerance
    const qBigrams = getFuzzySearchBigrams(q);
    const tBigrams = getFuzzySearchBigrams(t);
    if (qBigrams.size === 0) return 0;

    let intersection = 0;
    qBigrams.forEach(bg => {
        if (tBigrams.has(bg)) {
            intersection++;
        }
    });

    const union = qBigrams.size + tBigrams.size - intersection;
    return intersection / union;
};

/**
 * Fuzzy multi-field search on products (names, descriptions, categories/forms, seller names)
 */
export const getProductsBySearch = async (searchTerm) => {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'products'));
    if (!snapshot.exists()) return {};

    const allProducts = snapshot.val();
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allProducts;

    const matchedProducts = {};

    for (const key in allProducts) {
        const product = allProducts[key];
        const name = product.name || '';
        const desc = product.description || product.desc || '';
        const cat = product.category || '';
        const form = product.form || product.productForm || '';
        
        // Resolve seller name from the active profiles cache
        const sellerProfile = localAllUsersCache[product.ownerId] || {};
        const sellerName = sellerProfile.fullname || sellerProfile.businessName || 'Someone';

        // Check fuzzy score on each field
        const scoreName = getFuzzySearchScore(term, name);
        const scoreDesc = getFuzzySearchScore(term, desc);
        const scoreCat = getFuzzySearchScore(term, cat);
        const scoreForm = getFuzzySearchScore(term, form);
        const scoreSeller = getFuzzySearchScore(term, sellerName);

        const maxScore = Math.max(scoreName, scoreDesc, scoreCat, scoreForm, scoreSeller);

        // Threshold of 0.25 for matching
        if (maxScore >= 0.25) {
            // Store the score to sort by relevance in UI
            product.searchScore = maxScore;
            matchedProducts[key] = product;
        }
    }

    // Sort matched products by searchScore descending (relevance)
    const sortedEntries = Object.entries(matchedProducts).sort((a, b) => {
        return (b[1].searchScore || 0) - (a[1].searchScore || 0);
    });

    const result = {};
    for (const [key, product] of sortedEntries) {
        result[key] = product;
        await cacheItem('products', product);
        if (product.ownerId) {
            requestUserProfile(product.ownerId);
        }
    }

    return result;
};

/**
 * Fetches products for a specific business owner
 */
export const getProductsByOwner = async (ownerId) => {
    if (ownerId) {
        requestUserProfile(ownerId);
    }
    // Try fetching from denormalized sellerProducts node first
    const sellerSnap = await get(ref(db, `sellerProducts/${ownerId}`));
    if (sellerSnap.exists()) {
        const val = sellerSnap.val();
        for (const key in val) {
            await cacheItem('products', val[key]);
        }
        return val;
    }

    // Fallback: Fetch all products and filter client-side (for backwards compatibility)
    const allSnap = await get(ref(db, 'products'));
    if (allSnap.exists()) {
        const val = allSnap.val();
        const filtered = {};
        for (const key in val) {
            if (val[key].ownerId === ownerId) {
                filtered[key] = val[key];
                await cacheItem('products', val[key]);
            }
        }
        return filtered;
    }
    return {};
};

/**
 * Real-time listener for a specific seller's own products (for inventory management)
 */
export const subscribeToSellerProducts = (ownerId, callback) => {
    if (ownerId) {
        requestUserProfile(ownerId);
    }
    const sellerRef = ref(db, `sellerProducts/${ownerId}`);
    return onValue(sellerRef, async (snapshot) => {
        if (snapshot.exists()) {
            const val = snapshot.val();
            for (const key in val) {
                cacheItem('products', val[key]);
            }
            callback(val);
        } else {
            // Fallback for backwards compatibility: query all products and filter
            const allRef = ref(db, 'products');
            onValue(allRef, (allSnap) => {
                const val = allSnap.val() || {};
                const filtered = {};
                for (const key in val) {
                    if (val[key].ownerId === ownerId) {
                        filtered[key] = val[key];
                        cacheItem('products', val[key]);
                    }
                }
                callback(filtered);
            }, { onlyOnce: true });
        }
    });
};

/**
 * Toggles the mute status of a user in the current user's preferences
 */
export const toggleMuteUser = async (userId, targetUid, isMuted) => {
    const muteRef = ref(db, `users/${userId}/mutedUsers/${targetUid}`);
    await set(muteRef, isMuted ? true : null);
};

/**
 * Call History Logs
 */
export const saveCallLog = async (userId, logData) => {
    console.log("[Call History Debug] saveCallLog called. userId:", userId, "logData:", logData);
    try {
        const logsRef = ref(db, `callLogs/${userId}`);
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            ...logData,
            timestamp: serverTimestamp()
        });
        console.log("[Call History Debug] saveCallLog successfully written!");
    } catch (e) {
        console.error("[Call History Debug] saveCallLog write error:", e);
        throw e;
    }
};

export const clearCallHistory = async (userId) => {
    const logsRef = ref(db, `callLogs/${userId}`);
    await set(logsRef, null);
};

export const subscribeToCallHistory = (userId, callback) => {
    console.log("[Call History Debug] subscribeToCallHistory called for:", userId);
    const logsRef = ref(db, `callLogs/${userId}`);
    return onValue(logsRef, (snapshot) => {
        const val = snapshot.val() || {};
        console.log("[Call History Debug] Received callLogs snapshot. Items count:", Object.keys(val).length);
        callback(val);
    }, (error) => {
        console.error("[Call History Debug] Error subscribing to call history:", error);
    });
};

/**
 * Voice Call Signaling
 */
export const sendCallSignal = async (targetUid, senderUid, signalData) => {
    let actualSenderUid = senderUid;
    let actualSignalData = signalData;
    if (typeof senderUid === 'object' && !signalData) {
        actualSignalData = senderUid;
        actualSenderUid = senderUid.from || (auth.currentUser ? auth.currentUser.uid : 'unknown');
    }
    const callRef = ref(db, `calls/${targetUid}/${actualSenderUid}`);
    await set(callRef, {
        ...actualSignalData,
        from: actualSenderUid,
        timestamp: serverTimestamp()
    });
};

export const subscribeToCallSignals = (uid, callback) => {
    const callRef = ref(db, `calls/${uid}`);
    return onValue(callRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    });
};

export const clearCallSignal = async (uid, senderUid) => {
    if (senderUid) {
        await set(ref(db, `calls/${uid}/${senderUid}`), null);
    } else {
        await set(ref(db, `calls/${uid}`), null);
    }
};

export const addIceCandidate = async (targetUid, senderUid, candidate) => {
    if (!targetUid) return;
    let actualSenderUid = senderUid;
    let actualCandidate = candidate;
    if (senderUid && (typeof senderUid.toJSON === 'function' || senderUid.candidate !== undefined) && !candidate) {
        actualCandidate = senderUid;
        actualSenderUid = auth.currentUser ? auth.currentUser.uid : 'unknown';
    }
    if (!actualCandidate) return;
    try {
        let rawData = typeof actualCandidate.toJSON === 'function' ? actualCandidate.toJSON() : actualCandidate;
        if (typeof rawData !== 'object' || rawData === null) return;
        const cleanData = {};
        if (rawData.candidate !== undefined) cleanData.candidate = rawData.candidate;
        if (rawData.sdpMid !== undefined && rawData.sdpMid !== null) cleanData.sdpMid = rawData.sdpMid;
        if (rawData.sdpMLineIndex !== undefined && rawData.sdpMLineIndex !== null) cleanData.sdpMLineIndex = rawData.sdpMLineIndex;
        if (rawData.usernameFragment !== undefined && rawData.usernameFragment !== null) cleanData.usernameFragment = rawData.usernameFragment;

        const candidatesRef = ref(db, `calls/${targetUid}/candidates/${actualSenderUid}`);
        const newCandidateRef = push(candidatesRef);
        await set(newCandidateRef, cleanData);
    } catch (err) {
        console.warn("Failed to push ICE candidate:", err);
    }
};

export const clearIceCandidates = async (targetUid, senderUid) => {
    await set(ref(db, `calls/${targetUid}/candidates/${senderUid}`), null);
};

export const subscribeToIceCandidates = (uid, senderUid, callback) => {
    let actualSenderUid = senderUid;
    let actualCallback = callback;
    if (typeof senderUid === 'function' && !callback) {
        actualCallback = senderUid;
        // Fall back to a default caller if not specified, though the refactored code passes targetUid
        actualSenderUid = 'unknown';
    }
    const candidatesRef = ref(db, `calls/${uid}/candidates/${actualSenderUid}`);
    return onChildAdded(candidatesRef, (snapshot) => {
        actualCallback(snapshot.val());
    });
};

/**
 * Listens for changes in the user's muted list
 */
export const subscribeToMutedUsers = (userId, callback) => {
    const muteRef = ref(db, `users/${userId}/mutedUsers`);
    return onValue(muteRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};

export const saveBusinessProfile = async (userId, businessData) => {
    const businessRef = ref(db, `users/${userId}/businessProfile`);
    const publicBusinessRef = ref(db, `publicProfiles/${userId}/businessProfile`);
    const data = { ...businessData, updatedAt: serverTimestamp() };
    await Promise.all([
        set(businessRef, data),
        set(publicBusinessRef, data)
    ]);
    await cacheItem('shops', { userId, ...businessData });

    // Also update profiles cache to prevent stale businessProfile data
    try {
        const cachedProfile = await getCachedItem('profiles', userId);
        if (cachedProfile) {
            cachedProfile.businessProfile = { ...businessData, updatedAt: new Date().toISOString() };
            await cacheItem('profiles', cachedProfile);
        }
    } catch (e) {
        console.warn("Failed to update profiles cache during saveBusinessProfile:", e);
    }
};

/**
 * Fetches a user's business profile.
 */
export const getBusinessProfile = async (userId, { skipCache = false } = {}) => {
    let cachedShop = null;
    if (!skipCache) {
        cachedShop = await getCachedItem('shops', userId);
    }

    const isSelf = auth.currentUser && userId === auth.currentUser.uid;

    const revalidatePromise = (async () => {
        if (isSelf) {
            try {
                const dbRef = ref(db);
                const snapshot = await get(child(dbRef, `users/${userId}`));
                if (snapshot.exists()) {
                    const profile = snapshot.val();
                    if (profile.theme) { 
                        let themeToApply = profile.theme;
                        if (themeToApply === 'system') {
                            themeToApply = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                        }

                        document.body.classList.remove('dark-theme', 'oled-theme');
                        if (themeToApply === 'dark') document.body.classList.add('dark-theme');
                        else if (themeToApply === 'oled') document.body.classList.add('oled-theme');
                    }
                    const biz = profile.businessProfile || null;
                    if (biz) {
                        await cacheItem('shops', { userId, ...biz });
                    }
                    return biz;
                }
            } catch (err) {
                console.warn("Failed to read self profile for business check:", err);
            }
        }

        try {
            const snapshot = await get(ref(db, `publicProfiles/${userId}/businessProfile`));
            if (snapshot.exists()) {
                const biz = snapshot.val();
                await cacheItem('shops', { userId, ...biz });
                return biz;
            }
        } catch (error) {
            console.warn("Failed to read seller business profile from public profile node:", error);
        }

        // Safe fallback for older cached or self-scope reads when the public copy is temporarily missing.
        if (isSelf) {
            try {
                const snapshot = await get(ref(db, `users/${userId}/businessProfile`));
                if (snapshot.exists()) {
                    const biz = snapshot.val();
                    await cacheItem('shops', { userId, ...biz });
                    return biz;
                }
            } catch (error) {
                console.warn("Failed to read self business profile from private profile node:", error);
            }
        }
        return null;
    })();

    if (cachedShop && !skipCache) {
        return cachedShop;
    }

    return await revalidatePromise;
};

/**
 * Deletes a user's business profile and removes the registration flag.
 */
export const deleteBusinessProfile = async (userId) => {
    const updates = {};
    updates[`users/${userId}/businessProfile`] = null;
    updates[`users/${userId}/isBusinessRegistered`] = false;
    updates[`publicProfiles/${userId}/businessProfile`] = null;
    await update(ref(db), updates);
};

/**
 * Saves a business report to the database
 */
export const reportBusiness = async (reporterUid, businessUid, reason) => {
    const reportRef = push(ref(db, 'businessReports'));
    await set(reportRef, {
        reporterUid,
        businessUid,
        reason,
        timestamp: serverTimestamp()
    });
};

/**
 * Linked Devices & Session Authorization
 */
export const subscribeToLinkedDevices = (userId, callback) => {
    const devicesRef = ref(db, `users/${userId}/linkedDevices`);
    return onValue(devicesRef, (snapshot) => callback(snapshot.val() || {}));
};

export const removeLinkedDevice = async (userId, deviceId) => {
    await set(ref(db, `users/${userId}/linkedDevices/${deviceId}`), null);
};

export const removeAllLinkedDevices = async (userId, currentSessionId) => {
    const devicesRef = ref(db, `users/${userId}/linkedDevices`);
    const snapshot = await get(devicesRef);

    if (snapshot.exists()) {
        const devices = snapshot.val();
        const updates = {};
        Object.entries(devices).forEach(([id, device]) => {
            if (device.sessionId !== currentSessionId) {
                updates[id] = null; // Mark for deletion
            }
        });
        await update(devicesRef, updates);
    }
};

/**
 * Generates a random string for use as a custom token.
 * In a real-world scenario, this would be generated server-side.
 */
const generateCustomToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const createLinkingSession = async () => {
    const sessionsRef = ref(db, 'linkingSessions');
    const newSessionRef = push(sessionsRef);
    const customToken = generateCustomToken(); // Generate a custom token
    await set(newSessionRef, {
        authorized: false,
        timestamp: serverTimestamp(),
        customToken: customToken // Store the custom token
    });
    return { sessionId: newSessionRef.key, customToken: customToken }; // Return both
};

export const authorizeSession = async (sessionId, receivedCustomToken, userId, deviceInfo, encryptedSession = null) => {
    const sessionRef = ref(db, `linkingSessions/${sessionId}`);

    // Pre-cache the session data to ensure the transaction callback does not receive null on its initial local-cache run
    const sessionSnap = await get(sessionRef);
    if (!sessionSnap.exists()) {
        throw new Error("Session does not exist.");
    }

    const devicesListRef = ref(db, `users/${userId}/linkedDevices`);
    const newDeviceRef = push(devicesListRef);
    const deviceKey = newDeviceRef.key;

    // Use a transaction to prevent race conditions from multiple QR code scans
    return runTransaction(sessionRef, (currentData) => {
        if (currentData === null) {
            return currentData;
        }
        if (currentData.authorized) {
            // Session has already been used by another scan, abort.
            return;
        }
        if (currentData.customToken !== receivedCustomToken) {
            // Invalid token, abort.
            // In a real-world secure app, this would be handled server-side.
            return;
        }

        // Mark the session as authorized to prevent reuse
        currentData.authorized = true;
        currentData.uid = userId;
        currentData.timestamp = Date.now();
        currentData.deviceKey = deviceKey; // Store the linked device's database key!
        currentData.encryptedSession = encryptedSession;
        currentData.customToken = null; // Nullify token after use

        return currentData;
    }).then(async (result) => {
        if (!result.committed) {
            throw new Error("Failed to authorize session. It might have been used already.");
        }

        // If the transaction was successful, proceed with adding the device
        const devicesSnapshot = await get(devicesListRef);
        if (devicesSnapshot.exists() && Object.keys(devicesSnapshot.val()).length >= 5) {
            throw new Error("MAX_DEVICES_REACHED");
        }

        await set(newDeviceRef, {
            ...deviceInfo,
            timestamp: Date.now(),
            sessionId
        });

        // Send security notification after successful linking
        try {
            const userSnap = await get(child(ref(db, `users/${userId}`), 'securityNotifications'));
            if (userSnap.val() !== false) {
                const selfChatId = [userId, userId].sort().join('_');
                await saveMessage(selfChatId, {
                    senderId: 'system',
                    type: 'system',
                    text: `Security Alert: A new device (${deviceInfo.deviceName || deviceInfo.browser}) was linked to your account.

Device: ${deviceInfo.platform}
Location: ${deviceInfo.city || 'Unknown City'}, ${deviceInfo.country || 'Unknown Country'}
Time: ${new Date().toLocaleString()}

If this wasn't you, revoke access immediately from Settings > Linked Devices.`
                });
            }
        } catch (e) {
            console.warn("Failed to send security notification:", e);
        }
    });
};

export const listenForSessionAuth = (sessionId, callback) => {
    const sessionRef = ref(db, `linkingSessions/${sessionId}`);
    return onValue(sessionRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.authorized && data.uid) {
            callback(data.uid, data.encryptedSession, data.deviceKey);
        }
    });
};

export const updateLinkedDeviceLastSeen = async (userId, sessionId) => {
    if (!userId || !sessionId) return;
    const devicesRef = ref(db, `users/${userId}/linkedDevices`);
    const snapshot = await get(devicesRef);
    if (snapshot.exists()) {
        const devices = snapshot.val();
        const deviceId = Object.keys(devices).find(key => key === sessionId || (devices[key] && devices[key].sessionId === sessionId));
        if (deviceId) {
            await update(ref(db, `users/${userId}/linkedDevices/${deviceId}`), {
                timestamp: Date.now()
            });
        }
    }
};

/**
 * Cleans up sessions older than 30 days and checks if the current session is still valid.
 * @param {string} userId 
 * @param {string|null} currentSessionId 
 * @returns {Promise<{valid: boolean}>}
 */
export const validateAndCleanupSessions = async (userId, currentSessionId = null) => {
    const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days
    const WARNING_THRESHOLD = 27 * 24 * 60 * 60 * 1000; // 27 days (3 days remaining)
    const now = Date.now();
    const devicesRef = ref(db, `users/${userId}/linkedDevices`);
    const snapshot = await get(devicesRef);

    if (!snapshot.exists()) {
        return { valid: currentSessionId ? false : true, warning: false };
    }

    const devices = snapshot.val();
    const updates = {};
    let sessionFound = false;
    let sessionExpired = false;
    let sessionWarning = false;

    Object.entries(devices).forEach(([id, dev]) => {
        // Grace period for newly created sessions (e.g., 5 minutes) to prevent instant logout on link
        const GRACE_PERIOD = 5 * 60 * 1000;
        if (now - dev.timestamp < GRACE_PERIOD) {
            if (currentSessionId && (id === currentSessionId || dev.sessionId === currentSessionId)) sessionFound = true;
            return; // Skip validation for this new device
        }
        const diff = now - dev.timestamp;
        const isExpired = diff > INACTIVITY_THRESHOLD;

        if (isExpired) {
            updates[id] = null;
        }

        if (currentSessionId && (id === currentSessionId || dev.sessionId === currentSessionId)) {
            sessionFound = true;
            if (isExpired) {
                sessionExpired = true;
            } else if (diff > WARNING_THRESHOLD) {
                sessionWarning = true;
            }
        }
    });

    if (Object.keys(updates).length > 0) {
        await update(devicesRef, updates);
    }

    return {
        valid: currentSessionId ? (sessionFound && !sessionExpired) : true,
        warning: sessionWarning
    };
};

/**
 * Monitors a specific linked device session for revocation.
 * When the device entry is removed from the database, the callback is triggered.
 * @param {string} userId - The current user's ID.
 * @param {string} sessionId - The session ID stored on the linked device.
 * @param {function} onRevoked - The callback function to execute when the session is revoked.
 * @returns {function} An unsubscribe function to stop the listener.
 */
export const monitorDeviceSession = (userId, sessionId, onRevoked) => {
    const devicesRef = ref(db, `users/${userId}/linkedDevices`);

    const unsubscribe = onValue(devicesRef, (snapshot) => {
        if (!snapshot.exists()) {
            // If the entire 'linkedDevices' node is gone, all devices are revoked.
            onRevoked();
            return;
        }
        const devices = snapshot.val();
        const deviceStillExists = Object.entries(devices).some(([id, dev]) => {
            return id === sessionId || (dev && dev.sessionId === sessionId);
        });
        if (!deviceStillExists) {
            onRevoked();
        }
    });

    return unsubscribe;
};

/**
 * Deletes all products owned by a user, including their images in Storage.
 */
export const deleteUserProducts = async (userId) => {
    const productsRef = ref(db, 'products');
    const snapshot = await get(productsRef);
    if (snapshot.exists()) {
        const products = snapshot.val();
        const deletePromises = [];
        Object.entries(products).forEach(([id, product]) => {
            if (product.ownerId === userId) {
                // Delete the owned product node only. We intentionally avoid storage object deletion here
                // because Firebase Storage permission/capability rules are separate from the DB rule model.
                deletePromises.push(set(ref(db, `products/${id}`), null));
            }
        });
        await Promise.all(deletePromises);
    }
};

/**
 * Deletes the user's profile, business profile, and call logs.
 */
export const deleteFullUserProfile = async (userId) => {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    let chatList = {};

    if (snapshot.exists()) {
        const profile = snapshot.val();
        chatList = profile.chatList || {};

        // Delete profile photo from storage if it's not a default/external URL
        if (profile.profilePhoto && profile.profilePhoto.startsWith('http') && !profile.profilePhoto.includes('googleusercontent.com')) {
            await deleteFile(profile.profilePhoto);
        }
    }

    // 1. Notify all contacts in the chat list that the user has left.
    // We do this before setting the tombstone so we have access to the contact list.
    const notifyPromises = Object.keys(chatList).map(async (otherUid) => {
        const chatId = [userId, otherUid].sort().join('_');
        return saveMessage(chatId, {
            senderId: 'system',
            type: 'system',
            text: `Account Deleted: This user has closed their Hotmapp account. Your chat history with them will be automatically cleared in 30 days for privacy.`
        });
    });

    if (notifyPromises.length > 0) await Promise.all(notifyPromises);

    // Instead of wiping the node, we leave a tombstone for contacts to see "Deleted User"
    await set(userRef, {
        fullname: "Deleted User",
        profilePhoto: `https://ui-avatars.com/api/?name=Deleted+User&background=667781&color=fff`,
        isDeleted: true,
        updatedAt: new Date().toISOString()
    });
    // Delete call logs
    await set(ref(db, `callLogs/${userId}`), null);
    // Clear signaling node
    await set(ref(db, `calls/${userId}`), null);
};

/**
 * Saves a review for a product in the database, and recalculates/updates
 * the product's average rating and review count.
 * @param {string} productId - The ID of the product.
 * @param {object} reviewData - The review details.
 */
export const saveReview = async (productId, reviewData) => {
    // 1. Save the new review
    const reviewId = push(ref(db, `reviews/${productId}`)).key;
    const reviewRef = ref(db, `reviews/${productId}/${reviewId}`);
    await set(reviewRef, {
        ...reviewData,
        id: reviewId
    });

    // 2. Fetch all reviews for this product to recalculate stats
    const reviewsRef = ref(db, `reviews/${productId}`);
    const snapshot = await get(reviewsRef);
    if (snapshot.exists()) {
        const reviews = Object.values(snapshot.val());
        const count = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        const avg = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

        // 3. Update the product's avgRating and reviewCount in the database
        const productRef = ref(db, `products/${productId}`);
        await update(productRef, {
            avgRating: avg,
            reviewCount: count
        });
    }
    return reviewId;
};

/**
 * Listens for real-time changes to a product's reviews.
 * @param {string} productId - The ID of the product.
 * @param {function} callback - The callback function to invoke with reviews array.
 * @returns {function} The unsubscribe function.
 */
export const subscribeToReviews = (productId, callback) => {
    const reviewsRef = ref(db, `reviews/${productId}`);
    return onValue(reviewsRef, (snapshot) => {
        const val = snapshot.val() || {};
        const reviewsArray = Object.entries(val).map(([id, data]) => ({
            id,
            ...data
        }));
        callback(reviewsArray);
    });
};

/**
 * Saves saved items list to user's profile in Firebase Realtime Database
 */
export const saveSavedItems = async (userId, sellerId, items) => {
    if (!userId || !sellerId) return;
    try {
        await set(ref(db, `users/${userId}/savedItems/${sellerId}`), items);
    } catch (error) {
        console.error("Error saving saved items:", error);
    }
};

/**
 * Retrieves saved items list from user's profile in Firebase Realtime Database
 */
export const getSavedItems = async (userId, sellerId) => {
    if (!userId || !sellerId) return [];
    try {
        const snap = await get(ref(db, `users/${userId}/savedItems/${sellerId}`));
        return snap.exists() ? snap.val() : [];
    } catch (error) {
        console.error("Error loading saved items:", error);
        return [];
    }
};

/**
 * Generates a unique key for a new order client-side
 */
export const generateOrderId = () => {
    return push(ref(db, 'orders')).key;
};

/**
 * Saves a new order (invoice) to the database and IndexedDB cache
 */
export const saveOrder = async (orderId, orderData) => {
    const id = orderId || push(ref(db, 'orders')).key;
    const orderRef = ref(db, `orders/${id}`);
    const data = {
        ...orderData,
        id: id,
        timestamp: orderData.timestamp || Date.now()
    };
    await set(orderRef, data);
    await cacheItem('orders', data);
    return id;
};

/**
 * Updates specific fields on an order
 */
export const updateOrder = async (orderId, updates) => {
    const orderRef = ref(db, `orders/${orderId}`);
    await update(orderRef, updates);
    const cached = await getCachedItem('orders', orderId) || {};
    await cacheItem('orders', { ...cached, ...updates });
};

/**
 * Fetches an order's details from cache or Realtime Database
 */
export const getOrder = async (orderId) => {
    let cached = await getCachedItem('orders', orderId);

    // Start background revalidation to ensure the order details cache doesn't stay stale forever
    const revalidatePromise = (async () => {
        try {
            const orderRef = ref(db, `orders/${orderId}`);
            const snapshot = await get(orderRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                await cacheItem('orders', data);

                const isDifferent = !cached || JSON.stringify(cached) !== JSON.stringify(data);
                if (isDifferent) {
                    window.dispatchEvent(new CustomEvent('order-updated', { detail: data }));
                }
                return data;
            }
        } catch (err) {
            console.error("Error revalidating order:", orderId, err);
        }
        return null;
    })();

    if (cached) return cached;

    return await revalidatePromise;
};

/**
 * Subscribes ONLY to new messages sent after a certain last key (minimizes RTDB reads)
 */
export const subscribeToNewMessages = (chatId, lastKey, callback) => {
    const messagesRef = ref(db, `messages/${chatId}`);
    let q;
    if (lastKey) {
        q = query(
            messagesRef,
            orderByKey(),
            startAfter(lastKey)
        );
    } else {
        q = query(
            messagesRef,
            orderByKey()
        );
    }
    return onChildAdded(q, (snapshot) => {
        callback({ id: snapshot.key, ...snapshot.val(), chatId: chatId });
    });
};

/**
 * Submits a new support ticket to Firebase Realtime Database
 */
export const submitSupportTicket = async (userId, ticketData) => {
    const ticketsRef = ref(db, `supportTickets/${userId}`);
    const newTicketRef = push(ticketsRef);
    const ticketId = newTicketRef.key;
    const data = {
        id: ticketId,
        ...ticketData,
        createdAt: serverTimestamp()
    };
    await set(newTicketRef, data);
    return data;
};

/**
 * Fetches a page of support tickets for a user
 */
export const getSupportTicketsPage = async (userId, pageSize, startAtKey = null) => {
    const ticketsRef = ref(db, `supportTickets/${userId}`);
    let q;
    if (startAtKey) {
        q = query(
            ticketsRef,
            orderByKey(),
            startAt(startAtKey),
            limitToFirst(pageSize + 1)
        );
    } else {
        q = query(
            ticketsRef,
            orderByKey(),
            limitToFirst(pageSize + 1)
        );
    }
    const snapshot = await get(q);
    if (!snapshot.exists()) return { tickets: [], nextKey: null };

    const raw = snapshot.val();
    const list = Object.keys(raw).map(key => ({
        id: key,
        ...raw[key]
    })).sort((a, b) => b.id.localeCompare(a.id)); // Newest first

    let nextKey = null;
    if (list.length > pageSize) {
        const nextItem = list.pop(); // Remove the extra item
        nextKey = nextItem.id;
    }

    return { tickets: list, nextKey };
};

/**
 * Submits a problem report
 */
export const submitProblemReport = async (userId, reportData) => {
    const reportsRef = ref(db, `problemReports/${userId}`);
    const newReportRef = push(reportsRef);
    await set(newReportRef, {
        id: newReportRef.key,
        ...reportData,
        createdAt: serverTimestamp()
    });
    return newReportRef.key;
};

/**
 * Submits feedback
 */
export const submitFeedback = async (userId, feedbackData) => {
    const feedbackRef = ref(db, `feedback/${userId}`);
    const newFeedbackRef = push(feedbackRef);
    await set(newFeedbackRef, {
        id: newFeedbackRef.key,
        ...feedbackData,
        createdAt: serverTimestamp()
    });
    return newFeedbackRef.key;
};

/**
 * Submits a feature request
 */
export const submitFeatureRequest = async (userId, requestData) => {
    const requestsRef = ref(db, `featureRequests/${userId}`);
    const newRequestRef = push(requestsRef);
    await set(newRequestRef, {
        id: newRequestRef.key,
        ...requestData,
        createdAt: serverTimestamp()
    });
    return newRequestRef.key;
};

/**
 * Submits a bug report
 */
export const submitBugReport = async (userId, bugData) => {
    const bugsRef = ref(db, `bugReports/${userId}`);
    const newBugRef = push(bugsRef);
    await set(newBugRef, {
        id: newBugRef.key,
        ...bugData,
        createdAt: serverTimestamp()
    });
    return newBugRef.key;
};

/**
 * Fetches the help sync metadata version
 */
export const getHelpSyncMetadata = async () => {
    const syncRef = ref(db, 'helpSync');
    const snapshot = await get(syncRef);
    return snapshot.exists() ? snapshot.val() : null;
};

/**
 * Fetches help articles from the database
 */
export const getHelpArticlesFromDb = async () => {
    const articlesRef = ref(db, 'helpArticles');
    const snapshot = await get(articlesRef);
    return snapshot.exists() ? snapshot.val() : null;
};

/**
 * Fetches FAQs from the database
 */
export const getFaqsFromDb = async () => {
    const faqsRef = ref(db, 'faqs');
    const snapshot = await get(faqsRef);
    return snapshot.exists() ? snapshot.val() : null;
};

/**
 * Allows a user to join a group using its ID
 */
export const joinGroup = async (groupId, userId) => {
    const groupSnapshot = await get(ref(db, `groups/${groupId}`));
    if (!groupSnapshot.exists()) throw new Error("Group does not exist.");
    const groupData = groupSnapshot.val();

    // Check if already a member
    if (groupData.members && groupData.members[userId]) {
        return; // Already in the group
    }

    const updates = {};
    const timestamp = serverTimestamp();

    // Add member to group
    updates[`groups/${groupId}/members/${userId}`] = true;
    
    // Add group to user's chat list
    updates[`users/${userId}/chatList/${groupId}`] = {
        lastInteraction: timestamp,
        lastMessage: "Joined via link",
        lastSenderId: userId,
        lastMessageType: 'system',
        isGroup: true,
        groupName: groupData.name || "Group Chat",
        messageCount: 0
    };

    await update(ref(db), updates);

    // Save system message
    await saveMessage(groupId, {
        senderId: userId,
        text: `joined via invite link`,
        type: 'system'
    });
};

/**
 * Generates a secure, unique cryptographically random token for invitation links.
 */
const generateInviteToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
        token += chars[bytes[i] % chars.length];
    }
    return token;
};

/**
 * Retrieves the user's active invitation token. Generates one if it doesn't exist.
 */
export const getOrCreateInvitation = async (userId) => {
    if (!userId) return null;
    const userInviteRef = ref(db, `users/${userId}/invitation`);
    const userInviteSnap = await get(userInviteRef);
    if (userInviteSnap.exists()) {
        return userInviteSnap.val();
    }
    
    // Generate new token
    const token = generateInviteToken();
    const now = Date.now();
    const inviteData = {
        token,
        createdAt: now,
        clicks: 0,
        successFriendships: 0,
        successRegistrations: 0
    };
    
    const updates = {};
    updates[`users/${userId}/invitation`] = inviteData;
    updates[`invitationTokens/${token}`] = userId;
    updates[`invitations/${token}`] = {
        ownerId: userId,
        createdAt: now,
        clicks: 0,
        successFriendships: 0,
        successRegistrations: 0
    };
    updates[`analytics/totalLinksGenerated`] = increment(1);

    await update(ref(db), updates);
    return inviteData;
};

/**
 * Revokes an existing invitation token and generates a new one.
 */
export const revokeAndGenerateInviteToken = async (userId, oldToken) => {
    if (!userId) return null;
    const token = generateInviteToken();
    const now = Date.now();
    const inviteData = {
        token,
        createdAt: now,
        clicks: 0,
        successFriendships: 0,
        successRegistrations: 0
    };
    
    const updates = {};
    updates[`users/${userId}/invitation`] = inviteData;
    updates[`invitationTokens/${token}`] = userId;
    updates[`invitations/${token}`] = {
        ownerId: userId,
        createdAt: now,
        clicks: 0,
        successFriendships: 0,
        successRegistrations: 0
    };
    if (oldToken) {
        updates[`invitationTokens/${oldToken}`] = null;
        updates[`invitations/${oldToken}`] = null;
    }
    updates[`analytics/totalLinksGenerated`] = increment(1);

    await update(ref(db), updates);
    return inviteData;
};

/**
 * Validates, processes, and records a successful invitation friendship connection.
 */
export const processInvitation = async (token, currentUid, isNewRegistration = false) => {
    if (!token || !currentUid) return { success: false, reason: "Invalid arguments" };

    try {
        // 1. Get the owner of the invitation token
        const tokenRef = ref(db, `invitationTokens/${token}`);
        const tokenSnap = await get(tokenRef);
        if (!tokenSnap.exists()) {
            return { success: false, reason: "Invalid or non-existent invitation token" };
        }
        const ownerId = tokenSnap.val();

        // 2. Self-invitation check
        if (ownerId === currentUid) {
            return { success: false, reason: "You cannot accept your own invitation" };
        }

        // 3. Check if invitation owner exists
        const ownerProfileSnap = await get(ref(db, `publicProfiles/${ownerId}`));
        if (!ownerProfileSnap.exists()) {
            return { success: false, reason: "Invitation creator profile no longer exists" };
        }
        const ownerName = ownerProfileSnap.val().fullname || "User";

        // 4. Check if current user is active/exists
        const currentProfileSnap = await get(ref(db, `publicProfiles/${currentUid}`));
        if (!currentProfileSnap.exists()) {
            return { success: false, reason: "Your profile is not active" };
        }

        // 5. Check if friendship already exists
        const friendshipSnap = await get(ref(db, `users/${currentUid}/customerList/${ownerId}`));
        if (friendshipSnap.exists()) {
            return { success: true, alreadyFriends: true, ownerName, ownerId };
        }

        // 6. Check block settings (either user blocked the other)
        const ownerBlocksSnap = await get(ref(db, `publicProfiles/${ownerId}/blockedUsers/${currentUid}`));
        const currentBlocksSnap = await get(ref(db, `publicProfiles/${currentUid}/blockedUsers/${ownerId}`));
        if (ownerBlocksSnap.exists() || currentBlocksSnap.exists()) {
            return { success: false, reason: "Cannot establish connection due to privacy/blocking settings" };
        }

        // 7. Create friendship!
        const updates = {};
        const now = serverTimestamp();
        
        // Add each other to customer list
        updates[`users/${currentUid}/customerList/${ownerId}`] = now;
        updates[`users/${currentUid}/customerHistory/${ownerId}`] = true;
        updates[`users/${ownerId}/customerList/${currentUid}`] = now;
        updates[`users/${ownerId}/customerHistory/${currentUid}`] = true;

        // Clear any pending friend requests
        updates[`users/${currentUid}/friendRequests/${ownerId}`] = null;
        updates[`users/${ownerId}/sentRequests/${currentUid}`] = null;
        updates[`users/${ownerId}/friendRequests/${currentUid}`] = null;
        updates[`users/${currentUid}/sentRequests/${ownerId}`] = null;

        // Increment successful friendships/registrations on invitation stats
        updates[`invitations/${token}/successFriendships`] = increment(1);
        updates[`users/${ownerId}/invitation/successFriendships`] = increment(1);
        
        if (isNewRegistration) {
            updates[`invitations/${token}/successRegistrations`] = increment(1);
            updates[`users/${ownerId}/invitation/successRegistrations`] = increment(1);
            updates[`analytics/totalRegistrations`] = increment(1);
        }
        
        updates[`analytics/totalFriendships`] = increment(1);

        await update(ref(db), updates);

        // Start a chat with a system message
        const chatId = [currentUid, ownerId].sort().join('_');
        await saveMessage(chatId, {
            senderId: currentUid,
            text: "I've joined HOTMAPP using your invite link. Let's chat!",
            type: 'system'
        });

        return { success: true, ownerName, ownerId };
    } catch (error) {
        console.error("Error processing invitation:", error);
        return { success: false, reason: "Server database update error" };
    }
};

/**
 * Fetches global platform analytics for the admin dashboard.
 */
export const getPlatformAnalytics = async () => {
    const analyticsRef = ref(db, 'analytics');
    const snapshot = await get(analyticsRef);
    return snapshot.val() || {};
};

/**
 * Marks specific message IDs as read in a chat (batched update).
 */
export const markMessagesAsReadIds = async (chatId, ids = []) => {
    if (!ids || ids.length === 0) return;
    const messagesRef = ref(db, `messages/${chatId}`);
    const updates = {};
    ids.forEach(id => {
        if (id === 'pinnedMessage') return;
        updates[`${id}/status`] = 'read';
    });
    if (Object.keys(updates).length === 0) return;
    await update(messagesRef, updates);
};