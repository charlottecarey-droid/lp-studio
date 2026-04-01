import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { UserPlus, Trash2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: number;
  name: string;
  is_admin: boolean;
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

function TeamContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

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

  useEffect(() => { loadData(); }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage who has access to LP Studio and their roles.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email address</label>
                  <Input
                    type="email"
                    placeholder="name@meetdandy.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRoleId} onValueChange={setInviteRoleId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviteLoading}>
                  {inviteLoading ? "Adding…" : "Add Member"}
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
        <div className="text-center py-12 text-muted-foreground">
          No members yet. Add your first team member above.
        </div>
      ) : (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
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
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                          Pending
                        </Badge>
                      )}
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
        </div>
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
