import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import os from "os";
import swapRouter from "./routes/swap.js";
import historyRouter from "./routes/history.js";
import { PROVIDER } from "./services/faceSwapProvider.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure uploads dir exists
const uploadsDir = process.env.VERCEL
  ? os.tmpdir()
  : path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logger for visibility
app.use((req, res, next) => {
  console.log(`[luffy.ai] ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, provider: PROVIDER, outputResolution: "4K UHD (3840px)" });
});

app.use("/api/swap", swapRouter);
app.use("/api/history", historyRouter);
app.use("/api", swapRouter);

// Serve static frontend files in production
const frontendDistPath = fs.existsSync(path.join(process.cwd(), "frontend", "dist"))
  ? path.join(process.cwd(), "frontend", "dist")
  : path.join(process.cwd(), "..", "frontend", "dist");

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "file_too_large", message: "Upload exceeds MAX_UPLOAD_MB." });
  }
  console.error("[Shu AI Server Error]", err);
  res.status(500).json({ error: "server_error", message: "Something went wrong." });
});

export default app;

// Only listen when running locally/directly (not in Vercel serverless)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`4K Face swap backend running on http://localhost:${PORT} (provider: ${PROVIDER})`);
  });

  // Set generous 5-minute timeouts for 4K neural processing to prevent connection resets
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 305000;
}
