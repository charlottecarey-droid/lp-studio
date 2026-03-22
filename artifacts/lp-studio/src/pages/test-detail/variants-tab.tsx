import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, GripVertical, Settings2, ShieldCheck, PaintBucket, LayoutTemplate, Eye, Link2, Link2Off, ExternalLink, LayoutDashboard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { 
  TestWithVariants, 
  Variant, 
  useCreateVariant, 
  useUpdateVariant, 
  useDeleteVariant,
  getGetTestQueryKey
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { TemplatePicker } from "@/components/template-picker";
import { templateVideoHero } from "@/lib/templates";

const API_BASE = "/api";

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

export function VariantsTab({ test }: { test: TestWithVariants }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateVariant();
  const deleteMutation = useDeleteVariant();

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  const handleCreateVariantFromTemplate = (templateConfig: unknown) => {
    createMutation.mutate(
      {
        testId: test.id,
        data: {
          name: `Variant ${test.variants.length + 1}`,
          isControl: test.variants.length === 0,
          trafficWeight: test.variants.length === 0 ? 100 : 0,
          config: templateConfig as Record<string, unknown>
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(test.id) });
          toast({ title: "Variant created" });
          setIsTemplatePickerOpen(false);
        }
      }
    );
  };

  const handleDelete = (variantId: number) => {
    if (confirm("Delete this variant? All tracking data will be lost.")) {
      deleteMutation.mutate(
        { testId: test.id, variantId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(test.id) });
            toast({ title: "Variant deleted" });
          }
        }
      );
    }
  };

  const totalWeight = test.variants.reduce((sum, v) => sum + (v.trafficWeight || 0), 0);

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

      <Dialog open={isTemplatePickerOpen} onOpenChange={setIsTemplatePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-background/95 backdrop-blur-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Choose a Landing Page Template</DialogTitle>
          </DialogHeader>
          <div className="p-8">
            <TemplatePicker 
              onSelect={(template) => handleCreateVariantFromTemplate(template.config)}
              onSkip={() => handleCreateVariantFromTemplate(templateVideoHero.config)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {totalWeight !== 100 && test.variants.length > 0 && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <strong className="font-semibold">Traffic weights must sum to 100%.</strong> Current total: {totalWeight}%. Please adjust the sliders below.
          </div>
        </div>
      )}

      {test.variants.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-2xl bg-muted/20">
          <p className="text-muted-foreground mb-4">No variants created yet.</p>
          <Button onClick={() => setIsTemplatePickerOpen(true)} variant="outline">Create Initial Variant</Button>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={`variant-${test.variants[0]?.id}`}>
          {test.variants.map((variant) => (
            <VariantEditor 
              key={variant.id} 
              testId={test.id}
              testSlug={test.slug}
              variant={variant} 
              onDelete={() => handleDelete(variant.id)}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function PageLinker({ testId, testSlug, variant }: { testId: number; testSlug: string; variant: Variant }) {
  const updateMutation = useUpdateVariant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const config = variant.config as Record<string, unknown>;
  const linkedPageId = typeof config.pageId === "number" ? config.pageId : null;

  useEffect(() => {
    setIsLoadingPages(true);
    fetchPages().then(p => {
      setPages(p);
      setIsLoadingPages(false);
    });
  }, []);

  const linkedPage = pages.find(p => p.id === linkedPageId);

  const handleLink = (pageId: number) => {
    const newConfig = { ...config, pageId };
    updateMutation.mutate(
      { testId, variantId: variant.id, data: { name: variant.name, trafficWeight: variant.trafficWeight, isControl: variant.isControl, config: newConfig } as never },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          toast({ title: "Page linked to variant" });
        }
      }
    );
  };

  const handleUnlink = () => {
    const newConfig = { ...config };
    delete newConfig.pageId;
    updateMutation.mutate(
      { testId, variantId: variant.id, data: { name: variant.name, trafficWeight: variant.trafficWeight, isControl: variant.isControl, config: newConfig } as never },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          toast({ title: "Page unlinked from variant" });
        }
      }
    );
  };

  const handleCreateAndLink = async () => {
    if (!newPageTitle.trim()) {
      toast({ title: "Please enter a page title", variant: "destructive" });
      return;
    }
    const slug = newPageSlug.trim() || newPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setIsCreating(true);
    try {
      const page = await createPage(newPageTitle.trim(), slug);
      setPages(prev => [...prev, page]);
      handleLink(page.id);
      setShowCreateForm(false);
      setNewPageTitle("");
      setNewPageSlug("");
      toast({ title: "Page created and linked" });
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
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={linkedPage.status === "published" ? "default" : "secondary"} className={cn("text-xs", linkedPage.status === "published" ? "bg-green-500/10 text-green-700 border-green-200" : "")}>
              {linkedPage.status === "published" ? "Live" : "Draft"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/builder/${linkedPage.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Builder
            </Button>
          </a>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-primary border-primary/30">
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-1.5" onClick={handleUnlink} disabled={updateMutation.isPending}>
            <Link2Off className="w-3.5 h-3.5" />
            Unlink
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          This variant will render using the blocks from the linked builder page. Changes to the builder page are reflected immediately.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/40 border border-border rounded-xl text-sm text-muted-foreground leading-relaxed">
        No builder page linked. This variant uses the <strong className="text-foreground">Legacy Config</strong> tab for its content. Link a builder page to use drag-and-drop blocks instead.
      </div>

      {showCreateForm ? (
        <div className="space-y-3 p-4 border border-border rounded-xl bg-background">
          <p className="text-sm font-semibold">Create a new page</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Page Title</label>
              <Input
                value={newPageTitle}
                onChange={e => {
                  setNewPageTitle(e.target.value);
                  if (!newPageSlug) {
                    setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }
                }}
                placeholder="My Landing Page"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL Slug</label>
              <Input
                value={newPageSlug}
                onChange={e => setNewPageSlug(e.target.value)}
                placeholder="my-landing-page"
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreateAndLink} disabled={isCreating} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {isCreating ? "Creating..." : "Create & Link"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            {isLoadingPages ? (
              <div className="h-9 bg-muted/40 rounded-lg animate-pulse" />
            ) : pages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No pages created yet.</p>
            ) : (
              <Select onValueChange={(val) => handleLink(parseInt(val, 10))} value="">
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Link existing page…" />
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
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)} className="shrink-0 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Page
          </Button>
        </div>
      )}
    </div>
  );
}

function VariantEditor({ testId, testSlug, variant, onDelete }: { testId: number, testSlug: string, variant: Variant, onDelete: () => void }) {
  const updateMutation = useUpdateVariant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const variantConfigAny = variant.config as Record<string, unknown>;
  const hasLinkedPage = typeof variantConfigAny.pageId === "number";

  const form = useForm<z.infer<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: variant.name,
      isControl: variant.isControl,
      trafficWeight: variant.trafficWeight,
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
      ...values.config
    };

    updateMutation.mutate(
      { testId, variantId: variant.id, data: { ...values, config: mergedConfig } as never },
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
            {hasLinkedPage && (
              <Badge variant="outline" className="text-primary font-normal ml-1 no-default-active-elevate border-primary/30 bg-primary/5">
                <Link2 className="w-3 h-3 mr-1" />
                Builder Page
              </Badge>
            )}
            {templateName && !hasLinkedPage && (
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Top row settings — always visible */}
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
                          {...field} 
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
                      A builder page is linked — the legacy config below is currently inactive. Unlink the page to use this config.
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                    
                    {/* Left Column: Content */}
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

                    {/* Right Column: Design */}
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
                              <SelectItem value="gradient">Subtle Gradient</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />

                      <div className="bg-muted/30 p-4 rounded-xl space-y-4 border border-border/50">
                        <FormField control={form.control} name="config.showSocialProof" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Show Social Proof</FormLabel>
                              <FormDescription>Display a trust badge below CTA</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        
                        {form.watch("config.showSocialProof") && (
                          <FormField control={form.control} name="config.socialProofText" render={({ field }) => (
                            <FormItem>
                              <FormControl><Input {...field} placeholder="e.g. Trusted by 10,000+ clinics" /></FormControl>
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Save button for legacy config */}
                <div className="flex items-center justify-between pt-6 border-t mt-8">
                  <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={onDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Variant
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending || hasLinkedPage} className="rounded-xl px-8 shadow-md">
                    Save Changes
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Delete button always visible in builder tab */}
            {hasLinkedPage && (
              <div className="flex items-center justify-between pt-4 border-t">
                <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Variant
                </Button>
              </div>
            )}
          </form>
        </Form>
      </AccordionContent>
    </AccordionItem>
  );
}
