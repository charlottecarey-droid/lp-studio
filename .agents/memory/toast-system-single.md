---
name: lp-studio single toast system
description: lp-studio standardized on Radix useToast; sonner removed (footgun avoidance)
---

lp-studio uses exactly ONE toast system: the Radix one — `import { useToast } from
"@/hooks/use-toast"` inside components, or the exported standalone `import { toast }
from "@/hooks/use-toast"` for non-component modules (e.g. `lib/undo-delete.tsx`).

**Why:** It previously ran TWO toast systems side by side (Radix + sonner). Only
the Radix `<Toaster>` was mounted for a long time, so every `import { toast } from
"sonner"` call silently no-op'd (delete confirmations vanished). Two systems is a
footgun — the next person can pick the unmounted path and reintroduce the bug.

**How to apply:**
- Never `import { toast } from "sonner"` in lp-studio; sonner + next-themes are no
  longer deps there and `components/ui/sonner.tsx` is deleted.
- API: `toast({ title, description?, variant?, duration?, action? })`. Only two
  variants exist: `default` and `destructive` (use destructive for errors). There
  is no success/info/warning — they all render as `default`.
- Action buttons use Radix `<ToastAction altText="…" onClick={…}>` (requires JSX,
  so the file must be `.tsx`). Per-toast `duration` passes through to the Radix
  Toast root.
- mockup-sandbox is a SEPARATE artifact that still uses sonner — do not "fix" it to
  match lp-studio.
