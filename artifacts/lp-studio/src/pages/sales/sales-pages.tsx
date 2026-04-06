import { useState, useEffect, useCallback } from "react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHint } from "@/components/ui/page-hint";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface HotlinkEntryRaw {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName?: string;
  contactFirst?: string;
  contactLast?: string;
}

interface HotlinkEntry {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName: string;
}

function normalizeHotlink(hl: HotlinkEntryRaw): HotlinkEntry {
  return {
    hotlinkId: hl.hotlinkId,
    token: hl.token,
    contactId: hl.contactId,
    contactName: hl.contactName || [hl.contactFirst, hl.contactLast].filter(Boolean).join(" ").trim() || "",
  };
}

interface PageEntry {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  pageStatus: string;
  pageUpdatedAt: string;
  hotlinks: HotlinkEntry[];
}

interface AccountEntry {
  accountId: number;
  accountName: string;
  accountOwner: string | null;
  pages: PageEntry[];
}

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
}

interface GeneratedLink {
  contactName: string;
  token: string;
}

function PageStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status}>{status === "published" ? "Published" : "Draft"}</StatusBadge>;
}

function initials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}


export default function SalesPages() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [overview, setOverview] = useState<AccountEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "name" | "status">("recent");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
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

  function openHotlinksModal(pageId: number, pageTitle: string) {
    setHotlinksModal({ pageId, pageTitle });
    setHlAccountId("");
    setHlContacts([]);
    setHlGenerating(false);
    setHlGenerated([]);
    setHlCopied(null);
    setAlertInput("");
    if (!alertEmails.has(pageId)) loadAlertEmails(pageId);
  }

  async function loadContacts(accountId: number) {
    setHlContactsLoading(true);
    setHlContacts([]);
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
      const res = await fetch(`${API_BASE}/sales/hotlinks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: hlAccountId, pageId: hotlinksModal.pageId }),
      });
      if (!res.ok) throw new Error("Bulk hotlinks failed");
      const created = await res.json() as Array<{ token: string; contactId: number }>;
      // Map contact IDs → names
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
  interface AlertEmail { id: number; email: string }
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

  function openAlertPanel(pageId: number) {
    setAlertPageId(alertPageId === pageId ? null : pageId);
    setAlertInput("");
    if (!alertEmails.has(pageId)) loadAlertEmails(pageId);
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
      fetch(`${API_BASE}/sales/microsites/overview`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ov, accts]: [any[], Account[]]) => {
        // Normalize hotlink entries — API may return contactFirst/contactLast or contactName
        const normalized: AccountEntry[] = ov.map((a: any) => ({
          ...a,
          pages: a.pages.map((p: any) => ({
            ...p,
            hotlinks: (p.hotlinks ?? []).map(normalizeHotlink),
          })),
        }));
        setOverview(normalized);
        setAccounts(accts);
        // Pre-load alert subscriptions for all pages so the strip shows correct state
        const allPageIds = normalized.flatMap(a => a.pages.map(p => p.pageId));
        allPageIds.forEach((pid: number) => loadAlertEmails(pid));
      })
      .catch((err) => console.error("Failed to load microsites:", err))
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

  function toggleCollapse(accountId: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
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
      setMenuOpen(null);
    }
  }

  async function deletePage(pageId: number) {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/lp/pages/${pageId}`, { method: "DELETE" });
      setConfirmDelete(null);
      load();
    } catch (err) {
      console.error("Failed to delete page:", err);
    } finally {
      setActionLoading(false);
      setMenuOpen(null);
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
    const unlinked = overview.find(a => a.accountId === -1);
    if (!unlinked) return;
    setSelectedPages(prev => {
      const next = new Set(prev);
      unlinked.pages.forEach(p => next.add(p.pageId));
      return next;
    });
    // Make sure the unlinked group is expanded
    setCollapsed(prev => { const next = new Set(prev); next.delete(-1); return next; });
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
  const viewFilteredOverview = (() => {
    if (viewFilter === "all") return overview;
    if (viewFilter === "mine") {
      const myName = user?.name?.toLowerCase() ?? "";
      return overview.filter(a => a.accountOwner?.toLowerCase() === myName);
    }
    if (viewFilter.startsWith("list:")) {
      const listId = viewFilter.slice(5);
      const list = savedLists.find(l => l.id === listId);
      if (!list) return overview;
      return overview.filter(a => list.accountIds.includes(a.accountId));
    }
    return overview;
  })();

  const q = search.toLowerCase();
  const filteredOverview = search
    ? viewFilteredOverview.filter(acct =>
        acct.accountName.toLowerCase().includes(q) ||
        acct.pages.some(p => p.pageTitle.toLowerCase().includes(q)) ||
        acct.pages.some(p => p.hotlinks.some(hl => hl.contactName.toLowerCase().includes(q)))
      )
    : viewFilteredOverview;

  // Sort pages within each account
  const sortedOverview = filteredOverview.map(acct => ({
    ...acct,
    pages: [...acct.pages].sort((a, b) => {
      if (sortBy === "status") return a.pageStatus.localeCompare(b.pageStatus);
      if (sortBy === "name") return a.pageTitle.localeCompare(b.pageTitle);
      return new Date(b.pageUpdatedAt).getTime() - new Date(a.pageUpdatedAt).getTime(); // recent first
    }),
  })).sort((a, b) => {
    // Always push "General" (unlinked, id=-1) to the bottom
    if (a.accountId === -1 && b.accountId !== -1) return 1;
    if (b.accountId === -1 && a.accountId !== -1) return -1;
    if (sortBy === "name") return a.accountName.localeCompare(b.accountName);
    // Sort by most recently updated page
    const aMax = Math.max(...a.pages.map(p => new Date(p.pageUpdatedAt).getTime()));
    const bMax = Math.max(...b.pages.map(p => new Date(p.pageUpdatedAt).getTime()));
    return bMax - aMax;
  });

  // Accounts that don't yet have a microsite (exclude the -1 "General" bucket)
  const accountsWithMicrosites = new Set(overview.filter(a => a.accountId !== -1).map(a => a.accountId));
  const accountsWithout = accounts.filter(a => !accountsWithMicrosites.has(a.id));

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Microsites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated pages for your accounts, with per-contact personalized links
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

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
            My Accounts
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

        {/* Build list save bar */}
        {buildListMode && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
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
        )}

        {/* PageHint banner */}
        <PageHint
          id="sales-microsites"
          title="Personalized Pages for Every Account"
          description="Microsites are AI-generated landing pages tailored to each account. Each contact gets a unique tracked link so you can see exactly who visited and what they looked at."
          tips={[
            "Go to an account and tap 'Generate Microsite' to create a new page",
            "Use 'Generate hotlinks' to create unique tracked URLs for each contact",
            "'Clone for account' copies a general page and links it to a specific account"
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
              {overview.some(a => a.accountId === -1) && (
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
        {overview.length > 0 && (
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

        {/* Account microsites list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : sortedOverview.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 border border-dashed border-border rounded-lg text-center">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
              <Layout className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No microsites yet</h3>
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
        ) : sortedOverview.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center py-12 px-8 border border-dashed border-border rounded-lg text-center">
            <Search className="w-5 h-5 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium text-foreground mb-1">No results for "{search}"</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs">Try a different search term or clear the search.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {(() => {
                  const showing = sortedOverview.filter(a => a.accountId !== -1).length;
                  const total = overview.filter(a => a.accountId !== -1).length;
                  return showing < total ? `${showing} of ${total}` : total;
                })()} account{sortedOverview.filter(a => a.accountId !== -1).length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs appearance-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                >
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
            {sortedOverview.map((acct, acctIdx) => (
              <div key={acct.accountId}>
                {/* Divider before General pages */}
                {acct.accountId === -1 && acctIdx > 0 && (
                  <div className="flex items-center gap-3 pt-6 pb-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">General pages</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

              <Card className={`rounded-lg overflow-hidden border ${
                buildListMode && acct.accountId !== -1 && buildListSelection.has(acct.accountId)
                  ? "border-primary bg-primary/3"
                  : acct.accountId === -1 ? "border-dashed border-border/60" : "border-border"
              }`}>
                {/* ── Account header ─────────────────────────────── */}
                <button
                  onClick={() => {
                    if (buildListMode && acct.accountId !== -1) {
                      toggleBuildSelection(acct.accountId);
                    } else {
                      toggleCollapse(acct.accountId);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left ${
                    buildListMode && acct.accountId !== -1 ? "hover:bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  {buildListMode && acct.accountId !== -1 ? (
                    buildListSelection.has(acct.accountId)
                      ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    collapsed.has(acct.accountId)
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}

                  {acct.accountId === -1 ? (
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-muted-foreground">General landing pages</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Not linked to an account</p>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{acct.accountName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{acct.pages.length} page{acct.pages.length !== 1 ? "s" : ""}</span>
                        {acct.pages.reduce((s, p) => s + p.hotlinks.length, 0) > 0 && (
                          <>
                            <span className="text-muted-foreground/30">&middot;</span>
                            <span className="text-xs text-muted-foreground">{acct.pages.reduce((s, p) => s + p.hotlinks.length, 0)} links</span>
                          </>
                        )}
                        {acct.accountOwner && (
                          <>
                            <span className="text-muted-foreground/30">&middot;</span>
                            <span className="text-xs text-muted-foreground/60">{acct.accountOwner}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {acct.accountId !== -1 && !buildListMode && (
                    <Link href={`/sales/accounts/${acct.accountId}`} onClick={e => e.stopPropagation()}>
                      <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        View account <ChevronRight className="w-3 h-3" />
                      </span>
                    </Link>
                  )}
                </button>

                {/* ── Pages ────────────────────────────────────────── */}
                {!collapsed.has(acct.accountId) && (
                  <div className="border-t border-border">
                    {acct.pages.map(page => (
                      <div key={page.pageId} className={`group/page ${selectMode && selectedPages.has(page.pageId) ? "bg-primary/5" : ""}`}>
                        <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0">
                          {/* Status dot or checkbox */}
                          <div className="pt-1.5 shrink-0">
                            {selectMode ? (
                              <button onClick={() => toggleSelect(page.pageId)} className="text-primary">
                                {selectedPages.has(page.pageId) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                              </button>
                            ) : (
                              <div className={`w-2 h-2 rounded-full ${page.pageStatus === "published" ? "bg-emerald-500" : "bg-amber-400"}`} />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/builder/${page.pageId}`}>
                                <span className="text-[13px] font-medium text-foreground hover:underline cursor-pointer leading-snug">{page.pageTitle}</span>
                              </Link>
                              <PageStatusBadge status={page.pageStatus} />
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground font-mono">/{page.pageSlug}</span>
                              <span className="text-muted-foreground/30">&middot;</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(page.pageUpdatedAt), "MMM d")}</span>
                              {page.hotlinks.length > 0 && (
                                <>
                                  <span className="text-muted-foreground/30">&middot;</span>
                                  <span className="text-xs text-muted-foreground">{page.hotlinks.length} link{page.hotlinks.length !== 1 ? "s" : ""}</span>
                                </>
                              )}
                            </div>

                            {/* Contact chips */}
                            {page.hotlinks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {page.hotlinks.map(hl => (
                                  <button
                                    key={hl.hotlinkId}
                                    onClick={() => copyLink(hl.token)}
                                    className="group/hl inline-flex items-center gap-1.5 text-xs pl-1 pr-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors cursor-pointer"
                                    title={`Copy ${hl.contactName || "contact"}'s link`}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-muted-foreground/10 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                                      {initials(hl.contactName)}
                                    </div>
                                    <span className="text-foreground font-medium truncate max-w-[120px] leading-none">
                                      {hl.contactName || <span className="text-muted-foreground italic font-normal">Unknown</span>}
                                    </span>
                                    {copiedToken === hl.token
                                      ? <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                      : <Copy className="w-3 h-3 text-muted-foreground/30 group-hover/hl:text-muted-foreground shrink-0 transition-colors" />
                                    }
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Alert subscription — microsites only */}
                            {acct.accountId !== -1 && (
                              <div className="mt-2">
                                {(() => {
                                  const subs = alertEmails.get(page.pageId) ?? [];
                                  const isExpanded = alertPageId === page.pageId;
                                  return (
                                    <>
                                      <div className="flex items-center gap-2">
                                        {subs.length > 0 && (
                                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                            {subs.slice(0, 2).map(ae => (
                                              <span key={ae.id} className="text-xs text-muted-foreground">{ae.email}</span>
                                            ))}
                                            {subs.length > 2 && <span className="text-xs text-muted-foreground">+{subs.length - 2}</span>}
                                          </div>
                                        )}
                                        <button
                                          onClick={() => openAlertPanel(page.pageId)}
                                          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                        >
                                          <Bell className="w-3 h-3" />
                                          {subs.length > 0 ? "Manage alerts" : "Subscribe to alerts"}
                                        </button>
                                      </div>
                                      {isExpanded && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                          {subs.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              {subs.map(ae => (
                                                <span key={ae.id} className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                                                  <Mail className="w-3 h-3" />
                                                  {ae.email}
                                                  <button onClick={() => removeAlertEmail(ae.id, page.pageId)} className="ml-0.5 text-muted-foreground/50 hover:text-foreground transition-colors" title="Remove"><X className="w-3 h-3" /></button>
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <input type="email" value={alertInput} onChange={e => setAlertInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addAlertEmail(page.pageId, alertInput); }} placeholder="your@email.com" className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40" />
                                            <Button size="sm" className="h-7 px-3 text-xs" disabled={!alertInput.trim() || alertSaving} onClick={() => addAlertEmail(page.pageId, alertInput)}>{alertSaving ? "Saving…" : "Subscribe"}</Button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Page actions */}
                          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                            <a href={`/lp/${page.pageSlug}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground" title="Preview"><ExternalLink className="w-3.5 h-3.5" /></Button>
                            </a>
                            <Link href={`/builder/${page.pageId}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground" title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                            </Link>
                            {acct.accountId === -1 && !selectMode && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground hidden sm:inline-flex" title="Clone for account" onClick={() => openCloneModal(page.pageId, page.pageTitle)}><Layers className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground hidden sm:inline-flex" title="Generate hotlinks" onClick={() => openHotlinksModal(page.pageId, page.pageTitle)}><Globe className="w-3.5 h-3.5" /></Button>
                              </>
                            )}
                            <div className="relative">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground" onClick={() => setMenuOpen(menuOpen === page.pageId ? null : page.pageId)}><MoreVertical className="w-3.5 h-3.5" /></Button>
                              {menuOpen === page.pageId && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                                  <button onClick={() => togglePageStatus(page.pageId, page.pageStatus)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                                    {page.pageStatus === "published" ? <><EyeOff className="w-3.5 h-3.5" /> Unpublish</> : <><Eye className="w-3.5 h-3.5" /> Publish</>}
                                  </button>
                                  {confirmDelete === page.pageId ? (
                                    <div className="px-3 py-2 border-t border-border">
                                      <p className="text-xs text-muted-foreground mb-2">Delete this microsite?</p>
                                      <div className="flex gap-1.5">
                                        <button onClick={() => deletePage(page.pageId)} disabled={actionLoading} className="flex-1 text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium">{actionLoading ? "Deleting…" : "Delete"}</button>
                                        <button onClick={() => { setConfirmDelete(null); setMenuOpen(null); }} className="flex-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => setConfirmDelete(page.pageId)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              </div>
            ))}
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
                  <select
                    value={cloneAccountId}
                    onChange={e => setCloneAccountId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Choose an account —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
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
              <select
                value={hlAccountId}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setHlAccountId(id);
                  setHlGenerated([]);
                  if (id) loadContacts(id);
                  else setHlContacts([]);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Choose an account —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Contact preview */}
            {hlAccountId !== "" && (
              <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {hlContactsLoading ? "Loading contacts…" : `${hlContacts.filter(c => c.email).length} contacts with email`}
                  </span>
                </div>
                {hlContactsLoading ? (
                  <div className="p-3 flex flex-col gap-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full rounded" />)}
                  </div>
                ) : hlContacts.filter(c => c.email).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-3">No contacts with an email address found for this account. Add contacts first.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-border/40">
                    {hlContacts.filter(c => c.email).map(c => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2">
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
            )}

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
                    {hlGenerating ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</> : "Generate links"}
                  </Button>
                  <Button variant="outline" onClick={() => setHotlinksModal(null)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </SalesLayout>
  );
}
