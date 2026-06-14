/**
 * Starter prompt chips — shown above the AI prompt textarea while it's EMPTY;
 * hidden the moment the user types. Each chip prefills a prompt skeleton and the
 * caller focuses the textarea with the skeleton selected so typing replaces it
 * (or arrow-keys extend it) naturally.
 *
 * June 2026: the chips are now CONFIG-DRIVEN. They come from the effective
 * MARKETING generator presets (GET /lp/generator-presets?surface=marketing —
 * global defaults ∪ tenant overrides), NOT a hardcoded list. The caller fetches
 * the presets and passes them in; when there are no enabled marketing presets
 * (the current default state — they seed disabled), this renders nothing. This
 * replaces the old MARKETING_STARTER_CHIPS_ENABLED code flag: the owner enables
 * the chips by enabling presets in Superadmin.
 *
 * Each preset carries its own prompt skeleton (and, optionally, a template tie
 * that the backend's eligibility/intent system honours when generating). The
 * trigger nouns in the seeded skeletons (podcast/episode/event/RSVP/pricing/
 * tiers …) still anchor the backend template-intent matcher.
 */
import { cn } from "@/lib/utils";
import type { EffectivePreset } from "@/lib/generatorPresets";

interface Props {
  /** The effective, enabled MARKETING presets to render as chips. Empty ⇒
   *  renders nothing (the safe fallback when none are configured/enabled). */
  presets: EffectivePreset[];
  /** Called with the preset (so the caller can prefill its prompt skeleton and
   *  carry its template tie). The caller sets the textarea value and focuses it
   *  with the text selected. */
  onPick: (preset: EffectivePreset) => void;
  className?: string;
}

export function StarterPromptChips({ presets, onPick, className }: Props) {
  // Only chips that actually carry a prompt skeleton are useful for prefilling.
  const chips = presets.filter((p) => (p.promptSkeleton ?? "").trim().length > 0);
  if (chips.length === 0) return null;
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Starter prompts"
    >
      {chips.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPick(p)}
          title={p.promptSkeleton ?? p.label}
          className={cn(
            "inline-flex items-center rounded-full border border-input bg-muted/40 px-2.5 py-1",
            "text-[11px] font-medium text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
