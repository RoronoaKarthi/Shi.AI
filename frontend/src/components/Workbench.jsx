import { useState, useEffect } from "react";
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
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState([]);
  const [previewItem, setPreviewItem] = useState(null); // Modal preview state

  const activeMode = MODES.find((m) => m.id === mode);
  const canSubmit = sourceFace && target && status !== "working";

  // Fetch history list
  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }

  // Delete history item
  async function handleDeleteHistory(id) {
    try {
      const res = await fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchHistory();
        if (previewItem && previewItem.id === id) {
          setPreviewItem(null); // Close preview if currently open
        }
      }
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

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
        fetchHistory();
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
        fetchHistory();
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
              <a 
                className="workbench__download" 
                href={resultUrl} 
                download={`shu-ai-swapped.${mode === "video" ? "mp4" : mode === "gif" ? "gif" : "png"}`}
              >
                Download result
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="workbench__footer">
        <button
          className="workbench__submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {status === "working" ? "Working…" : `Swap ${activeMode.label.toLowerCase()}`}
        </button>
      </div>

      {history.length > 0 && (
        <div className="workbench__history">
          <h3 className="history__title">Recent Swaps (Deleted after 24h)</h3>
          <div className="history__grid">
            {history.map((item) => (
              <div key={item.id} className="history__card">
                <div 
                  className="history__media-container" 
                  onClick={() => setPreviewItem(item)}
                  style={{ cursor: "zoom-in" }}
                  title="Click to preview"
                >
                  {item.type === "video" ? (
                    <video src={`${API_BASE}${item.url}`} muted preload="metadata" />
                  ) : (
                    <img src={`${API_BASE}${item.url}`} alt="history item" />
                  )}
                </div>
                <div className="history__card-actions">
                  <a
                    href={`${API_BASE}${item.url}`}
                    download={`shu-ai-swapped-${item.id}.${item.type === "video" ? "mp4" : item.type === "gif" ? "gif" : "png"}`}
                    className="history__btn history__btn--download"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    className="history__btn history__btn--delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Preview Component */}
      {previewItem && (
        <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewItem(null)}>×</button>
            <div className="modal-body">
              {previewItem.type === "video" ? (
                <video src={`${API_BASE}${previewItem.url}`} controls autoPlay loop />
              ) : (
                <img src={`${API_BASE}${previewItem.url}`} alt="Full preview" />
              )}
            </div>
            <div className="modal-footer">
              <a
                href={`${API_BASE}${previewItem.url}`}
                download={`shu-ai-swapped-${previewItem.id}.${previewItem.type === "video" ? "mp4" : previewItem.type === "gif" ? "gif" : "png"}`}
                className="modal-download-btn"
              >
                Download Swapped Media
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
