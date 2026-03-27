import { loadLayoutDefault, saveLayoutDefault } from "./layout-defaults";

/* ── Section definition ── */
export interface SkinSection {
  id: string;
  label: string;
  visible: boolean;
  headline?: string;
  subheadline?: string;
}

/* ── Custom section ── */
export interface SkinCustomSection {
  id: string;
  headline: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonVideoUrl?: string;
  imageUrl?: string;
  layout: "centered" | "left-image" | "right-image";
}

/* ── Color palette ── */
export interface SkinColors {
  primary: string;       // e.g. "#0a0f0d" or "#1b3a2d"
  accent: string;        // e.g. "#2ecc71" or "#c8e84e"
  background: string;    // page bg
  textPrimary: string;   // main heading text
  textSecondary: string; // body/subtext
}

/* ── Typography ── */
export interface SkinTypography {
  headingFont: string;
  bodyFont: string;
  heroSize: "small" | "medium" | "large";
  headlineBold?: boolean;
  headlineSize?: "small" | "medium" | "large";
}

/* ── Headline size helper ── */
export function getHeadlineSizeClasses(size?: "small" | "medium" | "large"): string {
  switch (size) {
    case "small": return "text-2xl md:text-3xl lg:text-4xl";
    case "large": return "text-4xl md:text-5xl lg:text-6xl";
    default: return "text-3xl md:text-4xl lg:text-5xl";
  }
}

/* ── Section images ── */
export interface SkinSectionImages {
  heroImage?: string;
  aiScanReviewImage?: string;
  labTourImage?: string;
  labTourVideoUrl?: string; // YouTube/Vimeo/Loom embed URL replaces the lab tour image strip
  finalCTAImage?: string;
  caseStudyImages?: string[]; // up to 3 images for case study cards
}

/* ── Case study ── */
export interface SkinCaseStudy {
  name: string;
  stat: string;
  label: string;
  quote: string;
  author: string;
  minPractices?: number;
  maxPractices?: number;
  url?: string; // optional link to full case study page
}

/* ── Comparison row ── */
export interface SkinComparisonRow {
  need: string;
  dandy: string;
  traditional: string;
}

/* ── Stats bar item ── */
export interface SkinStat {
  value: string;
  label: string;
  minPractices?: number;
  maxPractices?: number;
}

/* ── Challenge card ── */
export interface SkinChallenge {
  title: string;
  desc: string;
}

/* ── Per-section style overrides ── */
export interface SectionStyleOverrides {
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
  headlineSize?: "small" | "medium" | "large";
  headlineBold?: boolean;
  paddingY?: number; // rem units
}

/* ── Full config ── */
export interface MicrositeSkinConfig {
  sections: SkinSection[];
  colors: SkinColors;
  typography: SkinTypography;
  heroHeadlinePattern: string; // e.g. "Built for {company}."
  heroSubtext: string; // body text under hero headline
  heroCTAText: string;
  secondaryCTAText: string;
  secondaryCTAVideoUrl?: string; // If set, secondary CTA opens a video modal instead of linking
  heroCTAVideoUrl?: string; // If set, hero CTA opens a video modal instead of linking
  navCTAVideoUrl?: string; // If set, nav CTA opens a video modal instead of linking
  finalCTAVideoUrl?: string; // If set, final CTA opens a video modal instead of linking
  heroCTAUrl?: string; // Per-button link URL (falls back to ctaUrl)
  secondaryCTAUrl?: string;
  navCTAUrl?: string;
  finalCTAUrl?: string;
  navCTAText: string;
  statsBar: SkinStat[];
  challenges: SkinChallenge[];
  comparisonRows: SkinComparisonRow[];
  caseStudies: SkinCaseStudy[];
  footerText: string;
  finalCTAHeadline: string;
  finalCTASubheadline: string;
  ctaUrl: string;
  sectionImages?: SkinSectionImages;
  customSections?: SkinCustomSection[];
  sectionStyles?: Record<string, SectionStyleOverrides>;
}

/* ── Expansion-specific types ── */
export interface ExpansionTeamMember {
  name: string;
  role: string;
  photo?: string;
  email?: string;
  calendlyUrl?: string;
}

export interface ExpansionPerk {
  icon: string; // lucide icon name
  title: string;
  desc: string;
}

export interface ExpansionPromo {
  title: string;
  desc: string;
  badge?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface ExpansionContentLink {
  title: string;
  desc: string;
  url: string;
  type: "video" | "pdf" | "article" | "webinar";
  imageUrl?: string;
}

export interface ExpansionFeatureBlock {
  label: string;   // e.g. "CASE ACCEPTANCE"
  title: string;   // e.g. "Boost case acceptance"
  desc: string;
  imageUrl?: string;
}

export interface ExpansionStat {
  value: string;
  label: string;
}

export interface ExpansionProduct {
  name: string;
  detail: string;
  price: string;
  icon: string; // lucide icon key (fallback)
  imageKey?: string; // product image key
}

export interface ExpansionPromise {
  title: string;
  desc: string;
  icon: string;
}

export interface ExpansionTestimonial {
  quote: string;
  author: string;
  location: string;
}

export interface ExpansionSkinConfig extends MicrositeSkinConfig {
  welcomeHeadline: string;
  welcomeSubtext: string;
  expansionStatsBar: ExpansionStat[];
  teamMembers: ExpansionTeamMember[];
  perks: ExpansionPerk[];
  promos: ExpansionPromo[];
  contentLinks: ExpansionContentLink[];
  featureBlocks: ExpansionFeatureBlock[];
  whyDandyHeadline: string;
  whyDandySubheadline: string;
  activationSteps: { step: string; title: string; desc: string }[];
  repCalendlyUrl: string;
  repName: string;
  repTitle: string;
  signupLabel: string;
  signupHeadline: string;
  signupSubheadline: string;
  signupBullets: string[];
  signupFormTitle: string;
  signupFormSubtitle: string;
  signupButtonText: string;
  heroVideoSize: "small" | "medium" | "large";
  // Paradigm Shift section
  paradigmShiftHeadline: string;
  paradigmShiftSubheadline: string;
  oldWayItems: string[];
  newWayItems: string[];
  // Products section
  productsHeadline: string;
  productsSubheadline: string;
  products: ExpansionProduct[];
  // Promises section
  promisesHeadline: string;
  promisesSubheadline: string;
  promises: ExpansionPromise[];
  // Testimonials section
  testimonialsHeadline: string;
  testimonialsSubheadline: string;
  testimonials: ExpansionTestimonial[];
}

/* ── DB keys ── */
export const EXECUTIVE_SKIN_KEY = "microsite_skin_executive";
export const SOLUTIONS_SKIN_KEY = "microsite_skin_solutions";
export const EXPANSION_SKIN_KEY = "microsite_skin_expansion";
export const FLAGSHIP_SKIN_KEY = "microsite_skin_flagship";
export const FLAGSHIP_DARK_SKIN_KEY = "microsite_skin_flagship_dark";
export const HEARTLAND_SKIN_KEY = "microsite_skin_heartland";
export const DANDY_SKIN_KEY = "microsite_skin_dandy";

/* ── Default sections per skin ── */
const EXECUTIVE_SECTIONS: SkinSection[] = [
  { id: "hero", label: "Hero", visible: true, headline: "Built for {company}." },
  { id: "hiddenCost", label: "Hidden Cost / Pain Points", visible: true, headline: "At {company}'s scale —" },
  { id: "comparison", label: "Comparison Table", visible: true, headline: "Lab consolidation shouldn't mean compromise" },
  { id: "dashboard", label: "Executive Dashboard", visible: true, headline: "Visibility isn't reporting. It's control." },
  { id: "aiScanReview", label: "AI Scan Review", visible: true, headline: "Remakes are a tax. AI eliminates them." },
  { id: "successStories", label: "Success Stories", visible: true, headline: "DSOs that switched and never looked back." },
  { id: "pilotApproach", label: "Pilot Approach", visible: true, headline: "Start small. Prove it out. Then scale." },
  { id: "labTour", label: "Lab Tour", visible: true, headline: "See vertical integration in action." },
  { id: "calculator", label: "ROI Calculator", visible: true, headline: "Calculate the cost of inaction." },
  { id: "finalCTA", label: "Final CTA", visible: true, headline: "Start with a few locations. Then scale with confidence." },
];

const SOLUTIONS_SECTIONS: SkinSection[] = [
  { id: "hero", label: "Hero", visible: true, headline: "The lab partner built for {company}" },
  { id: "statsBar", label: "Stats Bar", visible: true },
  { id: "challenges", label: "Industry Challenges", visible: true, headline: "At scale — even small inefficiencies compound fast." },
  { id: "comparison", label: "Comparison Table", visible: true, headline: "Lab consolidation shouldn't mean compromise." },
  { id: "dashboard", label: "Executive Dashboard", visible: true, headline: "Dashboards don't change outcomes. Decisions do." },
  { id: "aiScanReview", label: "AI Scan Review", visible: true, headline: "Remakes are a tax. AI eliminates them." },
  { id: "successStories", label: "Success Stories", visible: true, headline: "DSOs that switched and never looked back." },
  { id: "pilotApproach", label: "Pilot Approach", visible: true, headline: "Start small. Prove it out. Then scale." },
  { id: "labTour", label: "Lab Tour", visible: true, headline: "See vertical integration in action." },
  { id: "calculator", label: "ROI Calculator", visible: true, headline: "Calculate the cost of inaction." },
  { id: "finalCTA", label: "Final CTA", visible: true, headline: "Prove ROI. Then scale." },
];

const DEFAULT_COMPARISON_ROWS: SkinComparisonRow[] = [
  { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
  { need: "Multi-Brand Consistency", dandy: "One standard across all brands and locations", traditional: "Varies by location and vendor" },
  { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
  { need: "Executive Visibility", dandy: "Real-time, actionable data across all offices", traditional: "Fragmented, non-actionable reports" },
  { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
  { need: "Change Management", dandy: "Hands-on training that respects clinical autonomy", traditional: "Minimal onboarding, slow rollout" },
];

const DEFAULT_CASE_STUDIES: SkinCaseStudy[] = [
  { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann, Founder" },
  { name: "Open & Affordable Dental", stat: "96%", label: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director" },
  { name: "Dental Care Alliance", stat: "99%", label: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller, Chief Clinical Officer" },
];

const DEFAULT_CHALLENGES: SkinChallenge[] = [
  { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
  { title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
  { title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
  { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
];

export const DEFAULT_EXECUTIVE_CONFIG: MicrositeSkinConfig = {
  sections: EXECUTIVE_SECTIONS,
  colors: {
    primary: "#0a0f0d",
    accent: "#2ecc71",
    background: "#0a0f0d",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255,255,255,0.5)",
  },
  typography: {
    headingFont: "Bagoss Standard",
    bodyFont: "system-ui",
    heroSize: "large",
  },
  heroHeadlinePattern: "Built for {company}.",
  heroSubtext: "A vertically integrated lab partner built to drive same-store growth, reduce waste, and scale with confidence.",
  heroCTAText: "Get Started",
  secondaryCTAText: "Calculate ROI",
  navCTAText: "Get Started",
  statsBar: [
    { value: "96%", label: "First-time right" },
    { value: "60%", label: "Fewer remakes" },
  ],
  challenges: DEFAULT_CHALLENGES,
  comparisonRows: DEFAULT_COMPARISON_ROWS,
  caseStudies: DEFAULT_CASE_STUDIES,
  footerText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
  finalCTAHeadline: "Start with a few locations. Then scale with confidence.",
  finalCTASubheadline: "We'll pilot at 5–10 offices, validate the impact on remakes, chair time, and revenue — then roll out with confidence across {company}.",
  ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  sectionImages: {},
};

export const DEFAULT_SOLUTIONS_CONFIG: MicrositeSkinConfig = {
  sections: SOLUTIONS_SECTIONS,
  colors: {
    primary: "#1b3a2d",
    accent: "#c8e84e",
    background: "#ffffff",
    textPrimary: "#1b3a2d",
    textSecondary: "#6b7280",
  },
  typography: {
    headingFont: "Bagoss Standard",
    bodyFont: "system-ui",
    heroSize: "large",
  },
  heroHeadlinePattern: "The lab partner built for {company}",
  heroSubtext: "End-to-end dental lab solutions with AI-powered quality, digital scanning, and U.S.-based manufacturing.",
  heroCTAText: "GET PRICING",
  secondaryCTAText: "CALCULATE ROI",
  navCTAText: "GET PRICING",
  statsBar: [
    { value: "30%", label: "Avg case acceptance lift" },
    { value: "96%", label: "First-time right rate" },
    { value: "50%", label: "Denture appointments saved" },
    { value: "$0", label: "CAPEX to get started" },
  ],
  challenges: DEFAULT_CHALLENGES,
  comparisonRows: DEFAULT_COMPARISON_ROWS,
  caseStudies: DEFAULT_CASE_STUDIES,
  footerText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
  finalCTAHeadline: "Prove ROI. Then scale.",
  finalCTASubheadline: "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift — then scale across {company} with confidence.",
  ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  sectionImages: {},
};

export const DEFAULT_EXPANSION_CONFIG: ExpansionSkinConfig = {
  sections: [
    { id: "hero", label: "Hero", visible: true },
    { id: "statsBar", label: "Stats Bar", visible: true },
    { id: "paradigmShift", label: "Old Way vs New Way", visible: true },
    { id: "features", label: "Why Dandy", visible: true },
    { id: "products", label: "Products", visible: true },
    { id: "promises", label: "Promises & Guarantees", visible: true },
    { id: "testimonials", label: "Testimonials", visible: true },
    { id: "team", label: "Your Team", visible: true },
    { id: "perks", label: "Partnership Perks", visible: true },
    { id: "promos", label: "Promotions", visible: true },
    { id: "activation", label: "Activation Steps", visible: true },
    { id: "resources", label: "Resources", visible: true },
    { id: "signup", label: "Signup Form", visible: true },
    { id: "finalCTA", label: "Final CTA", visible: true },
  ],
  colors: {
    primary: "#0a0f0d",
    accent: "#2ecc71",
    background: "#0a0f0d",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255,255,255,0.5)",
  },
  typography: { headingFont: "Bagoss Standard", bodyFont: "system-ui", heroSize: "large" },
  heroHeadlinePattern: "Welcome to your Dandy partnership, {company}.",
  heroSubtext: "Your practices now have access to Dandy's full platform — premium scanners, AI-powered quality, and a dedicated team ready to help you grow.",
  heroCTAText: "Activate Your Practice",
  secondaryCTAText: "Meet Your Team",
  navCTAText: "Book a Call",
  statsBar: [],
  expansionStatsBar: [
    { value: "6,000+", label: "dental practices" },
    { value: "96%", label: "first-time fit rate" },
    { value: "5 Days", label: "crown turnaround" },
  ],
  challenges: [],
  comparisonRows: [],
  caseStudies: [],
  footerText: "Trusted by 2,000+ dental offices · U.S.-based manufacturing · 96% first-time right",
  finalCTAHeadline: "Ready to activate your practice?",
  finalCTASubheadline: "Your dedicated team is standing by to get you started.",
  ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  sectionImages: {},
  welcomeHeadline: "Welcome to your Dandy partnership, {company}.",
  welcomeSubtext: "Your practices now have access to Dandy's full platform — premium scanners, AI-powered quality, and a dedicated team ready to help you grow.",
  teamMembers: [
    { name: "Asad Ahmed", role: "Enterprise AE", email: "asad.ahmed@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/asad-ahmed" },
    { name: "Benjamin Bilderback", role: "Enterprise AE UK Only", email: "benjamin.bilderback@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/benjamin-bilderback" },
    { name: "Dan MacAdam", role: "Strat AE", email: "dan.macadam@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/dan-macadam" },
    { name: "Matt Gorski", role: "Large Ent AE", email: "matt.gorski@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/Matt-Gorski" },
    { name: "Ann Marie Henke", role: "Strat AE", email: "ann.marie.henke@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/Ann-Marie-Henke" },
    { name: "Austin Donohue", role: "Large Ent AE", email: "austin.donohue@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/me/austin-donohue" },
    { name: "Tanner Cash", role: "Enterprise AE", email: "tanner.cash@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/me/tanner-cash/meeting-with-tanner-cash" },
    { name: "Kcy McCullough", role: "Enterprise AE", email: "kcy.mccullough@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/kcy-mccullough" },
    { name: "Matthew Cohen", role: "Enterprise AE", email: "matthew.cohen@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/matthew-cohen" },
    { name: "Molly Reilly", role: "Enterprise AE", email: "molly.reilly@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/molly-reilly" },
    { name: "Ilan Shaltuper", role: "Large Ent AE", email: "ilan.shaltuper@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/ilan-shaltuper" },
    { name: "Amanda Seek", role: "Inside AE", email: "amanda.seek@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/amanda-seek" },
    { name: "Eric Yapalater", role: "Inside AE", email: "eric.yapalater@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/eric-yapalater" },
    { name: "Scott Douglass", role: "Inside AE", email: "scott.douglass@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/scott-douglass" },
    { name: "Erica Bergman", role: "Sr Business Development", email: "erica.bergman@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/erica-bergman" },
    { name: "Mathis Clarke", role: "Sr Business Development", email: "mathis.clarke@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/mathis-clarke" },
    { name: "Sara Clarke", role: "Business Development", email: "sara.clarke@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/sara-clarke" },
    { name: "Harrison Corman", role: "Business Development", email: "harrison.corman@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/harrison-corman" },
    { name: "Brandon Hart", role: "Sr Business Development", email: "brandon.hart@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/brandon-hart" },
    { name: "Christopher Howell", role: "Sr Business Development", email: "christopher.howell@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/christopher-howell" },
    { name: "Elma Musanovic", role: "Sr Business Development", email: "elma.musanovic@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/elma-musanovic" },
    { name: "Tony Perez", role: "Sr Business Development", email: "tony.perez@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/tony-perez" },
    { name: "Harris Russell", role: "Business Development", email: "harris.russell@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/harris-russell" },
    { name: "Lauren Ryan", role: "Business Development", email: "lauren.ryan@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/lauren-ryan" },
    { name: "Matthew Shanahan", role: "Sr Business Development", email: "matthew.shanahan@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/matthew-shanahan" },
    { name: "Jacques Srour", role: "Sr Business Development", email: "jacques.srour@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/jacques-srour" },
    { name: "Nick Golden", role: "Enterprise AE", email: "nick.golden@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/nick-golden" },
    { name: "Erik Hansen", role: "Strat AE", email: "erik.hansen@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/me/erik-hansen" },
  ],
  perks: [
    { icon: "gift", title: "$100 UberEats Gift Card", desc: "Book a lunch-and-learn for your team — we'll bring the food and walk you through going digital with Dandy." },
    { icon: "star", title: "Dedicated DSO Support", desc: "Your own account team that knows your group's workflow, not a generic help desk. Direct line, same-day response." },
    { icon: "shield", title: "Free CE Credits", desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows — earn credits while you level up." },
    { icon: "sparkles", title: "$1,500 Lab Credit", desc: "New practices get $1,500 toward their first cases — enough to experience Dandy quality risk-free from day one." },
    { icon: "zap", title: "AI Scan Review", desc: "Real-time AI flags margin issues and prep problems while your patient is still in the chair — fewer remakes, faster seats." },
    { icon: "users", title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps and get cases right the first time." },
  ],
  promos: [
    { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
    { title: "$1,000 Lab Credit", desc: "Sign up within 90 days and put $1,000 toward crowns, bridges, or dentures — on us.", badge: "CREDIT", ctaText: "Get started" },
    { title: "Free Scanner + Cart", desc: "Your practice gets a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
    { title: "Free Laptop + Cart", desc: "Full digital setup for your operatory — scanner, laptop, and cart delivered and installed at no charge.", badge: "FREE", ctaText: "Reserve yours" },
  ],
  contentLinks: [
    { title: "Dandy Product Guide", desc: "2026 Product guide", url: "https://go.meetdandy.com/rs/103-HKO-179/images/Dandy_Product_Guide.pdf", type: "pdf" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773464062375-p8n01hcpr0m.jpeg" },
    { title: "2-Appointment Dentures", desc: "Your quick-start guide", url: "https://go.meetdandy.com/rs/103-HKO-179/images/2-Apt-Dentures_Quick-Start-Guide_8.75x11.25_102025.pdf.pdf", type: "pdf" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773515811194-lzo0b1o2ctd.png" },
    { title: "10 Tips for perfect fitting crowns", desc: "Expert-led webinar", url: "https://www.meetdandy.com/learning-center/webinars/10-tips-for-perfect-fitting-crowns-access/", type: "webinar" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773516015159-vnya8288tt.png" },
    { title: "2026 Intraoral Scanner Buyer's Guide", desc: "Find the right scanner for your practice", url: "https://go.meetdandy.com/rs/103-HKO-179/images/booklet-external-scanner-comparison-chart-2025.pdf", type: "article" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773516145123-gh7iq2dgeqr.png" },
    { title: "2-Appointment Dentures Webinar", desc: "Watch now on-demand", url: "https://www.meetdandy.com/learning-center/webinars/deliver-dentures-in-two-appointments-access/", type: "webinar" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773516540019-5basjj2fjt9.png" },
    { title: "Partner pricing guide", desc: "See your custom pricing", url: "https://www.meetdandy.com/pricing/", type: "article" as const, imageUrl: "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/1773517314188-jiy4d3m73i.png" },
  ],
  featureBlocks: [
    { label: "CASE ACCEPTANCE", title: "Boost case acceptance", desc: "Scan and show your patients their future smile while they're still in the chair with Dandy Cart and Smile Simulation." },
    { label: "QUALITY ASSURANCE", title: "Reduce remakes and rework", desc: "AI Scan Review and computer vision QC spots and fixes issues the human eye can't see — before they cost you." },
    { label: "ZERO CAPEX", title: "Go digital without the cost", desc: "Get a premium intraoral scanner at no cost as part of your DSO's partnership with Dandy." },
  ],
  whyDandyHeadline: "Better outcomes. Less chair time.",
  whyDandySubheadline: "The first and only full-service dental lab to unite scanning technology, on-demand clinical expertise, and advanced manufacturing into one integrated system.",
  activationSteps: [],
  repCalendlyUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  repName: "Your Dandy Representative",
  repTitle: "Enterprise Account Executive",
  signupLabel: "ACTIVATE YOUR PRACTICE",
  signupHeadline: "Get Started With Dandy",
  signupSubheadline: "Behind every great dentist, is a great lab. Enter your email and book a time with your dedicated team.",
  signupBullets: [
    "Scanner delivered and installed within 2 weeks",
    "Hands-on training for your entire team",
    "96% first-time fit rate — backed by guarantee",
  ],
  signupFormTitle: "Book a Meeting",
  signupFormSubtitle: "Enter your email to get started",
  signupButtonText: "Activate My Practice",
  heroVideoSize: "medium",
  // Paradigm Shift
  paradigmShiftHeadline: "Traditional labs weren't built for today's dentistry.",
  paradigmShiftSubheadline: "Dandy replaces fragmented, analog workflows with a single integrated digital platform.",
  oldWayItems: [
    "Remake-prone analog workflows",
    "Annoying calls saying your scan is bad",
    "Cross your fingers the case looks right",
    "Limited to 1–2 products per lab",
    "4–6 appointments for dentures",
    "2+ weeks for zirconia crowns",
  ],
  newWayItems: [
    "Scan for everything with fewer remakes",
    "AI reviews your scans with patient still in chair",
    "3D design approval — no surprises",
    "One lab for all your restorative needs",
    "2-appointment dentures",
    "5-day zirconia crowns",
  ],
  // Products
  productsHeadline: "One lab for everything your practice needs.",
  productsSubheadline: "Perfect fit. Fast turnarounds. One connected system that simplifies your entire restorative workflow.",
  products: [
    { icon: "crown", name: "Posterior Crowns", detail: "AI-perfected, 5-day turnaround", price: "From $99/unit" },
    { icon: "smile", name: "Anterior Crowns", detail: "Stunning aesthetics, free 3D approvals", price: "Premium materials" },
    { icon: "stethoscope", name: "Dentures", detail: "2-appointment digital workflow", price: "From $199/arch" },
    { icon: "target", name: "Implant Restorations", detail: "FDA-approved, custom abutments", price: "All systems supported" },
    { icon: "scan", name: "Guided Surgery", detail: "3D-printed surgical guides", price: "$109/site" },
    { icon: "sparkles", name: "Clear Aligners", detail: "Doctor-directed, 3D simulations", price: "Flexible plans" },
    { icon: "moon", name: "Night Guards & TMJ", detail: "Digital heatmaps, 3D-printed", price: "From $59 bundled" },
    { icon: "shield", name: "Sleep Appliances", detail: "MAD devices for OSA patients", price: "Medical billing support" },
  ],
  // Promises
  promisesHeadline: "Built on trust. Backed by guarantees.",
  promisesSubheadline: "We stand behind every case — because your reputation depends on it.",
  promises: [
    { icon: "ban", title: "Zero Long-Term Contracts", desc: "Simple, transparent pricing. No lock-ins, no hidden fees. Stay because you want to, not because you have to." },
    { icon: "rotate", title: "Free No-Hassle Remakes", desc: "If it doesn't fit, we'll make it right — no questions asked, no finger-pointing. Every single time." },
    { icon: "shieldCheck", title: "10-Year Warranty", desc: "Every crown, bridge, and restoration is backed by a 10-year warranty. Your patients are covered for years to come." },
  ],
  // Testimonials
  testimonialsHeadline: "Don't just take our word for it.",
  testimonialsSubheadline: "Hear from dentists who've transformed their practices with Dandy.",
  testimonials: [
    { quote: "Dandy's customer service is outstanding! From our first training session, our dental team felt well advised and supported. They really made us feel comfortable with a digital workflow.", author: "Brightwhites PC", location: "Virginia" },
    { quote: "Dandy has way more training than any other lab I've worked with. It's very structured, organized, easy to understand, and very relevant to current day-to-day problems for providers.", author: "Dr. Charlie Lucero", location: "Smiles Dental Services, WA" },
    { quote: "I love the ability to chat and message the lab so we're not wasting time holding on the phone. I get the feeling that they do care and will do their best to help me.", author: "Dr. Sarah Mitchell", location: "Little Big Smiles, TX" },
  ],
};

const FLAGSHIP_SECTIONS: SkinSection[] = [
  { id: "hero", label: "Hero", visible: true, headline: "Built for {company}." },
  { id: "hiddenCost", label: "Hidden Cost / Bento Grid", visible: true, headline: "At {company}'s scale — even small inefficiencies compound fast." },
  { id: "dashboard", label: "Platform Dashboard", visible: true, headline: "Visibility isn't reporting. It's control." },
  { id: "aiScanReview", label: "AI Scan Review", visible: true, headline: "Remakes are a tax. AI eliminates them." },
  { id: "comparison", label: "Comparison Cards", visible: true, headline: "Lab consolidation shouldn't mean compromise." },
  { id: "successStories", label: "Success Stories", visible: true, headline: "DSOs that switched and never looked back." },
  { id: "pilotApproach", label: "Pilot Approach", visible: true, headline: "Start small. Prove it out. Then scale." },
  { id: "labTour", label: "Lab Tour", visible: true, headline: "See vertical integration in action." },
  { id: "calculator", label: "ROI Calculator", visible: true, headline: "Calculate the cost of inaction." },
  { id: "finalCTA", label: "Final CTA", visible: true, headline: "Start with a few locations. Then scale with confidence." },
];

export const DEFAULT_FLAGSHIP_CONFIG: MicrositeSkinConfig = {
  sections: FLAGSHIP_SECTIONS,
  colors: {
    primary: "#0a2e1a",
    accent: "#2ecc71",
    background: "#ffffff",
    textPrimary: "#0a0f0d",
    textSecondary: "#6b7280",
  },
  typography: { headingFont: "Bagoss Standard", bodyFont: "system-ui", heroSize: "large" },
  heroHeadlinePattern: "Built for {company}.",
  heroSubtext: "A vertically integrated lab partner built to drive same-store growth, reduce waste, and scale with confidence.",
  heroCTAText: "Schedule a Conversation",
  secondaryCTAText: "Calculate ROI",
  navCTAText: "Get Started",
  statsBar: [
    { value: "96%", label: "First-time right" },
    { value: "60%", label: "Fewer remakes" },
    { value: "$0", label: "CAPEX" },
    { value: "5 days", label: "Crown turnaround" },
  ],
  challenges: DEFAULT_CHALLENGES,
  comparisonRows: DEFAULT_COMPARISON_ROWS,
  caseStudies: DEFAULT_CASE_STUDIES,
  footerText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
  finalCTAHeadline: "Start with a few locations. Then scale with confidence.",
  finalCTASubheadline: "We'll pilot at 5–10 offices, validate the impact on remakes, chair time, and revenue — then roll out with confidence across {company}.",
  ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  sectionImages: {},
};

export const DEFAULT_FLAGSHIP_DARK_CONFIG: MicrositeSkinConfig = {
  ...DEFAULT_FLAGSHIP_CONFIG,
  colors: {
    primary: "#0a0f0d",
    accent: "#2ecc71",
    background: "#0a0f0d",
    textPrimary: "#f0f4f2",
    textSecondary: "rgba(255,255,255,0.55)",
  },
};

const HEARTLAND_SECTIONS: SkinSection[] = [
  { id: "hero", label: "Hero", visible: true, headline: "Built for {company}." },
  { id: "hiddenCost", label: "Hidden Cost / Pain Points", visible: true, headline: "At {company}'s scale — even small inefficiencies compound fast." },
  { id: "problem", label: "The Problem", visible: true, headline: "Lab consolidation shouldn't mean compromise." },
  { id: "comparison", label: "Comparison Table", visible: true, headline: "Your lab should be a competitive advantage." },
  { id: "solution", label: "The Dandy Platform", visible: false, headline: "Four systems. One growth engine." },
  { id: "dashboard", label: "Executive Dashboard", visible: true, headline: "Visibility isn't reporting. It's control." },
  { id: "aiScanReview", label: "AI Scan Review", visible: true, headline: "Remakes are a tax. AI eliminates them." },
  { id: "successStories", label: "Success Stories", visible: true, headline: "DSOs that switched and never looked back." },
  { id: "pilotApproach", label: "Pilot Approach", visible: true, headline: "Start small. Prove it. Then scale." },
  { id: "labTour", label: "Lab Tour", visible: true, headline: "See vertical integration in action." },
  { id: "calculator", label: "ROI Calculator", visible: true, headline: "Calculate the cost of inaction." },
  { id: "finalCTA", label: "Final CTA", visible: true, headline: "Prove ROI at a handful of practices — then scale across {company}." },
];

export const DEFAULT_HEARTLAND_CONFIG: MicrositeSkinConfig = {
  sections: HEARTLAND_SECTIONS,
  colors: {
    primary: "#8db63c",
    accent: "#8db63c",
    background: "#0b1214",
    textPrimary: "#fafafa",
    textSecondary: "rgba(255,255,255,0.55)",
  },
  typography: { headingFont: "Bagoss Standard", bodyFont: "system-ui", heroSize: "large" },
  heroHeadlinePattern: "Built for {company}.",
  heroSubtext: "The lab partner built to match {company}'s scale — one standard across every practice.",
  heroCTAText: "Get Started",
  secondaryCTAText: "Calculate ROI",
  navCTAText: "GET STARTED",
  statsBar: [
    { value: "96%", label: "First-time right" },
    { value: "60%", label: "Fewer remakes" },
    { value: "$0", label: "CAPEX" },
    { value: "5 days", label: "Crown turnaround" },
  ],
  challenges: DEFAULT_CHALLENGES,
  comparisonRows: DEFAULT_COMPARISON_ROWS,
  caseStudies: DEFAULT_CASE_STUDIES,
  footerText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
  finalCTAHeadline: "Prove ROI at a handful of practices — then scale across {company}.",
  finalCTASubheadline: "We'll pilot at 5–10 practices, validate the impact on remakes, chair time, and revenue — then roll out with confidence.",
  ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
  sectionImages: {},
};

export const DEFAULT_DANDY_CONFIG: MicrositeSkinConfig = {
  ...DEFAULT_SOLUTIONS_CONFIG,
  colors: {
    primary: "#1b3a2d",
    accent: "#c8e84e",
    background: "#ffffff",
    textPrimary: "#1b3a2d",
    textSecondary: "#6b7280",
  },
  heroHeadlinePattern: "The lab partner built for {company} growth",
  heroSubtext: "Standardize quality + profitability across every location with real-time visibility into cost, turnaround, and clinical outcomes.",
  sections: [
    { id: "hero", label: "Hero", visible: true, headline: "The lab partner built for {company} growth" },
    { id: "statsBar", label: "Stats Bar", visible: true },
    { id: "challenges", label: "Hidden Cost (Horizontal Scroll)", visible: true, headline: "At scale — even small inefficiencies compound fast." },
    { id: "problem", label: "The Problem", visible: true, headline: "Lab consolidation shouldn't mean compromise." },
    { id: "comparison", label: "The Dandy Difference", visible: true, headline: "Built for DSO scale. Designed for provider trust." },
    { id: "dashboard", label: "Executive Dashboard", visible: true, headline: "Dashboards don't change outcomes. Decisions do." },
    { id: "aiScanReview", label: "AI Scan Review", visible: true, headline: "Remakes are a tax. AI eliminates them." },
    { id: "successStories", label: "Success Stories", visible: true, headline: "DSOs that switched and never looked back." },
    { id: "pilotApproach", label: "Pilot Approach", visible: true, headline: "Start small. Prove it out. Then scale." },
    { id: "labTour", label: "Lab Tour", visible: true, headline: "See vertical integration in action." },
    { id: "calculator", label: "ROI Calculator", visible: true, headline: "Calculate the cost of inaction." },
    { id: "finalCTA", label: "Final CTA", visible: true, headline: "Prove ROI. Then scale." },
  ],
};

export type SkinId = "executive" | "solutions" | "expansion" | "flagship" | "flagship-dark" | "heartland" | "dandy";

/* ── Load / Save helpers ── */
export async function loadSkinConfig(skin: SkinId): Promise<MicrositeSkinConfig | ExpansionSkinConfig> {
  const keyMap: Record<string, string> = { executive: EXECUTIVE_SKIN_KEY, solutions: SOLUTIONS_SKIN_KEY, expansion: EXPANSION_SKIN_KEY, flagship: FLAGSHIP_SKIN_KEY, "flagship-dark": FLAGSHIP_DARK_SKIN_KEY, heartland: HEARTLAND_SKIN_KEY, dandy: DANDY_SKIN_KEY };
  const defaultMap: Record<string, MicrositeSkinConfig | ExpansionSkinConfig> = { executive: DEFAULT_EXECUTIVE_CONFIG, solutions: DEFAULT_SOLUTIONS_CONFIG, expansion: DEFAULT_EXPANSION_CONFIG, flagship: DEFAULT_FLAGSHIP_CONFIG, "flagship-dark": DEFAULT_FLAGSHIP_DARK_CONFIG, heartland: DEFAULT_HEARTLAND_CONFIG, dandy: DEFAULT_DANDY_CONFIG };
  const key = keyMap[skin] || EXECUTIVE_SKIN_KEY;
  const defaults = defaultMap[skin] || DEFAULT_EXECUTIVE_CONFIG;
  const saved = await loadLayoutDefault(key);
  if (saved) {
    const merged = { ...defaults, ...saved } as any;
    const defaultSections = (defaults as any).sections as Array<{ id: string; label: string; visible: boolean }>;
    const savedSections = (saved as any).sections as Array<{ id: string; label: string; visible: boolean }> | undefined;
    if (defaultSections && savedSections) {
      const savedIds = new Set(savedSections.map(s => s.id));
      const missingSections = defaultSections.filter(s => !savedIds.has(s.id));
      if (missingSections.length > 0) {
        const result = [...savedSections];
        for (const missing of missingSections) {
          const defaultIdx = defaultSections.findIndex(s => s.id === missing.id);
          let insertAt = result.length;
          for (let i = defaultIdx - 1; i >= 0; i--) {
            const precedingIdx = result.findIndex(s => s.id === defaultSections[i].id);
            if (precedingIdx >= 0) { insertAt = precedingIdx + 1; break; }
          }
          result.splice(insertAt, 0, missing);
        }
        merged.sections = result;
      }
    }
    return merged;
  }
  return defaults;
}

export async function saveSkinConfig(skin: SkinId, config: MicrositeSkinConfig | ExpansionSkinConfig): Promise<void> {
  const keyMap: Record<string, string> = { executive: EXECUTIVE_SKIN_KEY, solutions: SOLUTIONS_SKIN_KEY, expansion: EXPANSION_SKIN_KEY, flagship: FLAGSHIP_SKIN_KEY, "flagship-dark": FLAGSHIP_DARK_SKIN_KEY, heartland: HEARTLAND_SKIN_KEY, dandy: DANDY_SKIN_KEY };
  const key = keyMap[skin] || EXECUTIVE_SKIN_KEY;
  await saveLayoutDefault(key, config as any);
}

/* ── Practice-count matching helper ── */
export function filterByPracticeCount<T extends { minPractices?: number; maxPractices?: number }>(
  items: T[],
  practiceCount: number | null,
  minResults: number = 0
): T[] {
  if (!practiceCount) return items;
  const matched = items.filter((item) => {
    const min = item.minPractices ?? 0;
    const max = item.maxPractices ?? Infinity;
    return practiceCount >= min && practiceCount <= max;
  });
  // Fall back to all items if nothing matches
  let result = matched.length > 0 ? matched : items;
  // Backfill from full list if we don't have enough results
  if (minResults > 0 && result.length < minResults) {
    const remaining = items.filter((item) => !result.includes(item));
    result = [...result, ...remaining].slice(0, minResults);
  }
  return result;
}
