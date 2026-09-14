import net from "node:net";
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

import path from "path";
import fs from "fs";
import os from "os";

const BASE_UPLOADS = process.env.VERCEL
  ? path.join(os.tmpdir(), "luffy-uploads")
  : path.join(process.cwd(), "uploads");
const HISTORY_DIR = path.join(BASE_UPLOADS, "history");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle image requests: /api/history/image/:filename
  const urlParts = (req.url || "").split("?")[0].split("/");
  const imageIndex = urlParts.indexOf("image");
  if (imageIndex !== -1 && urlParts[imageIndex + 1]) {
    const filename = path.basename(urlParts[imageIndex + 1]);
    const filePath = path.join(HISTORY_DIR, filename);
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return fs.createReadStream(filePath).pipe(res);
    }
    return res.status(404).json({ error: "not_found", message: "Image expired or not found." });
  }

  try {
    const { getActiveHistory, deleteHistoryItem, clearAllHistory } = await import("../backend/services/historyService.js");

    if (req.method === "DELETE") {
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart !== "history" && lastPart !== "") {
        const deleted = await deleteHistoryItem(lastPart);
        return res.status(200).json({ ok: true, deleted });
      }
      await clearAllHistory();
      return res.status(200).json({ ok: true, message: "All history cleared." });
    }

    // Default GET
    const history = await getActiveHistory();
    return res.status(200).json({ ok: true, history: history || [] });
  } catch (err) {
    console.warn("[api/history serverless handler warning]:", err.message);
    return res.status(200).json({ ok: true, history: [] });
  }
}
