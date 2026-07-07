/**
 * SupportChatWidget — the in-app help bot (June 2026 chatbot spec, Bot 3).
 *
 * A floating "?" launcher in the bottom-right of every authenticated app page
 * (mounted in App.tsx next to DevToolsPanel; hidden in the builder, which has
 * its own Ask AI panel). Opens a chat card that streams from
 * POST /api/lp/support/chat — the shared conversation engine grounded on the
 * LP Studio user guide. Two action types can arrive:
 *   open_page            → "Take me there" navigates to the in-app route
 *   escalate_to_support  → "Email the team" opens a prefilled support email
 * Both are user-confirmed buttons; nothing navigates or sends on its own.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  HelpCircle,
  X,
  Send,
  Loader2,
  ArrowRight,
  Mail,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  streamCopilotChat,
  CopilotStreamError,
  type CopilotAction,
} from "@/lib/copilotStream";

// The address the marketing site publishes for support/integration requests
// (see marketing/pages/integrations-docs.tsx + terms.tsx).
const SUPPORT_EMAIL = "admin@lpstudio.ai";

const SUGGESTIONS = [
  "How do I publish to a custom domain?",
  "Where do my form leads go?",
  "How do I import my brand from my website?",
  "How does A/B testing work?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: CopilotAction[];
  streaming?: boolean;
}

let seq = 0;
const nextId = () => `s${Date.now()}_${seq++}`;

/** Paths the open_page action may navigate to: absolute, same-app, no
 *  protocol/host — everything else renders as plain text advice. */
function isSafeAppPath(path: unknown): path is string {
  return typeof path === "string" && /^\/[a-zA-Z0-9\-_/]*$/.test(path) && !path.startsWith("//");
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || busy) return;
      setError(null);
      setInput("");

      const userMsg: ChatMessage = { id: nextId(), role: "user", content: text, actions: [] };
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", actions: [], streaming: true },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const done = await streamCopilotChat(
          { conversationId, userMessage: text, currentPath: location },
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
          { endpoint: "/api/lp/support/chat" },
        );
        setConversationId(done.conversationId);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
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
    [input, busy, conversationId, location],
  );

  // The builder has its own Ask AI panel and a crowded canvas — stay out.
  if (location.startsWith("/builder")) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          aria-label="Help and support"
        >
          <HelpCircle className="w-5 h-5" aria-hidden />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-2rem)] rounded-xl border border-border bg-background shadow-2xl flex flex-col motion-safe:animate-in motion-safe:slide-in-from-bottom-4"
          role="dialog"
          aria-label="Help and support chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold">Help &amp; support</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
              aria-label="Close help"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Thread */}
          <div
            ref={threadRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground pt-6 px-2">
                <LifeBuoy className="w-6 h-6 text-primary/40 mx-auto mb-3" aria-hidden />
                <p className="font-medium text-foreground mb-1">How can we help?</p>
                <p className="leading-relaxed">
                  Ask anything about using LP Studio — I answer from the user guide and can take
                  you straight to the right page.
                </p>
                <div className="flex flex-col items-stretch gap-1.5 mt-4">
                  {SUGGESTIONS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => void send(chip)}
                      disabled={busy}
                      className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-left text-foreground hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-40"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}
              >
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

                {m.actions.map((action, i) => (
                  <SupportActionButton
                    key={i}
                    action={action}
                    onNavigate={(path) => {
                      setOpen(false);
                      setLocation(path);
                    }}
                  />
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
                placeholder="Ask about LP Studio…"
                className="flex-1 resize-none bg-transparent text-sm outline-none max-h-32 leading-relaxed"
                aria-label="Ask a support question"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                aria-label="Send"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SupportActionButton({
  action,
  onNavigate,
}: {
  action: CopilotAction;
  onNavigate: (path: string) => void;
}) {
  if (action.type === "open_page") {
    const path = action.args?.path;
    if (!isSafeAppPath(path)) return null;
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onNavigate(path)}>
        {action.label || "Take me there"}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Button>
    );
  }
  if (action.type === "escalate_to_support") {
    const summary = typeof action.args?.summary === "string" ? action.args.summary : "";
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      "LP Studio support request",
    )}&body=${encodeURIComponent(summary)}`;
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
        <a href={href}>
          <Mail className="w-3.5 h-3.5" aria-hidden />
          {action.label || "Email the team"}
        </a>
      </Button>
    );
  }
  return null;
}
