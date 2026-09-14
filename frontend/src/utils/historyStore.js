// utils/historyStore.js
// High-reliability 24-Hour Self-Deleting Client-Side Storage via IndexedDB
// Guarantees swapped portraits persist across page refreshes and serverless restarts.

const DB_NAME = "luffy_ai_history_db";
const STORE_NAME = "swaps_history";
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert blob to base64 string for persistent storage
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Save a completed face swap record with 24-hour expiration
export async function saveSwapToClientHistory(imageBlob, metadata = {}) {
  try {
    const db = await openDatabase();
    const id = `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const expiresAt = now + RETENTION_MS;
    const dataUrl = await blobToBase64(imageBlob);

    const record = {
      id,
      createdAt: now,
      expiresAt,
      dataUrl,
      resolution: metadata.resolution || "4K UHD (3840px)",
      size: imageBlob.size,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[History Store] IndexedDB save warning:", err);
    return null;
  }
}

// Retrieve active 24-hour history and automatically delete expired ones
export async function getClientHistory() {
  try {
    const db = await openDatabase();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
        const active = [];

        for (const item of items) {
          if (now > item.expiresAt) {
            // Auto-delete records older than 24 hours
            store.delete(item.id);
          } else {
            const remainingMs = Math.max(0, item.expiresAt - now);
            const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
            const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

            active.push({
              id: item.id,
              url: item.dataUrl,
              createdAt: item.createdAt,
              expiresAt: item.expiresAt,
              resolution: item.resolution,
              remainingTime: `${remainingHours}h ${remainingMinutes}m`,
              remainingMs,
            });
          }
        }

        // Newest first
        active.sort((a, b) => b.createdAt - a.createdAt);
        resolve(active);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[History Store] IndexedDB read warning:", err);
    return [];
  }
}

// Delete single swap from client history
export async function deleteClientHistoryItem(id) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

// Clear all client history
export async function clearAllClientHistory() {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}