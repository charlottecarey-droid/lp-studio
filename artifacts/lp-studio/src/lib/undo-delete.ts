import { toast } from "sonner";

const API_BASE = "/api";

/**
 * Show a success toast for a delete that offers an "Undo" action for a few
 * seconds. Clicking Undo POSTs the captured rows back to a restore endpoint
 * (the delete endpoints return everything needed under a `restore` key) and
 * then runs `onRestored` so the page can re-fetch.
 *
 * `restorePath` is relative to `/api` (e.g. `/sales/accounts/restore`).
 */
export function toastUndoableDelete(opts: {
  message: string;
  restorePath: string;
  restorePayload: unknown;
  onRestored: () => void;
  duration?: number;
}): void {
  const { message, restorePath, restorePayload, onRestored, duration = 7000 } = opts;

  toast.success(message, {
    duration,
    action: {
      label: "Undo",
      onClick: () => {
        void (async () => {
          try {
            const res = await fetch(`${API_BASE}${restorePath}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(restorePayload),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success("Restored");
            onRestored();
          } catch (err) {
            console.error("Undo restore failed:", err);
            toast.error("Couldn't undo. Please try again.");
          }
        })();
      },
    },
  });
}
