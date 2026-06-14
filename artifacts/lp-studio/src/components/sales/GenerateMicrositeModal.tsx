// Generate Microsite Modal — the single-screen microsite creator (consolidated
// June 2026).
//
// This is the one and only microsite-creation surface. It is launched in two
// shapes:
//   • Account-scoped — opened from an account or contact detail view, where the
//     account (and optionally a target contact) is already known. The caller
//     passes `accountId` (+ `accountName`, and optionally `contactId`).
//   • Standalone — opened from the dashboard or the Pages list, where there is
//     no account context yet. The caller omits `accountId`, and the modal shows
//     an account picker (search your CRM / local accounts) as the first field.
//
// In both shapes the rest of the flow is identical: pick a "use case" (a
// marketing-curated template, optional), choose the audience segment, add any
// instructions / reference URL / CTA destination, then generate. Generation
// always runs through the dedicated account-aware generator
// (POST /sales/accounts/:id/generate-microsite) and then creates personalised
// hotlinks for the account's contacts (or a single link for a target contact).
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles,
  Check,
  Link2,
  Copy,
  ExternalLink,
  Mail,
  Star,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import {
  AccountSearchTypeahead,
  type SelectedAccount,
} from "@/components/sales/AccountSearchTypeahead";

const API_BASE = "/api";

// The audience picker is driven by this tenant's own brand.segments
// (loaded from GET /lp/brand), not a hardcoded enum — so DSO/dental
// vocabulary never leaks into other tenants' microsite generators.
interface PickerSegment {
  id: string;
  name: string;
  description?: string;
}

// A marketing-curated "use case" — surfaced from GET /lp/templates with the
// salesMode + forMicrosite filters, so reps only see templates marketing has
// enabled for microsites (plus the global flagship use cases as OOTB defaults).
interface MarketingTemplate {
  id: number;
  title: string;
  templateLabel: string | null;
  templateDescription: string | null;
}

interface SalesRep {
  id: number;
  name: string;
  content: { chilipiperUrl?: string; calendlyUrl?: string; role?: string };
}

export function GenerateMicrositeModal({
  open,
  onClose,
  accountName,
  accountId,
  contactId,
  contactName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accountName?: string;
  accountId?: string;
  contactId?: number;
  contactName?: string;
  onCreated?: () => void;
}) {
  const [, navigate] = useLocation();
  const { domainContext } = useAuth();

  // When the caller supplies an accountId, the account is fixed; otherwise the
  // modal shows an account picker as the first field (standalone launch).
  const accountProvided = typeof accountId === "string" && accountId.length > 0;
  const [pickedAccount, setPickedAccount] = useState<SelectedAccount | null>(null);
  const [noAccount, setNoAccount] = useState(false);

  const [segments, setSegments] = useState<PickerSegment[]>([]);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  // Optional per-generation reference URL — scraped server-side for voice
  // (markdown), visual style (screenshot), and imagery, then merged with the
  // brand's saved inspiration URLs.
  const [referenceUrl, setReferenceUrl] = useState("");
  const [step, setStep] = useState<"idle" | "generating" | "linking" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [createdPageId, setCreatedPageId] = useState<number | null>(null);
  const [hotlinkCount, setHotlinkCount] = useState(0);
  const [marketingTemplates, setMarketingTemplates] = useState<MarketingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketingTemplate | null>(null);
  const [ctaMode, setCtaMode] = useState<"url" | "chilipiper">("url");
  const [ctaUrl, setCtaUrl] = useState("");
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  // Single personalized link for the targeted contact (contact-page generation)
  const [contactLinkToken, setContactLinkToken] = useState<string | null>(null);
  const [contactLinkCopied, setContactLinkCopied] = useState(false);

  // The account this generation will run against. Fixed when provided by the
  // caller; otherwise resolved from the picker.
  const effectiveAccountName = accountProvided
    ? (accountName ?? "this account")
    : (pickedAccount?.name ?? "this account");
  const accountReady = accountProvided || pickedAccount !== null;

  function getHotlinkBase() {
    const partnerDomain = domainContext?.micrositeDomain;
    if (partnerDomain) return `https://${partnerDomain}`;
    return window.location.origin;
  }

  useEffect(() => {
    if (!open) return;
    Promise.all([
      // Reps see use cases marketing has enabled for microsites (forMicrosite)
      // owned by their own tenant PLUS the global flagship use cases (salesMode).
      // Generic off-brand global starters stay hidden.
      fetch(`${API_BASE}/lp/templates?salesMode=true&forMicrosite=true`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/lp/library/team_member`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/lp/brand`).then(r => r.json()).catch(() => ({})),
    ]).then(([templates, reps, brand]: [MarketingTemplate[], SalesRep[], Record<string, unknown>]) => {
      setMarketingTemplates(Array.isArray(templates) ? templates : []);
      setSalesReps(Array.isArray(reps) ? reps : []);
      const brandConfig = (brand.config ?? brand) as Record<string, unknown>;
      const defaultUrl = (brandConfig.defaultCtaUrl as string | undefined) ?? "";
      setCtaUrl(defaultUrl);
      const segs = Array.isArray(brandConfig.segments) ? (brandConfig.segments as PickerSegment[]) : [];
      setSegments(segs.filter(s => s?.id && s?.name));
    });
  }, [open]);

  function reset() {
    setPickedAccount(null);
    setNoAccount(false);
    setSegmentId(null);
    setSegments([]);
    setPrompt("");
    setReferenceUrl("");
    setStep("idle");
    setErrorMsg("");
    setCreatedPageId(null);
    setHotlinkCount(0);
    setSelectedTemplate(null);
    setCtaMode("url");
    setCtaUrl("");
    setSalesReps([]);
    setSelectedRepId(null);
    setContactLinkToken(null);
    setContactLinkCopied(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Resolve the account to a numeric id we can POST to /accounts/:id/...
  // For a CRM-only pick (no local row yet) we import it first to mint a row.
  async function resolveAccountId(): Promise<string> {
    if (accountProvided) return accountId as string;
    if (!pickedAccount) throw new Error("Pick an account so we can personalise this microsite.");
    if (pickedAccount.numericId !== null) return String(pickedAccount.numericId);
    const importRes = await fetch(`${API_BASE}/sales/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pickedAccount.name,
        ...(pickedAccount.domain ? { domain: pickedAccount.domain } : {}),
        ...(pickedAccount.crmId ? { salesforceId: pickedAccount.crmId } : {}),
      }),
    });
    if (!importRes.ok) throw new Error("Could not import that account from your CRM.");
    const imported = (await importRes.json()) as { id: number };
    return String(imported.id);
  }

  async function handleGenerate() {
    if (!segmentId) return;
    setStep("generating");
    setErrorMsg("");
    try {
      const resolvedAccountId = await resolveAccountId();
      let pageId: number;

      // Build ctaOverride from the CTA destination selection
      let ctaOverride: { mode: "url" | "chilipiper"; url: string } | undefined;
      if (ctaMode === "chilipiper" && selectedRepId !== null) {
        const rep = salesReps.find(r => r.id === selectedRepId);
        const repUrl = rep?.content?.chilipiperUrl || rep?.content?.calendlyUrl || "";
        if (repUrl) ctaOverride = { mode: "chilipiper", url: repUrl };
      } else if (ctaMode === "url" && ctaUrl.trim()) {
        ctaOverride = { mode: "url", url: ctaUrl.trim() };
      }

      // Always AI-generate — if a use case (template) is selected, its block
      // layout is passed as a fixed constraint so AI customises the copy while
      // preserving the structure.
      const genRes = await fetch(`${API_BASE}/sales/accounts/${resolvedAccountId}/generate-microsite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId,
          audience: segmentId,
          prompt: prompt.trim() || undefined,
          ...(referenceUrl.trim() ? { referenceUrl: referenceUrl.trim() } : {}),
          ...(contactId != null ? { contactId } : {}),
          ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
          ...(ctaOverride ? { ctaOverride } : {}),
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error ?? "Generation failed");
      }
      const { page } = await genRes.json();
      pageId = page.id;

      setCreatedPageId(pageId);

      setStep("linking");
      if (contactId != null) {
        // Contact-page generation: create (or reuse) a single personalized
        // link for the targeted contact, surfaced immediately on success.
        const linkRes = await fetch(`${API_BASE}/sales/hotlinks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId, pageId }),
        });
        if (!linkRes.ok) throw new Error("Failed to create personalized link");
        const hotlink = await linkRes.json();
        setContactLinkToken(hotlink.token ?? null);
        setHotlinkCount(hotlink.token ? 1 : 0);
      } else {
        // Account-page generation: bulk-create hotlinks for all contacts with email
        const linkRes = await fetch(`${API_BASE}/sales/accounts/${resolvedAccountId}/microsites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        if (!linkRes.ok) throw new Error("Failed to create hotlinks");
        const { totalCount } = await linkRes.json();
        setHotlinkCount(totalCount);
      }

      setStep("done");
      onCreated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "generating" || step === "linking";

  const selectedRep = selectedRepId !== null ? salesReps.find(r => r.id === selectedRepId) : null;
  const selectedRepHasUrl = selectedRep
    ? !!(selectedRep.content?.chilipiperUrl || selectedRep.content?.calendlyUrl)
    : false;
  const ctaValid =
    ctaMode === "url"
      ? true
      : selectedRepId !== null && selectedRepHasUrl;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) handleClose(); }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Microsite
          </DialogTitle>
        </DialogHeader>

        {step === "done" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Microsite created!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {contactId != null
                  ? (contactLinkToken
                      ? `Personalised link ready${contactName ? ` for ${contactName}` : ""}.`
                      : "Microsite created — add an email to this contact to generate a personalised link.")
                  : (hotlinkCount > 0
                      ? `${hotlinkCount} personalised hotlink${hotlinkCount !== 1 ? "s" : ""} created for contacts with email.`
                      : "No contacts with email found — add contacts to generate hotlinks.")}
              </p>
            </div>

            {/* Single personalized link — contact-page generation */}
            {contactId != null && contactLinkToken && (
              <div className="w-full flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <Link2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="flex-1 text-xs text-foreground truncate text-left font-mono">
                  {getHotlinkBase()}/p/{contactLinkToken}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${getHotlinkBase()}/p/${contactLinkToken}`).then(() => {
                      setContactLinkCopied(true);
                      setTimeout(() => setContactLinkCopied(false), 2000);
                    });
                  }}
                >
                  {contactLinkCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {contactLinkCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}

            {/* Workflow nudge — next steps */}
            <div className="w-full rounded-lg bg-muted/40 border border-border/50 px-4 py-3 text-left">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Next steps</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">1</div>
                  <span className="text-xs text-foreground">Preview & edit in the Builder</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">2</div>
                  <span className="text-xs text-foreground">Draft outreach emails with personalised links</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">3</div>
                  <span className="text-xs text-foreground">Track engagement in Activity</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              {createdPageId && (
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => { handleClose(); navigate(`/builder/${createdPageId}`); }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Builder
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => { handleClose(); navigate("/sales/draft-email"); }}
              >
                <Mail className="w-3.5 h-3.5" />
                Draft Email
              </Button>
            </div>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => setStep("idle")}>Try Again</Button>
            </div>
          </div>
        ) : (
          <>
          <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Account picker — only when the caller didn't fix an account. */}
            {!accountProvided && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">
                  Who is this for? <span className="text-red-500">*</span>
                </Label>
                <AccountSearchTypeahead
                  selected={pickedAccount}
                  onSelect={setPickedAccount}
                  noAccount={noAccount}
                  onNoAccount={setNoAccount}
                />
                {noAccount && (
                  <p className="text-[11px] text-amber-600">
                    Pick an account — microsites are personalised for a specific account's contacts.
                  </p>
                )}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {contactId != null ? (
                <>AI will create a personalised landing page for <strong>{effectiveAccountName}</strong> and
                generate a single personalised link{contactName ? <> for <strong>{contactName}</strong></> : <> for this contact</>}.</>
              ) : (
                <>AI will create a personalised landing page for <strong>{effectiveAccountName}</strong> and
                generate unique hotlinks for each contact with an email address.</>
              )}
            </div>

            {/* Use case (optional starting point) — marketing-curated templates */}
            {marketingTemplates.length > 0 && (() => {
              const selectedLabel = selectedTemplate
                ? (selectedTemplate.templateLabel ?? selectedTemplate.title)
                : null;
              return (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    Select use case <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <select
                    value={selectedTemplate?.id ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSelectedTemplate(id !== null ? marketingTemplates.find(t => t.id === id) ?? null : null);
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                  >
                    <option value="">No specific use case — AI generates from scratch</option>
                    {marketingTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateLabel ?? t.title}
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      <strong>{selectedLabel}</strong> selected — AI will use this layout and personalise all copy for {effectiveAccountName}.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Who is this page for? <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-col gap-2">
                {segments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-left">
                    <p className="text-sm font-medium text-foreground">No audience segments yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add audience segments in Brand Settings to target this page.
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-primary hover:underline"
                      onClick={() => { handleClose(); navigate("/brand"); }}
                    >
                      Open Brand Settings →
                    </button>
                  </div>
                ) : (
                  segments.map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setSegmentId(seg.id)}
                      className={[
                        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-primary/30",
                        segmentId === seg.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-primary/40",
                        busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <span className="text-sm font-medium leading-tight">{seg.name}</span>
                      {seg.description ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">{seg.description}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-prompt" className="text-xs font-medium">
                Additional instructions <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="ms-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Focus on their enterprise expansion, emphasise ROI and onboarding speed…"
                rows={2}
                disabled={busy}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-reference-url" className="text-xs font-medium">
                Reference URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <input
                id="ms-reference-url"
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://example.com — a page to draw layout & style inspiration from"
                disabled={busy}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                We'll study its layout, tone, and imagery for inspiration — your brand voice and guidelines always win.
              </p>
            </div>

            {/* CTA Destination */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">CTA destination</Label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCtaMode("url")}
                  className={[
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30",
                    ctaMode === "url"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/40",
                    busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium leading-tight">URL</span>
                  <span className="text-xs text-muted-foreground">Send all CTAs to a specific link</span>
                </button>
                {ctaMode === "url" && (
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={e => setCtaUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={busy}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCtaMode("chilipiper")}
                  className={[
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30",
                    ctaMode === "chilipiper"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/40",
                    busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium leading-tight">Book with a rep (Chili Piper)</span>
                  <span className="text-xs text-muted-foreground">Route all CTAs to a rep's booking link</span>
                </button>
                {ctaMode === "chilipiper" && (
                  <>
                    <select
                      value={selectedRepId ?? ""}
                      onChange={e => setSelectedRepId(e.target.value ? Number(e.target.value) : null)}
                      disabled={busy}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    >
                      <option value="">Select a rep…</option>
                      {salesReps.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.name}{rep.content?.role ? ` — ${rep.content.role}` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedRepId !== null && !selectedRepHasUrl && (
                      <p className="text-xs text-amber-600">This rep has no Chili Piper URL saved. Select another rep or add their URL in the Sales Reps library.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {step === "generating"
                  ? "Generating personalised copy…"
                  : contactId != null ? "Creating personalised link…" : "Creating contact hotlinks…"}
              </div>
            )}
          </div>

          {/* Pinned action row — always visible outside the scroll area */}
          <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-border/50">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1 gap-1.5" onClick={handleGenerate} disabled={busy || !accountReady || !segmentId || !ctaValid}>
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Generate
            </Button>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
