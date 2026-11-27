const DB_NAME = 'elimupap_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';

let activeFlushPromise = null;

function openUploadsDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline database'));
  });
}

function emitUploadsUpdated(extra = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('elimupap:uploads-updated', { detail: extra }));
  }
}

export async function enqueueOfflineUpload({
  title,
  filename,
  fileType,
  mimeType,
  unitCode,
  endpoint,
  file,
  liveTranscript = '',
}) {
  const db = await openUploadsDb();
  const id = `offline_upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id,
    title: title || filename?.replace(/\.[^/.]+$/, '') || 'Offline Document',
    filename: filename || 'document',
    file_type: fileType || 'doc',
    mime_type: mimeType || file?.type || 'application/octet-stream',
    unit_code: (unitCode || 'GENERAL').trim() || 'GENERAL',
    endpoint: endpoint || '/notes/upload',
    live_transcript: liveTranscript || '',
    file,
    size: file?.size || 0,
    created_at: new Date().toISOString(),
    date: 'Pending Sync',
    isOfflinePending: true,
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to store file offline'));
  });

  emitUploadsUpdated();
  return record;
}

export async function getPendingUploads() {
  try {
    const db = await openUploadsDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch {
    return [];
  }
}

export async function getPendingUploadById(id) {
  if (!id) return null;
  try {
    const db = await openUploadsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function removePendingUpload(id) {
  try {
    const db = await openUploadsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    emitUploadsUpdated();
  } catch {
    // ignore IndexedDB errors
  }
}

export async function flushOfflineUploads(apiInstance) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('elimupap_token') : null;
  if (!token) return 0;

  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const items = await getPendingUploads();
    if (!items.length) return 0;

    let syncedCount = 0;
    for (const item of items) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      try {
        const formData = new FormData();
        formData.append('file', item.file, item.filename);
        formData.append('title', item.title);
        formData.append('unit_code', item.unit_code === 'GENERAL' ? '' : item.unit_code);
        if (item.endpoint === '/ai/transcribe-audio') {
          if (item.live_transcript) {
            formData.append('live_transcript', item.live_transcript);
          }
        } else {
          formData.append('topic', '');
        }

        await apiInstance.post(item.endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        await removePendingUpload(item.id);
        syncedCount++;
      } catch (err) {
        if (!err?.response) {
          // Still offline / network error — keep item and stop flushing
          break;
        }
        // Server rejected permanently (4xx) — drop invalid entry so queue can proceed
        if (err.response.status >= 400 && err.response.status < 500) {
          await removePendingUpload(item.id);
        }
      }
    }

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('elimupap:uploads-synced', { detail: { count: syncedCount } }));
    }
    return syncedCount;
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}
