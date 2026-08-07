import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = 'http://localhost:3000';

const runTests = async () => {
    console.log("==================================================");
    console.log("   STARTING INTEGRATION TESTS FOR VPS BACKEND     ");
    console.log("==================================================");

    let passes = 0;
    let failures = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passes++;
        } else {
            console.error(`[FAIL] ${message}`);
            failures++;
        }
    };

    try {
        // Clean up leftover test data from prior runs
        await fetch(`${BACKEND_URL}/api/messages/test_chat_1/delete-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: ["msg_test_1"] })
        }).catch(() => {});
        await fetch(`${BACKEND_URL}/api/products/prod_test_1`, { method: 'DELETE' }).catch(() => {});
        await fetch(`${BACKEND_URL}/api/db/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'orders/order_test_1' })
        }).catch(() => {});

        // --- 1. USER PROFILE SYNC TEST ---
        const profileData = {
            fullname: "Integration Test User",
            phone_number: "+15555550101",
            profile_photo: "test_photo_url",
            publicKey: "test_key",
            encryptedKeyPair: "test_pair"
        };
        const setProfileRes = await fetch(`${BACKEND_URL}/api/users/profile/test_user_1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        const setProfileJson = await setProfileRes.json();
        assert(setProfileJson.success === true, "Set user profile endpoint returns success");

        const getProfileRes = await fetch(`${BACKEND_URL}/api/users/profile/test_user_1`);
        const getProfileJson = await getProfileRes.json();
        assert(getProfileJson !== null && getProfileJson.fullname === profileData.fullname, "Get user profile returns correct data");

        // --- 2. MESSAGE DELIVERY & CHAT TEST ---
        const messageData = {
            id: "msg_test_1",
            senderId: "test_user_1",
            text: "Hello from integration test",
            timestamp: Date.now(),
            type: "text",
            status: "sent"
        };
        const setMsgRes = await fetch(`${BACKEND_URL}/api/messages/test_chat_1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });
        const setMsgJson = await setMsgRes.json();
        if (setMsgJson.error) {
            console.error("[DEBUG] Post message error message:", setMsgJson.error);
        }
        assert(setMsgJson.success === true, "Post chat message returns success");

        const getMsgRes = await fetch(`${BACKEND_URL}/api/messages/test_chat_1`);
        const getMsgJson = await getMsgRes.json();
        assert(getMsgJson.length > 0 && getMsgJson[0].id === messageData.id, "Get room messages retrieves message successfully");

        // --- 3. VPS MEDIA FILE UPLOAD & SERVING TEST ---
        // Create a dummy text file to simulate user uploading voice message/image
        const dummyFilepath = path.join(__dirname, 'dummy_test.txt');
        fs.writeFileSync(dummyFilepath, "Hello VPS Storage World!");

        const boundary = '------MultipartBoundary' + Math.random().toString(36).substring(2);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dummy_test.txt"\r\nContent-Type: text/plain\r\n\r\n`;
        const footer = `\r\n--${boundary}--`;
        const bodyContent = Buffer.concat([
            Buffer.from(header, 'utf-8'),
            fs.readFileSync(dummyFilepath),
            Buffer.from(footer, 'utf-8')
        ]);

        const uploadRes = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: bodyContent
        });
        const uploadJson = await uploadRes.json();
        assert(uploadJson.url !== undefined && uploadJson.url.includes('/uploads/'), `Upload media file returns correct static URL: ${uploadJson.url}`);

        // Try downloading the file back to verify serving static assets
        const downloadRes = await fetch(uploadJson.url);
        const downloadText = await downloadRes.text();
        assert(downloadText === "Hello VPS Storage World!", "Uploaded file is served correctly from uploads/ folder");

        // Clean up uploaded file
        const deleteFileRes = await fetch(`${BACKEND_URL}/api/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadJson.url })
        });
        const deleteFileJson = await deleteFileRes.json();
        assert(deleteFileJson.success === true, "Delete media file returns success");
        fs.unlinkSync(dummyFilepath);

        // --- 4. MARKETPLACE PRODUCTS TEST ---
        const productData = {
            ownerId: "test_user_1",
            title: "Test Product Listing",
            description: "Product test description",
            price: 49.99,
            category: "electronics",
            images: ["img_url_1", "img_url_2"]
        };
        const setProdRes = await fetch(`${BACKEND_URL}/api/products/prod_test_1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        const setProdJson = await setProdRes.json();
        assert(setProdJson.success === true, "Save product listing returns success");

        const getProdRes = await fetch(`${BACKEND_URL}/api/products`);
        const getProdJson = await getProdRes.json();
        assert(getProdJson.length > 0 && getProdJson[0].id === 'prod_test_1', "Get products catalog returns correct listings");

        // --- 5. ORDERS / INVOICES PATH FALLBACK TEST ---
        const orderData = {
            id: "order_test_1",
            buyerId: "test_user_1",
            total: 99.99,
            status: "pending"
        };
        const setOrderRes = await fetch(`${BACKEND_URL}/api/db/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'orders/order_test_1', value: orderData })
        });
        const setOrderJson = await setOrderRes.json();
        assert(setOrderJson.success === true, "Save order using fallback path set returns success");

        const getOrderRes = await fetch(`${BACKEND_URL}/api/db/get?path=orders/order_test_1`);
        const getOrderJson = await getOrderRes.json();
        assert(getOrderJson !== null && getOrderJson.id === orderData.id, "Get order using fallback path get returns correct data");

        // --- 6. WEBSOCKET TYPING, PRESENCE & SIGNALING TEST ---
        const socketClient1 = io(BACKEND_URL);
        const socketClient2 = io(BACKEND_URL);

        await Promise.all([
            new Promise((resolve) => {
                socketClient1.on('connect', () => {
                    socketClient1.emit('register_user', 'test_user_1');
                    socketClient1.emit('join_room', 'test_chat_1');
                    resolve();
                });
            }),
            new Promise((resolve) => {
                socketClient2.on('connect', () => {
                    socketClient2.emit('register_user', 'test_user_2');
                    socketClient2.emit('join_room', 'test_chat_1');
                    resolve();
                });
            })
        ]);
        
        assert(true, "Multiple Socket.io clients successfully connected to the backend");

        // Trigger typing status and observe broadcast on socketClient2 (adding 100ms delay to prevent race condition)
        await new Promise((resolve) => {
            socketClient2.on('typing_status_changed', (data) => {
                assert(data.userId === 'test_user_1' && data.isTyping === true, "WebSocket typing status signal broadcasted successfully to other participants");
                resolve();
            });
            setTimeout(() => {
                socketClient1.emit('typing_status', { chatId: 'test_chat_1', userId: 'test_user_1', isTyping: true });
            }, 100);
        });

        socketClient1.disconnect();
        socketClient2.disconnect();

        // --- 7. CLEANUP TEST DATA ---
        await fetch(`${BACKEND_URL}/api/messages/test_chat_1/delete-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: ["msg_test_1"] })
        });
        const getMsgAfterDel = await (await fetch(`${BACKEND_URL}/api/messages/test_chat_1`)).json();
        assert(getMsgAfterDel.length === 0, "Test message cleaned up successfully");

        await fetch(`${BACKEND_URL}/api/products/prod_test_1`, { method: 'DELETE' });
        await fetch(`${BACKEND_URL}/api/db/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'orders/order_test_1' })
        });

        console.log("==================================================");
        console.log(` TESTS FINISHED. PASSES: ${passes}, FAILURES: ${failures}`);
        console.log("==================================================");

        if (failures > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (e) {
        console.error("Test execution failed with error:", e);
        process.exit(1);
    }
};

runTests();
