/**
 * SalesAssistantBar — the sales console's "What would you like to do today?"
 * prompt box (July 2026). Mounted at the top of the sales dashboard.
 *
 * Streams from POST /api/sales/assistant/chat (shared conversation engine,
 * sales_assistant mode). The bot proposes executable action cards:
 *   generate_microsite → mounts GenerateMicrositeModal preset to the account
 *   create_one_pager   → /sales/one-pager?accountId=… (seeds the generator)
 *   draft_email        → /sales/draft-email/:contactId (auto-selects contact)
 *   open_page          → navigates to a validated /sales path
 * Every card is click-to-run — the bot proposes, the rep confirms. Ids and
 * paths are validated here again before anything executes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles,
  Send,
  Loader2,
  Globe,
  FileText,
  Mail,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GenerateMicrositeModal } from "@/components/sales/GenerateMicrositeModal";
import {
  streamCopilotChat,
  CopilotStreamError,
  type CopilotAction,
} from "@/lib/copilotStream";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: CopilotAction[];
  streaming?: boolean;
}

let seq = 0;
const nextId = () => `sa${Date.now()}_${seq++}`;

/** Same-app sales paths only — no protocol, no host, no double slashes. */
function isSafeSalesPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /^\/sales(\/[a-zA-Z0-9\-]+)*(\/\d+)?(\?tab=[a-z]+)?$/.test(path) &&
    !path.includes("//")
  );
}

const posInt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;

/** Chips ending in "…" seed the composer (they need an entity typed in);
 *  complete questions send immediately. */
const CHIPS = [
  "Build a microsite for …",
  "Draft an email to …",
  "Start a one-pager for …",
  "Browse and clone a template",
];

export function SalesAssistantBar() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [micrositeTarget, setMicrositeTarget] = useState<{ accountId: number; accountName: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const open = messages.length > 0;

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || busy) return;
      setError(null);
      setInput("");

      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: text, actions: [] },
        { id: assistantId, role: "assistant", content: "", actions: [], streaming: true },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const done = await streamCopilotChat(
          { conversationId, userMessage: text },
          {
            onToken: (t) =>
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + t } : m)),
              ),
            onAction: (action) =>
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, actions: [...m.actions, action] } : m,
                ),
              ),
          },
          controller.signal,
          { endpoint: "/api/sales/assistant/chat" },
        );
        setConversationId(done.conversationId);
        setMessages((prev) =>
          prev.flatMap((m) => {
            if (m.id !== assistantId) return [m];
            // Action-only turns are normal here — drop the empty bubble and
            // let the card speak.
            if (m.content.trim() === "" && m.actions.length === 0) return [];
            return [{ ...m, streaming: false }];
          }),
        );
      } catch (err) {
        const e = err as CopilotStreamError;
        if (e.kind === "aborted") {
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
    },
    [input, busy, conversationId],
  );

  const runAction = useCallback(
    (action: CopilotAction) => {
      const a = action.args ?? {};
      switch (action.type) {
        case "generate_microsite": {
          const accountId = posInt(a.accountId);
          const accountName = typeof a.accountName === "string" ? a.accountName : "";
          if (accountId != null) setMicrositeTarget({ accountId, accountName });
          break;
        }
        case "create_one_pager": {
          const accountId = posInt(a.accountId);
          if (accountId != null) setLocation(`/sales/one-pager?accountId=${accountId}`);
          break;
        }
        case "draft_email": {
          const contactId = posInt(a.contactId);
          if (contactId != null) setLocation(`/sales/draft-email/${contactId}`);
          break;
        }
        case "open_page": {
          if (isSafeSalesPath(a.path)) setLocation(a.path);
          break;
        }
      }
    },
    [setLocation],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setBusy(false);
  }, []);

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Prompt row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="What would you like to do today?"
          aria-label="Ask the sales assistant"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {open && (
          <button
            onClick={reset}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
            aria-label="Clear conversation"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        )}
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          aria-label="Send"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
        </button>
      </div>

      {/* Suggestion chips (idle state) */}
      {!open && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {CHIPS.map((chip) => {
            const isTemplate = chip.endsWith("…");
            return (
              <button
                key={chip}
                onClick={() => {
                  if (isTemplate) {
                    setInput(chip.replace("…", ""));
                    inputRef.current?.focus();
                  } else {
                    void send(chip);
                  }
                }}
                disabled={busy}
                className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-foreground hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-40"
              >
                {chip}
              </button>
            );
          })}
        </div>
      )}

      {/* Thread */}
      {open && (
        <div
          ref={threadRef}
          className="border-t border-border/60 max-h-80 overflow-y-auto px-4 py-3 space-y-3"
          aria-live="polite"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "rounded-xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {m.content ||
                  (m.streaming ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      Working…
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
              {m.actions.map((action, i) => (
                <AssistantActionButton key={i} action={action} onRun={() => runAction(action)} />
              ))}
            </div>
          ))}
          {error && (
            <div
              className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      )}

      {micrositeTarget && (
        <GenerateMicrositeModal
          open
          onClose={() => setMicrositeTarget(null)}
          accountId={String(micrositeTarget.accountId)}
          accountName={micrositeTarget.accountName}
        />
      )}
    </div>
  );
}

const ACTION_ICON: Record<string, typeof Globe> = {
  generate_microsite: Globe,
  create_one_pager: FileText,
  draft_email: Mail,
  open_page: ArrowRight,
};

function AssistantActionButton({ action, onRun }: { action: CopilotAction; onRun: () => void }) {
  // Validate before offering the button at all — a card that would no-op is
  // worse than no card.
  const a = action.args ?? {};
  const valid =
    (action.type === "generate_microsite" && posInt(a.accountId) != null) ||
    (action.type === "create_one_pager" && posInt(a.accountId) != null) ||
    (action.type === "draft_email" && posInt(a.contactId) != null) ||
    (action.type === "open_page" && isSafeSalesPath(a.path));
  if (!valid) return null;
  const Icon = ACTION_ICON[action.type] ?? ArrowRight;
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onRun}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {action.label || "Go"}
    </Button>
  );
}
