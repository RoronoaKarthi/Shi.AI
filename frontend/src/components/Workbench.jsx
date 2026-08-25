import { useState } from "react";
import UploadSlot from "./UploadSlot.jsx";
import "./Workbench.css";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const MODES = [
  { id: "image", label: "Image", accept: "image/png,image/jpeg,image/webp", targetHint: "JPG, PNG, WEBP" },
  { id: "gif", label: "GIF", accept: "image/gif", targetHint: "GIF" },
  { id: "video", label: "Video", accept: "video/mp4,video/quicktime", targetHint: "MP4, MOV" },
];

export default function Workbench() {
  const [mode, setMode] = useState("image");
  const [sourceFace, setSourceFace] = useState(null);
  const [target, setTarget] = useState(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const activeMode = MODES.find((m) => m.id === mode);
  const canSubmit = sourceFace && target && consent && status !== "working";

  function resetOutputs() {
    setStatus("idle");
    setProgress(0);
    setResultUrl(null);
    setErrorMsg(null);
  }

  function switchMode(id) {
    setMode(id);
    setSourceFace(null);
    setTarget(null);
    resetOutputs();
  }

  async function handleSubmit() {
    resetOutputs();
    setStatus("working");

    const form = new FormData();
    form.append("sourceFace", sourceFace);
    form.append("target", target);
    form.append("consent", "true");

    try {
      if (mode === "video") {
        const res = await fetch(`${API_BASE}/api/swap/video`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Could not start job.");
        pollJob(data.jobId);
      } else {
        const res = await fetch(`${API_BASE}/api/swap/${mode}`, { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Swap failed.");
        }
        const blob = await res.blob();
        setResultUrl(URL.createObjectURL(blob));
        setStatus("done");
      }
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  }

  async function pollJob(jobId) {
    const poll = async () => {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      const data = await res.json();
      if (data.status === "error") {
        setErrorMsg(data.error || "Processing failed.");
        setStatus("error");
        return;
      }
      setProgress(data.progress || 0);
      if (data.status === "done") {
        setResultUrl(`${API_BASE}/api/jobs/${jobId}/download`);
        setStatus("done");
        return;
      }
      setTimeout(poll, 900);
    };
    poll();
  }

  return (
    <section id="workbench" className="workbench">
      <div className="workbench__head">
        <h2>Workbench</h2>
        <div className="mode-switch" role="tablist" aria-label="Swap mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={`mode-switch__btn ${mode === m.id ? "mode-switch__btn--active" : ""}`}
              onClick={() => switchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="workbench__grid">
        <UploadSlot
          label="Source face"
          hint="JPG, PNG, WEBP"
          accept="image/png,image/jpeg,image/webp"
          file={sourceFace}
          onChange={(f) => {
            setSourceFace(f);
            resetOutputs();
          }}
        />
        <UploadSlot
          label={`Target ${activeMode.label.toLowerCase()}`}
          hint={activeMode.targetHint}
          accept={activeMode.accept}
          file={target}
          onChange={(f) => {
            setTarget(f);
            resetOutputs();
          }}
        />

        <div className="workbench__result">
          {status === "idle" && (
            <p className="workbench__placeholder">Result appears here</p>
          )}
          {status === "working" && (
            <div className="workbench__working">
              <div className="spinner" />
              <p>
                {mode === "video"
                  ? `Processing… ${progress}%`
                  : "Processing…"}
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="workbench__error">
              <p>{errorMsg}</p>
            </div>
          )}
          {status === "done" && resultUrl && (
            <div className="workbench__done">
              {mode === "video" ? (
                <video src={resultUrl} controls />
              ) : (
                <img src={resultUrl} alt="Face swap result" />
              )}
              <a className="workbench__download" href={resultUrl} download>
                Download result
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="workbench__footer">
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I confirm I have the right to use both uploaded files, and I won't
            use this to depict a real person without their permission.
          </span>
        </label>

        <button
          className="workbench__submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {status === "working" ? "Working…" : `Swap ${activeMode.label.toLowerCase()}`}
        </button>
      </div>
    </section>
  );
}
