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
import { Client } from "@gradio/client";
import { Blob } from "buffer";
import sharp from "sharp";

const PROVIDER = process.env.FACE_SWAP_PROVIDER || "custom";

// Clean 4K UHD resolution scaler (pure Lanczos3 resampling, NO artificial sharpening or filters)
async function ensure4KResolution(imageBuffer) {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const origWidth = meta.width || 1024;
    const origHeight = meta.height || 1024;
    const maxDim = Math.max(origWidth, origHeight);

    const scale = maxDim < 3840 ? 3840 / maxDim : 1;
    const targetWidth = Math.round(origWidth * scale);
    const targetHeight = Math.round(origHeight * scale);

    let pipeline = sharp(imageBuffer);

    // Clean, natural Lanczos3 upsampling without any artificial filters, noise, or halos
    if (scale > 1) {
      pipeline = pipeline.resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: false,
      });
    }

    // Output clean, pristine, filter-free 4K PNG Master
    return await pipeline.png({ compressionLevel: 1, effort: 1 }).toBuffer();
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
// Singleton Gradio Client Connection Pool
// ---------------------------------------------------------------------------
let zerovicClient = null;
let tonyassiClient = null;

async function getZerovicClient() {
  if (!zerovicClient) {
    console.log("[luffy.ai Engine] Connecting to InsightFace + GFPGANv1.4 restoration pipeline...");
    zerovicClient = await Client.connect("zerovic/Swap-Face-Models-v1");
  }
  return zerovicClient;
}

async function getTonyassiClient() {
  if (!tonyassiClient) {
    console.log("[luffy.ai Engine] Connecting to fallback swap pipeline...");
    tonyassiClient = await Client.connect("tonyassi/face-swap");
  }
  return tonyassiClient;
}

// Pre-warm client in background
getZerovicClient().catch((err) => {
  console.warn("[luffy.ai Engine] Pre-warm notice:", err.message);
});

// ---------------------------------------------------------------------------
// Mock provider — for local offline testing
// ---------------------------------------------------------------------------
const mockProvider = {
  async swapImage({ targetImagePath }) {
    await delay(300);
    const buf = await fs.readFile(targetImagePath);
    return await ensure4KResolution(buf);
  },
};

// ---------------------------------------------------------------------------
// Custom provider — connects to Hugging Face Spaces via Gradio API
// Uses InsightFace 3D swap + GFPGANv1.4 neural face restoration for razor-sharp clarity
// ---------------------------------------------------------------------------
const customProvider = {
  async swapImage({ sourceFacePath, targetImagePath }) {
    const startTime = Date.now();
    const srcBuffer = await fs.readFile(sourceFacePath);
    const destBuffer = await fs.readFile(targetImagePath);

    const srcBlob = new Blob([srcBuffer], { type: "image/png" });
    const destBlob = new Blob([destBuffer], { type: "image/png" });

    // Step 1: Attempt InsightFace + GFPGANv1.4 neural restoration pipeline
    try {
      console.log(`[luffy.ai Engine] Connecting to InsightFace + GFPGANv1.4 restoration pipeline...`);
      const app = await getZerovicClient();

      console.log(`[luffy.ai Engine] Running face swap & GFPGANv1.4 high-fidelity facial synthesis...`);
      const resultData = await runGradioSubmit(
        app,
        "/predict",
        {
          target_image: destBlob, // destination photo to change
          swap_image: srcBlob,    // source face to transfer
        },
        (status) => {
          console.log(`[luffy.ai Engine] Stage: ${status.stage || "processing"}`);
        }
      );

      const outItem = resultData?.[0];
      const outUrl = outItem?.url || (typeof outItem === "string" ? outItem : null);

      if (outUrl) {
        console.log(`[luffy.ai Engine] GFPGAN restoration completed! Fetching high-res result...`);
        const imgRes = await fetch(outUrl);
        const finalBuffer = Buffer.from(await imgRes.arrayBuffer());

        console.log(`[luffy.ai Engine] Outputting crystal-clear 4K UHD Master (3840px)...`);
        const master4K = await ensure4KResolution(finalBuffer);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[luffy.ai Engine] High-clarity 4K swap completed in ${elapsed}s!`);
        return master4K;
      }
      throw new Error("GFPGAN did not return a valid result URL.");
    } catch (primaryErr) {
      console.warn(`[luffy.ai Engine] Primary GFPGAN space failed or timed out (${primaryErr.message}). Engaging fallback pipeline...`);
    }

    // Step 2: Reliable fallback to tonyassi/face-swap
    try {
      console.log(`[luffy.ai Engine] Connecting to fallback swap pipeline...`);
      const app = await getTonyassiClient();

      const resultData = await runGradioSubmit(
        app,
        "/swap_faces",
        {
          src_img: srcBlob,
          dest_img: destBlob,
        },
        (status) => {
          console.log(`[luffy.ai Engine] Fallback stage: ${status.stage}`);
        }
      );

      if (!resultData || !resultData[0] || !resultData[0].url) {
        throw new Error(
          "Could not detect a clear face in either photo. Please upload front-facing photos with good lighting."
        );
      }

      const imgRes = await fetch(resultData[0].url);
      const finalBuffer = Buffer.from(await imgRes.arrayBuffer());

      console.log(`[luffy.ai Engine] Outputting clean 4K UHD Master...`);
      const master4K = await ensure4KResolution(finalBuffer);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[luffy.ai Engine] Fallback 4K swap completed in ${elapsed}s!`);
      return master4K;
    } catch (err) {
      console.error("[luffy.ai Engine] Face swap failed:", err);
      throw new Error(`Face swap processing error: ${err.message}`);
    }
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const providers = { mock: mockProvider, custom: customProvider };

export default providers[PROVIDER] || customProvider;
export { PROVIDER, ensure4KResolution };
