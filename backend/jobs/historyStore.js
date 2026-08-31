// jobs/historyStore.js
//
// Manages history of face-swapped images, GIFs, and videos.
// Saves data in backend/uploads/history.json for persistence.
// Auto-deletes history items older than 24 hours.

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

const UPLOADS_DIR = process.env.VERCEL
  ? os.tmpdir()
  : path.join(process.cwd(), "uploads");
const HISTORY_DIR = path.join(UPLOADS_DIR, "history");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

// Ensure directories exist
async function ensureInit() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    if (!existsSync(HISTORY_FILE)) {
      await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2));
    }
  } catch (err) {
    console.error("historyStore init error:", err);
  }
}

export async function getHistoryItems() {
  await ensureInit();
  try {
    const data = await fs.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveHistoryItems(items) {
  await ensureInit();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2));
}

export async function addHistoryItem({ id, type, fileBuffer, ext }) {
  await ensureInit();
  const filename = `${id}.${ext}`;
  const filePath = path.join(HISTORY_DIR, filename);

  // Write file to history uploads
  await fs.writeFile(filePath, fileBuffer);

  // Save meta record
  const items = await getHistoryItems();
  const newItem = {
    id,
    type,
    url: `/uploads/history/${filename}`,
    timestamp: Date.now(),
  };

  items.unshift(newItem); // newest first
  await saveHistoryItems(items);
  console.log(`[Shu AI] Added history item: ${id} (${type})`);
  return newItem;
}

export async function deleteHistoryItem(id) {
  await ensureInit();
  const items = await getHistoryItems();
  const index = items.findIndex((item) => item.id === id);

  if (index !== -1) {
    const item = items[index];
    const filename = path.basename(item.url);
    const filePath = path.join(HISTORY_DIR, filename);

    // Delete file
    await fs.unlink(filePath).catch(() => {});

    // Remove from array
    items.splice(index, 1);
    await saveHistoryItems(items);
    console.log(`[Shu AI] Deleted history item: ${id}`);
    return true;
  }
  return false;
}

export async function cleanupExpiredHistory() {
  await ensureInit();
  console.log("[Shu AI] Running hourly history cleanup...");
  const items = await getHistoryItems();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours in ms

  const activeItems = [];
  let deletedCount = 0;

  for (const item of items) {
    if (item.timestamp < oneDayAgo) {
      const filename = path.basename(item.url);
      const filePath = path.join(HISTORY_DIR, filename);
      await fs.unlink(filePath).catch(() => {});
      deletedCount++;
    } else {
      activeItems.push(item);
    }
  }

  if (deletedCount > 0) {
    await saveHistoryItems(activeItems);
    console.log(`[Shu AI] Cleared ${deletedCount} expired history items.`);
  } else {
    console.log("[Shu AI] No expired history items found.");
  }
}
