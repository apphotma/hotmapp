const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// Part 1: Secure Backend Session Creation (Paystack integration)
exports.createSubscription = onRequest(async (req, res) => {
    // Enable CORS for frontend cross-origin requests (e.g. Capacitor mobile client requests)
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.set("Access-Control-Max-Age", "3600");
        res.status(204).send("");
        return;
    }

    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    try {
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: "Missing userId" });
            return;
        }

        // Get user profile email (Paystack requires user email)
        const userSnap = await admin.database().ref(`users/${userId}`).once("value");
        if (!userSnap.exists()) {
            res.status(404).json({ error: "User profile not found" });
            return;
        }
        const user = userSnap.val();
        const email = user.email || `${userId}@hotmapp.shop`;

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_key"; // Loaded securely from runtime env
        
        // Initialize Paystack checkout session
        const response = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${paystackSecretKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                amount: 500000, // 5000 NGN/GHS (in kobo/subunits, e.g. 5000.00)
                callback_url: "https://www.hotmapp.shop",
                metadata: {
                    userId: userId
                }
            })
        });

        const data = await response.json();
        if (data.status && data.data && data.data.authorization_url) {
            res.status(200).json({ authorization_url: data.data.authorization_url });
        } else {
            res.status(500).json({ error: "Failed to initialize checkout transaction with gateway", details: data });
        }
    } catch (error) {
        console.error("Create subscription session error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Part 3: Secure Webhook Verification (HMAC validation and DB updates)
exports.paymentWebhook = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_key";
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
        res.status(400).send("Missing signature header");
        return;
    }

    try {
        // Verify signature using HMAC-SHA512
        const hash = crypto
            .createHmac("sha512", paystackSecretKey)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (hash !== signature) {
            console.error("Invalid webhook signature hash validation failed!");
            res.status(401).send("Unauthorized request signature");
            return;
        }

        const event = req.body;
        if (event.event === "charge.success" && event.data && event.data.status === "success") {
            const userId = event.data.metadata ? event.data.metadata.userId : null;
            if (!userId) {
                console.error("Webhook charge success event missing userId in metadata");
                res.status(400).send("Missing userId in metadata");
                return;
            }

            const subscriptionPeriodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 Days from now

            // Update Firebase Realtime Database
            const db = admin.database();
            await db.ref(`users/${userId}`).update({
                isSubscribed: true,
                subscriptionPeriodEnd: subscriptionPeriodEnd
            });

            console.log(`Successfully verified and renewed subscription for user: ${userId}`);
            res.status(200).send("Webhook handled successfully");
        } else {
            res.status(200).send("Event type not handled");
        }
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).send("Internal Webhook Error");
    }
});

// Part 2: Backend Automation Cron Job (deactivate unsubscribed products on the 20th of the month)
exports.deactivateUnsubscribedProducts = onSchedule("0 0 20 * *", async (event) => {
    const db = admin.database();
    const usersRef = db.ref("users");
    const productsRef = db.ref("products");

    try {
        // 1. Get all unsubscribed users
        const usersSnap = await usersRef.once("value");
        if (!usersSnap.exists()) {
            console.log("No users found.");
            return;
        }

        const unsubscribedUserIds = new Set();
        usersSnap.forEach((userChild) => {
            const userData = userChild.val();
            // User is unsubscribed if isSubscribed is explicitly false or missing
            if (userData.isSubscribed === false || userData.isSubscribed === undefined) {
                unsubscribedUserIds.add(userChild.key);
            }
        });

        if (unsubscribedUserIds.size === 0) {
            console.log("No unsubscribed users found.");
            return;
        }

        // 2. Get all products
        const productsSnap = await productsRef.once("value");
        if (!productsSnap.exists()) {
            console.log("No products found.");
            return;
        }

        const updates = {};
        productsSnap.forEach((productChild) => {
            const product = productChild.val();
            const productId = productChild.key;
            
            if (product.ownerId && unsubscribedUserIds.has(product.ownerId)) {
                // If it belongs to an unsubscribed user and is currently active, deactivate it
                if (product.isActive !== false) {
                    updates[`/products/${productId}/isActive`] = false;
                    // Also update denormalized sellerProducts node
                    updates[`/sellerProducts/${product.ownerId}/${productId}/isActive`] = false;
                }
            }
        });

        const updateKeys = Object.keys(updates);
        if (updateKeys.length === 0) {
            console.log("No products to deactivate.");
            return;
        }

        // 3. Perform atomic update
        await db.ref().update(updates);
        console.log(`Successfully deactivated ${updateKeys.length} products belonging to unsubscribed users.`);
    } catch (error) {
        console.error("Error running deactivation script:", error);
    }
});

// Database trigger to send push notification when a new message is written
exports.sendMessageNotification = onValueCreated("/messages/{chatId}/{messageId}", async (event) => {
    const message = event.data.val();
    const chatId = event.params.chatId;
    const messageId = event.params.messageId;

    if (!message || message.senderId === "system" || message.type === "system") return;

    // Determine recipient
    let recipientId = null;
    if (!chatId.startsWith("group_")) {
        const uids = chatId.split("_");
        recipientId = uids.find(uid => uid !== message.senderId);
    }

    if (!recipientId) return;

    // Fetch recipient's FCM tokens
    const db = admin.database();
    const tokensSnap = await db.ref(`users/${recipientId}/fcmTokens`).once("value");
    if (!tokensSnap.exists()) return;

    const tokens = [];
    tokensSnap.forEach((child) => {
        const val = child.val();
        if (val && val.token) tokens.push(val.token);
    });

    if (tokens.length === 0) return;

    // Fetch sender profile to get their name and public key
    const senderSnap = await db.ref(`users/${message.senderId}`).once("value");
    const sender = senderSnap.exists() ? senderSnap.val() : null;
    const senderName = sender ? (sender.fullname || "Someone") : "Someone";
    const senderPublicKey = sender ? (sender.publicKey || null) : null;

    // Construct the payload with standard notification block and deep linking data
    const notificationBody = message.isEncrypted
        ? (message.previewText || "sent you an encrypted message")
        : (message.text || "");

    // Create a short-lived delivery token (HMAC) so the recipient's device
    // can ACK receipt while the app is backgrounded (service worker cannot
    // authenticate to RTDB). Token covers chatId|messageId|recipientId|expiry
    const deliveryExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    const deliverySecret = process.env.DELIVERY_SECRET || 'dev_delivery_secret_change_me';
    const tokenPayload = `${chatId}|${messageId}|${recipientId}|${deliveryExpiry}`;
    const deliveryToken = crypto.createHmac('sha256', deliverySecret).update(tokenPayload).digest('hex');

    // ackUrl: optional override for where the service worker should POST the ACK.
    // For v2 functions, Cloud Run URLs may not follow the old cloudfunctions.net pattern,
    // so use the hosted app API route when available.
    const projectId = process.env.GCLOUD_PROJECT || 'hotma-app';
    const hostingBase = process.env.HOSTING_BASE_URL || `https://${projectId}.web.app`;
    const functionsBase = process.env.FUNCTIONS_BASE_URL || `https://us-central1-${projectId}.cloudfunctions.net`;
    const ackUrl = process.env.FUNCTIONS_BASE_URL ? `${functionsBase}/ackDelivery` : `${hostingBase}/api/ackDelivery`;

    const payload = {
        tokens: tokens,
        data: {
            chatId: chatId,
            messageId: messageId,
            senderId: message.senderId,
            recipientId: recipientId,
            deliveryToken: deliveryToken,
            deliveryExpiry: String(deliveryExpiry),
            ackUrl: ackUrl,
            title: senderName,
            body: notificationBody
        },
        android: {
            priority: "high"
        },
        apns: {
            payload: {
                aps: {
                    sound: "default"
                }
            }
        }
    };

    // Send notifications to tokens
    const response = await admin.messaging().sendEachForMulticast(payload);

    console.log(`Successfully sent push notifications for message ${messageId} to ${response.successCount} devices of user: ${recipientId}`);

    if (response.successCount > 0) {
        // Wait for an explicit delivery/read receipt from the receiver before upgrading
        // the sender-side status beyond the initial notified state. This keeps the UI
        // honest when the recipient is offline or the app is not actively handling ACKs.
        const recipientOnlineSnap = await db.ref(`users/${recipientId}/online`).once('value');
        const recipientOnline = recipientOnlineSnap.exists() ? recipientOnlineSnap.val() : false;
        console.log(`Waiting for explicit receipt for message ${messageId}; recipientOnline=${recipientOnline}`);
    }

});

// HTTP endpoint that service workers or native clients can call to ACK delivery.
exports.ackDelivery = onRequest(async (req, res) => {
    // CORS preflight and actual response headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        console.log('ackDelivery called', {
            body: req.body,
            headers: {
                host: req.headers.host,
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'user-agent': req.headers['user-agent']
            }
        });
        const { chatId, messageId, recipientId, deliveryToken, deliveryExpiry } = req.body || {};
        if (!chatId || !messageId || !recipientId || !deliveryToken || !deliveryExpiry) {
            console.warn('ackDelivery missing parameters', { chatId, messageId, recipientId, deliveryToken, deliveryExpiry });
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        const expiryNum = Number(deliveryExpiry);
        if (Number.isNaN(expiryNum) || expiryNum < Date.now()) {
            res.status(400).json({ error: 'Token expired' });
            return;
        }

        const deliverySecretVerify = process.env.DELIVERY_SECRET || 'dev_delivery_secret_change_me';
        const expected = crypto.createHmac('sha256', deliverySecretVerify).update(`${chatId}|${messageId}|${recipientId}|${deliveryExpiry}`).digest('hex');
        const provided = String(deliveryToken);
        const expectedBuf = Buffer.from(expected, 'hex');
        const providedBuf = Buffer.from(provided, 'hex');
        if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
            console.warn('ackDelivery invalid token', { chatId, messageId, recipientId });
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        console.log('ackDelivery token validated', { chatId, messageId, recipientId });
        // Mark message as delivered if still in 'sent' state
        const msgRef = admin.database().ref(`messages/${chatId}/${messageId}`);
        const snap = await msgRef.once('value');
        if (!snap.exists()) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }

        const current = snap.val();
        // Ensure recipientId matches the intended recipient for extra safety
        if (current.recipientId && current.recipientId !== recipientId) {
            // tolerate missing recipientId in messages, but if present must match
            res.status(400).json({ error: 'Recipient mismatch' });
            return;
        }

        if (current.status === 'sent') {
            console.log(`ackDelivery: valid ACK for ${chatId}/${messageId} from ${recipientId} - marking delivered`);
            await msgRef.update({ status: 'delivered' });
        } else {
            console.log(`ackDelivery: message ${chatId}/${messageId} current status=${current.status}; no update performed`);
        }

        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('ackDelivery error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Database trigger to send push notification when a new call signal is written
exports.sendCallNotification = onValueCreated("/calls/{targetUid}/{senderUid}", async (event) => {
    const signal = event.data.val();
    const targetUid = event.params.targetUid;
    const senderUid = event.params.senderUid;

    if (!signal) return;

    // Only send notification for initial call invite status
    if (signal.status !== "calling" && signal.status !== "group-invite") return;

    const db = admin.database();
    const tokensSnap = await db.ref(`users/${targetUid}/fcmTokens`).once("value");
    if (!tokensSnap.exists()) return;

    const tokens = [];
    tokensSnap.forEach((child) => {
        const val = child.val();
        if (val && val.token) tokens.push(val.token);
    });

    if (tokens.length === 0) return;

    const senderName = signal.fromName || "Someone";
    const callType = signal.callType || "voice";

    const payload = {
        tokens: tokens,
        notification: {
            title: `Incoming ${callType.charAt(0).toUpperCase() + callType.slice(1)} Call`,
            body: `Incoming call from ${senderName}`
        },
        data: {
            type: "incoming-call",
            senderId: senderUid,
            callType: callType
        },
        android: {
            priority: "high",
            notification: {
                sound: "ringtone",
                channelId: "calls"
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: "ringtone.caf"
                }
            }
        }
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log(`Successfully sent call push notification to ${response.successCount} devices of user: ${targetUid}`);
});
