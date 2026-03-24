import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { BLOCK_REGISTRY, getBlockDef, type PageBlock, type BlockType, type BlockCategory } from "@/lib/block-types";
import { PropertyPanel } from "@/pages/builder/property-panels/PropertyPanel";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, RotateCcw, Save, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

export default function BlockDefaultsPage() {
  const [blockDefaults, setBlockDefaults] = useState<Record<string, unknown>>({});
  const [selectedType, setSelectedType] = useState<BlockType | null>(null);
  const [currentBlock, setCurrentBlock] = useState<PageBlock | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch(`${API}/lp/block-defaults`).then(r => r.json() as Promise<Record<string, unknown>>),
      fetchBrandConfig(),
    ]).then(([defaults, b]) => {
      setBlockDefaults(defaults);
      setBrand(b);
    }).catch(() => {});
  }, []);

  const selectBlockType = (type: BlockType) => {
    setSelectedType(type);
    const def = getBlockDef(type)!;
    const savedProps = blockDefaults[type] as object | undefined;
    const props = savedProps ?? def.defaultProps();
    setCurrentBlock({ id: "defaults-preview", type, props } as PageBlock);
  };

  const handleSave = async () => {
    if (!currentBlock) return;
    setIsSaving(true);
    try {
      await fetch(`${API}/lp/block-defaults/${currentBlock.type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ props: currentBlock.props }),
      });
      setBlockDefaults(prev => ({ ...prev, [currentBlock.type]: currentBlock.props }));
      toast({ title: "Default saved", description: `${getBlockDef(currentBlock.type)?.label} will now use this content when added to new pages.` });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentBlock) return;
    if (!confirm("Reset to built-in placeholder? Your saved default will be deleted.")) return;
    try {
      await fetch(`${API}/lp/block-defaults/${currentBlock.type}`, { method: "DELETE" });
      setBlockDefaults(prev => {
        const next = { ...prev };
        delete next[currentBlock.type];
        return next;
      });
      const def = getBlockDef(currentBlock.type)!;
      setCurrentBlock({ ...currentBlock, props: def.defaultProps() });
      toast({ title: "Reset to built-in defaults" });
    } catch {
      toast({ title: "Failed to reset", variant: "destructive" });
    }
  };

  const categories: BlockCategory[] = ["Layout", "Content", "Social Proof", "CTA"];
  const savedCount = Object.keys(blockDefaults).length;

  return (
    <AppLayout>
      <div
        className="flex -mx-6 md:-mx-8 lg:-mx-10 -my-6 md:-my-8 lg:-my-10"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Left: block type list */}
        <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col">
          <div className="px-4 pt-5 pb-3 border-b border-border shrink-0">
            <h2 className="text-sm font-semibold text-foreground">Block Defaults</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {savedCount > 0 ? `${savedCount} default${savedCount !== 1 ? "s" : ""} saved` : "No defaults saved yet"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {categories.map(cat => {
              const blocks = BLOCK_REGISTRY.filter(b => b.category === cat);
              return (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2">{cat}</p>
                  <div className="space-y-0.5">
                    {blocks.map(block => {
                      const hasSaved = !!blockDefaults[block.type];
                      const isSelected = selectedType === block.type;
                      return (
                        <button
                          key={block.type}
                          onClick={() => selectBlockType(block.type)}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <span className={cn("text-xs font-medium", isSelected ? "text-primary" : "text-foreground")}>
                            {block.label}
                          </span>
                          {hasSaved && (
                            <span
                              className={cn("w-2 h-2 rounded-full shrink-0", isSelected ? "bg-primary" : "bg-emerald-500")}
                              title="Default saved"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right: editor */}
        {currentBlock ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Sub-header */}
            <div className="px-5 py-3 border-b border-border bg-background/80 backdrop-blur shrink-0 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {getBlockDef(currentBlock.type)?.category}
                </p>
                <h2 className="text-sm font-semibold text-foreground leading-tight">
                  {getBlockDef(currentBlock.type)?.label} — Default Content
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {blockDefaults[currentBlock.type] && (
                  <Badge variant="secondary" className="gap-1 text-emerald-700 bg-emerald-50 border-emerald-200">
                    <Check className="w-3 h-3" />
                    Default Saved
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 h-8">
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5 h-8">
                  <Save className="w-3 h-3" />
                  {isSaving ? "Saving…" : "Save as Default"}
                </Button>
              </div>
            </div>

            {/* Body: property form + live preview */}
            <div className="flex flex-1 min-h-0">
              {/* Property form */}
              <div className="w-80 shrink-0 border-r border-border overflow-y-auto bg-background">
                <PropertyPanel
                  block={currentBlock}
                  onChange={setCurrentBlock}
                  hideBlockSettings
                />
              </div>
              {/* Live preview */}
              <div className="flex-1 overflow-y-auto bg-muted/30">
                <div className="p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Live Preview</p>
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-border">
                    <BlockRenderer block={currentBlock} brand={brand} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-12">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Settings2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a Block Type</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Pick any block from the list on the left to configure its default content. Blocks with a saved default auto-populate when added to any page.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
