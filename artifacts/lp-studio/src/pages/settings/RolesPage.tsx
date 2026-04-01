import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface Role {
  id: number;
  name: string;
  permissions: Record<string, boolean>;
  is_admin: boolean;
  is_system: boolean;
}

function RoleCard({
  role,
  isAdmin,
  onUpdate,
  onDelete,
}: {
  role: Role;
  isAdmin: boolean;
  onUpdate: (id: number, permissions: Record<string, boolean>) => void;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>(role.permissions ?? {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    if (!isAdmin || role.is_admin) return;
    setPerms((p) => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      if (res.ok) {
        onUpdate(role.id, perms);
        setDirty(false);
        toast({ title: "Permissions saved" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-muted/20 border-b border-border/40">
        <div className="flex items-center gap-2">
          {role.is_admin && <Shield className="w-4 h-4 text-primary" />}
          <span className="font-semibold">{role.name}</span>
          {role.is_system && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">System</Badge>
          )}
          {role.is_admin && (
            <Badge className="text-[10px] h-4 px-1.5 bg-primary/20 text-primary border-0">
              Full access
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && isAdmin && !role.is_admin && (
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          {isAdmin && !role.is_system && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(role.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {role.is_admin ? (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          Admins have full access to all features.
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="px-5 py-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.label}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm text-foreground/80">{label}</span>
                    <Switch
                      checked={!!perms[key]}
                      onCheckedChange={() => toggle(key)}
                      disabled={!isAdmin}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RolesContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadRoles() {
    try {
      const res = await fetch("/api/admin/roles", { credentials: "include" });
      if (res.ok) setRoles(await res.json());
    } catch {
      toast({ title: "Failed to load roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);

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

  async function handleDelete(roleId: number) {
    if (!confirm("Delete this role? Members assigned to it will need a new role.")) return;
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

  function handleUpdate(id: number, permissions: Record<string, boolean>) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, permissions } : r)));
  }

  const isAdmin = user?.isAdmin ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define what each role can access in LP Studio.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Role</DialogTitle>
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
                  {creating ? "Creating…" : "Create Role"}
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
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
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
