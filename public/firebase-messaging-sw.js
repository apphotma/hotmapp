importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Firebase configuration for project: HOTMA
const firebaseConfig = {
    apiKey: "AIzaSyCpCuDfScVNNRwgl9eOzzV4vL1T0iSRYTk",
    authDomain: "hotma-app.firebaseapp.com",
    databaseURL: "https://hotma-app-default-rtdb.firebaseio.com",
    projectId: "hotma-app",
    storageBucket: "hotma-app.firebasestorage.app",
    messagingSenderId: "467171609873",
    appId: "1:467171609873:web:63a6817d6ef96eb8e9d0b0"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const sendDeliveryAck = async (payloadData) => {
    if (!payloadData) return;
    const data = payloadData.data || payloadData;
    const ackUrl = data.ackUrl;
    const deliveryToken = data.deliveryToken;
    const deliveryExpiry = data.deliveryExpiry;
    const chatId = data.chatId;
    const messageId = data.messageId;
    const recipientId = data.recipientId;

    console.log('[firebase-messaging-sw.js] sendDeliveryAck called', {
        ackUrl,
        chatId,
        messageId,
        recipientId,
        deliveryExpiry
    });

    if (ackUrl && deliveryToken && deliveryExpiry && chatId && messageId && recipientId) {
        const response = await fetch(ackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageId, recipientId, deliveryToken, deliveryExpiry }),
            keepalive: true,
            mode: 'cors'
        });
        console.log('[firebase-messaging-sw.js] delivery ACK response', { status: response.status, ok: response.ok });
        return response;
    }
    console.warn('[firebase-messaging-sw.js] sendDeliveryAck skipped due to missing ack payload', { chatId, messageId, recipientId, ackUrl });
};

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message', payload);
    
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new message on Hotmapp.',
        icon: '/hotmapp-logo.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);

    sendDeliveryAck(payload).catch(err => {
        console.warn('[firebase-messaging-sw.js] Delivery ACK failed in background message:', err);
    });
});

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        console.warn('Failed to parse push event payload:', e);
        return;
    }

    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new message on Hotmapp.',
        icon: '/hotmapp-logo.png',
        data: payload.data || payload
    };

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(notificationTitle, notificationOptions),
            sendDeliveryAck(payload).catch(err => {
                console.warn('[firebase-messaging-sw.js] Delivery ACK failed from push event:', err);
            })
        ])
    );
});

self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const data = notification?.data || {};
    const chatId = data.chatId;
    const senderId = data.senderId;
    const messageId = data.messageId;

    event.notification.close();

    const targetUrl = new URL('/', self.location.origin);
    if (chatId) targetUrl.searchParams.set('chatId', chatId);
    if (senderId) targetUrl.searchParams.set('senderId', senderId);
    if (messageId) targetUrl.searchParams.set('messageId', messageId);

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList && clientList.length > 0) {
                const client = clientList[0];
                client.focus();
                client.postMessage({ type: 'notification-click', chatId, senderId, messageId });
                return;
            }
            return self.clients.openWindow(targetUrl.href);
        })
    );
});
