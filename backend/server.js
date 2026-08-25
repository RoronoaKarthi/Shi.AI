import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import swapRouter from "./routes/swap.js";
import { PROVIDER } from "./services/faceSwapProvider.js";
import { cleanupExpiredHistory } from "./jobs/historyStore.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure uploads dir exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());

// Serve uploads folder statically so history files can be loaded by frontend
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, provider: PROVIDER });
});

app.use("/api/swap", swapRouter);
app.use("/api", swapRouter);

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "file_too_large", message: "Upload exceeds MAX_UPLOAD_MB." });
  }
  console.error(err);
  res.status(500).json({ error: "server_error", message: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`Face swap backend running on http://localhost:${PORT} (provider: ${PROVIDER})`);
  
  // Run hourly cleanup for 1-day auto-expiring history items
  setInterval(cleanupExpiredHistory, 60 * 60 * 1000);
  // Run immediately on start
  cleanupExpiredHistory().catch(() => {});
});
