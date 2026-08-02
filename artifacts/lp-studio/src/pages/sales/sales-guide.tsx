import { SalesLayout } from "@/components/layout/sales-layout";
import { useState } from "react";
import {
  Activity, Building2, Users, Globe,
  Mail, PenSquare, Megaphone, Store, Calculator, Presentation,
  ChevronRight, ChevronDown, BookOpen, Search, Plug, CalendarDays,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  /** Extra search terms. The filter used to match title/subtitle only, so
   *  searching "marketo", "slack" or "audience" returned "no sections match"
   *  even though the guide covered them. */
  keywords?: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "accounts",
    icon: Building2,
    title: "Accounts",
    subtitle: "Your target account list",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Accounts is the hub of the sales console. Every company you're selling to lives here, with its contacts, microsites, engagement signals, and ABM stage in one place.</p>
        <div className="space-y-3">
          <Feature title="Engagement Funnel">
            The top of the page shows how many of your accounts are Hot, Warm, Cool, or Cold based on recent activity. Use it to gauge pipeline health at a glance.
          </Feature>
          <Feature title="Account Detail">
            Click any account to open its detail page — full activity timeline, contacts, microsites with per-link engagement, and the ABM stage. Everything for one company in one view.
          </Feature>
          <Feature title="Filtering & Saved Views">
            Filter by ABM Tier, ABM Stage, Practice Segment, or Owner. Save the combinations you use most as named views so you don't have to re-apply them every day.
          </Feature>
          <Feature title="ABM Stage Tracking">
            Move accounts through stages (Target → Engaged → In Conversation → Closed Won/Lost) directly from the list or the detail page.
          </Feature>
        </div>
        <Tip>Create a saved view filtered to your name as Owner — that becomes your daily working list, and you can launch a Quick Campaign straight from it.</Tip>
      </div>
    ),
  },
  {
    id: "microsites",
    icon: Globe,
    // Named "Pages" in the nav — the guide called it Microsites everywhere,
    // which sent people looking for a tab that doesn't exist by that name.
    title: "Pages",
    subtitle: "AI-generated landing pages per account",
    keywords: "microsites hotlinks personalized links email preview share card analytics dwell",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Pages (called microsites when they're scoped to one account) are personalized landing pages built for a specific company. Every account should have at least one — it's the destination you send prospects to, and every visit is tracked back to a specific contact.</p>
        <div className="space-y-3">
          <Feature title="The Pages Table">
            The list doubles as your analytics view: views, unique visitors, known viewers, average time on page, and last visit for every page. Click a row to open the drill-down — visitors, links, traffic sources, and visit alerts in tabs.
          </Feature>
          <Feature title="Email Preview Cards">
            The envelope button puts a linked screenshot of the page on your clipboard, ready to paste into an email. On the Pages table and on an account's microsites tab it asks where the link should point — the plain page URL, or a personalized link for a contact you pick. Choose the contact: a plain link records an anonymous visit.
          </Feature>
          <Feature title="Open a Draft">
            Next to the copy button, one more button opens a prefilled draft with the recipient and link already filled in. Paste the card in with ⌘V — and if the clipboard fails, the draft still opens with a working link. Which client it opens (Gmail or your default mail app) is a workspace setting under Settings → Email → Sending.
          </Feature>
          <Feature title="AI Page Generation">
            Describe the account or the angle you want to lead with, and the system drafts an entire page tailored to them. Tweak it in the builder, or start from a Template Library page if you prefer a known-good layout.
          </Feature>
          <Feature title="Clone for Account">
            Use the Clone action on any existing page to spin up a private copy scoped to one account. Edit the copy freely — the original stays untouched.
          </Feature>
          <Feature title="Personalized Hotlinks">
            Generate a unique tracked link for each contact at an account. When that person clicks, you know exactly who visited and what they looked at — not just an anonymous pageview.
          </Feature>
          <Feature title="Visit Alerts">
            Add an email address (yours or anyone on the team's) to a page and you'll get a notification the moment a tracked contact opens it. Great for catching intent in real time.
          </Feature>
          <Feature title="Draft vs Published">
            Pages start as Drafts and are invisible to the public. Publish when you're ready to share the link, and unpublish any time you want to pull it back.
          </Feature>
          <Feature title="Apply CTA to All Sections">
            In the builder, the "Apply CTA to All Sections" action on any CTA field copies that link and label into every other CTA on the page — including ones inside columns and headers — so your page always points to a single, consistent destination.
          </Feature>
        </div>
        <Tip>Always build the microsite before you send any outreach. The personalized hotlink is what makes your emails trackable — without it you're flying blind.</Tip>
      </div>
    ),
  },
  {
    id: "activity",
    icon: Activity,
    title: "Activity",
    subtitle: "Real-time engagement feed",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Activity is a live stream of every engagement signal across your accounts — page visits, email opens, link clicks, and form submissions — as they happen.</p>
        <div className="space-y-3">
          <Feature title="Live Updates">
            The feed refreshes automatically. You don't have to reload — new signals appear as soon as they're recorded.
          </Feature>
          <Feature title="Filter by Type">
            Narrow the feed to one signal type (e.g. only form submissions, or only page visits) to focus on the events you care about right now.
          </Feature>
          <Feature title="Group by Account">
            Toggle "Group by Account" to collapse the feed by company — useful when you want to see total activity per account rather than a chronological stream.
          </Feature>
          <Feature title="Search & History">
            Scroll back through recent events, or use the search bar to find a specific company or contact quickly.
          </Feature>
        </div>
        <Tip>Spend five minutes on Activity before any call — knowing a contact visited the pricing section twenty minutes ago is the kind of context that changes a conversation.</Tip>
      </div>
    ),
  },
  {
    id: "contacts",
    icon: Users,
    title: "Contacts",
    subtitle: "People at your accounts",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Contacts is your stakeholder database — every individual person at every account, with their own engagement score and a fast path into outreach.</p>
        <div className="space-y-3">
          <Feature title="CSV Import">
            Upload a CSV to add contacts in bulk. The importer auto-maps common column names and supports Salesforce IDs for deduplication. Required columns: first name, last name, email, company name.
          </Feature>
          <Feature title="Individual Engagement Scores">
            Each contact has their own heat score from their personal interactions — not just the account's aggregate. Useful for knowing who at a company is actually leaning in.
          </Feature>
          <Feature title="Draft Email from a Contact">
            From any contact, jump straight into Draft Email with their details pre-filled. The fastest path from "I want to reach out to this person" to a sent message.
          </Feature>
          <Feature title="Audiences">
            Group contacts into named audiences for targeted campaigns. Audiences are the unit of bulk outreach — when you launch a Quick Campaign, you send to an audience. You can also build one straight from a Marketo static list (see Integrations).
          </Feature>
        </div>
        <Tip>If your CSV comes from Salesforce, include the SFDC Account ID column — contacts automatically link to the right account record without manual cleanup.</Tip>
      </div>
    ),
  },
  {
    id: "draft-email",
    icon: PenSquare,
    title: "Draft Email",
    subtitle: "1:1 personalized email composer",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Draft Email is the place to write a single, personalized email to one contact. It pulls together what the AI knows about them and their account so you can compose fast, then send from your own inbox.</p>
        <div className="space-y-3">
          <Feature title="Contact-Aware Drafting">
            Pick a contact (or arrive here from their profile) and the draft is generated using their role, account, recent engagement, and the angle you specify.
          </Feature>
          <Feature title="Research Brief">
            Alongside the draft you'll see a short research brief — talking points, recent signals, and reasons-to-reach-out — so you can edit with full context, not just a blank canvas.
          </Feature>
          <Feature title="Open in Gmail or Default Client">
            One click drops the subject and body into Gmail (or your default mail app) with the recipient pre-filled. Send from your own address with full deliverability, no inbox to wire up.
          </Feature>
          <Feature title="Save as Template">
            If a draft turns out well, save it as a template so it shows up in Campaigns → Email Templates for future bulk use.
          </Feature>
          <Feature title="Regenerate & Refine">
            Tweak the angle and regenerate, or edit inline. The subject, body, and any personalization variables are all editable before you send.
          </Feature>
        </div>
        <Tip>Always make sure the microsite link is in the body — it's the only way to attribute the resulting visits back to this contact.</Tip>
      </div>
    ),
  },
  {
    id: "campaigns",
    icon: Megaphone,
    title: "Campaigns",
    subtitle: "Bulk outreach and performance tracking",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Campaigns is where bulk outreach lives. It has two modes at the top of the page — <strong>Email Campaigns</strong> for sending templated email to an audience, and <strong>Personalized Pages</strong> for sending one personalized microsite to many accounts at once.</p>
        <div className="space-y-3">
          <Feature title="Email Campaigns Tabs">
            Inside Email Campaigns you'll find <strong>Campaigns</strong> (in-flight and planned sends), <strong>Sent</strong> (every email that's gone out with open/click data), <strong>Email Templates</strong> (your saved templates), and <strong>Performance</strong> (aggregate results across campaigns).
          </Feature>
          <Feature title="Email Templates">
            Save reusable email templates with merge variables for first name, company, and microsite URL. Templates are the building blocks of every email campaign.
          </Feature>
          <Feature title="Personalized Pages">
            Pick one microsite, define the audience, and the system creates a personalized version for every account in the list — company names, logos, and links all auto-filled. Each account gets its own tracked URL.
          </Feature>
          <Feature title="Per-Campaign Detail">
            Click any campaign to see per-recipient engagement — who opened, who clicked, who visited the microsite, and how many times. Green badges mean it landed and was opened.
          </Feature>
          <Feature title="Create from Account Views">
            Build a campaign audience directly from a saved Accounts view — e.g. all Hot accounts in the Northeast owned by you. No re-filtering, no copy-paste.
          </Feature>
        </div>
        <Tip>Use Personalized Pages for re-engagement: pick a single high-converting page, point it at a segment of cooling accounts, and you have personalized outreach to dozens of companies in minutes.</Tip>
      </div>
    ),
  },
  {
    id: "roi",
    icon: Calculator,
    title: "ROI Calculator",
    subtitle: "Financial impact modeling",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">The ROI Calculator models the financial value your product delivers to an account based on their actual operating data — volume per month, error rates, and workflow costs.</p>
        <div className="space-y-3">
          <Feature title="Scenario Types">
            Two models are available: <strong>Denture Workflow Impact</strong> (time savings and lab cost reduction) and <strong>Fixed Restoration Remake Impact</strong> (cost of remakes eliminated).
          </Feature>
          <Feature title="Account-Specific Inputs">
            Enter the prospect's actual numbers — cases per month, number of locations, current remake rate — and the calculator adjusts the output accordingly.
          </Feature>
          <Feature title="PDF Export">
            Generate a branded PDF of the calculation to attach to proposals or leave behind after a meeting.
          </Feature>
        </div>
        <Tip>Run the calculator before your discovery call with ballpark numbers, then refine with the prospect's actuals on the call and export the PDF on the spot.</Tip>
      </div>
    ),
  },
  {
    id: "one-pager",
    icon: Presentation,
    title: "One-Pager",
    subtitle: "PDF collateral generator",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">One-Pager generates branded PDF documents you can send as attachments or leave-behinds — tailored to the type of stakeholder you're meeting.</p>
        <div className="space-y-3">
          <Feature title="Template Types">
            Choose from Pilot Proposal, Comparison Sheet, New Partner Welcome, Agreement Summary, or ROI Summary. Each has a structure suited to a different sales moment.
          </Feature>
          <Feature title="Audience Focus">
            Select Executive, End User, or Manager and the body copy adjusts to speak to that person's priorities.
          </Feature>
          <Feature title="Prospect Logo">
            Upload the prospect's logo and it gets placed on the PDF alongside yours, so the document feels bespoke.
          </Feature>
        </div>
        <Tip>Use the ROI Summary one-pager in final-stage deals — run the numbers in the ROI Calculator first, then generate the PDF to attach to your proposal email.</Tip>
      </div>
    ),
  },
  {
    id: "integrations",
    icon: Plug,
    title: "Integrations",
    subtitle: "Salesforce, Marketo, HubSpot, and Slack",
    keywords: "marketo salesforce hubspot slack crm sync lists static list audience alerts channel connection",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">All connections live in one place: <strong>Settings → Integrations</strong> (the gear items are in your account menu, top right). Each card opens a detail page for that service.</p>
        <div className="space-y-3">
          <Feature title="Salesforce">
            Two-way account, contact, and lead sync, plus Lead write-back so landing-page form submissions land in Salesforce. Import filters and field mappings are on its detail page.
          </Feature>
          <Feature title="Marketo — Lists &amp; Programs">
            Your Marketo static lists and programs are cached and listed on the Marketo page, searchable by name or Marketo ID. Hit <strong>Refresh lists &amp; programs</strong> to re-pull the catalogue. Marketo's API doesn't return member counts, so none are shown.
          </Feature>
          <Feature title="Marketo — Import a list">
            <strong>Import</strong> on any static list pulls that list's members into Contacts. People you already have are matched (by Salesforce ID, then by email) and enriched rather than duplicated; everyone else is created. Programs have no Import button — Marketo's member API only covers static lists.
          </Feature>
          <Feature title="Marketo — List to campaign audience">
            After an import, <strong>Save as campaign audience</strong> turns those contacts into a named audience. It then appears in the campaign wizard under "Start from a saved audience", so a Marketo list becomes a campaign you send from here.
          </Feature>
          <Feature title="Marketo — Push links back">
            The other direction: in the campaign wizard choose "Generate links only", then <strong>Push to Marketo static list</strong>. Each contact's personalized link is written to a Marketo field you name and they're added to the list — so LP Studio makes the links and Marketo does the sending. You'll need the list's Marketo ID, which is what the copy button on each list row is for.
          </Feature>
          <Feature title="HubSpot">
            Contact sync via a Private App token. Form leads push across as contacts.
          </Feature>
          <Feature title="Slack">
            Connect your workspace and pick a destination channel, then choose which of three alerts post: <strong>new lead / form submission</strong>, <strong>hot visit</strong> (a known contact opens a microsite), and <strong>AI Briefing generated</strong>. Each has a Test button. For private channels, invite the bot first or it can't post.
          </Feature>
        </div>
        <Tip>The fastest Marketo workflow is list → Import → Save as audience → campaign. You don't need the full inbound lead sync switched on for any of it — importing a list is a one-off pull of the list you chose.</Tip>
      </div>
    ),
  },
  {
    id: "events",
    icon: CalendarDays,
    title: "Events",
    subtitle: "Event pages and agendas",
    keywords: "agenda sessions speakers schedule conference webinar rsvp",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Events builds pages for conferences, dinners, and webinars — with a structured agenda rather than free text, so sessions, times, and speakers stay editable after the page is generated.</p>
        <div className="space-y-3">
          <Feature title="Agenda Builder">
            Add sessions with times, titles, descriptions, and speakers. The agenda renders as a proper schedule block on the page and stays editable in the builder.
          </Feature>
          <Feature title="Same Page Tooling">
            Event pages are normal pages underneath — personalized hotlinks, visit alerts, email preview cards, and the analytics drill-down all work exactly as they do elsewhere.
          </Feature>
        </div>
      </div>
    ),
  },
  {
    id: "template-library",
    icon: Store,
    title: "Template Library",
    subtitle: "Ready-to-use page templates",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">The Template Library is a gallery of approved, conversion-tested page layouts. Browse, preview live, and clone into your workspace to customize for an account.</p>
        <div className="space-y-3">
          <Feature title="Browse Templates">
            Templates are organized by use case. Filter to find the layout that fits the moment — first touch, follow-up, late-stage proof, etc.
          </Feature>
          <Feature title="Preview Live">
            Click any template to see a live preview before cloning. What you see is exactly what the prospect will see.
          </Feature>
          <Feature title="Clone & Customize">
            Cloning creates a private copy in your Microsites list. Edit the copy freely — it doesn't affect the original template.
          </Feature>
        </div>
        <Tip>Never start a new page from a blank canvas. Always clone from the Template Library or generate one with AI in Microsites — both save hours and start from layouts that actually convert.</Tip>
      </div>
    ),
  },
];

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <ChevronRight className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold text-slate-800">{title}: </span>
        <span className="text-slate-600">{children}</span>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mt-2">
      <span className="text-emerald-700 font-semibold text-sm shrink-0">Pro tip:</span>
      <p className="text-emerald-800 text-sm">{children}</p>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all", open ? "shadow-sm" : "")}>
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{section.title}</p>
          <p className="text-sm text-slate-500">{section.subtitle}</p>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t bg-white">
          <div className="pt-4">{section.content}</div>
        </div>
      )}
    </div>
  );
}

export default function SalesGuide() {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = SECTIONS.filter(
    s =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      (s.keywords ?? "").includes(q)
  );

  return (
    <SalesLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sales Console Guide</h1>
              <p className="text-sm text-muted-foreground mt-1">How to use every feature in the Sales Console to find, engage, and close accounts faster.</p>
            </div>
          </div>

          {/* Workflow overview */}
          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recommended workflow</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                "Pick an Account",
                "Check Activity",
                "Build a Page",
                "Generate Hotlinks",
                "Draft an Email",
                "Launch a Campaign",
                "Send a One-Pager",
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-slate-200">{step}</span>
                  {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                </span>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search features..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No sections match "{search}"</p>
            ) : (
              filtered.map(s => <SectionCard key={s.id} section={s} />)
            )}
          </div>
        </div>
      </div>
    </SalesLayout>
  );
}
