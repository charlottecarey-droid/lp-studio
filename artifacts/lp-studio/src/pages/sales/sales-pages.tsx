import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { AccountCombobox } from "@/components/AccountCombobox";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Layout,
  Plus,
  Building2,
  Check,
  Copy,
  Link2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Search,
  MoreVertical,
  Trash2,
  EyeOff,
  Eye,
  ArrowUpDown,
  CheckSquare,
  Square,
  X,
  Layers,
  Loader2,
  Users,
  Globe,
  Pencil,
  Bell,
  BellRing,
  Mail,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { GenerateMicrositeModal } from "@/components/sales/GenerateMicrositeModal";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHint } from "@/components/ui/page-hint";
import { useAuth } from "@/context/AuthContext";
import { getLpPageUrl } from "@/lib/utils";
import { copyEmailPreview } from "@/lib/email-preview";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNowStrict } from "date-fns";

const API_BASE = "/api";

interface HotlinkEntryRaw {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName?: string;
  contactFirst?: string;
  contactLast?: string;
}

import {
  fmtDwell,
  initials,
  pageMineRank,
  type AlertEmail,
  type HotlinkEntry,
  type PageRow,
} from "./sales-pages-shared";
import { SalesPageDrillDown } from "./SalesPageDrillDown";

function normalizeHotlink(hl: HotlinkEntryRaw): HotlinkEntry {
  return {
    hotlinkId: hl.hotlinkId,
    token: hl.token,
    contactId: hl.contactId,
    contactName: hl.contactName || [hl.contactFirst, hl.contactLast].filter(Boolean).join(" ").trim() || "",
  };
}

// Shared with the drill-down sheet (SalesPageDrillDown.tsx) — see
// sales-pages-shared.ts for PageRow/KnownViewer/AlertEmail + fmtDwell/
// pageMineRank/initials.

interface SavedList {
  id: string;
  name: string;
  accountIds: number[];
}

const LISTS_STORAGE_KEY = "microsites_saved_lists";

function loadSavedLists(): SavedList[] {
  try { return JSON.parse(localStorage.getItem(LISTS_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function persistSavedLists(lists: SavedList[]): void {
  localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists));
}

interface Account {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  title?: string | null;
}

interface GeneratedLink {
  contactName: string;
  token: string;
}

function PageStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status}>{status === "published" ? "Published" : "Draft"}</StatusBadge>;
}


function MicrositeRowMenu({
  status,
  actionLoading,
  onToggleStatus,
  onDelete,
}: {
  status: string;
  actionLoading: boolean;
  onToggleStatus: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; placement: "bottom" | "top" } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const right = window.innerWidth - r.right;
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - r.bottom;
    if (menuH > 0 && spaceBelow < menuH + 8 && r.top > menuH + 8) {
      setPos({ top: r.top - menuH - 4, right, placement: "top" });
    } else {
      setPos({ top: r.bottom + 4, right, placement: "bottom" });
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const raf = requestAnimationFrame(updatePos);
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    const onDown = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, confirming, updatePos, close]);

  return (
    <>
      <Button
        ref={btnRef}
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground"
        onClick={() => setOpen(o => !o)}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </Button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-[100] w-40 rounded-lg border border-border bg-card shadow-lg py-1"
        >
          <button
            onClick={() => { onToggleStatus(); close(); }}
            disabled={actionLoading}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
          >
            {status === "published" ? <><EyeOff className="w-3.5 h-3.5" /> Unpublish</> : <><Eye className="w-3.5 h-3.5" /> Publish</>}
          </button>
          {confirming ? (
            <div className="px-3 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Delete this microsite?</p>
              <div className="flex gap-1.5">
                <button onClick={() => onDelete()} disabled={actionLoading} className="flex-1 text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium">{actionLoading ? "Deleting…" : "Delete"}</button>
                <button onClick={close} className="flex-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}


export default function SalesPages() {
  const [, navigate] = useLocation();
  const { user, domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const tenantHost = user?.tenantHost ?? null;
  const [rows, setRows] = useState<PageRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drillRow, setDrillRow] = useState<PageRow | null>(null);
  const [sortBy, setSortBy] = useState<"mine" | "recent" | "views" | "name" | "status">("mine");
  // "Copy email preview" per-row busy/copied indicators.
  const [previewBusyId, setPreviewBusyId] = useState<number | null>(null);
  const [previewCopiedId, setPreviewCopiedId] = useState<number | null>(null);
  const [alertTogglingId, setAlertTogglingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNewMicrosite, setShowNewMicrosite] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // ── View filter + saved lists ──────────────────────────────────────────────
  const [viewFilter, setViewFilter] = useState<string>("all"); // "all" | "mine" | "list:{id}"
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => loadSavedLists());
  const [buildListMode, setBuildListMode] = useState(false);
  const [buildListSelection, setBuildListSelection] = useState<Set<number>>(new Set());
  const [buildListName, setBuildListName] = useState("");
  const [showListNameInput, setShowListNameInput] = useState(false);

  // ── Clone-for-account modal ────────────────────────────────────────────────
  const [cloneModal, setCloneModal] = useState<{ pageId: number; pageTitle: string } | null>(null);
  const [cloneAccountId, setCloneAccountId] = useState<number | "">("");
  const [cloning, setCloning] = useState(false);
  const [cloneStep, setCloneStep] = useState<"account" | "hotlinks" | "results">("account");
  const [clonePageId, setClonePageId] = useState<number | null>(null);
  const [cloneContacts, setCloneContacts] = useState<Contact[]>([]);
  const [cloneContactsLoading, setCloneContactsLoading] = useState(false);
  const [cloneHlMode, setCloneHlMode] = useState<"all" | "specific">("all");
  const [cloneSelectedIds, setCloneSelectedIds] = useState<Set<number>>(new Set());
  const [cloneGenerating, setCloneGenerating] = useState(false);
  const [cloneGenerated, setCloneGenerated] = useState<GeneratedLink[]>([]);

  function openCloneModal(pageId: number, pageTitle: string) {
    setCloneModal({ pageId, pageTitle });
    setCloneAccountId("");
    setCloning(false);
    setCloneStep("account");
    setClonePageId(null);
    setCloneContacts([]);
    setCloneHlMode("all");
    setCloneSelectedIds(new Set());
    setCloneGenerating(false);
    setCloneGenerated([]);
  }

  async function doClone() {
    if (!cloneModal || !cloneAccountId) return;
    setCloning(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${cloneModal.pageId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: cloneAccountId }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const page = await res.json();
      setClonePageId(page.id);
      // Load contacts for this account so the hotlinks step is ready
      setCloneContactsLoading(true);
      setCloneStep("hotlinks");
      try {
        const cr = await fetch(`${API_BASE}/sales/accounts/${cloneAccountId}/contacts`);
        if (cr.ok) {
          const data = await cr.json();
          setCloneContacts(Array.isArray(data) ? data : data.data ?? []);
        }
      } finally {
        setCloneContactsLoading(false);
      }
    } catch (err) {
      console.error("Clone error:", err);
      setCloning(false);
    }
  }

  function toggleCloneContact(id: number) {
    setCloneSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function doCloneHotlinks() {
    if (!clonePageId || !cloneAccountId) return;
    setCloneGenerating(true);
    try {
      const contactsWithEmail = cloneContacts.filter(c => c.email);
      const body: Record<string, unknown> = { accountId: cloneAccountId, pageId: clonePageId };
      if (cloneHlMode === "specific") {
        body.contactIds = contactsWithEmail.filter(c => cloneSelectedIds.has(c.id)).map(c => c.id);
      }
      const res = await fetch(`${API_BASE}/sales/hotlinks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to generate hotlinks");
      const created = await res.json() as Array<{ token: string; contactId: number }>;
      const contactMap = new Map(cloneContacts.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
      setCloneGenerated(created.map(h => ({ contactName: contactMap.get(h.contactId) ?? "Contact", token: h.token })));
      setCloneStep("results");
      load();
    } catch (err) {
      console.error("Clone hotlinks error:", err);
    } finally {
      setCloneGenerating(false);
    }
  }

  // ── Generate-hotlinks modal ────────────────────────────────────────────────
  const [hotlinksModal, setHotlinksModal] = useState<{ pageId: number; pageTitle: string } | null>(null);
  const [hlAccountId, setHlAccountId] = useState<number | "">("");
  const [hlContacts, setHlContacts] = useState<Contact[]>([]);
  const [hlContactsLoading, setHlContactsLoading] = useState(false);
  const [hlGenerating, setHlGenerating] = useState(false);
  const [hlGenerated, setHlGenerated] = useState<GeneratedLink[]>([]);
  const [hlCopied, setHlCopied] = useState<string | null>(null);
  const [hlSelectedIds, setHlSelectedIds] = useState<Set<number>>(new Set());
  const [hlContactSearch, setHlContactSearch] = useState("");

  // ── Manage-hotlinks (delete) modal ─────────────────────────────────────────
  const [manageLinksModal, setManageLinksModal] = useState<{ pageId: number; pageTitle: string; hotlinks: HotlinkEntry[] } | null>(null);
  const [manageSelectedIds, setManageSelectedIds] = useState<Set<number>>(new Set());
  const [manageDeleting, setManageDeleting] = useState(false);
  const [manageConfirmAll, setManageConfirmAll] = useState(false);

  function openManageLinks(pageId: number, pageTitle: string, hotlinks: HotlinkEntry[]) {
    setManageLinksModal({ pageId, pageTitle, hotlinks });
    setManageSelectedIds(new Set());
    setManageConfirmAll(false);
  }

  async function doDeleteHotlinks() {
    if (!manageLinksModal || manageSelectedIds.size === 0) return;
    setManageDeleting(true);
    try {
      await fetch(`${API_BASE}/sales/hotlinks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(manageSelectedIds) }),
      });
      load();
      setManageLinksModal(prev => prev ? {
        ...prev,
        hotlinks: prev.hotlinks.filter(hl => !manageSelectedIds.has(hl.hotlinkId)),
      } : null);
      setManageSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete hotlinks:", err);
    } finally {
      setManageDeleting(false);
    }
  }

  async function doDeleteAllHotlinks() {
    if (!manageLinksModal) return;
    setManageDeleting(true);
    try {
      await fetch(`${API_BASE}/sales/hotlinks/page/${manageLinksModal.pageId}`, {
        method: "DELETE",
      });
      load();
      setManageLinksModal(null);
    } catch (err) {
      console.error("Failed to delete all hotlinks:", err);
    } finally {
      setManageDeleting(false);
      setManageConfirmAll(false);
    }
  }

  function openHotlinksModal(pageId: number, pageTitle: string) {
    setHotlinksModal({ pageId, pageTitle });
    setHlAccountId("");
    setHlContacts([]);
    setHlGenerating(false);
    setHlGenerated([]);
    setHlCopied(null);
    setHlSelectedIds(new Set());
    setHlContactSearch("");
    setAlertInput("");
    if (!alertEmails.has(pageId)) loadAlertEmails(pageId);
  }

  async function loadContacts(accountId: number) {
    setHlContactsLoading(true);
    setHlContacts([]);
    setHlSelectedIds(new Set());
    setHlContactSearch("");
    try {
      const res = await fetch(`${API_BASE}/sales/accounts/${accountId}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setHlContacts(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setHlContactsLoading(false);
    }
  }

  async function doGenerateHotlinks() {
    if (!hotlinksModal || !hlAccountId) return;
    setHlGenerating(true);
    try {
      const selectedArr = hlSelectedIds.size > 0 ? Array.from(hlSelectedIds) : undefined;
      const res = await fetch(`${API_BASE}/sales/hotlinks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: hlAccountId,
          pageId: hotlinksModal.pageId,
          ...(selectedArr ? { contactIds: selectedArr } : {}),
        }),
      });
      if (!res.ok) throw new Error("Bulk hotlinks failed");
      const created = await res.json() as Array<{ token: string; contactId: number }>;
      const contactMap = new Map(hlContacts.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
      setHlGenerated(created.map(h => ({ contactName: contactMap.get(h.contactId) ?? "Contact", token: h.token })));
      load();
    } catch (err) {
      console.error("Generate hotlinks error:", err);
    } finally {
      setHlGenerating(false);
    }
  }

  // ── Visit alert subscriptions ────────────────────────────────────────────────
  const [alertEmails, setAlertEmails] = useState<Map<number, AlertEmail[]>>(new Map());
  const [alertInput, setAlertInput] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertPageId, setAlertPageId] = useState<number | null>(null);

  async function loadAlertEmails(pageId: number) {
    try {
      const res = await fetch(`${API_BASE}/lp/page-alert-emails?pageId=${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setAlertEmails(prev => new Map(prev).set(pageId, data));
      }
    } catch { /* noop */ }
  }

  async function addAlertEmail(pageId: number, email: string) {
    if (!email.trim()) return;
    setAlertSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lp/page-alert-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, email: email.trim() }),
      });
      if (res.ok) {
        setAlertInput("");
        await loadAlertEmails(pageId);
      }
    } catch (err) {
      console.error("Failed to add alert email:", err);
    } finally {
      setAlertSaving(false);
    }
  }

  async function removeAlertEmail(alertId: number, pageId: number) {
    try {
      await fetch(`${API_BASE}/lp/page-alert-emails/${alertId}`, { method: "DELETE" });
      await loadAlertEmails(pageId);
    } catch (err) {
      console.error("Failed to remove alert email:", err);
    }
  }

  function copyHlLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/p/${token}`).then(() => {
      setHlCopied(token);
      setTimeout(() => setHlCopied(null), 2000);
    });
  }

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/sales/pages/overview`).then(r => r.ok ? r.json() : { pages: [] }),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ov, accts]: [{ pages: any[] }, Account[]]) => {
        const normalized: PageRow[] = (ov.pages ?? []).map((p: any) => ({
          ...p,
          hotlinks: (p.hotlinks ?? []).map(normalizeHotlink),
        }));
        setRows(normalized);
        setAccounts(accts);
        // Pre-load alert subscriptions for all pages so the bell shows correct state
        normalized.forEach(p => loadAlertEmails(p.pageId));
      })
      .catch((err) => console.error("Failed to load pages overview:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  // ── One-click visit-alert bell + email-preview copy ────────────────────────
  const myEmail = (user?.email ?? "").trim().toLowerCase();

  function mySubscription(pageId: number) {
    return (alertEmails.get(pageId) ?? []).find(ae => ae.email.toLowerCase() === myEmail);
  }

  /** Bell click = subscribe/unsubscribe MY email for this page's visit alerts.
   *  The expanded row keeps the full manage panel (teammates, any address). */
  async function toggleMyAlert(pageId: number) {
    if (!myEmail || alertTogglingId !== null) return;
    setAlertTogglingId(pageId);
    try {
      const mine = mySubscription(pageId);
      if (mine) await removeAlertEmail(mine.id, pageId);
      else await addAlertEmail(pageId, myEmail);
    } finally {
      setAlertTogglingId(null);
    }
  }

  /** Rich image+link clipboard snippet (Userled-style email embed). Links to
   *  the first hotlink when one exists (attributed visit), else the page URL. */
  async function handleCopyEmailPreview(row: PageRow) {
    if (previewBusyId !== null) return;
    setPreviewBusyId(row.pageId);
    try {
      const firstToken = row.hotlinks[0]?.token;
      const pageUrl = firstToken
        ? `${window.location.origin}/p/${firstToken}`
        : getLpPageUrl(row.pageSlug, micrositeDomain, tenantHost);
      const result = await copyEmailPreview({ pageId: row.pageId, pageUrl, title: row.pageTitle });
      setPreviewCopiedId(row.pageId);
      setTimeout(() => setPreviewCopiedId(null), 2500);
      if (result === "link-only") {
        toast({
          title: "Copied the link instead",
          description: "Couldn't build the image preview, so the plain link is on your clipboard.",
        });
      }
    } finally {
      setPreviewBusyId(null);
    }
  }

  async function togglePageStatus(pageId: number, currentStatus: string) {
    setActionLoading(true);
    try {
      const newStatus = currentStatus === "published" ? "draft" : "published";
      await fetch(`${API_BASE}/lp/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      load();
    } catch (err) {
      console.error("Failed to update page status:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function deletePage(pageId: number) {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/lp/pages/${pageId}`, { method: "DELETE" });
      load();
    } catch (err) {
      console.error("Failed to delete page:", err);
    } finally {
      setActionLoading(false);
    }
  }

  function toggleSelect(pageId: number) {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  function selectAllUnlinked() {
    setSelectedPages(prev => {
      const next = new Set(prev);
      rows.filter(r => r.accountId == null).forEach(r => next.add(r.pageId));
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedPages(new Set());
    setBulkConfirm(false);
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedPages].map(id =>
        fetch(`${API_BASE}/lp/pages/${id}`, { method: "DELETE" })
      ));
      exitSelectMode();
      load();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setBulkDeleting(false);
    }
  }

  // ── Saved list helpers ─────────────────────────────────────────────────────
  function saveNewList() {
    if (!buildListName.trim() || buildListSelection.size === 0) return;
    const newList: SavedList = {
      id: Date.now().toString(),
      name: buildListName.trim(),
      accountIds: [...buildListSelection],
    };
    const updated = [...savedLists, newList];
    setSavedLists(updated);
    persistSavedLists(updated);
    setViewFilter(`list:${newList.id}`);
    setBuildListMode(false);
    setBuildListSelection(new Set());
    setBuildListName("");
    setShowListNameInput(false);
  }

  function deleteList(listId: string) {
    const updated = savedLists.filter(l => l.id !== listId);
    setSavedLists(updated);
    persistSavedLists(updated);
    if (viewFilter === `list:${listId}`) setViewFilter("all");
  }

  function toggleBuildSelection(accountId: number) {
    setBuildListSelection(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function exitBuildListMode() {
    setBuildListMode(false);
    setBuildListSelection(new Set());
    setBuildListName("");
    setShowListNameInput(false);
  }

  // ── Apply view filter then search ─────────────────────────────────────────
  const mineRank = (r: PageRow): 0 | 1 | 2 => pageMineRank(r, myEmail);

  const viewFilteredRows = (() => {
    if (viewFilter === "all") return rows;
    if (viewFilter === "mine") return rows.filter(r => mineRank(r) < 2);
    if (viewFilter.startsWith("list:")) {
      const listId = viewFilter.slice(5);
      const list = savedLists.find(l => l.id === listId);
      if (!list) return rows;
      return rows.filter(r => r.accountId != null && list.accountIds.includes(r.accountId));
    }
    return rows;
  })();

  const q = search.toLowerCase();
  const filteredRows = search
    ? viewFilteredRows.filter(r =>
        r.pageTitle.toLowerCase().includes(q) ||
        (r.accountName ?? "").toLowerCase().includes(q) ||
        r.pageSlug.toLowerCase().includes(q) ||
        r.hotlinks.some(hl => hl.contactName.toLowerCase().includes(q)) ||
        r.knownViewers.some(v => v.name.toLowerCase().includes(q))
      )
    : viewFilteredRows;

  const byRecency = (a: PageRow, b: PageRow) =>
    new Date(b.pageUpdatedAt).getTime() - new Date(a.pageUpdatedAt).getTime();
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortBy === "mine") {
      const rank = mineRank(a) - mineRank(b);
      if (rank !== 0) return rank;
      return byRecency(a, b);
    }
    if (sortBy === "views") return b.views - a.views || byRecency(a, b);
    if (sortBy === "name") return a.pageTitle.localeCompare(b.pageTitle);
    if (sortBy === "status") return a.pageStatus.localeCompare(b.pageStatus) || byRecency(a, b);
    return byRecency(a, b);
  });

  // Distinct accounts present in the table (for the build-list chips).
  const accountsInRows = (() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      if (r.accountId != null && !map.has(r.accountId)) map.set(r.accountId, r.accountName ?? `Account #${r.accountId}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Accounts that don't yet have a microsite
  const accountsWithMicrosites = new Set(rows.filter(r => r.accountId != null).map(r => r.accountId));
  const accountsWithout = accounts.filter(a => !accountsWithMicrosites.has(a.id));

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        <SalesPageHeader
          title="Pages"
          description="Every page with its views, known visitors, and personalized links — yours first"
          back={{ onClick: () => window.history.length > 1 ? window.history.back() : window.location.assign("/sales") }}
          actions={
            <>
              <Button
                size="sm"
                onClick={() => setShowNewMicrosite(true)}
                className="gap-1.5"
                style={{ backgroundColor: "#1B4332", color: "#fff" }}
              >
                <Plus className="w-3.5 h-3.5" />
                New microsite
              </Button>
              <Button
                variant={selectMode ? "default" : "outline"}
                size="sm"
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className="gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {selectMode ? "Cancel" : "Select"}
              </Button>
              <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </>
          }
        />

        {/* View filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* All */}
          <button
            onClick={() => { setViewFilter("all"); exitBuildListMode(); }}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              viewFilter === "all" && !buildListMode
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
            }`}
          >
            All
          </button>

          {/* My Accounts */}
          <button
            onClick={() => { setViewFilter("mine"); exitBuildListMode(); }}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              viewFilter === "mine" && !buildListMode
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
            }`}
          >
            My Pages
          </button>

          {/* Saved lists */}
          {savedLists.map(list => (
            <span key={list.id} className={`inline-flex items-center gap-1 rounded-full text-xs font-medium border transition-colors ${
              viewFilter === `list:${list.id}` && !buildListMode
                ? "bg-foreground text-background border-foreground pl-3 pr-1.5 py-1.5"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40 pl-3 pr-1.5 py-1.5"
            }`}>
              <button onClick={() => { setViewFilter(`list:${list.id}`); exitBuildListMode(); }}>
                {list.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteList(list.id); }}
                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                title="Delete list"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Build new list button */}
          {!buildListMode ? (
            <button
              onClick={() => { setBuildListMode(true); exitSelectMode(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground border border-dashed border-border hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New List
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Selecting accounts — click to add/remove
            </span>
          )}
        </div>

        {/* Build list save bar — pick accounts by chip (the table is flat, so
            there are no account headers to click anymore) */}
        {buildListMode && (
          <div className="flex flex-col gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex flex-wrap gap-1.5">
              {accountsInRows.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggleBuildSelection(a.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    buildListSelection.has(a.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {buildListSelection.has(a.id) ? <Check className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                  {a.name}
                </button>
              ))}
              {accountsInRows.length === 0 && (
                <span className="text-xs text-muted-foreground">No account-linked pages yet.</span>
              )}
            </div>
            <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {buildListSelection.size} account{buildListSelection.size !== 1 ? "s" : ""} selected
              </span>
              {buildListSelection.size > 0 && !showListNameInput && (
                <button
                  onClick={() => setShowListNameInput(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Save as list →
                </button>
              )}
              {showListNameInput && (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={buildListName}
                    onChange={e => setBuildListName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveNewList(); if (e.key === "Escape") setShowListNameInput(false); }}
                    placeholder="List name…"
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background outline-none focus:ring-1 focus:ring-ring w-40"
                  />
                  <Button size="sm" className="h-7 px-3 text-xs" onClick={saveNewList} disabled={!buildListName.trim() || buildListSelection.size === 0}>
                    Save
                  </Button>
                </div>
              )}
            </div>
            <button onClick={exitBuildListMode} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            </div>
          </div>
        )}

        {/* PageHint banner */}
        <PageHint
          id="sales-microsites"
          title="Your pages, who's viewing them, and their links"
          description="Every page with views, known visitors, and time on page — your pages sort to the top. Click a row for links, viewers, and alerts."
          tips={[
            "The bell subscribes YOU to visit alerts for that page in one click.",
            "The envelope copies an email preview — a screenshot that pastes into Gmail and clicks through to the page.",
            "Avg time starts counting from today; older visits show —.",
          ]}
          color="blue"
          icon={Globe}
        />

        {/* Bulk action bar */}
        {selectMode && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {selectedPages.size} selected
              </span>
              {rows.some(r => r.accountId == null) && (
                <button
                  onClick={selectAllUnlinked}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Select all unlinked
                </button>
              )}
              {selectedPages.size > 0 && (
                <button
                  onClick={() => setSelectedPages(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            {selectedPages.size > 0 && (
              <div className="flex items-center gap-2">
                {bulkConfirm ? (
                  <>
                    <span className="text-xs text-destructive font-medium">Delete {selectedPages.size} microsite{selectedPages.size !== 1 ? "s" : ""}?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-3 text-xs"
                      onClick={bulkDelete}
                      disabled={bulkDeleting}
                    >
                      {bulkDeleting ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-xs"
                      onClick={() => setBulkConfirm(false)}
                      disabled={bulkDeleting}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={() => setBulkConfirm(true)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete {selectedPages.size}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        {rows.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts, pages, or contacts…"
              className="pl-10"
            />
          </div>
        )}

        {/* Create for an account */}
        {!loading && accountsWithout.length > 0 && (
          <Card className="p-4 rounded-lg border border-dashed border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Create a microsite for an account</p>
                <p className="text-xs text-muted-foreground">
                  Go to the account, then tap "Generate Microsite" to create a personalized page.
                </p>
              </div>
              {accountsWithout.length <= 6 ? (
                <div className="flex flex-wrap gap-2">
                  {accountsWithout.slice(0, 5).map(a => (
                    <Link key={a.id} href={`/sales/accounts/${a.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Building2 className="w-3 h-3" />
                        {a.name}
                      </Button>
                    </Link>
                  ))}
                  {accountsWithout.length > 5 && (
                    <Link href="/sales/accounts">
                      <Button variant="outline" size="sm" className="text-xs text-muted-foreground">
                        +{accountsWithout.length - 5} more
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <Link href="/sales/accounts">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    View accounts
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* ── Pages table ──────────────────────────────────────────────────
            Flat, analytics-first: one row per page, the rep's own pages
            sorted to the top. Row expands for hotlinks + alert management. */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : sortedRows.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 border border-dashed border-border rounded-lg text-center">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
              <Layout className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No pages yet</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs mb-5">
              Go to an account and tap "Generate Microsite" to create a personalized page with unique links for every contact.
            </p>
            <Link href="/sales/accounts">
              <Button size="sm" className="gap-2 rounded-md">
                <Building2 className="w-3.5 h-3.5" />
                Go to Accounts
              </Button>
            </Link>
          </div>
        ) : sortedRows.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center py-12 px-8 border border-dashed border-border rounded-lg text-center">
            <Search className="w-5 h-5 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium text-foreground mb-1">No results for "{search}"</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs">Try a different search term or clear the search.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {sortedRows.length < rows.length ? `${sortedRows.length} of ${rows.length}` : rows.length} page{sortedRows.length !== 1 ? "s" : ""}
                <span className="normal-case tracking-normal font-normal"> · stats last 30 days</span>
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs appearance-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                >
                  <option value="mine">My pages first</option>
                  <option value="recent">Most recent</option>
                  <option value="views">Most viewed</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            <Card className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Page</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Views</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Viewers</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Avg time</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last visit</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Links</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map(row => {
                      const rank = mineRank(row);
                      const mineSubbed = !!mySubscription(row.pageId);
                      const firstToken = row.hotlinks[0]?.token;
                      const copyKey = firstToken ?? `page:${row.pageId}`;
                      return (
                        <Fragment key={row.pageId}>
                          <tr
                            className={`border-b border-border/50 last:border-b-0 hover:bg-muted/40 transition-colors cursor-pointer ${
                              selectMode && selectedPages.has(row.pageId) ? "bg-primary/5" : ""
                            }`}
                            onClick={() => setDrillRow(row)}
                          >
                            {/* Page */}
                            <td className="px-4 py-3 max-w-[340px]">
                              <div className="flex items-start gap-2.5">
                                {selectMode ? (
                                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(row.pageId); }} className="text-primary pt-0.5">
                                    {selectedPages.has(row.pageId) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                                  </button>
                                ) : (
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${row.pageStatus === "published" ? "bg-[hsl(var(--accent-warm))]" : "bg-amber-400"}`} title={row.pageStatus} />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link href={`/builder/${row.pageId}`} onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[13px] font-medium text-foreground hover:underline cursor-pointer leading-snug truncate">{row.pageTitle}</span>
                                    </Link>
                                    {rank === 0 && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-primary/10 text-primary shrink-0">Yours</span>}
                                    {rank === 1 && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-muted text-muted-foreground shrink-0">Edited by you</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                                    {row.accountName ? (
                                      <Link href={`/sales/accounts/${row.accountId}`} onClick={(e) => e.stopPropagation()}>
                                        <span className="hover:text-foreground transition-colors flex items-center gap-1 truncate"><Building2 className="w-3 h-3 shrink-0" />{row.accountName}</span>
                                      </Link>
                                    ) : (
                                      <span className="text-muted-foreground/60">General</span>
                                    )}
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="font-mono truncate">/{row.pageSlug}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {/* Views */}
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <span className="text-[13px] font-semibold text-foreground tabular-nums">{row.views}</span>
                              {row.views > 0 && <span className="block text-[11px] text-muted-foreground tabular-nums">{row.uniques} unique</span>}
                            </td>
                            {/* Known viewers */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              {row.knownViewerCount === 0 ? (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              ) : (
                                <div className="flex items-center">
                                  <div className="flex -space-x-1.5">
                                    {row.knownViewers.slice(0, 4).map(v => (
                                      <div
                                        key={v.contactId}
                                        className="w-6 h-6 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center text-[9px] font-bold text-primary"
                                        title={`${v.name} — ${v.views} view${v.views !== 1 ? "s" : ""}`}
                                      >
                                        {initials(v.name)}
                                      </div>
                                    ))}
                                  </div>
                                  {row.knownViewerCount > 4 && (
                                    <span className="ml-1.5 text-[11px] text-muted-foreground">+{row.knownViewerCount - 4}</span>
                                  )}
                                </div>
                              )}
                            </td>
                            {/* Avg time */}
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <span className={`text-[13px] tabular-nums ${row.avgDwellSeconds != null ? "text-foreground" : "text-muted-foreground/50"}`}>
                                {fmtDwell(row.avgDwellSeconds)}
                              </span>
                            </td>
                            {/* Last visit */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="text-xs text-muted-foreground">
                                {row.lastVisitAt ? `${formatDistanceToNowStrict(new Date(row.lastVisitAt))} ago` : "—"}
                              </span>
                            </td>
                            {/* Links */}
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Link2 className="w-3 h-3" />
                                {row.hotlinks.length}
                                <button
                                  onClick={(e) => { e.stopPropagation(); openHotlinksModal(row.pageId, row.pageTitle); }}
                                  className="ml-0.5 p-0.5 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Create personalized links"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-7 w-7 rounded-md ${mineSubbed ? "text-primary" : "text-muted-foreground/40 hover:text-foreground"}`}
                                  title={mineSubbed ? "You get visit alerts for this page — click to unsubscribe" : "Alert me when someone views this page"}
                                  disabled={alertTogglingId === row.pageId || !myEmail}
                                  onClick={() => toggleMyAlert(row.pageId)}
                                >
                                  {alertTogglingId === row.pageId
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : mineSubbed ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground"
                                  title={firstToken ? "Copy the first personalized link" : "Copy the page link"}
                                  onClick={() => {
                                    if (firstToken) copyLink(firstToken);
                                    else {
                                      navigator.clipboard.writeText(getLpPageUrl(row.pageSlug, micrositeDomain, tenantHost)).then(() => {
                                        setCopiedToken(copyKey);
                                        setTimeout(() => setCopiedToken(null), 2000);
                                      });
                                    }
                                  }}
                                >
                                  {copiedToken === copyKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground"
                                  title="Copy email preview — a linked screenshot that pastes into an email"
                                  disabled={previewBusyId === row.pageId}
                                  onClick={() => void handleCopyEmailPreview(row)}
                                >
                                  {previewBusyId === row.pageId
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : previewCopiedId === row.pageId
                                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      : <Mail className="w-3.5 h-3.5" />}
                                </Button>
                                <a href={getLpPageUrl(row.pageSlug, micrositeDomain, tenantHost)} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground" title="Open page">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </a>
                                <MicrositeRowMenu
                                  status={row.pageStatus}
                                  actionLoading={actionLoading}
                                  onToggleStatus={() => togglePageStatus(row.pageId, row.pageStatus)}
                                  onDelete={() => deletePage(row.pageId)}
                                />
                                <button
                                  onClick={() => setDrillRow(row)}
                                  className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
                                  title="Analytics, viewers, links & alerts"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── Clone for account modal ──────────────────────────────────────── */}
      <Dialog open={!!cloneModal} onOpenChange={open => { if (!open) setCloneModal(null); }}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {cloneStep === "account" ? "Clone for an account" : cloneStep === "hotlinks" ? "Generate personalized links" : "Links generated"}
            </DialogTitle>
            <DialogDescription>
              {cloneStep === "account"
                ? <>Creates a copy of <span className="font-medium text-foreground">"{cloneModal?.pageTitle}"</span> linked to the selected account. You can customize it in the builder — it'll appear under the account in the microsites tab.</>
                : cloneStep === "hotlinks"
                  ? "Optionally create unique tracked links for contacts at this account. You can skip this and do it later."
                  : `${cloneGenerated.length} personalized link${cloneGenerated.length !== 1 ? "s" : ""} created.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2 overflow-y-auto flex-1 min-h-0 pr-0.5">

            {/* ── Step 1: Pick account ── */}
            {cloneStep === "account" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select account</label>
                  <AccountCombobox
                    accounts={accounts}
                    value={cloneAccountId}
                    onChange={v => setCloneAccountId(v ? Number(v) : "")}
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={!cloneAccountId || cloning} onClick={doClone}>
                    {cloning ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Cloning…</> : "Clone page"}
                  </Button>
                  <Button variant="outline" onClick={() => setCloneModal(null)}>Cancel</Button>
                </div>
              </>
            )}

            {/* ── Step 2: Hotlinks ── */}
            {cloneStep === "hotlinks" && (
              <>
                {/* Mode selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Who gets a personalized link?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloneHlMode("all")}
                      className={[
                        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
                        cloneHlMode === "all" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/40",
                      ].join(" ")}
                    >
                      <span className="text-sm font-medium">All contacts</span>
                      <span className="text-xs text-muted-foreground">Every contact with an email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCloneHlMode("specific"); setCloneSelectedIds(new Set()); }}
                      className={[
                        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
                        cloneHlMode === "specific" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/40",
                      ].join(" ")}
                    >
                      <span className="text-sm font-medium">Specific contacts</span>
                      <span className="text-xs text-muted-foreground">Choose who to include</span>
                    </button>
                  </div>
                </div>

                {/* Contact list */}
                <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {cloneContactsLoading ? "Loading contacts…" : `${cloneContacts.filter(c => c.email).length} contacts with email`}
                    </span>
                    {cloneHlMode === "specific" && !cloneContactsLoading && cloneContacts.filter(c => c.email).length > 0 && (
                      <button
                        onClick={() => {
                          const ids = cloneContacts.filter(c => c.email).map(c => c.id);
                          setCloneSelectedIds(prev => prev.size === ids.length ? new Set() : new Set(ids));
                        }}
                        className="ml-auto text-[11px] text-primary hover:underline"
                      >
                        {cloneSelectedIds.size === cloneContacts.filter(c => c.email).length ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>
                  {cloneContactsLoading ? (
                    <div className="p-3 flex flex-col gap-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full rounded" />)}
                    </div>
                  ) : cloneContacts.filter(c => c.email).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3">No contacts with an email address found for this account.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                      {cloneContacts.filter(c => c.email).map(c => (
                        <div
                          key={c.id}
                          className={["flex items-center gap-2 px-3 py-2", cloneHlMode === "specific" ? "cursor-pointer hover:bg-muted/40" : ""].join(" ")}
                          onClick={() => cloneHlMode === "specific" && toggleCloneContact(c.id)}
                        >
                          {cloneHlMode === "specific" && (
                            <div className={["w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors", cloneSelectedIds.has(c.id) ? "bg-primary border-primary" : "border-border"].join(" ")}>
                              {cloneSelectedIds.has(c.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          )}
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                            {initials([c.firstName, c.lastName].filter(Boolean).join(" "))}
                          </div>
                          <span className="text-xs text-foreground flex-1 truncate">{c.firstName} {c.lastName}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={cloneContactsLoading || cloneGenerating || cloneContacts.filter(c => c.email).length === 0 || (cloneHlMode === "specific" && cloneSelectedIds.size === 0)}
                    onClick={doCloneHotlinks}
                  >
                    {cloneGenerating
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
                      : cloneHlMode === "all"
                        ? `Generate links for all ${cloneContacts.filter(c => c.email).length} contacts`
                        : `Generate links for ${cloneSelectedIds.size} contact${cloneSelectedIds.size !== 1 ? "s" : ""}`
                    }
                  </Button>
                  <Button variant="outline" onClick={() => { if (clonePageId) { setCloneModal(null); navigate(`/builder/${clonePageId}`); } }}>
                    Skip
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 3: Results ── */}
            {cloneStep === "results" && (
              <>
                <div className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-green-200 dark:border-green-800/40">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">{cloneGenerated.length} link{cloneGenerated.length !== 1 ? "s" : ""} generated</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-green-100 dark:divide-green-900/40">
                    {cloneGenerated.map(hl => (
                      <div key={hl.token} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs text-foreground flex-1 truncate">{hl.contactName}</span>
                        <button
                          onClick={() => copyHlLink(hl.token)}
                          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors shrink-0"
                        >
                          {hlCopied === hl.token
                            ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied</span></>
                            : <><Copy className="w-3 h-3" /><span>Copy</span></>
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {clonePageId && (
                    <Button className="flex-1 gap-1.5" onClick={() => { setCloneModal(null); navigate(`/builder/${clonePageId}`); }}>
                      <ExternalLink className="w-3.5 h-3.5" /> Open in Builder
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => setCloneModal(null)}>Done</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Generate hotlinks modal ──────────────────────────────────────── */}
      <Dialog open={!!hotlinksModal} onOpenChange={open => { if (!open) setHotlinksModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Generate personalized links
            </DialogTitle>
            <DialogDescription>
              Creates a unique tracked link for each contact at the selected account, pointing to <span className="font-medium text-foreground">"{hotlinksModal?.pageTitle}"</span>. No changes are made to the page — share the links in emails to track individual engagement.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select account</label>
              <AccountCombobox
                accounts={accounts}
                value={hlAccountId}
                onChange={v => {
                  const id = v ? Number(v) : "";
                  setHlAccountId(id);
                  setHlGenerated([]);
                  if (id) loadContacts(id);
                  else setHlContacts([]);
                }}
              />
            </div>

            {/* Contact selection */}
            {hlAccountId !== "" && (() => {
              const emailContacts = hlContacts.filter(c => c.email);
              const filtered = emailContacts.filter(c => {
                if (!hlContactSearch.trim()) return true;
                const q = hlContactSearch.toLowerCase();
                return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
              });
              const allSelected = emailContacts.length > 0 && emailContacts.every(c => hlSelectedIds.has(c.id));
              const someSelected = hlSelectedIds.size > 0;
              return (
                <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                  {/* Header with select-all and count */}
                  <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
                    {!hlContactsLoading && emailContacts.length > 0 && (
                      <button
                        onClick={() => {
                          if (allSelected) setHlSelectedIds(new Set());
                          else setHlSelectedIds(new Set(emailContacts.map(c => c.id)));
                        }}
                        className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                        title={allSelected ? "Deselect all" : "Select all"}
                      >
                        {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground flex-1">
                      {hlContactsLoading
                        ? "Loading contacts…"
                        : someSelected
                          ? `${hlSelectedIds.size} of ${emailContacts.length} selected`
                          : `${emailContacts.length} contacts — select to generate links for specific people, or leave blank for all`}
                    </span>
                  </div>

                  {/* Search */}
                  {!hlContactsLoading && emailContacts.length > 5 && (
                    <div className="px-3 py-2 border-b border-border/50">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={hlContactSearch}
                          onChange={e => setHlContactSearch(e.target.value)}
                          placeholder="Search contacts…"
                          className="w-full pl-6 pr-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        {hlContactSearch && (
                          <button onClick={() => setHlContactSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {hlContactsLoading ? (
                    <div className="p-3 flex flex-col gap-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full rounded" />)}
                    </div>
                  ) : emailContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3">No contacts with an email address found. Add contacts first.</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3">No contacts match your search.</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto divide-y divide-border/40">
                      {filtered.map(c => {
                        const selected = hlSelectedIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setHlSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                return next;
                              });
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/60"}`}
                          >
                            {selected
                              ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {initials([c.firstName, c.lastName].filter(Boolean).join(" "))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-foreground truncate">{c.firstName} {c.lastName}</div>
                              {c.title && <div className="text-[10px] text-muted-foreground truncate">{c.title}</div>}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{c.email}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Generated links */}
            {hlGenerated.length > 0 && (
              <div className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-green-200 dark:border-green-800/40">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">{hlGenerated.length} link{hlGenerated.length !== 1 ? "s" : ""} generated</p>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-green-100 dark:divide-green-900/40">
                  {hlGenerated.map(hl => (
                    <div key={hl.token} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-xs text-foreground flex-1 truncate">{hl.contactName}</span>
                      <button
                        onClick={() => copyHlLink(hl.token)}
                        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {hlCopied === hl.token
                          ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied</span></>
                          : <><Copy className="w-3 h-3" /><span>Copy</span></>
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alert subscription — appears after generating links */}
            {hlGenerated.length > 0 && hotlinksModal && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-amber-200/60 dark:border-amber-800/30 flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Get notified when they visit</span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-amber-700/70 dark:text-amber-300/60 mb-2">Add your email to get an alert every time a contact views this page.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={alertInput}
                      onChange={e => setAlertInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && hotlinksModal) addAlertEmail(hotlinksModal.pageId, alertInput); }}
                      placeholder="your@email.com"
                      className="flex-1 text-[12px] px-2.5 py-1.5 rounded-md border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-amber-950/30 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-amber-400/50"
                    />
                    <Button
                      size="sm"
                      className="h-7 px-3 text-[11px] bg-amber-500 hover:bg-amber-600 text-white rounded-md"
                      disabled={!alertInput.trim() || alertSaving}
                      onClick={() => { if (hotlinksModal) addAlertEmail(hotlinksModal.pageId, alertInput); }}
                    >
                      {alertSaving ? "…" : "Subscribe"}
                    </Button>
                  </div>
                  {(alertEmails.get(hotlinksModal.pageId) ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(alertEmails.get(hotlinksModal.pageId) ?? []).map(ae => (
                        <span key={ae.id} className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 px-1.5 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5" /> {ae.email}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {hlGenerated.length > 0 ? (
                <Button variant="outline" className="flex-1" onClick={() => setHotlinksModal(null)}>Done</Button>
              ) : (
                <>
                  <Button
                    className="flex-1"
                    disabled={!hlAccountId || hlContactsLoading || hlContacts.filter(c => c.email).length === 0 || hlGenerating}
                    onClick={doGenerateHotlinks}
                  >
                    {hlGenerating
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
                      : hlSelectedIds.size > 0
                        ? `Generate ${hlSelectedIds.size} link${hlSelectedIds.size !== 1 ? "s" : ""}`
                        : "Generate links for all contacts"}
                  </Button>
                  <Button variant="outline" onClick={() => setHotlinksModal(null)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manage Links (bulk delete) Dialog ─────────────────────────────── */}
      <Dialog open={!!manageLinksModal} onOpenChange={open => { if (!open) { setManageLinksModal(null); setManageConfirmAll(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage links</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{manageLinksModal?.hotlinks.length ?? 0} link{(manageLinksModal?.hotlinks.length ?? 0) !== 1 ? "s" : ""}</span> for "{manageLinksModal?.pageTitle}". Deleted links become permanently inactive.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-1">
            {manageLinksModal && manageLinksModal.hotlinks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All links have been removed.</p>
            ) : (
              <>
                {/* Delete-all shortcut */}
                {manageConfirmAll ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex flex-col gap-2">
                    <p className="text-sm font-medium text-destructive">
                      Remove all {manageLinksModal?.hotlinks.length} links?
                    </p>
                    <p className="text-xs text-muted-foreground">Every personalized link for this page will be deactivated. This can't be undone.</p>
                    <div className="flex gap-2 pt-1">
                      <Button variant="destructive" size="sm" className="flex-1" disabled={manageDeleting} onClick={doDeleteAllHotlinks}>
                        {manageDeleting ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Removing…</> : `Yes, remove all ${manageLinksModal?.hotlinks.length}`}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setManageConfirmAll(false)} disabled={manageDeleting}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-muted/60 px-3 py-2.5 transition-colors flex items-center justify-between group"
                    onClick={() => setManageConfirmAll(true)}
                  >
                    <span className="text-sm font-medium text-destructive">Remove all {manageLinksModal?.hotlinks.length} links at once</span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Fastest option →</span>
                  </button>
                )}

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">or select individually</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Select-all row */}
                <div className="flex items-center justify-between px-1">
                  <button
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      if (!manageLinksModal) return;
                      if (manageSelectedIds.size === manageLinksModal.hotlinks.length) {
                        setManageSelectedIds(new Set());
                      } else {
                        setManageSelectedIds(new Set(manageLinksModal.hotlinks.map(h => h.hotlinkId)));
                      }
                    }}
                  >
                    {manageLinksModal && manageSelectedIds.size === manageLinksModal.hotlinks.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                  {manageSelectedIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">{manageSelectedIds.size} selected</span>
                  )}
                </div>

                {/* Link list */}
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/60 max-h-52 overflow-y-auto">
                  {manageLinksModal?.hotlinks.map(hl => {
                    const selected = manageSelectedIds.has(hl.hotlinkId);
                    return (
                      <button
                        key={hl.hotlinkId}
                        onClick={() => setManageSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(hl.hotlinkId)) next.delete(hl.hotlinkId); else next.add(hl.hotlinkId);
                          return next;
                        })}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${selected ? "bg-destructive/5" : "hover:bg-muted/50"}`}
                      >
                        {selected
                          ? <CheckSquare className="w-3.5 h-3.5 text-destructive shrink-0" />
                          : <Square className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                          {initials(hl.contactName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate font-medium">{hl.contactName || <span className="text-muted-foreground italic font-normal">Unknown contact</span>}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">…{hl.token.slice(-8)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {manageLinksModal && manageLinksModal.hotlinks.length > 0 && manageSelectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={manageDeleting}
                  onClick={doDeleteHotlinks}
                >
                  {manageDeleting
                    ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Deleting…</>
                    : `Delete ${manageSelectedIds.size} link${manageSelectedIds.size !== 1 ? "s" : ""}`}
                </Button>
              )}
              <Button variant="outline" className={manageLinksModal?.hotlinks.length === 0 || manageSelectedIds.size === 0 ? "flex-1" : ""} onClick={() => { setManageLinksModal(null); setManageConfirmAll(false); }}>
                {manageLinksModal?.hotlinks.length === 0 ? "Close" : "Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <GenerateMicrositeModal open={showNewMicrosite} onClose={() => { setShowNewMicrosite(false); load(); }} onCreated={load} />

      {/* ── Per-page drill-down (row click) ─────────────────────────────── */}
      <SalesPageDrillDown
        row={drillRow}
        windowDays={30}
        myEmail={myEmail}
        micrositeDomain={micrositeDomain}
        tenantHost={tenantHost}
        alertEmails={drillRow ? alertEmails.get(drillRow.pageId) ?? [] : []}
        alertSaving={alertSaving}
        onAddAlert={addAlertEmail}
        onRemoveAlert={removeAlertEmail}
        onCreateLinks={(pageId, pageTitle) => openHotlinksModal(pageId, pageTitle)}
        onManageLinks={(row) => openManageLinks(row.pageId, row.pageTitle, row.hotlinks)}
        onClose={() => setDrillRow(null)}
      />
    </SalesLayout>
  );
}
