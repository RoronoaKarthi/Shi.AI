import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import {
  getActiveHistory,
  deleteHistoryItem,
  clearAllHistory,
} from "../services/historyService.js";

const router = express.Router();
const BASE_UPLOADS = process.env.VERCEL
  ? path.join(os.tmpdir(), "luffy-uploads")
  : path.join(process.cwd(), "uploads");
const HISTORY_DIR = path.join(BASE_UPLOADS, "history");

// GET /api/history — list active 24h history
router.get("/", async (req, res) => {
  try {
    const history = await getActiveHistory();
    res.json({ ok: true, history: history || [] });
  } catch (err) {
    console.warn("[History Route] Fallback returning empty history:", err.message);
    res.json({ ok: true, history: [] });
  }
});

// GET /api/history/image/:filename — serve saved 4K image
router.get("/image/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(HISTORY_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "not_found", message: "Image expired or not found." });
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/history/:id — remove specific item
router.delete("/:id", async (req, res) => {
  try {
    const success = await deleteHistoryItem(req.params.id);
    res.json({ ok: true, deleted: success });
  } catch (err) {
    res.status(500).json({ error: "delete_error", message: err.message });
  }
});

// DELETE /api/history — clear all
router.delete("/", async (req, res) => {
  try {
    await clearAllHistory();
    res.json({ ok: true, message: "All history cleared." });
  } catch (err) {
    res.status(500).json({ error: "clear_error", message: err.message });
  }
});

export default router;
