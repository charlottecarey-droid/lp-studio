import { useLocation, Redirect } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/context/AuthContext";
import { Settings as SettingsIcon, Globe, Search, Mail, LayoutTemplate } from "lucide-react";
import { GeneralContent } from "./GeneralPage";
import { DomainContent } from "./DomainPage";
import { SeoContent } from "./SeoPage";
import { NotificationsContent } from "./NotificationsPage";
import { EmailTemplatesContent } from "./EmailPage";
import { AlertRecipientsContent } from "./AlertRecipients";
import { TemplateSettingsContent } from "./TemplateSettingsPage";

type TabId = "general" | "domain" | "seo" | "templates" | "email";
type EmailSubTab = "templates" | "recipients" | "preferences";

const TABS: { id: TabId; label: string; icon: typeof SettingsIcon; path: string; adminOnly: boolean }[] = [
  { id: "general", label: "General", icon: SettingsIcon, path: "/settings/general", adminOnly: true },
  { id: "domain", label: "Domain", icon: Globe, path: "/settings/domain", adminOnly: true },
  { id: "seo", label: "SEO", icon: Search, path: "/settings/seo", adminOnly: true },
  { id: "templates", label: "Templates", icon: LayoutTemplate, path: "/settings/templates", adminOnly: true },
  { id: "email", label: "Email", icon: Mail, path: "/settings/email", adminOnly: false },
];

// Map a settings URL to the active tab + (for Email) sub-tab. Old, separate
// settings URLs (/settings/notifications, /settings/email) deep-link straight
// into the consolidated hub at the right place.
function resolveRoute(location: string): { tab: TabId; emailSub: EmailSubTab } {
  if (location.startsWith("/settings/domain")) return { tab: "domain", emailSub: "templates" };
  if (location.startsWith("/settings/seo")) return { tab: "seo", emailSub: "templates" };
  if (location.startsWith("/settings/templates")) return { tab: "templates", emailSub: "templates" };
  if (location.startsWith("/settings/notifications")) return { tab: "email", emailSub: "preferences" };
  if (location.startsWith("/settings/email/recipients")) return { tab: "email", emailSub: "recipients" };
  if (location.startsWith("/settings/email")) return { tab: "email", emailSub: "templates" };
  // /settings and /settings/general both land on General.
  return { tab: "general", emailSub: "templates" };
}

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const canManage = (user?.isAdmin ?? false) || !!user?.permissions?.["settings"];

  const { tab, emailSub } = resolveRoute(location);

  // Non-admins can only see the Email tab (for personal Preferences). If they
  // deep-link into an admin-only tab, bounce them to their preferences. The
  // server re-checks every admin endpoint regardless.
  if (!canManage && tab !== "email") {
    return <Redirect to="/settings/notifications" />;
  }
  // A non-admin on the Email tab is forced onto the Preferences sub-tab.
  const effectiveEmailSub: EmailSubTab = canManage ? emailSub : "preferences";

  const visibleTabs = TABS.filter((t) => canManage || !t.adminOnly);

  function go(path: string) {
    setLocation(path);
  }

  const emailSubTabs: { id: EmailSubTab; label: string; path: string; adminOnly: boolean }[] = [
    { id: "templates", label: "Templates", path: "/settings/email", adminOnly: true },
    { id: "recipients", label: "Alert recipients", path: "/settings/email/recipients", adminOnly: true },
    { id: "preferences", label: "Preferences", path: "/settings/notifications", adminOnly: false },
  ];
  const visibleEmailSubTabs = emailSubTabs.filter((t) => canManage || !t.adminOnly);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your workspace configuration and personal preferences.
          </p>
        </div>

        {/* Top-level tabs */}
        <div className="border-b border-border mb-6">
          <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
            {visibleTabs.map((t) => {
              const active = t.id === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => go(t.path)}
                  data-testid={`settings-tab-${t.id}`}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        {tab === "general" && <GeneralContent />}
        {tab === "domain" && <DomainContent />}
        {tab === "seo" && <SeoContent />}
        {tab === "templates" && canManage && <TemplateSettingsContent />}
        {tab === "email" && (
          <div className="space-y-6">
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit" role="tablist">
              {visibleEmailSubTabs.map((s) => {
                const active = s.id === effectiveEmailSub;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => go(s.path)}
                    data-testid={`settings-email-subtab-${s.id}`}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {effectiveEmailSub === "templates" && canManage && <EmailTemplatesContent />}
            {effectiveEmailSub === "recipients" && canManage && <AlertRecipientsContent />}
            {effectiveEmailSub === "preferences" && <NotificationsContent />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
