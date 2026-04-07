import { useState } from "react";
import { FlaskConical, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

export interface TestEmailContact {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  contacts?: TestEmailContact[];
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
}

export function SendTestEmailModal({
  open,
  onClose,
  subject,
  bodyHtml,
  bodyText,
  contacts,
  senderName,
  senderEmail,
  replyTo,
}: Props) {
  const { user } = useAuth();
  const [to, setTo] = useState(user?.email ?? "");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!to || !subject || (!bodyHtml && !bodyText)) return;
    setSending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        to,
        subject,
        senderName,
        senderEmail,
        replyTo,
        ...(bodyHtml ? { bodyHtml } : { bodyText }),
      };
      if (selectedContactId) {
        payload.contactId = Number(selectedContactId);
      }
      const res = await fetch(`${API_BASE}/sales/send-test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          onClose();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to send test email");
      }
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setSending(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
      setSent(false);
      onClose();
    }
  }

  const hasContacts = contacts && contacts.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-muted-foreground" />
            Send Test Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sends a copy of this email to your inbox with{" "}
            <span className="font-medium text-foreground">[TEST]</span> prepended to the subject.
            {hasContacts && " Optionally preview as a contact to see real merge variables."}
          </p>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Send to
            </label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {hasContacts && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Preview as contact <span className="text-muted-foreground/60 font-normal">(optional — applies real merge vars)</span>
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Use sample values</option>
                {contacts!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || `Contact #${c.id}`}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
              {!selectedContactId && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sample: Sarah Johnson · Acme Dental
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 leading-snug">{error}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSend}
            disabled={sending || sent || !to || !subject || (!bodyHtml && !bodyText)}
            className="flex-1 gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sent ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <FlaskConical className="w-4 h-4" />
            )}
            {sending ? "Sending…" : sent ? "Sent!" : "Send Test"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
