/**
 * BlockChatCapture — the "chat-capture" lead bot block (June 2026 chatbot
 * spec, Bot 2).
 *
 * On a PUBLISHED page: portals a floating chat launcher to <body> (fixed
 * positioning must not be trapped by animated/transformed block wrappers).
 * The panel streams from the public POST /api/lp/chat-capture endpoint — the
 * shared conversation engine grounded on this page's own content + approved
 * brand facts. When the bot calls `capture_lead`, this block submits the
 * details through the SAME POST /api/lp/leads pipeline the form blocks use
 * (formId routing, notifications, integrations, UTM/session attribution all
 * apply unchanged) and confirms in-thread.
 *
 * In the BUILDER canvas: renders a static, selectable preview card instead —
 * no live model calls, no portal (the server would refuse anyway: the public
 * endpoint only serves published pages).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatCaptureBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import {
  streamCopilotChat,
  CopilotStreamError,
  type CopilotAction,
} from "@/lib/copilotStream";

const API_BASE = "/api";

interface Props {
  props: ChatCaptureBlockProps;
  brand?: BrandConfig;
  pageId?: number;
  testId?: number;
  variantId?: number;
  sessionId?: string;
  isBuilder?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set on the assistant message that triggered a lead submission. */
  captureState?: "sending" | "sent" | "failed";
  streaming?: boolean;
}

let seq = 0;
const nextId = () => `c${Date.now()}_${seq++}`;

function autoOpenKey(pageId: number): string {
  return `lp_chat_capture_opened_${pageId}`;
}

export function BlockChatCapture({
  props,
  brand,
  pageId,
  testId,
  variantId,
  sessionId,
  isBuilder,
}: Props) {
  const accent =
    (props.accentColor && isValidHex(props.accentColor) && props.accentColor) ||
    brand?.primaryColor ||
    "#4f46e5";
  const accentText = contrastTextColor(accent);
  const botName = props.botName?.trim() || "Assistant";
  const welcome = props.welcomeMessage?.trim() || `Hi! I'm ${botName} — ask me anything about this page.`;

  // ── Builder canvas: static preview card, no live chat ─────────────────────
  if (isBuilder) {
    return (
      <div className="max-w-md mx-auto my-6 rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent, color: accentText }}
          >
            <ChatIcon />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{botName} — lead-capture chat</p>
            <p className="text-xs text-gray-500">
              Floating launcher on the published page ({props.position === "bottom-left" ? "bottom left" : "bottom right"})
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">{welcome}</div>
        <p className="text-[11px] text-gray-400 mt-3">
          Answers only from this page&apos;s content and approved brand facts; captured contacts land in
          your Leads with your form routing.
        </p>
      </div>
    );
  }

  if (pageId == null) return null;

  return (
    <ChatCaptureLauncher
      blockProps={props}
      accent={accent}
      accentText={accentText}
      botName={botName}
      welcome={welcome}
      pageId={pageId}
      testId={testId}
      variantId={variantId}
      sessionId={sessionId}
    />
  );
}

function ChatCaptureLauncher({
  blockProps,
  accent,
  accentText,
  botName,
  welcome,
  pageId,
  testId,
  variantId,
  sessionId,
}: {
  blockProps: ChatCaptureBlockProps;
  accent: string;
  accentText: string;
  botName: string;
  welcome: string;
  pageId: number;
  testId?: number;
  variantId?: number;
  sessionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Emails already submitted in this conversation — the bot may re-call
  // capture_lead on later turns; identical resubmits show "sent" without
  // posting a duplicate lead (client-side dedupe; POST /lp/leads has no
  // idempotency column).
  const submittedEmailsRef = useRef<Set<string>>(new Set());
  const side = blockProps.position === "bottom-left" ? "left" : "right";

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: nextId(), role: "assistant", content: welcome }]);
    }
    if (open) inputRef.current?.focus();
  }, [open, messages.length, welcome]);

  // Proactive trigger: auto-open once per browser session.
  useEffect(() => {
    const delay = blockProps.autoOpenDelaySeconds ?? 0;
    if (!delay || delay <= 0) return;
    let opened = false;
    try {
      opened = sessionStorage.getItem(autoOpenKey(pageId)) === "1";
    } catch {
      /* storage unavailable — treat as not opened */
    }
    if (opened) return;
    const t = setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(autoOpenKey(pageId), "1");
      } catch {
        /* ignore */
      }
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [blockProps.autoOpenDelaySeconds, pageId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Lead submission — same pipeline as BlockForm (POST /lp/leads) ─────────
  const submitLead = useCallback(
    async (action: CopilotAction, assistantId: string) => {
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const email = str(action.args?.email);
      if (!email || !email.includes("@")) return;

      const setCapture = (captureState: ChatMessage["captureState"]) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, captureState } : m)),
        );

      // Same email already sent this conversation — confirm without a
      // duplicate lead row.
      if (submittedEmailsRef.current.has(email.toLowerCase())) {
        setCapture("sent");
        return;
      }
      setCapture("sending");

      const fields: Record<string, string> = { Email: email, Source: "Page chat" };
      const name = str(action.args?.name);
      const company = str(action.args?.company);
      const phone = str(action.args?.phone);
      const notes = str(action.args?.notes);
      if (name) fields["Name"] = name;
      if (company) fields["Company"] = company;
      if (phone) fields["Phone"] = phone;
      if (notes) fields["Chat Summary"] = notes;

      // UTM params from the page URL, same keys BlockForm forwards; the server
      // additionally falls back to session/visit attribution.
      const urlParams = new URLSearchParams(window.location.search);
      const utmBody: Record<string, string> = {};
      const UTM_KEYS: [string, string][] = [
        ["utm_source", "utmSource"],
        ["utm_medium", "utmMedium"],
        ["utm_campaign", "utmCampaign"],
        ["utm_term", "utmTerm"],
        ["utm_content", "utmContent"],
      ];
      for (const [param, key] of UTM_KEYS) {
        const val = urlParams.get(param);
        if (val) utmBody[key] = val;
      }

      const body: Record<string, unknown> = { pageId, fields, ...utmBody };
      if (variantId != null) body.variantId = variantId;
      if (sessionId) body.sessionId = sessionId;
      if (blockProps.formId != null) body.formId = blockProps.formId;

      try {
        const resp = await fetch(`${API_BASE}/lp/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error("Submission failed");
        submittedEmailsRef.current.add(email.toLowerCase());
        setCapture("sent");

        // Conversion tracking — mirrors BlockForm (null-safe test/variant).
        try {
          const trackBody: Record<string, unknown> = {
            sessionId,
            eventType: "conversion",
            conversionType: "form_submit",
          };
          if (testId != null) trackBody.testId = testId;
          if (variantId != null) trackBody.variantId = variantId;
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackBody),
          });
        } catch {
          /* analytics must never break the capture */
        }
      } catch {
        setCapture("failed");
      }
    },
    [pageId, testId, variantId, sessionId, blockProps.formId],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");

    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const done = await streamCopilotChat(
        { conversationId, pageId, sessionId, userMessage: text },
        {
          onToken: (t) =>
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + t } : m)),
            ),
          onAction: (action) => {
            if (action.type === "capture_lead") void submitLead(action, assistantId);
          },
        },
        controller.signal,
        { endpoint: `${API_BASE}/lp/chat-capture` },
      );
      setConversationId(done.conversationId);
      // The model sometimes emits ONLY the capture_lead tool call, no prose —
      // an empty bubble reads as broken. Backfill a confirmation when a
      // capture rode on this turn; drop the bubble entirely otherwise.
      setMessages((prev) =>
        prev.flatMap((m) => {
          if (m.id !== assistantId) return [m];
          if (m.content.trim() !== "") return [{ ...m, streaming: false }];
          if (m.captureState) {
            return [{ ...m, streaming: false, content: "Perfect — I've passed your details to the team. Anything else I can help with?" }];
          }
          return [];
        }),
      );
    } catch (err) {
      const e = err as CopilotStreamError;
      if (e.kind === "aborted") {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === "")),
        );
      } else {
        setError(
          e.status === 429
            ? "Chat is busy right now — please use the form on this page instead."
            : "Sorry, the chat hit a snag — please try again or use the form on this page.",
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, conversationId, pageId, sessionId, submitLead]);

  const sideStyle = side === "left" ? { left: 16 } : { right: 16 };

  return createPortal(
    <div style={{ position: "fixed", bottom: 16, zIndex: 2147483000, ...sideStyle }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${botName}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            borderRadius: 999,
            padding: blockProps.launcherLabel ? "12px 18px" : 14,
            backgroundColor: accent,
            color: accentText,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            font: "600 14px/1 Inter, system-ui, sans-serif",
          }}
        >
          <ChatIcon />
          {blockProps.launcherLabel ? <span>{blockProps.launcherLabel}</span> : null}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${botName}`}
          style={{
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            height: 520,
            maxHeight: "calc(100vh - 32px)",
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#ffffff",
            boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              backgroundColor: accent,
              color: accentText,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
              <ChatIcon />
              {botName}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                border: "none",
                background: "transparent",
                color: accentText,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Thread */}
          <div
            ref={threadRef}
            aria-live="polite"
            style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
          >
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "9px 13px",
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    ...(m.role === "user"
                      ? { backgroundColor: accent, color: accentText, borderBottomRightRadius: 4 }
                      : { backgroundColor: "#f3f4f6", color: "#111827", borderBottomLeftRadius: 4 }),
                  }}
                >
                  {m.content || (m.streaming ? "…" : "")}
                </div>
                {m.captureState === "sent" && (
                  <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Sent to the team</span>
                )}
                {m.captureState === "failed" && (
                  <span style={{ fontSize: 11, color: "#dc2626" }}>
                    Couldn&apos;t send — please use the form on this page.
                  </span>
                )}
              </div>
            ))}
            {error && (
              <div role="alert" style={{ fontSize: 12, color: "#dc2626", backgroundColor: "#fef2f2", borderRadius: 8, padding: "8px 10px" }}>
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{ borderTop: "1px solid #e5e7eb", padding: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
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
                placeholder="Type your question…"
                aria-label="Type your question"
                style={{
                  flex: 1,
                  resize: "none",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "9px 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  maxHeight: 96,
                }}
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                aria-label="Send"
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 12px",
                  backgroundColor: accent,
                  color: accentText,
                  cursor: busy || !input.trim() ? "default" : "pointer",
                  opacity: busy || !input.trim() ? 0.5 : 1,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
            {blockProps.consentText?.trim() ? (
              <p style={{ margin: "8px 2px 0", fontSize: 10.5, lineHeight: 1.4, color: "#9ca3af" }}>
                {blockProps.consentText}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
