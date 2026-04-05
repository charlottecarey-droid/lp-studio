import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Shield, Check, Minus, MoreHorizontal, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ── Permission definitions ─────────────────────────────────────────── */

const PERMISSION_GROUPS = [
  {
    label: "Marketing",
    keys: [
      { key: "pages", label: "Pages" },
      { key: "tests", label: "Experiments" },
      { key: "analytics", label: "Analytics" },
      { key: "forms_leads", label: "Forms & Leads" },
      { key: "brand", label: "Brand & Content" },
      { key: "blocks", label: "Blocks" },
    ],
  },
  {
    label: "Sales",
    keys: [
      { key: "sales_dashboard", label: "Dashboard" },
      { key: "sales_accounts", label: "Accounts" },
      { key: "sales_contacts", label: "Contacts" },
      { key: "sales_outreach", label: "Outreach" },
      { key: "sales_signals", label: "Signals" },
    ],
  },
  {
    label: "Admin",
    keys: [
      { key: "settings", label: "Settings" },
      { key: "team", label: "Team Management" },
      { key: "roles", label: "Roles Management" },
    ],
  },
] as const;

const ALL_PERM_KEYS = PERMISSION_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

/* ── Types ──────────────────────────────────────────────────────────── */

interface Role {
  id: number;
  name: string;
  permissions: Record<string, boolean>;
  is_admin: boolean;
  is_system: boolean;
}

/* ── Permission cell ────────────────────────────────────────────────── */

function PermCell({
  granted,
  isAdmin,
  isFullAccess,
  canEdit,
  onClick,
}: {
  granted: boolean;
  isAdmin: boolean;
  isFullAccess: boolean;
  canEdit: boolean;
  onClick: () => void;
}) {
  if (isFullAccess) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canEdit}
      className={`flex items-center justify-center group ${canEdit ? "cursor-pointer" : "cursor-default"}`}
    >
      {granted ? (
        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center transition-colors group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/60">
          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-colors group-hover:bg-gray-200 dark:group-hover:bg-gray-700">
          <Minus className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </div>
      )}
    </button>
  );
}

/* ── Main content ───────────────────────────────────────────────────── */

function RolesContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dirtyRoles, setDirtyRoles] = useState<Set<number>>(new Set());
  const [savingRoles, setSavingRoles] = useState<Set<number>>(new Set());

  const isAdmin = user?.isAdmin ?? false;

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roles", { credentials: "include" });
      if (res.ok) {
        setRoles(await res.json());
        setDirtyRoles(new Set());
      }
    } catch {
      toast({ title: "Failed to load roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  /* ── Toggle a single permission ───────────────────────────────────── */

  function togglePerm(roleId: number, key: string) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId || r.is_admin) return r;
        return { ...r, permissions: { ...r.permissions, [key]: !r.permissions[key] } };
      }),
    );
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  /* ── Toggle entire group for a role ───────────────────────────────── */

  function toggleGroup(roleId: number, groupKeys: readonly { key: string; label: string }[]) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId || r.is_admin) return r;
        const keys = groupKeys.map((k) => k.key);
        const allOn = keys.every((k) => r.permissions[k]);
        const newPerms = { ...r.permissions };
        for (const k of keys) newPerms[k] = !allOn;
        return { ...r, permissions: newPerms };
      }),
    );
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  /* ── Save a role's permissions ────────────────────────────────────── */

  async function saveRole(roleId: number) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    setSavingRoles((prev) => new Set(prev).add(roleId));
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: role.permissions }),
      });
      if (res.ok) {
        setDirtyRoles((prev) => {
          const next = new Set(prev);
          next.delete(roleId);
          return next;
        });
        toast({ title: `${role.name} permissions saved` });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingRoles((prev) => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
    }
  }

  /* ── Create role ──────────────────────────────────────────────────── */

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim(), permissions: {} }),
      });
      if (res.ok) {
        toast({ title: "Role created" });
        setNewRoleName("");
        setCreateOpen(false);
        loadRoles();
      } else {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to create role", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  /* ── Duplicate role ───────────────────────────────────────────────── */

  async function handleDuplicate(role: Role) {
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${role.name} (copy)`, permissions: role.permissions }),
      });
      if (res.ok) {
        toast({ title: `Duplicated "${role.name}"` });
        loadRoles();
      } else {
        toast({ title: "Failed to duplicate", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  /* ── Delete role ──────────────────────────────────────────────────── */

  async function handleDelete(roleId: number) {
    const role = roles.find((r) => r.id === roleId);
    if (!confirm(`Delete "${role?.name}"? Members assigned to it will need a new role.`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Role deleted" });
        loadRoles();
      } else {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to delete role", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  /* ── Editable (non-admin) roles ───────────────────────────────────── */

  const editableRoles = roles.filter((r) => !r.is_admin);
  const adminRole = roles.find((r) => r.is_admin);

  /* ── Count helpers ────────────────────────────────────────────────── */

  function countEnabled(role: Role): number {
    if (role.is_admin) return ALL_PERM_KEYS.length;
    return ALL_PERM_KEYS.filter((k) => role.permissions[k]).length;
  }

  function groupAllOn(role: Role, groupKeys: readonly { key: string; label: string }[]): boolean {
    if (role.is_admin) return true;
    return groupKeys.every((k) => role.permissions[k.key]);
  }

  function groupSomeOn(role: Role, groupKeys: readonly { key: string; label: string }[]): boolean {
    if (role.is_admin) return true;
    return groupKeys.some((k) => role.permissions[k.key]);
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Control what each role can access. Click any cell to toggle.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-[13px]">
                <Plus className="w-3.5 h-3.5" />
                New role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create role</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role name</label>
                  <Input
                    placeholder="e.g. Content Manager"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : "Create role"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : roles.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No roles yet. Create one to get started.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border">
          {/* Sticky save bar */}
          {dirtyRoles.size > 0 && (
            <div className="sticky top-0 z-20 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-700 px-5 py-2.5 flex items-center justify-between">
              <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Unsaved changes in {dirtyRoles.size} role{dirtyRoles.size > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={loadRoles}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    for (const id of dirtyRoles) saveRole(id);
                  }}
                  disabled={savingRoles.size > 0}
                >
                  {savingRoles.size > 0 ? "Saving..." : "Save all"}
                </Button>
              </div>
            </div>
          )}

          {/* Matrix table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Column headers = role names */}
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-foreground/70 text-xs uppercase tracking-wider px-5 py-3 w-[200px] min-w-[200px] sticky left-0 bg-muted/50 z-10">
                    Permission
                  </th>
                  {adminRole && (
                    <th className="text-center px-4 py-3 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[13px]">{adminRole.name}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Full access</span>
                      </div>
                    </th>
                  )}
                  {editableRoles.map((role) => (
                    <th key={role.id} className="text-center px-4 py-3 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[13px]">{role.name}</span>
                          {role.is_system && (
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-normal">
                              System
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-foreground/60 font-medium">
                          {countEnabled(role)} of {ALL_PERM_KEYS.length}
                        </span>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="mt-0.5 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-36">
                              <DropdownMenuItem onClick={() => handleDuplicate(role)} className="text-xs gap-2">
                                <Copy className="w-3.5 h-3.5" /> Duplicate
                              </DropdownMenuItem>
                              {!role.is_system && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(role.id)}
                                  className="text-xs gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <>
                    {/* Group header row */}
                    <tr key={`group-${group.label}`} className="bg-muted/60">
                      <td className="px-5 py-2.5 sticky left-0 bg-muted/60 z-10">
                        <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-[0.08em]">
                          {group.label}
                        </span>
                      </td>
                      {/* Group-level toggle cells */}
                      {adminRole && (
                        <td className="text-center px-4 py-2">
                          <div className="flex items-center justify-center">
                            <div className="w-5 h-0.5 rounded-full bg-emerald-300 dark:bg-emerald-700" />
                          </div>
                        </td>
                      )}
                      {editableRoles.map((role) => {
                        const allOn = groupAllOn(role, group.keys);
                        const someOn = groupSomeOn(role, group.keys);
                        return (
                          <td key={role.id} className="text-center px-4 py-2">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => toggleGroup(role.id, group.keys)}
                                className="inline-flex items-center justify-center"
                                title={allOn ? `Revoke all ${group.label}` : `Grant all ${group.label}`}
                              >
                                <div
                                  className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                                    allOn
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-800/60"
                                      : someOn
                                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-800/50"
                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  {allOn ? "All" : someOn ? "Partial" : "None"}
                                </div>
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                                  allOn
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                                    : someOn
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {allOn ? "All" : someOn ? "Partial" : "None"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Individual permission rows */}
                    {group.keys.map(({ key, label }) => (
                      <tr
                        key={key}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-2.5 text-[13px] text-foreground sticky left-0 bg-background z-10 pl-8">
                          {label}
                        </td>
                        {adminRole && (
                          <td className="text-center px-4 py-2.5">
                            <PermCell
                              granted={true}
                              isAdmin={isAdmin}
                              isFullAccess={true}
                              canEdit={false}
                              onClick={() => {}}
                            />
                          </td>
                        )}
                        {editableRoles.map((role) => (
                          <td key={role.id} className="text-center px-4 py-2.5">
                            <PermCell
                              granted={!!role.permissions[key]}
                              isAdmin={isAdmin}
                              isFullAccess={false}
                              canEdit={isAdmin}
                              onClick={() => togglePerm(role.id, key)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RolesPage() {
  const [location] = useLocation();
  const isSales = location.startsWith("/sales");
  const Layout = isSales ? SalesLayout : AppLayout;
  return (
    <Layout>
      <RolesContent />
    </Layout>
  );
}
