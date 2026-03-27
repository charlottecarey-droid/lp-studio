import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Mail,
  Phone,
  Linkedin,
  Building2,
  Users,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Upload,
  Download,
  X,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Contact = {
  id: string;
  parent_company: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  title_level: string | null;
  department: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  dso_size: string | null;
  pe_firm: string | null;
  abm_stage: string | null;
  salesforce_id: string | null;
};

type Microsite = {
  id: string;
  company_name: string;
  slug: string;
};

// Call Claude API (via edge function) with web search to research the contact, then write the email
async function generateEmailWithAI(contact: Contact, microsite?: Microsite): Promise<string> {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "the contact";
  const micrositeNote = microsite
    ? `A personalized microsite for ${contact.parent_company} is already live. Reference it naturally in the email using the exact placeholder [MICROSITE_URL] where the link should appear — do not write a real URL. Example: "we put together a quick look at how that math works for ${contact.parent_company} — [MICROSITE_URL]"`
    : "No microsite exists for this company yet. Do not mention a microsite or link.";

  const userPrompt = `You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.

Before writing, do 2-3 web searches to find anything specific and recent about this person and company. Cast a wide net — don't just rely on LinkedIn:

- Search: "${contact.first_name} ${contact.last_name} ${contact.parent_company}" — check Google, news articles, press mentions, conference appearances, podcast interviews, industry publications (Dental Economics, DSO News, Group Dentistry Now, etc.)
- Search: "${contact.parent_company} expansion acquisition growth 2025 2026" — look for press releases, DSO news sites, PE firm announcements, job postings that signal growth (e.g. "hiring 10 regional managers" = expansion mode)
- If the first two return nothing useful, try: "${contact.parent_company} dental group news" or "${contact.first_name} ${contact.last_name} dental"

Good hooks to look for: new market expansion, recent acquisition, new leadership hire (them specifically, in the last 3 months), a conference talk or quote, a company milestone, or a job posting that reveals a strategic priority.

RECENCY RULE: Only use something as a hook if it happened within the last 6 months. Anything older — a LinkedIn post, an old hiring announcement, a stale press release — ignore it entirely and lead with a pain point instead. An outdated hook is worse than no hook.

=== CONTACT ===
Name: ${name}
Title: ${contact.title || "unknown"}${contact.title_level ? ` (${contact.title_level})` : ""}
Department: ${contact.department || "unknown"}
Company: ${contact.parent_company}
DSO Size: ${contact.dso_size ? `${contact.dso_size} locations` : "unknown"}
PE-backed by: ${contact.pe_firm || "none known"}
${micrositeNote}

=== DANDY POSITIONING ===
Core message: "The world's fastest growing DSOs unlock more EBITDA with Dandy."

Dandy is an end-to-end lab partner built for DSOs at the growth stage where acquisitions are slowing and same-store performance is the primary lever. By embedding standardized workflows, AI-driven quality control, and centralized visibility into the clinical process, Dandy turns the lab from a fragmented cost center into a scalable revenue engine.

The four DSO pain points Dandy directly solves:
1. Pressure on same-store growth — acquisition pipelines are slowing; DSOs must get more from existing practices
2. Fragmented, non-actionable data — leaders have dashboards but can't intervene early or standardize outcomes
3. Standardization vs. clinical autonomy — executives need consistency; doctors need to feel trust, not surveillance
4. Capital constraints — scanner cost ($40-75K per operatory) limits deployment and production volume

The five messaging pillars (pick the one most relevant to this contact's role):
- "Same-store growth is the new growth engine" — the lab is one of the few remaining EBITDA levers
- "Growth breaks without a standard that scales" — variability creeps in as networks expand; one standard prevents it
- "Waste is the hidden tax on every DSO" — remakes and chair-time loss don't show as line items but quietly drain margin
- "Visibility isn't reporting, it's control" — the ability to intervene early, manage by exception, and catch variability before it scales
- "Enterprise growth shouldn't require enterprise risk" — validate value during a pilot before committing at scale

=== PROOF POINTS BY PERSONA ===

CFO / Finance / VP Finance:
- A $10 "savings" on a crown = $780 in lost value once remakes, chair time, and patient dropout are factored in. Across 50,000 procedures = $2M+ annual impact.
- APEX Dental Partners reduced remake rate 29% -> projected 12.5% increase in annualized revenue
- Zero scanner CAPEX — Dandy placed $1.5M+ in free scanners at APEX; DCA (400 practices) got 100 scanners placed vs 4-6 with competitors
- Month-to-month scanner terms — no 3-5 year penalty contracts like iTero/3Shape

COO / VP Operations / Operations:
- DCA had 400 practices and 400+ different lab relationships. Dan Gast: "It was a nightmare."
- Dandy Hub = real-time dashboard across every location: remake rates, scanner utilization, who's ordering, case mix.
- DCA consolidated to a preferred program without forcing doctors

CDO / Clinical Director / Chief Dental Officer:
- APEX remake rate down 29%; providers with consistent scanning habits hit zero remakes within a year
- DCA remake rate ~1% — with full transparent tracking, not estimates
- AI margin detection means RDAs handle prep review without pulling the doctor

CEO / President / Founder:
- APEX projected 12.5% revenue increase; unlocked previously unprofitable denture and complex case revenue
- Low-risk entry: free scanner + lab credits = "almost a no-lose situation"

Growth / Expansion / M&A / Strategy:
- Free intraoral scanner per operatory — eliminates the $40-75K capital barrier per location
- Dandy scales with you: same workflow at 10 locations or 200+

=== EMAIL FORMAT ===
Each sentence goes on its own line with a blank line between them.

The structure:
Subject: [subject line]

Hi [First Name],

[1-sentence hook — research-based or pain point]

[1-sentence Dandy proof point with a real number or quote]

[1-sentence soft CTA]

Best,

=== EMAIL RULES ===
- 3 sentences max in the body. One sentence per line. Blank line between each.
- Sound like a real person messaging a peer, not a sales rep filing an outreach task
- If a research hook is relevant, lead with it — make it specific
- If nothing useful comes from research, open directly with the pain point
- Never open with: "I hope", "My name is", "I'm reaching out", "I came across your profile"
- No buzzwords: leverage, synergy, streamline, revolutionize, excited to connect, game-changer, innovative solution, transform, empower, robust, cutting-edge
- Don't over-explain Dandy — one clear idea lands better than a product tour
- If a microsite exists for ${contact.parent_company}, use the placeholder [MICROSITE_URL] exactly once where the link belongs
- CTA should be low-commitment
- End with "Best,"
- Subject line first, prefixed "Subject: ", then a blank line, then the email body

Output only the email. Nothing else.`;

  const { data, error } = await supabase.functions.invoke("generate-email", {
    body: { prompt: userPrompt },
  });

  if (error) {
    throw new Error(error.message || "Email generation failed");
  }

  const email = (data as { email?: string } | null)?.email;
  return email || "Could not generate email.";
}

export default function DSOContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [micrositeOnly, setMicrositeOnly] = useState(false);
  const [perPage, setPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string>("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch ALL contacts by paginating through Supabase's 1000-row limit
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["target_contacts"],
    queryFn: async () => {
      const pageSize = 1000;
      let page = 0;
      let all: Contact[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("target_contacts")
          .select("*")
          .order("parent_company", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        all = [...all, ...(data as unknown as Contact[])];
        if (!data || data.length < pageSize) break;
        page++;
      }
      return all;
    },
  });

  // Fetch microsites for cross-reference
  const { data: microsites = [] } = useQuery({
    queryKey: ["microsites_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("microsites")
        .select("id, company_name, slug");
      if (error) throw error;
      return data as Microsite[];
    },
  });

  // Must be defined before any useMemo that calls it
  const getMicrositeForCompany = (company: string) =>
    microsites.find(
      (m) =>
        m.company_name.toLowerCase().trim() === company.toLowerCase().trim() ||
        company.toLowerCase().includes(m.company_name.toLowerCase())
    );

  // ABM stage badge colour
  const abmStageStyle = (stage: string): string => {
    switch (stage) {
      case "Target":            return "bg-muted/50 text-muted-foreground";
      case "Researching":       return "bg-blue-50 text-blue-500";
      case "Prospecting":       return "bg-indigo-50 text-indigo-600";
      case "Active Outreach":   return "bg-violet-50 text-violet-600";
      case "Engaged":           return "bg-yellow-50 text-yellow-600";
      case "Meeting Scheduled": return "bg-orange-50 text-orange-600";
      case "Opportunity Created": return "bg-green-50 text-green-700";
      case "Nurture":           return "bg-muted/50 text-slate-500";
      case "Closed Won":        return "bg-green-100 text-green-700";
      case "Closed Lost":       return "bg-red-50 text-red-500";
      default:                  return "bg-muted text-muted-foreground";
    }
  };

  // Unique companies for filter
  const companies = useMemo(() => {
    const set = new Set(contacts.map((c) => c.parent_company));
    return Array.from(set).sort();
  }, [contacts]);

  // Unique title levels
  const levels = useMemo(() => {
    const set = new Set(contacts.map((c) => c.title_level).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [contacts]);

  // Unique ABM stages (in a sensible funnel order, with unknown stages appended)
  const STAGE_ORDER = [
    "Target", "Researching", "Prospecting", "Active Outreach",
    "Engaged", "Meeting Scheduled", "Opportunity Created",
    "Nurture", "Closed Won", "Closed Lost",
  ];
  const stages = useMemo(() => {
    const set = new Set(contacts.map((c) => c.abm_stage).filter(Boolean) as string[]);
    const known = STAGE_ORDER.filter(s => set.has(s));
    const unknown = Array.from(set).filter(s => !STAGE_ORDER.includes(s)).sort();
    return [...known, ...unknown];
  }, [contacts]);

  // Filtered contacts
  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        [c.first_name, c.last_name, c.parent_company, c.title, c.email, c.department]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchCompany = companyFilter === "all" || c.parent_company === companyFilter;
      const matchLevel = levelFilter === "all" || c.title_level === levelFilter;
      const matchStage = stageFilter === "all" || c.abm_stage === stageFilter;
      const matchMicrosite = !micrositeOnly || !!getMicrositeForCompany(c.parent_company);
      return matchSearch && matchCompany && matchLevel && matchStage && matchMicrosite;
    });
  }, [contacts, search, companyFilter, levelFilter, stageFilter, micrositeOnly, microsites]);

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered) {
      const list = map.get(c.parent_company) || [];
      list.push(c);
      map.set(c.parent_company, list);
    }
    return map;
  }, [filtered]);

  // Paginate: slice filtered contacts then re-group for display
  const totalPages = perPage === 0 ? 1 : Math.ceil(filtered.length / perPage);
  const paginatedContacts = useMemo(() => {
    if (perPage === 0) return filtered;
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  const paginatedGrouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of paginatedContacts) {
      const list = map.get(c.parent_company) || [];
      list.push(c);
      map.set(c.parent_company, list);
    }
    return map;
  }, [paginatedContacts]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
    toast.success("Copied!");
  };

  const handleCopyEmail = async (emailText: string) => {
    await navigator.clipboard.writeText(emailText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    toast.success("Email copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading contacts…</p>
        </div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Import your contact list to get started.
          </p>
          <button
            onClick={() => navigate("/import-contacts")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Contacts
          </button>
        </div>
      </div>
    );
  }

  const selectedMicrosite = selectedContact
    ? getMicrositeForCompany(selectedContact.parent_company)
    : undefined;

  // Parse subject line out of generated email if present
  const emailSubject = generatedEmail.match(/^Subject:\s*(.+)/m)?.[1] ?? null;
  const rawBody = emailSubject
    ? generatedEmail.replace(/^Subject:\s*.+\n\n?/m, "").trim()
    : generatedEmail;

  // Split off any meta-note Claude prepends before "Hi [Name],"
  const greetingIdx = rawBody.search(/Hi\s+\w/);
  const researchNote = greetingIdx > 0 ? rawBody.slice(0, greetingIdx).trim() : null;
  const emailBody = greetingIdx > 0 ? rawBody.slice(greetingIdx) : rawBody;

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length.toLocaleString()} contacts across {companies.length} companies
            {microsites.length > 0 && (
              <button
                onClick={() => setMicrositeOnly((v) => !v)}
                className={`ml-2 font-medium transition-colors ${
                  micrositeOnly
                    ? "text-primary underline underline-offset-2"
                    : "text-accent-warm-foreground hover:text-primary"
                }`}
              >
                · {microsites.length} active microsites
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const headers = ["Company","First Name","Last Name","Title","Level","Department","Role","Email","Phone","LinkedIn","DSO Size","PE Firm","ABM Stage"];
              const escape = (v: string) => {
                if (!v) return "";
                return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
              };
              const rows = filtered.map(c => [
                c.parent_company, c.first_name ?? "", c.last_name ?? "", c.title ?? "",
                c.title_level ?? "", c.department ?? "", c.contact_role ?? "", c.email ?? "",
                c.phone ?? "", c.linkedin_url ?? "", c.dso_size ?? "", c.pe_firm ?? "", c.abm_stage ?? "",
              ].map(escape).join(","));
              const csv = [headers.join(","), ...rows].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filtered.length} contacts`);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-sm font-semibold rounded-lg hover:bg-muted/50 transition-colors text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => navigate("/import-contacts")}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-sm font-semibold rounded-lg hover:bg-muted/50 transition-colors text-foreground"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Contacts
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search by name, company, title, email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Company filter */}
        <div className="relative">
          <select
            value={companyFilter}
            onChange={(e) => { setCompanyFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-foreground"
          >
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Level filter */}
        {levels.length > 0 && (
          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => { setLevelFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-foreground"
            >
              <option value="all">All levels</option>
              {levels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* ABM Stage filter */}
        {stages.length > 0 && (
          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-foreground"
            >
              <option value="all">All stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Per-page selector */}
        <div className="relative ml-auto">
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-foreground"
          >
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={250}>250 per page</option>
            <option value={0}>Show all</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No contacts match your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(paginatedGrouped.entries()).map(([company, people]) => {
            const microsite = getMicrositeForCompany(company);
            return (
              <motion.div
                key={company}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Company header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[13px] font-bold text-foreground">{company}</span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {people.length} contact{people.length !== 1 ? "s" : ""}
                    </span>
                    {people[0]?.dso_size && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        {people[0].dso_size} locations
                      </span>
                    )}
                    {people[0]?.abm_stage && (
                      <button
                        onClick={() => { setStageFilter(people[0].abm_stage!); setCurrentPage(1); }}
                        title={`Filter by stage: ${people[0].abm_stage}`}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors hover:opacity-80 ${abmStageStyle(people[0].abm_stage)}`}
                      >
                        {people[0].abm_stage}
                      </button>
                    )}
                  </div>
                  {microsite && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/dso/${microsite.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-warm-foreground bg-accent-warm/20 hover:bg-accent-warm/30 px-2.5 py-1 rounded-full transition-colors"
                      >
                        <Globe className="w-3 h-3" />
                        Microsite live
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/dso/${microsite.slug}`, `microsite-${microsite.slug}`)}
                        title="Copy microsite URL"
                        className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/50 hover:bg-muted px-2.5 py-1 rounded-full transition-colors"
                      >
                        {copiedField === `microsite-${microsite.slug}` ? (
                          <><Check className="w-3 h-3 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Copy URL</>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Contacts */}
                <div className="divide-y divide-border">
                  {people.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-bold text-primary-foreground">
                          {(contact.first_name?.[0] || "?")}{(contact.last_name?.[0] || "")}
                        </span>
                      </div>

                      {/* Name + title */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">
                          {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {contact.title || contact.contact_role || "—"}
                          {contact.title_level && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary/60">
                              {contact.title_level}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Contact info */}
                      <div className="flex items-center gap-3 shrink-0">
                        {contact.email && (
                          <button
                            onClick={() => copyToClipboard(contact.email!, `email-${contact.id}`)}
                            title={contact.email}
                            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === `email-${contact.id}` ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden md:inline max-w-[160px] truncate">{contact.email}</span>
                          </button>
                        )}
                        {contact.phone && (
                          <button
                            onClick={() => copyToClipboard(contact.phone!, `phone-${contact.id}`)}
                            title={contact.phone}
                            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === `phone-${contact.id}` ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Phone className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden lg:inline">{contact.phone}</span>
                          </button>
                        )}
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-[#0077b5] transition-colors"
                            title="LinkedIn"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Outreach button */}
                      <button
                        onClick={async () => {
                          const microsite = getMicrositeForCompany(contact.parent_company);
                          setSelectedContact(contact);
                          setGeneratedEmail("");
                          setGeneratingEmail(true);
                          try {
                            const email = await generateEmailWithAI(contact, microsite);
                            setGeneratedEmail(email);
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            toast.error(msg);
                            setGeneratedEmail(`Error: ${msg}`);
                          } finally {
                            setGeneratingEmail(false);
                          }
                        }}
                        className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity opacity-0 group-hover:opacity-100"
                      >
                        <Sparkles className="w-3 h-3" />
                        Draft email
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <p className="text-[12px] text-muted-foreground">
            Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length.toLocaleString()} contacts
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-[12px] font-medium border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current page
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-[12px] font-medium rounded-lg transition-colors ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card hover:bg-muted/50 text-foreground"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-[12px] font-medium border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Email draft modal */}
      <AnimatePresence>
        {selectedContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setSelectedContact(null); setGeneratedEmail(""); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="text-[14px] font-bold text-foreground">
                    Outreach email — {selectedContact.first_name} {selectedContact.last_name}
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    {selectedContact.title} · {selectedContact.parent_company}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedContact(null); setGeneratedEmail(""); }}
                  className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Email body */}
              <div className="px-6 py-4">
                {researchNote && !generatingEmail && (
                  <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-muted/50 rounded-lg border border-border">
                    <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed italic">{researchNote}</p>
                  </div>
                )}

                {selectedMicrosite && !generatingEmail && generatedEmail && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-accent-warm/15 rounded-lg border border-accent-warm/30">
                    <Globe className="w-3.5 h-3.5 text-accent-warm-foreground shrink-0" />
                    <p className="text-[12px] text-accent-warm-foreground font-medium">
                      Microsite for {selectedContact.parent_company} is referenced — URL will automatically populate when you hit "Open Email".
                    </p>
                  </div>
                )}

                {emailSubject && !generatingEmail && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Subject line</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border">
                      <p className="text-[13px] font-medium text-foreground flex-1">{emailSubject}</p>
                      <button
                        onClick={() => copyToClipboard(emailSubject, "subject")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedField === "subject" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {generatingEmail ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-[13px]">Researching {selectedContact?.parent_company} and writing email…</p>
                  </div>
                ) : (
                  <textarea
                    key={generatedEmail}
                    className="w-full text-[13px] text-foreground leading-relaxed border border-border rounded-xl p-4 h-56 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 font-mono bg-muted/20"
                    defaultValue={emailBody}
                  />
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
                <button
                  disabled={generatingEmail}
                  onClick={() => {
                    const textarea = document.querySelector("textarea");
                    const fullText = emailSubject
                      ? `Subject: ${emailSubject}\n\n${textarea?.value ?? emailBody}`
                      : (textarea?.value ?? emailBody);
                    handleCopyEmail(fullText);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  disabled={generatingEmail || !generatedEmail}
                  onClick={async () => {
                    const textarea = document.querySelector("textarea");
                    let body = textarea?.value ?? emailBody;

                    // Strip any meta-note Claude prepends before the greeting
                    const greetingIdx = body.search(/Hi\s+\w/);
                    if (greetingIdx > 0) body = body.slice(greetingIdx);

                    // Determine hotlink info if microsite exists
                    let hotlinkId: string | null = null;
                    let micrositeUrl = "";

                    if (selectedMicrosite) {
                      // Try to find or create a hotlink for this contact
                      const recipientName = [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(" ") || "Unknown";
                      const { data: existingHl } = await supabase
                        .from("microsite_hotlinks")
                        .select("id, token")
                        .eq("microsite_id", selectedMicrosite.id)
                        .eq("recipient_name", recipientName)
                        .limit(1);

                      if (existingHl && existingHl.length > 0) {
                        hotlinkId = existingHl[0].id;
                        micrositeUrl = `${window.location.origin}/dso/${selectedMicrosite.slug}?hl=${existingHl[0].token}`;
                      } else {
                        const token = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
                        const { data: newHl } = await supabase
                          .from("microsite_hotlinks")
                          .insert({ microsite_id: selectedMicrosite.id, recipient_name: recipientName, token })
                          .select("id, token")
                          .single();
                        if (newHl) {
                          hotlinkId = newHl.id;
                          micrositeUrl = `${window.location.origin}/dso/${selectedMicrosite.slug}?hl=${newHl.token}`;
                        } else {
                          micrositeUrl = `${window.location.origin}/dso/${selectedMicrosite.slug}`;
                        }
                      }
                      body = body.replace(/\[MICROSITE_URL\]/g, micrositeUrl);
                      if (micrositeUrl) {
                        const companyName = selectedContact?.parent_company || 'your team';
                        body += `\n\n---\n⚡ Before sending: highlight the URL above and hyperlink it to the text\n"See how the numbers work for ${companyName}" (or similar).\nThen delete this note before sending.`;
                      }
                    }

                    // Log outreach with SFDC ID for account-level attribution
                    const contactSfdcId = selectedContact?.salesforce_id || null;
                    const { data: logRow } = await supabase
                      .from("email_outreach_log")
                      .insert({
                        microsite_id: selectedMicrosite?.id || null,
                        hotlink_id: hotlinkId,
                        contact_id: selectedContact?.id || null,
                        recipient_email: selectedContact?.email || "",
                        recipient_name: [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(" ") || "Unknown",
                        subject: emailSubject || null,
                        salesforce_id: contactSfdcId,
                      } as any)
                      .select("id")
                      .single();



                    const to = encodeURIComponent(selectedContact?.email ?? "");
                    const subject = encodeURIComponent(emailSubject ?? "");
                    const encodedBody = encodeURIComponent(body);
                    window.open(
                      `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${encodedBody}`,
                      "_blank"
                    );
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Open in email
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
