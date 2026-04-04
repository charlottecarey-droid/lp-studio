import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Copy, Check, Loader2, Mail, Sparkles, Globe, ChevronDown, ChevronUp, ExternalLink, FileText, ArrowLeft, X, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Account {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  accountId?: number;
}

interface ResearchText {
  person: string;
  linkedin: string;
  company: string;
  site: string;
}

export default function SalesDraftEmail() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/sales/draft-email/:contactId");
  const urlContactId = matched && params?.contactId ? parseInt(params.contactId, 10) : null;

  // Data fetching
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Selection state
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(urlContactId ? null : null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(urlContactId ?? null);
  const [searchContact, setSearchContact] = useState("");
  const [contactsOpen, setContactsOpen] = useState(false);
  const contactBoxRef = useRef<HTMLDivElement>(null);

  // Email generation state
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasMicrosite, setHasMicrosite] = useState(false);
  const [researchUsed, setResearchUsed] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [hookSource, setHookSource] = useState<string | null>(null);
  const [researchText, setResearchText] = useState<ResearchText | null>(null);
  const [error, setError] = useState("");

  // Copy state
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Brief state
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefError, setBriefError] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);

  // Fetch accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch(`${API_BASE}/sales/accounts`);
        if (res.ok) {
          const data = await res.json() as Account[];
          setAccounts(data);
          if (urlContactId) {
            // Pre-select account when navigating with contactId
            const contactRes = await fetch(`${API_BASE}/sales/contacts/${urlContactId}`);
            if (contactRes.ok) {
              const contact = await contactRes.json() as Contact;
              if (contact.accountId) {
                setSelectedAccountId(contact.accountId);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch accounts", err);
      } finally {
        setAccountsLoading(false);
      }
    }
    fetchAccounts();
  }, [urlContactId]);

  // Fetch contacts when account is selected
  useEffect(() => {
    if (!selectedAccountId) {
      setContacts([]);
      return;
    }

    async function fetchContacts() {
      setContactsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/sales/accounts/${selectedAccountId}/contacts`);
        if (res.ok) {
          const data = await res.json() as Contact[];
          setContacts(data);
          setAllContacts(data);
        }
      } catch (err) {
        console.error("Failed to fetch contacts", err);
      } finally {
        setContactsLoading(false);
      }
    }
    fetchContacts();
  }, [selectedAccountId]);

  // Filter contacts by search
  useEffect(() => {
    if (!searchContact.trim()) {
      setContacts(allContacts);
      return;
    }
    const query = searchContact.toLowerCase();
    const filtered = allContacts.filter(
      (c) =>
        c.firstName.toLowerCase().includes(query) ||
        c.lastName.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.title?.toLowerCase().includes(query)
    );
    setContacts(filtered);
  }, [searchContact, allContacts]);

  // Close contact dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactBoxRef.current && !contactBoxRef.current.contains(e.target as Node)) {
        setContactsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate email when contact is selected
  useEffect(() => {
    if (!selectedContactId || !selectedAccountId) return;

    let cancelled = false;

    async function generateEmail() {
      setGenerating(true);
      setError("");
      setSubject("");
      setBody("");
      setSources([]);
      setHookSource(null);
      setResearchText(null);
      setBrief("");
      setBriefOpen(false);

      try {
        const res = await fetch(`${API_BASE}/sales/draft-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: selectedContactId, accountId: selectedAccountId }),
        });

        if (cancelled) return;

        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? "Failed to generate email");
        }

        const data = (await res.json()) as {
          subject?: string;
          body?: string;
          hasMicrosite?: boolean;
          researchUsed?: boolean;
          sources?: string[];
          hookSource?: string | null;
          researchText?: ResearchText;
        };

        setSubject(data.subject ?? "");
        setBody(data.body ?? "");
        setHasMicrosite(!!data.hasMicrosite);
        setResearchUsed(!!data.researchUsed);
        setSources(data.sources ?? []);
        setHookSource(data.hookSource ?? null);
        setResearchText(data.researchText ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error generating email");
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }

    generateEmail();
    return () => {
      cancelled = true;
    };
  }, [selectedContactId, selectedAccountId]);

  async function generateBrief() {
    if (briefLoading || !selectedContactId || !selectedAccountId) return;

    setBriefLoading(true);
    setBriefError("");
    setBrief("");
    setBriefOpen(true);

    try {
      const res = await fetch(`${API_BASE}/sales/person-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: selectedContactId, accountId: selectedAccountId, researchText }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to generate brief");
      }

      const data = (await res.json()) as { brief?: string };
      setBrief(data.brief ?? "");
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Error generating brief");
    } finally {
      setBriefLoading(false);
    }
  }

  function copySubject() {
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 1800);
  }

  function copyFull() {
    const currentBody = textareaRef.current?.value ?? body;
    const full = subject ? `Subject: ${subject}\n\n${currentBody}` : currentBody;
    navigator.clipboard.writeText(full);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1800);
  }

  function openInEmailClient() {
    const contact = allContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email) return;

    const currentBody = textareaRef.current?.value ?? body;
    const mailto = [
      "mailto:",
      contact.email,
      "?subject=",
      encodeURIComponent(subject),
      "&body=",
      encodeURIComponent(currentBody),
    ].join("");
    window.location.href = mailto;
  }

  function openInGmail() {
    const contact = allContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email) return;

    const currentBody = textareaRef.current?.value ?? body;
    const params = new URLSearchParams({
      view: "cm",
      to: contact.email,
      su: subject,
      body: currentBody,
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
  }

  function formatSourceLabel(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function renderBriefLine(line: string, idx: number) {
    if (!line.trim()) return <div key={idx} className="h-2" />;

    const headerMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (headerMatch) {
      return (
        <p key={idx} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1">
          {headerMatch[1]}
        </p>
      );
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

    return (
      <p key={idx} className="text-[12px] text-foreground leading-relaxed">
        {renderInlineBold(line)}
      </p>
    );
  }

  function renderInlineBold(text: string) {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part));
  }

  const selectedContact = allContacts.find((c) => c.id === selectedContactId);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const fullName = selectedContact ? [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(" ") : "";

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
            {/* Account selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Step 1: Select Account
              </label>
              <Select value={selectedAccountId?.toString() ?? ""} onValueChange={(val) => setSelectedAccountId(parseInt(val, 10))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountsLoading && <p className="text-xs text-muted-foreground">Loading accounts...</p>}
            </div>

            {/* Contact selection */}
            {selectedAccountId && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Step 2: Select Contact
                </label>

                {selectedContact ? (
                  /* Selected contact pill */
                  <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </p>
                      {selectedContact.title && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{selectedContact.title}</p>
                      )}
                      {selectedContact.email && (
                        <p className="text-xs text-muted-foreground truncate">{selectedContact.email}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedContactId(null);
                        setSearchContact("");
                        setContactsOpen(true);
                      }}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Change contact"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Combobox search */
                  <div ref={contactBoxRef} className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search by name, email, or title..."
                        value={searchContact}
                        onChange={(e) => {
                          setSearchContact(e.target.value);
                          setContactsOpen(true);
                        }}
                        onFocus={() => setContactsOpen(true)}
                        className="w-full pl-9"
                        disabled={contactsLoading}
                        autoComplete="off"
                      />
                      {contactsLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                      )}
                    </div>

                    {/* Floating results */}
                    {contactsOpen && !contactsLoading && contacts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {contacts.map((contact, i) => (
                          <button
                            key={contact.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedContactId(contact.id);
                              setContactsOpen(false);
                              setSearchContact("");
                            }}
                            className={[
                              "w-full text-left px-3 py-2.5 hover:bg-muted/70 transition-colors",
                              i > 0 ? "border-t border-border/50" : "",
                            ].join(" ")}
                          >
                            <p className="text-sm font-medium text-foreground leading-tight">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.title && (
                              <p className="text-xs text-muted-foreground mt-0.5">{contact.title}</p>
                            )}
                            {contact.email && (
                              <p className="text-xs text-muted-foreground">{contact.email}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {contactsOpen && !contactsLoading && contacts.length === 0 && searchContact && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg px-3 py-3">
                        <p className="text-sm text-muted-foreground">No contacts found for "{searchContact}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Email generation result */}
        {selectedContactId && selectedAccountId && (
          <Card className="p-6 border-border/50 space-y-4">
            {/* Loading state */}
            {generating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Researching {selectedAccount?.name} and writing email…</p>
              </div>
            )}

            {/* Error state */}
            {!generating && error && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-destructive">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Content */}
            {!generating && !error && subject && (
              <div className="space-y-4">
                {/* Research badge + sources */}
                {(researchUsed || sources.length > 0) && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setSourcesOpen((o) => !o)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-[11px] text-muted-foreground italic flex-1 text-left">
                        {hookSource === "pain point"
                          ? "Written from role-based pain point (no recent research found)"
                          : hookSource
                            ? `Hook sourced from ${formatSourceLabel(hookSource)}`
                            : "Personalized using web research"}
                        {sources.length > 0 && hookSource !== "pain point" && ` · ${sources.length} source${sources.length !== 1 ? "s" : ""} cited`}
                      </p>
                      {sources.length > 0 && (
                        sourcesOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )
                      )}
                    </button>
                    {sourcesOpen && sources.length > 0 && (
                      <div className="px-3 py-2 border-t border-border bg-card flex flex-col gap-1.5">
                        {sources.map((url) => {
                          const isHookSource = hookSource && url === hookSource;
                          return (
                            <div
                              key={url}
                              className={isHookSource ? "rounded-md px-2 py-1 -mx-2" : ""}
                              style={isHookSource ? { background: "rgba(199,231,56,0.12)", border: "1px solid rgba(199,231,56,0.35)" } : {}}
                            >
                              {isHookSource && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#5a6e00" }}>Used for hook</p>}
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] text-primary hover:underline truncate"
                              >
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
                    onClick={brief || briefLoading ? () => setBriefOpen((o) => !o) : generateBrief}
                    disabled={briefLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors disabled:opacity-60"
                  >
                    {briefLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <p className="text-[11px] text-muted-foreground italic flex-1 text-left">
                      {briefLoading
                        ? `Generating contact brief for ${selectedContact?.firstName}…`
                        : brief
                          ? `Contact brief — ${selectedContact?.firstName} ${selectedContact?.lastName}`
                          : `Generate contact brief for ${selectedContact?.firstName}`}
                    </p>
                    {brief && !briefLoading && (briefOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)}
                  </button>

                  {briefOpen && (brief || briefError) && (
                    <div className="px-4 py-3 border-t border-border bg-card max-h-64 overflow-y-auto">
                      {briefError && <p className="text-[12px] text-destructive">{briefError}</p>}
                      {brief && <div className="flex flex-col gap-0.5">{brief.split("\n").map((line, idx) => renderBriefLine(line, idx))}</div>}
                    </div>
                  )}
                </div>

                {/* Microsite badge */}
                {hasMicrosite && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: "rgba(199,231,56,0.12)", borderColor: "rgba(199,231,56,0.35)" }}>
                    <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "#5a6e00" }} />
                    <p className="text-[12px] font-medium" style={{ color: "#3d4c00" }}>
                      Microsite for {selectedAccount?.name} is referenced — replace [MICROSITE_URL] before sending.
                    </p>
                  </div>
                )}

                {/* Subject */}
                {subject && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Subject line
                    </p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border">
                      <p className="text-sm font-medium text-foreground flex-1">{subject}</p>
                      <button
                        onClick={copySubject}
                        title="Copy subject"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedSubject ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Body textarea */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Email body
                  </p>
                  <textarea
                    ref={textareaRef}
                    defaultValue={body}
                    className="w-full text-sm text-foreground leading-relaxed border border-border rounded-xl p-4 h-80 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 font-mono bg-muted/20"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
                  <Button
                    onClick={copyFull}
                    variant="outline"
                    className="gap-2"
                  >
                    {copiedFull ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy email
                      </>
                    )}
                  </Button>

                  {selectedContact?.email && (
                    <>
                      <Button
                        onClick={openInEmailClient}
                        variant="outline"
                        className="gap-2"
                        title="Open in default email client"
                      >
                        <Mail className="w-4 h-4" />
                        Email client
                      </Button>
                      <Button
                        onClick={openInGmail}
                        className="gap-2"
                        style={{ background: "#EA4335", color: "white" }}
                      >
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
