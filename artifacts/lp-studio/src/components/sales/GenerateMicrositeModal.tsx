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
  Loader2,
  Search,
  Users,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  AccountSearchTypeahead,
  type SelectedAccount,
} from "@/components/sales/AccountSearchTypeahead";
import { MicrositeGenerationLive } from "@/components/sales/MicrositeGenerationLive";

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

// A contact on the target account, used to hand-pick who gets a personalised
// hotlink. Personalised links are opt-in (off by default) — the rep ticks the
// checkbox and selects recipients, with search + job-level filtering.
interface AccountContact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  titleLevel: string | null;
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
  const [step, setStep] = useState<"idle" | "generating" | "live" | "done" | "error">("idle");
  // June 2026 — live "watch your microsite build" view. Non-null while the modal
  // content is swapped to the streaming preview (the dialog expands).
  const [liveConfig, setLiveConfig] = useState<{
    accountId: string;
    body: Record<string, unknown>;
  } | null>(null);
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
  // Personalised hotlinks for account-page generation are OPT-IN. Off by
  // default; when enabled, the rep hand-picks recipients from the account's
  // contacts (searchable + filterable by job level).
  const [generateHotlinks, setGenerateHotlinks] = useState(false);
  const [accountContacts, setAccountContacts] = useState<AccountContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // The account this generation will run against. Fixed when provided by the
  // caller; otherwise resolved from the picker.
  const effectiveAccountName = accountProvided
    ? (accountName ?? "this account")
    : (pickedAccount?.name ?? "this account");
  const accountReady = accountProvided || pickedAccount !== null;

  // The numeric account id we can pull contacts from for the recipient picker.
  // CRM-only picks that haven't been imported yet have no local contacts, so the
  // picker stays empty until the account exists locally.
  const contactsAccountId = accountProvided
    ? (accountId as string)
    : pickedAccount?.numericId != null
      ? String(pickedAccount.numericId)
      : null;

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

  // Load the account's contacts for the recipient picker the first time the rep
  // opts into generating personalised links (account-page generation only). New
  // contacts with an email default to selected so opting in still "just works",
  // but the rep can trim the list or filter it down.
  useEffect(() => {
    if (!open || contactId != null || !generateHotlinks) return;
    if (!contactsAccountId) {
      // CRM-only pick with no local contacts yet — drop any stale selection so
      // the Generate gate can't be satisfied by recipients from another account.
      setAccountContacts([]);
      setSelectedContactIds(new Set());
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    fetch(`${API_BASE}/sales/accounts/${contactsAccountId}/contacts`)
      .then(r => r.json())
      .then((rows: AccountContact[]) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setAccountContacts(list);
        setSelectedContactIds(
          new Set(list.filter(c => c.email && c.email.trim() !== "").map(c => c.id)),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAccountContacts([]);
        setSelectedContactIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, generateHotlinks, contactsAccountId, contactId]);

  function reset() {
    setPickedAccount(null);
    setNoAccount(false);
    setSegmentId(null);
    setSegments([]);
    setPrompt("");
    setReferenceUrl("");
    setStep("idle");
    setLiveConfig(null);
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
    setGenerateHotlinks(false);
    setAccountContacts([]);
    setContactsLoading(false);
    setSelectedContactIds(new Set());
    setContactSearch("");
    setLevelFilter("all");
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

  // Build the generation request body — identical for the streaming live view
  // and the live view's own non-streaming fallback. If a use case (template) is
  // selected, its block layout is passed as a fixed constraint so AI customises
  // the copy while preserving the structure.
  function buildGenerationBody(): Record<string, unknown> {
    let ctaOverride: { mode: "url" | "chilipiper"; url: string } | undefined;
    if (ctaMode === "chilipiper" && selectedRepId !== null) {
      const rep = salesReps.find(r => r.id === selectedRepId);
      const repUrl = rep?.content?.chilipiperUrl || rep?.content?.calendlyUrl || "";
      if (repUrl) ctaOverride = { mode: "chilipiper", url: repUrl };
    } else if (ctaMode === "url" && ctaUrl.trim()) {
      ctaOverride = { mode: "url", url: ctaUrl.trim() };
    }
    return {
      segmentId,
      audience: segmentId,
      prompt: prompt.trim() || undefined,
      ...(referenceUrl.trim() ? { referenceUrl: referenceUrl.trim() } : {}),
      ...(contactId != null ? { contactId } : {}),
      ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
      ...(ctaOverride ? { ctaOverride } : {}),
    };
  }

  // Runs after the page has been generated (the live view created it server-side
  // and hands back its id): mint the personalised hotlinks, then show the
  // success screen. Errors flip the modal to its own error step.
  async function finishAfterGenerate(resolvedAccountId: string, pageId: number) {
    try {
      setCreatedPageId(pageId);

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
      } else if (generateHotlinks && selectedContactIds.size > 0) {
        // Account-page generation: personalised links are opt-in — only create
        // them for the contacts the rep explicitly selected.
        const linkRes = await fetch(`${API_BASE}/sales/accounts/${resolvedAccountId}/microsites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, contactIds: Array.from(selectedContactIds) }),
        });
        if (!linkRes.ok) throw new Error("Failed to create hotlinks");
        const { totalCount } = await linkRes.json();
        setHotlinkCount(totalCount);
      } else {
        // No personalised links requested — the microsite is created on its own.
        setHotlinkCount(0);
      }

      setLiveConfig(null);
      setStep("done");
      onCreated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setLiveConfig(null);
      setStep("error");
    }
  }

  // Resolve (or import) the account, then swap to the live build view, which
  // streams the generation and renders the stage rail + scaled preview.
  async function handleGenerate() {
    if (!segmentId) return;
    setStep("generating");
    setErrorMsg("");
    try {
      const resolvedAccountId = await resolveAccountId();
      setLiveConfig({ accountId: resolvedAccountId, body: buildGenerationBody() });
      setStep("live");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "generating" || step === "live";

  // Distinct job levels present on this account's contacts, for the filter.
  const contactLevels = Array.from(
    new Set(
      accountContacts
        .map(c => (c.titleLevel ?? "").trim())
        .filter(l => l.length > 0),
    ),
  ).sort();

  // Contacts after the search + job-level filters are applied.
  const filteredContacts = accountContacts.filter(c => {
    if (levelFilter !== "all" && (c.titleLevel ?? "").trim() !== levelFilter) return false;
    const q = contactSearch.trim().toLowerCase();
    if (q) {
      const hay = `${c.firstName ?? ""} ${c.lastName ?? ""} ${c.email ?? ""} ${c.title ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const contactDisplayName = (c: AccountContact) =>
    `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "Unnamed contact";

  function toggleContact(id: number) {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select / clear all *filtered* contacts that have an email (only emailed
  // contacts can receive a personalised link).
  const filteredEmailIds = filteredContacts
    .filter(c => c.email && c.email.trim() !== "")
    .map(c => c.id);
  const allFilteredSelected =
    filteredEmailIds.length > 0 && filteredEmailIds.every(id => selectedContactIds.has(id));

  function toggleSelectAllFiltered() {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredEmailIds) next.delete(id);
      } else {
        for (const id of filteredEmailIds) next.add(id);
      }
      return next;
    });
  }

  // Block Generate only when links are requested but nobody is selected.
  const hotlinkSelectionInvalid =
    contactId == null && generateHotlinks && selectedContactIds.size === 0;

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
      <DialogContent
        className={
          liveConfig
            ? "max-w-6xl w-[calc(100%-2rem)] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden"
            : "sm:max-w-lg flex flex-col max-h-[90vh]"
        }
      >
        {liveConfig ? (
          <>
            <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0 text-left">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden />
                Building your microsite
              </DialogTitle>
            </DialogHeader>
            <MicrositeGenerationLive
              accountId={liveConfig.accountId}
              body={liveConfig.body}
              accountLabel={effectiveAccountName}
              onResult={(pageId) => {
                void finishAfterGenerate(liveConfig.accountId, pageId);
              }}
              onCancel={() => {
                setLiveConfig(null);
                setStep("idle");
              }}
            />
          </>
        ) : (
          <>
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="font-serif text-2xl font-normal tracking-tight text-foreground">
            Generate a microsite
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
                  : (generateHotlinks
                      ? (hotlinkCount > 0
                          ? `${hotlinkCount} personalised hotlink${hotlinkCount !== 1 ? "s" : ""} created for the selected contacts.`
                          : "No personalised links were created — the selected contacts need an email address.")
                      : "No personalised links were generated. You can create them anytime from the account.")}
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
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep("idle")}>Try again</Button>
            </div>
          </div>
        ) : (
          <>
          <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Account picker — only when the caller didn't fix an account. */}
            {!accountProvided && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</Label>
                <AccountSearchTypeahead
                  selected={pickedAccount}
                  onSelect={setPickedAccount}
                  noAccount={noAccount}
                  onNoAccount={setNoAccount}
                />
                {noAccount && (
                  <p className="text-[11px] text-amber-600">
                    Pick an account to personalise this microsite.
                  </p>
                )}
              </div>
            )}

            {/* Use case (optional starting point) — marketing-curated templates */}
            {marketingTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Use case</Label>
                <div className="relative">
                  <select
                    value={selectedTemplate?.id ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSelectedTemplate(id !== null ? marketingTemplates.find(t => t.id === id) ?? null : null);
                    }}
                    aria-label="Use case"
                    className="w-full appearance-none bg-transparent border-b border-input py-2 pr-6 text-[15px] focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
                  >
                    <option value="">No use case</option>
                    {marketingTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateLabel ?? t.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Audience</Label>
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
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition-all focus:outline-none",
                        segmentId === seg.id
                          ? "border-foreground ring-1 ring-foreground bg-muted/40"
                          : "border-input hover:border-foreground/40 hover:bg-muted/30",
                        busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      <span className="font-medium text-[13px] text-foreground leading-tight">{seg.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-prompt" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Instructions
              </Label>
              <textarea
                id="ms-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={busy}
                className="w-full bg-muted/40 border border-input rounded-xl p-4 text-[15px] focus:outline-none focus:border-foreground focus:bg-background transition-colors resize-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-reference-url" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reference URL
              </Label>
              <div className="flex items-center border-b border-input py-1.5 focus-within:border-foreground transition-colors">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
                <input
                  id="ms-reference-url"
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  disabled={busy}
                  className="w-full bg-transparent focus:outline-none text-sm font-mono disabled:opacity-50"
                />
              </div>
            </div>

            {/* Call to action */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Call to action</Label>
              <div className="flex p-1 bg-muted rounded-lg">
                {([
                  { mode: "url", label: "Link" },
                  { mode: "chilipiper", label: "Book a rep" },
                ] as { mode: "url" | "chilipiper"; label: string }[]).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={busy}
                    onClick={() => setCtaMode(mode)}
                    aria-pressed={ctaMode === mode}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-md transition-all disabled:opacity-50",
                      ctaMode === mode
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {ctaMode === "url" ? (
                <input
                  type="url"
                  aria-label="Call to action link"
                  value={ctaUrl}
                  onChange={e => setCtaUrl(e.target.value)}
                  disabled={busy}
                  className="w-full bg-transparent border-b border-input py-2 text-[15px] focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
                />
              ) : (
                <>
                  <div className="relative">
                    <select
                      value={selectedRepId ?? ""}
                      onChange={e => setSelectedRepId(e.target.value ? Number(e.target.value) : null)}
                      disabled={busy}
                      aria-label="Sales rep"
                      className="w-full appearance-none bg-transparent border-b border-input py-2 pr-6 text-[15px] focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
                    >
                      <option value="">Select a rep…</option>
                      {salesReps.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.name}{rep.content?.role ? ` — ${rep.content.role}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
                  {selectedRepId !== null && !selectedRepHasUrl && (
                    <p className="text-[11px] text-amber-600">This rep has no booking link saved.</p>
                  )}
                </>
              )}
            </div>

            {/* Personalised links — opt-in recipient picker (account-page only) */}
            {contactId == null && (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={generateHotlinks}
                    disabled={busy}
                    onChange={(e) => setGenerateHotlinks(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium leading-tight flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                    Personalised links for contacts
                  </span>
                </label>

                {generateHotlinks && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    {!contactsAccountId ? (
                      <p className="text-xs text-amber-600">
                        Pick an existing account to choose recipients. We'll create links after the
                        account is imported.
                      </p>
                    ) : contactsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        Loading contacts…
                      </div>
                    ) : accountContacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No contacts found for this account. Add contacts with email addresses to
                        generate personalised links.
                      </p>
                    ) : (
                      <>
                        {/* Search + job-level filter */}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              aria-label="Search contacts"
                              value={contactSearch}
                              disabled={busy}
                              onChange={(e) => setContactSearch(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            />
                          </div>
                          {contactLevels.length > 0 && (
                            <select
                              value={levelFilter}
                              disabled={busy}
                              onChange={(e) => setLevelFilter(e.target.value)}
                              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            >
                              <option value="all">All job levels</option>
                              {contactLevels.map((lvl) => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Select-all + count */}
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            disabled={busy || filteredEmailIds.length === 0}
                            onClick={toggleSelectAllFiltered}
                            className="font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                          >
                            {allFilteredSelected ? "Clear all" : "Select all"}
                            {contactSearch.trim() || levelFilter !== "all" ? " (filtered)" : ""}
                          </button>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {selectedContactIds.size} selected
                          </span>
                        </div>

                        {/* Contact list */}
                        <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 -mx-1 px-1">
                          {filteredContacts.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2 text-center">
                              No contacts match your search.
                            </p>
                          ) : (
                            filteredContacts.map((c) => {
                              const hasEmail = !!(c.email && c.email.trim() !== "");
                              return (
                                <label
                                  key={c.id}
                                  className={[
                                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
                                    hasEmail && !busy ? "cursor-pointer hover:bg-muted/60" : "opacity-60 cursor-not-allowed",
                                  ].join(" ")}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedContactIds.has(c.id)}
                                    disabled={busy || !hasEmail}
                                    onChange={() => toggleContact(c.id)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 flex-shrink-0 disabled:opacity-50"
                                  />
                                  <span className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium leading-tight truncate">
                                      {contactDisplayName(c)}
                                      {c.titleLevel ? (
                                        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{c.titleLevel}</span>
                                      ) : null}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {hasEmail ? c.email : "No email — can't receive a link"}
                                      {c.title ? ` · ${c.title}` : ""}
                                    </span>
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>

                        {hotlinkSelectionInvalid && (
                          <p className="text-[11px] text-amber-600">
                            Select at least one contact, or turn off personalised links to skip them.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

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
          <div className="flex justify-end gap-2 flex-shrink-0 pt-3 border-t border-border/50">
            <Button variant="ghost" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={handleGenerate} disabled={busy || !accountReady || !segmentId || !ctaValid || hotlinkSelectionInvalid}>
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate microsite
            </Button>
          </div>
          </>
        )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
