import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import os from "os";
import provider from "../services/faceSwapProvider.js";
import { addSwapRecord } from "../services/historyService.js";

const router = express.Router();

const UPLOADS_DIR = process.env.VERCEL
  ? os.tmpdir()
  : path.join(process.cwd(), "uploads");

const upload = multer({
  dest: UPLOADS_DIR,
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

// Handler for 100% accurate 4K image face swap
async function handleImageSwap(req, res) {
  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({
      error: "missing_files",
      message: "Both sourceFace and target images are required.",
    });
  }

  // Parse accuracy & speed parameters
  const fidelity = req.body?.fidelity !== undefined ? parseFloat(req.body.fidelity) : 0.95;
  const enhance = req.body?.enhance === "false" || req.body?.enhance === false ? false : true;

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

    // Automatically save to 24-hour self-deleting history on server
    let historyRecord = null;
    try {
      historyRecord = await addSwapRecord(resultBuffer, { resolution: "4K UHD (3840px)" });
    } catch (histErr) {
      console.warn("[History Service] Could not save to history:", histErr.message);
    }

    const isPng = resultBuffer[0] === 0x89 && resultBuffer[1] === 0x50;
    const isJpeg = resultBuffer[0] === 0xff && resultBuffer[1] === 0xd8;
    const contentType = isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp";

    res.set("Content-Type", contentType);
    res.set("X-Resolution", "4K-UHD-3840px");
    if (historyRecord) {
      res.set("X-History-Id", historyRecord.id);
      res.set("X-History-Url", historyRecord.url);
    }
    res.send(resultBuffer);
  } catch (err) {
    console.error("[Shu AI] Swap route error:", err);
    res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    cleanup([sourcePath, targetPath, sourceFace.path, target.path]);
  }
}

// POST /api/swap and POST /api/swap/image
router.post("/", uploadFields, handleImageSwap);
router.post("/image", uploadFields, handleImageSwap);

export default router;
