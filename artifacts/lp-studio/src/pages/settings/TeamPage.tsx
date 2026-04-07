import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Trash2, Shield, LayoutDashboard, TrendingUp, Megaphone, FlaskConical, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ── Permission key → area mapping ──────────────────────────────────── */

const MARKETING_KEYS = ["pages", "tests", "analytics", "forms_leads", "brand", "blocks"];
const SALES_KEYS = ["sales_dashboard", "sales_accounts", "sales_contacts", "sales_outreach", "sales_signals"];
const ADMIN_KEYS = ["settings", "team", "roles"];

function describeRoleAccess(perms: Record<string, boolean>, isAdmin: boolean): {
  marketing: boolean;
  sales: boolean;
  admin: boolean;
  marketingCount: number;
  salesCount: number;
} {
  if (isAdmin) {
    return { marketing: true, sales: true, admin: true, marketingCount: MARKETING_KEYS.length, salesCount: SALES_KEYS.length };
  }
  const marketingCount = MARKETING_KEYS.filter((k) => perms[k]).length;
  const salesCount = SALES_KEYS.filter((k) => perms[k]).length;
  const adminCount = ADMIN_KEYS.filter((k) => perms[k]).length;
  return {
    marketing: marketingCount > 0,
    sales: salesCount > 0,
    admin: adminCount > 0,
    marketingCount,
    salesCount,
  };
}

/* ── Types ──────────────────────────────────────────────────────────── */

interface Role {
  id: number;
  name: string;
  permissions: Record<string, boolean>;
  is_admin: boolean;
  is_system: boolean;
}

interface Member {
  id: number;
  user_id: number | null;
  role_id: number;
  role_name: string;
  is_admin: boolean;
  invite_email: string | null;
  user_email: string | null;
  user_name: string | null;
  avatar_url: string | null;
  invited_at: string;
  accepted_at: string | null;
}

/* ── Avatar ─────────────────────────────────────────────────────────── */

function MemberAvatar({ member }: { member: Member }) {
  const displayName = member.user_name || member.user_email || member.invite_email || "?";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return member.avatar_url ? (
    <img src={member.avatar_url} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <div className="h-8 w-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
      {initials}
    </div>
  );
}

/* ── Area badge ─────────────────────────────────────────────────────── */

function AreaBadges({ role, roles }: { role: { role_name: string; is_admin: boolean; role_id: number }; roles: Role[] }) {
  const fullRole = roles.find((r) => r.id === role.role_id);
  if (!fullRole) return null;
  const access = describeRoleAccess(fullRole.permissions ?? {}, fullRole.is_admin);

  if (fullRole.is_admin) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="text-[10px] h-5 px-1.5 bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/50 dark:text-emerald-400 gap-1">
          <LayoutDashboard className="w-3 h-3" /> All access
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {access.marketing && (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:bg-blue-950/30">
          <Megaphone className="w-3 h-3" /> Marketing
        </Badge>
      )}
      {access.sales && (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 border-violet-300 text-violet-700 bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:bg-violet-950/30">
          <TrendingUp className="w-3 h-3" /> Sales
        </Badge>
      )}
    </div>
  );
}

/* ── Main content ───────────────────────────────────────────────────── */

function TeamContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteArea, setInviteArea] = useState<"marketing" | "sales" | "both" | "">("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Invite email test
  const [inviteTestOpen, setInviteTestOpen] = useState(false);
  const [inviteTestTo, setInviteTestTo] = useState(user?.email ?? "");
  const [inviteTestSending, setInviteTestSending] = useState(false);
  const [inviteTestSent, setInviteTestSent] = useState(false);

  async function handleInviteTest(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteTestTo) return;
    setInviteTestSending(true);
    try {
      const res = await fetch("/api/admin/invite-test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: inviteTestTo }),
      });
      if (res.ok) {
        setInviteTestSent(true);
        setTimeout(() => {
          setInviteTestSent(false);
          setInviteTestOpen(false);
        }, 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: (data as { error?: string }).error ?? "Failed to send test email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setInviteTestSending(false);
    }
  }

  async function loadData() {
    try {
      const [membersRes, rolesRes] = await Promise.all([
        fetch("/api/admin/members", { credentials: "include" }),
        fetch("/api/admin/roles", { credentials: "include" }),
      ]);
      if (membersRes.ok) setMembers(await membersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch {
      toast({ title: "Failed to load team data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filter roles based on selected area
  const filteredRoles = roles.filter((r) => {
    if (!inviteArea) return true;
    if (r.is_admin) return true; // Admin always shown
    const access = describeRoleAccess(r.permissions ?? {}, r.is_admin);
    if (inviteArea === "marketing") return access.marketing;
    if (inviteArea === "sales") return access.sales;
    return true; // "both" shows all
  });

  // Reset role when area changes (if selected role no longer matches)
  function handleAreaChange(area: "marketing" | "sales" | "both") {
    setInviteArea(area);
    if (inviteRoleId) {
      const stillValid = filteredRoles.some((r) => String(r.id) === inviteRoleId);
      if (!stillValid) setInviteRoleId("");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !inviteRoleId) return;
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, roleId: Number(inviteRoleId) }),
      });
      if (res.ok) {
        toast({ title: "Member added" });
        setInviteEmail("");
        setInviteArea("");
        setInviteRoleId("");
        setInviteOpen(false);
        loadData();
      } else {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to add member", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(memberId: number, roleId: string) {
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: Number(roleId) }),
      });
      if (res.ok) {
        toast({ title: "Role updated" });
        loadData();
      } else {
        toast({ title: "Failed to update role", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  async function handleRemove(memberId: number) {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Member removed" });
        loadData();
      } else {
        toast({ title: "Failed to remove member", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  const isAdmin = user?.isAdmin ?? false;

  // Build role description for the select dropdown
  function roleDescription(role: Role): string {
    if (role.is_admin) return "Full access to everything";
    const access = describeRoleAccess(role.permissions ?? {}, false);
    const parts: string[] = [];
    if (access.marketing) parts.push(`${access.marketingCount} marketing`);
    if (access.sales) parts.push(`${access.salesCount} sales`);
    if (access.admin) parts.push("admin");
    return parts.length > 0 ? parts.join(" + ") + " permissions" : "No permissions";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage who has access and their roles.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={(open) => {
            setInviteOpen(open);
            if (!open) {
              setInviteEmail("");
              setInviteArea("");
              setInviteRoleId("");
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-[13px]">
                <UserPlus className="w-3.5 h-3.5" />
                Add member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Add team member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-5 pt-2">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email address</label>
                  <Input
                    type="email"
                    placeholder="name@meetdandy.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Area selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">What will they use?</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAreaChange("marketing")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-colors ${
                        inviteArea === "marketing"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      }`}
                    >
                      <Megaphone className={`w-5 h-5 ${inviteArea === "marketing" ? "text-blue-600" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${inviteArea === "marketing" ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                        Marketing
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Pages, experiments, analytics
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAreaChange("sales")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-colors ${
                        inviteArea === "sales"
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                          : "border-border hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                      }`}
                    >
                      <TrendingUp className={`w-5 h-5 ${inviteArea === "sales" ? "text-violet-600" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${inviteArea === "sales" ? "text-violet-700 dark:text-violet-400" : "text-foreground"}`}>
                        Sales
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Accounts, contacts, outreach
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAreaChange("both")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-colors ${
                        inviteArea === "both"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                      }`}
                    >
                      <LayoutDashboard className={`w-5 h-5 ${inviteArea === "both" ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${inviteArea === "both" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                        Both
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Full marketing + sales
                      </span>
                    </button>
                  </div>
                </div>

                {/* Role selector — shown after area is picked */}
                {inviteArea && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={inviteRoleId} onValueChange={setInviteRoleId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRoles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            <div className="flex items-center gap-2">
                              {r.is_admin && <Shield className="w-3 h-3 text-primary" />}
                              <span>{r.name}</span>
                              <span className="text-muted-foreground text-[11px] ml-1">
                                — {roleDescription(r)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inviteRoleId && (() => {
                      const selected = roles.find((r) => String(r.id) === inviteRoleId);
                      if (!selected || selected.is_admin) return null;
                      const access = describeRoleAccess(selected.permissions ?? {}, false);
                      return (
                        <div className="rounded-md bg-muted/50 px-3 py-2 mt-1.5">
                          <p className="text-[11px] text-muted-foreground font-medium mb-1">This role grants:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {access.marketing && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">
                                {access.marketingCount} marketing permissions
                              </span>
                            )}
                            {access.sales && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 font-medium">
                                {access.salesCount} sales permissions
                              </span>
                            )}
                            {!access.marketing && !access.sales && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 font-medium">
                                No permissions yet — configure in Roles
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={inviteLoading || !inviteEmail || !inviteRoleId}
                >
                  {inviteLoading ? "Adding..." : "Add member"}
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
      ) : members.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <UserPlus className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No members yet. Add your first team member above.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-medium">Member</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Area</TableHead>
                <TableHead className="font-medium">Role</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const email = m.user_email ?? m.invite_email ?? "";
                const name = m.user_name ?? email;
                const isCurrentUser = m.user_id === user?.userId;

                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar member={m} />
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {name}
                            {isCurrentUser && (
                              <span className="text-[10px] text-muted-foreground">(you)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.accepted_at ? (
                        <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/50 dark:text-emerald-400">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] h-5 bg-amber-100 text-amber-700 border-0 dark:bg-amber-900/40 dark:text-amber-400">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AreaBadges role={m} roles={roles} />
                    </TableCell>
                    <TableCell>
                      {isAdmin && !isCurrentUser ? (
                        <Select
                          value={String(m.role_id)}
                          onValueChange={(v) => handleRoleChange(m.id, v)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm">
                          {m.is_admin && <Shield className="w-3.5 h-3.5 text-primary" />}
                          {m.role_name}
                        </div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {!isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(m.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite email section */}
      {isAdmin && (
        <Card className="p-5 rounded-2xl border border-border/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Invite email</h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Preview the email that new members receive when you add them to the workspace.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => { setInviteTestTo(user?.email ?? ""); setInviteTestOpen(true); }}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Send preview
            </Button>
          </div>

          {/* Inline dialog */}
          <Dialog open={inviteTestOpen} onOpenChange={(open) => { setInviteTestOpen(open); if (!open) { setInviteTestSent(false); } }}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-muted-foreground" />
                  Preview invite email
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInviteTest} className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Send a sample of the invite email to any address so you can see exactly what new members receive.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Send to</label>
                  <Input
                    type="email"
                    value={inviteTestTo}
                    onChange={(e) => setInviteTestTo(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={inviteTestSending || inviteTestSent || !inviteTestTo}
                    className="flex-1 gap-2"
                  >
                    {inviteTestSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : inviteTestSent ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <FlaskConical className="w-4 h-4" />
                    )}
                    {inviteTestSending ? "Sending…" : inviteTestSent ? "Sent!" : "Send preview"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setInviteTestOpen(false)} disabled={inviteTestSending}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Card>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [location] = useLocation();
  const isSales = location.startsWith("/sales");
  const Layout = isSales ? SalesLayout : AppLayout;
  return (
    <Layout>
      <TeamContent />
    </Layout>
  );
}
