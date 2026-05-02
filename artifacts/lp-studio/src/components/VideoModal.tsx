import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";

export interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl?: string;
  ariaLabel?: string;
  posterUrl?: string;
}

export function VideoModal({
  open,
  onClose,
  videoUrl,
  ariaLabel = "Video player",
  posterUrl,
}: VideoModalProps) {
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => closeBtnRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(focusFrame);
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const hasUrl = !!videoUrl && videoUrl.trim() !== "";
  const isNative = hasUrl && isNativeVideoUrl(videoUrl!);

  return createPortal(
    <AnimatePresence>
      {open && hasUrl && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(0,0,0,0.85)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <motion.div
            className="relative w-full max-w-5xl"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black">
              {isNative ? (
                <video
                  src={videoUrl}
                  poster={posterUrl}
                  className="w-full h-full"
                  autoPlay
                  controls
                  playsInline
                />
              ) : (
                <iframe
                  src={getAutoplayEmbedUrl(videoUrl!)}
                  className="absolute inset-0 w-full h-full border-0"
                  title={ariaLabel}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
