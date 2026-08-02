import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { fetchBrandConfig, DEFAULT_BRAND, isValidHex, type BrandConfig } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { BrandFontLoader } from "@/components/BrandFontLoader";

/**
 * /og-card/:slug — the DESIGNED 1200×630 share card the headless capture
 * screenshots (api-server captureOgScreenshotToStorage), replacing raw
 * screenshots of the live page. A real page is built responsive for human
 * viewports; letterboxing it into 1200×630 cropped heroes, overlapped
 * headlines, and raced webfonts. This route composes the card deliberately:
 *
 *   - fixed 1200×630 canvas, content can never overflow or overlap — the
 *     headline auto-shrinks (autoFitHeadline) until it fits its box;
 *   - the page's first block image as a dimmed background (brand-dark flat
 *     background when the page has no image);
 *   - tenant logo + optional account logo/name pair (ABM microsites);
 *   - brand display/body fonts, EXPLICITLY loaded via document.fonts.load()
 *     before the `data-og-card-ready` marker is set — the capture waits on
 *     that marker, so "screenshot before Bagoss painted" can't happen.
 *
 * Auth mirrors /preview/:slug: ?reviewToken=<page-scoped token> for headless
 * captures and logged-out shares, session tenant otherwise.
 */

interface OgCardData {
  headline: string;
  subheadline: string;
  accountName: string;
  accountLogo: string;
  backgroundImage: string;
  host: string;
  slug: string;
}

export const OG_CARD_READY_ATTR = "data-og-card-ready";

/** Bounded font warm-up: ask the browser to actually LOAD the faces the card
 *  renders with (fonts.ready alone only waits for loads already in flight). */
async function loadCardFonts(brand: BrandConfig): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const families = [brand.displayFont, brand.bodyFont].filter(Boolean);
  const loads = families.flatMap((family) => [
    document.fonts.load(`600 92px "${family}"`),
    document.fonts.load(`400 30px "${family}"`),
  ]);
  await Promise.race([
    Promise.allSettled(loads),
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
}

/** Bounded background-image warm-up so the capture never gets a half-decoded
 *  frame. Errors resolve too — a broken image just falls back to the flat
 *  brand background visually. */
async function loadBackground(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return;
  await Promise.race([
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 6000)),
  ]);
}

/** Deterministic text fit: walk down the size ladder until the headline's
 *  rendered height fits its fixed box. This is the code doing what Charlotte
 *  was doing by hand — shrinking type until the card looks right. */
export function autoFitHeadline(el: HTMLElement, box: HTMLElement, sizes: number[]): number {
  let chosen = sizes[sizes.length - 1];
  for (const size of sizes) {
    el.style.fontSize = `${size}px`;
    if (el.scrollHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth) {
      chosen = size;
      break;
    }
  }
  el.style.fontSize = `${chosen}px`;
  return chosen;
}

const HEADLINE_SIZES = [92, 84, 76, 68, 60, 54, 48, 42];

export default function OgCardPage() {
  const [, params] = useRoute("/og-card/:slug");
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";
  const reviewToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("reviewToken")
      : null;

  const [data, setData] = useState<OgCardData | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [assetsReady, setAssetsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const headlineBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = reviewToken ? `?reviewToken=${encodeURIComponent(reviewToken)}` : "";
        const [dataRes, brandCfg] = await Promise.all([
          fetch(`/api/lp/og-card-data/${encodeURIComponent(slug)}${qs}`),
          fetchBrandConfig(slug, undefined, reviewToken),
        ]);
        if (!dataRes.ok) throw new Error(`og-card-data ${dataRes.status}`);
        const payload = (await dataRes.json()) as OgCardData;
        if (cancelled) return;
        setBrand(brandCfg);
        setData(payload);
        await Promise.all([loadCardFonts(brandCfg), loadBackground(payload.backgroundImage)]);
        if (!cancelled) setAssetsReady(true);
      } catch (err) {
        console.error("og-card load failed:", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, reviewToken]);

  // Fit the headline AFTER fonts are painted (font metrics change the wrap),
  // then flip the ready marker the capture waits on. Synchronous layout work,
  // so the attribute only appears once the card is pixel-final.
  useLayoutEffect(() => {
    if (!assetsReady || !data) return;
    const el = headlineRef.current;
    const box = headlineBoxRef.current;
    if (el && box) autoFitHeadline(el, box, HEADLINE_SIZES);
    rootRef.current?.setAttribute(OG_CARD_READY_ATTR, "1");
  }, [assetsReady, data]);

  if (error) {
    // Deliberately NO ready marker — the capture times out and reports a
    // failure instead of uploading an empty card.
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Share card failed to load: {error}</div>;
  }
  if (!data) return null;

  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accent = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  // Flat fallback surface: mostly near-black with a fifth of the brand
  // primary mixed in, so white text always clears contrast whatever the
  // tenant's palette (mixHex: `amount` of the FIRST color).
  const cardBg = mixHex("#070a12", primary, 0.78);
  // Dark-surface logo preference, same as nav headers / one-pagers. Dandy
  // keeps its bundled white wordmark when Brand Settings carries no upload
  // (mirrors resolveOnePagerAssets) — the card is always a dark surface, so
  // the text-wordmark fallback below should be a last resort.
  const logo =
    (brand.logoUrlDark || brand.logoUrl || "").trim() ||
    (brand.isDandy ? "/dandy-logo-white.svg" : "");
  const displayFont = brand.displayFont ? `'${brand.displayFont}', sans-serif` : "sans-serif";
  const bodyFont = brand.bodyFont ? `'${brand.bodyFont}', sans-serif` : "sans-serif";
  const urlLine = data.host ? `${data.host}/${data.slug}` : "";

  return (
    <div
      ref={rootRef}
      data-lp-og-card
      style={{
        position: "relative",
        width: 1200,
        height: 630,
        overflow: "hidden",
        background: cardBg,
        color: "#ffffff",
        fontFamily: bodyFont,
      }}
    >
      <BrandFontLoader brand={brand} />
      {data.backgroundImage && (
        <>
          <img
            src={data.backgroundImage}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Two-axis scrim. The horizontal pass is the load-bearing one: hero
              art is routinely a CENTRE-FRAMED subject (a portrait, a product),
              so a bottom-only wash left the headline sitting on a face. Darken
              the left column where all the text lives and let the right side
              stay light, which also means more of the photo actually reads.
              Kept as two gradients rather than one baked ramp so each axis can
              be tuned without re-deriving the other. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(7,10,18,0.68) 0%, rgba(7,10,18,0.45) 50%, rgba(7,10,18,0.10) 100%)," +
                "linear-gradient(180deg, rgba(7,10,18,0.20) 0%, rgba(7,10,18,0.32) 55%, rgba(7,10,18,0.55) 100%)",
            }}
          />
        </>
      )}
      <div
        style={{
          position: "relative",
          height: "100%",
          boxSizing: "border-box",
          padding: "56px 72px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Logo row: tenant logo, plus the account pair for ABM microsites */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, minHeight: 48 }}>
          {logo ? (
            <img src={logo} alt="" style={{ height: 44, maxWidth: 300, objectFit: "contain", objectPosition: "left center" }} />
          ) : (
            <span style={{ fontFamily: displayFont, fontSize: 30, fontWeight: 600 }}>{brand.copyrightName || ""}</span>
          )}
          {(data.accountLogo || data.accountName) && (
            <>
              <span style={{ fontSize: 26, opacity: 0.55 }}>×</span>
              {data.accountLogo ? (
                <img
                  src={data.accountLogo}
                  alt=""
                  style={{
                    height: 40,
                    maxWidth: 260,
                    objectFit: "contain",
                    objectPosition: "left center",
                    background: "rgba(255,255,255,0.92)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    boxSizing: "content-box",
                  }}
                />
              ) : (
                <span style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 500 }}>{data.accountName}</span>
              )}
            </>
          )}
        </div>

        {/* Headline zone — fixed-height box the autofit shrinks into */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>
          <div ref={headlineBoxRef} style={{ height: 320, maxWidth: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
            <div
              ref={headlineRef}
              style={{
                fontFamily: displayFont,
                fontWeight: 600,
                fontSize: HEADLINE_SIZES[0],
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
              }}
            >
              {data.headline}
            </div>
          </div>
          {data.subheadline && (
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.35,
                maxWidth: 860,
                color: "rgba(255,255,255,0.82)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {data.subheadline}
            </div>
          )}
        </div>

        {/* Footer: where the link goes, in the brand accent */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 28, minHeight: 28 }}>
          {urlLine && (
            <>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: accent, flexShrink: 0 }} />
              <span style={{ fontSize: 24, color: "rgba(255,255,255,0.72)" }}>{urlLine}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
