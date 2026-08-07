// Provide a global IndexedDB implementation for the tests
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
