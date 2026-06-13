/**
 * Unit coverage for the conversation-engine action contract — tool-schema
 * derivation, tool-call coercion/validation, the fenced-JSON fallback parser,
 * and prose stripping. All pure functions, no OpenAI/Express.
 */
import { describe, it, expect } from "vitest";
import {
  buildToolDefs,
  actionFromToolCall,
  parseFencedActions,
  stripFencedActions,
  type AllowedActionDef,
} from "./actions";

const ALLOWED: AllowedActionDef[] = [
  {
    type: "insert_block",
    description: "Insert a block",
    properties: {
      type: { type: "string" },
      afterBlockId: { type: "string" },
    },
    required: ["type", "afterBlockId"],
  },
  {
    type: "remove_block",
    description: "Remove a block",
    properties: { blockId: { type: "string" } },
    required: ["blockId"],
  },
];

describe("buildToolDefs", () => {
  it("derives one function tool per action with the label+rationale envelope appended", () => {
    const tools = buildToolDefs(ALLOWED);
    expect(tools).toHaveLength(2);
    const insert = tools[0];
    expect(insert.type).toBe("function");
    expect(insert.function.name).toBe("insert_block");
    expect(insert.function.parameters.properties).toHaveProperty("type");
    expect(insert.function.parameters.properties).toHaveProperty("label");
    expect(insert.function.parameters.properties).toHaveProperty("rationale");
    expect(insert.function.parameters.required).toEqual(
      expect.arrayContaining(["type", "afterBlockId", "label", "rationale"]),
    );
    expect(insert.function.parameters.additionalProperties).toBe(false);
  });
});

describe("actionFromToolCall", () => {
  it("coerces a valid tool call into a CopilotAction, splitting envelope from args", () => {
    const action = actionFromToolCall(
      "insert_block",
      JSON.stringify({
        type: "testimonial-wall",
        afterBlockId: "hero-1",
        label: "Add social proof",
        rationale: "No social proof above the fold.",
      }),
      ALLOWED,
    );
    expect(action).not.toBeNull();
    expect(action!.type).toBe("insert_block");
    expect(action!.label).toBe("Add social proof");
    expect(action!.rationale).toBe("No social proof above the fold.");
    expect(action!.args).toEqual({ type: "testimonial-wall", afterBlockId: "hero-1" });
  });

  it("rejects a tool name not in the allowed set", () => {
    expect(actionFromToolCall("delete_everything", "{}", ALLOWED)).toBeNull();
  });

  it("rejects malformed argument JSON", () => {
    expect(actionFromToolCall("remove_block", "{not json", ALLOWED)).toBeNull();
  });

  it("rejects when a required arg is missing or empty", () => {
    expect(
      actionFromToolCall("insert_block", JSON.stringify({ type: "hero" }), ALLOWED),
    ).toBeNull();
    expect(
      actionFromToolCall(
        "insert_block",
        JSON.stringify({ type: "hero", afterBlockId: "  " }),
        ALLOWED,
      ),
    ).toBeNull();
  });

  it("allows an empty afterBlockId only when it's not required-empty (top insert uses '')", () => {
    // afterBlockId is required, and "" is treated as empty → rejected. The mode
    // documents the empty string as 'top' but the model must still send a real
    // value or we drop it (safe default).
    const a = actionFromToolCall(
      "insert_block",
      JSON.stringify({ type: "hero", afterBlockId: "", label: "x", rationale: "y" }),
      ALLOWED,
    );
    expect(a).toBeNull();
  });

  it("falls back to a prettified label when none supplied", () => {
    const a = actionFromToolCall(
      "remove_block",
      JSON.stringify({ blockId: "b1" }),
      ALLOWED,
    );
    expect(a).not.toBeNull();
    expect(a!.label).toBe("Remove Block");
  });
});

describe("parseFencedActions", () => {
  it("extracts a single fenced action block", () => {
    const text = [
      "Here's a fix:",
      "```action",
      JSON.stringify({
        type: "remove_block",
        args: { blockId: "cta-2" },
        label: "Remove duplicate CTA",
        rationale: "Two CTAs back to back.",
      }),
      "```",
    ].join("\n");
    const actions = parseFencedActions(text, ALLOWED);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("remove_block");
    expect(actions[0].args).toEqual({ blockId: "cta-2" });
    expect(actions[0].label).toBe("Remove duplicate CTA");
  });

  it("extracts an array of actions from one fence and drops invalid ones", () => {
    const text = [
      "```json",
      JSON.stringify([
        { type: "remove_block", args: { blockId: "b1" }, label: "a", rationale: "r" },
        { type: "not_allowed", args: {}, label: "x", rationale: "y" },
        { type: "insert_block", args: { type: "hero", afterBlockId: "b1" }, label: "z", rationale: "w" },
      ]),
      "```",
    ].join("\n");
    const actions = parseFencedActions(text, ALLOWED);
    expect(actions.map((a) => a.type)).toEqual(["remove_block", "insert_block"]);
  });

  it("returns [] when there are no fences", () => {
    expect(parseFencedActions("just prose", ALLOWED)).toEqual([]);
  });
});

describe("stripFencedActions", () => {
  it("removes fenced action/json blocks, leaving prose", () => {
    const text = "Before\n```action\n{}\n```\nAfter";
    expect(stripFencedActions(text)).toBe("Before\n\nAfter");
  });
});
