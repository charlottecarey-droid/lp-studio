/**
 * ConversationEngine — the shared, mode-configurable streaming chat runner
 * (June 2026 LP Studio chatbot spec).
 *
 * The strategic bet from the spec: build ONE conversation service and configure
 * it per surface, not three separate features. A `ConversationMode` is a config
 * object — persona/system prompt, a grounding builder (what the bot is allowed
 * to KNOW and ASSERT), the structured actions it may PROPOSE, and a goal. v1
 * ships exactly one mode (Builder Copilot, modes/builderCopilot.ts); adding a
 * mode is a new config, never a new engine.
 *
 * The engine:
 *   1. assembles messages = [system(persona+grounding+strict-facts), …history],
 *   2. calls OpenAI with `stream: true` INSIDE a concurrency semaphore (mirrors
 *      generate-page's generateOpenAISemaphore), forwarding each text delta to
 *      the ChatEmitter as a `token` event,
 *   3. when the model emits tool calls (OpenAI function-calling — preferred and
 *      more robust than fenced JSON given the existing tool-less generate-page
 *      code), coerces each into a validated CopilotAction and streams an
 *      `action` event; a fenced-JSON fallback catches proxies that drop tools,
 *   4. returns the assembled assistant text + the proposed actions so the route
 *      can persist the turn.
 *
 * Strict-facts: the MODE's grounding builder is responsible for injecting ONLY
 * approved facts; the engine additionally appends a hard system rule forbidding
 * invented stats/claims (STRICT_FACTS_RULE) so every mode inherits the guard.
 */
import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { makeSemaphore, envConcurrency } from "../semaphore";
import { logger } from "../logger";
import {
  type AllowedActionDef,
  type CopilotAction,
  buildToolDefs,
  actionFromToolCall,
  parseFencedActions,
  stripFencedActions,
} from "./actions";
import type { ChatEmitter } from "./chatEmitter";

/** A chat turn from the persisted transcript / current request. */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** The runtime context a mode's prompt/grounding builders receive. Generic
 *  bag — Builder Copilot reads `pageBlocks` + `brand`; future modes read
 *  whatever they need. Kept `unknown`-typed here so the engine never couples to
 *  a specific surface. */
export interface ConversationContext {
  tenantId: number;
  pageId: number | null;
  [key: string]: unknown;
}

/**
 * A configured conversational surface. Everything that differs between bots
 * lives here; the engine is mode-agnostic.
 */
export interface ConversationMode {
  /** Stable id persisted as conversations.mode (e.g. "builder_copilot"). */
  id: string;
  /** Build the persona / instruction block (no grounding facts — those come
   *  from groundingBuilder so the two concerns stay separable + testable). */
  systemPromptBuilder: (ctx: ConversationContext) => string;
  /** Build the grounding text the bot MAY use — for copilot: the page block
   *  summary + brand context + block catalog + recipe heuristics. MUST contain
   *  only approved facts (strict-facts). PURE + synchronous so it's unit-
   *  testable; any async fetching happens in the route before calling. */
  groundingBuilder: (ctx: ConversationContext) => string;
  /** Structured actions the bot may PROPOSE (constrained per mode). Empty =
   *  advice-only mode. */
  allowedActions: AllowedActionDef[];
  /** One-line statement of what a successful turn achieves (folded into the
   *  system prompt). */
  goal: string;
  /** How the surface treats proposed actions, folded into the system prompt
   *  when allowedActions is non-empty. Defaults to the builder-copilot
   *  contract (user reviews + applies each card); modes whose actions execute
   *  differently (e.g. lead capture submits on call) override this. */
  actionInstruction?: string;
}

/** Hard, mode-independent strict-facts rule appended to every system prompt. */
export const STRICT_FACTS_RULE =
  "STRICT FACTS: You may ONLY state statistics, metrics, customer quotes, " +
  "guarantees, and specific claims that appear verbatim in the grounding " +
  "context above. Never invent, estimate, round, or embellish a number, " +
  "percentage, award, certification, or testimonial. If a fact you'd want to " +
  "cite isn't in the context, say you don't have it rather than guessing.";

/** OpenAI CHAT concurrency cap for the conversation engine — same primitive +
 *  env-override pattern as generate-page's generateOpenAISemaphore, separate
 *  pool so copilot traffic and page generation don't starve each other. */
const conversationOpenAISemaphore = makeSemaphore({
  name: "conversation-openai",
  max: envConcurrency("CONVERSATION_OPENAI_CONCURRENCY", 8),
  warnQueueDepth: 3,
});

const CONVERSATION_MODEL = process.env["CONVERSATION_MODEL"] ?? "gpt-4o";

/** Result of one engine turn — the route persists this as an assistant
 *  message. */
export interface ConversationTurnResult {
  /** The assistant's prose (fenced action blocks stripped). */
  text: string;
  /** The structured actions the bot proposed this turn. */
  actions: CopilotAction[];
}

export interface RunConversationTurnOpts {
  client: OpenAI;
  mode: ConversationMode;
  context: ConversationContext;
  /** Prior turns (oldest-first) + the new user message as the last entry. */
  history: ConversationTurn[];
  emitter: ChatEmitter;
}

/** Assemble the system message: persona + goal + grounding + strict-facts. */
export function buildSystemMessage(mode: ConversationMode, ctx: ConversationContext): string {
  const persona = mode.systemPromptBuilder(ctx).trim();
  const grounding = mode.groundingBuilder(ctx).trim();
  const parts = [
    persona,
    `GOAL: ${mode.goal}`,
    grounding ? `CONTEXT (the only facts you may rely on):\n${grounding}` : "",
    STRICT_FACTS_RULE,
  ].filter(Boolean);
  if (mode.allowedActions.length > 0) {
    parts.push(
      mode.actionInstruction ??
        "When you recommend a concrete edit to the page, PROPOSE it by calling the " +
          "matching tool — do not describe the JSON in prose. The user reviews and " +
          "applies each proposal; nothing you propose is applied automatically. " +
          "You may propose multiple edits in one reply. Keep your prose brief and " +
          "conversational; let the action cards carry the specifics.",
    );
  }
  return parts.join("\n\n");
}

/** Assemble the full OpenAI message array for a turn. */
export function buildMessages(
  mode: ConversationMode,
  ctx: ConversationContext,
  history: ConversationTurn[],
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemMessage(mode, ctx) },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }
  return messages;
}

/**
 * Run one streaming conversation turn. Streams `token`/`action` events on the
 * emitter as they arrive and resolves with the assembled text + actions. The
 * emitter's `done`/`error` terminal events are emitted by the ROUTE (it needs
 * to persist first and attach the message id), not here.
 */
export async function runConversationTurn(
  opts: RunConversationTurnOpts,
): Promise<ConversationTurnResult> {
  const { client, mode, context, history, emitter } = opts;
  const messages = buildMessages(mode, context, history);
  const tools: ChatCompletionTool[] =
    mode.allowedActions.length > 0
      ? (buildToolDefs(mode.allowedActions) as unknown as ChatCompletionTool[])
      : [];

  // Accumulate streamed text + tool calls. OpenAI streams tool-call args in
  // fragments keyed by index, so we stitch by index.
  let text = "";
  const toolAcc = new Map<number, { name: string; args: string }>();

  await conversationOpenAISemaphore.run(async () => {
    const stream = await client.chat.completions.create(
      {
        model: CONVERSATION_MODEL,
        temperature: 0.7,
        max_completion_tokens: 2048,
        messages,
        stream: true,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
      },
      emitter.signal ? { signal: emitter.signal } : undefined,
    );

    for await (const chunk of stream) {
      if (emitter.aborted) break;
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      if (!delta) continue;

      const content = delta.content ?? "";
      if (content) {
        text += content;
        emitter.token(content);
      }

      const toolCalls = delta.tool_calls ?? [];
      for (const tc of toolCalls) {
        const idx = tc.index ?? 0;
        const cur = toolAcc.get(idx) ?? { name: "", args: "" };
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        toolAcc.set(idx, cur);
      }
    }
  });

  // Coerce accumulated tool calls into validated actions.
  const actions: CopilotAction[] = [];
  for (const { name, args } of toolAcc.values()) {
    if (!name) continue;
    const action = actionFromToolCall(name, args, mode.allowedActions);
    if (action) {
      actions.push(action);
    } else {
      logger.warn({ name, mode: mode.id }, "[copilot] dropped unparseable/forbidden tool call");
    }
  }

  // Fallback: some proxies ignore tool-calling and emit fenced action JSON in
  // the text. Only mine the text when no tool actions arrived, to avoid
  // double-counting.
  if (actions.length === 0 && mode.allowedActions.length > 0) {
    const fenced = parseFencedActions(text, mode.allowedActions);
    actions.push(...fenced);
  }

  // Emit each proposed action AFTER the prose has streamed, so the panel can
  // render action cards beneath the assistant bubble.
  for (const action of actions) {
    if (emitter.aborted) break;
    emitter.action(action);
  }

  return { text: stripFencedActions(text), actions };
}
