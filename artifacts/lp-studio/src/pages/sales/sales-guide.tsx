import { SalesLayout } from "@/components/layout/sales-layout";
import { useState } from "react";
import {
  LayoutDashboard, Activity, Building2, Users, FileText,
  Mail, Presentation, Megaphone, Store, Calculator,
  ChevronRight, ChevronDown, BookOpen, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    subtitle: "Your sales command center",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">The Dashboard is the first thing you see when you log in. It gives you a live snapshot of which accounts are engaging and which need attention.</p>
        <div className="space-y-3">
          <Feature title="Hot Accounts">
            Accounts with recent, high-frequency activity — page visits, email opens, form submissions. Prioritize these for follow-up today.
          </Feature>
          <Feature title="Needs Attention">
            Accounts that have been quiet for 14+ days, or that don't yet have a personalized microsite. Act on these before they go cold.
          </Feature>
          <Feature title="Recent Signals">
            A live feed of the last 10 activity events across all accounts — useful for knowing what happened since you last logged in.
          </Feature>
          <Feature title="Engagement Score">
            Each account gets a heat score (Hot / Warm / Cool / Cold) calculated from weighted signals: form submits score highest, followed by page visits, then email opens and clicks.
          </Feature>
        </div>
        <Tip>Check the dashboard at the start of your day. Hot accounts should be your first calls — they've shown intent within the last 48 hours.</Tip>
      </div>
    ),
  },
  {
    id: "signals",
    icon: Activity,
    title: "Signals",
    subtitle: "Real-time engagement feed",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Signals is a live stream of every engagement event across your accounts — page visits, email opens, link clicks, form submissions, and more.</p>
        <div className="space-y-3">
          <Feature title="Live Updates">
            The feed refreshes automatically via a live connection. You don't need to refresh the page to see new activity.
          </Feature>
          <Feature title="Filter by Type">
            Narrow the feed to a specific signal type (e.g. only form submissions or only page visits) using the filter dropdown.
          </Feature>
          <Feature title="Group by Account">
            Toggle "Group by Account" to collapse signals by company — useful when you want to see total activity per account rather than a chronological stream.
          </Feature>
          <Feature title="Signal History">
            Scroll back through up to 500 recent events. Use the search bar to find a specific company or contact quickly.
          </Feature>
        </div>
        <Tip>Set aside 5 minutes before any call to check Signals for that account. Knowing that a contact visited the pricing section 20 minutes ago is powerful context.</Tip>
      </div>
    ),
  },
  {
    id: "accounts",
    icon: Building2,
    title: "Accounts",
    subtitle: "ABM account management",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">The Accounts page is your ABM hub — a full list of target companies with engagement data, contacts, microsites, and deal stage tracking.</p>
        <div className="space-y-3">
          <Feature title="Engagement Funnel">
            The top of the page shows a funnel breaking down how many accounts are at each heat tier. Use this to understand the health of your pipeline at a glance.
          </Feature>
          <Feature title="Account Profiles">
            Click any account to open its profile: full activity timeline, list of contacts, active microsites, and ABM stage. Everything in one place.
          </Feature>
          <Feature title="Filtering & Saved Views">
            Filter accounts by ABM Tier, ABM Stage, Practice Segment, or Owner. Save your filter combinations as named views so you don't have to re-apply them each time.
          </Feature>
          <Feature title="ABM Stage Tracking">
            Move accounts through stages (Target → Engaged → In Conversation → Closed Won/Lost) directly from the account list or profile.
          </Feature>
        </div>
        <Tip>Create a saved view for your personal book of business filtered by your name as Owner. That's your daily working list.</Tip>
      </div>
    ),
  },
  {
    id: "contacts",
    icon: Users,
    title: "Contacts",
    subtitle: "Contact database & audiences",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Contacts is your full stakeholder database — individual people at each account, their engagement scores, and the audiences you've built for outreach.</p>
        <div className="space-y-3">
          <Feature title="CSV Import">
            Upload a CSV to add contacts in bulk. The importer auto-maps common column names and supports Salesforce IDs for deduplication. Required columns: first name, last name, email, company name.
          </Feature>
          <Feature title="Individual Engagement Scores">
            Each contact has their own heat score based on their personal interactions — not the account's aggregate. Useful for knowing who at a company is most interested.
          </Feature>
          <Feature title="Audiences">
            Group contacts into named audiences for targeted campaigns. Audiences are the unit of bulk outreach — when you launch a campaign, you send to an audience.
          </Feature>
        </div>
        <Tip>Keep contacts organized by account name. When your CSV comes from Salesforce, include the SFDC Account ID column — it links contacts to accounts automatically.</Tip>
      </div>
    ),
  },
  {
    id: "pages",
    icon: FileText,
    title: "Pages",
    subtitle: "Personalized microsites per account",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Pages is where you manage personalized landing pages (microsites) for each account. Every account should have at least one — it's the destination you send prospects to.</p>
        <div className="space-y-3">
          <Feature title="Clone a Template">
            Start from a template in the Marketplace, clone it for a specific account, and customize the content. Don't build from scratch — always clone.
          </Feature>
          <Feature title="Hotlinks">
            Generate a unique tracking link for each contact at an account. When they click it, you see exactly who visited. Hotlinks are what you put in emails.
          </Feature>
          <Feature title="Visit Alerts">
            Set up an email notification to be sent to you (or anyone on the team) when a specific contact visits their page. Get alerted in real time when intent spikes.
          </Feature>
          <Feature title="Draft vs Published">
            Pages start as Drafts — invisible to the public. Publish when you're ready to send the link. You can unpublish at any time.
          </Feature>
        </div>
        <Tip>Create the microsite before you send any outreach. The hotlink is what makes your emails trackable and personalizable — without it, you're flying blind.</Tip>
      </div>
    ),
  },
  {
    id: "outreach",
    icon: Mail,
    title: "Outreach",
    subtitle: "AI-assisted email writing",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Outreach helps you write personalized emails faster using AI, with built-in merge variables for the recipient's name, company, and microsite link.</p>
        <div className="space-y-3">
          <Feature title="AI Generation">
            Describe your goal (e.g. "first touch email for a DSO CFO") and the AI writes a draft. You can regenerate or edit inline.
          </Feature>
          <Feature title="Merge Variables">
            Use <code className="bg-slate-100 px-1 rounded text-sm font-mono">{"{{first_name}}"}</code>, <code className="bg-slate-100 px-1 rounded text-sm font-mono">{"{{company}}"}</code>, and <code className="bg-slate-100 px-1 rounded text-sm font-mono">{"{{microsite_url}}"}</code> in your templates. These get swapped with real values when you send.
          </Feature>
          <Feature title="Plain Text vs Styled">
            Plain text emails tend to have higher deliverability and feel more personal. Styled (HTML) emails are better for branded announcements. Use plain text for 1:1 outreach.
          </Feature>
        </div>
        <Tip>Always include the <code className="bg-slate-100 px-1 rounded text-sm font-mono">{"{{microsite_url}}"}</code> variable — it's the hotlink that lets you track who opened what.</Tip>
      </div>
    ),
  },
  {
    id: "onepager",
    icon: Presentation,
    title: "One-Pagers",
    subtitle: "PDF collateral generator",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">One-Pagers generates branded PDF documents you can send as attachments or leave-behinds — tailored to the type of stakeholder you're meeting.</p>
        <div className="space-y-3">
          <Feature title="Template Types">
            Choose from: Pilot Proposal, Comparison Sheet, New Partner Welcome, or ROI Summary. Each has a different structure suited to a different sales moment.
          </Feature>
          <Feature title="Audience Focus">
            Select the audience type — Executive, Clinical, or Practice Manager — and the body copy adjusts to speak to that person's priorities.
          </Feature>
          <Feature title="Prospect Logo">
            Upload the prospect's logo and it gets placed on the PDF alongside Dandy's. Makes the document feel bespoke.
          </Feature>
        </div>
        <Tip>Use the ROI Summary one-pager in final-stage deals. Run the numbers in the ROI Calculator first, then generate the PDF to attach to your proposal email.</Tip>
      </div>
    ),
  },
  {
    id: "campaigns",
    icon: Megaphone,
    title: "Campaigns",
    subtitle: "Bulk audience outreach",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">Campaigns lets you deploy microsites and personalized links to an entire audience at once — instead of creating hotlinks one contact at a time.</p>
        <div className="space-y-3">
          <Feature title="Launch to an Audience">
            Pick an audience from Contacts, select a template page, and launch. The system creates a unique hotlink for every contact in the audience automatically.
          </Feature>
          <Feature title="Create from Account Views">
            Build an audience directly from a saved Accounts filter view — e.g. all Hot accounts in the Northeast owned by you.
          </Feature>
          <Feature title="Campaign Tracking">
            The Campaigns view shows sent campaigns and their aggregate engagement: total visits, form fills, and top active contacts.
          </Feature>
        </div>
        <Tip>Campaigns are best for re-engagement sequences — when you want to hit a whole segment with a new message and track who responds.</Tip>
      </div>
    ),
  },
  {
    id: "marketplace",
    icon: Store,
    title: "Marketplace",
    subtitle: "Page template library",
    content: (
      <div className="space-y-4">
        <p className="text-slate-700">The Marketplace is a gallery of approved, ready-to-use page templates. Browse, preview live, and clone into your workspace to customize for an account.</p>
        <div className="space-y-3">
          <Feature title="Browse Templates">
            Templates are organized by use case. Filter by block count or mode to find the right layout quickly.
          </Feature>
          <Feature title="Preview Live">
            Click any template to see a live preview before cloning. What you see is exactly what the prospect will see.
          </Feature>
          <Feature title="Clone & Customize">
            Cloning creates a private copy in your Pages list. Edit the copy freely — it doesn't affect the original template.
          </Feature>
        </div>
        <Tip>Never start a new page from a blank canvas. Always start from the Marketplace — templates are optimized for conversion and save you hours.</Tip>
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
        <p className="text-slate-700">The ROI Calculator models the financial value Dandy delivers to a DSO based on their specific practice data — cases per month, remake rates, and workflow costs.</p>
        <div className="space-y-3">
          <Feature title="Scenario Types">
            Two models available: <strong>Denture Workflow Impact</strong> (time savings and lab cost reduction) and <strong>Fixed Restoration Remake Impact</strong> (cost of remakes eliminated).
          </Feature>
          <Feature title="DSO-Specific Inputs">
            Enter the prospect's actual numbers — cases per month, number of locations, current remake rate — and the calculator adjusts the output accordingly.
          </Feature>
          <Feature title="PDF Export">
            Generate a branded PDF of the calculation to attach to proposals or leave behind after a meeting.
          </Feature>
        </div>
        <Tip>Run the calculator before your discovery call so you have a ballpark. Refine it with their actual numbers during the call, then export the PDF on the spot.</Tip>
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
  const filtered = SECTIONS.filter(
    s =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.subtitle.toLowerCase().includes(search.toLowerCase())
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
              <h1 className="text-3xl font-bold text-slate-900">Sales Console Guide</h1>
              <p className="text-slate-500 mt-1">How to use every feature in the Dandy Sales Console to find, engage, and close accounts faster.</p>
            </div>
          </div>

          {/* Workflow overview */}
          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recommended workflow</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                "Check Dashboard",
                "Review Signals",
                "Update Accounts",
                "Create Microsite",
                "Generate Hotlink",
                "Write Outreach",
                "Launch Campaign",
                "Send One-Pager",
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
