import { Copy } from "lucide-react";

interface Props {
  /** Wired by BuilderEditor (sales/microsite scope) — runs propagateCtaToAll
   *  through the undoable setBlocks path and toasts the result. When undefined
   *  the control renders nothing (e.g. non-microsite pages today). */
  onApplyCtaToAll?: () => void;
  /** Disable when the source block currently has no CTA configured. */
  disabled?: boolean;
  label?: string;
}

/**
 * Shared "Copy this CTA to all sections" control for CTA-bearing property
 * panels. Accessible (real <button>, focus-visible ring, aria-label) and
 * reduced-motion safe (transition is suppressed under
 * prefers-reduced-motion via Tailwind's motion-reduce variant). Styling
 * matches the dashed-outline secondary controls used elsewhere in the
 * inspector.
 */
export function ApplyCtaToAllButton({ onApplyCtaToAll, disabled, label }: Props) {
  if (!onApplyCtaToAll) return null;
  return (
    <button
      type="button"
      onClick={onApplyCtaToAll}
      disabled={disabled}
      aria-label="Copy this CTA configuration to every other section on the page"
      title={disabled ? "Configure this CTA first" : "Copy this CTA to every other section"}
      className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-md py-1.5 px-2 transition-colors motion-reduce:transition-none flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
    >
      <Copy className="w-3 h-3" aria-hidden="true" />
      {label ?? "Copy this CTA to all sections"}
    </button>
  );
}
