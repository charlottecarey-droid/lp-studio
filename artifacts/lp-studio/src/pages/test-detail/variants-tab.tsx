import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, GripVertical, Settings2, ShieldCheck, PaintBucket, LayoutTemplate, Eye, Link2, Link2Off, LayoutDashboard, ArrowRight, TestTube2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import type { PageBlock } from "@/lib/block-types";

import { 
  TestWithVariants, 
  Variant, 
  useCreateVariant, 
  useUpdateVariant, 
  useDeleteVariant,
  updateVariant,
  getGetTestQueryKey,
  getListTestsQueryKey,
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { useComments } from "@/hooks/use-collaboration";
import { CommentsPanel, CommentBadge } from "@/components/collaboration/comment-thread";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { TemplatePicker, BuilderPageSummary } from "@/components/template-picker";
import { templateVideoHero } from "@/lib/templates";

const API_BASE = "/api";

function distributeEvenly(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

interface PageSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
}

async function fetchPages(): Promise<PageSummary[]> {
  const res = await fetch(`${API_BASE}/lp/pages`);
  if (!res.ok) return [];
  return res.json() as Promise<PageSummary[]>;
}

async function createPage(title: string, slug: string): Promise<PageSummary> {
  const res = await fetch(`${API_BASE}/lp/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, slug, blocks: [], status: "draft" }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Failed to create page");
  }
  return res.json() as Promise<PageSummary>;
}

const variantSchema = z.object({
  name: z.string().min(1),
  isControl: z.boolean().default(false),
  trafficWeight: z.number().min(0).max(100),
  config: z.object({
    heroType: z.enum(["dandy-video", "static-image", "none"]),
    headline: z.string().min(1),
    subheadline: z.string().optional(),
    ctaText: z.string().min(1),
    ctaColor: z.string().optional(),
    ctaUrl: z.string().optional(),
    layout: z.enum(["centered", "split", "minimal"]),
    backgroundStyle: z.enum(["white", "dark", "gradient"]),
    showSocialProof: z.boolean(),
    socialProofText: z.string().optional(),
  })
});

export function VariantsTab({ test, commentMode = false }: { test: TestWithVariants; commentMode?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateVariant();
  const deleteMutation = useDeleteVariant();
  const { blocks, addComment, resolveComment } = useComments(test.id);

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [builderPages, setBuilderPages] = useState<BuilderPageSummary[] | undefined>(undefined);

  useEffect(() => {
    fetchPages()
      .then(pages => setBuilderPages(pages))
      .catch(() => setBuilderPages([]));
  }, []);

  const redistributeAfterCreate = async () => {
    const newCount = test.variants.length + 1;
    const weights = distributeEvenly(newCount);
    await Promise.all(
      test.variants.map((v, i) =>
        updateVariant(test.id, v.id, { trafficWeight: weights[i] })
      )
    );
    queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(test.id) });
    queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() });
  };

  const handleCreateVariantFromTemplate = (templateConfig: unknown) => {
    const newCount = test.variants.length + 1;
    const weights = distributeEvenly(newCount);
    const newVariantWeight = weights[newCount - 1];
    createMutation.mutate(
      {
        testId: test.id,
        data: {
          name: `Variant ${test.variants.length + 1}`,
          isControl: test.variants.length === 0,
          trafficWeight: newVariantWeight,
          config: templateConfig as Record<string, unknown>
        }
      },
      {
        onSuccess: async () => {
          await redistributeAfterCreate();
          toast({ title: "Variant created" });
          setIsTemplatePickerOpen(false);
        }
      }
    );
  };

  const handleSelectBuilderPage = (pageId: number) => {
    const newCount = test.variants.length + 1;
    const weights = distributeEvenly(newCount);
    const newVariantWeight = weights[newCount - 1];
    createMutation.mutate(
      {
        testId: test.id,
        data: {
          name: `Variant ${test.variants.length + 1}`,
          isControl: test.variants.length === 0,
          trafficWeight: newVariantWeight,
          config: templateVideoHero.config as Record<string, unknown>,
          builderPageId: pageId,
        }
      },
      {
        onSuccess: async () => {
          await redistributeAfterCreate();
          toast({ title: "Variant created with builder page" });
          setIsTemplatePickerOpen(false);
        }
      }
    );
  };

  const handleSplitEvenly = async () => {
    const count = test.variants.length;
    if (count === 0) return;
    const weights = distributeEvenly(count);
    await Promise.all(
      test.variants.map((v, i) =>
        updateVariant(test.id, v.id, { trafficWeight: weights[i] })
      )
    );
    queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(test.id) });
    queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() });
    toast({ title: "Traffic split evenly" });
  };

  const handleDelete = (variantId: number) => {
    if (confirm("Delete this variant? All tracking data will be lost.")) {
      const remaining = test.variants.filter(v => v.id !== variantId);
      deleteMutation.mutate(
        { testId: test.id, variantId },
        {
          onSuccess: async () => {
            if (remaining.length > 0) {
              const weights = distributeEvenly(remaining.length);
              await Promise.all(
                remaining.map((v, i) =>
                  updateVariant(test.id, v.id, { trafficWeight: weights[i] })
                )
              );
            }
            queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(test.id) });
            queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() });
            toast({ title: "Variant deleted" });
          }
        }
      );
    }
  };

  const totalWeight = Math.round(test.variants.reduce((sum, v) => sum + (v.trafficWeight || 0), 0));

  const blockTestVariants = test.variants.filter(
    v => !!(v as unknown as Record<string, unknown>).testedBlockId
  );
  const blockControlVariant = blockTestVariants.find(v => v.isControl);
  const blockChallengerVariant = blockTestVariants.find(v => !v.isControl);
  const testedBlockId = (blockControlVariant as unknown as Record<string, unknown>)?.testedBlockId as string | undefined;
  const blockTestPageId = blockControlVariant?.builderPageId ?? null;
  const [, navigateToBlockEditor] = useLocation();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Page Variants</h2>
          <p className="text-muted-foreground mt-1">Configure layout, copy, and traffic distribution.</p>
        </div>
        <Button onClick={() => setIsTemplatePickerOpen(true)} disabled={createMutation.isPending} className="rounded-xl shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Add Variant
        </Button>
      </div>

      {blockControlVariant && blockChallengerVariant && testedBlockId && blockTestPageId && (
        <BlockTestComparison
          testSlug={test.slug}
          controlVariant={blockControlVariant}
          challengerVariant={blockChallengerVariant}
          testedBlockId={testedBlockId}
          pageId={blockTestPageId}
          onEditChallenger={() =>
            navigateToBlockEditor(`/block-test-editor/${test.id}/${blockChallengerVariant.id}/${testedBlockId}?pageId=${blockTestPageId}`)
          }
        />
      )}

      <Dialog open={isTemplatePickerOpen} onOpenChange={setIsTemplatePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-background/95 backdrop-blur-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Choose a Landing Page Template</DialogTitle>
          </DialogHeader>
          <div className="p-8">
            <TemplatePicker 
              onSelect={(template) => handleCreateVariantFromTemplate(template.config)}
              onSkip={() => handleCreateVariantFromTemplate(templateVideoHero.config)}
              builderPages={builderPages}
              onSelectBuilderPage={handleSelectBuilderPage}
            />
          </div>
        </DialogContent>
      </Dialog>

      {totalWeight !== 100 && test.variants.length > 0 && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div className="text-sm flex-1">
            <strong className="font-semibold">Traffic weights must sum to 100%.</strong> Current total: {totalWeight}%. Adjust the sliders below, or split evenly.
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={handleSplitEvenly}
          >
            Split evenly
          </Button>
        </div>
      )}

      {test.variants.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-2xl bg-muted/20">
          <p className="text-muted-foreground mb-4">No variants created yet.</p>
          <Button onClick={() => setIsTemplatePickerOpen(true)} variant="outline">Create Initial Variant</Button>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={`variant-${test.variants[0]?.id}`}>
          {test.variants.map((variant, idx) => {
            const blockComments = blocks.find(b => b.blockIndex === idx);
            const commentCount = blockComments
              ? blockComments.threads.reduce((sum, t) => sum + 1 + t.replies.length, 0)
              : 0;
            return (
              <div key={variant.id} className="relative">
                {commentMode && (
                  <div className="absolute -right-3 top-3 z-20">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div>
                          <CommentBadge count={commentCount} onClick={() => {}} />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-auto p-0 border-0 shadow-none bg-transparent" align="start">
                        <CommentsPanel
                          blockComments={blockComments}
                          blockIndex={idx}
                          onAddComment={addComment}
                          onResolve={resolveComment}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <VariantEditor 
                  testId={test.id}
                  testSlug={test.slug}
                  variant={variant} 
                  onDelete={() => handleDelete(variant.id)}
                />
              </div>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

interface PageLinkerProps {
  testId: number;
  testSlug: string;
  variant: Variant;
}

function PageLinker({ testId, testSlug, variant }: PageLinkerProps) {
  const updateMutation = useUpdateVariant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const linkedPageId = variant.builderPageId ?? null;

  useEffect(() => {
    setIsLoadingPages(true);
    fetchPages().then(p => {
      setPages(p);
      setIsLoadingPages(false);
    });
  }, []);

  const linkedPage = pages.find(p => p.id === linkedPageId);

  const linkPage = (pageId: number) => {
    updateMutation.mutate(
      { testId, variantId: variant.id, data: { name: variant.name, trafficWeight: variant.trafficWeight, isControl: variant.isControl, builderPageId: pageId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          toast({ title: "Builder page linked to variant" });
        }
      }
    );
  };

  const unlinkPage = () => {
    updateMutation.mutate(
      { testId, variantId: variant.id, data: { name: variant.name, trafficWeight: variant.trafficWeight, isControl: variant.isControl, builderPageId: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          toast({ title: "Builder page unlinked from variant" });
        }
      }
    );
  };

  const handleOpenInBuilder = () => {
    if (linkedPage) {
      navigate(`/builder/${linkedPage.id}`);
    }
  };

  const handleCreateAndOpen = async () => {
    const variantSlug = variant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${testSlug}-${variantSlug}`;
    setIsCreating(true);
    try {
      const page = await createPage(variant.name, slug);
      setPages(prev => [...prev, page]);
      updateMutation.mutate(
        { testId, variantId: variant.id, data: { name: variant.name, trafficWeight: variant.trafficWeight, isControl: variant.isControl, builderPageId: page.id } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
            navigate(`/builder/${page.id}`);
          }
        }
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create page", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const previewUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/lp/${testSlug}?previewVariantId=${variant.id}`;

  if (linkedPage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{linkedPage.title}</p>
            <p className="text-xs text-muted-foreground font-mono">/{linkedPage.slug}</p>
          </div>
          <Badge variant={linkedPage.status === "published" ? "default" : "secondary"} className={cn("text-xs shrink-0", linkedPage.status === "published" ? "bg-green-500/10 text-green-700 border-green-200" : "")}>
            {linkedPage.status === "published" ? "Live" : "Draft"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleOpenInBuilder}
            disabled={updateMutation.isPending}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Open in Builder
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </Button>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-primary border-primary/30">
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-1.5 shrink-0" onClick={unlinkPage} disabled={updateMutation.isPending}>
            <Link2Off className="w-3.5 h-3.5" />
            Unlink
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          This variant renders blocks from the linked builder page. Edits to the page take effect immediately — no re-linking needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/40 border border-border rounded-xl">
        <p className="text-sm font-medium mb-1">No builder page linked</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Create a new builder page for this variant, or link an existing one. The builder page's blocks will replace the legacy config as the page content.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleCreateAndOpen}
          disabled={isCreating || updateMutation.isPending}
        >
          <Plus className="w-3.5 h-3.5" />
          {isCreating ? "Creating..." : "Create Page & Open Builder"}
        </Button>

        {!isLoadingPages && pages.length > 0 && (
          <div className="flex-1">
            <Select onValueChange={(val) => linkPage(parseInt(val, 10))} value="">
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Or link existing page…" />
              </SelectTrigger>
              <SelectContent>
                {pages.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <span className="flex items-center gap-2">
                      {p.title}
                      <span className="text-muted-foreground font-mono text-xs">/{p.slug}</span>
                      {p.status === "published" && <Badge className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-700 border-green-200">Live</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isLoadingPages && <div className="flex-1 h-9 bg-muted/40 rounded-lg animate-pulse" />}
      </div>
    </div>
  );
}

interface VariantEditorProps {
  testId: number;
  testSlug: string;
  variant: Variant;
  onDelete: () => void;
}

interface LinkedPageInfo {
  title: string;
  slug: string;
  blockCount: number;
}

interface BlockTestComparisonProps {
  testSlug: string;
  controlVariant: Variant;
  challengerVariant: Variant;
  testedBlockId: string;
  pageId: number;
  onEditChallenger: () => void;
}

function BlockTestComparison({
  testSlug,
  controlVariant,
  challengerVariant,
  testedBlockId,
  pageId,
  onEditChallenger,
}: BlockTestComparisonProps) {
  const [controlBlock, setControlBlock] = useState<PageBlock | null>(null);
  const [challengerBlock, setChallengerBlock] = useState<PageBlock | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/lp/pages/${pageId}`).then(r => r.json() as Promise<{ blocks: PageBlock[] }>),
      fetchBrandConfig(),
    ]).then(([page, b]) => {
      setBrand(b);
      const base = page.blocks.find((bl: PageBlock) => bl.id === testedBlockId) ?? null;
      setControlBlock(base);
      if (base) {
        const challengerOverrides = (
          (challengerVariant as unknown as Record<string, unknown>).blockOverrides as Record<string, Record<string, unknown>> | null | undefined
        )?.[testedBlockId];
        if (challengerOverrides && Object.keys(challengerOverrides).length > 0) {
          const mergedProps = { ...(base.props as unknown as Record<string, unknown>), ...challengerOverrides };
          setChallengerBlock({ ...base, props: mergedProps as unknown as typeof base.props } as PageBlock);
        } else {
          setChallengerBlock(base);
        }
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [pageId, testedBlockId, challengerVariant]);

  const controlPreviewUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/lp/${testSlug}?previewVariantId=${controlVariant.id}`;
  const challengerPreviewUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/lp/${testSlug}?previewVariantId=${challengerVariant.id}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40">
          <TestTube2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Block preview comparison</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground truncate max-w-[240px]">{testedBlockId}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading block preview...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-border/40">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 bg-sky-50/50 border-b border-border/30">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Control</span>
                <a href={controlPreviewUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                </a>
              </div>
              <div className="relative overflow-hidden bg-white" style={{ minHeight: 120 }}>
                {controlBlock ? (
                  <div className="origin-top-left" style={{ transform: "scale(0.4)", transformOrigin: "top left", width: "250%", pointerEvents: "none" }}>
                    <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.animate-marquee{animation:marquee 40s linear infinite}`}</style>
                    <BlockRenderer block={controlBlock} brand={brand} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">Block not found on page</div>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50 border-b border-border/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Challenger</span>
                <a href={challengerPreviewUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                </a>
              </div>
              <div className="relative overflow-hidden bg-white" style={{ minHeight: 120 }}>
                {challengerBlock ? (
                  <div className="origin-top-left" style={{ transform: "scale(0.4)", transformOrigin: "top left", width: "250%", pointerEvents: "none" }}>
                    <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.animate-marquee{animation:marquee 40s linear infinite}`}</style>
                    <BlockRenderer block={challengerBlock} brand={brand} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">Block not found on page</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        size="sm"
        className="gap-1.5"
        onClick={onEditChallenger}
      >
        <TestTube2 className="w-3.5 h-3.5" />
        Edit Challenger Block
        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
      </Button>
    </div>
  );
}

function BlockTestSection({ testId, testSlug, variant }: { testId: number; testSlug: string; variant: Variant }) {
  const [, navigate] = useLocation();
  const testedBlockId = (variant as unknown as Record<string, unknown>).testedBlockId as string | null | undefined;
  const blockOverrides = (variant as unknown as Record<string, unknown>).blockOverrides as Record<string, unknown> | null | undefined;
  const overrideProps = blockOverrides?.[testedBlockId ?? ""] as Record<string, unknown> | undefined;
  const hasOverrides = overrideProps && Object.keys(overrideProps).length > 0;
  const previewUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/lp/${testSlug}?previewVariantId=${variant.id}`;

  const handleEdit = () => {
    if (!testedBlockId || !variant.builderPageId) return;
    navigate(`/block-test-editor/${testId}/${variant.id}/${testedBlockId}?pageId=${variant.builderPageId}`);
  };

  const stringProps = overrideProps
    ? Object.entries(overrideProps).filter(([, v]) => typeof v === "string")
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40">
          <TestTube2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Block-level test</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground truncate max-w-[200px]">{testedBlockId ?? "—"}</span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border/40">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
              <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Control</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Visitors see the <strong>original block</strong> from the base page unchanged.
            </p>
          </div>

          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Challenger</span>
            </div>
            {hasOverrides ? (
              <ul className="space-y-1.5">
                {stringProps.slice(0, 4).map(([key, val]) => (
                  <li key={key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{key}</span>
                    <span className="text-xs text-foreground truncate">{String(val)}</span>
                  </li>
                ))}
                {Object.keys(overrideProps).length > stringProps.length && (
                  <li className="text-xs text-muted-foreground italic">
                    +{Object.keys(overrideProps).length - stringProps.length} more props
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                No overrides set yet. Use "Edit Challenger Block" to customize this block.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!variant.isControl && (
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleEdit}
            disabled={!testedBlockId || !variant.builderPageId}
          >
            <TestTube2 className="w-3.5 h-3.5" />
            Edit Challenger Block
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </Button>
        )}
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={variant.isControl ? "flex-1" : undefined}>
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-primary border-primary/30">
            <Eye className="w-3.5 h-3.5" />
            Preview Variant
          </Button>
        </a>
      </div>
    </div>
  );
}

function VariantEditor({ testId, testSlug, variant, onDelete }: VariantEditorProps) {
  const updateMutation = useUpdateVariant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [linkedPageInfo, setLinkedPageInfo] = useState<LinkedPageInfo | null>(null);

  const variantConfigAny = variant.config as Record<string, unknown>;
  const hasLinkedPage = variant.builderPageId != null;
  const isBlockTest = !!(variant as unknown as Record<string, unknown>).testedBlockId;

  useEffect(() => {
    if (!variant.builderPageId || !variant.linkedPage) {
      setLinkedPageInfo(null);
      return;
    }
    setLinkedPageInfo({
      title: variant.linkedPage.title,
      slug: variant.linkedPage.slug,
      blockCount: variant.linkedPage.blockCount ?? variant.linkedPage.blocks?.length ?? 0,
    });
  }, [variant.builderPageId, variant.linkedPage]);

  const form = useForm<z.infer<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: variant.name,
      isControl: variant.isControl,
      trafficWeight: Math.round(variant.trafficWeight),
      config: {
        heroType: (variantConfigAny.heroType as "dandy-video" | "static-image" | "none") || "dandy-video",
        headline: (variantConfigAny.headline as string) || "",
        subheadline: (variantConfigAny.subheadline as string) || "",
        ctaText: (variantConfigAny.ctaText as string) || "",
        ctaColor: (variantConfigAny.ctaColor as string) || "",
        ctaUrl: (variantConfigAny.ctaUrl as string) || "",
        layout: (variantConfigAny.layout as "centered" | "split" | "minimal") || "centered",
        backgroundStyle: (variantConfigAny.backgroundStyle as "white" | "dark" | "gradient") || "white",
        showSocialProof: (variantConfigAny.showSocialProof as boolean) || false,
        socialProofText: (variantConfigAny.socialProofText as string) || "",
      }
    }
  });

  const onSubmit = (values: z.infer<typeof variantSchema>) => {
    const mergedConfig = {
      ...variantConfigAny,
      ...values.config,
    };
    updateMutation.mutate(
      { testId, variantId: variant.id, data: { name: values.name, isControl: values.isControl, trafficWeight: Math.round(values.trafficWeight), config: mergedConfig as Record<string, unknown> } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          toast({ title: "Variant saved successfully" });
        }
      }
    );
  };

  const getTemplateName = () => {
    const tId = variantConfigAny.templateId;
    if (tId === "video-hero") return "Video Hero";
    if (tId === "problem-first") return "Problem First";
    if (tId === "social-proof-leader") return "Social Proof Leader";
    if (tId === "how-it-works") return "How It Works";
    if (tId === "minimal-cta") return "Minimal CTA";
    return null;
  };

  const templateName = getTemplateName();
  const previewUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/lp/${testSlug}?previewVariantId=${variant.id}`;

  return (
    <AccordionItem value={`variant-${variant.id}`} className="border rounded-2xl bg-background overflow-hidden px-1 shadow-sm">
      <AccordionTrigger className="hover:no-underline px-4 py-4 group">
        <div className="flex flex-1 items-center justify-between pr-4">
          <div className="flex items-center gap-3">
            <GripVertical className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            <h3 className="font-semibold text-base">{form.watch("name")}</h3>
            {form.watch("isControl") && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 no-default-active-elevate">Control</Badge>
            )}
            {isBlockTest && (
              <Badge variant="outline" className="text-primary font-normal ml-1 no-default-active-elevate border-primary/30 bg-primary/5">
                <TestTube2 className="w-3 h-3 mr-1" />
                Block Test
              </Badge>
            )}
            {!isBlockTest && hasLinkedPage && linkedPageInfo && (
              <Badge variant="outline" className="text-primary font-normal ml-1 no-default-active-elevate border-primary/30 bg-primary/5 max-w-[260px]">
                <Link2 className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">{linkedPageInfo.title}</span>
                <span className="mx-1 text-muted-foreground text-[10px] shrink-0 font-mono">/{linkedPageInfo.slug}</span>
                <span className="text-muted-foreground text-[10px] shrink-0">· {linkedPageInfo.blockCount}b</span>
              </Badge>
            )}
            {!isBlockTest && hasLinkedPage && !linkedPageInfo && (
              <Badge variant="outline" className="text-primary font-normal ml-1 no-default-active-elevate border-primary/30 bg-primary/5">
                <Link2 className="w-3 h-3 mr-1" />
                Builder Page
              </Badge>
            )}
            {templateName && !hasLinkedPage && !isBlockTest && (
              <Badge variant="outline" className="text-muted-foreground font-normal ml-2 no-default-active-elevate border-border/60">
                <LayoutTemplate className="w-3 h-3 mr-1" />
                Template: {templateName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-muted-foreground font-mono">
              Weight: <span className="text-foreground font-bold">{form.watch("trafficWeight")}%</span>
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors no-default-active-elevate"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </a>
          </div>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-4 pb-6 pt-2 border-t">
        {isBlockTest ? (
          <div className="space-y-6 pt-2">
            {/* Traffic settings for block tests */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-muted/30 p-5 rounded-xl border border-border/50">
                  <div className="md:col-span-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variant Name</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="md:col-span-6">
                    <FormField control={form.control} name="trafficWeight" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Traffic Distribution (%)</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-4 pt-2">
                            <Slider 
                              value={[field.value]} 
                              onValueChange={(v) => field.onChange(v[0])} 
                              max={100} step={1}
                              className="flex-1"
                            />
                            <Input 
                              type="number" 
                              value={field.value}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              className="w-20 bg-background text-center font-mono" 
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-end mt-6">
                    <FormField control={form.control} name="isControl" render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-normal cursor-pointer">Control</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={onDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete Variant
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} size="sm">
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
            <BlockTestSection testId={testId} testSlug={testSlug} variant={variant} />
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Top row settings */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-muted/30 p-5 rounded-xl border border-border/50">
              <div className="md:col-span-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant Name</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="md:col-span-6">
                <FormField control={form.control} name="trafficWeight" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Traffic Distribution (%)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4 pt-2">
                        <Slider 
                          value={[field.value]} 
                          onValueChange={(v) => field.onChange(v[0])} 
                          max={100} step={1}
                          className="flex-1"
                        />
                        <Input 
                          type="number" 
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          className="w-20 bg-background text-center font-mono" 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="md:col-span-2 flex items-center justify-end mt-6">
                <FormField control={form.control} name="isControl" render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Control</FormLabel>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Content tabs: Builder Page vs Legacy Config */}
            <Tabs defaultValue={hasLinkedPage ? "builder" : "config"}>
              <TabsList className="w-full rounded-xl border bg-muted/30 h-10">
                <TabsTrigger value="builder" className="flex-1 rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Link2 className="w-3.5 h-3.5" />
                  Builder Page
                  {hasLinkedPage && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
                </TabsTrigger>
                <TabsTrigger value="config" className="flex-1 rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Settings2 className="w-3.5 h-3.5" />
                  Legacy Config
                  {!hasLinkedPage && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="builder" className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Link a drag-and-drop builder page to this variant. The builder page's blocks will be used as the page content, overriding the legacy config below.
                </p>
                <PageLinker testId={testId} testSlug={testSlug} variant={variant} />
              </TabsContent>

              <TabsContent value="config" className="mt-4">
                <div className={cn("space-y-8", hasLinkedPage && "opacity-50 pointer-events-none select-none")}>
                  {hasLinkedPage && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      A builder page is linked — the legacy config below is currently inactive. Unlink the page to use this config instead.
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Settings2 className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Copy & Content</h4>
                      </div>

                      <FormField control={form.control} name="config.headline" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Headline</FormLabel>
                          <FormControl><Textarea {...field} className="resize-none h-20 text-lg font-medium" /></FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="config.subheadline" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subheadline</FormLabel>
                          <FormControl><Textarea {...field} className="resize-none" /></FormControl>
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="config.ctaText" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CTA Button Text</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="config.ctaUrl" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CTA Redirect URL</FormLabel>
                            <FormControl><Input {...field} placeholder="/signup" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <PaintBucket className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Design & Layout</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="config.heroType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hero Media</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="dandy-video">Dandy Video Player</SelectItem>
                                <SelectItem value="static-image">Static Image</SelectItem>
                                <SelectItem value="none">Text Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="config.layout" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Layout Pattern</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="split">Split (Left Text, Right Media)</SelectItem>
                                <SelectItem value="centered">Centered Stack</SelectItem>
                                <SelectItem value="minimal">Minimal Grid</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="config.backgroundStyle" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Theme / Background</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="white">Clean White</SelectItem>
                              <SelectItem value="dark">Dark Mode</SelectItem>
                              <SelectItem value="gradient">Gradient</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="config.showSocialProof" render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal cursor-pointer">Show social proof below CTA</FormLabel>
                        </FormItem>
                      )} />

                      {form.watch("config.showSocialProof") && (
                        <FormField control={form.control} name="config.socialProofText" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Social Proof Text</FormLabel>
                            <FormControl><Input {...field} placeholder="Trusted by 2,000+ dental offices" /></FormControl>
                          </FormItem>
                        )} />
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Variant
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} size="sm">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
