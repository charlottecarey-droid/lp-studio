import { describe, it, expect, vi, afterEach } from "vitest";
import { critiqueAndRewriteBlocks } from "./critique-pass";
import { findBannedPhrases } from "./banned-phrase-validator";

afterEach(() => {
  vi.unstubAllEnvs();
});

type ChatCreate = (...args: unknown[]) => Promise<unknown>;

function fakeOpenAI(create: ChatCreate) {
  return { chat: { completions: { create } } } as unknown as Parameters<typeof critiqueAndRewriteBlocks>[0]["openai"];
}

function jsonCompletion(obj: unknown) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] };
}

describe("critiqueAndRewriteBlocks", () => {
  it("runs a MANDATORY critique on the copy-heaviest blocks even with zero banned-phrase hits", async () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          headline: "A generic headline about a platform for teams that want outcomes",
          subheadline: "Some long but vague supporting copy that says very little concretely.",
        },
      },
      { id: "b2", type: "footer", props: { copyrightText: "© 2026" } },
    ];
    const create = vi.fn(async (req: unknown) => {
      const body = req as { messages: Array<{ content: string }> };
      const userMsg = body.messages[1].content;
      // The copy-heavy block is targeted; the tiny footer is not.
      expect(userMsg).toContain('"id":"b1"');
      expect(userMsg).not.toContain('"id":"b2"');
      // With no hits, the prompt asks for a general tightening pass.
      expect(userMsg).toContain("No specific banned phrases were detected");
      return jsonCompletion({
        blocks: [
          {
            id: "b1",
            props: {
              headline: "Crowns shipped in five days flat",
              subheadline: "Every case auto-checked before it ships — 96% first-time fit.",
            },
          },
        ],
      });
    });
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: [],
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(res.critiqued).toBe(true);
    expect(res.annotations).toHaveLength(1);
    expect(res.annotations[0].blockId).toBe("b1");
    expect(res.annotations[0].removedPhrases).toEqual([]);
    expect((blocks[0].props as Record<string, unknown>).headline).toBe("Crowns shipped in five days flat");
  });

  it("no-ops when every block is too copy-light to critique (and no hits)", async () => {
    const create = vi.fn();
    const blocks = [{ id: "b1", type: "footer", props: { copyrightText: "© 2026" } }];
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: [],
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    expect(res.critiqued).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("no-ops when CRITIQUE_PASS_DISABLED=1 (env escape hatch)", async () => {
    vi.stubEnv("CRITIQUE_PASS_DISABLED", "1");
    const create = vi.fn();
    const blocks = [{ id: "b1", type: "hero", props: { headline: "Our industry-leading platform for teams" } }];
    const hits = findBannedPhrases(blocks);
    expect(hits.length).toBeGreaterThan(0);
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    expect(res.critiqued).toBe(false);
    expect(res.annotations).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("no-ops when openai is null", async () => {
    const blocks = [{ id: "b1", type: "hero", props: { headline: "industry-leading platform" } }];
    const hits = findBannedPhrases(blocks);
    const res = await critiqueAndRewriteBlocks({ blocks, bannedPhraseHits: hits, brand: {}, openai: null });
    expect(res.critiqued).toBe(false);
  });

  it("rewrites only string leaves and preserves structure (colors/urls/numbers)", async () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          headline: "Our industry-leading platform",
          ctaColor: "#C7E738",
          ctaUrl: "https://example.com/demo",
          order: 1,
          nested: { sub: "we empower your team", flag: true },
        },
      },
    ];
    const hits = findBannedPhrases(blocks);
    expect(hits.length).toBeGreaterThan(0);

    const create = vi.fn(async () =>
      jsonCompletion({
        blocks: [
          {
            id: "b1",
            props: {
              headline: "Crowns shipped in five days flat",
              ctaColor: "#000000", // must be IGNORED (non-copy field)
              ctaUrl: "https://evil.example/phish", // must be IGNORED
              order: 99, // must be IGNORED
              nested: { sub: "your lab work, done right", flag: false },
              extraKey: "should not be added",
            },
          },
        ],
      }),
    );

    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });

    expect(res.critiqued).toBe(true);
    const props = (blocks[0].props as Record<string, unknown>);
    expect(props.headline).toBe("Crowns shipped in five days flat");
    expect((props.nested as Record<string, unknown>).sub).toBe("your lab work, done right");
    // Non-string / structural fields are NOT touched.
    expect(props.ctaColor).toBe("#C7E738");
    expect(props.ctaUrl).toBe("https://example.com/demo");
    expect(props.order).toBe(1);
    expect((props.nested as Record<string, unknown>).flag).toBe(true);
    // No new keys were introduced.
    expect("extraKey" in props).toBe(false);
    // Annotation reports the rewrite resolved the cliché.
    expect(res.annotations).toHaveLength(1);
    expect(res.annotations[0].blockId).toBe("b1");
    expect(res.annotations[0].resolved).toBe(true);
  });

  it("never overwrites link/cta/contact values, even under copy-looking keys", async () => {
    const blocks = [
      {
        id: "b1",
        type: "footer",
        props: {
          headline: "Our industry-leading network", // cliché → should be rewritten
          link: "https://acme.example/contact", // bare 'link' key
          cta: "#book-demo",
          contactEmail: "sales@acme.example",
          phone: "+1-555-0100",
          columns: [
            { label: "world-class results", url: "https://acme.example/results" },
          ],
          plainCta: "Get a demo", // copy that happens to be near a cta key name
        },
      },
    ];
    const hits = findBannedPhrases(blocks);
    const create = vi.fn(async () =>
      jsonCompletion({
        blocks: [
          {
            id: "b1",
            props: {
              headline: "Crowns in five days, every time",
              link: "https://evil.example/phish", // must be IGNORED (urlish + key)
              cta: "https://evil.example/redirect", // must be IGNORED
              contactEmail: "attacker@evil.example", // must be IGNORED (key)
              phone: "+1-900-SCAM", // must be IGNORED (key)
              columns: [
                { label: "96% first-time fit rate", url: "https://evil.example/x" },
              ],
              plainCta: "https://evil.example/y", // urlish value → must be IGNORED
            },
          },
        ],
      }),
    );
    await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.headline).toBe("Crowns in five days, every time"); // copy rewritten
    expect(props.link).toBe("https://acme.example/contact");
    expect(props.cta).toBe("#book-demo");
    expect(props.contactEmail).toBe("sales@acme.example");
    expect(props.phone).toBe("+1-555-0100");
    expect(props.plainCta).toBe("Get a demo"); // urlish replacement rejected, original kept
    const col = (props.columns as Array<Record<string, unknown>>)[0];
    expect(col.label).toBe("96% first-time fit rate"); // nested copy rewritten
    expect(col.url).toBe("https://acme.example/results"); // nested url protected
  });

  it("limits the rewrite to the worst maxBlocks blocks", async () => {
    const blocks = [
      { id: "b1", type: "x", props: { t: "industry-leading world-class best-in-class" } },
      { id: "b2", type: "x", props: { t: "synergy" } },
      { id: "b3", type: "x", props: { t: "clean copy" } },
    ];
    const hits = findBannedPhrases(blocks);
    const create = vi.fn(async (req: unknown) => {
      const body = req as { messages: Array<{ content: string }> };
      const userMsg = body.messages[1].content;
      // Only the two worst blocks (b1, b2) should be sent for rewrite.
      expect(userMsg).toContain('"id":"b1"');
      expect(userMsg).toContain('"id":"b2"');
      expect(userMsg).not.toContain('"id":"b3"');
      return jsonCompletion({
        blocks: [
          { id: "b1", props: { t: "specific concrete value" } },
          { id: "b2", props: { t: "real measurable outcome" } },
        ],
      });
    });
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
      maxBlocks: 2,
    });
    expect(res.annotations.map((a) => a.blockId).sort()).toEqual(["b1", "b2"]);
  });

  it("fails open (returns originals) when the model errors or times out", async () => {
    const blocks = [{ id: "b1", type: "hero", props: { headline: "industry-leading platform" } }];
    const hits = findBannedPhrases(blocks);
    const create = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    expect(res.critiqued).toBe(false);
    expect((blocks[0].props as Record<string, unknown>).headline).toBe("industry-leading platform");
  });

  it("fails open when the model returns malformed JSON", async () => {
    const blocks = [{ id: "b1", type: "hero", props: { headline: "world-class synergy" } }];
    const hits = findBannedPhrases(blocks);
    const create = vi.fn(async () => ({ choices: [{ message: { content: "not json {" } }] }));
    const res = await critiqueAndRewriteBlocks({
      blocks,
      bannedPhraseHits: hits,
      brand: {},
      openai: fakeOpenAI(create as unknown as ChatCreate),
    });
    expect(res.critiqued).toBe(false);
    expect((blocks[0].props as Record<string, unknown>).headline).toBe("world-class synergy");
  });
});
