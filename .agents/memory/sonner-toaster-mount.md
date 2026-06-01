---
name: Sonner toaster mount
description: lp-studio has two parallel toast systems; sonner toasts silently no-op unless the sonner Toaster is mounted.
---

lp-studio ships TWO independent toast systems:
- Radix shadcn toaster — `@/components/ui/toaster` driven by `useToast()` (`@/hooks/use-toast`). Mounted by App.tsx.
- Sonner toaster — `@/components/ui/sonner` (re-exports sonner's `<Toaster>`); the imperative API is `import { toast } from "sonner"`.

**The trap:** for a long time only the Radix `<Toaster>` was mounted. Any code calling `toast.*` from `"sonner"` (Sales Console accounts/contacts/signals, Reviews overview, the email editor) fired into the void — the delete/save succeeded but NO toast ever rendered. It looks like a flaky UI but the toaster element simply does not exist in the DOM.

**Fix / rule:** the sonner `<SonnerToaster />` is now mounted once at the root in `src/main.tsx` (alongside `<App/>`, inside the Sentry ErrorBoundary). Keep it there.

**How to apply:**
- If you add a `toast.*` (sonner) call, it works only because of that root mount — don't remove it.
- When E2E-asserting a success toast and it "never appears" though the underlying request returns 200, check WHICH toast library the page uses (`rg 'from "sonner"'` vs `useToast`) and that its toaster is mounted, before suspecting timing/selectors.
