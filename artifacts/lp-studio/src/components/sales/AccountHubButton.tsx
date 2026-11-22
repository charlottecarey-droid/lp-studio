import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * On an account: open its Partner Hub, or make one. Making one is the same
 * creation the Partner Hubs page runs, and an account never gets two.
 */
export function AccountHubButton({ accountId }: { accountId: number }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["partner-hub-account", accountId],
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-hub-accounts?id=${accountId}`, { credentials: "include" });
      if (!r.ok) return null;
      const j = (await r.json()) as { accounts?: { id: number; hubPageId: number | null }[] };
      return j.accounts?.find((a) => a.id === accountId) ?? null;
    },
  });
  // Nothing until we know: a "Create" button that flips to "Open" a moment later invites a double hub.
  if (!data) return null;
  if (data.hubPageId) {
    return (
      <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => navigate(`/sales/partnerships/${data.hubPageId}`)} data-account-hub="open">
        <DoorOpen className="w-3.5 h-3.5" />
        Partner Hub
      </Button>
    );
  }
  const create = async () => {
    setBusy(true);
    const r = await fetch("/api/lp/partner-rooms", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
    const j = (await r.json().catch(() => ({}))) as { pageId?: number; error?: string };
    setBusy(false);
    if (r.ok && j.pageId) {
      void qc.invalidateQueries({ queryKey: ["partner-hub-account", accountId] });
      void qc.invalidateQueries({ queryKey: ["partner-hubs"] });
      navigate(`/sales/partnerships/${j.pageId}`);
    } else {
      toast({ title: "Couldn't create the hub", description: j.error ?? "Try again in a moment.", variant: "destructive" });
    }
  };
  return (
    <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={create} disabled={busy} data-account-hub="create">
      <DoorOpen className="w-3.5 h-3.5" />
      {busy ? "Creating the hub…" : "Create Partner Hub"}
    </Button>
  );
}
