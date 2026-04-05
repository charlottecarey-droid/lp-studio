import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, ExternalLink, Trash2, FileText, Globe, Clock, Share2, FlaskConical, Loader2, Sparkles, Wand2, TrendingUp, Eye, Link2, BookOpen, Building2, Users, Copy, Check, MoreHorizontal, Search, X, BookMarked, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { LP_TEMPLATES } from "@/lib/templates";
import { MICROSITE_TEMPLATES } from "@/lib/microsite-templates";
import { createBlock, templateToBlocks, type PageBlock } from "@/lib/block-types";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import { useReviews } from "@/hooks/use-collaboration";
import { scorePageSeoGeo, gradeBgColor, type ScoreResult } from "@/lib/seo-scoring";
import PersonalizedLinksPanel from "@/components/PersonalizedLinksPanel";
import { ContentBriefModal } from "@/components/ContentBriefModal";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import { fetchBrandConfig, type AudienceSegment } from "@/lib/brand-config";
import { setBriefContext } from "@/lib/brief-context";
import { useListTests } from "@workspace/api-client-react";
import { getLpPageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface Page {
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  isTemplate?: boolean;
  templateLabel?: string | null;
  templateDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Test {
  id: number;
  name: string;
  slug: string;
  status: string;
  testType: string;
  variantCount?: number;
}

type FilterStatus = "All" | "Draft" | "Published" | "Running" | "Templates";

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy URL</>
      )}
    </button>
  );
}

async function fetchPages(): Promise<Page[]> {
  const res = await fetch(`${API_BASE}/lp/pages`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json() as Promise<Page[]>;
}

function useRunningTests() {
  return useQuery<Test[]>({
    queryKey: ["lp-tests-running"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lp/tests`);
      if (!res.ok) throw new Error("Failed to fetch tests");
      const all: Test[] = await res.json();
      return all.filter(t => t.status === "running");
    },
  });
}

interface CreatePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
}

async function createPage(data: CreatePageData) {
  const res = await fetch(`${API_BASE}/lp/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create page" }));
    throw new Error(err.error ?? "Failed to create page");
  }
  return res.json();
}

async function deletePage(id: number) {
  await fetch(`${API_BASE}/lp/pages/${id}`, { method: "DELETE" });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TEMPLATE_OPTIONS = [
  { id: "blank", name: "Blank Canvas", description: "Start from scratch with an empty page" },
  ...LP_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description })),
];

function getTemplateBlocks(templateId: string): PageBlock[] {
  if (templateId === "blank") return [];
  if (templateId.startsWith("microsite-")) {
    const tpl = MICROSITE_TEMPLATES.find(t => t.id === templateId);
    return tpl ? tpl.buildBlocks() : [];
  }
  return templateToBlocks(templateId);
}

function SaveTemplateDialog({
  page,
  onClose,
  onSaved,
}: {
  page: Page;
  onClose: () => void;
  onSaved: (updated: Page) => void;
}) {
  const [label, setLabel] = useState(page.templateLabel ?? page.title);
  const [description, setDescription] = useState(page.templateDescription ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${page.id}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: true, templateLabel: label.trim() || page.title, templateDescription: description.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated: Page = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      alert("Failed to save template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Save as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This page will appear in the sales team's template picker when they create a new microsite.
          </p>
          <div>
            <Label className="text-sm font-medium">Template Name</Label>
            <Input
              className="mt-1.5"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. DSO Heartland Skin"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={2}
              placeholder="e.g. Dark-mode enterprise skin for large regional DSOs"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !label.trim()} className="gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageActionsMenu({
  page,
  cloningPageId,
  onClone,
  onAbTest,
  onLinks,
  onShare,
  onDelete,
  onTemplateSaved,
}: {
  page: Page;
  cloningPageId: number | null;
  onClone: () => void;
  onAbTest: () => void;
  onLinks: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTemplateSaved: (updated: Page) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRemoveTemplate = async () => {
    setOpen(false);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${page.id}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: false, templateLabel: null, templateDescription: null }),
      });
      if (res.ok) {
        const updated: Page = await res.json();
        onTemplateSaved(updated);
      }
    } catch {
      alert("Failed to remove template. Please try again.");
    }
  };

  const items = [
    {
      icon: <Copy className="w-3.5 h-3.5" />,
      label: cloningPageId === page.id ? "Duplicating…" : "Duplicate",
      onClick: () => { setOpen(false); onClone(); },
      disabled: cloningPageId === page.id,
    },
    {
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      label: "A/B Test",
      onClick: () => { setOpen(false); onAbTest(); },
    },
    {
      icon: <Link2 className="w-3.5 h-3.5" />,
      label: "Personalized Links",
      onClick: () => { setOpen(false); onLinks(); },
    },
    {
      icon: <Share2 className="w-3.5 h-3.5" />,
      label: "Share for Review",
      onClick: () => { setOpen(false); onShare(); },
    },
  ];

  return (
    <>
      <div className="relative" ref={ref}>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          title="More actions"
          onClick={() => setOpen(v => !v)}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>

        {open && (
          <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[200px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={item.onClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="h-px bg-border mx-2 my-1" />
            {page.isTemplate ? (
              <button
                type="button"
                onClick={handleRemoveTemplate}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                Remove from Templates
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setOpen(false); setShowTemplateDialog(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <Star className="w-3.5 h-3.5" />
                Save as Template
              </button>
            )}
            <div className="h-px bg-border mx-2 my-1" />
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {showTemplateDialog && (
        <SaveTemplateDialog
          page={page}
          onClose={() => setShowTemplateDialog(false)}
          onSaved={onTemplateSaved}
        />
      )}
    </>
  );
}

function ShareModalWrapper({ pageId, pageTitle, onClose }: { pageId: number; pageTitle: string; onClose: () => void }) {
  const { reviews, createReview, deleteReview } = useReviews(pageId);
  return (
    <ShareReviewModal
      open
      onClose={onClose}
      pageId={pageId}
      pageName={pageTitle}
      reviews={reviews}
      onCreateReview={createReview}
      onDeleteReview={deleteReview}
    />
  );
}

function CreateTestFromPageModal({
  page,
  onClose,
}: {
  page: { id: number; title: string; slug: string };
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [testName, setTestName] = useState(page.title);
  const [testSlug, setTestSlug] = useState(page.slug);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!testName.trim() || !testSlug.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const testRes = await fetch(`${API_BASE}/lp/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName.trim(), slug: testSlug.trim(), testType: "ab" }),
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({ error: "Failed to create test" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create test");
      }
      const test = await testRes.json() as { id: number };

      const variantRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Control",
          isControl: true,
          trafficWeight: 50,
          builderPageId: page.id,
        }),
      });
      if (!variantRes.ok) {
        await fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});
        const err = await variantRes.json().catch(() => ({ error: "Failed to create variant" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create variant");
      }

      navigate(`/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Run A/B Test on this Page
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page will become the <strong>Control</strong> variant. Add challenger variants from the test detail page to start testing.
          </p>
          <div>
            <Label className="text-sm font-medium">Test Name</Label>
            <Input
              className="mt-1.5"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm font-medium">URL Slug</Label>
            <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
              <Input
                className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                value={testSlug}
                onChange={e => setTestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Using the same slug as your page will seamlessly route traffic through the test.</p>
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !testName.trim() || !testSlug.trim()}
            className="gap-2"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            {isCreating ? "Creating..." : "Create Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PagesGallery() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"template" | "ai" | "brief">("template");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sharePageId, setSharePageId] = useState<{ id: number; title: string } | null>(null);
  const [abTestPage, setAbTestPage] = useState<{ id: number; title: string; slug: string } | null>(null);
  const [personalizedLinksPage, setPersonalizedLinksPage] = useState<{ id: number; title: string; slug: string } | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [cloningPageId, setCloningPageId] = useState<number | null>(null);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [, navigate] = useLocation();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: runningTests = [], isLoading: testsLoading } = useRunningTests();

  const [perfScores, setPerfScores] = useState<Record<number, { cvr: number; scroll: number; engagement: number; composite: number; visits: number }>>({});

  const selectedSegment = segments.find(s => s.id === selectedSegmentId) ?? null;
  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;

  const load = () => {
    setIsLoading(true);
    fetchPages()
      .then(setPages)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (showCreateModal && segments.length === 0) {
      fetchBrandConfig().then(b => setSegments(b.segments ?? [])).catch(() => {});
    }
  }, [showCreateModal]);

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

  const handleTitleChange = (v: string) => {
    setNewTitle(v);
    setNewSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const blocks = getTemplateBlocks(selectedTemplate);
      const page = await createPage({ title: newTitle.trim(), slug: newSlug.trim(), blocks, status: "draft" });
      setShowCreateModal(false);
      setNewTitle("");
      setNewSlug("");
      setSelectedTemplate("blank");
      if (selectedSegment) {
        setBriefContext({
          company: newTitle.trim(),
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
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setIsCreating(false);
    }
  };

  const generatePageFromPrompt = async (prompt: string, seg?: AudienceSegment | null) => {
    const activeSeg = seg !== undefined ? seg : selectedSegment;
    const segmentContext = activeSeg ? {
      name: activeSeg.name,
      description: activeSeg.description,
      messagingAngle: activeSeg.messagingAngle,
      uniqueContext: activeSeg.uniqueContext,
      valueProps: activeSeg.valueProps,
      personas: activeSeg.personas?.map((p: { role: string; painPoints: string[] }) => ({ role: p.role, painPoints: p.painPoints })),
      challenges: activeSeg.challenges?.map((c: { title: string; desc: string }) => ({ title: c.title, desc: c.desc })),
    } : undefined;

    const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        ...(segmentContext ? { segmentContext } : {}),
      }),
    });
    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({ error: "Generation failed" }));
      throw new Error((err as { error?: string }).error ?? "Generation failed");
    }
    const generated = await genRes.json() as { title: string; slug: string; blocks: PageBlock[] };
    const page = await createPage({
      title: generated.title,
      slug: generated.slug,
      blocks: generated.blocks,
      status: "draft",
    });
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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setCreateError(null);
    try {
      await generatePageFromPrompt(aiPrompt, selectedSegment);
      setShowCreateModal(false);
      setAiPrompt("");
      setCreateMode("template");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to generate page");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleGeneratePageFromBrief = async (prompt: string, seg?: AudienceSegment) => {
    await generatePageFromPrompt(prompt, seg ?? selectedSegment);
  };

  const handleDelete = async (page: Page) => {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    await deletePage(page.id);
    setPages(prev => prev.filter(p => p.id !== page.id));
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

  // Determine if a page is "live" (published or running as a test)
  const isPageLive = (pageId: number) => {
    const page = pages.find(p => p.id === pageId);
    if (page?.status === "published") return true;
    return runningTests.some(t => {
      // Check if this test has a variant using this page
      // For now, we'll assume running tests are "live" pages
      return t.status === "running";
    });
  };

  // Filter pages based on selected status, sorted newest first
  const filteredPages = pages
    .filter(page => {
      if (filterStatus === "Draft" && page.status !== "draft") return false;
      if (filterStatus === "Published" && page.status !== "published") return false;
      if (filterStatus === "Running" && !runningTests.some(t => t.slug === page.slug)) return false;
      if (filterStatus === "Templates" && !page.isTemplate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return page.title.toLowerCase().includes(q) || page.slug.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pagesPag = usePagination(filteredPages, 12);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pages</h1>
            <p className="text-muted-foreground mt-1 text-sm">Build and publish landing pages with the drag-and-drop editor.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-[13px] rounded-lg" onClick={() => setBriefModalOpen(true)}>
              <BookOpen className="w-3.5 h-3.5" />
              Brief
            </Button>
            <Button size="sm" className="gap-1.5 text-[13px] rounded-lg" style={{ backgroundColor: "#1B4332", color: "#C7E738" }} onClick={() => setShowCreateModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              New Page
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {!isLoading && pages.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {(["All", "Draft", "Published", "Running", "Templates"] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
                    filterStatus === status
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {status === "Templates" && <Star className="w-3 h-3" />}
                  {status}
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search pages…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-[13px] border border-border/50 rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <div className="p-4 flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          </div>
        ) : pages.length === 0 ? (
          <div className="border border-border/50 rounded-xl p-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No pages yet</h3>
            <p className="text-xs text-muted-foreground mb-4">Create your first page to get started.</p>
            <Button size="sm" className="gap-1.5 text-[13px] rounded-lg" style={{ backgroundColor: "#1B4332", color: "#C7E738" }} onClick={() => setShowCreateModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create Page
            </Button>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="border border-border/50 rounded-xl p-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No {filterStatus === "All" ? "pages" : filterStatus.toLowerCase() + " pages"}</h3>
            <p className="text-xs text-muted-foreground mb-4">Try a different filter or create a new page.</p>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setFilterStatus("All")}>
              View all pages
            </Button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_100px_80px_80px_100px_120px] gap-3 px-4 pb-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              <span>Page</span>
              <span>Status</span>
              <span>Blocks</span>
              <span>Score</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden divide-y divide-border/40">
              {pagesPag.pageItems.map(page => {
                const isPublished = page.status === "published";
                const isRunning = runningTests.some(t => t.slug === page.slug);
                const liveUrl = isPublished || isRunning ? getLpPageUrl(page.slug, micrositeDomain) : null;
                const perf = perfScores[page.id];
                let seoScore: ScoreResult | null = null;
                try {
                  if (page.blocks?.length > 0) {
                    seoScore = scorePageSeoGeo(page.blocks ?? [], { metaTitle: page.metaTitle, metaDescription: page.metaDescription, ogImage: page.ogImage, slug: page.slug });
                  }
                } catch {}

                return (
                  <div
                    key={page.id}
                    className="group grid grid-cols-1 md:grid-cols-[1fr_100px_80px_80px_100px_120px] gap-2 md:gap-3 items-center px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Page name + slug */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isPublished || isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/builder/${page.id}`}>
                            <span className="text-[13px] font-medium text-foreground hover:underline truncate cursor-pointer">{page.title}</span>
                          </Link>
                          {page.isTemplate && (
                            <span title={`Template: ${page.templateLabel ?? page.title}`}>
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] text-muted-foreground/70 font-mono truncate">{micrositeDomain ? `/${page.slug}` : `/lp/${page.slug}`}</code>
                          {liveUrl && <CopyButton url={liveUrl} />}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md",
                        isPublished ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                        isRunning ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {isPublished ? <><Globe className="w-2.5 h-2.5" /> Live</> :
                         isRunning ? <><Globe className="w-2.5 h-2.5" /> Running</> :
                         <><Clock className="w-2.5 h-2.5" /> Draft</>}
                      </span>
                    </div>

                    {/* Blocks */}
                    <span className="text-xs text-muted-foreground tabular-nums">{page.blocks?.length ?? 0}</span>

                    {/* Score */}
                    <div className="flex items-center gap-1.5">
                      {seoScore && (
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-semibold", gradeBgColor(seoScore.grade))}>
                          {seoScore.grade}
                        </Badge>
                      )}
                      {perf && perf.visits > 0 && (
                        <span className={cn(
                          "text-[11px] font-medium tabular-nums",
                          perf.composite >= 70 ? "text-emerald-600" :
                          perf.composite >= 40 ? "text-amber-600" :
                          "text-red-500"
                        )}>
                          {perf.composite}
                        </span>
                      )}
                    </div>

                    {/* Updated */}
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(page.updatedAt)}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/builder/${page.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                        </Link>
                        <a href={getLpPageUrl(page.slug, micrositeDomain)} target="_blank" rel="noopener noreferrer" title={isPublished || isRunning ? "Open live" : "Preview"}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      </div>
                      <PageActionsMenu
                        page={page}
                        cloningPageId={cloningPageId}
                        onClone={() => handleClone(page)}
                        onAbTest={() => setAbTestPage({ id: page.id, title: page.title, slug: page.slug })}
                        onLinks={() => setPersonalizedLinksPage({ id: page.id, title: page.title, slug: page.slug })}
                        onShare={() => setSharePageId({ id: page.id, title: page.title })}
                        onDelete={() => handleDelete(page)}
                        onTemplateSaved={handleTemplateSaved}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <PaginationBar
              page={pagesPag.page} totalPages={pagesPag.totalPages}
              from={pagesPag.from} to={pagesPag.to} total={pagesPag.total}
              onPage={pagesPag.setPage} label="pages"
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
      />

      {/* Create Page Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) { setCreateError(null); setCreateMode("template"); setSelectedSegmentId(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
          </DialogHeader>

          {/* Segment picker — shown when segments exist */}
          {segments.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-3 h-3 text-primary" />
                </div>
                <Label className="text-sm font-semibold text-foreground">Who is this page for?</Label>
              </div>
              <select
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedSegmentId}
                onChange={e => setSelectedSegmentId(e.target.value)}
              >
                <option value="">— No specific segment —</option>
                {segments.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selectedSegment && (
                <p className="text-[11px] text-muted-foreground leading-snug pl-0.5">
                  {selectedSegment.messagingAngle || selectedSegment.description}
                </p>
              )}
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => { setCreateMode("template"); setCreateError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
                createMode === "template" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Template
            </button>
            <button
              onClick={() => { setCreateMode("ai"); setCreateError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
                createMode === "ai" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Generate
            </button>
            <button
              onClick={() => { setCreateMode("brief"); setCreateError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
                createMode === "brief" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Start with Brief
            </button>
          </div>

          {createMode === "template" ? (
            <div className="space-y-5 py-2">
              <div>
                <Label className="text-sm font-medium">Page Name</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. Summer Promotion"
                  value={newTitle}
                  onChange={e => handleTitleChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-sm font-medium">URL Slug</Label>
                <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                  <Input
                    className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                    placeholder="page-slug"
                    value={newSlug}
                    onChange={e => setNewSlug(slugify(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Starting Template</Label>
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {/* General templates */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATE_OPTIONS.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={cn(
                            "text-left p-3 rounded-xl border text-sm transition-all",
                            selectedTemplate === t.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/30 hover:bg-muted/50"
                          )}
                        >
                          <p className="font-medium text-xs text-foreground">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Sales Microsites category */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="w-3 h-3 text-primary" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sales Microsites</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {MICROSITE_TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={cn(
                            "text-left p-3 rounded-xl border text-sm transition-all relative overflow-hidden",
                            selectedTemplate === t.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/30 hover:bg-muted/50"
                          )}
                        >
                          <div
                            className="absolute top-0 right-0 w-8 h-8 rounded-bl-xl opacity-60"
                            style={{ background: t.accentColor }}
                          />
                          <div className="flex items-start gap-1.5 pr-6">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-xs text-foreground">{t.name}</p>
                                {t.badge && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: t.accentColor, color: t.bgColor }}>
                                    {t.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {createError && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
                  className="gap-2"
                >
                  {isCreating ? "Creating..." : "Create & Edit"}
                </Button>
              </DialogFooter>
            </div>
          ) : createMode === "ai" ? (
            <div className="space-y-5 py-2">
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Wand2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Describe your landing page</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Tell us what you're promoting, who it's for, and the tone you want. AI will generate a complete page with all sections, copy, and a lead capture form.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Your Prompt</Label>
                <textarea
                  className="mt-1.5 w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={4}
                  placeholder={"e.g. A landing page for our new dental crown service targeting general dentists. Emphasize 5-day turnaround, digital workflow, and free remakes. Include a lead capture form asking for practice name, email, and number of chairs."}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Tip: The more detail you provide, the better the result. Mention your product, audience, key benefits, and desired tone.
                </p>
              </div>

              {createError && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={aiGenerating}>Cancel</Button>
                <Button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="gap-2"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Page
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Start with a content brief</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Enter your target company or audience and campaign goal. AI will generate a content strategy brief with personas, value props, and messaging guidance — then you can create a page informed by the brief.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button
                  onClick={() => { setShowCreateModal(false); setBriefModalOpen(true); }}
                  className="gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Open Brief Generator
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
