import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormsContent } from "./forms";
import { LeadsContent } from "./leads";
import { IntegrationsContent } from "./integrations";

export default function FormsAndLeadsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Forms & Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage forms, view submissions, and configure integrations all in one place.
          </p>
        </div>

        <Tabs defaultValue="forms">
          <TabsList className="w-full mb-2">
            <TabsTrigger value="forms" className="flex-1">Forms</TabsTrigger>
            <TabsTrigger value="submissions" className="flex-1">Submissions</TabsTrigger>
            <TabsTrigger value="integrations" className="flex-1">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="mt-4">
            <FormsContent />
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
            <LeadsContent />
          </TabsContent>

          <TabsContent value="integrations" className="mt-4">
            <IntegrationsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
