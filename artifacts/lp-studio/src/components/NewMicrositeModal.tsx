// Sales "New Microsite" modal — single-screen flow that mirrors the
// marketing "Create New Page" modal but is account-aware:
//   1. Pick an account (recommended) — or take the small "without an account"
//      escape hatch beneath it.
//   2. Pick Template or AI Generate.
//   3. Submit → page is created, hotlinks are bulk-generated for the account
//      contacts (when one is picked), and the user is taken to the builder.
//
// Template list is restricted to the caller's tenant (`?ownedOnly=true`) —
// reps never see the global SaaS starter library, so every microsite stays
// on-brand.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  FileText,
  Loader2,
  Sparkles,
  UserX,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountCombobox } from "@/components/AccountCombobox";
import { fetchBrandConfig, type AudienceSegment } from "@/lib/brand-config";
import { rememberStrictMismatches } from "@/lib/strictMismatches";
import { rememberCritiqueAnnotations } from "@/lib/critiqueAnnotations";
import { cn } from "@/lib/utils";

const API_BASE = "/api";

interface Account {
  id: number;
  name: string;
}

interface TenantTemplate {
  id: number;
  title: string;
  templateLabel: string | null;
  templateDescription: string | null;
}

type Mode = "template" | "ai";

interface Props {
  open: boolean;
  onClose: () => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Per-account "last segment used" memory. Persisted in localStorage so the
// segment picker can default to the rep's previous choice for the same
// account, reinforcing consistent messaging and saving clicks.
//
// Shape: { [accountId: string]: string /* segmentId, "" means Auto */ }
const LAST_SEGMENT_STORAGE_KEY = "lp-studio:lastSegmentByAccount";

function readLastSegmentMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_SEGMENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function rememberLastSegment(accountId: number, segmentId: string) {
  if (typeof window === "undefined") return;
  try {
    const map = readLastSegmentMap();
    map[String(accountId)] = segmentId;
    window.localStorage.setItem(LAST_SEGMENT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort — quota or disabled storage shouldn't break the flow
  }
}

function recallLastSegment(accountId: string): string {
  if (!accountId) return "";
  const map = readLastSegmentMap();
  return map[accountId] ?? "";
}

export function NewMicrositeModal({ open, onClose }: Props) {
  const [, navigate] = useLocation();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<TenantTemplate[]>([]);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Account selection state. `noAccount` true means the rep clicked the
  // small "create without an account" escape hatch.
  const [accountId, setAccountId] = useState<string>("");
  const [noAccount, setNoAccount] = useState(false);

  const [mode, setMode] = useState<Mode>("template");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  // 0 represents "Blank" (no fromTemplateId), otherwise the tenant template id.
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(0);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTemplateId, setAiTemplateId] = useState<string>("");
  // Empty string means "Auto / no specific segment". Used by both AI mode
  // and Template mode — when a segment is chosen with a template, we route
  // through the AI template-rewrite path to lightly retune copy.
  const [aiSegmentId, setAiSegmentId] = useState<string>("");
  const [templateSegmentId, setTemplateSegmentId] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state every time the modal closes so reopening starts
  // from a clean slate (matches CreatePageModal behaviour).
  useEffect(() => {
    if (!open) {
      setAccountId("");
      setNoAccount(false);
      setMode("template");
      setTitle("");
      setSlug("");
      setSelectedTemplateId(0);
      setAiPrompt("");
      setAiTemplateId("");
      setAiSegmentId("");
      setTemplateSegmentId("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Load accounts + tenant-owned templates whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      fetch(`${API_BASE}/sales/accounts`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
      // ownedOnly=true → no global starter templates, only this tenant's.
      fetch(`${API_BASE}/lp/templates?ownedOnly=true`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
      // Audience segments come from the tenant's brand config — same source
      // the page editor and Content Brief modal already use.
      fetchBrandConfig().then(b => b.segments ?? []).catch(() => []),
    ]).then(([accts, tpls, segs]: [Account[], TenantTemplate[], AudienceSegment[]]) => {
      setAccounts(Array.isArray(accts) ? accts : []);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setSegments(Array.isArray(segs) ? segs : []);
      setLoadingData(false);
    });
  }, [open]);

  const selectedAccount = useMemo(
    () => accounts.find(a => String(a.id) === accountId) ?? null,
    [accounts, accountId],
  );

  // Prefill the segment pickers with the rep's last-used segment for this
  // account. Only runs while the modal is open and an account is selected;
  // clearing the account ("create without account" or switching) resets both
  // pickers back to Auto so we don't carry stale preferences across accounts.
  useEffect(() => {
    if (!open) return;
    const remembered = recallLastSegment(accountId);
    setAiSegmentId(remembered);
    setTemplateSegmentId(remembered);
  }, [open, accountId]);

  // The user has committed to a path (account picked, or explicitly skipped)
  // before they're allowed to fill in title/template/AI fields.
  const pathChosen = noAccount || accountId !== "";

  function handleTitleChange(v: string) {
    setTitle(v);
    setSlug(slugify(v));
  }

  // Submit — translates the chosen mode into the right backend calls and
  // navigates to the builder on success.
  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const acctIdNum = noAccount ? null : Number(accountId);
      let pageId: number;
      let createdTitle = title.trim();
      let createdSlug = slug.trim();

      // Mirror the segmentContext shape used by pages-gallery.tsx so the
      // generator tailors copy to this audience. Shared by AI mode and
      // template-mode-with-segment.
      const buildSegmentContext = (segId: string) => {
        const seg = segId ? segments.find(s => s.id === segId) : null;
        return seg ? {
          name: seg.name,
          description: seg.description,
          messagingAngle: seg.messagingAngle,
          uniqueContext: seg.uniqueContext,
          valueProps: seg.valueProps,
          personas: seg.personas?.map(p => ({ role: p.role, painPoints: p.painPoints })),
          challenges: seg.challenges?.map(c => ({ title: c.title, desc: c.desc })),
        } : undefined;
      };

      if (mode === "ai") {
        if (!aiPrompt.trim()) throw new Error("Add a prompt for the AI.");
        const tplIdForAi = aiTemplateId ? Number(aiTemplateId) : undefined;
        const segmentContext = buildSegmentContext(aiSegmentId);
        const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: aiPrompt.trim(),
            ...(tplIdForAi ? { templateId: tplIdForAi } : {}),
            ...(segmentContext ? { segmentContext } : {}),
          }),
        });
        if (!genRes.ok) {
          const err = await genRes.json().catch(() => ({ error: "AI generation failed" }));
          throw new Error((err as { error?: string }).error ?? "AI generation failed");
        }
        const generated = (await genRes.json()) as {
          title?: string;
          slug?: string;
          blocks?: unknown[];
          strictMismatches?: unknown;
          critiqueAnnotations?: unknown;
        };
        // Save the AI-generated page. If the user supplied a title, prefer
        // theirs; otherwise fall back to the AI's suggestion.
        const finalTitle = createdTitle || generated.title || "Untitled microsite";
        const finalSlug = createdSlug || slugify(generated.slug || finalTitle);
        const saveRes = await fetch(`${API_BASE}/lp/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: finalTitle,
            slug: finalSlug,
            blocks: Array.isArray(generated.blocks) ? generated.blocks : [],
            status: "draft",
          }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({ error: "Could not save page" }));
          throw new Error((err as { error?: string }).error ?? "Could not save page");
        }
        const page = (await saveRes.json()) as { id: number };
        pageId = page.id;
        createdTitle = finalTitle;
        createdSlug = finalSlug;
        // Task #254 — surface unapproved-stat warnings on the editor.
        rememberStrictMismatches(pageId, generated.strictMismatches);
        rememberCritiqueAnnotations(pageId, generated.critiqueAnnotations);
      } else {
        // Template / Blank mode — POST /lp/pages and let the server clone
        // blocks from the template when fromTemplateId is set.
        //
        // Exception: when a real template is chosen AND the rep picked an
        // audience segment, route through /lp/generate-page in template-rewrite
        // mode so the AI lightly retunes the template's copy for that segment.
        // Block structure (ids, types, layout, images, colors) is preserved
        // verbatim — only human-readable text fields are rewritten.
        if (!createdTitle) throw new Error("Give the microsite a name.");
        if (!createdSlug) throw new Error("Slug is required.");

        const tplSegmentContext = selectedTemplateId > 0
          ? buildSegmentContext(templateSegmentId)
          : undefined;

        if (tplSegmentContext) {
          // Synthesise a short prompt — the endpoint requires `prompt`, and
          // it gives the AI a clear instruction alongside the segment data.
          const synthPrompt =
            `Tailor this template's copy for the ${tplSegmentContext.name} audience` +
            (selectedAccount ? `, for ${selectedAccount.name}.` : ".");
          const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: synthPrompt,
              templateId: selectedTemplateId,
              segmentContext: tplSegmentContext,
            }),
          });
          if (!genRes.ok) {
            const err = await genRes.json().catch(() => ({ error: "Template tailoring failed" }));
            throw new Error((err as { error?: string }).error ?? "Template tailoring failed");
          }
          const generated = (await genRes.json()) as {
            title?: string;
            slug?: string;
            blocks?: unknown[];
            strictMismatches?: unknown;
            critiqueAnnotations?: unknown;
          };
          const saveRes = await fetch(`${API_BASE}/lp/pages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: createdTitle,
              slug: createdSlug,
              blocks: Array.isArray(generated.blocks) ? generated.blocks : [],
              status: "draft",
            }),
          });
          if (!saveRes.ok) {
            const err = await saveRes.json().catch(() => ({ error: "Could not save page" }));
            throw new Error((err as { error?: string }).error ?? "Could not save page");
          }
          const page = (await saveRes.json()) as { id: number };
          pageId = page.id;
          // Task #254 — surface unapproved-stat warnings on the editor.
          rememberStrictMismatches(pageId, generated.strictMismatches);
          rememberCritiqueAnnotations(pageId, generated.critiqueAnnotations);
        } else {
          const body: Record<string, unknown> = {
            title: createdTitle,
            slug: createdSlug,
            status: "draft",
          };
          if (selectedTemplateId > 0) body.fromTemplateId = selectedTemplateId;
          else body.blocks = [];
          const res = await fetch(`${API_BASE}/lp/pages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Could not create page" }));
            throw new Error((err as { error?: string }).error ?? "Could not create page");
          }
          const page = (await res.json()) as { id: number };
          pageId = page.id;
        }
      }

      // Remember the segment the rep just used for this account so the next
      // microsite they create against the same account defaults to it. The
      // chosen segment depends on which mode they submitted from.
      if (acctIdNum !== null) {
        const chosenSegment = mode === "ai" ? aiSegmentId : templateSegmentId;
        rememberLastSegment(acctIdNum, chosenSegment);
      }

      // When an account is attached, bulk-create personalised hotlinks for
      // every contact on the account that has an email. Failures here are
      // non-fatal — the page exists and the rep can still open the builder.
      if (acctIdNum !== null) {
        try {
          await fetch(`${API_BASE}/sales/accounts/${acctIdNum}/microsites`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId }),
          });
        } catch {
          // swallow — see comment above
        }
      }

      onClose();
      navigate(`/builder/${pageId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    pathChosen &&
    !submitting &&
    (mode === "ai" ? aiPrompt.trim().length > 0 : title.trim().length > 0 && slug.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            New Microsite
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* ── Account section (prominent) ────────────────────────── */}
          <div
            className={cn(
              "rounded-lg border p-3 space-y-2",
              noAccount
                ? "border-border bg-muted/30"
                : "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Personalize for an account
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Recommended — we'll create a tailored page and a unique link for each contact.
                </p>
              </div>
            </div>

            {noAccount ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5" />
                  Creating without an account
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setNoAccount(false)}
                >
                  Pick an account instead
                </button>
              </div>
            ) : (
              <>
                <AccountCombobox
                  accounts={accounts}
                  value={accountId}
                  onChange={(v) => setAccountId(v)}
                  placeholder={loadingData ? "Loading accounts…" : "Select an account…"}
                />
                <div className="flex justify-center pt-0.5">
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => { setAccountId(""); setNoAccount(true); }}
                  >
                    or create without an account
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Mode tabs ─────────────────────────────────────────── */}
          <div
            className={cn(
              "flex gap-1 p-1 bg-muted rounded-lg",
              !pathChosen && "opacity-50 pointer-events-none",
            )}
          >
            <button
              onClick={() => { setMode("template"); setError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all",
                mode === "template" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Template
            </button>
            <button
              onClick={() => { setMode("ai"); setError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all",
                mode === "ai" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Generate
            </button>
          </div>

          {/* ── Body — only enabled once account path is chosen ───── */}
          <div className={cn("flex flex-col gap-4", !pathChosen && "opacity-50 pointer-events-none")}>
            {mode === "template" ? (
              <>
                <div>
                  <Label className="text-xs font-medium">Microsite name</Label>
                  <Input
                    className="mt-1.5"
                    placeholder={selectedAccount ? `e.g. ${selectedAccount.name} — Q4 outreach` : "e.g. Spring outreach"}
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">URL slug</Label>
                  <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                    <Input
                      className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                      placeholder="page-slug"
                      value={slug}
                      onChange={(e) => setSlug(slugify(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-2 block">Starting template</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {/* Blank is always available. */}
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateId(0)}
                      className={cn(
                        "text-left p-3 rounded-lg border text-sm transition-all",
                        selectedTemplateId === 0
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30 hover:bg-muted/50",
                      )}
                    >
                      <p className="font-medium text-xs text-foreground">Blank</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Start from scratch.</p>
                    </button>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={cn(
                          "text-left p-3 rounded-lg border text-sm transition-all",
                          selectedTemplateId === t.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted/50",
                        )}
                      >
                        <p className="font-medium text-xs text-foreground line-clamp-1">
                          {t.templateLabel || t.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                          {t.templateDescription || "Tenant template"}
                        </p>
                      </button>
                    ))}
                  </div>
                  {!loadingData && templates.length === 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      No saved templates yet. Marketing can save any page as a template from the Builder.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium">
                    Audience segment{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <select
                    className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    value={templateSegmentId}
                    onChange={(e) => setTemplateSegmentId(e.target.value)}
                    disabled={selectedTemplateId === 0}
                  >
                    <option value="">Auto / no specific segment</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {selectedTemplateId === 0
                      ? "Pick a template above to tailor copy for an audience."
                      : templateSegmentId
                        ? "AI will lightly retune the template's copy for this audience. Layout, images, and links stay the same."
                        : "Leave on Auto to use the template's copy as-is."}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Describe what you want the microsite to say{selectedAccount ? ` for ${selectedAccount.name}` : ""}.
                      AI will draft the full page — you can edit anything in the builder afterwards.
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Audience segment</Label>
                  <select
                    className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={aiSegmentId}
                    onChange={(e) => setAiSegmentId(e.target.value)}
                  >
                    <option value="">Auto / no specific segment</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {!loadingData && segments.length === 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      No segments defined yet. Add them in Brand Settings to tailor copy by audience.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium">Starting point</Label>
                  <select
                    className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={aiTemplateId}
                    onChange={(e) => setAiTemplateId(e.target.value)}
                  >
                    <option value="">Generate from scratch (AI chooses blocks)</option>
                    {templates.length > 0 && (
                      <optgroup label="Use a template (AI fills copy only)">
                        {templates.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.templateLabel || t.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {!loadingData && templates.length === 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      No saved templates yet. Marketing can save any page as a template from the Builder.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium">Your prompt</Label>
                  <textarea
                    className="mt-1.5 w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={4}
                    placeholder={
                      selectedAccount
                        ? `e.g. A landing page pitching our new aligner workflow to ${selectedAccount.name}. Emphasise speed, support, and proven case outcomes.`
                        : "e.g. A landing page for our new dental crown service targeting general dentists. 5-day turnaround, digital workflow, free remakes."
                    }
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Microsite name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    className="mt-1.5"
                    placeholder="AI will pick one if you leave this blank"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-2 border-t border-border/50">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === "ai" ? "Generating…" : "Creating…"}
              </>
            ) : mode === "ai" ? (
              <>
                <Sparkles className="w-4 h-4" />
                Generate microsite
              </>
            ) : (
              <>Create microsite</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
