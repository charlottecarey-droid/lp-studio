import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Save, CheckCircle, Loader2, TestTube2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { type PageBlock } from "@/lib/block-types";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { PropertyPanel } from "./property-panels/PropertyPanel";

const API_BASE = "/api";

interface FetchedPage {
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: string;
}

interface VariantData {
  id: number;
  testId: number;
  name: string;
  isControl: boolean;
  testedBlockId: string | null;
  blockOverrides: Record<string, Record<string, unknown>> | null;
  builderPageId: number | null;
}

async function fetchVariant(testId: string, variantId: string): Promise<VariantData> {
  const res = await fetch(`${API_BASE}/lp/tests/${testId}/variants`);
  if (!res.ok) throw new Error("Failed to load variants");
  const variants = await res.json() as VariantData[];
  const variant = variants.find(v => v.id === parseInt(variantId, 10));
  if (!variant) throw new Error("Variant not found");
  return variant;
}

async function fetchPage(pageId: number): Promise<FetchedPage> {
  const res = await fetch(`${API_BASE}/lp/pages/${pageId}`);
  if (!res.ok) throw new Error("Failed to load page");
  return res.json() as Promise<FetchedPage>;
}

async function saveBlockOverride(
  testId: string,
  variantId: string,
  blockId: string,
  blockProps: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/lp/tests/${testId}/variants/${variantId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blockOverrides: { [blockId]: blockProps },
    }),
  });
  if (!res.ok) throw new Error("Failed to save block override");
  return res.json();
}

export default function BlockTestEditor() {
  const [, params] = useRoute("/block-test-editor/:testId/:variantId/:blockId");
  const [, navigate] = useLocation();

  const testId = params?.testId ?? "";
  const variantId = params?.variantId ?? "";
  const blockId = params?.blockId ?? "";

  const searchParams = new URLSearchParams(window.location.search);
  const pageId = searchParams.get("pageId");

  const [page, setPage] = useState<FetchedPage | null>(null);
  const [variant, setVariant] = useState<VariantData | null>(null);
  const [testedBlock, setTestedBlock] = useState<PageBlock | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!testId || !variantId || !blockId || !pageId) {
      setError("Missing required parameters");
      setIsLoading(false);
      return;
    }
    Promise.all([
      fetchVariant(testId, variantId),
      fetchPage(parseInt(pageId, 10)),
      fetchBrandConfig(),
    ])
      .then(([v, p, b]) => {
        setVariant(v);
        setPage(p);
        setBrand(b);

        const baseBlockRaw = p.blocks.find(bl => bl.id === blockId) ?? null;
        if (baseBlockRaw) {
          const overrideProps = v.blockOverrides?.[blockId];
          if (overrideProps && Object.keys(overrideProps).length > 0) {
            const mergedProps = { ...(baseBlockRaw.props as unknown as Record<string, unknown>), ...overrideProps };
            setTestedBlock({ ...baseBlockRaw, props: mergedProps as unknown as typeof baseBlockRaw.props } as PageBlock);
          } else {
            setTestedBlock(baseBlockRaw);
          }
        }
        setIsLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setIsLoading(false);
      });
  }, [testId, variantId, blockId, pageId]);

  const handleBlockChange = (updated: PageBlock) => {
    setTestedBlock(updated);
  };

  const handleSave = async () => {
    if (!testedBlock) return;
    setIsSaving(true);
    try {
      await saveBlockOverride(testId, variantId, blockId, testedBlock.props as unknown as Record<string, unknown>);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading block editor...</p>
        </div>
      </div>
    );
  }

  if (error || !testedBlock || !variant) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Failed to load block editor</p>
          <p className="text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
          <Button variant="outline" onClick={() => navigate(`/tests/${testId}`)}>
            Back to Test
          </Button>
        </div>
      </div>
    );
  }

  const previewUrl = `${window.location.origin}/lp-studio/lp/${page?.slug ?? ""}?previewVariantId=${variantId}`;

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
        <Link href={`/tests/${testId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Test</span>
          </Button>
        </Link>

        <div className="h-4 w-px bg-border mx-1" />

        <div className="flex items-center gap-2">
          <TestTube2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Block Test Editor</span>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
            Challenger
          </Badge>
        </div>

        <div className="flex-1" />

        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/30">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
        </a>

        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 text-xs", saveSuccess && "border-green-500 text-green-600")}
          onClick={handleSave}
          disabled={isSaving}
        >
          {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{saveSuccess ? "Saved!" : "Save"}</span>
        </Button>
      </header>

      {/* Two-panel layout: canvas + property panel */}
      <div className="flex flex-1 min-h-0">
        {/* Center: scoped block preview */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/50">
          <div className="min-h-full flex flex-col items-center py-6 px-4">
            <div className="w-full max-w-5xl mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1 mb-2">
                <TestTube2 className="w-3.5 h-3.5 text-primary" />
                <span>Editing challenger version of <strong className="text-foreground">{testedBlock.type}</strong> block</span>
                <span className="text-xs opacity-60">· Changes here are stored as block overrides, not on the page itself</span>
              </div>
            </div>
            <div className="w-full max-w-5xl bg-white shadow-2xl rounded-lg overflow-hidden">
              <style>{`
                @keyframes marquee {
                  from { transform: translateX(0); }
                  to { transform: translateX(-50%); }
                }
                .animate-marquee { animation: marquee 40s linear infinite; }
                .animate-marquee:hover { animation-play-state: paused; }
              `}</style>
              <div className="relative">
                <div className="absolute inset-0 pointer-events-none z-10 border-2 border-primary rounded-lg" />
                <BlockRenderer block={testedBlock} brand={brand} />
              </div>
            </div>
          </div>
        </main>

        {/* Right panel: Property editor scoped to this block */}
        <aside className="w-72 border-l border-border bg-background/60 overflow-y-auto shrink-0">
          <PropertyPanel
            block={testedBlock}
            onChange={handleBlockChange}
          />
        </aside>
      </div>
    </div>
  );
}
