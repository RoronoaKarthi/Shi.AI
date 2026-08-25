// services/faceSwapProvider.js
//
// Pluggable face-swap provider layer.
//
// In this custom provider, we connect to public, free Hugging Face Spaces:
//   - "tonyassi/face-swap" for images and animated GIFs (frame-by-frame)
//   - "tonyassi/video-face-swap" for videos
//   - "sczhou/CodeFormer" for ultra high-quality face enhancement
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

// Helper for face restoration via CodeFormer
async function enhanceFace(imageBlob) {
  try {
    console.log("[Shu AI] Enhancing face using sczhou/CodeFormer...");
    const enhanceApp = await Client.connect("sczhou/CodeFormer");
    const enhanceResult = await enhanceApp.predict("/inference", {
      image: imageBlob,
      face_align: true,
      background_enhance: true,
      face_upsample: true,
      upscale: 2,
      codeformer_fidelity: 0.5,
    });
    if (enhanceResult && enhanceResult.data && enhanceResult.data[0] && enhanceResult.data[0].url) {
      console.log("[Shu AI] Face enhanced successfully!");
      const res = await fetch(enhanceResult.data[0].url);
      return Buffer.from(await res.arrayBuffer());
    }
  } catch (err) {
    console.error("[Shu AI] CodeFormer enhancement failed, using original swapped image:", err.message);
  }
  return null;
}

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
        const swappedBuffer = Buffer.from(await imgRes.arrayBuffer());
        
        // Auto enhance using CodeFormer
        const swappedBlob = new Blob([swappedBuffer], { type: "image/png" });
        const enhancedBuffer = await enhanceFace(swappedBlob);
        
        return enhancedBuffer || swappedBuffer;
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

      let gifBuffer = await fs.readFile(targetGifPath);
      
      // Clean buffer of malformed GIFs that have trailing junk bytes after trailer byte 0x3B
      if (gifBuffer[gifBuffer.length - 1] !== 0x3b) {
        const lastTrailerIndex = gifBuffer.lastIndexOf(0x3b);
        if (lastTrailerIndex !== -1) {
          console.log(`[Shu AI] Truncating trailing garbage bytes from GIF buffer. Original: ${gifBuffer.length}, Cleaned: ${lastTrailerIndex + 1}`);
          gifBuffer = gifBuffer.slice(0, lastTrailerIndex + 1);
        }
      }

      const gif = await GifUtil.read(gifBuffer);
      console.log(`[Shu AI] GIF frames count: ${gif.frames.length}`);

      // Process up to 10 frames to prevent timeouts/rate limits
      const maxFrames = Math.min(gif.frames.length, 10);
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

          // Enhance frame
          const swappedBlob = new Blob([swappedImgBuffer], { type: "image/png" });
          const enhancedBuffer = await enhanceFace(swappedBlob);
          const finalBuffer = enhancedBuffer || swappedImgBuffer;

          // Safe PNG parsing
          try {
            const swappedPng = PNG.sync.read(finalBuffer);
            const swappedFrame = new GifFrame(swappedPng.width, swappedPng.height, swappedPng.data, {
              delayCentiseconds: frame.delayCentiseconds,
              disposalMethod: frame.disposalMethod,
            });
            swappedFrames.push(swappedFrame);
          } catch (pngErr) {
            console.error(`[Shu AI] Failed to parse enhanced PNG for frame ${i + 1}:`, pngErr.message);
            if (finalBuffer !== swappedImgBuffer) {
              try {
                // Retry with unenhanced buffer
                const swappedPng = PNG.sync.read(swappedImgBuffer);
                const swappedFrame = new GifFrame(swappedPng.width, swappedPng.height, swappedPng.data, {
                  delayCentiseconds: frame.delayCentiseconds,
                  disposalMethod: frame.disposalMethod,
                });
                swappedFrames.push(swappedFrame);
                continue;
              } catch (innerPngErr) {
                console.error(`[Shu AI] Failed to parse unenhanced PNG for frame ${i + 1}:`, innerPngErr.message);
              }
            }
            // Use original frame if all parsing fails
            console.warn(`[Shu AI] Falling back to original frame ${i + 1}`);
            swappedFrames.push(frame);
          }
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
