import { useState, useEffect, useRef } from "react";
import { X, Copy, Check, Loader2, Mail, Sparkles, Globe } from "lucide-react";

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
        };
        setSubject(data.subject ?? "");
        setBody(data.body ?? "");
        setHasMicrosite(!!data.hasMicrosite);
        setResearchUsed(!!data.researchUsed);
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
        <div className="px-6 py-4 flex flex-col gap-3 flex-1">

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
              {/* Research badge */}
              {researchUsed && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground italic">
                    Personalized based on recent web research about {accountName}.
                  </p>
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
              <button
                onClick={openInEmailClient}
                className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-lg text-primary-foreground transition-opacity hover:opacity-90"
                style={{ background: "#003A30" }}
              >
                <Mail className="w-3.5 h-3.5" />
                Open in email client
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
