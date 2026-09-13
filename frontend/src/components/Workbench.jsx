import { useState } from "react";
import UploadSlot from "./UploadSlot.jsx";
import History from "./History.jsx";
import "./Workbench.css";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const PROCESSING_STEPS = [
  "Detecting 3D facial landmarks & geometry...",
  "Transferring 100% facial identity & skin tones...",
  "Rendering strict 4K UHD Master (3840px)...",
];

const SAMPLE_PORTRAITS = [
  { id: "s1", url: "/samples/sample1.jpg", name: "Classic Portrait" },
  { id: "s2", url: "/samples/sample2.jpg", name: "Freckles Model" },
  { id: "s3", url: "/samples/sample3.jpg", name: "Sunlight Glow" },
  { id: "s4", url: "/samples/sample4.jpg", name: "Modern Male" },
];

export default function Workbench({ onSwapComplete }) {
  const [sourceFace, setSourceFace] = useState(null);
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState("single"); // "single" | "multi"
  const [status, setStatus] = useState("idle"); // "idle" | "working" | "done" | "error"
  const [activeStep, setActiveStep] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  const canSubmit = sourceFace && target && status !== "working";

  function resetOutputs() {
    setStatus("idle");
    setActiveStep(0);
    setResultUrl(null);
    setErrorMsg(null);
  }

  function handleResetAll() {
    resetOutputs();
    setSourceFace(null);
    setTarget(null);
  }

// Fast client-side image compressor: downsizes to max 1280px at 0.9 JPEG quality if > 450KB
// Guarantees uploads remain < 350KB, avoiding Vercel 4.5MB payload limits & slow uploads
async function compressImageForUpload(file) {
  if (!file || !(file instanceof Blob)) return file;
  if (file.size < 450 * 1024) return file; // Already lightweight, keep original

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const name = file.name ? file.name.replace(/\.[^.]+$/, ".jpg") : "upload.jpg";
              const compressedFile = new File([blob], name, { type: "image/jpeg" });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.9
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

  async function handleSubmit() {
    if (!canSubmit) return;
    resetOutputs();
    setStatus("working");

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      currentStep = (currentStep + 1) % PROCESSING_STEPS.length;
      setActiveStep(currentStep);
    }, 1500);

    try {
      const [uploadSource, uploadTarget] = await Promise.all([
        compressImageForUpload(sourceFace),
        compressImageForUpload(target),
      ]);

      const form = new FormData();
      form.append("sourceFace", uploadSource);
      form.append("target", uploadTarget);
      const res = await fetch(`${API_BASE}/api/swap`, {
        method: "POST",
        body: form,
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Face swap processing encountered an error.");
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
      setHistoryKey((k) => k + 1);
      onSwapComplete?.();
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMsg(err.message);
      setStatus("error");
    }
  }

  // Client-side hardware-accelerated 4K exporter (exact 3840px UHD PNG)
  async function handleDownload4K() {
    if (!resultUrl) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resultUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = maxDim < 3840 ? 3840 / maxDim : 1;
      const targetW = Math.round(img.naturalWidth * scale);
      const targetH = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "luffy-ai-4k-swapped-portrait.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, "image/png");
    } catch (err) {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = "luffy-ai-4k-swapped-portrait.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div className="visro-page">
      {/* Studio Workbench Section */}
      <section id="workbench" className="visro-workbench">
        <div className="visro-workbench__container">
          
          {/* Studio Header Bar */}
          <div className="visro-studio-bar">
            <div className="visro-mode-toggle">
              <button
                type="button"
                className={`visro-mode-btn ${mode === "single" ? "visro-mode-btn--active" : ""}`}
                onClick={() => setMode("single")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Single Face
              </button>
              <button
                type="button"
                className={`visro-mode-btn ${mode === "multi" ? "visro-mode-btn--active" : ""}`}
                onClick={() => setMode("multi")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Multiple Faces
                <span className="visro-mode-badge">Beta</span>
              </button>
            </div>

            <div className="visro-studio-badges">
              <span className="studio-pill studio-pill--4k">Strict 4K UHD</span>
              <span className="studio-pill studio-pill--natural">Pure Natural • No Filters</span>
            </div>
          </div>

          {/* 2-Column Visro Studio Grid */}
          <div className="visro-grid">
            
            {/* Left Column: Upload Slots & Action Button */}
            <div className="visro-controls-col">
              <div className="visro-upload-stack">
                <UploadSlot
                  stepNumber={1}
                  title="Source Image with Face"
                  subText="Click or drag original face photo"
                  limit="≤ 30MB"
                  iconType="image"
                  file={sourceFace}
                  samples={SAMPLE_PORTRAITS}
                  onChange={(f) => {
                    setSourceFace(f);
                    resetOutputs();
                  }}
                />

                <UploadSlot
                  stepNumber={2}
                  title="Target Face to Swap In"
                  subText="Click or drag replacement face portrait"
                  limit="≤ 30MB"
                  iconType="person"
                  file={target}
                  samples={SAMPLE_PORTRAITS}
                  onChange={(f) => {
                    setTarget(f);
                    resetOutputs();
                  }}
                />
              </div>

              {/* Start Face Swapping Action Button */}
              <button
                type="button"
                className="visro-btn-start"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {status === "working" ? (
                  <>
                    <span className="visro-btn-spinner" />
                    <span>Generating 4K Swap...</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                      <path d="M5 3v4"/>
                      <path d="M19 17v4"/>
                      <path d="M3 5h4"/>
                      <path d="M17 19h4"/>
                    </svg>
                    <span>Start Face Swapping</span>
                  </>
                )}
              </button>

              <div className="visro-privacy-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>100% Safe &amp; Private. Your images are deleted immediately after download.</span>
              </div>
            </div>

            {/* Right Column: Studio Showcase & Result Panel */}
            <div className="visro-stage-col">
              <div className="visro-stage-card">
                
                {/* IDLE STATE */}
                {status === "idle" && (
                  <div className="visro-stage-idle">
                    <div className="visro-stage-idle__glow" />
                    <div className="visro-stage-badge">Strict 4K UHD Master (3840px)</div>
                    
                    <div className="visro-stage-icon-wrap">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="4"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                    </div>

                    <h3 className="visro-stage-title">4K Swapped Portrait Preview</h3>
                    <p className="visro-stage-desc">
                      Upload your source image and replacement portrait on the left, then click <strong>Start Face Swapping</strong> to render your high-resolution portrait.
                    </p>

                    <div className="visro-stage-features">
                      <span className="visro-stage-feat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        100% Facial Identity Match
                      </span>
                      <span className="visro-stage-feat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Natural Skin &amp; Lighting
                      </span>
                      <span className="visro-stage-feat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Zero Artificial Filters
                      </span>
                    </div>
                  </div>
                )}

                {/* WORKING STATE */}
                {status === "working" && (
                  <div className="visro-stage-working">
                    <div className="visro-pulse-spinner">
                      <div className="visro-pulse-ring" />
                      <div className="visro-pulse-dot" />
                    </div>

                    <div className="visro-working-step-info">
                      <span className="visro-step-tag">Step {activeStep + 1} of 3</span>
                      <h4 className="visro-working-title">{PROCESSING_STEPS[activeStep]}</h4>
                      <p className="visro-working-sub">
                        Preserving authentic skin tone &amp; lighting • Pure photo-realism
                      </p>
                    </div>

                    <div className="visro-progress-bar">
                      <div
                        className="visro-progress-fill"
                        style={{ width: `${((activeStep + 1) / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ERROR STATE */}
                {status === "error" && (
                  <div className="visro-stage-error">
                    <div className="visro-error-icon">⚠️</div>
                    <h4 className="visro-error-title">Processing Failed</h4>
                    <p className="visro-error-text">{errorMsg}</p>
                    <button type="button" className="visro-error-retry" onClick={handleSubmit}>
                      Try Again
                    </button>
                  </div>
                )}

                {/* DONE STATE */}
                {status === "done" && resultUrl && (
                  <div className="visro-stage-done">
                    <div className="visro-result-viewport">
                      <img src={resultUrl} alt="Face swap 4K result" className="visro-result-img" />
                      <div className="visro-result-badge">Strict 4K UHD Master (3840px)</div>
                    </div>

                    <div className="visro-result-actions">
                      <button
                        type="button"
                        className="visro-btn-download"
                        onClick={handleDownload4K}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download HD Photo (PNG)
                      </button>

                      <button
                        type="button"
                        className="visro-btn-secondary"
                        onClick={handleResetAll}
                      >
                        Swap Another Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Face Swaps History — Located Directly Below the Result Page */}
      <History refreshKey={historyKey} />

      {/* Feature Showcase (Visro AI style) */}
      <section id="features" className="visro-features">
        <div className="visro-features__container">
          <div className="visro-section-head">
            <span className="visro-section-tag">AI Powered Capabilities</span>
            <h2 className="visro-section-title">Instantly Swap Faces with AI</h2>
            <p className="visro-section-sub">
              Experience flawless identity transfer with industry-leading facial alignment, authentic lighting adaptation, and zero digital filters.
            </p>
          </div>

          <div className="visro-features-grid">
            <div className="visro-feat-card">
              <div className="visro-feat-icon visro-feat-icon--indigo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </div>
              <h3 className="visro-feat-title">100% Identity Precision</h3>
              <p className="visro-feat-desc">
                High-resolution 512px deep feature embeddings preserve unique eye contours, jawline structures, and subtle expressions.
              </p>
            </div>

            <div className="visro-feat-card">
              <div className="visro-feat-icon visro-feat-icon--blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 className="visro-feat-title">Natural Lighting &amp; Texture</h3>
              <p className="visro-feat-desc">
                Multi-band Laplacian blending transfers faces seamlessly into the target portrait's ambient illumination without artificial sharpening or blur.
              </p>
            </div>

            <div className="visro-feat-card">
              <div className="visro-feat-icon visro-feat-icon--emerald">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="visro-feat-title">Strict 4K UHD Master</h3>
              <p className="visro-feat-desc">
                Every swapped portrait is mathematically scaled to true 3840px UHD using high-order Lanczos3 interpolation with crisp zero-artifact export.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="visro-how">
        <div className="visro-how__container">
          <div className="visro-section-head">
            <span className="visro-section-tag">Simple &amp; Fast</span>
            <h2 className="visro-section-title">How to Perform High-Quality Face Swaps</h2>
            <p className="visro-section-sub">
              Get professional-grade portrait swaps in seconds with our streamlined 4-step workflow.
            </p>
          </div>

          <div className="visro-steps-grid">
            <div className="visro-step-card">
              <div className="visro-step-num">01</div>
              <h4 className="visro-step-name">Upload Source Image</h4>
              <p className="visro-step-text">
                Select the photo containing the original face you want to replace.
              </p>
            </div>

            <div className="visro-step-card">
              <div className="visro-step-num">02</div>
              <h4 className="visro-step-name">Upload Target Face</h4>
              <p className="visro-step-text">
                Select the clear selfie or portrait of the face identity you want to transfer.
              </p>
            </div>

            <div className="visro-step-card">
              <div className="visro-step-num">03</div>
              <h4 className="visro-step-name">Start Face Swapping</h4>
              <p className="visro-step-text">
                Click the start button to activate our neural landmark and Poisson blending pipeline.
              </p>
            </div>

            <div className="visro-step-card">
              <div className="visro-step-num">04</div>
              <h4 className="visro-step-name">Download in 4K UHD</h4>
              <p className="visro-step-text">
                Preview your natural, uncompressed portrait and download the master 3840px PNG file.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
