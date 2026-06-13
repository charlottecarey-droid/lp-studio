/**
 * Builder Copilot panel (June 2026 chatbot spec — Bot 1 surface).
 *
 * A collapsible right-side drawer in the builder: a chat thread (user +
 * assistant bubbles with live streaming tokens) and ACTION CARDS. When the
 * stream emits an `action` event, the assistant turn renders a card with the
 * proposed edit's rationale + an "Apply" / "Dismiss" pair. "Apply" calls back
 * into BuilderEditor, which routes each action type to the REAL existing block
 * mutation (insert / rewrite / replace-image / remove / reorder / contrast) —
 * this component never mutates blocks itself. Nothing auto-applies: the bot
 * proposes, the user confirms (the v1 guardrail).
 *
 * Accessibility: the streaming region is an aria-live polite log; the launcher
 * and controls are focus-visible; animations respect prefers-reduced-motion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, Check, Plus, Pencil, Image as ImageIcon, Trash2, ArrowUpDown, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { streamCopilotChat, CopilotStreamError, type CopilotAction } from "@/lib/copilotStream";

/** The outcome BuilderEditor reports back so the card can show applied/failed. */
export interface ApplyActionResult {
  ok: boolean;
  message?: string;
}

export interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  /** Numeric page id (the chat is page-scoped). */
  pageId: number;
  /** Live page state passed to the bot so it reasons about unsaved edits. */
  getLiveBlocks: () => unknown[];
  getTitle: () => string;
  /** Apply a proposed action via the builder's real mutations. Returns a
   *  result so the card can reflect success/failure. */
  onApplyAction: (action: CopilotAction) => Promise<ApplyActionResult> | ApplyActionResult;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ActionCardState[];
  /** True while this assistant message is still streaming. */
  streaming?: boolean;
}

interface ActionCardState {
  action: CopilotAction;
  status: "proposed" | "applying" | "applied" | "dismissed" | "failed";
  error?: string;
}

const ACTION_ICON: Record<string, typeof Plus> = {
  insert_block: Plus,
  rewrite_copy: Pencil,
  replace_image: ImageIcon,
  remove_block: Trash2,
  reorder_block: ArrowUpDown,
  fix_contrast: Contrast,
};

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

export default function CopilotPanel({
  open,
  onClose,
  pageId,
  getLiveBlocks,
  getTitle,
  onApplyAction,
}: CopilotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll the thread as tokens stream in.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cancel any in-flight stream when the panel unmounts/closes.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text, actions: [] };
    const assistantId = nextId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      actions: [],
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const done = await streamCopilotChat(
        {
          conversationId,
          pageId,
          userMessage: text,
          blocks: getLiveBlocks(),
          title: getTitle(),
        },
        {
          onToken: (t) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + t } : m)),
            );
          },
          onAction: (action) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, actions: [...m.actions, { action, status: "proposed" }] }
                  : m,
              ),
            );
          },
        },
        controller.signal,
      );
      setConversationId(done.conversationId);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      );
    } catch (err) {
      const e = err as CopilotStreamError;
      if (e.kind === "aborted") {
        // User closed the panel / cancelled — drop the empty assistant bubble.
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === "" && m.actions.length === 0)),
        );
      } else {
        setError(e.message || "Something went wrong");
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, conversationId, pageId, getLiveBlocks, getTitle]);

  const applyCard = useCallback(
    async (messageId: string, cardIndex: number) => {
      const msg = messages.find((m) => m.id === messageId);
      const card = msg?.actions[cardIndex];
      if (!card || card.status !== "proposed") return;

      const setStatus = (status: ActionCardState["status"], errMsg?: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  actions: m.actions.map((a, i) =>
                    i === cardIndex ? { ...a, status, error: errMsg } : a,
                  ),
                }
              : m,
          ),
        );

      setStatus("applying");
      try {
        const result = await onApplyAction(card.action);
        if (result.ok) setStatus("applied");
        else setStatus("failed", result.message ?? "Could not apply");
      } catch (err) {
        setStatus("failed", err instanceof Error ? err.message : "Could not apply");
      }
    },
    [messages, onApplyAction],
  );

  const dismissCard = useCallback((messageId: string, cardIndex: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              actions: m.actions.map((a, i) =>
                i === cardIndex ? { ...a, status: "dismissed" } : a,
              ),
            }
          : m,
      ),
    );
  }, []);

  if (!open) return null;

  return (
    <aside
      className="w-96 max-w-full border-l border-border bg-background flex flex-col shrink-0 motion-safe:animate-in motion-safe:slide-in-from-right"
      role="complementary"
      aria-label="Builder Copilot"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Ask AI</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
          aria-label="Close copilot"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground pt-8 px-4">
            <Sparkles className="w-6 h-6 text-primary/40 mx-auto mb-3" aria-hidden />
            <p className="font-medium text-foreground mb-1">Your landing-page copilot</p>
            <p className="leading-relaxed">
              Ask me to review your page, strengthen the hero, add social proof, fix a contrast
              issue, or tighten the copy. I&apos;ll propose edits you can apply with one click.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap break-words",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {m.content ||
                (m.streaming ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    Thinking…
                  </span>
                ) : (
                  ""
                ))}
            </div>

            {/* Action cards */}
            {m.actions.map((card, i) => (
              <ActionCard
                key={i}
                card={card}
                onApply={() => applyCard(m.id, i)}
                onDismiss={() => dismissCard(m.id, i)}
              />
            ))}
          </div>
        ))}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask the copilot…"
            className="flex-1 resize-none bg-transparent text-sm outline-none max-h-32 leading-relaxed"
            aria-label="Message the copilot"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            aria-label="Send"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ActionCard({
  card,
  onApply,
  onDismiss,
}: {
  card: ActionCardState;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const Icon = ACTION_ICON[card.action.type] ?? Sparkles;
  const dismissed = card.status === "dismissed";
  return (
    <div
      className={cn(
        "w-[85%] rounded-xl border px-3 py-2.5 text-sm",
        card.status === "applied"
          ? "border-green-300 bg-green-50"
          : card.status === "failed"
            ? "border-destructive/40 bg-destructive/5"
            : "border-primary/25 bg-primary/5",
        dismissed && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground leading-snug">{card.action.label}</p>
          {card.action.rationale && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{card.action.rationale}</p>
          )}
          {card.status === "failed" && card.error && (
            <p className="text-xs text-destructive mt-1">{card.error}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {card.status === "proposed" && (
              <>
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onApply}>
                  Apply
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>
                  Dismiss
                </Button>
              </>
            )}
            {card.status === "applying" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Applying…
              </span>
            )}
            {card.status === "applied" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium">
                <Check className="w-3.5 h-3.5" aria-hidden /> Applied
              </span>
            )}
            {card.status === "failed" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onApply}>
                Retry
              </Button>
            )}
            {card.status === "dismissed" && (
              <span className="text-xs text-muted-foreground">Dismissed</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
