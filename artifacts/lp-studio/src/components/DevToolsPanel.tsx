import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wrench, X, ChevronDown, Users, Building2, Check, RefreshCw,
  Eye, AlertTriangle, ArrowRight, Loader2, RotateCcw
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ── Permission keys ──────────────────────────────────────────────────────────
const ALL_PERM_KEYS = [
  // Content
  { key: "pages",          group: "Content",  label: "Pages" },
  { key: "tests",          group: "Content",  label: "A/B Tests" },
  { key: "analytics",      group: "Content",  label: "Analytics" },
  { key: "forms_leads",    group: "Content",  label: "Forms & Leads" },
  { key: "brand",          group: "Content",  label: "Brand Kit" },
  { key: "blocks",         group: "Content",  label: "Custom Blocks" },
  // Sales
  { key: "sales_dashboard",  group: "Sales", label: "Sales Dashboard" },
  { key: "sales_contacts",   group: "Sales", label: "Contacts" },
  { key: "sales_accounts",   group: "Sales", label: "Accounts" },
  { key: "sales_outreach",   group: "Sales", label: "Outreach" },
  { key: "sales_signals",    group: "Sales", label: "Signals" },
  { key: "sales_campaigns",  group: "Sales", label: "Campaigns (admin)" },
  // Admin
  { key: "settings",  group: "Admin", label: "Settings" },
  { key: "team",      group: "Admin", label: "Team" },
  { key: "roles",     group: "Admin", label: "Roles" },
];

const ALL_PERMS = Object.fromEntries(ALL_PERM_KEYS.map(p => [p.key, true]));
const NO_PERMS  = Object.fromEntries(ALL_PERM_KEYS.map(p => [p.key, false]));

// ── Role presets ─────────────────────────────────────────────────────────────
interface RolePreset {
  name: string;
  color: string;
  perms: Record<string, boolean>;
}

const ROLE_PRESETS: RolePreset[] = [
  {
    name: "Full Admin",
    color: "bg-violet-100 text-violet-800 border-violet-200",
    perms: ALL_PERMS,
  },
  {
    name: "Sales Admin",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    perms: {
      ...NO_PERMS,
      analytics: true,
      sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: true, sales_signals: true, sales_campaigns: true,
    },
  },
  {
    name: "Sales Rep",
    color: "bg-sky-100 text-sky-800 border-sky-200",
    perms: {
      ...NO_PERMS,
      analytics: true,
      sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: true, sales_signals: true,
    },
  },
  {
    name: "Content Editor",
    color: "bg-green-100 text-green-800 border-green-200",
    perms: {
      ...NO_PERMS,
      pages: true, tests: true, analytics: true, forms_leads: true,
      brand: true, blocks: true,
    },
  },
  {
    name: "Viewer",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    perms: {
      ...NO_PERMS,
      analytics: true, pages: true,
      sales_dashboard: true, sales_contacts: true, sales_accounts: true, sales_signals: true,
    },
  },
  {
    name: "No Access",
    color: "bg-red-100 text-red-800 border-red-200",
    perms: NO_PERMS,
  },
];

// ── Tenant shape ─────────────────────────────────────────────────────────────
interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  microsite_domain: string | null;
  member_count: number;
  page_count: number;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export function DevToolsPanel() {
  const {
    user, hasPerm,
    impersonatedRole, permOverride, setRolePreview, clearRolePreview,
    switchTenant,
  } = useAuth();

  // Only render for superadmins
  if (!user?.isAdmin) return null;

  return <DevToolsInner
    user={user}
    hasPerm={hasPerm}
    impersonatedRole={impersonatedRole}
    permOverride={permOverride}
    setRolePreview={setRolePreview}
    clearRolePreview={clearRolePreview}
    switchTenant={switchTenant}
  />;
}

// Inner component so hooks can run unconditionally
function DevToolsInner({
  user, impersonatedRole, permOverride, setRolePreview, clearRolePreview, switchTenant,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  hasPerm: (k: string) => boolean;
  impersonatedRole: string | null;
  permOverride: Record<string, boolean> | null;
  setRolePreview: (name: string, perms: Record<string, boolean>) => void;
  clearRolePreview: () => void;
  switchTenant: (id: number | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"role" | "tenant">("role");

  // Custom perms
  const [customPerms, setCustomPerms] = useState<Record<string, boolean>>(ALL_PERMS);
  const [showCustom, setShowCustom] = useState(false);

  // Tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<number | null>(user.tenantId);
  const [ownTenantId] = useState<number | null>(user.tenantId);
  const [switchingTenantId, setSwitchingTenantId] = useState<number | null | false>(false);
  const [switchedTenantName, setSwitchedTenantName] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Load tenants when tab opens
  useEffect(() => {
    if (tab !== "tenant" || tenants.length > 0) return;
    setTenantsLoading(true);
    fetch("/api/admin/superadmin/my-tenants", { credentials: "include" })
      .then(r => r.json())
      .then(data => setTenants(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTenantsLoading(false));
  }, [tab]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePresetClick = (preset: RolePreset) => {
    setRolePreview(preset.name, preset.perms);
    setShowCustom(false);
  };

  const handleCustomApply = () => {
    setRolePreview("Custom", customPerms);
  };

  const handleClearRole = () => {
    clearRolePreview();
    setShowCustom(false);
  };

  const handleSwitchTenant = async (tenant: Tenant) => {
    setSwitchingTenantId(tenant.id);
    try {
      await switchTenant(tenant.id);
      setActiveTenantId(tenant.id);
      setSwitchedTenantName(tenant.id === ownTenantId ? null : tenant.name);
    } finally {
      setSwitchingTenantId(false);
    }
  };

  const handleRestoreOwnTenant = async () => {
    setSwitchingTenantId(ownTenantId);
    try {
      await switchTenant(ownTenantId);
      setActiveTenantId(ownTenantId);
      setSwitchedTenantName(null);
    } finally {
      setSwitchingTenantId(false);
    }
  };

  const isActive = permOverride !== null || (activeTenantId !== ownTenantId);
  const groups = ["Content", "Sales", "Admin"] as const;

  return (
    <>
      {/* ── Top banner when active ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 inset-x-0 z-[9999] bg-amber-400 text-amber-950 text-xs font-semibold flex items-center justify-center gap-3 px-4 py-1.5 shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Dev Mode Active —{" "}
              {permOverride !== null && `Viewing as: ${impersonatedRole}`}
              {permOverride !== null && activeTenantId !== ownTenantId && " · "}
              {activeTenantId !== ownTenantId && switchedTenantName && `Tenant: ${switchedTenantName}`}
            </span>
            <button
              onClick={() => { clearRolePreview(); if (activeTenantId !== ownTenantId) handleRestoreOwnTenant(); }}
              className="underline hover:no-underline ml-1"
            >
              Exit Dev Mode
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating trigger button ── */}
      <div ref={panelRef} className="fixed bottom-5 right-5 z-[9998]">
        <button
          onClick={() => setOpen(p => !p)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all
            ${open
              ? "bg-foreground text-background"
              : isActive
                ? "bg-amber-400 text-amber-950 animate-pulse"
                : "bg-foreground/90 text-background hover:bg-foreground"
            }
          `}
        >
          <Wrench className="w-3.5 h-3.5" />
          Dev Tools
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 ml-0.5" />}
        </button>

        {/* ── Slide-up panel ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-12 right-0 w-[380px] rounded-2xl bg-background border border-border shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Dev Tools</span>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-md px-1.5 py-0.5">superadmin only</span>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {[
                  { id: "role" as const, label: "View As Role", icon: <Eye className="w-3.5 h-3.5" /> },
                  { id: "tenant" as const, label: "Switch Tenant", icon: <Building2 className="w-3.5 h-3.5" /> },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                      tab === t.id
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* ─── Role tab ─────────────────────────────────────── */}
              {tab === "role" && (
                <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                  {/* Current state */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {permOverride !== null ? `Viewing as: ${impersonatedRole}` : "Currently: Superadmin (you)"}
                    </span>
                    {permOverride !== null && (
                      <button onClick={handleClearRole}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                  </div>

                  {/* Role presets */}
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_PRESETS.map(preset => {
                      const isSelected = impersonatedRole === preset.name;
                      return (
                        <button key={preset.name} onClick={() => handlePresetClick(preset)}
                          className={`
                            relative text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                            ${isSelected
                              ? `${preset.color} border-current shadow-sm ring-2 ring-current ring-offset-1`
                              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/20"
                            }
                          `}
                        >
                          {isSelected && <Check className="absolute top-1.5 right-1.5 w-3 h-3" />}
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom permissions */}
                  <div>
                    <button onClick={() => setShowCustom(p => !p)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCustom ? "rotate-180" : ""}`} />
                      Custom permission set
                    </button>
                    {showCustom && (
                      <div className="mt-2 space-y-2.5 p-3 rounded-lg border border-border bg-muted/20">
                        {groups.map(group => (
                          <div key={group}>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {ALL_PERM_KEYS.filter(p => p.group === group).map(p => (
                                <label key={p.key} className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customPerms[p.key] ?? false}
                                    onChange={e => setCustomPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                                    className="w-3 h-3 rounded border-border accent-primary"
                                  />
                                  <span className="text-[11px] text-muted-foreground">{p.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button onClick={handleCustomApply}
                          className="w-full mt-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                          Apply Custom Permissions
                        </button>
                      </div>
                    )}
                  </div>

                  {/* What you can see hint */}
                  {permOverride !== null && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-800 mb-1">Active permissions</p>
                      <div className="flex flex-wrap gap-1">
                        {ALL_PERM_KEYS.filter(p => permOverride[p.key]).map(p => (
                          <span key={p.key} className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                            {p.label}
                          </span>
                        ))}
                        {ALL_PERM_KEYS.every(p => !permOverride[p.key]) && (
                          <span className="text-[10px] text-amber-700 italic">No permissions active</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Tenant tab ──────────────────────────────────── */}
              {tab === "tenant" && (
                <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {activeTenantId !== ownTenantId ? `Viewing: ${switchedTenantName ?? "switched"}` : "All workspaces"}
                    </span>
                    {activeTenantId !== ownTenantId && (
                      <button onClick={handleRestoreOwnTenant}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <RotateCcw className="w-3 h-3" /> Back to mine
                      </button>
                    )}
                  </div>

                  {tenantsLoading && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!tenantsLoading && tenants.map(tenant => {
                    const isCurrent = tenant.id === activeTenantId;
                    const isOwn = tenant.id === ownTenantId;
                    const isSwitching = switchingTenantId === tenant.id;
                    return (
                      <button
                        key={tenant.id}
                        onClick={() => handleSwitchTenant(tenant)}
                        disabled={isCurrent || isSwitching !== false}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-start justify-between gap-2
                          ${isCurrent
                            ? "border-primary bg-primary/5 cursor-default"
                            : "border-border bg-background hover:border-foreground/20 hover:bg-muted/30"
                          }
                        `}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground truncate">{tenant.name}</span>
                            {isOwn && <span className="text-[9px] bg-muted text-muted-foreground rounded px-1 py-0.5 shrink-0">yours</span>}
                            {isCurrent && !isOwn && <span className="text-[9px] bg-primary/10 text-primary rounded px-1 py-0.5 shrink-0">active</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{tenant.slug}</span>
                            {tenant.domain && <span className="truncate max-w-[100px]">· {tenant.domain}</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" />{tenant.member_count}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ArrowRight className="w-2.5 h-2.5" />{tenant.page_count} pages
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {isSwitching
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                            : isCurrent
                              ? <Check className="w-3.5 h-3.5 text-primary" />
                              : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground" />
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Signed in as <strong>{user.email}</strong>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Tenant #{user.tenantId ?? "—"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
