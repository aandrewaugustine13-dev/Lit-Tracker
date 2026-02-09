
const DB_NAME = 'ink_tracker_images';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });

    return dbPromise;
}

export async function saveImage(panelId: string, dataUrl: string): Promise<string> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
        const request = store.put({ id: panelId, data: dataUrl });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });

    return `idb://${panelId}`;
}

export async function getImage(panelId: string): Promise<string | null> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.get(panelId);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteImage(panelId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
        const request = store.delete(panelId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
