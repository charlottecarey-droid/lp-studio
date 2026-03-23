import { cn } from "@/lib/utils";
import type { FooterBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

interface Props {
  props: FooterBlockProps;
  brand: BrandConfig;
}

export function BlockFooter({ props, brand }: Props) {
  const bg = props.backgroundColor || "#003A30";
  const accent = props.accentColor || brand.accentColor || "#C7E738";

  return (
    <footer style={{ backgroundColor: bg }} className="w-full text-white">
      <div className="max-w-6xl mx-auto px-8 pt-16 pb-10">
        <div className="flex flex-col md:flex-row gap-12 md:gap-16">
          <div className="flex-shrink-0">
            <img
              src={dandyLogoUrl}
              alt="Dandy"
              className="w-40 h-auto"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }}
            />
          </div>

          {props.columns.length > 0 && (
            <div className={cn(
              "grid gap-10 flex-1",
              props.columns.length === 1 ? "grid-cols-1" :
              props.columns.length === 2 ? "grid-cols-2" :
              props.columns.length === 3 ? "grid-cols-2 md:grid-cols-3" :
              "grid-cols-2 md:grid-cols-4"
            )}>
              {props.columns.map((col, ci) => (
                <div key={ci}>
                  <p
                    className="text-xs font-semibold tracking-widest uppercase mb-4"
                    style={{ color: accent }}
                  >
                    {col.title}
                  </p>
                  <ul className="space-y-2.5">
                    {col.links.map((link, li) => (
                      <li key={li}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/50 text-sm hover:text-white/80 transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-xs">
            {props.copyrightText || `© ${new Date().getFullYear()} Dandy. All rights reserved.`}
          </p>

          {props.showSocialLinks && (
            <div className="flex items-center gap-5">
              {props.facebookUrl && (
                <a href={props.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
              {props.instagramUrl && (
                <a href={props.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {props.linkedinUrl && (
                <a href={props.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-white/40 hover:text-white/70 transition-colors">
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
