import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandySiteFooterBlockProps } from "@/lib/block-types";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

interface Props {
  props: DandySiteFooterBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySiteFooterBlockProps) => void;
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.88672 0C0.427718 0 0 0.427218 0 5.88672V14.1133C0 19.5723 0.427719 20 5.88672 20H14.1133C19.5723 20 20 19.5728 20 14.1133V5.88672C20 0.427218 19.5728 0 14.1133 0H5.88672ZM4.58398 2H15.416C17.8125 2 18 2.18748 18 4.58398V15.416C18 17.8125 17.812 18 15.416 18H13.3086V12.0195H15.6768L16.0498 9.3584H13.3086V7.41113C13.3086 6.65063 13.952 6.26598 14.498 6.27148C15.044 6.27748 16.1748 6.27344 16.1748 6.27344V3.82031C16.1748 3.82031 15.1959 3.69312 14.1689 3.68262C13.3059 3.67362 12.353 3.90762 11.584 4.68262C10.8015 5.47062 10.6781 6.6446 10.6631 8.0791L10.6631 9.35742H8.3457V12.0186H10.6631V18H4.58398C2.18748 18 2 17.812 2 15.416V4.58398C2 2.18748 2.18748 2 4.58398 2Z" fill="#003A30"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.88672 0C0.427218 0 0 0.427218 0 5.88672V14.1133C0 19.5728 0.427218 20 5.88672 20H14.1133C19.5728 20 20 19.5728 20 14.1133V5.88672C20 0.427218 19.5728 0 14.1133 0H5.88672ZM4 6C4 5.448 4.448 5 5 5C5.552 5 6 5.448 6 6C6 6.552 5.552 7 5 7C4.448 7 4 6.552 4 6ZM4 8H6V16H4V8ZM8 8H10V9C10.4 8.4 11.2 8 12 8C14.2 8 15 9.8 15 12V16H13V12.5C13 11.1 12.6 10 11.5 10C10.4 10 10 10.9 10 12.5V16H8V8Z" fill="#003A30"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C7.284 0 6.944.012 5.878.06 4.813.109 4.086.278 3.45.525a5 5 0 00-1.81 1.178A5 5 0 00.462 3.513C.215 4.149.046 4.876 0 5.941-.048 7.007-.06 7.347-.06 10.06c0 2.714.012 3.054.06 4.12.049 1.065.218 1.792.465 2.428a5 5 0 001.178 1.81 5 5 0 001.81 1.178c.636.247 1.363.416 2.428.465 1.066.048 1.406.06 4.12.06 2.714 0 3.054-.012 4.12-.06 1.065-.049 1.792-.218 2.428-.465a5 5 0 001.81-1.178 5 5 0 001.178-1.81c.247-.636.416-1.363.465-2.428.048-1.066.06-1.406.06-4.12 0-2.713-.012-3.053-.06-4.12C19.791 4.876 19.622 4.149 19.375 3.513a5 5 0 00-1.178-1.81A5 5 0 0016.387.525C15.751.278 15.024.109 13.959.06 12.893.012 12.553 0 9.84 0H10zm-.717 1.802h.717c2.667 0 2.983.01 4.035.057.975.044 1.504.207 1.857.344.467.181.8.398 1.15.748.35.35.567.683.748 1.15.137.353.3.882.344 1.857.047 1.054.057 1.37.057 4.04 0 2.67-.01 2.986-.057 4.04-.044.975-.207 1.504-.344 1.857-.181.466-.398.8-.748 1.15-.35.35-.683.567-1.15.748-.353.137-.882.3-1.857.344-1.054.047-1.37.057-4.04.057-2.67 0-2.986-.01-4.04-.057-.975-.044-1.504-.207-1.857-.344a3.097 3.097 0 01-1.15-.748 3.097 3.097 0 01-.748-1.15c-.137-.353-.3-.882-.344-1.857-.047-1.054-.057-1.37-.057-4.04 0-2.67.01-2.986.057-4.04.044-.975.207-1.504.344-1.857.181-.467.398-.8.748-1.15.35-.35.683-.567 1.15-.748.353-.137.882-.3 1.857-.344 1.052-.047 1.368-.057 4.04-.057v.002zm8.005 1.478a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM10 4.865a5.135 5.135 0 100 10.27 5.135 5.135 0 000-10.27zm0 1.802a3.333 3.333 0 110 6.666 3.333 3.333 0 010-6.666z" fill="#003A30"/>
    </svg>
  );
}

export function BlockDandySiteFooter({ props, brand, onFieldChange }: Props) {
  const groups = props.linkGroups ?? [];
  const copyright = props.copyrightText || `© ${new Date().getFullYear()} Dandy`;

  return (
    <footer className="w-full bg-[#FDFCFA] border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-[220px_1fr] gap-12 mb-12">
          {/* Logo */}
          <div>
            <img
              src={props.logoUrl || dandyLogoUrl}
              alt="Dandy"
              className="h-10 w-auto mb-4"
            />
            {props.disclaimer && (
              <p className="text-xs text-slate-400 leading-relaxed">{props.disclaimer}</p>
            )}
          </div>

          {/* Link columns */}
          <div className={cn("grid gap-8", groups.length <= 2 ? "grid-cols-2" : groups.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
            {groups.map((group, i) => (
              <div key={i}>
                <span className="text-xs font-bold uppercase tracking-widest text-[#003A30] block mb-4">
                  {group.heading}
                </span>
                <ul className="space-y-2.5">
                  {(group.links ?? []).map((link, j) => (
                    <li key={j}>
                      <a
                        href={link.url || "#"}
                        className="text-sm text-slate-500 hover:text-[#003A30] transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">{copyright}</p>
          <div className="flex items-center gap-3">
            {props.facebookUrl && (
              <a href={props.facebookUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#003A30] transition-colors">
                <FacebookIcon />
              </a>
            )}
            {props.instagramUrl && (
              <a href={props.instagramUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#003A30] transition-colors">
                <InstagramIcon />
              </a>
            )}
            {props.linkedinUrl && (
              <a href={props.linkedinUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#003A30] transition-colors">
                <LinkedInIcon />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
