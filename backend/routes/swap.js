import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import provider from "../services/faceSwapProvider.js";
import { createJob, updateJob, getJob } from "../jobs/jobStore.js";
import { getHistoryItems, addHistoryItem, deleteHistoryItem } from "../jobs/historyStore.js";

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: "sourceFace", maxCount: 1 },
  { name: "target", maxCount: 1 },
]);

async function cleanup(files) {
  await Promise.all(
    files.map((f) => fs.unlink(f).catch(() => {}))
  );
}

// POST /api/swap/image
router.post("/image", uploadFields, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }

  const sourceExt = path.extname(sourceFace.originalname) || ".png";
  const targetExt = path.extname(target.originalname) || ".png";
  const sourcePath = `${sourceFace.path}${sourceExt}`;
  const targetPath = `${target.path}${targetExt}`;

  try {
    // Rename files to preserve original extensions
    await fs.rename(sourceFace.path, sourcePath);
    await fs.rename(target.path, targetPath);

    const resultBuffer = await provider.swapImage({
      sourceFacePath: sourcePath,
      targetImagePath: targetPath,
    });
    
    // Save to history
    const id = nanoid(10);
    const ext = targetExt.substring(1) || "png";
    await addHistoryItem({ id, type: "image", fileBuffer: resultBuffer, ext });

    res.set("Content-Type", target.mimetype || "image/png");
    res.send(resultBuffer);
  } catch (err) {
    res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    cleanup([sourcePath, targetPath, sourceFace.path, target.path]);
  }
});

// POST /api/swap/gif
router.post("/gif", uploadFields, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }

  const sourceExt = path.extname(sourceFace.originalname) || ".png";
  const targetExt = path.extname(target.originalname) || ".gif";
  const sourcePath = `${sourceFace.path}${sourceExt}`;
  const targetPath = `${target.path}${targetExt}`;

  try {
    // Rename files to preserve original extensions
    await fs.rename(sourceFace.path, sourcePath);
    await fs.rename(target.path, targetPath);

    const resultBuffer = await provider.swapGif({
      sourceFacePath: sourcePath,
      targetGifPath: targetPath,
    });

    // Save to history
    const id = nanoid(10);
    await addHistoryItem({ id, type: "gif", fileBuffer: resultBuffer, ext: "gif" });

    res.set("Content-Type", "image/gif");
    res.send(resultBuffer);
  } catch (err) {
    res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    cleanup([sourcePath, targetPath, sourceFace.path, target.path]);
  }
});

// POST /api/swap/video
router.post("/video", uploadFields, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }

  const sourceExt = path.extname(sourceFace.originalname) || ".png";
  const targetExt = path.extname(target.originalname) || ".mp4";
  const sourcePath = `${sourceFace.path}${sourceExt}`;
  const targetPath = `${target.path}${targetExt}`;

  const jobId = nanoid(10);
  createJob(jobId);
  res.status(202).json({ jobId, status: "queued" });

  // Fire and forget
  (async () => {
    try {
      // Rename files to preserve original extensions
      await fs.rename(sourceFace.path, sourcePath);
      await fs.rename(target.path, targetPath);

      updateJob(jobId, { status: "processing" });
      const resultBuffer = await provider.swapVideo(
        { sourceFacePath: sourcePath, targetVideoPath: targetPath },
        (pct) => updateJob(jobId, { progress: pct })
      );
      const outPath = path.join(process.cwd(), "uploads", `${jobId}-result.mp4`);
      await fs.writeFile(outPath, resultBuffer);

      // Save to history
      await addHistoryItem({ id: jobId, type: "video", fileBuffer: resultBuffer, ext: "mp4" });

      updateJob(jobId, { status: "done", progress: 100, resultPath: outPath });
    } catch (err) {
      updateJob(jobId, { status: "error", error: err.message });
    } finally {
      cleanup([sourcePath, targetPath, sourceFace.path, target.path]);
    }
  })();
});

// GET /api/jobs/:id
router.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not_found" });
  const { id, status, progress, error } = job;
  res.json({
    id,
    status,
    progress,
    error,
    downloadUrl: status === "done" ? `/api/jobs/${id}/download` : null,
  });
});

// GET /api/jobs/:id/download
router.get("/jobs/:id/download", async (req, res) => {
  const job = getJob(req.params.id);
  if (!job || job.status !== "done" || !job.resultPath) {
    return res.status(404).json({ error: "not_ready" });
  }
  res.download(job.resultPath, "faceswap-result.mp4");
});

// GET /api/history
router.get("/history", async (req, res) => {
  try {
    const items = await getHistoryItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// DELETE /api/history/:id
router.delete("/history/:id", async (req, res) => {
  try {
    const success = await deleteHistoryItem(req.params.id);
    if (success) {
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "not_found" });
    }
  } catch (err) {
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

export default router;
