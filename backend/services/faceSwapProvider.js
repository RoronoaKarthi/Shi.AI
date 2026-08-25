// services/faceSwapProvider.js
//
// Pluggable face-swap provider layer.
//
// In this custom provider, we connect to public, free Hugging Face Spaces:
//   - "tonyassi/face-swap" for images and animated GIFs (frame-by-frame)
//   - "tonyassi/video-face-swap" for videos
//
// No API key is required.

import fs from "fs/promises";
import path from "path";
import { Client } from "@gradio/client";
import { GifUtil, GifFrame } from "gifwrap";
import { PNG } from "pngjs";
import { Blob } from "buffer";

const PROVIDER = process.env.FACE_SWAP_PROVIDER || "mock";

// ---------------------------------------------------------------------------
// Mock provider — safe default, no external calls, no API key required.
// ---------------------------------------------------------------------------
const mockProvider = {
  async swapImage({ targetImagePath }) {
    await delay(800);
    return fs.readFile(targetImagePath);
  },
  async swapGif({ targetGifPath }) {
    await delay(1200);
    return fs.readFile(targetGifPath);
  },
  async swapVideo({ targetVideoPath }, onProgress) {
    for (const pct of [10, 35, 60, 85, 100]) {
      await delay(500);
      onProgress?.(pct);
    }
    return fs.readFile(targetVideoPath);
  },
};

// ---------------------------------------------------------------------------
// Custom provider — connects to free Hugging Face Spaces via Gradio API.
// ---------------------------------------------------------------------------
const customProvider = {
  async swapImage({ sourceFacePath, targetImagePath }) {
    try {
      console.log(`[Shu AI] Swapping image: source=${sourceFacePath}, target=${targetImagePath}`);
      const app = await Client.connect("tonyassi/face-swap");
      
      const srcBuffer = await fs.readFile(sourceFacePath);
      const destBuffer = await fs.readFile(targetImagePath);

      const srcBlob = new Blob([srcBuffer], { type: "image/png" });
      const destBlob = new Blob([destBuffer], { type: "image/png" });

      const result = await app.predict("/swap_faces", {
        src_img: srcBlob,
        dest_img: destBlob,
      });

      if (result && result.data && result.data[0] && result.data[0].url) {
        const imgRes = await fetch(result.data[0].url);
        return Buffer.from(await imgRes.arrayBuffer());
      } else {
        throw new Error("No face detected or face swap space returned empty response.");
      }
    } catch (err) {
      console.error("[Shu AI] swapImage error:", err);
      throw new Error(`Face swap failed: ${err.message}`);
    }
  },

  async swapGif({ sourceFacePath, targetGifPath }) {
    try {
      console.log(`[Shu AI] Swapping GIF: source=${sourceFacePath}, target=${targetGifPath}`);
      const app = await Client.connect("tonyassi/face-swap");
      
      const srcBuffer = await fs.readFile(sourceFacePath);
      const srcBlob = new Blob([srcBuffer], { type: "image/png" });

      const gifBuffer = await fs.readFile(targetGifPath);
      const gif = await GifUtil.read(gifBuffer);
      console.log(`[Shu AI] GIF frames count: ${gif.frames.length}`);

      // Process up to 15 frames to prevent timeouts/rate limits
      const maxFrames = Math.min(gif.frames.length, 15);
      const framesToProcess = gif.frames.slice(0, maxFrames);
      const swappedFrames = [];

      for (let i = 0; i < framesToProcess.length; i++) {
        console.log(`[Shu AI] Processing frame ${i + 1}/${framesToProcess.length}...`);
        const frame = framesToProcess[i];

        // Convert raw RGBA frame to PNG Buffer
        const png = new PNG({ width: frame.bitmap.width, height: frame.bitmap.height });
        png.data = frame.bitmap.data;
        const pngBuffer = PNG.sync.write(png);
        const pngBlob = new Blob([pngBuffer], { type: "image/png" });

        // Call the face swap space
        const result = await app.predict("/swap_faces", {
          src_img: srcBlob,
          dest_img: pngBlob,
        });

        if (result && result.data && result.data[0] && result.data[0].url) {
          const swappedImgRes = await fetch(result.data[0].url);
          const swappedImgBuffer = Buffer.from(await swappedImgRes.arrayBuffer());

          const swappedPng = PNG.sync.read(swappedImgBuffer);

          const swappedFrame = new GifFrame(swappedPng.width, swappedPng.height, swappedPng.data, {
            delayCentiseconds: frame.delayCentiseconds,
            disposalMethod: frame.disposalMethod,
          });
          swappedFrames.push(swappedFrame);
        } else {
          console.warn(`[Shu AI] Swapping failed for frame ${i + 1}, using original frame as fallback.`);
          swappedFrames.push(frame);
        }
      }

      // Write to temp file and read back to buffer
      const tempPath = path.join(process.cwd(), "uploads", `temp-${Date.now()}.gif`);
      await GifUtil.write(tempPath, swappedFrames);
      const outputBuffer = await fs.readFile(tempPath);
      await fs.unlink(tempPath).catch(() => {});

      return outputBuffer;
    } catch (err) {
      console.error("[Shu AI] swapGif error:", err);
      throw new Error(`GIF face swap failed: ${err.message}`);
    }
  },

  async swapVideo({ sourceFacePath, targetVideoPath }, onProgress) {
    try {
      console.log(`[Shu AI] Swapping video: source=${sourceFacePath}, target=${targetVideoPath}`);
      const app = await Client.connect("tonyassi/video-face-swap");
      
      const srcBuffer = await fs.readFile(sourceFacePath);
      const srcBlob = new Blob([srcBuffer], { type: "image/png" });

      const videoBuffer = await fs.readFile(targetVideoPath);
      const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

      // Start a simulated progress reporter
      let progress = 10;
      onProgress?.(progress);
      const interval = setInterval(() => {
        if (progress < 90) {
          progress += Math.floor(Math.random() * 5) + 2;
          if (progress > 90) progress = 90;
          onProgress?.(progress);
        }
      }, 3000);

      const result = await app.predict("/generate", {
        input_image: srcBlob,
        input_video: videoBlob,
        gender: "all",
      });

      clearInterval(interval);
      onProgress?.(100);

      if (result && result.data && result.data[0] && result.data[0].url) {
        const videoRes = await fetch(result.data[0].url);
        return Buffer.from(await videoRes.arrayBuffer());
      } else {
        throw new Error("No video output url returned from face swap video space.");
      }
    } catch (err) {
      console.error("[Shu AI] swapVideo error:", err);
      throw new Error(`Video face swap failed: ${err.message}`);
    }
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const providers = { mock: mockProvider, custom: customProvider };

export default providers[PROVIDER] || mockProvider;
export { PROVIDER };
