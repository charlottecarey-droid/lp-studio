/**
 * ChatTranscriptDialog — the full lead-bot conversation behind a chat-capture
 * lead (July 2026). Opened from the Leads tables when a lead carries the
 * hidden `_chatConversationId` field; fetches the tenant-scoped
 * GET /api/lp/chat-transcripts/:id and renders the thread as chat bubbles.
 */
import { useEffect, useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TranscriptMessage {
  role: "user" | "assistant" | string;
  content: string;
  createdAt: string;
}

interface Transcript {
  conversationId: number;
  startedAt: string;
  messages: TranscriptMessage[];
}

export function ChatTranscriptDialog({
  conversationId,
  onClose,
}: {
  /** Null = closed. */
  conversationId: number | null;
  onClose: () => void;
}) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId == null) return;
    setTranscript(null);
    setError(null);
    let cancelled = false;
    fetch(`/api/lp/chat-transcripts/${conversationId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json() as Promise<Transcript>;
      })
      .then((data) => {
        if (!cancelled) setTranscript(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the transcript.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <Dialog open={conversationId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary" aria-hidden />
            Chat transcript
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive py-4" role="alert">{error}</p>
        ) : !transcript ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-3 py-1 pr-1">
            <p className="text-xs text-muted-foreground">
              Started {new Date(transcript.startedAt).toLocaleString()}
            </p>
            {transcript.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {transcript.messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No messages recorded.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The hidden lead field the chat-capture block stamps — shared by the two
 *  leads tables so the affordance stays consistent. */
export function leadChatConversationId(fields: Record<string, unknown>): number | null {
  const raw = fields["_chatConversationId"];
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}
