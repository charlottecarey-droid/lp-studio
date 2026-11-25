import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, Download, Gift, Loader2, Upload, AlertCircle, ExternalLink } from "lucide-react";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { GiftPagePreview } from "@/components/sales/GiftPagePreview";
import { GiftAllocationCard } from "@/components/sales/GiftAllocationCard";
import { GiftExchangeSection } from "@/components/sales/GiftExchangeSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, resolveEffectiveMicrositeDomain } from "@/context/AuthContext";
import { getLpPageUrl, cn } from "@/lib/utils";
import { ComposeButtons, useEmailPreviewCopy, useMailClient, useOutreachTemplates } from "@/components/sales/EmailPreviewModal";
import { ImagePicker } from "@/components/ImagePicker";
import { mergeTeamMembers, teamMemberCalendar, type TeamMember } from "@/pages/builder/property-panels/GiftPanels";
import {
  GIFT_TIERS, MAX_PICKED_GIFTS, planRepSave, WIZARD_COLUMNS, allGifts, applyWizardDefaults, buildGiftProps, buildLinksCsv, composeSource, manualRow, majorityTier,
  parseWizardCsv, wizardCsvTemplate,
  type RawLibraryRow, type RepForm, type GiftAudience, type GiftLayoutChoice, type GiftSourceBlocks, type GiftTierId, type WizardRow,
} from "@/lib/gift-wizard";

const API_BASE = "/api";
const STEPS = ["Gifts", "Style", "Note", "Your info", "Recipients"] as const;
const LAST = STEPS.length - 1;

type GiftSources = Partial<Record<GiftTierId, { pageId: number; title: string; blocks: GiftSourceBlocks }>>;
interface BulkResult {
  pagesGenerated: number;
  created: Array<{ index: number; id: number; slug: string; status?: string; url?: string }>;
  failed: Array<{ index: number; slug: string; error: string }>;
  publishSkipped?: string | null;
  repUnmatched?: string[];
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function SalesGifting() {
  const { user, canPublish, domainContext } = useAuth();
  const micrositeDomain = resolveEffectiveMicrositeDomain(domainContext, user);
  const tenantHost = user?.tenantHost ?? null;

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [baseOverride, setBaseOverride] = useState<GiftTierId | null>(null);
  const [sources, setSources] = useState<GiftSources | null>(null);
  const [audience, setAudience] = useState<GiftAudience>("customer");
  const [layout, setLayout] = useState<GiftLayoutChoice>("classic");
  const [envelope, setEnvelope] = useState(false);
  const [note, setNote] = useState("");
  const [reps, setReps] = useState<TeamMember[]>([]);
  const [rawReps, setRawReps] = useState<RawLibraryRow[]>([]);
  const [showMine, setShowMine] = useState(false);
  const [mine, setMine] = useState<RepForm>({ name: "", role: "", email: "", phone: "", calendar: "", photo: "" });
  const [savingMine, setSavingMine] = useState(false);
  const [mineMsg, setMineMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [repEmail, setRepEmail] = useState("");
  const [giftsVersion, setGiftsVersion] = useState(0);
  const [view, setView] = useState<"send" | "trade">("send");
  const [mode, setMode] = useState<"one" | "upload">("one");
  const [one, setOne] = useState<Record<string, string>>({});
  const [uploaded, setUploaded] = useState<WizardRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publish, setPublish] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: BulkResult; rows: WizardRow[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reload the Sales Reps library; `initial` also preselects the signed-in user.
  const loadReps = (initial = false) =>
    fetch(`${API_BASE}/lp/library/team_member`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TeamMember[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setRawReps(list as unknown as RawLibraryRow[]);
        const merged = mergeTeamMembers(list).filter((m) => (m.content?.email ?? "").trim());
        setReps(merged);
        if (initial) {
          const me = merged.find((m) => (m.content?.email ?? "").trim().toLowerCase() === (user?.email ?? "").toLowerCase());
          if (me) setRepEmail((me.content?.email ?? "").trim().toLowerCase());
        }
      })
      .catch(() => setReps([]));

  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/gift-sources`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: GiftSources) => setSources(data && typeof data === "object" ? data : {}))
      .catch(() => setSources({}));
    loadReps(true);
  }, [user?.email]);

  const gifts = useMemo(() => allGifts(sources), [sources]);
  // Until the rep chooses, start from the whole premium set.
  const pickedKeys = picked ?? gifts.filter((g) => g.tier === "premium").map((g) => g.key);
  const pickedGifts = gifts.filter((g) => pickedKeys.includes(g.key));
  const pickedTiers = GIFT_TIERS.filter((t) => pickedGifts.some((g) => g.tier === t.id));
  const baseTier: GiftTierId = baseOverride && pickedTiers.some((t) => t.id === baseOverride) ? baseOverride : majorityTier(pickedGifts);
  const templateId = sources?.[baseTier]?.pageId ?? null;
  const wholeTier = pickedTiers.length === 1 && pickedGifts.length === gifts.filter((g) => g.tier === baseTier).length;
  const togglePick = (key: string) => {
    const cur = pickedKeys;
    if (cur.includes(key)) setPicked(cur.filter((k) => k !== key));
    else if (cur.length < MAX_PICKED_GIFTS) setPicked([...cur, key]);
  };
  const buildPayload = () => buildGiftProps(composeSource(sources ?? {}, pickedGifts, baseTier), { tier: wholeTier ? baseTier : "custom", audience, layout, envelope });
  const rep = reps.find((m) => (m.content?.email ?? "").trim().toLowerCase() === repEmail);
  const oneRow = useMemo(() => manualRow(one), [one]);
  const rows: WizardRow[] = mode === "one" ? (oneRow ? [oneRow] : []) : uploaded;
  const finalRows = useMemo(() => applyWizardDefaults(rows, repEmail, note), [rows, repEmail, note]);
  const canGenerate = !!templateId && pickedGifts.length > 0 && !!repEmail && finalRows.length > 0 && !generating;

  const openMine = () => {
    // Start from the selected rep's record, else from the signed-in user.
    const cur = reps.find((m) => (m.content?.email ?? "").trim().toLowerCase() === (repEmail || (user?.email ?? "").toLowerCase()));
    setMine({
      name: cur?.name ?? user?.name ?? "", role: cur?.content?.role ?? "", email: (cur?.content?.email ?? user?.email ?? "").trim(),
      phone: (cur?.content as { phone?: string } | undefined)?.phone ?? "", calendar: cur ? teamMemberCalendar(cur) : "", photo: cur?.content?.photo ?? "",
    });
    setMineMsg(null); setShowMine(true);
  };

  const saveMine = async () => {
    const plan = planRepSave(rawReps, mine);
    if ("error" in plan) { setMineMsg({ ok: false, text: plan.error }); return; }
    setSavingMine(true); setMineMsg(null);
    try {
      const calls = "create" in plan
        ? [fetch(`${API_BASE}/lp/library/team_member`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: plan.create.name, content: plan.create.content }) })]
        : plan.updates.map((u) => fetch(`${API_BASE}/lp/library/team_member/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: u.name, content: u.content }) }));
      const results = await Promise.all(calls);
      if (results.some((r) => !r.ok)) throw new Error("The library didn't accept that. Try again, or ask an admin.");
      await loadReps();
      setRepEmail(mine.email.trim().toLowerCase());
      setMineMsg({ ok: true, text: "Saved to Sales Reps. You're selected as the sender." });
      setShowMine(false);
    } catch (err) {
      setMineMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setSavingMine(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const out = parseWizardCsv(String(ev.target?.result ?? ""));
        setUploaded(out.rows); setProblems(out.problems); setUploadError(null);
      } catch (err) {
        setUploaded([]); setProblems([]); setUploadError(err instanceof Error ? err.message : "Could not read that file.");
      }
    };
    reader.readAsText(file);
  };

  const generate = async () => {
    if (!canGenerate || !templateId) return;
    setGenerating(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/lp/programmatic/bulk-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, rows: finalRows, gifts: buildPayload(), hotlinks: true, publish: publish && canPublish, autoSuffix: true }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not create the pages.");
      setResult({ data: (await r.json()) as BulkResult, rows: finalRows });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the pages.");
    } finally {
      setGenerating(false);
    }
  };

  // Hotlink (/p/<token>) when the server made one, so the URL never carries a name.
  const linkOf = (c: { slug: string; url?: string }) => c.url ?? getLpPageUrl(c.slug, micrositeDomain, tenantHost);

  // Email preview cards: captured one page at a time in the background (the
  // server renders each in a headless browser, ~10s apiece) so the CSV and the
  // per-row copy button have images ready. Failures just leave that row blank.
  // Keyed by page ids so Publish all (which only flips statuses) doesn't restart the captures.
  const createdKey = result?.data.created.map((c) => c.id).join(",") ?? "";
  const [previews, setPreviews] = useState<Record<number, { imageUrl: string; linkLabel: string }>>({});
  const [previewsDone, setPreviewsDone] = useState(0);
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setPreviews({}); setPreviewsDone(0);
    (async () => {
      for (const c of result.data.created) {
        if (cancelled) return;
        try {
          const r = await fetch(`${API_BASE}/lp/pages/${c.id}/email-preview`, { method: "POST" });
          if (r.ok) {
            const d = (await r.json()) as { imageUrl?: string; linkLabel?: string | null };
            if (d.imageUrl && !cancelled) setPreviews((p) => ({ ...p, [c.id]: { imageUrl: new URL(d.imageUrl!, window.location.origin).toString(), linkLabel: (d.linkLabel ?? "").trim() } }));
          }
        } catch { /* leave this row without a preview */ }
        if (!cancelled) setPreviewsDone((n) => n + 1);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdKey]);

  // Same copy + "open a draft" behaviour (and icons) as the Pages view: the
  // card goes on the clipboard and Gmail (or the workspace's mail app) opens
  // with the recipient, subject and link filled in.
  const outreach = useOutreachTemplates(true);
  const { busyKey, copiedKey, copyPreview } = useEmailPreviewCopy(outreach);
  const GIFT_EMAIL_TITLE = "A holiday gift for you";
  const mailClient = useMailClient();

  const linksCsv = () => {
    if (!result) return;
    download("gift-page-links.csv", buildLinksCsv(result.data.created.map((c) => ({
      variables: result.rows[c.index]?.variables ?? {},
      status: c.status ?? "draft",
      link: linkOf(c),
      previewImage: previews[c.id]?.imageUrl ?? "",
      linkLabel: previews[c.id]?.linkLabel ?? "",
    }))));
  };

  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const publishAll = async () => {
    if (!result) return;
    const ids = result.data.created.filter((c) => c.status !== "published").map((c) => c.id);
    if (ids.length === 0) return;
    setPublishing(true); setPublishMsg(null);
    try {
      const r = await fetch(`${API_BASE}/lp/programmatic/publish-pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageIds: ids }) });
      const body = (await r.json().catch(() => ({}))) as { published?: number[]; error?: string };
      if (!r.ok) throw new Error(body.error ?? "Could not publish.");
      const done = new Set(body.published ?? []);
      setResult({ ...result, data: { ...result.data, created: result.data.created.map((c) => (done.has(c.id) ? { ...c, status: "published" } : c)) } });
      setPublishMsg(`Published ${done.size} page${done.size === 1 ? "" : "s"}.`);
    } catch (err) {
      setPublishMsg(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  };

  const reset = () => { setResult(null); setStep(0); setOne({}); setUploaded([]); setProblems([]); setNote(""); };

  /* ── Results ─────────────────────────────────────────────────────────── */
  if (result) {
    const { data } = result;
    return (
      <SalesLayout>
        <div className="mx-auto w-full max-w-3xl space-y-6 py-4 sm:py-8">
          <SalesPageHeader title="Your gift pages are ready" description={`${data.pagesGenerated} page${data.pagesGenerated === 1 ? "" : "s"} created${data.failed.length ? `, ${data.failed.length} failed` : ""}.`} actions={<>{canPublish && data.created.some((c) => c.status !== "published") && <Button onClick={publishAll} disabled={publishing} className="gap-1.5">{publishing && <Loader2 className="w-4 h-4 animate-spin" />}Publish all</Button>}<Button variant="outline" onClick={linksCsv} className="gap-1.5"><Download className="w-4 h-4" />Download links (CSV)</Button><Button onClick={reset}>Start another</Button></>} />
          {publishMsg && <Notice tone="blue">{publishMsg}</Notice>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Email preview</span> copies a clickable picture of the page. The send icon does the same and opens a draft to the recipient in {mailClient === "gmail" ? "Gmail" : "your email app"}: click into the message and paste (⌘V). The picture opens their private link.
            The CSV adds <span className="font-mono">preview_image</span> and <span className="font-mono">email_html</span> columns for sequence tools that take an HTML field.
            {previewsDone < data.created.length ? ` Preparing previews: ${previewsDone} of ${data.created.length} (the CSV fills in as they finish).` : ""}
          </p>
          {data.publishSkipped && <Notice tone="amber">{data.publishSkipped} The pages were saved as drafts.</Notice>}
          {(data.repUnmatched?.length ?? 0) > 0 && <Notice tone="amber">No Sales Reps match for {data.repUnmatched!.join(", ")}. Those pages keep the template's rep. Fix the rep in Content Library → Sales Reps and run it again.</Notice>}
          {data.created.some((c) => c.url) && <Notice tone="blue">These are private hotlinks: the URL has no names in it. Each recipient is added as a contact, and views show up under Sales → Pages and Activity.</Notice>}
          {data.created.some((c) => c.status !== "published") && <Notice tone="blue">These are drafts, so the links show "not found" until they're published. {canPublish ? "Use Publish all, or open each in the builder to review first." : "Ask someone with publish access, or submit them for review in the builder."}</Notice>}
          <Card className="divide-y">
            {data.created.map((c) => {
              const v = result.rows[c.index]?.variables ?? {};
              return (
                <div key={c.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{[v.first_name, v.last_name].filter(Boolean).join(" ") || c.slug}{v.company ? ` · ${v.company}` : ""}</div>
                    <div className="text-xs text-muted-foreground truncate">{linkOf(c)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{c.status ?? "draft"}</span>
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(linkOf(c))}>Copy link</Button>
                    <Button size="sm" variant="outline" disabled={busyKey !== null} title="Copy a clickable preview of the page to paste into an email" onClick={() => void copyPreview({ key: `p${c.id}`, pageId: c.id, pageUrl: linkOf(c), title: GIFT_EMAIL_TITLE })} className="gap-1.5">
                      {busyKey === `p${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : copiedKey === `p${c.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === `p${c.id}` ? "Copied" : "Email preview"}
                    </Button>
                    <ComposeButtons
                      disabled={busyKey !== null}
                      name={[v.first_name, v.last_name].filter(Boolean).join(" ")}
                      email={v.email}
                      onCompose={(target) => void copyPreview({ key: `p${c.id}`, pageId: c.id, pageUrl: linkOf(c), title: GIFT_EMAIL_TITLE, compose: { target, to: v.email, firstName: v.first_name } })}
                    />
                    <a href={linkOf(c)} target="_blank" rel="noreferrer" aria-label="Open page"><ExternalLink className="w-4 h-4 text-muted-foreground" /></a>
                  </div>
                </div>
              );
            })}
            {data.failed.map((f) => <div key={`${f.index}-${f.slug}`} className="px-4 py-3 text-sm text-red-700">{f.slug || `Row ${f.index + 1}`}: {f.error}</div>)}
          </Card>
        </div>
      </SalesLayout>
    );
  }

  /* ── Wizard ──────────────────────────────────────────────────────────── */
  return (
    <SalesLayout>
      <div className="mx-auto w-full max-w-4xl space-y-10 py-4 sm:py-8">
        <header className="space-y-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">Holiday gifting</div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Send something worth opening</h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Choose the gifts, add your note and your details, and we'll build a personal gift page for every recipient.</p>
        </header>
        <div className="space-y-4">
          <div role="tablist" aria-label="Holiday gifting" className="mx-auto flex w-fit rounded-full border p-1 text-sm">
            {([["send", "Send gifts"], ["trade", "Trade gifts"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={cn("rounded-full px-4 py-1.5 transition-colors", view === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <GiftAllocationCard version={giftsVersion} onTrade={view === "send" ? () => setView("trade") : undefined} />
        </div>

        {view === "trade" && <GiftExchangeSection onChange={() => setGiftsVersion((v) => v + 1)} />}

        {view === "send" && (<>
        <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button type="button" onClick={() => i <= step && setStep(i)} className={cn("flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 transition-colors", i === step ? "bg-foreground text-background" : i < step ? "text-foreground hover:bg-muted" : "text-muted-foreground cursor-default")}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", i === step ? "bg-background/20" : i < step ? "bg-foreground text-background" : "border")}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                {label}
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-5 bg-border sm:w-8" />}
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_30px_70px_-40px_rgba(0,0,0,0.25)] sm:p-10">
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">{custom ? "Build your own collection" : "Choose a gift set"}</h2>
              <p className="mx-auto max-w-lg text-sm text-muted-foreground">{custom ? `Pick up to ${MAX_PICKED_GIFTS} gifts, from any set. Each recipient chooses one on their page.` : "Each recipient chooses one gift from the set on their page."}</p>
            </div>
            {sources === null ? <div className="text-sm text-muted-foreground">Loading gifts…</div> : gifts.length === 0 ? (
              <Notice tone="amber">The holiday gift pages (holiday-gifts-premium, -mid, -swag) aren't set up in this workspace.</Notice>
            ) : custom ? (
              <div className="space-y-5">
                <button type="button" onClick={() => setCustom(false)} className="mx-auto block text-sm underline text-muted-foreground hover:text-foreground">← Back to the three sets</button>
                {GIFT_TIERS.map((t) => {
                  const tierGifts = gifts.filter((g) => g.tier === t.id);
                  if (tierGifts.length === 0) return null;
                  const allOn = tierGifts.every((g) => pickedKeys.includes(g.key));
                  return (
                    <div key={t.id} className="grid gap-5 md:grid-cols-[200px_1fr]">
                      <div className="space-y-2">
                        <GiftPagePreview heroProps={sources?.[t.id]?.blocks["gift-hero"]} />
                        <div className="text-sm font-semibold">{t.label} page</div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{t.blurb}</p>
                        <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setPicked(allOn ? pickedKeys.filter((k) => !tierGifts.some((g) => g.key === k)) : [...new Set([...pickedKeys, ...tierGifts.map((g) => g.key)])].slice(0, MAX_PICKED_GIFTS))}>{allOn ? "Clear" : "Select all"}</button>
                      </div>
                      <div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tierGifts.map((g) => {
                          const on = pickedKeys.includes(g.key);
                          const full = !on && pickedKeys.length >= MAX_PICKED_GIFTS;
                          return (
                            <button key={g.key} type="button" disabled={full} onClick={() => togglePick(g.key)} className={cn("relative text-left rounded-xl border p-3 transition-colors disabled:opacity-40", on ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40")}>
                              <span className={cn("absolute right-2 top-2 w-5 h-5 rounded-full border flex items-center justify-center", on ? "bg-foreground text-background border-foreground" : "bg-background")}>{on && <Check className="w-3 h-3" />}</span>
                              <div className="h-24 mb-2 rounded-md bg-muted/50 flex items-center justify-center overflow-hidden">
                                {g.imageUrl ? <img src={g.imageUrl} alt="" className="max-h-full max-w-full object-contain" /> : <Gift className="w-6 h-6 text-muted-foreground" />}
                              </div>
                              <div className="text-sm font-medium leading-snug">{g.name}</div>
                              {g.caption && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.caption}</p>}
                            </button>
                          );
                        })}
                      </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{pickedGifts.length} selected{pickedGifts.length >= MAX_PICKED_GIFTS ? " (the most one page shows)" : ""}</span>
                  {pickedTiers.length > 1 && (
                    <label className="flex items-center gap-2">Page look based on
                      <Select value={baseTier} onValueChange={(v) => setBaseOverride(v as GiftTierId)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{pickedTiers.map((t) => <SelectItem key={t.id} value={t.id}>{t.label} page</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-5 md:grid-cols-3">
                  {GIFT_TIERS.map((t) => {
                    const tierGifts = gifts.filter((g) => g.tier === t.id);
                    if (tierGifts.length === 0) return null;
                    const on = pickedKeys.length === tierGifts.length && tierGifts.every((g) => pickedKeys.includes(g.key));
                    return (
                      <button key={t.id} type="button" onClick={() => { setPicked(tierGifts.map((g) => g.key)); setBaseOverride(null); }} className={cn("flex flex-col rounded-2xl border p-3 text-left transition-all", on ? "border-foreground ring-1 ring-foreground shadow-lg" : "hover:border-foreground/40 hover:shadow-md")}>
                        <GiftPagePreview heroProps={sources?.[t.id]?.blocks["gift-hero"]} />
                        <div className="flex items-center justify-between px-1 pt-3">
                          <div className="font-semibold">{t.label}</div>
                          {on && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-3 w-3" /></span>}
                        </div>
                        <p className="px-1 text-xs text-muted-foreground">{t.blurb}</p>
                        <ul className="mt-2 space-y-0.5 px-1 pb-1 text-xs">{tierGifts.map((g) => <li key={g.key}>• {g.name}</li>)}</ul>
                      </button>
                    );
                  })}
                </div>
                <div className="text-center">
                  <Button type="button" variant="outline" onClick={() => setCustom(true)} className="gap-2 rounded-full px-6"><Gift className="h-4 w-4" />Build your own collection</Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Gifts, photos and copy come from the designed gift pages, so editing those in the builder changes what's offered here. A size picker appears automatically when a swag item is selected.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <h2 className="text-center text-2xl font-semibold tracking-tight">How should the page look and read?</h2>
            <div>
              <div className="mb-3 text-center text-sm font-medium">Style</div>
              <div className="grid gap-5 sm:grid-cols-2">
                {([
                  { value: "atelier", title: "Atelier", hint: "Light, luxury-retail look with satin ribbon and tags." },
                  { value: "classic", title: "Dark", hint: "Dark forest green with snow and a gold ribbon." },
                ] as Array<{ value: GiftLayoutChoice; title: string; hint: string }>).map((o) => {
                  const hero = buildGiftProps(composeSource(sources ?? {}, pickedGifts, baseTier), { tier: wholeTier ? baseTier : "custom", audience, layout: o.value, envelope: false })["gift-hero"];
                  return (
                    <button key={o.value} type="button" onClick={() => setLayout(o.value)} className={cn("group rounded-2xl border p-3 text-left transition-all", layout === o.value ? "border-foreground ring-1 ring-foreground shadow-lg" : "hover:border-foreground/40 hover:shadow-md")}>
                      <GiftPagePreview heroProps={hero} />
                      <div className="flex items-center justify-between px-1 pt-3">
                        <div className="font-semibold">{o.title}</div>
                        {layout === o.value && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-3 w-3" /></span>}
                      </div>
                      <p className="px-1 pb-1 text-xs text-muted-foreground">{o.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <Choice<GiftAudience> label="Who is it for?" value={audience} onChange={setAudience} options={[
              { value: "prospect", title: "Prospect", hint: "“A small thank-you, no strings attached.” No follow-up required." },
              { value: "customer", title: "Customer", hint: "“Thank you for a great year.” Your rep follows up with tracking." },
            ]} />
            <Choice<string> label="Opening" value={envelope ? "yes" : "no"} onChange={(v) => setEnvelope(v === "yes")} options={[
              { value: "yes", title: "Envelope", hint: "They open an animated envelope to reveal the card first." },
              { value: "no", title: "No envelope", hint: "The page opens straight to the gifts." },
            ]} />
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-xl space-y-4">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Do you have a custom note?</h2>
            <p className="text-center text-sm text-muted-foreground">It appears on the card from you, above the standard message. Leave it blank to use the standard message only. A recipient's own note in an uploaded list wins over this one.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} maxLength={600} placeholder="Thank you for trusting us with your labs this year. Wishing you and your team a great holiday season." />
            <div className="text-xs text-muted-foreground">{note.length}/600</div>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto max-w-md space-y-4">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Who is sending it?</h2>
            <p className="text-center text-sm text-muted-foreground">Your name, title, photo and booking link are pulled from Content Library → Sales Reps, and you're emailed when someone claims a gift.</p>
            <Select value={repEmail} onValueChange={setRepEmail}>
              <SelectTrigger><SelectValue placeholder={reps.length ? "Choose a rep…" : "Loading reps…"} /></SelectTrigger>
              <SelectContent className="max-h-72">{reps.map((m) => { const e = (m.content?.email ?? "").trim().toLowerCase(); return <SelectItem key={m.id} value={e}>{m.name}{m.content?.role ? `, ${m.content.role}` : ""}</SelectItem>; })}</SelectContent>
            </Select>
            {rep && (
              <div className="flex items-center gap-5 rounded-2xl border p-4">
                <div className="w-28 shrink-0 rotate-[-2deg] rounded-md bg-white p-1.5 pb-4 shadow-md ring-1 ring-black/5">
                  <div className="aspect-[4/5] overflow-hidden rounded-sm bg-muted">
                    {rep.content?.photo ? <img src={rep.content.photo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">No headshot yet</div>}
                  </div>
                </div>
                <div className="min-w-0 text-sm">
                  <div className="text-base font-semibold">{rep.name}</div>
                  <div className="text-xs text-muted-foreground">{rep.content?.role || "No title on file"} · {repEmail}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{rep.content?.photo ? "This photo is the big picture on the card." : "Add a headshot below so the card shows you instead of the default image."}</p>
                </div>
              </div>
            )}
            {mineMsg && !showMine && <p className={cn("text-xs", mineMsg.ok ? "text-green-700" : "text-red-700")}>{mineMsg.text}</p>}
            {!showMine ? (
              <button type="button" onClick={openMine} className="text-sm underline text-muted-foreground hover:text-foreground">
                {reps.some((m) => (m.content?.email ?? "").trim().toLowerCase() === (user?.email ?? "").toLowerCase()) ? "Update my photo or details" : "I'm not in the list. Add my info"}
              </button>
            ) : (
              <Card className="p-4 space-y-3">
                <div className="text-sm font-medium">Your details (saved to Sales Reps)</div>
                <div>
                  <label className="text-xs font-medium">Headshot</label>
                  <ImagePicker value={mine.photo} onChange={(v) => setMine({ ...mine, photo: v })} placeholder="Upload your headshot" allowAiGenerate={false} previewClassName="w-20 h-20 object-cover rounded-full" libraryTag="team-photo" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([["name", "Name"], ["role", "Title"], ["email", "Work email"], ["phone", "Phone"]] as const).map(([k, label]) => (
                    <div key={k}><label className="text-xs font-medium">{label}</label><Input className="mt-1" value={mine[k]} onChange={(e) => setMine({ ...mine, [k]: e.target.value })} /></div>
                  ))}
                </div>
                <div><label className="text-xs font-medium">Booking link (Chili Piper)</label><Input className="mt-1" value={mine.calendar} onChange={(e) => setMine({ ...mine, calendar: e.target.value })} placeholder="https://meetdandy.chilipiper.com/me/your-name" /></div>
                <p className="text-xs text-muted-foreground">Only filled-in fields are saved; anything blank keeps what's already on file. If you're already in the library, this updates your record.</p>
                {mineMsg && <p className={cn("text-xs", mineMsg.ok ? "text-green-700" : "text-red-700")}>{mineMsg.text}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveMine} disabled={savingMine} className="gap-1.5">{savingMine && <Loader2 className="w-4 h-4 animate-spin" />}Save to Sales Reps</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMine(false)}>Cancel</Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Who is it going to?</h2>
            <div className="mx-auto flex w-fit rounded-full border p-1 text-sm">
              {(["one", "upload"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full px-4 py-1.5", mode === m ? "bg-foreground text-background" : "text-muted-foreground")}>{m === "one" ? "One person" : "Upload a list"}</button>)}
            </div>

            {mode === "one" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {WIZARD_COLUMNS.filter((c) => c.key !== "personal_note" && c.key !== "rep_email").map((c) => (
                  <div key={c.key}>
                    <label className="text-xs font-medium">{c.key.replace("_", " ")}{c.required ? " *" : ""}</label>
                    <Input className="mt-1" value={one[c.key] ?? ""} onChange={(e) => setOne({ ...one, [c.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Card className="p-4 space-y-3">
                  <p className="text-sm">Upload a CSV with these columns. The first row is the header.</p>
                  <table className="w-full text-sm">
                    <tbody>{WIZARD_COLUMNS.map((c) => (
                      <tr key={c.key} className="border-t first:border-t-0">
                        <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{c.key}</td>
                        <td className="py-1.5 pr-3 text-xs">{c.required ? <span className="font-medium">Required</span> : <span className="text-muted-foreground">Optional</span>}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">{c.hint}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download("gift-recipients-template.csv", wizardCsvTemplate())}><Download className="w-4 h-4" />Download template</Button>
                    <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />Upload CSV</Button>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                  </div>
                </Card>
                {uploadError && <Notice tone="red">{uploadError}</Notice>}
                {problems.length > 0 && <Notice tone="amber">Skipped {problems.length} row{problems.length === 1 ? "" : "s"}: {problems.slice(0, 5).join("; ")}{problems.length > 5 ? "…" : ""}</Notice>}
                {uploaded.length > 0 && <p className="text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" />{uploaded.length} recipient{uploaded.length === 1 ? "" : "s"} ready</p>}
              </div>
            )}

            <Card className="p-4 text-sm space-y-1">
              <div className="font-medium">Ready to build</div>
              <div className="text-muted-foreground">{finalRows.length || 0} page{finalRows.length === 1 ? "" : "s"} · {pickedGifts.length} gift{pickedGifts.length === 1 ? "" : "s"} ({pickedGifts.map((g) => g.name).join(", ")}) · {audience} · {layout === "atelier" ? "Atelier" : "Dark"} · {envelope ? "envelope" : "no envelope"} · from {rep?.name ?? "(pick a rep)"} · {note.trim() ? "custom note" : "standard note"}</div>
              {canPublish && <label className="flex items-center gap-2 pt-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />Publish the pages now (otherwise they're saved as drafts to review first)</label>}
            </Card>
            {error && <Notice tone="red">{error}</Notice>}
          </div>
        )}

        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < LAST ? (
            <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && (!templateId || pickedGifts.length === 0)) || (step === 3 && !repEmail)}>Continue</Button>
          ) : (
            <Button onClick={generate} disabled={!canGenerate} className="gap-1.5">{generating && <Loader2 className="w-4 h-4 animate-spin" />}Create {finalRows.length > 1 ? `${finalRows.length} pages` : "page"}</Button>
          )}
        </div>
        </>)}
      </div>
    </SalesLayout>
  );
}

function Notice({ tone, children }: { tone: "amber" | "red" | "blue"; children: React.ReactNode }) {
  const cls = { amber: "text-amber-800 bg-amber-50 border-amber-200", red: "text-red-700 bg-red-50 border-red-200", blue: "text-blue-800 bg-blue-50 border-blue-200" }[tone];
  return <div className={cn("flex items-start gap-2 text-sm border rounded-lg px-3 py-2", cls)}><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{children}</span></div>;
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; title: string; hint: string }> }) {
  return (
    <div>
      <div className="mb-3 text-center text-sm font-medium">{label}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn("rounded-2xl border p-4 text-left transition-all", value === o.value ? "border-foreground ring-1 ring-foreground shadow-md" : "hover:border-foreground/40")}>
            <div className="font-semibold text-sm">{o.title}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{o.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
