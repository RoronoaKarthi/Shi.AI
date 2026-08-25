import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import provider from "../services/faceSwapProvider.js";
import { createJob, updateJob, getJob } from "../jobs/jobStore.js";

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: "sourceFace", maxCount: 1 },
  { name: "target", maxCount: 1 },
]);

// A consent acknowledgement is required on every request. This is a basic
// guardrail, not a substitute for real moderation/ToS enforcement — see
// README for recommendations before going to production.
function requireConsent(req, res, next) {
  if (req.body?.consent !== "true") {
    return res.status(400).json({
      error:
        "consent_required",
      message:
        "You must confirm you have the right to use both uploaded images/media before processing.",
    });
  }
  next();
}

async function cleanup(files) {
  await Promise.all(
    files.map((f) => fs.unlink(f).catch(() => {}))
  );
}

// POST /api/swap/image
router.post("/image", uploadFields, requireConsent, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }
  try {
    const resultBuffer = await provider.swapImage({
      sourceFacePath: sourceFace.path,
      targetImagePath: target.path,
    });
    res.set("Content-Type", target.mimetype || "image/png");
    res.send(resultBuffer);
  } catch (err) {
    res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    cleanup([sourceFace.path, target.path]);
  }
});

// POST /api/swap/gif
router.post("/gif", uploadFields, requireConsent, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }
  try {
    const resultBuffer = await provider.swapGif({
      sourceFacePath: sourceFace.path,
      targetGifPath: target.path,
    });
    res.set("Content-Type", "image/gif");
    res.send(resultBuffer);
  } catch (err) {
    res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    cleanup([sourceFace.path, target.path]);
  }
});

// POST /api/swap/video  -> returns a jobId immediately (video processing is async)
router.post("/video", uploadFields, requireConsent, async (req, res) => {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({ error: "missing_files", message: "sourceFace and target are both required." });
  }

  const jobId = nanoid(10);
  createJob(jobId);
  res.status(202).json({ jobId, status: "queued" });

  // Fire and forget — progress/result is polled via /api/jobs/:id
  (async () => {
    try {
      updateJob(jobId, { status: "processing" });
      const resultBuffer = await provider.swapVideo(
        { sourceFacePath: sourceFace.path, targetVideoPath: target.path },
        (pct) => updateJob(jobId, { progress: pct })
      );
      const outPath = path.join(process.cwd(), "uploads", `${jobId}-result.mp4`);
      await fs.writeFile(outPath, resultBuffer);
      updateJob(jobId, { status: "done", progress: 100, resultPath: outPath });
    } catch (err) {
      updateJob(jobId, { status: "error", error: err.message });
    } finally {
      cleanup([sourceFace.path, target.path]);
    }
  })();
});

// GET /api/jobs/:id — poll job status; when done, includes a download URL
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

export default router;
