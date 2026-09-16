import { useState, useEffect } from "react";
import { getClientHistory, deleteClientHistoryItem, clearAllClientHistory } from "../utils/historyStore.js";
import "./History.css";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function History({ refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(null);

  const activeItem = previewIndex !== null && items[previewIndex] ? items[previewIndex] : null;

  const handlePrev = (e) => {
    e?.stopPropagation();
    if (items.length <= 1) return;
    setPreviewIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    if (items.length <= 1) return;
    setPreviewIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "Escape") setPreviewIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewIndex, items.length]);

  const getItemUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
    return `${API_BASE}${url}`;
  };

  async function fetchHistory() {
    try {
      setLoading(true);
      // 1. Fetch persistent 24h history from client-side IndexedDB
      const clientItems = await getClientHistory();

      // 2. Fetch server history if available
      let serverItems = [];
      try {
        const res = await fetch(`${API_BASE}/api/history`);
        if (res.ok) {
          const data = await res.json();
          serverItems = data.history || [];
        }
      } catch {}

      // 3. Merge without duplicate IDs
      const seen = new Set();
      const merged = [];
      for (const item of [...clientItems, ...serverItems]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }

      setItems(merged);
    } catch (err) {
      console.warn("Could not fetch history:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, [refreshKey]);

  async function handleDelete(id, e) {
    e.stopPropagation();
    try {
      await deleteClientHistoryItem(id);
      fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE" }).catch(() => {});
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Are you sure you want to clear all history immediately?")) return;
    try {
      await clearAllClientHistory();
      fetch(`${API_BASE}/api/history`, { method: "DELETE" }).catch(() => {});
      setItems([]);
    } catch (err) {
      console.error("Clear all failed:", err);
    }
  }

  function handleDownload(item, e) {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = getItemUrl(item.url);
    link.download = `luffy-ai-4k-${item.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <section id="history" className="visro-history">
      <div className="visro-history__container">
        
        {/* History Header */}
        <div className="visro-history__head">
          <div>
            <div className="visro-history__badge-wrap">
              <span className="visro-history__badge">24-Hour Auto Cleanup</span>
              <span className="visro-history__badge-count">{items.length} {items.length === 1 ? "swap" : "swaps"} stored</span>
            </div>
            <h2 className="visro-history__title">Recent Face Swaps</h2>
            <p className="visro-history__sub">
              Your 4K swaps are saved on the server for <strong>24 hours</strong> and automatically wiped clean for total privacy.
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              className="visro-history__clear-btn"
              onClick={handleClearAll}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear All
            </button>
          )}
        </div>

        {/* History Items Grid */}
        {loading && items.length === 0 ? (
          <div className="visro-history__loading">
            <div className="visro-history__spinner" />
            <span>Loading recent swaps...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="visro-history__empty">
            <div className="visro-history__empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h3 className="visro-history__empty-title">No Recent Swaps Saved</h3>
            <p className="visro-history__empty-desc">
              When you generate face swaps above, they will appear here and remain available for 24 hours before automatic deletion.
            </p>
          </div>
        ) : (
          <div className="visro-history__grid">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="visro-history-card"
                onClick={() => setPreviewIndex(index)}
              >
                <div className="visro-history-card__media">
                  <img
                    src={getItemUrl(item.url)}
                    alt="Swapped result"
                    loading="lazy"
                  />
                  <span className="visro-history-card__res-badge">4K UHD</span>
                  <span className="visro-history-card__timer-badge">
                    ⏳ {item.remainingTime} left
                  </span>
                </div>

                <div className="visro-history-card__body">
                  <span className="visro-history-card__date">
                    {formatDate(item.createdAt)}
                  </span>

                  <div className="visro-history-card__actions">
                    <button
                      type="button"
                      className="visro-history-card__btn-dl"
                      onClick={(e) => handleDownload(item, e)}
                      title="Download 4K Master PNG"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>

                    <button
                      type="button"
                      className="visro-history-card__btn-del"
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete now"
                      aria-label="Delete swap"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Lightbox Preview with Next & Previous Navigation */}
        {activeItem && (
          <div
            className="visro-history__lightbox"
            onClick={() => setPreviewIndex(null)}
          >
            {/* Previous Button (Visible when multiple swaps exist) */}
            {items.length > 1 && (
              <button
                type="button"
                className="visro-history__lightbox-nav visro-history__lightbox-nav--prev"
                onClick={handlePrev}
                title="Previous Swap (Left Arrow key)"
                aria-label="Previous swap"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}

            <div
              className="visro-history__lightbox-inner"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={getItemUrl(activeItem.url)} alt="Full size preview" />

              {/* Lightbox Top Control Bar */}
              <div className="visro-history__lightbox-topbar">
                <div className="visro-history__lightbox-counter">
                  {items.length > 1 ? `${previewIndex + 1} of ${items.length}` : "4K UHD Master"}
                </div>

                <div className="visro-history__lightbox-top-actions">
                  <button
                    type="button"
                    className="visro-history__lightbox-btn-dl"
                    onClick={(e) => handleDownload(activeItem, e)}
                    title="Download 4K Master PNG"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download 4K
                  </button>

                  <button
                    type="button"
                    className="visro-history__lightbox-close"
                    onClick={() => setPreviewIndex(null)}
                    title="Close preview (Esc)"
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Lightbox Bottom Metadata Bar */}
              <div className="visro-history__lightbox-bottombar">
                <span className="visro-history__lightbox-badge">
                  {activeItem.resolution || "4K UHD"}
                </span>
                <span className="visro-history__lightbox-time">
                  ⏳ {activeItem.remainingTime} left
                </span>
                <span className="visro-history__lightbox-date">
                  {formatDate(activeItem.createdAt)}
                </span>
              </div>
            </div>

            {/* Next Button (Visible when multiple swaps exist) */}
            {items.length > 1 && (
              <button
                type="button"
                className="visro-history__lightbox-nav visro-history__lightbox-nav--next"
                onClick={handleNext}
                title="Next Swap (Right Arrow key)"
                aria-label="Next swap"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
