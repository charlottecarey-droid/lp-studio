import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  Users,
  Mail,
  Activity,
  FileText,
  ArrowUpRight,
  Plus,
  ChevronRight,
  Eye,
  MousePointerClick,
  Send,
  TrendingUp,
  PenTool,
  Globe,
  Zap,
  Contact,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface DashboardStats {
  accounts: number;
  contacts: number;
  activeCampaigns: number;
  microsites: number;
  recentSignals: number;
  emailsSent: number;
  opens: number;
  clicks: number;
}

interface RecentSignal {
  id: number;
  type: string;
  source: string;
  accountName?: string;
  contactName?: string;
  createdAt: string;
}

interface SavedView {
  id: string;
  name: string;
}

interface ToolCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  href: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getSignalIcon(type: string) {
  switch (type) {
    case "page_view": return <Eye className="w-3.5 h-3.5 text-blue-500" />;
    case "email_open": return <Mail className="w-3.5 h-3.5 text-emerald-500" />;
    case "email_click": return <MousePointerClick className="w-3.5 h-3.5 text-amber-500" />;
    case "form_submit": return <FileText className="w-3.5 h-3.5 text-violet-500" />;
    case "email_sent": return <Send className="w-3.5 h-3.5 text-primary" />;
    case "email_replied": return <Mail className="w-3.5 h-3.5 text-violet-500" />;
    default: return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function getSignalLabel(type: string) {
  switch (type) {
    case "page_view": return "Viewed page";
    case "email_open": return "Opened email";
    case "email_click": return "Clicked link";
    case "form_submit": return "Submitted form";
    case "email_sent": return "Email sent";
    case "email_replied": return "Replied to email";
    default: return type.replace(/_/g, " ");
  }
}

export default function SalesDashboard() {
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    // Get user ID and load saved views
    const storedUserId = localStorage.getItem("userId") || "default";
    setUserId(storedUserId);

    const viewsKey = `sc_acct_views_${storedUserId}`;
    const viewsData = localStorage.getItem(viewsKey);
    if (viewsData) {
      try {
        const views = JSON.parse(viewsData);
        setSavedViews(views);
      } catch (e) {
        setSavedViews([]);
      }
    }

    // Fetch dashboard stats from sales API
    Promise.all([
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/contacts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/signals?limit=10`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/campaigns`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/signals?limit=100`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/lp/pages`).then(r => r.ok ? r.json() : []),
    ])
      .then(([accounts, contacts, recentSignals, campaigns, allSignals, pages]) => {
        const activeCampaigns = campaigns.filter((c: any) => c.status === "sending" || c.status === "sent").length;
        const emailsSent = campaigns.reduce((sum: number, c: any) => sum + (c.recipientCount ?? 0), 0);
        const opens = allSignals.filter((s: any) => s.type === "email_open").length;
        const clicks = allSignals.filter((s: any) => s.type === "email_click").length;
        const publishedMicrosites = pages.filter((p: any) => p.status === "published").length;

        setStats({
          accounts: accounts.length ?? 0,
          contacts: contacts.length ?? 0,
          activeCampaigns,
          microsites: publishedMicrosites,
          recentSignals: recentSignals.length ?? 0,
          emailsSent,
          opens,
          clicks,
        });
        setSignals(recentSignals ?? []);
      })
      .catch(() => {
        setStats({ accounts: 0, contacts: 0, activeCampaigns: 0, microsites: 0, recentSignals: 0, emailsSent: 0, opens: 0, clicks: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  const today = format(new Date(), "EEEE, MMMM d");

  const statTiles = [
    {
      label: "Accounts",
      value: stats?.accounts ?? null,
      icon: <Building2 className="w-3.5 h-3.5" />,
      bigIcon: <Building2 className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/sales/accounts",
    },
    {
      label: "Contacts",
      value: stats?.contacts ?? null,
      icon: <Users className="w-3.5 h-3.5" />,
      bigIcon: <Users className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/sales/contacts",
    },
    {
      label: "Emails Sent",
      value: stats?.emailsSent ?? null,
      icon: <Send className="w-3.5 h-3.5" />,
      bigIcon: <Send className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/sales/campaigns",
    },
    {
      label: "Opens",
      value: stats?.opens ?? null,
      icon: <Eye className="w-3.5 h-3.5" />,
      bigIcon: <Eye className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-emerald-600",
      accent: false,
      href: "/sales/signals",
    },
    {
      label: "Clicks",
      value: stats?.clicks ?? null,
      icon: <MousePointerClick className="w-3.5 h-3.5" />,
      bigIcon: <MousePointerClick className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-amber-600",
      accent: false,
      href: "/sales/signals",
    },
    {
      label: "Active Campaigns",
      value: stats?.activeCampaigns ?? null,
      icon: <Send className="w-3.5 h-3.5" />,
      bigIcon: <Send className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/sales/campaigns",
    },
    {
      label: "Microsites",
      value: stats?.microsites ?? null,
      icon: <FileText className="w-3.5 h-3.5" />,
      bigIcon: <FileText className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/sales/pages",
    },
    {
      label: "Signals Today",
      value: stats?.recentSignals ?? null,
      icon: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
      bigIcon: <Activity className="w-5 h-5 text-emerald-500/40" />,
      color: "text-emerald-600",
      accent: true,
      href: "/sales/signals",
    },
  ];

  const isEmpty = !loading && (stats?.accounts ?? 0) === 0;

  return (
    <SalesLayout>
      <div className="flex flex-col gap-8 pb-12">

        {/* Hero Banner */}
        <div
          className="relative rounded-2xl overflow-hidden px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
          style={{
            background: "linear-gradient(135deg, #003A30 0%, #005244 50%, #003A30 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #C7E738 0%, transparent 50%), radial-gradient(circle at 80% 20%, #C7E738 0%, transparent 40%)",
            }}
          />
          <div className="relative">
            <p className="text-sm font-medium text-white/50 mb-1">{today}</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
              {getGreeting()}
            </h1>
            <p className="text-white/60 mt-1.5 text-base">
              Everything you need to win DSO accounts.
            </p>
          </div>
          <Link href="/sales/accounts" className="relative shrink-0">
            <Button
              size="lg"
              className="rounded-xl font-semibold px-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#C7E738", color: "#003A30" }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Account
            </Button>
          </Link>
        </div>

        {/* Tool Cards - YOUR TOOLS section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-display font-bold text-foreground">Your Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                id: "accounts",
                icon: <Building2 className="w-5 h-5" />,
                title: "Accounts",
                description: "Your target DSOs. Search, filter by ABM stage, view engagement history and AI briefings.",
                cta: "View Accounts →",
                href: "/sales/accounts",
              },
              {
                id: "draft-email",
                icon: <PenTool className="w-5 h-5" />,
                title: "Draft Email",
                description: "AI-powered outreach. Pick a contact and generate a research-driven personalized email in seconds.",
                cta: "Draft Email →",
                href: "/sales/draft-email",
              },
              {
                id: "microsites",
                icon: <Globe className="w-5 h-5" />,
                title: "Microsites",
                description: "Personalized landing pages. Create branded microsites for prospects, customize sections, and generate trackable hotlinks.",
                cta: "View Microsites →",
                href: "/sales/pages",
              },
              {
                id: "campaigns",
                icon: <Send className="w-5 h-5" />,
                title: "Campaigns",
                description: "Bulk email outreach. Build audiences, compose templated emails with merge variables, and track performance.",
                cta: "View Campaigns →",
                href: "/sales/campaigns",
              },
              {
                id: "activity",
                icon: <Zap className="w-5 h-5" />,
                title: "Activity",
                description: "Engagement intelligence. See who visited your microsites, opened emails, clicked CTAs, and submitted forms.",
                cta: "View Activity →",
                href: "/sales/signals",
              },
              {
                id: "contacts",
                icon: <Contact className="w-5 h-5" />,
                title: "Contacts",
                description: "Your prospect database. Browse contacts, see engagement scores, and draft personalized emails in one click.",
                cta: "View Contacts →",
                href: "/sales/contacts",
              },
            ].map((tool) => (
              <Link href={tool.href} key={tool.id}>
                <Card className="group relative h-full flex flex-col gap-3 p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#C7E738]/15 flex items-center justify-center text-[#2D6A4F] group-hover:bg-[#C7E738]/25 transition-colors">
                      {tool.icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-foreground mb-1.5">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    {tool.cta}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Saved Views Quick-Switch */}
        {savedViews.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Saved Views</p>
            <div className="flex flex-wrap gap-2">
              {savedViews.map((view) => (
                <Link
                  href={`/sales/accounts?view=${encodeURIComponent(view.id)}`}
                  key={view.id}
                >
                  <button className="px-3 py-1.5 rounded-full bg-muted/50 border border-border/60 text-sm font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all">
                    {view.name}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statTiles.map((stat) => (
            <Link href={stat.href} key={stat.label}>
              <Card
                className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                  stat.accent
                    ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-500/50"
                    : "border-border/60 bg-card hover:border-primary/30"
                }`}
              >
                <div className="absolute top-3 right-3 opacity-60">{stat.bigIcon}</div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {stat.icon}
                  {stat.label}
                </div>
                {loading ? (
                  <Skeleton className="h-10 w-14 rounded-lg" />
                ) : (
                  <div className="flex items-end justify-between">
                    <p className={`text-4xl font-display font-bold leading-none ${stat.color}`}>
                      {stat.value}
                    </p>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors mb-1" />
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {isEmpty ? (
          /* Onboarding */
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-display font-bold text-foreground">
              Get started with Sales Console
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "01",
                  title: "Add an account",
                  desc: "Create your first target account — a DSO, practice, or company you want to engage.",
                  cta: "Add Account",
                  href: "/sales/accounts",
                  icon: <Building2 className="w-5 h-5" />,
                  primary: true,
                },
                {
                  step: "02",
                  title: "Build a microsite",
                  desc: "Use the page builder to create a personalized microsite for the account with their branding and case studies.",
                  cta: "Create Microsite",
                  href: "/sales/pages",
                  icon: <FileText className="w-5 h-5" />,
                },
                {
                  step: "03",
                  title: "Send outreach",
                  desc: "Generate a personalized email, attach the microsite link, and send it — all with tracked engagement.",
                  cta: "Start Outreach",
                  href: "/sales/draft-email",
                  icon: <Mail className="w-5 h-5" />,
                },
              ].map((item) => (
                <Link href={item.href} key={item.step}>
                  <Card
                    className={`group relative h-full flex flex-col gap-4 p-6 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                      item.primary
                        ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                        : "border-border/60 bg-card hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          item.primary
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-muted-foreground/50 font-mono">
                        {item.step}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground mb-1.5">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
                      {item.cta} <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Recent Signals */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Recent Signals</h2>
                <Link href="/sales/signals">
                  <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    View all signals →
                  </span>
                </Link>
              </div>

              {signals.length === 0 ? (
                <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">No signals yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Signals will appear as contacts engage with your pages and emails
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {signals.map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-center gap-4 px-5 py-3 bg-card border border-border/60 rounded-xl hover:border-primary/25 hover:shadow-sm transition-all"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                        {getSignalIcon(signal.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {signal.contactName ?? signal.accountName ?? "Unknown contact"}{" "}
                          <span className="text-muted-foreground font-normal">
                            {getSignalLabel(signal.type).toLowerCase()}
                          </span>
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {signal.accountName && <span className="font-medium truncate">{signal.accountName}</span>}
                          {signal.accountName && signal.source && <span>·</span>}
                          {signal.source && <span className="truncate">{signal.source}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-start gap-4 p-5 bg-card border-l-4 border-l-primary border border-border/60 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">What's next?</p>
                <p className="text-sm text-muted-foreground">
                  Build a personalized microsite for your top account and start tracking engagement.
                </p>
              </div>
              <Link href="/sales/pages" className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs font-semibold hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  Create Microsite
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </SalesLayout>
  );
}
