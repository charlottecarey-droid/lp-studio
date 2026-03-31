import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockDefaultsContent } from "@/pages/block-defaults";
import { CustomBlocksContent } from "@/pages/custom-blocks";

export default function BlocksSettingsPage() {
  return (
    <AppLayout>
      <Tabs
        defaultValue="presets"
        className="flex flex-col -mx-6 md:-mx-8 lg:-mx-10 -my-6 md:-my-8 lg:-my-10"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Page header + tab triggers */}
        <div className="px-6 md:px-8 lg:px-10 pt-6 pb-0 shrink-0 border-b border-border bg-background">
          <h1 className="text-2xl font-bold text-foreground">Blocks</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Manage block presets and custom HTML blocks
          </p>
          <TabsList>
            <TabsTrigger value="presets">Block Presets</TabsTrigger>
            <TabsTrigger value="custom">Custom HTML</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="presets" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <BlockDefaultsContent />
        </TabsContent>
        <TabsContent value="custom" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <CustomBlocksContent />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
