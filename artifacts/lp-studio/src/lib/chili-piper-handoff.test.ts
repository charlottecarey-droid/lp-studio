import { describe, it, expect } from "vitest";
import { buildChiliPiperHandoffUrl } from "./chili-piper-handoff";

const params = (url: string) => new URL(url).searchParams;

describe("buildChiliPiperHandoffUrl", () => {
  it("prefills Chili Piper casings AND Calendly snake_case keys from name fields", () => {
    const url = buildChiliPiperHandoffUrl(
      { url: "https://calendly.com/acme/intro" },
      { "First Name": "Ada", "Last Name": "Lovelace", Email: "ada@acme.com" },
    );
    const p = params(url);
    // CP router variants
    expect(p.get("firstName")).toBe("Ada");
    expect(p.get("firstname")).toBe("Ada");
    expect(p.get("lastName")).toBe("Lovelace");
    // Calendly prefill variants ride along (routers drop unknown keys)
    expect(p.get("first_name")).toBe("Ada");
    expect(p.get("last_name")).toBe("Lovelace");
    expect(p.get("email")).toBe("ada@acme.com");
  });

  it("maps a full-name field to Calendly's `name` param (chat-bot capture shape)", () => {
    // The chat-capture bot submits a single Name field plus Email/Phone.
    const url = buildChiliPiperHandoffUrl(
      { url: "https://acme.chilipiper.com/router/inbound" },
      { Name: "Ada Lovelace", Email: "ada@acme.com", Phone: "555-0100" },
    );
    const p = params(url);
    expect(p.get("name")).toBe("Ada Lovelace");
    expect(p.get("email")).toBe("ada@acme.com");
    expect(p.get("phone")).toBe("555-0100");
  });

  it("first non-empty value wins per target key and existing params survive", () => {
    const url = buildChiliPiperHandoffUrl(
      { url: "https://acme.chilipiper.com/router/inbound?utm_source=lp" },
      { Email: "first@acme.com", email: "second@acme.com" },
    );
    const p = params(url);
    expect(p.get("email")).toBe("first@acme.com");
    expect(p.get("utm_source")).toBe("lp");
  });

  it("tenant fieldMap overrides the defaults", () => {
    const url = buildChiliPiperHandoffUrl(
      { url: "https://calendly.com/acme/intro", fieldMap: { "Work Email": "email" } },
      { "Work Email": "ada@acme.com" },
    );
    expect(params(url).get("email")).toBe("ada@acme.com");
  });
});
