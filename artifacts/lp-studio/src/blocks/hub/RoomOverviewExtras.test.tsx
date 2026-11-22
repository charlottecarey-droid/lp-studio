import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BlockRoomWorkspace, ROOM_WORKSPACE_DEFAULT_PROPS, type RoomWorkspaceBlockProps } from "../BlockRoomWorkspace";
import { OVERVIEW_EXTRA_ADDABLE, newOverviewExtra, overviewExtraHasContent, overviewVideoEmbed, overviewVideoName, overviewVideos, type RoomOverviewExtra } from "./RoomOverviewExtras";

const BRAND = { ...DEFAULT_BRAND, brandName: "Acme" };
const html = (props: Partial<RoomWorkspaceBlockProps>, editing = false) =>
  renderToStaticMarkup(createElement(BlockRoomWorkspace, { props: { ...structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS), ...props }, brand: BRAND, ...(editing ? { onFieldChange: () => {} } : {}) }));

const video: RoomOverviewExtra = { key: "ov-video-1", kind: "video", title: "Welcome from your team", videoUrl: "https://youtu.be/dQw4w9WgXcQ", position: "top" };
const resources: RoomOverviewExtra = { key: "ov-resources-1", kind: "resources", title: "Resources", items: [{ title: "Brand guide", url: "https://example.com/brand" }, { title: "Bad link", url: "javascript:alert(1)" }, { title: "", url: "https://example.com/blank" }] };
const note: RoomOverviewExtra = { key: "ov-text-1", kind: "text", title: "Hidden note", body: "Only the team sees this", hidden: true };

describe("the team's own Overview sections", () => {
  it("plays the usual video hosts and files, and nothing else", () => {
    expect(overviewVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ kind: "iframe", src: "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0" });
    expect(overviewVideoEmbed("https://vimeo.com/123456")).toEqual({ kind: "iframe", src: "https://player.vimeo.com/video/123456" });
    expect(overviewVideoEmbed("https://www.loom.com/share/abc123def")).toEqual({ kind: "iframe", src: "https://www.loom.com/embed/abc123def" });
    expect(overviewVideoEmbed("https://cdn.example.com/welcome.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/welcome.mp4" });
    // Wistia in its usual shapes, and a video uploaded to the media library (our own storage, no extension).
    expect(overviewVideoEmbed("https://acme.wistia.com/medias/abcde12345")).toEqual({ kind: "iframe", src: "https://fast.wistia.net/embed/iframe/abcde12345" });
    expect(overviewVideoEmbed("https://fast.wistia.net/embed/iframe/abcde12345?videoFoam=true")).toEqual({ kind: "iframe", src: "https://fast.wistia.net/embed/iframe/abcde12345" });
    expect(overviewVideoEmbed("abcde12345")).toEqual({ kind: "iframe", src: "https://fast.wistia.net/embed/iframe/abcde12345" });
    expect(overviewVideoEmbed("/api/storage/objects/uploads/3f2a9c1e-0000-4000-8000-000000000000")).toEqual({ kind: "file", src: "/api/storage/objects/uploads/3f2a9c1e-0000-4000-8000-000000000000" });
    expect(overviewVideoEmbed("https://app.example.com/api/storage/objects/uploads/abc")).toEqual({ kind: "file", src: "https://app.example.com/api/storage/objects/uploads/abc" });
    // The media library's own videos are on this site.
    expect(overviewVideoEmbed("/videos/dandy-broll.mp4")).toEqual({ kind: "file", src: "/videos/dandy-broll.mp4" });
    expect(overviewVideoEmbed("/dandy-lab-video-2/")).toEqual({ kind: "iframe", src: "/dandy-lab-video-2/" });
    expect(overviewVideoEmbed("//evil.example.com/x.mp4")).toBeNull();
    expect(overviewVideoEmbed("https://example.com/page")).toBeNull();
    expect(overviewVideoEmbed("javascript:alert(1)")).toBeNull();
    expect(overviewVideoEmbed("")).toBeNull();
  });

  it("knows when a section has something to show", () => {
    expect(overviewExtraHasContent(video)).toBe(true);
    expect(overviewExtraHasContent(newOverviewExtra("video"))).toBe(false);
    expect(overviewExtraHasContent(resources)).toBe(true);
    expect(overviewExtraHasContent(newOverviewExtra("resources"))).toBe(false);
    expect(newOverviewExtra("video", [newOverviewExtra("video")]).key).toBe("ov-video-2");
  });

  it("the customer sees filled, shown sections only, with safe links; no builder buttons", () => {
    const out = html({ overviewExtras: [video, resources, note, newOverviewExtra("text")] });
    expect(out).toContain('data-room-ov-extra="ov-video-1"');
    expect(out).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0");
    expect(out).toContain("Brand guide");
    expect(out).not.toContain("javascript:alert");
    expect(out).not.toContain("example.com/blank");
    expect(out).not.toContain("Only the team sees this");
    expect(out).not.toContain("data-room-ov-edit");
    // The video sits at the top, before the built-in sections; resources at the bottom.
    expect(out.indexOf("ov-video-1")).toBeLessThan(out.indexOf("data-room-attention"));
    expect(out.indexOf("ov-resources-1")).toBeGreaterThan(out.indexOf("data-room-attention"));
  });

  it("the builder: shown sections get Hide, hidden ones collapse into one strip with Show", () => {
    const out = html({ overviewExtras: [video, note], hiddenOverview: ["next"] }, true);
    expect(out).toContain('aria-label="Hide Welcome from your team on the Overview"');
    expect(out).toContain('aria-label="Hide Progress on the Overview"');
    // Hidden: a chip in the strip, not the section itself.
    expect(out).toContain("data-room-ov-hidden");
    expect(out).toContain('aria-label="Show Your next steps on the Overview"');
    expect(out).toContain('aria-label="Show Hidden note on the Overview"');
    expect(out).not.toContain("data-room-attention");
    expect(out).not.toContain("Only the team sees this");
    // Nothing hidden: no strip.
    expect(html({ overviewExtras: [video] }, true)).not.toContain("data-room-ov-hidden");
  });

  it("a built-in section hidden by the team stays off the customer's page", () => {
    expect(html({ hiddenOverview: ["next"] })).not.toContain("data-room-attention");
    expect(html({})).toContain("data-room-attention");
  });

  describe("Important links on the Overview", () => {
    const hubLinks = [
      { title: "Practice sign-up page", url: "https://partners.example.com/acme", description: "partners.example.com/acme" },
      { title: "Retired brand folder", url: "https://example.com/old", hidden: true },
    ];
    const linksSection = newOverviewExtra("links");

    it("is offered in place of the stand-alone Resources list, and has no links of its own", () => {
      expect(OVERVIEW_EXTRA_ADDABLE).toEqual(["video", "links", "text"]);
      expect(linksSection).toMatchObject({ kind: "links", title: "Important links" });
      expect(linksSection.items).toBeUndefined();
      expect(overviewExtraHasContent(linksSection, 0)).toBe(false);
      expect(overviewExtraHasContent(linksSection, 1)).toBe(true);
    });

    it("shows the hub's own Important links, drawn like the Marketing tab (copy + open), hidden ones left out", () => {
      const out = html({ links: hubLinks, overviewExtras: [linksSection] });
      expect(out).toContain("data-room-ov-links");
      expect(out).toContain("<h3>Important links</h3>");
      expect(out).toContain("Practice sign-up page");
      expect(out).toContain("prw-lk-link");
      expect(out).toContain("Copy link");
      expect(out).not.toContain("Retired brand folder");
      // Bottom by default: after the built-in sections.
      expect(out.indexOf("data-room-ov-links")).toBeGreaterThan(out.indexOf("data-room-attention"));
    });

    it("with no links the customer sees nothing, and the builder says where to add them", () => {
      expect(html({ links: [], overviewExtras: [linksSection] })).not.toContain("data-room-ov-links");
      const builder = html({ links: [], overviewExtras: [linksSection] }, true);
      expect(builder).toContain("no Important links yet");
      expect(builder).toContain('aria-label="Hide Important links on the Overview"');
    });

    it("an older hub's Resources list still shows", () => {
      expect(html({ overviewExtras: [resources] })).toContain("Brand guide");
    });
  });

  describe("Video carousel", () => {
    const three: RoomOverviewExtra = {
      key: "ov-video-9",
      kind: "video",
      title: "Introduction to Dandy Insights",
      position: "top",
      videos: [
        { title: "Introduction to Dandy Insights", url: "https://youtu.be/dQw4w9WgXcQ", body: "What you will see in Dandy Hub." },
        { title: "Not playable", url: "https://example.com/page" },
        { title: "Placing your first order", url: "https://vimeo.com/123456" },
        { title: "Reading your remake report", url: "https://www.loom.com/share/abc123def" },
      ],
    };

    it("an older one-video section reads as a list of one, and an old 'Watch:' title loses the prefix", () => {
      expect(overviewVideos(video)).toEqual([{ title: "Welcome from your team", url: "https://youtu.be/dQw4w9WgXcQ", body: undefined }]);
      expect(overviewVideoName({ title: "Watch: Introduction to Dandy Insights", url: "" })).toBe("Introduction to Dandy Insights");
      expect(overviewVideoName({ title: "  ", url: "" })).toBe("Video");
      expect(overviewExtraHasContent({ ...three, videos: [{ title: "x", url: "https://example.com/page" }] })).toBe(false);
      expect(overviewExtraHasContent(three)).toBe(true);
    });

    it("several videos: 'Watch video (1 of 3): name', a Next button, and back / forward arrows with a dot per playable video", () => {
      const out = html({ overviewExtras: [three] });
      expect(out).toContain('data-room-video-count="3"');
      expect(out).toMatch(/Watch video <span class="prw-vc-of">\(1 of 3\)<\/span>: <b>Introduction to Dandy Insights<\/b>/);
      expect(out).toContain("data-room-video-next");
      expect(out).toContain("Up next: Placing your first order");
      expect(out).toContain('disabled="" aria-label="Previous video"');
      expect(out).toContain('aria-label="Video 3 of 3: Reading your remake report"');
      expect(out).not.toContain("Not playable");
      expect(out).toContain("What you will see in Dandy Hub.");
      // Only the current video's player is on the page.
      expect(out).toContain("youtube.com/embed/dQw4w9WgXcQ");
      expect(out).not.toContain("player.vimeo.com");
    });

    it("one video: no counter and no carousel controls", () => {
      const out = html({ overviewExtras: [{ ...three, videos: three.videos!.slice(0, 1) }] });
      expect(out).toContain("Watch: <b>Introduction to Dandy Insights</b>");
      expect(out).not.toContain("data-room-video-next");
      expect(out).not.toContain("data-room-video-nav");
    });
  });

  describe("Pinned note", () => {
    const base: RoomOverviewExtra = { key: "ov-text-2", kind: "text", title: "Welcome, Signature Team!", body: "Welcome to Dandy!\n\nWe are so excited to partner with you on your lab consolidation journey.\n\nYour Dandy Account Team" };

    it("is a pinned card with the default eyebrow, paragraphs, and a short last line as the sign-off", () => {
      const out = html({ overviewExtras: [base] });
      expect(out).toContain('class="prw-sec prw-note"');
      expect(out).toContain("prw-note-pin");
      expect(out).toMatch(/data-room-note-eyebrow="?[^>]*>From your account team</);
      expect(out).toContain("<p>Welcome to Dandy!</p>");
      expect(out).toMatch(/data-room-note-signoff="?[^>]*>Your Dandy Account Team</);
    });

    it("the team can change or clear the eyebrow", () => {
      expect(html({ overviewExtras: [{ ...base, eyebrow: "From Matthew, your account owner" }] })).toContain("From Matthew, your account owner");
      expect(html({ overviewExtras: [{ ...base, eyebrow: "" }] })).not.toContain("data-room-note-eyebrow");
    });

    it("shows the team's links as buttons, only safe ones with a name", () => {
      const out = html({ overviewExtras: [{ ...base, items: [{ title: "Book your kickoff", url: "https://cal.example.com/kickoff" }, { title: "Bad", url: "javascript:alert(1)" }, { title: "", url: "https://example.com/noname" }] }] });
      expect(out).toContain("data-room-note-links");
      expect(out).toMatch(/href="https:\/\/cal\.example\.com\/kickoff"[^>]*>Book your kickoff/);
      expect(out).not.toContain("javascript:alert");
      expect(out).not.toContain("example.com/noname");
      // A note with only links still shows.
      expect(overviewExtraHasContent({ key: "n", kind: "text", title: "", items: [{ title: "Go", url: "https://example.com" }] })).toBe(true);
      // No links: no button row.
      expect(html({ overviewExtras: [base] })).not.toContain("data-room-note-links");
    });

    it("a note that ends in a sentence has no sign-off", () => {
      const out = html({ overviewExtras: [{ key: "ov-text-3", kind: "text", title: "Heads up", body: "First line.\n\nWe will be in touch soon." }] });
      expect(out).not.toContain("data-room-note-signoff");
    });

    it("a new note starts at the top with the eyebrow set and room for links", () => {
      expect(newOverviewExtra("text")).toMatchObject({ kind: "text", eyebrow: "From your account team", items: [], position: "top" });
    });
  });
});
