import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";

const HISTORY_DIR = path.join(process.cwd(), "uploads", "history");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

// Ensure directory exists
if (!fsSync.existsSync(HISTORY_DIR)) {
  fsSync.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Ensure history.json exists
if (!fsSync.existsSync(HISTORY_FILE)) {
  fsSync.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveHistory(items) {
  try {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[History Service] Failed to save history.json:", err.message);
  }
}

// Delete files older than 24 hours
export async function cleanupExpired() {
  try {
    const items = await readHistory();
    const now = Date.now();
    const valid = [];

    for (const item of items) {
      if (now > item.expiresAt) {
        // Expired -> Delete file from disk
        const filePath = path.join(HISTORY_DIR, item.filename);
        await fs.unlink(filePath).catch(() => {});
        console.log(`[History Service] Auto-deleted 24h expired swap: ${item.filename}`);
      } else {
        // Ensure file still exists
        const filePath = path.join(HISTORY_DIR, item.filename);
        if (fsSync.existsSync(filePath)) {
          valid.push(item);
        }
      }
    }

    if (valid.length !== items.length) {
      await saveHistory(valid);
    }
  } catch (err) {
    console.error("[History Service] Cleanup error:", err.message);
  }
}

// Add a newly completed swap to history
export async function addSwapRecord(imageBuffer, metadata = {}) {
  await cleanupExpired();

  const id = crypto.randomUUID ? crypto.randomUUID() : `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `swap_${Date.now()}_${id.slice(0, 8)}.png`;
  const filePath = path.join(HISTORY_DIR, filename);

  await fs.writeFile(filePath, imageBuffer);

  const now = Date.now();
  const expiresAt = now + RETENTION_MS;

  const record = {
    id,
    filename,
    createdAt: now,
    expiresAt,
    size: imageBuffer.length,
    resolution: metadata.resolution || "4K UHD (3840px)",
    url: `/api/history/image/${filename}`,
  };

  const items = await readHistory();
  items.unshift(record); // Newest first
  await saveHistory(items);

  console.log(`[History Service] Saved new 4K swap to history (auto-deletes in 24h): ${filename}`);
  return record;
}

// Retrieve active history list
export async function getActiveHistory() {
  await cleanupExpired();
  const items = await readHistory();
  const now = Date.now();

  return items.map((item) => {
    const remainingMs = Math.max(0, item.expiresAt - now);
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...item,
      remainingTime: `${remainingHours}h ${remainingMinutes}m`,
      remainingMs,
    };
  });
}

// Delete single item by ID
export async function deleteHistoryItem(id) {
  const items = await readHistory();
  const item = items.find((i) => i.id === id);
  if (item) {
    const filePath = path.join(HISTORY_DIR, item.filename);
    await fs.unlink(filePath).catch(() => {});
    const filtered = items.filter((i) => i.id !== id);
    await saveHistory(filtered);
    return true;
  }
  return false;
}

// Clear all history
export async function clearAllHistory() {
  const items = await readHistory();
  for (const item of items) {
    const filePath = path.join(HISTORY_DIR, item.filename);
    await fs.unlink(filePath).catch(() => {});
  }
  await saveHistory([]);
  return true;
}

// Run cleanup every 15 minutes
setInterval(cleanupExpired, 15 * 60 * 1000);
// Run initial cleanup
cleanupExpired();
