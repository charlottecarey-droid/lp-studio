import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Loader2, Lock, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { emitUpgradeRequired, minimumTierForGate } from "@/lib/plan-upgrade";

/**
 * Workspace switcher (multi-workspace, July 2026 pricing follow-up).
 *
 * Sits in the sidebar under the brand mark. Lists every workspace the user
 * is an ACCEPTED member of (GET /api/auth/workspaces) and re-points the
 * session via POST /api/auth/workspaces/switch — switching is never
 * plan-gated (invited collaborators keep access); only CREATING an
 * additional workspace is the Scale+ `multiWorkspace` feature. When the
 * current plan doesn't include it, the "New workspace" row renders locked
 * and clicking it raises the standard upgrade prompt instead of a dialog.
 *
 * Rendered only when it can do something: more than one membership to
 * switch between, or the caller admins the current workspace (so they can
 * see the create entry / upsell). Everyone else keeps an unchanged sidebar.
 */

interface WorkspaceRow {
  id: number;
  name: string;
  slug: string;
  role: string;
  isAdmin: boolean;
  current: boolean;
}

interface WorkspacesResponse {
  currentTenantId: number | null;
  canCreate: boolean;
  workspaces: WorkspaceRow[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data } = useQuery<WorkspacesResponse>({
    queryKey: ["auth", "workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/auth/workspaces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load workspaces");
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!user,
  });

  if (!user || !data) return null;
  const { workspaces, canCreate } = data;
  const current = workspaces.find((w) => w.current) ?? null;
  const showCreateEntry = !!current?.isAdmin || canCreate;
  // Nothing to switch to and nothing to create — keep the sidebar unchanged.
  if (workspaces.length <= 1 && !showCreateEntry) return null;

  const switchTo = async (tenantId: number) => {
    if (tenantId === user.tenantId || switchingTo !== null) return;
    setSwitchingTo(tenantId);
    try {
      const res = await fetch("/api/auth/workspaces/switch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        // Full reload — every query cache, auth context, and route guard is
        // tenant-scoped, so a soft refresh would leak cross-tenant state.
        window.location.assign("/");
        return;
      }
    } catch {
      /* fall through to reset */
    }
    setSwitchingTo(null);
  };

  const onNewWorkspace = () => {
    if (canCreate) {
      setCreateOpen(true);
      return;
    }
    emitUpgradeRequired({
      gate: "multiWorkspace",
      currentPlan: user.planTier ?? "free",
      currentUsage: null,
      cap: null,
      minimumPlanWithFeature: minimumTierForGate("multiWorkspace"),
      upgradeUrl: "/settings/billing",
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-sidebar-foreground/10 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:border-sidebar-foreground/20 hover:bg-sidebar-accent/50 transition-colors text-left text-[12px]"
            aria-label="Switch workspace"
            data-testid="workspace-switcher-trigger"
          >
            <Building2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
            <span className="flex-1 truncate font-medium">
              {current?.name ?? "Workspace"}
            </span>
            <ChevronsUpDown className="w-3 h-3 opacity-50 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 p-1">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => void switchTo(w.id)}
              className="gap-2 text-[13px]"
              data-testid={`workspace-item-${w.slug}`}
            >
              {switchingTo === w.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Check className={`w-3.5 h-3.5 shrink-0 ${w.current ? "opacity-100" : "opacity-0"}`} />
              )}
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-[10px] text-muted-foreground">{w.role}</span>
            </DropdownMenuItem>
          ))}
          {showCreateEntry && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNewWorkspace} className="gap-2 text-[13px]" data-testid="workspace-create">
                {canCreate ? (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 shrink-0 opacity-60" />
                )}
                <span className="flex-1">New workspace</span>
                {!canCreate && (
                  <span className="text-[9.5px] uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-primary/10 text-primary font-semibold">
                    Scale
                  </span>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = async () => {
    if (!name.trim() || !effectiveSlug || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/workspaces", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: effectiveSlug }),
      });
      if (res.ok) {
        // The session now points at the new workspace — reload into it.
        window.location.assign("/");
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not create the workspace. Please try again.");
    } catch {
      setError("Could not create the workspace. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            A separate workspace with its own pages, brand, team, and billing.
            You'll be its admin and can switch back any time.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ws-name" className="text-[12.5px] font-medium">Workspace name</label>
            <Input
              id="ws-name"
              value={name}
              placeholder="Acme Dental"
              onChange={(e) => setName(e.target.value)}
              data-testid="workspace-create-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ws-slug" className="text-[12.5px] font-medium">Workspace URL</label>
            <Input
              id="ws-slug"
              value={effectiveSlug}
              placeholder="acme-dental"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              data-testid="workspace-create-slug"
            />
            <p className="text-[11.5px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens. New workspaces start on
              the Free plan — upgrade any time from its billing settings.
            </p>
          </div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!name.trim() || !effectiveSlug || submitting} data-testid="workspace-create-submit">
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
