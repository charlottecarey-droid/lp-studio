// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  toEmailHTML,
  fromEmailHTML,
  MergeVariable,
} from "./EmailWYSIWYGEditor";

/**
 * Regression guard for the merge-variable round-trip in the shared email
 * editor. A previous bug had clicking a merge-variable chip insert an empty
 * `{{}}` instead of `{{brandName}}`, which silently shipped emails with blank
 * merge tags. These tests drive the *real* MergeVariable node + the
 * toEmailHTML/fromEmailHTML serializers the editor uses, so the regression
 * cannot quietly return.
 */
function makeEditor(content = ""): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      MergeVariable,
    ],
    content,
  });
}

describe("EmailWYSIWYGEditor merge variables", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it("inserts a real {{variable}} token (not an empty {{}}) when a chip is clicked", () => {
    editor = makeEditor();

    // This is exactly what the merge-variable chip's onClick runs.
    editor
      .chain()
      .focus()
      .insertContent({ type: "mergeVariable", attrs: { variable: "brandName" } })
      .run();

    const serialized = toEmailHTML(editor.getHTML());

    expect(serialized).toContain("{{brandName}}");
    expect(serialized).not.toContain("{{}}");
    // The serialized email HTML must carry the raw token, not the editor's
    // styled chip span.
    expect(serialized).not.toContain("data-merge-variable");
  });

  it("serializes every offered merge variable to its raw token", () => {
    for (const variable of ["first_name", "last_name", "company", "microsite_url"]) {
      const ed = makeEditor();
      ed.chain().focus().insertContent({ type: "mergeVariable", attrs: { variable } }).run();
      const serialized = toEmailHTML(ed.getHTML());
      expect(serialized).toContain(`{{${variable}}}`);
      expect(serialized).not.toContain("{{}}");
      ed.destroy();
    }
  });

  it("round-trips a stored template with merge variables identically", () => {
    // Build a canonical "stored template" the way the editor would persist it:
    // text mixed with a merge-variable chip.
    editor = makeEditor();
    editor
      .chain()
      .focus()
      .insertContent("Hi ")
      .insertContent({ type: "mergeVariable", attrs: { variable: "first_name" } })
      .insertContent(", welcome to ")
      .insertContent({ type: "mergeVariable", attrs: { variable: "company" } })
      .insertContent("!")
      .run();

    const stored = toEmailHTML(editor.getHTML());
    expect(stored).toContain("{{first_name}}");
    expect(stored).toContain("{{company}}");
    expect(stored).not.toContain("{{}}");

    // Load the stored template back into the editor and re-serialize. The
    // output must be byte-identical, proving the merge tags survive a full
    // load → edit → save cycle.
    editor.commands.setContent(fromEmailHTML(stored));
    const reSerialized = toEmailHTML(editor.getHTML());

    expect(reSerialized).toBe(stored);
  });

  it("keeps merge tokens inside link hrefs as raw tokens (not chip spans)", () => {
    // Microsite links embed {{microsite_url}} in the href; fromEmailHTML must
    // not wrap merge tokens that live inside HTML attributes.
    const stored = toEmailHTML(
      '<p><a href="{{microsite_url}}">View your page</a></p>',
    );

    const editorHtml = fromEmailHTML(stored);
    // The href token stays raw — no span wrapper injected into the attribute.
    expect(editorHtml).toContain('href="{{microsite_url}}"');
    expect(editorHtml).not.toContain('data-merge-variable="microsite_url"');

    editor = makeEditor(editorHtml);
    const reSerialized = toEmailHTML(editor.getHTML());
    expect(reSerialized).toContain('href="{{microsite_url}}"');
    expect(reSerialized).not.toContain("{{}}");
  });
});
