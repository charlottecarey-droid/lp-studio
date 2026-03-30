import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockDefaultsContent } from "@/pages/block-defaults";
import { CustomBlocksContent } from "@/pages/custom-blocks";

export default function BlocksSettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blocks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage block presets and custom HTML blocks
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="presets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="presets">Block Presets</TabsTrigger>
            <TabsTrigger value="custom">Custom HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-4">
            <BlockDefaultsContent />
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <CustomBlocksContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
