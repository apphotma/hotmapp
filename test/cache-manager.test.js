import { getDB } from '../public/cache-manager.js';

describe('Cache‑manager IndexedDB', () => {
  test('open DB, write & read a message record', async () => {
    const db = await getDB();

    // Insert a sample message
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const testMsg = { id: 'test‑msg‑1', chatId: 'chat‑123', timestamp: Date.now(), text: 'hello' };
    store.put(testMsg);
    await tx.complete;

    // Retrieve it
    const readTx = db.transaction('messages', 'readonly');
    const readStore = readTx.objectStore('messages');
    const fetched = await new Promise((resolve, reject) => {
      const req = readStore.get('test‑msg‑1');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(fetched).toBeDefined();
    expect(fetched.text).toBe('hello');

    // Clean up
    const delTx = db.transaction('messages', 'readwrite');
    delTx.objectStore('messages').delete('test‑msg‑1');
    await delTx.complete;
    db.close();
  });
});
