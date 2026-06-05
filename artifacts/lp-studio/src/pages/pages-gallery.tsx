import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";
import { type PageBlock } from "@/lib/block-types";
import PersonalizedLinksPanel from "@/components/PersonalizedLinksPanel";
import { ContentBriefModal } from "@/components/ContentBriefModal";
import { usePagination } from "@/hooks/use-pagination";
import { fetchBrandConfig, type AudienceSegment } from "@/lib/brand-config";
import { audienceBucket, templateContainsLeadershipContent } from "@/lib/audience-gating";
import { setBriefContext } from "@/lib/brief-context";
import { rememberStrictMismatches } from "@/lib/strictMismatches";
import { rememberCritiqueAnnotations } from "@/lib/critiqueAnnotations";
import { useAuth } from "@/context/AuthContext";

import {
  API_BASE,
  type ApiTemplate,
  type ColumnVisibility,
  COLUMN_VISIBILITY_STORAGE_KEY,
  DEFAULT_COLUMN_VISIBILITY,
  type FilterStatus,
  type Page,
  type PerfScore,
  type SortBy,
} from "./pages-gallery/types";
import { ColumnsMenu } from "./pages-gallery/columns-menu";
import {
  createPage,
  deletePage,
  fetchPages,
  useCommentSummary,
  useRunningTests,
} from "./pages-gallery/api";
import { inferAudienceType } from "./pages-gallery/utils";
import { ShareModalWrapper } from "./pages-gallery/share-modal-wrapper";
import { CreateTestFromPageModal } from "./pages-gallery/create-test-from-page-modal";
import { FiltersBar } from "./pages-gallery/filters-bar";
import { BulkActionBar } from "./pages-gallery/bulk-action-bar";
import {
  GalleryLoadingState,
  NoFilteredPagesEmptyState,
  NoPagesEmptyState,
} from "./pages-gallery/empty-state";
import { ResultsList } from "./pages-gallery/results-list";
import { CreatePageModal } from "./pages-gallery/create-page-modal";

export default function PagesGallery() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // `?new=` controls which entry point the gallery should open on mount:
  //   - "brief"            → open ContentBriefModal directly
  //   - "ai" | "template"  → open CreatePageModal pre-selected to that tab
  //   - "1"                → legacy alias for "template" (kept for old links)
  // Anything else means "don't auto-open".
  const initialNewParam = useMemo(() => {
    const v = new URLSearchParams(window.location.search).get("new");
    if (v === "ai" || v === "brief" || v === "template") return v;
    if (v === "1") return "template" as const;
    return null;
  }, []);
  const [createModalMode, setCreateModalMode] = useState<"template" | "ai" | null>(
    initialNewParam === "ai" || initialNewParam === "template" ? initialNewParam : null,
  );
  // Marketing homepage handoff: when the user types a prompt on lpstudio.ai
  // and clicks "Generate page", we land here with `?new=ai&prompt=...`. Read
  // the prompt up-front and pass it to CreatePageModal as `initialAiPrompt`
  // so the AI textarea opens pre-filled. The param is stripped from the URL
  // at the same time `new` is stripped below so refreshes don't re-trigger.
  const [createModalInitialPrompt, setCreateModalInitialPrompt] = useState<string>(() => {
    return new URLSearchParams(window.location.search).get("prompt") ?? "";
  });
  const showCreateModal = createModalMode !== null;
  const setShowCreateModal = (v: boolean) => setCreateModalMode(v ? "template" : null);
  const [sharePageId, setSharePageId] = useState<{ id: number; title: string } | null>(null);
  const [abTestPage, setAbTestPage] = useState<{ id: number; title: string; slug: string } | null>(null);
  const [personalizedLinksPage, setPersonalizedLinksPage] = useState<{ id: number; title: string; slug: string } | null>(null);
  const [briefModalOpen, setBriefModalOpen] = useState(initialNewParam === "brief");
  const [cloningPageId, setCloningPageId] = useState<number | null>(null);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const segmentNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of segments) m[s.id] = s.name;
    return m;
  }, [segments]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [segmentFilterId, setSegmentFilterIdState] = useState<string>(
    () => new URLSearchParams(window.location.search).get("segment") ?? ""
  );
  const setSegmentFilterId = (id: string) => {
    setSegmentFilterIdState(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("segment", id);
    else url.searchParams.delete("segment");
    window.history.replaceState({}, "", url.toString());
  };
  const [, navigate] = useLocation();
  const search = useSearch();

  // React to `?new=` changes after mount so clicking a NewLauncher entry
  // while already on /pages still opens the matching modal/tab. Without
  // this, only the initial mount value (read once via useMemo) would take
  // effect and subsequent in-app navigations would be no-ops.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("new");
    const p = params.get("prompt");
    if (v === "brief") {
      setBriefModalOpen(true);
      setCreateModalMode(null);
    } else if (v === "ai" || v === "template") {
      setCreateModalMode(v);
      setBriefModalOpen(false);
    } else if (v === "1") {
      setCreateModalMode("template");
      setBriefModalOpen(false);
    }
    // Capture the freshly-read prompt (mirrors the initial state) for the AI
    // tab so a navigation-without-mount (in-app push to /pages?new=ai&prompt=…)
    // still seeds the textarea.
    if (v === "ai" && p) {
      setCreateModalInitialPrompt(p);
    }
    // Strip the `?new=` (and `?prompt=`) params after consuming them so that
    // closing the modal and reopening it doesn't immediately re-trigger this
    // effect, and a refresh doesn't re-open / re-prefill.
    if (v !== null || p !== null) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url.toString());
    }
  }, [search]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  // Column visibility for the desktop table — all optional columns default to
  // hidden and admins can toggle them via the "Columns" menu. We persist the
  // choice in localStorage so it survives reloads.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
        return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
      }
    } catch {}
    return DEFAULT_COLUMN_VISIBILITY;
  });
  useEffect(() => {
    try { window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility)); } catch {}
  }, [columnVisibility]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Industry-filtered templates from the API (global + tenant-owned). Drives
  // the "Templates" section of the create dialog so generic tenants see the
  // SaaS starter templates and dental tenants see the dental ones — never
  // the wrong industry's copy.
  const [apiTemplates, setApiTemplates] = useState<ApiTemplate[]>([]);

  const { data: runningTests = [] } = useRunningTests();
  const { data: commentSummary = [] } = useCommentSummary();
  const commentCounts = Object.fromEntries(commentSummary.map(s => [s.pageId, s.unresolvedCount]));

  const [perfScores, setPerfScores] = useState<Record<number, PerfScore>>({});

  const selectedSegment = segments.find(s => s.id === selectedSegmentId) ?? null;
  const { domainContext, user } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const isAdmin = user?.isAdmin ?? false;

  const load = () => {
    setIsLoading(true);
    fetchPages()
      .then(setPages)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Load brand segments up-front so we can render the "Segment: <name>" badge
  // on every page card without waiting for the create dialog to be opened.
  useEffect(() => {
    fetchBrandConfig().then(b => setSegments(b.segments ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (showCreateModal && segments.length === 0) {
      fetchBrandConfig().then(b => setSegments(b.segments ?? [])).catch(() => {});
    }
  }, [showCreateModal]);

  // Refetch industry-filtered templates each time the dialog opens so newly
  // saved tenant templates / superadmin global-template edits show up
  // immediately. `cache: "no-store"` mirrors the layout-defaults fix.
  useEffect(() => {
    if (!showCreateModal && !briefModalOpen) return;
    fetch(`${API_BASE}/lp/templates/enriched`, { cache: "no-store", credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((rows: ApiTemplate[]) => setApiTemplates(Array.isArray(rows) ? rows : []))
      .catch(() => setApiTemplates([]));
  }, [showCreateModal, briefModalOpen]);

  // The brief modal can be opened directly from the toolbar (skipping the
  // create modal), so also load segments here for audience-aware template
  // filtering inside the brief flow.
  useEffect(() => {
    if (briefModalOpen && segments.length === 0) {
      fetchBrandConfig().then(b => setSegments(b.segments ?? [])).catch(() => {});
    }
  }, [briefModalOpen]);

  // Fetch performance scores once pages load
  useEffect(() => {
    if (pages.length === 0) return;
    const ids = pages.map(p => p.id).join(",");
    fetch(`${API_BASE}/lp/pages/performance/batch?ids=${ids}`)
      .then(r => r.json())
      .then((data: { pageId: number; metrics: { totalVisits: number }; scores: { cvr: number; scroll: number; engagement: number } }[]) => {
        const map: typeof perfScores = {};
        for (const d of data) {
          // Compute composite: behavioral scores only (SEO is shown separately)
          const composite = Math.round(d.scores.cvr * 0.45 + d.scores.scroll * 0.275 + d.scores.engagement * 0.275);
          map[d.pageId] = { ...d.scores, composite, visits: d.metrics.totalVisits };
        }
        setPerfScores(map);
      })
      .catch(() => {});
  }, [pages]);

  const selectedAudienceType = selectedSegment ? inferAudienceType(selectedSegment.name) : null;
  const selectedAudienceBucket = audienceBucket(selectedAudienceType);
  const visibleApiTemplates = useMemo(() => {
    const filtered = selectedAudienceBucket !== "practice"
      ? apiTemplates
      : apiTemplates.filter(t => !templateContainsLeadershipContent(t.blockTypes));
    // Tenant-owned templates always appear before global templates so the
    // user's own saved templates are easy to find in the create dialog.
    return [...filtered].sort((a, b) => {
      if (a.isGlobal !== b.isGlobal) return a.isGlobal ? 1 : -1;
      return 0;
    });
  }, [apiTemplates, selectedAudienceBucket]);

  const handleCreateFromModal = async ({
    title,
    slug,
    blocks,
    fromTemplateId,
  }: {
    title: string;
    slug: string;
    blocks: PageBlock[];
    fromTemplateId: number | null;
  }) => {
    const page = await createPage({
      title,
      slug,
      blocks,
      status: "draft",
      segmentId: selectedSegment?.id ?? null,
      audienceType: selectedSegment ? inferAudienceType(selectedSegment.name) : null,
      fromTemplateId,
    });
    setShowCreateModal(false);
    if (selectedSegment) {
      setBriefContext({
        company: title,
        objective: "",
        valueProps: selectedSegment.valueProps ?? [],
        toneGuidance: selectedSegment.messagingAngle ?? "",
        suggestedHeadline: "",
        segmentContext: {
          id: selectedSegment.id,
          name: selectedSegment.name,
          description: selectedSegment.description,
          messagingAngle: selectedSegment.messagingAngle,
          uniqueContext: selectedSegment.uniqueContext,
          valueProps: selectedSegment.valueProps,
          personas: selectedSegment.personas.map(p => ({ role: p.role, painPoints: p.painPoints })),
          challenges: selectedSegment.challenges.map(c => ({ title: c.title, desc: c.desc })),
        },
      });
    }
    navigate(`/builder/${page.id}`);
  };

  const generatePageFromPrompt = async (prompt: string, seg?: AudienceSegment | null, templateId?: number | null, referenceUrls?: string[]) => {
    const activeSeg = seg !== undefined ? seg : selectedSegment;
    const segmentContext = activeSeg ? {
      name: activeSeg.name,
      description: activeSeg.description,
      messagingAngle: activeSeg.messagingAngle,
      uniqueContext: activeSeg.uniqueContext,
      valueProps: activeSeg.valueProps,
      personas: activeSeg.personas?.map((p: { role: string; painPoints: string[] }) => ({ role: p.role, painPoints: p.painPoints })),
      challenges: activeSeg.challenges?.map((c: { title: string; desc: string }) => ({ title: c.title, desc: c.desc })),
      ...(activeSeg.micrositeBlockList?.length ? { micrositeBlockList: activeSeg.micrositeBlockList } : {}),
    } : undefined;

    const cleanedRefUrls = (referenceUrls ?? []).map(u => u.trim()).filter(Boolean);

    const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        ...(segmentContext ? { segmentContext } : {}),
        ...(templateId ? { templateId } : {}),
        ...(cleanedRefUrls.length > 0 ? { referenceUrls: cleanedRefUrls } : {}),
      }),
    });
    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({ error: "Generation failed" }));
      throw new Error((err as { error?: string }).error ?? "Generation failed");
    }
    const generated = await genRes.json() as { title: string; slug: string; blocks: PageBlock[]; strictMismatches?: unknown; critiqueAnnotations?: unknown };
    const page = await createPage({
      title: generated.title,
      slug: generated.slug,
      blocks: generated.blocks,
      status: "draft",
      segmentId: activeSeg?.id ?? null,
      audienceType: activeSeg ? inferAudienceType(activeSeg.name) : null,
    });
    // Task #254 — stash strict-mode mismatches so the builder can show a
    // one-time banner pointing the tenant back to Brand Settings.
    rememberStrictMismatches(page.id, generated.strictMismatches);
    rememberCritiqueAnnotations(page.id, generated.critiqueAnnotations);
    if (activeSeg) {
      setBriefContext({
        company: generated.title,
        objective: prompt.trim(),
        valueProps: activeSeg.valueProps ?? [],
        toneGuidance: activeSeg.messagingAngle ?? "",
        suggestedHeadline: "",
        segmentContext: {
          id: activeSeg.id,
          name: activeSeg.name,
          description: activeSeg.description,
          messagingAngle: activeSeg.messagingAngle,
          uniqueContext: activeSeg.uniqueContext,
          valueProps: activeSeg.valueProps,
          personas: activeSeg.personas.map(p => ({ role: p.role, painPoints: p.painPoints })),
          challenges: activeSeg.challenges.map(c => ({ title: c.title, desc: c.desc })),
        },
      });
    }
    navigate(`/builder/${page.id}`);
  };

  const handleAiGenerateFromModal = async (prompt: string, templateId: number | null, referenceUrls: string[]) => {
    await generatePageFromPrompt(prompt, selectedSegment, templateId, referenceUrls);
    setShowCreateModal(false);
  };

  const handleGeneratePageFromBrief = async (prompt: string, seg?: AudienceSegment, templateId?: number | null) => {
    await generatePageFromPrompt(prompt, seg ?? selectedSegment, templateId ?? null);
  };

  const briefTemplateOptions = useMemo(
    () => visibleApiTemplates.map(t => ({
      id: t.id,
      label: t.templateLabel || t.title,
      isGlobal: t.isGlobal,
    })),
    [visibleApiTemplates],
  );

  const handleDelete = async (page: Page) => {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    await deletePage(page.id);
    setPages(prev => prev.filter(p => p.id !== page.id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(page.id); return next; });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} page${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => deletePage(id)));
      setPages(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleTemplateSaved = (updated: Page) => {
    setPages(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
  };

  const handleClone = async (page: Page) => {
    setCloningPageId(page.id);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${page.id}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to clone page");
      const cloned = await res.json() as Page;
      setPages(prev => [cloned, ...prev]);
    } catch (err) {
      console.error("Clone error:", err);
      alert("Failed to duplicate the page. Please try again.");
    } finally {
      setCloningPageId(null);
    }
  };

  // Filter pages, then sort. Templates always sort BELOW real pages so the
  // Dandy-employee-authored work surfaces first; within each group we honour
  // the user's chosen sort (recent updated, or by author name A→Z). Switching
  // the explicit "Templates" filter shows only templates and skips the
  // template-last grouping (since there's only one group).
  const filteredPages = pages
    .filter(page => {
      if (filterStatus === "Draft" && page.status !== "draft") return false;
      if (filterStatus === "Published" && page.status !== "published") return false;
      if (filterStatus === "Running" && !runningTests.some(t => t.slug === page.slug)) return false;
      if (filterStatus === "Templates" && !page.isTemplate) return false;
      if (segmentFilterId && page.segmentId !== segmentFilterId) return false;
      if (filterStatus === "Mine") {
        const me = (user?.name ?? "").trim().toLowerCase();
        if (!me) return false;
        const created = (page.createdByName ?? "").trim().toLowerCase();
        const updated = (page.updatedByName ?? "").trim().toLowerCase();
        if (created !== me && updated !== me) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const author = (page.createdByName ?? page.updatedByName ?? "").toLowerCase();
        return (
          page.title.toLowerCase().includes(q) ||
          page.slug.toLowerCase().includes(q) ||
          author.includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Templates last (except when explicitly viewing the Templates tab).
      if (filterStatus !== "Templates") {
        const aT = a.isTemplate ? 1 : 0;
        const bT = b.isTemplate ? 1 : 0;
        if (aT !== bT) return aT - bT;
      }
      if (sortBy === "author") {
        const aAuthor = (a.createdByName ?? a.updatedByName ?? "").toLowerCase();
        const bAuthor = (b.createdByName ?? b.updatedByName ?? "").toLowerCase();
        // Authored pages first, then unattributed; alphabetical within.
        if (!aAuthor && bAuthor) return 1;
        if (aAuthor && !bAuthor) return -1;
        const cmp = aAuthor.localeCompare(bAuthor);
        if (cmp !== 0) return cmp;
      }
      // Default + tiebreaker: most recently updated first (falls back to
      // createdAt for legacy rows that never got an updatedAt stamp).
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

  const pagesPag = usePagination(filteredPages, 12);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Pages</h1>
            <p className="text-muted-foreground mt-1 text-sm">Build and publish landing pages with the drag-and-drop editor.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <ColumnsMenu visibility={columnVisibility} setVisibility={setColumnVisibility} />
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-[13px] rounded-lg" onClick={() => setBriefModalOpen(true)}>
              <BookOpen className="w-3.5 h-3.5" />
              Brief
            </Button>
            <Button size="lg" className="rounded-xl font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Page
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {!isLoading && pages.length > 0 && (
          <FiltersBar
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            sortBy={sortBy}
            setSortBy={setSortBy}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showMine={!!user?.name}
            segments={segments}
            segmentFilterId={segmentFilterId}
            setSegmentFilterId={setSegmentFilterId}
          />
        )}

        {isLoading ? (
          <GalleryLoadingState />
        ) : pages.length === 0 ? (
          <NoPagesEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : filteredPages.length === 0 ? (
          <NoFilteredPagesEmptyState
            filterStatus={filterStatus}
            onReset={() => setFilterStatus("All")}
            segmentName={segmentFilterId ? segmentNameById[segmentFilterId] ?? null : null}
            onClearSegment={() => setSegmentFilterId("")}
          />
        ) : (
          <>
            {selectedIds.size > 0 && (
              <BulkActionBar
                count={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
                onDelete={handleBulkDelete}
                deleting={bulkDeleting}
              />
            )}
            <ResultsList
              pagesPag={pagesPag}
              isAdmin={isAdmin}
              columnVisibility={columnVisibility}
              micrositeDomain={micrositeDomain}
              runningTests={runningTests}
              perfScores={perfScores}
              commentCounts={commentCounts}
              segmentNameById={segmentNameById}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onToggleSelect={toggleSelect}
              cloningPageId={cloningPageId}
              onClone={handleClone}
              onAbTest={(page) => setAbTestPage({ id: page.id, title: page.title, slug: page.slug })}
              onLinks={(page) => setPersonalizedLinksPage({ id: page.id, title: page.title, slug: page.slug })}
              onShare={(page) => setSharePageId({ id: page.id, title: page.title })}
              onDelete={handleDelete}
              onTemplateSaved={handleTemplateSaved}
            />
          </>
        )}
      </div>

      {sharePageId && (
        <ShareModalWrapper
          pageId={sharePageId.id}
          pageTitle={sharePageId.title}
          onClose={() => setSharePageId(null)}
        />
      )}

      {abTestPage && (
        <CreateTestFromPageModal
          page={abTestPage}
          onClose={() => setAbTestPage(null)}
        />
      )}

      {personalizedLinksPage && (
        <PersonalizedLinksPanel
          pageId={personalizedLinksPage.id}
          pageSlug={personalizedLinksPage.slug}
          pageTitle={personalizedLinksPage.title}
          onClose={() => setPersonalizedLinksPage(null)}
        />
      )}

      {/* Content Brief Modal */}
      <ContentBriefModal
        open={briefModalOpen}
        onClose={() => setBriefModalOpen(false)}
        onGeneratePage={handleGeneratePageFromBrief}
        templates={briefTemplateOptions}
      />

      <CreatePageModal
        open={showCreateModal}
        initialMode={createModalMode ?? undefined}
        initialAiPrompt={createModalInitialPrompt}
        onClose={() => { setShowCreateModal(false); setSelectedSegmentId(""); setCreateModalInitialPrompt(""); }}
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        setSelectedSegmentId={setSelectedSegmentId}
        selectedSegment={selectedSegment}
        selectedAudienceBucket={selectedAudienceBucket}
        visibleApiTemplates={visibleApiTemplates}
        tenantIndustry={user?.tenantIndustry}
        onCreate={handleCreateFromModal}
        onAiGenerate={handleAiGenerateFromModal}
        onOpenBriefModal={() => { setShowCreateModal(false); setBriefModalOpen(true); }}
      />
    </AppLayout>
  );
}
