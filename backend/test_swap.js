import provider from "./services/faceSwapProvider.js";
import fs from "fs/promises";

async function test() {
  const srcUrl = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400";
  const targetUrl = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400&h=400";

  try {
    await fs.mkdir("./uploads", { recursive: true });

    console.log("Downloading test portraits...");
    const srcRes = await fetch(srcUrl);
    await fs.writeFile("./uploads/test_src.png", Buffer.from(await srcRes.arrayBuffer()));

    const targetRes = await fetch(targetUrl);
    await fs.writeFile("./uploads/test_target.png", Buffer.from(await targetRes.arrayBuffer()));

    console.log("\n--- Testing High-Accuracy Image Face Swap ---");
    const resultBuffer = await provider.swapImage({
      sourceFacePath: "./uploads/test_src.png",
      targetImagePath: "./uploads/test_target.png",
      fidelity: 0.65,
      upscale: 2,
      enhance: true,
    });

    await fs.writeFile("./uploads/test_result.png", resultBuffer);
    console.log("Image Swap SUCCESS! Result saved to ./uploads/test_result.png");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
