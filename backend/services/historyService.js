import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const BASE_UPLOADS = process.env.VERCEL
  ? path.join(os.tmpdir(), "luffy-uploads")
  : path.join(process.cwd(), "uploads");

const HISTORY_DIR = path.join(BASE_UPLOADS, "history");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

// Safe storage initialization (works in read-only serverless filesystems)
function ensureStorage() {
  try {
    if (!fsSync.existsSync(HISTORY_DIR)) {
      fsSync.mkdirSync(HISTORY_DIR, { recursive: true });
    }
    if (!fsSync.existsSync(HISTORY_FILE)) {
      fsSync.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
    }
  } catch (err) {
    console.warn("[History Service] Storage init warning:", err.message);
  }
}

ensureStorage();

let inMemoryHistory = [];

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryHistory = parsed;
      return parsed;
    }
  } catch {}
  return inMemoryHistory;
}

async function saveHistory(items) {
  inMemoryHistory = items;
  try {
    ensureStorage();
    await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.warn("[History Service] In-memory storage fallback:", err.message);
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
  try {
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
  } catch (err) {
    console.warn("[History Service] getActiveHistory fallback:", err.message);
    return inMemoryHistory || [];
  }
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

// Run periodic cleanup every 15 minutes in persistent server environments
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  setInterval(cleanupExpired, 15 * 60 * 1000);
}
// Run initial cleanup safely
cleanupExpired().catch(() => {});
