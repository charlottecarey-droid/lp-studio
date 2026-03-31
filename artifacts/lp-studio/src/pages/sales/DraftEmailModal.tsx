import { useState, useEffect, useRef } from "react";
import { X, Copy, Check, Loader2, Mail, Sparkles, Globe, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const API_BASE = "/api";

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
}

interface Props {
  contact: Contact;
  accountId: number;
  accountName: string;
  onClose: () => void;
}

export default function DraftEmailModal({ contact, accountId, accountName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasMicrosite, setHasMicrosite] = useState(false);
  const [researchUsed, setResearchUsed] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/sales/draft-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, accountId }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(d.error ?? "Failed to generate email");
        }
        const data = await res.json() as {
          subject?: string;
          body?: string;
          hasMicrosite?: boolean;
          researchUsed?: boolean;
          sources?: string[];
        };
        setSubject(data.subject ?? "");
        setBody(data.body ?? "");
        setHasMicrosite(!!data.hasMicrosite);
        setResearchUsed(!!data.researchUsed);
        setSources(data.sources ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error generating email");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    generate();
    return () => { cancelled = true; };
  }, [contact.id, accountId]);

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
    const currentBody = textareaRef.current?.value ?? body;
    const mailto = [
      "mailto:",
      contact.email ?? "",
      "?subject=",
      encodeURIComponent(subject),
      "&body=",
      encodeURIComponent(currentBody),
    ].join("");
    window.location.href = mailto;
  }

  function openInGmail() {
    const currentBody = textareaRef.current?.value ?? body;
    const params = new URLSearchParams({
      view: "cm",
      to: contact.email ?? "",
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Draft email — {fullName}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {contact.title && <>{contact.title} · </>}{accountName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-3 flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-[13px]">Researching {accountName} and writing email…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-destructive">
              <p className="text-[13px] font-medium">{error}</p>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Research badge + sources */}
              {(researchUsed || sources.length > 0) && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setSourcesOpen(o => !o)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground italic flex-1 text-left">
                      Personalized using web research
                      {sources.length > 0 && ` · ${sources.length} source${sources.length !== 1 ? "s" : ""}`}
                    </p>
                    {sources.length > 0 && (
                      sourcesOpen
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {sourcesOpen && sources.length > 0 && (
                    <div className="px-3 py-2 border-t border-border bg-card flex flex-col gap-1">
                      {sources.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] text-primary hover:underline truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {formatSourceLabel(url)}
                          <span className="text-muted-foreground truncate">— {url}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Microsite badge */}
              {hasMicrosite && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                  style={{ background: "rgba(199,231,56,0.12)", borderColor: "rgba(199,231,56,0.35)" }}>
                  <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "#5a6e00" }} />
                  <p className="text-[12px] font-medium" style={{ color: "#3d4c00" }}>
                    Microsite for {accountName} is referenced — replace [MICROSITE_URL] before sending.
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
                    <p className="text-[13px] font-medium text-foreground flex-1">{subject}</p>
                    <button
                      onClick={copySubject}
                      title="Copy subject"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedSubject
                        ? <Check className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5" />}
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
                  className="w-full text-[13px] text-foreground leading-relaxed border border-border rounded-xl p-4 h-52 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 font-mono bg-muted/20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <button
              onClick={copyFull}
              className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted/50 transition-colors"
            >
              {copiedFull
                ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied!</>
                : <><Copy className="w-3.5 h-3.5" />Copy email</>}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2">
                <button
                  onClick={openInEmailClient}
                  title="Open in default email client"
                  className="flex items-center gap-2 px-3 py-2 border border-border bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email client
                </button>
                <button
                  onClick={openInGmail}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ background: "#EA4335" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                  Open in Gmail
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
