import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomSlackPreview, slackInline } from "./RoomSlackPreview";

describe("Slack post preview", () => {
  it("applies Slack's formatting instead of showing asterisks", () => {
    const html = renderToStaticMarkup(<RoomSlackPreview header="📬 Weekly digest · Acme" text={"*Rollout*\n*9 of 42* practices live\n\n*Waiting on Acme (2)*\n• Upload your doctor roster\n• Join the kickoff"} context="<https://hub.example/acme|Open the Partner Hub>" channel="hub-acme" />);
    expect(html).toContain("<strong");
    expect(html).toContain(">9 of 42</strong> practices live");
    expect(html).not.toContain("*Rollout*");
    expect(html).toContain("Upload your doctor roster");
    expect(html).toContain('href="https://hub.example/acme"');
    expect(html).toContain("Open the Partner Hub");
    expect(html).toContain("hub-acme");
    expect(html).toContain("APP");
  });
  it("never turns message text into markup", () => {
    const html = renderToStaticMarkup(<RoomSlackPreview header="x" text={"<script>alert(1)</script> *b*"} />);
    expect(html).not.toContain("<script>");
    expect(slackInline("plain")).toEqual(["plain"]);
  });
});
