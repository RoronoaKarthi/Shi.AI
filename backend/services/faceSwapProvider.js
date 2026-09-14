// services/faceSwapProvider.js
//
// Clean, Natural Ultra-HD 4K Image Face Swap Provider.
// - Direct InsightFace 3D facial landmark transfer
// - GFPGANv1.4 neural face restoration for razor-sharp facial clarity
// - Pure, natural skin & lighting preservation (ZERO artificial filters, sharpening, or grain)
// - Clean Lanczos3 4K UHD scaling without edge halos or stippling artifacts
//
// No external API key required.

import fs from "fs/promises";
import net from "node:net";
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

import { Client } from "@gradio/client";
import { Blob } from "buffer";

let sharp = null;
async function getSharp() {
  if (sharp !== null) return sharp;
  try {
    const mod = await import("sharp");
    sharp = mod.default || mod;
  } catch (err) {
    console.warn("[luffy.ai Engine] Sharp native library not available in serverless, using clean buffer fallback:", err.message);
    sharp = false;
  }
  return sharp;
}

const PROVIDER = process.env.FACE_SWAP_PROVIDER || "custom";

// Robust image downloader with automatic retry and redirect following
async function downloadImageResult(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`[luffy.ai Engine] Result download attempt ${attempt} warning: ${err.message}`);
      if (attempt === 3) throw err;
      await delay(800);
    }
  }
}

// Clean 4K UHD resolution scaler (pure Lanczos3 resampling, NO artificial sharpening or filters)
async function ensure4KResolution(imageBuffer) {
  try {
    const sharpInstance = await getSharp();
    if (!sharpInstance) return imageBuffer;

    const meta = await sharpInstance(imageBuffer).metadata();
    const origWidth = meta.width || 1024;
    const origHeight = meta.height || 1024;
    const maxDim = Math.max(origWidth, origHeight);

    const scale = maxDim < 3840 ? 3840 / maxDim : 1;
    const targetWidth = Math.round(origWidth * scale);
    const targetHeight = Math.round(origHeight * scale);

    let pipeline = sharpInstance(imageBuffer);

    // Clean, natural Lanczos3 upsampling without any artificial filters, noise, or halos
    if (scale > 1) {
      pipeline = pipeline.resize(targetWidth, targetHeight, {
        kernel: sharpInstance.kernel.lanczos3,
        fastShrinkOnLoad: false,
      });
    }

    // Output clean, pristine, filter-free 4K UHD Master (chroma 4:4:4 preservation, within Vercel 4.5MB limit)
    return await pipeline
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn("[luffy.ai Engine] 4K processing fallback:", err.message);
    return imageBuffer;
  }
}

// Helper for running Gradio submissions using AsyncIterators to track status and progress
async function runGradioSubmit(app, endpoint, payload, onStatus) {
  const job = app.submit(endpoint, payload);
  let lastData = null;
  for await (const msg of job) {
    if (msg.type === "status") {
      onStatus?.(msg);
    } else if (msg.type === "data") {
      lastData = msg.data;
    }
  }
  return lastData;
}

// ---------------------------------------------------------------------------
// On-Demand Gradio Client Connection Pool with Auto-Reconnect
// ---------------------------------------------------------------------------
let zerovicClient = null;
let tonyassiClient = null;

async function getZerovicClient() {
  try {
    if (!zerovicClient) {
      console.log("[luffy.ai Engine] Connecting to InsightFace + GFPGANv1.4 restoration pipeline...");
      zerovicClient = await Client.connect("zerovic/Swap-Face-Models-v1", {
        hf_token: process.env.HF_TOKEN || undefined,
      });
    }
    return zerovicClient;
  } catch (err) {
    console.warn("[luffy.ai Engine] Zerovic connect retry:", err.message);
    zerovicClient = await Client.connect("zerovic/Swap-Face-Models-v1", {
      hf_token: process.env.HF_TOKEN || undefined,
    });
    return zerovicClient;
  }
}

async function getTonyassiClient() {
  try {
    if (!tonyassiClient) {
      console.log("[luffy.ai Engine] Connecting to high-speed InsightFace swap pipeline...");
      tonyassiClient = await Client.connect("tonyassi/face-swap", {
        hf_token: process.env.HF_TOKEN || undefined,
      });
    }
    return tonyassiClient;
  } catch (err) {
    console.warn("[luffy.ai Engine] Tonyassi connect retry:", err.message);
    tonyassiClient = await Client.connect("tonyassi/face-swap", {
      hf_token: process.env.HF_TOKEN || undefined,
    });
    return tonyassiClient;
  }
}

// ---------------------------------------------------------------------------
// Mock provider — for local offline testing
// ---------------------------------------------------------------------------
const mockProvider = {
  async swapImage({ targetImagePath }) {
    await delay(300);
    const buf = await fs.readFile(targetImagePath);
    return await ensure4KResolution(buf);
  },
  async swapMultipleFaces({ targetImagePath }) {
    await delay(500);
    const buf = await fs.readFile(targetImagePath);
    return await ensure4KResolution(buf);
  },
};

// ---------------------------------------------------------------------------
// Custom provider — connects to Hugging Face Spaces via Gradio API
// Uses InsightFace 3D swap + neural face restoration for razor-sharp clarity
// ---------------------------------------------------------------------------
const customProvider = {
  async swapImage({ sourceFacePath, targetImagePath }) {
    const startTime = Date.now();
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const srcBuffer = await fs.readFile(sourceFacePath);
    const destBuffer = await fs.readFile(targetImagePath);

    const srcBlob = new Blob([srcBuffer], { type: "image/jpeg" });
    const destBlob = new Blob([destBuffer], { type: "image/jpeg" });

    // Pipeline A: Fast GPU-accelerated InsightFace pipeline
    const runFastPipeline = async () => {
      console.log("[luffy.ai Engine] Running GPU InsightFace swap pipeline...");
      try {
        const app = await getTonyassiClient();
        const res = await app.predict("/swap_faces", {
          src_img: srcBlob,
          dest_img: destBlob,
        });

        const outItem = res?.data?.[0];
        const outUrl = outItem?.url || (typeof outItem === "string" ? outItem : null);
        if (!outUrl) {
          throw new Error("Could not detect a clear face in either photo. Please upload front-facing photos with good lighting.");
        }
        return outUrl;
      } catch (err) {
        tonyassiClient = null;
        throw err;
      }
    };

    // Pipeline B: InsightFace + GFPGANv1.4 neural restoration pipeline (Deep detail)
    const runGfpganPipeline = async () => {
      console.log("[luffy.ai Engine] Running InsightFace + GFPGANv1.4 restoration pipeline...");
      try {
        const app = await getZerovicClient();
        const res = await app.predict("/predict", {
          target_image: destBlob,
          swap_image: srcBlob,
        });

        const outItem = res?.data?.[0];
        const outUrl = outItem?.url || (typeof outItem === "string" ? outItem : null);
        if (!outUrl) {
          throw new Error("GFPGAN space did not return a valid result URL.");
        }
        return outUrl;
      } catch (err) {
        zerovicClient = null;
        throw err;
      }
    };

    let resultUrl = null;

    // Always prioritize the InsightFace + GFPGANv1.4 neural restoration pipeline for maximum facial clarity
    try {
      resultUrl = await runGfpganPipeline();
    } catch (err) {
      console.warn(`[luffy.ai Engine] GFPGAN pipeline notice (${err.message}), falling back to alternative pipeline...`);
      try {
        resultUrl = await runFastPipeline();
      } catch (err2) {
        throw new Error(`Face swap processing error: ${err2.message || err.message}`);
      }
    }

    console.log("[luffy.ai Engine] Downloading high-resolution result...");
    const rawBuffer = await downloadImageResult(resultUrl);

    console.log("[luffy.ai Engine] Outputting pristine 4K UHD Master...");
    const master4K = await ensure4KResolution(rawBuffer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[luffy.ai Engine] 4K face swap successfully completed in ${elapsed}s!`);
    return master4K;
  },

  async swapMultipleFaces({ targetImagePath, sourceFacePaths = [] }) {
    const startTime = Date.now();
    console.log(`[luffy.ai Engine] Starting Multiple Face Swap (${sourceFacePaths.length} faces)...`);

    let currentBuffer = await fs.readFile(targetImagePath);

    for (let i = 0; i < sourceFacePaths.length; i++) {
      const facePath = sourceFacePaths[i];
      console.log(`[luffy.ai Engine] Swapping Face #${i + 1}/${sourceFacePaths.length}...`);
      const faceBuffer = await fs.readFile(facePath);

      const srcBlob = new Blob([faceBuffer], { type: "image/jpeg" });
      const destBlob = new Blob([currentBuffer], { type: "image/jpeg" });

      let resultUrl = null;

      // Swap pass: Try GFPGAN restoration space first, then fast pipeline fallback
      try {
        const app = await getZerovicClient();
        const res = await app.predict("/predict", {
          target_image: destBlob,
          swap_image: srcBlob,
        });
        const outItem = res?.data?.[0];
        resultUrl = outItem?.url || (typeof outItem === "string" ? outItem : null);
        if (!resultUrl) throw new Error("GFPGAN space did not return a valid result URL.");
      } catch (err) {
        zerovicClient = null;
        console.warn(`[luffy.ai Engine] Multi-swap face #${i + 1} fallback notice: ${err.message}`);
        try {
          const app = await getTonyassiClient();
          const res = await app.predict("/swap_faces", {
            src_img: srcBlob,
            dest_img: destBlob,
          });
          const outItem = res?.data?.[0];
          resultUrl = outItem?.url || (typeof outItem === "string" ? outItem : null);
          if (!resultUrl) throw new Error("Could not detect a clear face to swap.");
        } catch (err2) {
          tonyassiClient = null;
          throw new Error(`Multi-face swap processing error on face #${i + 1}: ${err2.message || err.message}`);
        }
      }

      currentBuffer = await downloadImageResult(resultUrl);
    }

    console.log("[luffy.ai Engine] Outputting pristine 4K UHD Multi-Person Master...");
    const master4K = await ensure4KResolution(currentBuffer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[luffy.ai Engine] Multi-face swap (${sourceFacePaths.length} faces) successfully completed in ${elapsed}s!`);
    return master4K;
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const providers = { mock: mockProvider, custom: customProvider };

export default providers[PROVIDER] || customProvider;
export { PROVIDER, ensure4KResolution };
