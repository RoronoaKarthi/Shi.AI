import { useRef, useState } from "react";
import "./UploadSlot.css";

export default function UploadSlot({ label, hint, accept, file, onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const previewUrl = file ? URL.createObjectURL(file) : null;
  const isVideo = file?.type?.startsWith("video");

  function handleFiles(fileList) {
    const f = fileList?.[0];
    if (f) onChange(f);
  }

  return (
    <div
      className={`upload-slot ${dragging ? "upload-slot--dragging" : ""} ${file ? "upload-slot--filled" : ""}`}
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
        <div className="upload-slot__preview">
          {isVideo ? (
            <video src={previewUrl} muted loop autoPlay playsInline />
          ) : (
            <img src={previewUrl} alt="" />
          )}
          <button
            type="button"
            className="upload-slot__clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            aria-label={`Remove ${label}`}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="upload-slot__empty">
          <span className="upload-slot__label">{label}</span>
          <span className="upload-slot__hint">{hint}</span>
        </div>
      )}
    </div>
  );
}
