import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BlockRoomWorkspace, ROOM_WORKSPACE_DEFAULT_PROPS, type RoomWorkspaceBlockProps } from "../BlockRoomWorkspace";
import { OVERVIEW_EXTRA_ADDABLE, fillFirstName, newOverviewExtra, overviewExtraHasContent, overviewVideoEmbed, overviewVideoName, overviewVideoThumb, overviewVideos, pinnedLabel, type RoomOverviewExtra } from "./RoomOverviewExtras";

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
      expect(out).toMatch(/<h3><span class="prw-ovx-t">.*Important links<\/span><\/h3>/);
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
      // The builder shows the empty card with its own Add a link, so links can be added right there.
      expect(builder).toContain("No links yet");
      expect(builder).toContain("data-room-link-add");
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
      const out = html({ overviewExtras: [{ ...base, signedBy: "" }] });
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

  describe("Overview layout in the page", () => {
    const note: RoomOverviewExtra = { key: "n1", kind: "text", title: "Hello", body: "Hi.", position: "top" };
    const linksX = newOverviewExtra("links");
    const hubLinks = [{ title: "Sign-up page", url: "https://example.com/signup" }];

    it("follows the saved order, built-ins included", () => {
      const out = html({ links: hubLinks, overviewExtras: [note, linksX], overviewOrder: ["steps", "ov-links-1", "n1", "progress"] });
      const at = (needle: string) => out.indexOf(needle);
      expect(at("data-room-attention")).toBeLessThan(at("data-room-ov-links"));
      expect(at("data-room-ov-links")).toBeLessThan(at('data-room-ov-extra="n1"'));
    });

    it("puts a 'beside' section in the same row as the one before it", () => {
      const out = html({ links: hubLinks, overviewExtras: [note, linksX], overviewOrder: ["n1", "ov-links-1", "progress", "steps"], overviewBeside: ["ov-links-1"] });
      expect(out).toMatch(/<div class="prw-ovrow" data-room-ov-row="true">.*data-room-ov-extra="n1".*data-room-ov-links/s);
    });

    it("the builder: every section gets its tools, and + Add section sits between sections", () => {
      const out = html({ links: hubLinks, overviewExtras: [note, linksX], overviewOrder: ["progress", "steps", "n1", "ov-links-1"] }, true);
      expect(out).toContain('data-room-ov-unit="n1"');
      expect(out).toContain('aria-label="Move Hello up"');
      // Beside a wide section (Next steps) is never offered; beside the note is.
      expect(out).not.toContain('aria-label="Put Hello beside the section before"');
      expect(out).toContain('aria-label="Put Important links beside the section before"');
      // Next steps & coming up hides part by part, so its unit has no Hide of its own.
      expect(out).toMatch(/data-room-ov-unit="steps"/);
      expect((out.match(/data-room-ov-add-bar/g) ?? []).length).toBeGreaterThanOrEqual(3);
      // None of it reaches the customer.
      const live = html({ links: hubLinks, overviewExtras: [note, linksX] });
      // (The stylesheet names these attributes; the markup must not carry them.)
      expect(live).not.toMatch(/data-room-ov-unit="/);
      expect(live).not.toMatch(/data-room-ov-add-bar="/);
    });

    it("the builder: Important links are edited where they are, with Add a link and remove", () => {
      const out = html({ links: hubLinks, overviewExtras: [linksX] }, true);
      expect(out).toContain('data-room-edit="url"');
      expect(out).toContain('data-room-edit="description"');
      expect(out).toContain("data-room-link-remove");
      expect(out).toContain("data-room-link-add");
      expect(html({ links: hubLinks, overviewExtras: [linksX] })).not.toContain("data-room-link-remove");
    });
  });

  describe("Pinned note: signer, date and first name", () => {
    const note: RoomOverviewExtra = { key: "n2", kind: "text", title: "Welcome, {first name}!", body: "Glad you're here.\n\nYour account team", pinnedAt: "2026-11-22T15:00:00.000Z" };

    it("is signed by the first person on our team by default, with initials when there's no photo", () => {
      const out = html({ overviewExtras: [note] });
      expect(out).toContain('data-room-note-signer="Alex Morgan"');
      expect(out).toMatch(/class="prw-note-av"[^>]*>AM</);
      expect(out).toContain("Account lead · Your account team");
    });

    it("can be signed by someone else, or no one", () => {
      expect(html({ overviewExtras: [{ ...note, signedBy: "Jordan Lee" }] })).toContain('data-room-note-signer="Jordan Lee"');
      const none = html({ overviewExtras: [{ ...note, signedBy: "" }] });
      expect(none).not.toContain("data-room-note-signer");
      expect(none).toMatch(/data-room-note-signoff="?[^>]*>Your account team</);
    });

    it("fills {first name} (the company name when the visitor isn't known) and shows the pinned date", () => {
      const out = html({ overviewExtras: [note] });
      expect(out).toContain("Welcome, Acme Group!");
      expect(out).not.toContain("{first name}");
      expect(out).toContain("Pinned Nov 22");
      expect(html({ overviewExtras: [{ ...note, hideDate: true }] })).not.toContain("data-room-note-date");
      expect(fillFirstName("Hi {First Name}, {firstName} and { first_name }", "Josh")).toBe("Hi Josh, Josh and Josh");
      expect(pinnedLabel(undefined)).toBe("");
      expect(pinnedLabel("not a date")).toBe("");
    });

    it("the builder edits the words where they are and keeps the {first name} token visible", () => {
      const out = html({ overviewExtras: [note] }, true);
      expect(out).toContain('data-room-edit="title"');
      expect(out).toContain('data-room-edit="body"');
      expect(out).toContain('data-room-edit="eyebrow"');
      expect(out).toContain("Welcome, {first name}!");
    });
  });

  describe("Video carousel: Up next strip", () => {
    const three: RoomOverviewExtra = {
      key: "v3",
      kind: "video",
      title: "Intro",
      videos: [
        { title: "Intro", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "Ordering", url: "https://vimeo.com/123456", thumbnailUrl: "https://example.com/ordering.jpg" },
        { title: "Lab tour", url: "/videos/dandy-lab-video.mp4" },
      ],
    };

    it("finds a picture for each video where it can", () => {
      expect(overviewVideoThumb(three.videos![0])).toEqual({ kind: "img", src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
      expect(overviewVideoThumb(three.videos![1])).toEqual({ kind: "img", src: "https://example.com/ordering.jpg" });
      expect(overviewVideoThumb(three.videos![2])).toEqual({ kind: "video", src: "/videos/dandy-lab-video.mp4#t=1" });
      expect(overviewVideoThumb({ title: "x", url: "https://vimeo.com/1" })).toBeNull();
    });

    it("shows every video in the strip, the current one marked Now playing", () => {
      const out = html({ overviewExtras: [three] });
      expect(out).toContain("data-room-video-strip");
      expect((out.match(/class="prw-vc-item/g) ?? []).length).toBe(3);
      expect(out).toMatch(/class="prw-vc-item on"[^>]*aria-current="true"/);
      expect(out).toContain("Now playing");
      expect(out).toContain('aria-label="Video 2 of 3: Ordering"');
    });
  });

  describe("Saved notes and booking links", () => {
    const kickoff: RoomOverviewExtra = { key: "k1", kind: "text", title: "Let's book your kickoff call", body: "Hi {first name}.", items: [{ title: "Book your kickoff call", url: "{booking link}" }] };
    const teamWith = (bookingUrl?: string) => [{ title: "Our team", members: [{ name: "Alex Morgan", role: "Account lead", ...(bookingUrl ? { bookingUrl } : {}) }, { name: "Jordan Lee", role: "Account manager", bookingUrl: "https://cal.example.com/jordan" }] }];

    it("{booking link} becomes the signer's booking page, else the first teammate's", () => {
      expect(html({ team: teamWith("https://cal.example.com/alex"), overviewExtras: [kickoff] })).toContain('href="https://cal.example.com/alex"');
      expect(html({ team: teamWith(), overviewExtras: [kickoff] })).toContain('href="https://cal.example.com/jordan"');
    });

    it("with no booking page on the team the button is left off, and the builder says why", () => {
      const team = [{ title: "Our team", members: [{ name: "Alex Morgan", role: "Account lead" }] }];
      const live = html({ team, overviewExtras: [kickoff] });
      expect(live).not.toContain("Book your kickoff call</a>");
      expect(live).not.toContain("{booking link}");
      expect(html({ team, overviewExtras: [kickoff] }, true)).toContain("data-room-note-booking-missing");
    });

    it("a signer who isn't on this hub's team falls back to the account owner", () => {
      expect(html({ overviewExtras: [{ ...kickoff, signedBy: "Someone From Another Hub" }] })).toContain('data-room-note-signer="Alex Morgan"');
    });

    it("the builder: each note has Save note", () => {
      expect(html({ overviewExtras: [kickoff] }, true)).toContain("data-room-note-save");
      expect(html({ overviewExtras: [kickoff] })).not.toMatch(/data-room-note-save="/);
    });
  });

  describe("Rollout timeline: View scorecard", () => {
    it("sits under the rollout timeline when the hub has a Scorecard", () => {
      const out = html({});
      expect(out).toMatch(/data-room-progress-scorecard="true"[^>]*>View scorecard/);
      expect(out.indexOf("prw-phases")).toBeLessThan(out.indexOf("data-room-progress-scorecard"));
    });

    it("uses the Scorecard's own name, and is left off when the Scorecard is hidden", () => {
      expect(html({ hiddenModules: ["practices"] })).not.toContain("data-room-progress-scorecard");
    });

    it("isn't added in expansion, whose timeline already links from its heading", () => {
      expect(html({ stage: "expansion" })).not.toContain("data-room-progress-scorecard");
    });
  });
});
