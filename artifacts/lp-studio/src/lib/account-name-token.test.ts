/**
 * The `{{company_name}}` resolution chain.
 *
 * Why this needed a test: the token looked broken because THREE things have to
 * line up and only one of them was in place.
 *
 *   1. Somewhere stores the value  → `lp_pages.pageVariables` (Page Settings →
 *      Account name now writes it; nothing did before).
 *   2. The API returns it          → both the preview route and the live
 *      variant route include `pageVariables`.
 *   3. The viewer substitutes      → merges those into `dtrVars` and runs
 *      `applyDtr` over every block's props.
 *
 * Step 1 was missing, so the token resolved to nothing on a live page (DTR
 * blanks unknown tokens) and stayed literal in the builder. These tests cover
 * step 3 and the key aliasing that makes whichever spelling an author typed
 * resolve.
 */
import { describe, expect, it } from "vitest";
import { applyDtr, replaceDtrTokens } from "./dtr";

/** What the viewer builds: pageVariables lowercased, then URL params over them. */
const dtrVars = (pageVariables: Record<string, string>, urlParams: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(pageVariables)) {
    if (k.startsWith("__") || k.startsWith("{{")) continue;
    defaults[k.toLowerCase()] = v;
  }
  return { ...defaults, ...urlParams };
};

/** The keys Page Settings → Account name writes, so any spelling resolves. */
const ACCOUNT_VARS = {
  company_name: "Pacific Dental Alliance",
  company: "Pacific Dental Alliance",
  account_name: "Pacific Dental Alliance",
  customer: "Pacific Dental Alliance",
};

describe("{{company_name}} on a page", () => {
  it("resolves from the page's saved account name", () => {
    expect(replaceDtrTokens("Welcome, {{company_name}}", dtrVars(ACCOUNT_VARS)))
      .toBe("Welcome, Pacific Dental Alliance");
  });

  it("every spelling an author might type resolves", () => {
    const vars = dtrVars(ACCOUNT_VARS);
    for (const token of ["{{company_name}}", "{{company}}", "{{account_name}}", "{{customer}}"]) {
      expect(replaceDtrTokens(token, vars)).toBe("Pacific Dental Alliance");
    }
  });

  it("is case-insensitive, matching how the viewer lowercases keys", () => {
    expect(replaceDtrTokens("{{Company_Name}}", dtrVars(ACCOUNT_VARS)))
      .toBe("Pacific Dental Alliance");
  });

  it("reaches nested block props, not just top-level strings", () => {
    const props = {
      headline: "{{company_name}}, your agenda",
      days: [{ sessions: [{ title: "Kickoff with {{company}}" }] }],
    };
    const out = applyDtr(props, dtrVars(ACCOUNT_VARS));
    expect(out.headline).toBe("Pacific Dental Alliance, your agenda");
    expect(out.days[0].sessions[0].title).toBe("Kickoff with Pacific Dental Alliance");
  });

  it("A URL PARAM STILL WINS — per-recipient links must override the default", () => {
    const out = replaceDtrTokens("{{company_name}}", dtrVars(ACCOUNT_VARS, { company_name: "Northwind" }));
    expect(out).toBe("Northwind");
  });

  it("WITHOUT a saved value the token BLANKS on a live page — the original bug", () => {
    // This is why it looked broken: DTR resolves an unknown token to "", so the
    // page rendered a gap. Nothing was storing the value.
    expect(replaceDtrTokens("Welcome, {{company_name}}", dtrVars({}))).toBe("Welcome, ");
  });

  it("an inline fallback covers the unset case", () => {
    expect(replaceDtrTokens("Welcome, {{company_name|your team}}", dtrVars({})))
      .toBe("Welcome, your team");
  });

  it("reserved and literal keys are not exposed as variables", () => {
    const vars = dtrVars({ __linkedFormStyle: "x", "{{legacy}}": "y", company_name: "Acme" });
    expect(vars.__linkedformstyle).toBeUndefined();
    expect(vars.company_name).toBe("Acme");
  });

  it("a bare word is NOT a token — this is what the author had typed", () => {
    // `company_name` with no braces is just text, which is exactly why nothing
    // happened. The Page Settings field's helper text now says so.
    expect(replaceDtrTokens("Welcome, company_name", dtrVars(ACCOUNT_VARS)))
      .toBe("Welcome, company_name");
  });
});
