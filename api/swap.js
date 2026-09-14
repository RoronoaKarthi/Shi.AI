import net from "node:net";
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

import multer from "multer";
import path from "path";
import fs from "fs/promises";
import os from "os";
import provider from "../backend/services/faceSwapProvider.js";
import { addSwapRecord } from "../backend/services/historyService.js";

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
};

const UPLOADS_DIR = process.env.VERCEL
  ? os.tmpdir()
  : path.join(process.cwd(), "uploads");

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: "sourceFace", maxCount: 1 },
  { name: "target", maxCount: 1 },
  { name: "sourceFace1", maxCount: 1 },
  { name: "sourceFace2", maxCount: 1 },
  { name: "sourceFace3", maxCount: 1 },
  { name: "sourceFace4", maxCount: 1 },
]);

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    await runMiddleware(req, res, uploadFields);
  } catch (err) {
    return res.status(400).json({ error: "upload_error", message: err.message });
  }

  const target = req.files?.target?.[0];
  if (!target) {
    return res.status(400).json({
      error: "missing_files",
      message: "Target image is required.",
    });
  }

  // Collect all provided source face files
  const rawSources = [];
  if (req.files?.sourceFace?.[0]) rawSources.push(req.files.sourceFace[0]);
  if (req.files?.sourceFace1?.[0]) rawSources.push(req.files.sourceFace1[0]);
  if (req.files?.sourceFace2?.[0]) rawSources.push(req.files.sourceFace2[0]);
  if (req.files?.sourceFace3?.[0]) rawSources.push(req.files.sourceFace3[0]);
  if (req.files?.sourceFace4?.[0]) rawSources.push(req.files.sourceFace4[0]);

  // Deduplicate by internal uploaded path
  const uniqueSources = [];
  const seen = new Set();
  for (const s of rawSources) {
    if (!seen.has(s.path)) {
      seen.add(s.path);
      uniqueSources.push(s);
    }
  }

  if (uniqueSources.length === 0) {
    return res.status(400).json({
      error: "missing_files",
      message: "At least one replacement face photo is required.",
    });
  }

  const targetExt = path.extname(target.originalname) || ".png";
  const targetPath = `${target.path}${targetExt}`;

  const sourcePaths = [];
  const toClean = [targetPath, target.path];

  try {
    await fs.rename(target.path, targetPath);

    for (const sf of uniqueSources) {
      const ext = path.extname(sf.originalname) || ".png";
      const sfPath = `${sf.path}${ext}`;
      await fs.rename(sf.path, sfPath);
      sourcePaths.push(sfPath);
      toClean.push(sfPath, sf.path);
    }

    const isMulti = req.body?.mode === "multi" || sourcePaths.length > 1;
    let resultBuffer;

    if (isMulti && sourcePaths.length > 1) {
      resultBuffer = await provider.swapMultipleFaces({
        targetImagePath: targetPath,
        sourceFacePaths: sourcePaths,
      });
    } else {
      resultBuffer = await provider.swapImage({
        sourceFacePath: sourcePaths[0],
        targetImagePath: targetPath,
      });
    }

    let historyRecord = null;
    try {
      historyRecord = await addSwapRecord(resultBuffer, {
        resolution: isMulti ? "4K UHD Multi-Person" : "4K UHD (3840px)",
      });
    } catch (histErr) {
      console.warn("[History Service] Could not save:", histErr.message);
    }

    const isPng = resultBuffer[0] === 0x89 && resultBuffer[1] === 0x50;
    const isJpeg = resultBuffer[0] === 0xff && resultBuffer[1] === 0xd8;
    const contentType = isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp";

    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Resolution", "4K-UHD-3840px");
    if (historyRecord) {
      res.setHeader("X-History-Id", historyRecord.id);
      res.setHeader("X-History-Url", historyRecord.url);
    }
    return res.status(200).send(resultBuffer);
  } catch (err) {
    console.error("[api/swap serverless error]:", err);
    return res.status(502).json({ error: "provider_error", message: err.message });
  } finally {
    await Promise.all(toClean.map((p) => fs.unlink(p).catch(() => {})));
  }
}
