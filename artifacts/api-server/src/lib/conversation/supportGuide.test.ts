/**
 * Unit coverage for the Support Guide mode — corpus shape, keyword retrieval,
 * TOC, grounding assembly, and the action menu. No OpenAI, no DB.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  supportGuideMode,
  selectGuideSections,
  buildGuideToc,
  guideAppPaths,
  SUPPORT_GUIDE_ACTIONS,
  type SupportGuideContext,
} from "./modes/supportGuide";
import { USER_GUIDE_SECTIONS } from "./grounding/userGuide";

describe("USER_GUIDE_SECTIONS corpus", () => {
  it("has unique slugs, titles, keywords, and non-trivial bodies", () => {
    expect(USER_GUIDE_SECTIONS.length).toBeGreaterThanOrEqual(12);
    const slugs = USER_GUIDE_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of USER_GUIDE_SECTIONS) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.keywords.length).toBeGreaterThanOrEqual(5);
      expect(s.body.length).toBeGreaterThan(100);
    }
  });

  it("appPath values are absolute in-app routes", () => {
    for (const p of guideAppPaths()) {
      expect(p).toMatch(/^\/[a-zA-Z0-9\-_/]*$/);
    }
  });

  // Freshness guard: the corpus IS the support bot's knowledge, so a renamed
  // or removed app route must fail here and force a guide update — otherwise
  // the bot deep-links users to a 404. Reads the frontend's App.tsx source
  // directly (cross-workspace, monorepo-relative).
  it("every appPath in the corpus still exists in the frontend's routes", () => {
    const appTsxPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../lp-studio/src/App.tsx",
    );
    const appTsx = readFileSync(appTsxPath, "utf8");
    for (const p of guideAppPaths()) {
      expect(appTsx, `guide appPath "${p}" no longer appears in App.tsx — update userGuide.ts`).toContain(`"${p}"`);
    }
  });
});

describe("selectGuideSections", () => {
  it("retrieves the publishing section for a custom-domain question", () => {
    const picked = selectGuideSections("How do I publish my page to a custom domain?");
    expect(picked.map((s) => s.slug)).toContain("publishing-and-custom-domains");
  });

  it("retrieves the leads section for a form-leads question", () => {
    const picked = selectGuideSections("where do my form leads end up?");
    expect(picked.map((s) => s.slug)).toContain("forms-leads-and-notifications");
  });

  it("retrieves the chat-block section for a page-chatbot question", () => {
    const picked = selectGuideSections("how do I add a chatbot to my landing page?");
    expect(picked.map((s) => s.slug)).toContain("lead-capture-chat-block");
  });

  it("falls back to the intro sections when nothing matches", () => {
    const picked = selectGuideSections("zzz qqq xxyzzy");
    expect(picked.length).toBeGreaterThan(0);
    expect(picked[0].slug).toBe(USER_GUIDE_SECTIONS[0].slug);
  });

  it("caps results at max", () => {
    const picked = selectGuideSections("page builder blocks brand forms leads analytics", USER_GUIDE_SECTIONS, 3);
    expect(picked.length).toBeLessThanOrEqual(3);
  });
});

describe("supportGuideMode", () => {
  it("is tagged support_guide with the open_page + escalate actions", () => {
    expect(supportGuideMode.id).toBe("support_guide");
    expect(SUPPORT_GUIDE_ACTIONS.map((a) => a.type).sort()).toEqual([
      "escalate_to_support",
      "open_page",
    ]);
  });

  it("grounding contains the retrieved section, the TOC, and the current path", () => {
    const ctx: SupportGuideContext = {
      tenantId: 1,
      pageId: null,
      userMessage: "how do I import my brand from my website?",
      currentPath: "/forms",
    };
    const grounding = supportGuideMode.groundingBuilder(ctx);
    expect(grounding.toLowerCase()).toContain("brand");
    expect(grounding).toContain("All user-guide topics");
    expect(grounding).toContain("/forms");
  });

  it("TOC lists every section title", () => {
    const toc = buildGuideToc();
    for (const s of USER_GUIDE_SECTIONS) {
      expect(toc).toContain(s.title);
    }
  });

  it("persona answers only from the guide", () => {
    const persona = supportGuideMode.systemPromptBuilder({ tenantId: 1, pageId: null });
    expect(persona.toLowerCase()).toContain("only");
    expect(persona.toLowerCase()).toContain("guide");
  });
});
