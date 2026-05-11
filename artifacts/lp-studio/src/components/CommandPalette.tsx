import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  LayoutGrid,
  Store,
  FlaskConical,
  CheckCircle2,
  BarChart2,
  FormInput,
  Paintbrush,
  Blocks,
  Settings,
  Users,
  Shield,
  Plus,
  Sparkles,
  Target,
  Gauge,
  Link2,
  Wand2,
  BookOpen,
  Globe,
  Mail,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/context/AuthContext";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Item = {
  label: string;
  icon: React.ReactNode;
  href: string;
  shortcut?: string;
  keywords?: string;
  perm?: string;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const { hasPerm, user } = useAuth();

  const go = (href: string) => {
    onOpenChange(false);
    // Defer navigation a tick so the dialog can unmount cleanly first.
    setTimeout(() => navigate(href), 0);
  };

  const can = (perm?: string) => !perm || hasPerm(perm) || user?.isAdmin;

  const quick: Item[] = [
    { label: "New page", icon: <Plus className="w-4 h-4" />, href: "/pages?new=1", perm: "pages", keywords: "create blank brief ai template" },
    { label: "New test", icon: <Plus className="w-4 h-4" />, href: "/tests/new", perm: "tests", keywords: "create ab test variant" },
  ];

  const platform: Item[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, href: "/", keywords: "home overview" },
    { label: "Pages", icon: <LayoutGrid className="w-4 h-4" />, href: "/pages", perm: "pages" },
    { label: "Templates", icon: <Store className="w-4 h-4" />, href: "/templates", perm: "pages", keywords: "library marketplace" },
    { label: "Tests", icon: <FlaskConical className="w-4 h-4" />, href: "/tests", perm: "tests", keywords: "ab tests variants" },
    { label: "Approvals", icon: <CheckCircle2 className="w-4 h-4" />, href: "/reviews", keywords: "review pending" },
    { label: "Analytics", icon: <BarChart2 className="w-4 h-4" />, href: "/analytics", perm: "analytics" },
    { label: "Forms & Leads", icon: <FormInput className="w-4 h-4" />, href: "/forms-and-leads", perm: "forms_leads" },
    { label: "Live pages", icon: <Globe className="w-4 h-4" />, href: "/live-pages", keywords: "published" },
    { label: "Content library", icon: <BookOpen className="w-4 h-4" />, href: "/library", keywords: "assets media" },
  ];

  const labs: Item[] = [
    { label: "Conversion scoring", icon: <Target className="w-4 h-4" />, href: "/conversion-scoring" },
    { label: "Page speed", icon: <Gauge className="w-4 h-4" />, href: "/page-speed" },
    { label: "AdMap", icon: <Link2 className="w-4 h-4" />, href: "/ad-map" },
    { label: "Programmatic pages", icon: <Wand2 className="w-4 h-4" />, href: "/programmatic" },
    { label: "Smart sections", icon: <Sparkles className="w-4 h-4" />, href: "/smart-sections" },
  ];

  const settings: Item[] = [
    { label: "Brand & content", icon: <Paintbrush className="w-4 h-4" />, href: "/brand", perm: "brand", keywords: "colors fonts logo" },
    { label: "Blocks", icon: <Blocks className="w-4 h-4" />, href: "/blocks", perm: "blocks" },
    { label: "General settings", icon: <Settings className="w-4 h-4" />, href: "/settings/general", perm: "settings" },
    { label: "Team", icon: <Users className="w-4 h-4" />, href: "/settings/team", perm: "team" },
    { label: "Roles", icon: <Shield className="w-4 h-4" />, href: "/settings/roles", perm: "roles" },
    { label: "Integrations", icon: <Mail className="w-4 h-4" />, href: "/integrations" },
  ];

  const sales: Item[] = [
    { label: "Sales dashboard", icon: <LayoutDashboard className="w-4 h-4" />, href: "/sales", perm: "sales_dashboard" },
    { label: "Sales accounts", icon: <Users className="w-4 h-4" />, href: "/sales/accounts", perm: "sales_accounts" },
    { label: "Sales contacts", icon: <Users className="w-4 h-4" />, href: "/sales/contacts", perm: "sales_contacts" },
    { label: "Draft email", icon: <Mail className="w-4 h-4" />, href: "/sales/draft-email", perm: "sales_outreach" },
    { label: "Microsites", icon: <Globe className="w-4 h-4" />, href: "/sales/microsites", perm: "sales_accounts" },
    { label: "Campaigns", icon: <Plus className="w-4 h-4" />, href: "/sales/campaigns", perm: "sales_campaigns" },
  ];

  const renderGroup = (heading: string, items: Item[]) => {
    const visible = items.filter((it) => can(it.perm));
    if (visible.length === 0) return null;
    return (
      <CommandGroup heading={heading}>
        {visible.map((it) => (
          <CommandItem
            key={it.href + it.label}
            value={`${it.label} ${it.keywords ?? ""}`}
            onSelect={() => go(it.href)}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.shortcut && <CommandShortcut>{it.shortcut}</CommandShortcut>}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, settings, or actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {renderGroup("Quick actions", quick)}
        <CommandSeparator />
        {renderGroup("Navigate", platform)}
        {renderGroup("Labs", labs)}
        {renderGroup("Settings", settings)}
        {renderGroup("Sales", sales)}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isCmdK) return;
      // Skip when the user is typing in an input / textarea / rich-text
      // editor — Cmd+K is a common shortcut inside those (e.g. insert link).
      const t = e.target as HTMLElement | null;
      const isEditable =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t?.isContentEditable ?? false);
      if (isEditable) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}
