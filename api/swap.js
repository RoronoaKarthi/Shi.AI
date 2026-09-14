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

  const sourceFace = req.files?.sourceFace?.[0];
  const target = req.files?.target?.[0];
  if (!sourceFace || !target) {
    return res.status(400).json({
      error: "missing_files",
      message: "Both sourceFace and target images are required.",
    });
  }

  const sourceExt = path.extname(sourceFace.originalname) || ".png";
  const targetExt = path.extname(target.originalname) || ".png";
  const sourcePath = `${sourceFace.path}${sourceExt}`;
  const targetPath = `${target.path}${targetExt}`;

  try {
    await fs.rename(sourceFace.path, sourcePath);
    await fs.rename(target.path, targetPath);

    const resultBuffer = await provider.swapImage({
      sourceFacePath: sourcePath,
      targetImagePath: targetPath,
    });

    let historyRecord = null;
    try {
      historyRecord = await addSwapRecord(resultBuffer, { resolution: "4K UHD (3840px)" });
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
    await Promise.all([
      fs.unlink(sourcePath).catch(() => {}),
      fs.unlink(targetPath).catch(() => {}),
      fs.unlink(sourceFace.path).catch(() => {}),
      fs.unlink(target.path).catch(() => {}),
    ]);
  }
}
