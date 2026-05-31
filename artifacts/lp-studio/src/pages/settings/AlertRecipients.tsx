import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Users,
  ShieldCheck,
  X,
  Plus,
  CheckCircle2,
  UsersRound,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AlertCategory = "collaboration" | "account_billing";

interface MemberRow {
  userId: number;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

type BuiltInGroupToken = "all_admins" | "all_members" | "page_author";

interface CustomGroup {
  id: number;
  token: string;
  label: string;
  memberUserIds: number[];
  extraEmails: string[];
}

interface AlertConfig {
  type: string;
  category: AlertCategory;
  name: string;
  description: string;
  configured: boolean;
  memberUserIds: number[];
  extraEmails: string[];
  // Mix of built-in tokens (all_admins/all_members/page_author) and custom
  // tokens (custom:<id>).
  groups: string[];
  applicableGroups: BuiltInGroupToken[];
}

const GROUP_META: Record<BuiltInGroupToken, { label: string; hint: string }> = {
  all_admins: {
    label: "All admins",
    hint: "Every current workspace admin — updates automatically as admins change.",
  },
  all_members: {
    label: "All members",
    hint: "Every current workspace member — updates automatically as the team changes.",
  },
  page_author: {
    label: "Page author",
    hint: "The person who created or submitted the specific page this alert is about.",
  },
};

interface RecipientsPayload {
  members: MemberRow[];
  alerts: AlertConfig[];
  customGroups: CustomGroup[];
}

const CATEGORY_META: Record<AlertCategory, { label: string; defaultHint: string }> = {
  collaboration: {
    label: "Collaboration",
    defaultHint: "Default: every workspace member.",
  },
  account_billing: {
    label: "Account & billing",
    defaultHint:
      "Default: every workspace admin. If you select recipients but none can be reached, these still fall back to all admins so critical alerts are never dropped.",
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AlertCard({
  alert,
  members,
  customGroups,
  canManage,
  onSaved,
}: {
  alert: AlertConfig;
  members: MemberRow[];
  customGroups: CustomGroup[];
  canManage: boolean;
  onSaved: (next: AlertConfig) => void;
}) {
  const { toast } = useToast();
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set(alert.memberUserIds));
  const [extraEmails, setExtraEmails] = useState<string[]>(alert.extraEmails);
  const [groups, setGroups] = useState<Set<string>>(new Set(alert.groups));
  const [emailDraft, setEmailDraft] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Re-sync when the parent reloads (e.g. after a refresh).
  useEffect(() => {
    setMemberIds(new Set(alert.memberUserIds));
    setExtraEmails(alert.extraEmails);
    setGroups(new Set(alert.groups));
  }, [alert.memberUserIds, alert.extraEmails, alert.groups]);

  const isDefault = !alert.configured;

  function toggleMember(id: number, on: boolean) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGroup(token: string, on: boolean) {
    setGroups((prev) => {
      const next = new Set(prev);
      if (on) next.add(token);
      else next.delete(token);
      return next;
    });
  }

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) {
      setEmailErr("Enter a valid email address.");
      return;
    }
    if (extraEmails.includes(e)) {
      setEmailErr("That email is already in the list.");
      return;
    }
    setExtraEmails((prev) => [...prev, e]);
    setEmailDraft("");
    setEmailErr(null);
  }

  function removeEmail(e: string) {
    setExtraEmails((prev) => prev.filter((x) => x !== e));
  }

  async function save() {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/broadcast-recipients/${encodeURIComponent(alert.type)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberUserIds: Array.from(memberIds),
            extraEmails,
            groups: Array.from(groups),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setSavedAt(Date.now());
      onSaved({
        ...alert,
        configured: true,
        memberUserIds: json.memberUserIds ?? Array.from(memberIds),
        extraEmails: json.extraEmails ?? extraEmails,
        groups: json.groups ?? Array.from(groups),
      });
      toast({ title: `Recipients saved for "${alert.name}"` });
    } catch (err) {
      toast({
        title: "Couldn't save recipients",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    if (!canManage) return;
    setSaving(true);
    try {
      // Reset = DELETE the config row so the alert reverts to its legacy default
      // audience (collaboration → every member; account/billing → every admin).
      // This is deliberately NOT a save-empty: an empty saved config means "send
      // to nobody" (collab) / "fail open to admins" (account-billing), whereas
      // deleting the row restores the full default audience.
      const res = await fetch(
        `/api/admin/broadcast-recipients/${encodeURIComponent(alert.type)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setMemberIds(new Set());
      setExtraEmails([]);
      setGroups(new Set());
      setSavedAt(Date.now());
      onSaved({ ...alert, configured: false, memberUserIds: [], extraEmails: [], groups: [] });
      toast({ title: `Reset "${alert.name}" to the default audience` });
    } catch (err) {
      toast({
        title: "Couldn't update recipients",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const Icon = alert.category === "collaboration" ? Users : ShieldCheck;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{alert.name}</h3>
              {isDefault ? (
                <Badge variant="secondary" className="text-[9px]">Using default</Badge>
              ) : (
                <Badge className="text-[9px]">Custom</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-prose">
              {alert.description}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 italic">
              {CATEGORY_META[alert.category].defaultHint}
            </p>
          </div>

          {(alert.applicableGroups.length > 0 || customGroups.length > 0) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Quick-pick groups
              </p>
              <p className="text-[11px] text-muted-foreground mb-2">
                Groups update themselves as the team changes — pick one and you
                won't have to re-edit this list later.
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {alert.applicableGroups.map((token) => {
                  const checked = groups.has(token);
                  return (
                    <label
                      key={token}
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                        checked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-accent"
                      } ${!canManage ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!canManage}
                        onCheckedChange={(v) => toggleGroup(token, v === true)}
                        data-testid={`recip-${alert.type}-group-${token}`}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium flex items-center gap-1.5">
                          {GROUP_META[token].label}
                          {checked && (
                            <Badge className="text-[8px] shrink-0">on</Badge>
                          )}
                        </span>
                        <span className="block text-muted-foreground mt-0.5 leading-snug">
                          {GROUP_META[token].hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {customGroups.map((g) => {
                  const checked = groups.has(g.token);
                  const count = g.memberUserIds.length + g.extraEmails.length;
                  return (
                    <label
                      key={g.token}
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                        checked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-accent"
                      } ${!canManage ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!canManage}
                        onCheckedChange={(v) => toggleGroup(g.token, v === true)}
                        data-testid={`recip-${alert.type}-customgroup-${g.id}`}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium flex items-center gap-1.5">
                          <UsersRound className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{g.label}</span>
                          {checked && (
                            <Badge className="text-[8px] shrink-0">on</Badge>
                          )}
                        </span>
                        <span className="block text-muted-foreground mt-0.5 leading-snug">
                          Custom group · {count} {count === 1 ? "recipient" : "recipients"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Workspace members
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">No members found.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {members.map((m) => {
                  const checked = memberIds.has(m.userId);
                  return (
                    <label
                      key={m.userId}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                        checked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-accent"
                      } ${!canManage ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!canManage}
                        onCheckedChange={(v) => toggleMember(m.userId, v === true)}
                        data-testid={`recip-${alert.type}-member-${m.userId}`}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{m.name || m.email}</span>
                        {m.name && (
                          <span className="text-muted-foreground"> · {m.email}</span>
                        )}
                      </span>
                      {m.isAdmin && (
                        <Badge variant="secondary" className="text-[8px] shrink-0">admin</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Extra email addresses
            </p>
            {extraEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {extraEmails.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    {e}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => removeEmail(e)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${e}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {canManage && (
              <div className="flex items-center gap-2">
                <Input
                  value={emailDraft}
                  onChange={(e) => { setEmailDraft(e.target.value); setEmailErr(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder="alerts@acme.com"
                  className="h-9 text-sm font-mono"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-testid={`recip-${alert.type}-email-input`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={addEmail}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            )}
            {emailErr && <p className="text-xs text-destructive mt-1.5">{emailErr}</p>}
          </div>

          {canManage && (
            <div className="flex items-center gap-3 border-t pt-3">
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving}
                data-testid={`recip-${alert.type}-save`}
              >
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Save recipients
              </Button>
              {!isDefault && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void resetToDefault()}
                  disabled={saving}
                  data-testid={`recip-${alert.type}-reset`}
                >
                  Reset to default
                </Button>
              )}
              {savedAt && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Editor form for creating / updating a custom group (Task #629). When `group`
 * is provided it edits in place; otherwise it creates a new group.
 */
function CustomGroupEditor({
  group,
  members,
  onDone,
  onCancel,
}: {
  group: CustomGroup | null;
  members: MemberRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState(group?.label ?? "");
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set(group?.memberUserIds ?? []));
  const [extraEmails, setExtraEmails] = useState<string[]>(group?.extraEmails ?? []);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleMember(id: number, on: boolean) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) { setEmailErr("Enter a valid email address."); return; }
    if (extraEmails.includes(e)) { setEmailErr("That email is already in the list."); return; }
    setExtraEmails((prev) => [...prev, e]);
    setEmailDraft("");
    setEmailErr(null);
  }

  function removeEmail(e: string) {
    setExtraEmails((prev) => prev.filter((x) => x !== e));
  }

  async function save() {
    const trimmed = label.trim();
    if (!trimmed) {
      toast({ title: "Give the group a name first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = group
        ? `/api/admin/recipient-groups/${group.id}`
        : "/api/admin/recipient-groups";
      const res = await fetch(url, {
        method: group ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: trimmed,
          memberUserIds: Array.from(memberIds),
          extraEmails,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast({ title: group ? `Updated "${trimmed}"` : `Created group "${trimmed}"` });
      onDone();
    } catch (err) {
      toast({
        title: "Couldn't save group",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 border-primary/40 space-y-4">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group name
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Billing contacts"
          maxLength={80}
          className="h-9 text-sm mt-1"
          data-testid="customgroup-label-input"
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Workspace members
        </p>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members found.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {members.map((m) => {
              const checked = memberIds.has(m.userId);
              return (
                <label
                  key={m.userId}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer ${
                    checked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-accent"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleMember(m.userId, v === true)}
                    data-testid={`customgroup-member-${m.userId}`}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{m.name || m.email}</span>
                    {m.name && <span className="text-muted-foreground"> · {m.email}</span>}
                  </span>
                  {m.isAdmin && (
                    <Badge variant="secondary" className="text-[8px] shrink-0">admin</Badge>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Extra email addresses
        </p>
        {extraEmails.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {extraEmails.map((e) => (
              <span
                key={e}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {e}
                <button
                  type="button"
                  onClick={() => removeEmail(e)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${e}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={emailDraft}
            onChange={(e) => { setEmailDraft(e.target.value); setEmailErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
            placeholder="alerts@acme.com"
            className="h-9 text-sm font-mono"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            data-testid="customgroup-email-input"
          />
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={addEmail}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        {emailErr && <p className="text-xs text-destructive mt-1.5">{emailErr}</p>}
      </div>

      <div className="flex items-center gap-3 border-t pt-3">
        <Button size="sm" onClick={() => void save()} disabled={saving} data-testid="customgroup-save">
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          {group ? "Save changes" : "Create group"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

/**
 * Custom groups manager (Task #629). Lists the tenant's reusable groups and lets
 * an admin create / edit / delete them. Deleting a group also strips it from any
 * alert that referenced it (handled server-side), so the parent reloads after a
 * delete to reflect the new alert configs.
 */
function CustomGroupsManager({
  customGroups,
  members,
  canManage,
  onChanged,
}: {
  customGroups: CustomGroup[];
  members: MemberRow[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const memberName = useCallback(
    (id: number) => {
      const m = members.find((x) => x.userId === id);
      return m ? (m.name || m.email) : `User ${id}`;
    },
    [members],
  );

  async function deleteGroup(g: CustomGroup) {
    if (!canManage) return;
    setDeletingId(g.id);
    try {
      const res = await fetch(`/api/admin/recipient-groups/${g.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast({ title: `Deleted "${g.label}"` });
      onChanged();
    } catch (err) {
      toast({
        title: "Couldn't delete group",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UsersRound className="w-4 h-4 text-muted-foreground" /> Custom groups
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            Define your own named groups (like "Billing contacts" or "Design
            reviewers") once, then quick-pick them on any alert below. Groups
            resolve to their current members at send time, so you won't need to
            re-edit alerts when the group changes.
          </p>
        </div>
        {canManage && !creating && editingId === null && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setCreating(true)}
            data-testid="customgroup-new"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New group
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {customGroups.length === 0 && !creating && (
          <p className="text-xs text-muted-foreground italic">
            No custom groups yet.
          </p>
        )}

        {customGroups.map((g) => {
          if (editingId === g.id) {
            return (
              <CustomGroupEditor
                key={g.id}
                group={g}
                members={members}
                onDone={() => { setEditingId(null); onChanged(); }}
                onCancel={() => setEditingId(null)}
              />
            );
          }
          const count = g.memberUserIds.length + g.extraEmails.length;
          const names = [
            ...g.memberUserIds.map(memberName),
            ...g.extraEmails,
          ];
          return (
            <div
              key={g.id}
              className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
              data-testid={`customgroup-row-${g.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  {g.label}
                  <Badge variant="secondary" className="text-[8px]">
                    {count} {count === 1 ? "recipient" : "recipients"}
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {names.length ? names.join(", ") : "No members yet"}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => { setCreating(false); setEditingId(g.id); }}
                    data-testid={`customgroup-edit-${g.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => void deleteGroup(g)}
                    disabled={deletingId === g.id}
                    data-testid={`customgroup-delete-${g.id}`}
                  >
                    {deletingId === g.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {creating && (
          <CustomGroupEditor
            group={null}
            members={members}
            onDone={() => { setCreating(false); onChanged(); }}
            onCancel={() => setCreating(false)}
          />
        )}
      </div>
    </Card>
  );
}

export function AlertRecipientsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = (user?.isAdmin ?? false) || !!user?.permissions?.["settings"];
  const [data, setData] = useState<RecipientsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast-recipients", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RecipientsPayload;
      setData(json);
    } catch {
      toast({ title: "Failed to load alert recipients", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  function handleSaved(next: AlertConfig) {
    setData((prev) =>
      prev
        ? { ...prev, alerts: prev.alerts.map((a) => (a.type === next.type ? next : a)) }
        : prev,
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const customGroups = data.customGroups ?? [];

  const byCategory: Record<AlertCategory, AlertConfig[]> = {
    collaboration: data.alerts.filter((a) => a.category === "collaboration"),
    account_billing: data.alerts.filter((a) => a.category === "account_billing"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Alert recipients</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-prose">
          Choose who receives each workspace alert email. Pick a self-updating
          group (like All admins or one of your custom groups), select individual
          members, add extra addresses — or combine them. Groups always resolve
          to the current team at send time, so you won't need to re-edit a list
          when people join or leave. Leave an alert on its default to keep
          sending to the whole audience.
        </p>
      </div>

      <CustomGroupsManager
        customGroups={customGroups}
        members={data.members}
        canManage={canManage}
        onChanged={() => void load()}
      />

      {(["collaboration", "account_billing"] as AlertCategory[]).map((cat) =>
        byCategory[cat].length === 0 ? null : (
          <div key={cat} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_META[cat].label}
            </p>
            {byCategory[cat].map((alert) => (
              <AlertCard
                key={alert.type}
                alert={alert}
                members={data.members}
                customGroups={customGroups}
                canManage={canManage}
                onSaved={handleSaved}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
}

export default AlertRecipientsContent;
