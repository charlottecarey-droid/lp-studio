import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Download, Gift, Loader2, Upload, AlertCircle, ExternalLink } from "lucide-react";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, resolveEffectiveMicrositeDomain } from "@/context/AuthContext";
import { getLpPageUrl, cn } from "@/lib/utils";
import { toCsv } from "@/lib/csv";
import { mergeTeamMembers, type TeamMember } from "@/pages/builder/property-panels/GiftPanels";
import {
  GIFT_TIERS, MAX_PICKED_GIFTS, WIZARD_COLUMNS, allGifts, applyWizardDefaults, buildGiftProps, composeSource, manualRow, majorityTier,
  parseWizardCsv, wizardCsvTemplate,
  type GiftAudience, type GiftLayoutChoice, type GiftSourceBlocks, type GiftTierId, type WizardRow,
} from "@/lib/gift-wizard";

const API_BASE = "/api";
const STEPS = ["Gifts", "Style", "Note", "Your info", "Recipients"] as const;
const LAST = STEPS.length - 1;

type GiftSources = Partial<Record<GiftTierId, { pageId: number; title: string; blocks: GiftSourceBlocks }>>;
interface BulkResult {
  pagesGenerated: number;
  created: Array<{ index: number; slug: string; status?: string }>;
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
  const [baseOverride, setBaseOverride] = useState<GiftTierId | null>(null);
  const [sources, setSources] = useState<GiftSources | null>(null);
  const [audience, setAudience] = useState<GiftAudience>("customer");
  const [layout, setLayout] = useState<GiftLayoutChoice>("classic");
  const [envelope, setEnvelope] = useState(false);
  const [note, setNote] = useState("");
  const [reps, setReps] = useState<TeamMember[]>([]);
  const [repEmail, setRepEmail] = useState("");
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

  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/gift-sources`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: GiftSources) => setSources(data && typeof data === "object" ? data : {}))
      .catch(() => setSources({}));
    fetch(`${API_BASE}/lp/library/team_member`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TeamMember[]) => {
        const merged = mergeTeamMembers(Array.isArray(rows) ? rows : []).filter((m) => (m.content?.email ?? "").trim());
        setReps(merged);
        const mine = merged.find((m) => (m.content?.email ?? "").trim().toLowerCase() === (user?.email ?? "").toLowerCase());
        if (mine) setRepEmail((mine.content?.email ?? "").trim().toLowerCase());
      })
      .catch(() => setReps([]));
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
        body: JSON.stringify({ templateId, rows: finalRows, gifts: buildPayload(), publish: publish && canPublish, autoSuffix: true }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not create the pages.");
      setResult({ data: (await r.json()) as BulkResult, rows: finalRows });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the pages.");
    } finally {
      setGenerating(false);
    }
  };

  const linkFor = (slug: string) => getLpPageUrl(slug, micrositeDomain, tenantHost);
  const linksCsv = () => {
    if (!result) return;
    const lines = [["first_name", "last_name", "company", "email", "rep_email", "status", "link"]];
    for (const c of result.data.created) {
      const v = result.rows[c.index]?.variables ?? {};
      lines.push([v.first_name ?? "", v.last_name ?? "", v.company ?? "", v.email ?? "", v.rep_email ?? "", c.status ?? "draft", linkFor(c.slug)]);
    }
    download("gift-page-links.csv", toCsv(lines));
  };

  const reset = () => { setResult(null); setStep(0); setOne({}); setUploaded([]); setProblems([]); setNote(""); };

  /* ── Results ─────────────────────────────────────────────────────────── */
  if (result) {
    const { data } = result;
    return (
      <SalesLayout>
        <div className="space-y-6 max-w-3xl">
          <SalesPageHeader title="Your gift pages are ready" description={`${data.pagesGenerated} page${data.pagesGenerated === 1 ? "" : "s"} created${data.failed.length ? `, ${data.failed.length} failed` : ""}.`} actions={<><Button variant="outline" onClick={linksCsv} className="gap-1.5"><Download className="w-4 h-4" />Download links (CSV)</Button><Button onClick={reset}>Start another</Button></>} />
          {data.publishSkipped && <Notice tone="amber">{data.publishSkipped} The pages were saved as drafts.</Notice>}
          {(data.repUnmatched?.length ?? 0) > 0 && <Notice tone="amber">No Sales Reps match for {data.repUnmatched!.join(", ")}. Those pages keep the template's rep. Fix the rep in Content Library → Sales Reps and run it again.</Notice>}
          {data.created.some((c) => c.status !== "published") && <Notice tone="blue">These are drafts. Open each in the builder to review and publish before you send the link.</Notice>}
          <Card className="divide-y">
            {data.created.map((c) => {
              const v = result.rows[c.index]?.variables ?? {};
              return (
                <div key={c.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{[v.first_name, v.last_name].filter(Boolean).join(" ") || c.slug}{v.company ? ` · ${v.company}` : ""}</div>
                    <div className="text-xs text-muted-foreground truncate">{linkFor(c.slug)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{c.status ?? "draft"}</span>
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(linkFor(c.slug))}>Copy link</Button>
                    <a href={linkFor(c.slug)} target="_blank" rel="noreferrer" aria-label="Open page"><ExternalLink className="w-4 h-4 text-muted-foreground" /></a>
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
      <div className="space-y-6 max-w-3xl">
        <SalesPageHeader title="Holiday gifting" description="Pick the gifts, add your note and your info, then we build a personal gift page for each recipient." />

        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button type="button" onClick={() => i <= step && setStep(i)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 border", i === step ? "bg-foreground text-background border-foreground" : i < step ? "border-foreground/40 text-foreground" : "text-muted-foreground")}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs">{i + 1}</span>}{label}
              </button>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">·</span>}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Which gifts do you want to offer?</h2>
              <p className="text-sm text-muted-foreground">Pick up to {MAX_PICKED_GIFTS}, from any tier. Each recipient chooses one on their page.</p>
            </div>
            {sources === null ? <div className="text-sm text-muted-foreground">Loading gifts…</div> : gifts.length === 0 ? (
              <Notice tone="amber">The holiday gift pages (holiday-gifts-premium, -mid, -swag) aren't set up in this workspace.</Notice>
            ) : (
              <div className="space-y-5">
                {GIFT_TIERS.map((t) => {
                  const tierGifts = gifts.filter((g) => g.tier === t.id);
                  if (tierGifts.length === 0) return null;
                  const allOn = tierGifts.every((g) => pickedKeys.includes(g.key));
                  return (
                    <div key={t.id}>
                      <div className="flex items-baseline justify-between mb-2">
                        <div><span className="font-semibold text-sm">{t.label}</span> <span className="text-xs text-muted-foreground">{t.blurb}</span></div>
                        <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setPicked(allOn ? pickedKeys.filter((k) => !tierGifts.some((g) => g.key === k)) : [...new Set([...pickedKeys, ...tierGifts.map((g) => g.key)])].slice(0, MAX_PICKED_GIFTS))}>{allOn ? "Clear" : "Select all"}</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
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
            )}
            <p className="text-xs text-muted-foreground">Gifts, photos and copy come from the designed gift pages, so editing those in the builder changes what's offered here. A size picker appears automatically when a swag item is selected.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">How should the page look and read?</h2>
            <Choice<GiftAudience> label="Who is it for?" value={audience} onChange={setAudience} options={[
              { value: "prospect", title: "Prospect", hint: "“A small thank-you, no strings attached.” No follow-up required." },
              { value: "customer", title: "Customer", hint: "“Thank you for a great year.” Your rep follows up with tracking." },
            ]} />
            <Choice<GiftLayoutChoice> label="Style" value={layout} onChange={setLayout} options={[
              { value: "atelier", title: "Atelier", hint: "Light, luxury-retail look with satin ribbon and tags." },
              { value: "classic", title: "Dark", hint: "Dark forest green with snow and a gold ribbon." },
            ]} />
            <Choice<string> label="Opening" value={envelope ? "yes" : "no"} onChange={(v) => setEnvelope(v === "yes")} options={[
              { value: "yes", title: "Envelope", hint: "They open an animated envelope to reveal the card first." },
              { value: "no", title: "No envelope", hint: "The page opens straight to the gifts." },
            ]} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Do you have a custom note?</h2>
            <p className="text-sm text-muted-foreground">It appears on the card from you, above the standard message. Leave it blank to use the standard message only. A recipient's own note in an uploaded list wins over this one.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} maxLength={600} placeholder="Thank you for trusting us with your labs this year. Wishing you and your team a great holiday season." />
            <div className="text-xs text-muted-foreground">{note.length}/600</div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 max-w-md">
            <h2 className="text-lg font-semibold">Who is sending it?</h2>
            <p className="text-sm text-muted-foreground">Your name, title, photo and booking link are pulled from Content Library → Sales Reps, and you're emailed when someone claims a gift.</p>
            <Select value={repEmail} onValueChange={setRepEmail}>
              <SelectTrigger><SelectValue placeholder={reps.length ? "Choose a rep…" : "Loading reps…"} /></SelectTrigger>
              <SelectContent className="max-h-72">{reps.map((m) => { const e = (m.content?.email ?? "").trim().toLowerCase(); return <SelectItem key={m.id} value={e}>{m.name}{m.content?.role ? `, ${m.content.role}` : ""}</SelectItem>; })}</SelectContent>
            </Select>
            {rep && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                {rep.content?.photo ? <img src={rep.content.photo} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-muted" />}
                <div className="text-sm"><div className="font-medium">{rep.name}</div><div className="text-xs text-muted-foreground">{rep.content?.role || "No title on file"} · {repEmail}</div></div>
              </div>
            )}
            {!user?.email || (reps.length > 0 && !reps.some((m) => (m.content?.email ?? "").trim().toLowerCase() === user.email.toLowerCase())) ? (
              <p className="text-xs text-muted-foreground">Your own email isn't in Sales Reps, so pick yourself from the list or ask an admin to add you.</p>
            ) : null}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Who is it going to?</h2>
            <div className="inline-flex rounded-lg border p-0.5 text-sm">
              {(["one", "upload"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={cn("px-3 py-1 rounded-md", mode === m ? "bg-foreground text-background" : "text-muted-foreground")}>{m === "one" ? "One person" : "Upload a list"}</button>)}
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

        <div className="flex justify-between pt-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < LAST ? (
            <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && (!templateId || pickedGifts.length === 0)) || (step === 3 && !repEmail)}>Continue</Button>
          ) : (
            <Button onClick={generate} disabled={!canGenerate} className="gap-1.5">{generating && <Loader2 className="w-4 h-4 animate-spin" />}Create {finalRows.length > 1 ? `${finalRows.length} pages` : "page"}</Button>
          )}
        </div>
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
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn("text-left rounded-xl border p-3 transition-colors", value === o.value ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40")}>
            <div className="font-semibold text-sm">{o.title}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{o.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
