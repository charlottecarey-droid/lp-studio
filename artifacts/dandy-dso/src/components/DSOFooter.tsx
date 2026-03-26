import { useState } from "react";
import { ExternalLink } from "lucide-react";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";

const columns = [
  {
    title: "DANDY",
    links: [
      { label: "Home", href: "https://www.meetdandy.com" },
      { label: "Pricing", href: "https://www.meetdandy.com/pricing" },
      { label: "Get in touch", href: "https://www.meetdandy.com/get-started" },
      { label: "Careers", href: "https://www.meetdandy.com/careers" },
      { label: "Privacy Policy", href: "https://www.meetdandy.com/privacy-policy" },
      { label: "Terms of Use", href: "https://www.meetdandy.com/terms" },
    ],
  },
  {
    title: "PRODUCTS & TECHNOLOGY",
    links: [
      { label: "Vision Scanner & Cart", href: "https://www.meetdandy.com/technology/intraoral-scanner" },
      { label: "Chairside", href: "https://www.meetdandy.com/technology/chairside" },
      { label: "Lab Services", href: "https://www.meetdandy.com/labs" },
      { label: "Posterior Crown and Bridge", href: "https://www.meetdandy.com/labs/crown-and-bridge" },
      { label: "Digital Dentures", href: "https://www.meetdandy.com/labs/dentures" },
      { label: "Implant Solutions", href: "https://www.meetdandy.com/labs/implant-restorations" },
    ],
  },
  {
    title: "PRACTICES",
    links: [
      { label: "Private Practice", href: "https://www.meetdandy.com/solutions/private-practice" },
      { label: "Group Practice", href: "https://www.meetdandy.com/solutions/group-practice" },
      { label: "DSO", href: "https://www.meetdandy.com/solutions/dso" },
      { label: "Refer a practice", href: "https://www.meetdandy.com/refer" },
    ],
  },
  {
    title: "RESOURCES",
    links: [
      { label: "Learning Center", href: "https://www.meetdandy.com/learning-center" },
      { label: "Articles", href: "https://www.meetdandy.com/articles" },
      { label: "Webinars", href: "https://www.meetdandy.com/learning-center/webinars" },
      { label: "eBooks", href: "https://www.meetdandy.com/learning-center/ebooks" },
      { label: "Lab Product Catalog", href: "https://www.meetdandy.com/labs" },
    ],
  },
];

const DSOFooter = () => {
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [linkFontSize, setLinkFontSize] = useState(14);
  const [linkBold, setLinkBold] = useState(false);

  return (
    <footer className="bg-primary-deep text-primary-foreground py-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
          <div className="col-span-2 md:col-span-1">
            <img src={dandyLogoWhite} alt="Dandy" className="h-7 w-auto mb-8" />
            <p className="text-xs text-primary-foreground/40 leading-relaxed max-w-[180px]">
              The modern dental lab, built for scale.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/40 mb-5">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-[14px] text-primary-foreground/60 hover:text-primary-foreground transition-colors duration-200">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Custom external link input */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/40 mb-3">Add a custom link</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="text"
              placeholder="Link text"
              value={customLinkText}
              onChange={(e) => setCustomLinkText(e.target.value)}
              className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2 text-xs text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary-foreground/20 w-full sm:w-48"
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={customLinkUrl}
              onChange={(e) => setCustomLinkUrl(e.target.value)}
              className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2 text-xs text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary-foreground/20 w-full sm:w-72"
            />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-primary-foreground/40 whitespace-nowrap">Size</label>
              <input
                type="range"
                min={10}
                max={32}
                value={linkFontSize}
                onChange={(e) => setLinkFontSize(Number(e.target.value))}
                className="w-20 accent-primary-foreground/60"
              />
              <span className="text-[10px] text-primary-foreground/40 w-6">{linkFontSize}</span>
            </div>
            <button
              onClick={() => setLinkBold(!linkBold)}
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${linkBold ? 'bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground' : 'bg-transparent border-primary-foreground/15 text-primary-foreground/40'}`}
            >
              B
            </button>
            {customLinkText.trim() && customLinkUrl.trim() && (
              <a
                href={customLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                style={{ fontSize: `${linkFontSize}px`, lineHeight: 1.3, fontWeight: linkBold ? 700 : 400 }}
              >
                <ExternalLink style={{ width: `${linkFontSize}px`, height: `${linkFontSize}px` }} />
                <span>{customLinkText}</span>
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/35">
            © {new Date().getFullYear()} Dandy
          </p>
          <p className="text-xs text-primary-foreground/25">
            Prepared for DSO leadership teams.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default DSOFooter;
