import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { FooterBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, relativeLuminance, pickContrastingColor, isValidHex, DEFAULT_BRAND, getLogoLinkUrl } from "@/lib/brand-config";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: FooterBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FooterBlockProps) => void;
}

export function BlockFooter({ props, brand, onFieldChange }: Props) {
  const bg = props.backgroundColor || "var(--brand-primary)";
  // Resolve the real background hex so every text type (logo, column titles,
  // links, copyright, borders) gets a contrast-checked color. Without this a
  // brand whose primary/accent is the same hue as the footer renders blue
  // text on a blue footer (or a same-color raster wordmark).
  const bgHex = isValidHex(props.backgroundColor ?? "")
    ? (props.backgroundColor as string)
    : isValidHex(brand.primaryColor)
      ? brand.primaryColor
      : DEFAULT_BRAND.primaryColor;
  const onBg = contrastTextColor(bgHex);
  const isDarkBg = relativeLuminance(bgHex) < 0.4;
  // Muted color helpers that follow the footer's text color rather than always
  // assuming a dark surface (white text).
  const muted = (a: number) =>
    onBg === "#ffffff" ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const accent = props.accentColor || brand.accentColor || "var(--brand-accent)";
  // Column title color: prefer the brand accent, but only if it reads on the
  // footer background; otherwise fall back to the contrast text color.
  const titleColor = pickContrastingColor(
    isValidHex(accent) ? accent : null,
    bgHex,
    [onBg],
    3.0,
  );
  const field = (key: keyof FooterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as FooterBlockProps[typeof key] }) : undefined;
  const cols = props.columns ?? [];
  const updateColumn = onFieldChange
    ? (ci: number, patch: Partial<NonNullable<FooterBlockProps["columns"]>[number]>) =>
        onFieldChange({
          ...props,
          columns: cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
        })
    : undefined;
  const updateLink = onFieldChange
    ? (ci: number, li: number, patch: Partial<NonNullable<FooterBlockProps["columns"]>[number]["links"][number]>) =>
        onFieldChange({
          ...props,
          columns: cols.map((c, i) =>
            i === ci ? { ...c, links: c.links.map((l, j) => (j === li ? { ...l, ...patch } : l)) } : c,
          ),
        })
    : undefined;

  return (
    <footer style={{ backgroundColor: bg, color: onBg }} className="w-full">
      <div className="max-w-6xl mx-auto px-8 pt-16 pb-10">
        <div className="flex flex-col md:flex-row gap-12 md:gap-16">
          <div className="flex-shrink-0">
            {(() => {
              const logo = (
                <BrandLogo
                  brand={brand}
                  tone={isDarkBg ? "onPrimary" : "onLight"}
                  alt={brand.brandName || "Logo"}
                  className="w-40 h-auto"
                  style={{ opacity: 0.9 }}
                />
              );
              const logoLink = getLogoLinkUrl(brand);
              return logoLink ? (
                <a href={logoLink} target="_blank" rel="noopener noreferrer" className="inline-block">
                  {logo}
                </a>
              ) : logo;
            })()}
          </div>

          {(props.columns ?? []).length > 0 && (
            <div className={cn(
              "grid gap-10 flex-1",
              (props.columns ?? []).length === 1 ? "grid-cols-1" :
              (props.columns ?? []).length === 2 ? "grid-cols-2" :
              (props.columns ?? []).length === 3 ? "grid-cols-2 md:grid-cols-3" :
              "grid-cols-2 md:grid-cols-4"
            )}>
              {cols.map((col, ci) => (
                <div key={ci}>
                  <p
                    className="text-xs font-semibold tracking-widest uppercase mb-4"
                    style={{ color: titleColor, fontFamily: BODY }}
                  >
                    <InlineText
                      as="span"
                      value={col.title}
                      onUpdate={updateColumn ? (v) => updateColumn(ci, { title: v }) : undefined}
                    style={{ fontFamily: BODY }}/>
                  </p>
                  <ul className="space-y-2.5">
                    {col.links.map((link, li) => {
                      // OneTrust "Do Not Sell or Share My Personal Information"
                      // trigger is rendered as the next list item directly
                      // beneath any link whose label reads "Privacy Requests"
                      // (case-insensitive) so it sits naturally with the
                      // surrounding privacy links wherever the operator has
                      // placed that link. The id + class are the hooks the
                      // OneTrust SDK looks for to attach its modal handler
                      // at runtime; without them the button is inert. Styled
                      // to match the surrounding <a> links exactly so it
                      // reads as a regular footer link.
                      const isPrivacyRequests =
                        link.label.trim().toLowerCase() === "privacy requests";
                      return (
                        <Fragment key={li}>
                          <li style={{ fontFamily: BODY }}>
                            {onFieldChange ? (
                              <span className="text-sm cursor-text opacity-50" style={{ fontFamily: BODY, color: onBg }}>
                                <InlineText
                                  as="span"
                                  value={link.label}
                                  onUpdate={updateLink ? (v) => updateLink(ci, li, { label: v }) : undefined}
                                style={{ fontFamily: BODY }}/>
                              </span>
                            ) : (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm opacity-50 hover:opacity-80 transition-opacity"
                                style={{ color: onBg }}
                              >
                                {link.label}
                              </a>
                            )}
                          </li>
                          {isPrivacyRequests && (
                            <li style={{ fontFamily: BODY }}>
                              {onFieldChange ? (
                                <span className="text-sm cursor-text opacity-50" style={{ fontFamily: BODY, color: onBg }}>
                                  Do Not Sell or Share My Personal Information
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  id="ot-sdk-btn"
                                  className="ot-sdk-show-settings text-sm opacity-50 hover:opacity-80 transition-opacity bg-transparent border-0 p-0 text-left cursor-pointer"
                                  style={{ color: onBg }}
                                >
                                  Do Not Sell or Share My Personal Information
                                </button>
                              )}
                            </li>
                          )}
                        </Fragment>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: muted(0.1) }}>
          <p className="text-xs opacity-40" style={{ fontFamily: BODY, color: onBg }}>
            {onFieldChange ? (
              <InlineText
                as="span"
                value={
                  props.copyrightText
                    ? props.copyrightText
                    : brand.copyrightName
                      ? `© ${new Date().getFullYear()} ${brand.copyrightName}. All rights reserved.`
                      : `© ${new Date().getFullYear()} All rights reserved.`
                }
                onUpdate={field("copyrightText")}
              style={{ fontFamily: BODY }}/>
            ) : (
              props.copyrightText
                ? props.copyrightText
                : brand.copyrightName
                  ? `© ${new Date().getFullYear()} ${brand.copyrightName}. All rights reserved.`
                  : `© ${new Date().getFullYear()} All rights reserved.`
            )}
          </p>

          {props.showSocialLinks && (
            <div className="flex items-center gap-5">
              {props.facebookUrl && (
                <a href={props.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="opacity-40 hover:opacity-70 transition-opacity" style={{ color: onBg }}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
              {props.instagramUrl && (
                <a href={props.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="opacity-40 hover:opacity-70 transition-opacity" style={{ color: onBg }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {props.linkedinUrl && (
                <a href={props.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="opacity-40 hover:opacity-70 transition-opacity" style={{ color: onBg }}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
