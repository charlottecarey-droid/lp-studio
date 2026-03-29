import { useState, useEffect } from "react";
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
import { Plus, Edit2, ExternalLink, Trash2, FileText, Globe, Clock, Share2, FlaskConical, Loader2, Sparkles, Wand2, TrendingUp, Eye, Link2, BookOpen, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LP_TEMPLATES } from "@/lib/templates";
import { MICROSITE_TEMPLATES } from "@/lib/microsite-templates";
import { createBlock, templateToBlocks, type PageBlock } from "@/lib/block-types";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import { useReviews } from "@/hooks/use-collaboration";
import { scorePageSeoGeo, gradeBgColor, type ScoreResult } from "@/lib/seo-scoring";
import PersonalizedLinksPanel from "@/components/PersonalizedLinksPanel";
import { ContentBriefModal } from "@/components/ContentBriefModal";
import { fetchBrandConfig, type AudienceSegment } from "@/lib/brand-config";
import { setBriefContext } from "@/lib/brief-context";

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
  createdAt: string;
  updatedAt: string;
}

async function fetchPages(): Promise<Page[]> {
  const res = await fetch(`${API_BASE}/lp/pages`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json() as Promise<Page[]>;
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
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [, navigate] = useLocation();

  const [perfScores, setPerfScores] = useState<Record<number, { cvr: number; scroll: number; engagement: number; composite: number; visits: number }>>({});

  const selectedSegment = segments.find(s => s.id === selectedSegmentId) ?? null;

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Pages</h1>
            <p className="text-muted-foreground mt-1">Build and publish landing pages with the drag-and-drop editor.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setBriefModalOpen(true)}>
              <BookOpen className="w-4 h-4" />
              Generate Brief
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              New Page
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No pages yet</h3>
            <p className="text-muted-foreground mb-6 text-sm">Create your first page to get started.</p>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Page
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(page => (
              <div
                key={page.id}
                className="group relative bg-background rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Page thumbnail area */}
                <div className="h-28 bg-gradient-to-br from-[#003A30]/5 via-[#E8F5F2] to-[#C7E738]/10 relative overflow-hidden">
                  <div className="absolute inset-0 flex flex-col gap-1.5 p-3 opacity-50">
                    <div className="h-2 w-3/4 bg-[#003A30] rounded" />
                    <div className="h-1.5 w-1/2 bg-[#003A30]/60 rounded" />
                    <div className="h-4 w-20 bg-[#C7E738] rounded-full mt-1" />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        page.status === "published"
                          ? "bg-green-500/10 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {page.status === "published" ? (
                        <><Globe className="w-2.5 h-2.5 mr-1 inline" />Live</>
                      ) : (
                        <><Clock className="w-2.5 h-2.5 mr-1 inline" />Draft</>
                      )}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 left-3">
                    <span className="text-[10px] text-[#003A30]/50 font-mono">{page.blocks?.length ?? 0} block{page.blocks?.length !== 1 ? "s" : ""}</span>
                  </div>
                  {/* SEO/GEO score badge */}
                  {page.blocks?.length > 0 && (() => {
                    const score = scorePageSeoGeo(page.blocks ?? [], { metaTitle: page.metaTitle, metaDescription: page.metaDescription, ogImage: page.ogImage, slug: page.slug });
                    return (
                      <div className="absolute bottom-2 right-3">
                        <Badge className={cn("text-[10px] px-1.5 py-0.5 font-bold border", gradeBgColor(score.grade))}>
                          {score.grade} · {score.overallScore}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>

                {/* Page info */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{page.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">/lp/{page.slug}</p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(page.updatedAt)}
                    </span>
                    {perfScores[page.id] && perfScores[page.id].visits > 0 && (
                      <>
                        <span className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3" />
                          {perfScores[page.id].visits} visits
                        </span>
                        <span className={cn(
                          "flex items-center gap-0.5 font-medium",
                          perfScores[page.id].composite >= 70 ? "text-green-600" :
                          perfScores[page.id].composite >= 40 ? "text-yellow-600" :
                          "text-red-500"
                        )}>
                          <TrendingUp className="w-3 h-3" />
                          {perfScores[page.id].composite}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Link href={`/builder/${page.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 gap-1 hover:text-primary text-xs"
                      title="A/B Test this page"
                      onClick={() => setAbTestPage({ id: page.id, title: page.title, slug: page.slug })}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">A/B Test</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 hover:text-primary"
                      title="Personalized links"
                      onClick={() => setPersonalizedLinksPage({ id: page.id, title: page.title, slug: page.slug })}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 hover:text-primary"
                      title="Share for review"
                      onClick={() => setSharePageId({ id: page.id, title: page.title })}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={`/lp/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="px-2" title="Preview">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 text-muted-foreground hover:text-red-500"
                      title="Delete"
                      onClick={() => handleDelete(page)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
