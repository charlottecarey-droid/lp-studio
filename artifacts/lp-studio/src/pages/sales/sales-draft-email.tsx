import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Copy, Check, Loader2, Mail, Sparkles, Globe, ChevronDown, ChevronUp, ExternalLink, FileText, ArrowLeft, RefreshCw, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SearchableDropdown, type DropdownItem } from "@/components/ui/searchable-dropdown";
import { useEmailDraft } from "@/hooks/use-email-draft";

function formatSourceLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function renderInlineBold(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part));
}

function renderBriefLine(line: string, idx: number) {
  if (!line.trim()) return <div key={idx} className="h-2" />;

  const headerMatch = line.match(/^\*\*([^*]+)\*\*$/);
  if (headerMatch) {
    return <p key={idx} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1">{headerMatch[1]}</p>;
  }

  const numMatch = line.match(/^(\d+)\.\s+(.+)/);
  if (numMatch) {
    return (
      <div key={idx} className="flex gap-2 text-[12px] text-foreground leading-relaxed">
        <span className="text-muted-foreground shrink-0 font-medium">{numMatch[1]}.</span>
        <span>{renderInlineBold(numMatch[2])}</span>
      </div>
    );
  }

  const bulletMatch = line.match(/^[-*]\s+(.+)/);
  if (bulletMatch) {
    return (
      <div key={idx} className="flex gap-2 text-[12px] text-foreground leading-relaxed">
        <span className="text-muted-foreground shrink-0 mt-0.5">·</span>
        <span>{renderInlineBold(bulletMatch[1])}</span>
      </div>
    );
  }

  return <p key={idx} className="text-[12px] text-foreground leading-relaxed">{renderInlineBold(line)}</p>;
}

export default function SalesDraftEmail() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/sales/draft-email/:contactId");
  const urlContactId = matched && params?.contactId ? parseInt(params.contactId, 10) : null;

  const d = useEmailDraft(urlContactId);

  // ── Save as Template ──────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveAsTemplate() {
    const currentBody = d.textareaRef.current?.value ?? d.body;
    if (!d.subject && !currentBody) return;
    setSaving(true);
    try {
      const name = d.selectedContact
        ? `Draft for ${d.fullName}`
        : `Saved template – ${new Date().toLocaleDateString()}`;
      const res = await fetch("/api/sales/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject: d.subject,
          bodyHtml: currentBody,
          bodyText: currentBody,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Save as template failed", err);
    } finally {
      setSaving(false);
    }
  }

  // Map to DropdownItem shapes
  const accountItems: DropdownItem[] = d.filteredAccounts.map((a) => ({ id: a.id, label: a.name }));
  const contactItems: DropdownItem[] = d.contacts.map((c) => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName}`,
    secondary: c.title,
    tertiary: c.email,
  }));

  return (
    <SalesLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <button
            onClick={() => navigate("/sales/contacts")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to contacts
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Draft Email</h1>
            </div>
            <p className="text-base text-muted-foreground">
              Pick a contact and let AI write a personalized cold email in seconds.
            </p>
          </div>
        </div>

        {/* Selection step */}
        <Card className="p-6 border-border/50">
          <div className="space-y-6">
            <SearchableDropdown
              label="Step 1: Select Account"
              items={accountItems}
              loading={d.accountsLoading}
              placeholder="Search accounts..."
              search={d.searchAccount}
              onSearchChange={d.setSearchAccount}
              onSelect={d.selectAccount}
              selected={d.selectedAccount ? { label: d.selectedAccount.name } : null}
              onClear={d.clearAccount}
            />

            {d.selectedAccountId && (
              <SearchableDropdown
                label="Step 2: Select Contact"
                items={contactItems}
                loading={d.contactsLoading}
                placeholder="Search by name, email, or title..."
                search={d.searchContact}
                onSearchChange={d.setSearchContact}
                onSelect={d.selectContact}
                selected={
                  d.selectedContact
                    ? {
                        label: `${d.selectedContact.firstName} ${d.selectedContact.lastName}`,
                        secondary: d.selectedContact.title,
                        tertiary: d.selectedContact.email,
                      }
                    : null
                }
                onClear={d.clearContact}
              />
            )}
          </div>
        </Card>

        {/* Email generation result */}
        {d.selectedContactId && d.selectedAccountId && (
          <Card className="p-6 border-border/50 space-y-4">
            {/* Loading state */}
            {d.generating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Researching {d.selectedAccount?.name} and writing email…</p>
              </div>
            )}

            {/* Error state */}
            {!d.generating && d.error && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-destructive">
                <p className="text-sm font-medium">{d.error}</p>
              </div>
            )}

            {/* Content */}
            {!d.generating && !d.error && d.subject && (
              <div className="space-y-4">
                {/* Research badge + sources */}
                {(d.researchUsed || d.sources.length > 0) && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => d.setSourcesOpen((o) => !o)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-[11px] text-muted-foreground italic flex-1 text-left">
                        {d.emailTheme
                          ? `Thread: ${d.emailTheme}`
                          : d.hookSource === "pain point"
                            ? "Written from role-based pain point (no recent research found)"
                            : d.hookSource
                              ? `Hook sourced from ${formatSourceLabel(d.hookSource)}`
                              : "Personalized using web research"}
                        {d.sources.length > 0 && d.hookSource !== "pain point" && ` · ${d.sources.length} source${d.sources.length !== 1 ? "s" : ""} cited`}
                      </p>
                      {d.sources.length > 0 && (
                        d.sourcesOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {d.sourcesOpen && d.sources.length > 0 && (
                      <div className="px-3 py-2 border-t border-border bg-card flex flex-col gap-1.5">
                        {d.sources.map((url) => {
                          const isHookSource = d.hookSource && url === d.hookSource;
                          return (
                            <div
                              key={url}
                              className={isHookSource ? "rounded-md px-2 py-1 -mx-2" : ""}
                              style={isHookSource ? { background: "rgba(199,231,56,0.12)", border: "1px solid rgba(199,231,56,0.35)" } : {}}
                            >
                              {isHookSource && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#5a6e00" }}>Used for hook</p>}
                              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary hover:underline truncate">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {formatSourceLabel(url)}
                                <span className="text-muted-foreground truncate">— {url}</span>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Brief button + panel */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={d.brief || d.briefLoading ? () => d.setBriefOpen((o) => !o) : d.generateBrief}
                    disabled={d.briefLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors disabled:opacity-60"
                  >
                    {d.briefLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <p className="text-[11px] text-muted-foreground italic flex-1 text-left">
                      {d.briefLoading
                        ? `Generating contact brief for ${d.selectedContact?.firstName}…`
                        : d.brief
                          ? `Contact brief — ${d.selectedContact?.firstName} ${d.selectedContact?.lastName}`
                          : `Generate contact brief for ${d.selectedContact?.firstName}`}
                    </p>
                    {d.brief && !d.briefLoading && (d.briefOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)}
                  </button>

                  {d.briefOpen && (d.brief || d.briefError) && (
                    <div className="px-4 py-3 border-t border-border bg-card">
                      {d.briefError && <p className="text-[12px] text-destructive">{d.briefError}</p>}
                      {d.brief && <div className="flex flex-col gap-0.5">{d.brief.split("\n").map((line, idx) => renderBriefLine(line, idx))}</div>}
                    </div>
                  )}
                </div>

                {/* Microsite badge */}
                {d.hasMicrosite && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: "rgba(199,231,56,0.12)", borderColor: "rgba(199,231,56,0.35)" }}>
                    <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "#5a6e00" }} />
                    <p className="text-[12px] font-medium" style={{ color: "#3d4c00" }}>
                      Microsite for {d.selectedAccount?.name} is referenced — replace [MICROSITE_URL] before sending.
                    </p>
                  </div>
                )}

                {/* Subject */}
                {d.subject && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Subject line</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border">
                      <p className="text-sm font-medium text-foreground flex-1">{d.subject}</p>
                      <button onClick={d.copySubject} title="Copy subject" className="text-muted-foreground hover:text-foreground transition-colors">
                        {d.copiedSubject ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Body textarea */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email body</p>
                  <textarea
                    ref={d.textareaRef}
                    defaultValue={d.body}
                    className="w-full text-sm text-foreground leading-relaxed border border-border rounded-xl p-4 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 font-mono bg-muted/20 overflow-hidden"
                    onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                    onFocus={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
                  <Button onClick={d.generateEmail} variant="outline" className="gap-2" disabled={d.generating}>
                    <RefreshCw className={`w-4 h-4 ${d.generating ? "animate-spin" : ""}`} />
                    {d.generating ? "Regenerating…" : "Regenerate"}
                  </Button>
                  <Button onClick={d.copyFull} variant="outline" className="gap-2">
                    {d.copiedFull ? (<><Check className="w-4 h-4 text-green-500" />Copied!</>) : (<><Copy className="w-4 h-4" />Copy email</>)}
                  </Button>
                  <Button onClick={saveAsTemplate} variant="outline" className="gap-2" disabled={saving || (!d.subject && !d.body)}>
                    {saved ? (<><Check className="w-4 h-4 text-green-500" />Saved!</>) : saving ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving…</>) : (<><Save className="w-4 h-4" />Save as template</>)}
                  </Button>

                  {d.selectedContact?.email && (
                    <>
                      <Button onClick={d.openInEmailClient} variant="outline" className="gap-2" title="Open in default email client">
                        <Mail className="w-4 h-4" />
                        Email client
                      </Button>
                      <Button onClick={d.openInGmail} className="gap-2 bg-[#EA4335] text-white hover:bg-[#d33426]" title="Open in Gmail">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                        </svg>
                        Open in Gmail
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </SalesLayout>
  );
}
