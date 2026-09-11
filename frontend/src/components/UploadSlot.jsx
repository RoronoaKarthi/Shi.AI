import { useRef, useState } from "react";
import "./UploadSlot.css";

export default function UploadSlot({
  stepNumber = 1,
  title,
  subText = "Click or drag photo here",
  limit = "≤ 30MB",
  iconType = "image", // "image" | "person"
  accept = "image/png,image/jpeg,image/webp",
  file,
  onChange,
  samples = [],
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  function handleFiles(fileList) {
    const f = fileList?.[0];
    if (f) onChange(f);
  }

  async function handleSampleSelect(sampleUrl, sampleName) {
    try {
      const res = await fetch(sampleUrl);
      const blob = await res.blob();
      const fileObj = new File([blob], sampleName, { type: "image/jpeg" });
      onChange(fileObj);
    } catch (err) {
      console.error("Failed to load sample image:", err);
    }
  }

  const isStep1 = stepNumber === 1;

  return (
    <div className="visro-slot">
      <div className="visro-slot__header">
        <div className="visro-slot__title-wrap">
          <span className={`visro-slot__num ${isStep1 ? "visro-slot__num--indigo" : "visro-slot__num--blue"}`}>
            {stepNumber}
          </span>
          <span className="visro-slot__title">{title}</span>
        </div>
        <span className="visro-slot__limit">{limit}</span>
      </div>

      <div
        className={`visro-slot__dropzone ${dragging ? "visro-slot__dropzone--dragging" : ""} ${
          file ? "visro-slot__dropzone--filled" : ""
        } ${isStep1 ? "visro-slot__dropzone--step1" : "visro-slot__dropzone--step2"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />

        {file ? (
          <div className="visro-slot__preview">
            <img src={previewUrl} alt={title} />
            <div className="visro-slot__overlay">
              <span className="visro-slot__change-btn">Change Photo</span>
            </div>
            <button
              type="button"
              className="visro-slot__clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              aria-label={`Remove ${title}`}
              title={`Remove ${title}`}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="visro-slot__empty">
            <div className={`visro-slot__icon ${isStep1 ? "visro-slot__icon--indigo" : "visro-slot__icon--blue"}`}>
              {iconType === "image" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            <span className="visro-slot__main-text">{subText}</span>
            <span className="visro-slot__types">JPG, PNG, WEBP</span>
          </div>
        )}
      </div>

      {/* Sample Images Quick Selector */}
      {samples && samples.length > 0 && (
        <div className="visro-slot__samples">
          <span className="visro-slot__samples-label">Or try sample:</span>
          <div className="visro-slot__samples-list">
            {samples.map((sample, idx) => (
              <button
                key={sample.id || idx}
                type="button"
                className="visro-slot__sample-thumb"
                title={`Use ${sample.name || `Sample ${idx + 1}`}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSampleSelect(sample.url, sample.name || `sample_${idx + 1}.jpg`);
                }}
              >
                <img src={sample.url} alt={sample.name || `Sample ${idx + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
