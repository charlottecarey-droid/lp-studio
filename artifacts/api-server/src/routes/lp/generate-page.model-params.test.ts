/**
 * Per-path generation model + temperature guard at the shared streamed call
 * (Oct 2026, generation-quality step 2). The helper is the one place both
 * generators' streaming calls pass through, so it is where the env-resolved
 * model and the gpt-5 / o-series "no temperature" rule are observable.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { runStreamedChatCompletion } from "./generate-page";

type Captured = Record<string, unknown>;

function fakeClient(captured: Captured[]) {
  return {
    chat: {
      completions: {
        create: async (params: Captured) => {
          captured.push(params);
          return (async function* () {
            yield { choices: [{ delta: { content: '{"ok":true}' }, finish_reason: "stop" }] };
          })();
        },
      },
    },
  } as unknown as Parameters<typeof runStreamedChatCompletion>[0]["client"];
}

afterEach(() => vi.unstubAllEnvs());

describe("runStreamedChatCompletion — model + sampling params", () => {
  it("defaults to gpt-4o with the tuned temperature when nothing is configured", async () => {
    vi.stubEnv("GENERATION_MODEL", "");
    vi.stubEnv("GENERATION_MODEL_GENERAL", "");
    const captured: Captured[] = [];
    const out = await runStreamedChatCompletion({ client: fakeClient(captured), messages: [] });
    expect(out.text).toBe('{"ok":true}');
    expect(captured[0].model).toBe("gpt-4o");
    expect(captured[0].temperature).toBe(0.7);
    expect(captured[0].stream).toBe(true);
  });

  it("reads the GENERAL path model from the environment", async () => {
    vi.stubEnv("GENERATION_MODEL_GENERAL", "gpt-4.1");
    const captured: Captured[] = [];
    await runStreamedChatCompletion({ client: fakeClient(captured), messages: [] });
    expect(captured[0].model).toBe("gpt-4.1");
    expect(captured[0].temperature).toBe(0.7);
  });

  it("omits temperature for a gpt-5-family model, whether env-resolved or passed by the caller", async () => {
    vi.stubEnv("GENERATION_MODEL_GENERAL", "gpt-5");
    const captured: Captured[] = [];
    await runStreamedChatCompletion({ client: fakeClient(captured), messages: [] });
    expect(captured[0].model).toBe("gpt-5");
    expect(captured[0]).not.toHaveProperty("temperature");
    // Microsite-style explicit override (model + temperature passed in).
    await runStreamedChatCompletion({ client: fakeClient(captured), messages: [], model: "gpt-5-mini", temperature: 0.5 });
    expect(captured[1].model).toBe("gpt-5-mini");
    expect(captured[1]).not.toHaveProperty("temperature");
    // A caller-passed gpt-4o keeps its temperature.
    await runStreamedChatCompletion({ client: fakeClient(captured), messages: [], model: "gpt-4o", temperature: 0.5 });
    expect(captured[2].temperature).toBe(0.5);
  });
});
