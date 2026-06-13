/**
 * Starter prompt chips (June 2026) — shown above the AI prompt textarea while
 * it's EMPTY; hidden the moment the user types. Each chip prefills a prompt
 * skeleton and the caller focuses the textarea with the skeleton selected so
 * typing replaces it (or arrow-keys extend it) naturally.
 *
 * NOTE: the podcast / event / pricing phrasings deliberately contain the
 * trigger nouns the backend's template-intent matcher keys on ("podcast",
 * "episode", "event", "RSVP", "pricing", "tiers", …) — don't reword them.
 */
import { cn } from "@/lib/utils";

export interface StarterPrompt {
  label: string;
  prompt: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    label: "Summer sale",
    prompt:
      "A bold summer sale landing page for [product/store], highlighting limited-time discounts, with a hero, featured deals, social proof, and a strong shop-now CTA",
  },
  {
    label: "Product launch",
    prompt:
      "A product launch page announcing [product], with an announcement hero, key features, social proof, pricing, and an early-access CTA",
  },
  {
    label: "Podcast series",
    prompt:
      "A podcast series page for [show name] with episode library, host spotlight, and a subscribe CTA",
  },
  {
    label: "Event RSVP",
    prompt:
      "An event landing page for [event] with date/location, agenda highlights, speakers, and an RSVP form",
  },
  {
    label: "Pricing page",
    prompt:
      "A pricing page for [product] with 3 tiers, feature comparison, FAQ, and a free-trial CTA",
  },
  {
    label: "Customer story",
    prompt:
      "A customer story page about how [customer] achieved [result] with [product], with challenge/solution/results and a quote",
  },
];

interface Props {
  /** Called with the full prompt skeleton — the caller sets the textarea
   *  value and focuses it with the text selected. */
  onPick: (prompt: string) => void;
  className?: string;
}

export function StarterPromptChips({ onPick, className }: Props) {
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Starter prompts"
    >
      {STARTER_PROMPTS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(p.prompt)}
          title={p.prompt}
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
