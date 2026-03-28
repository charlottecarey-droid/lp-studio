import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar } from "lucide-react";

interface ChiliPiperButtonProps {
  url: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
}

export function ChiliPiperButton({ url, children, style, onMouseEnter, onMouseLeave }: ChiliPiperButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        style={{ ...style, cursor: "pointer" }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </button>

      {open && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 880,
              height: "min(90vh, 720px)",
              background: "#fff",
              borderRadius: "1.25rem",
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1.25rem",
                borderBottom: "1px solid #e5e7eb",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 16, height: 16, color: "#003A30" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#003A30", fontFamily: "'Inter',system-ui,sans-serif" }}>
                  Schedule a Meeting
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  borderRadius: "0.375rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <iframe
              src={url}
              style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }}
              allow="camera; microphone; clipboard-write"
              title="Schedule a Meeting"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
