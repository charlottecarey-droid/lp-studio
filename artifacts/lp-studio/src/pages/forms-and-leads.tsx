import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormsContent } from "./forms";
import { LeadsContent } from "./leads";
import { IntegrationsContent } from "./integrations";

export default function FormsAndLeadsPage() {
  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        <div className="px-6 py-6 border-b bg-background">
          <h1 className="text-2xl font-bold">Forms & Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage forms, view submissions, and configure integrations all in one place.
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 pt-4">
            <Tabs defaultValue="forms" className="h-full flex flex-col">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="forms" className="flex-1">Forms</TabsTrigger>
                <TabsTrigger value="submissions" className="flex-1">Submissions</TabsTrigger>
                <TabsTrigger value="integrations" className="flex-1">Integrations</TabsTrigger>
              </TabsList>

              <TabsContent value="forms" className="flex-1 overflow-y-auto mt-0">
                <FormsContent />
              </TabsContent>

              <TabsContent value="submissions" className="flex-1 overflow-y-auto mt-0">
                <LeadsContent />
              </TabsContent>

              <TabsContent value="integrations" className="flex-1 overflow-y-auto mt-0">
                <IntegrationsContent />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
