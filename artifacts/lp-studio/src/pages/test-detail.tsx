import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetTest, 
  useGetTestResults, 
  useUpdateTest,
  getListTestsQueryKey,
  getGetTestQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { trackView } from "@/hooks/use-recently-viewed";
import { ArrowLeft, Play, Pause, SquareSquare, BarChart, Settings2, Brain } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { VariantsTab } from "./test-detail/variants-tab";
import { ResultsTab } from "./test-detail/results-tab";
import { SmartTrafficTab } from "./test-detail/smart-traffic-tab";

export default function TestDetail() {
  const [, params] = useRoute("/tests/:testId");
  const testId = params ? parseInt(params.testId, 10) : 0;
  
  const { data: test, isLoading } = useGetTest(testId, { query: { enabled: !!testId } });
  const { data: results } = useGetTestResults(testId, { query: { enabled: !!testId } });
  
  const updateMutation = useUpdateTest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (testId) trackView("experiment", testId);
  }, [testId]);

  const handleStatusChange = (newStatus: "draft" | "running" | "paused" | "completed") => {
    updateMutation.mutate(
      { testId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTestQueryKey(testId) });
          queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() });
          toast({ title: `Test marked as ${newStatus}` });
        }
      }
    );
  };

  if (isLoading || !test) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-1/2 h-12" />
          <Skeleton className="w-full h-[500px] mt-8" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pb-20">
        {/* Header Section */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                  {test.name}
                </h1>
                <StatusBadge status={test.status} className="text-xs px-3 py-1" />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span className="bg-muted px-2 py-1 rounded-md">/lp/{test.slug}</span>
                <span>•</span>
                <span className="capitalize">{test.testType} Test</span>
              </div>
              {test.description && (
                <p className="mt-4 text-muted-foreground max-w-2xl">{test.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 items-end">
              {/* Test control buttons */}
              <div className="flex items-center gap-2 bg-card p-2 rounded-xl shadow-sm border border-border/50">
                {test.status === 'draft' || test.status === 'paused' ? (
                  <Button 
                    variant="default" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                    onClick={() => handleStatusChange("running")}
                    disabled={updateMutation.isPending}
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Start Test
                  </Button>
                ) : test.status === 'running' ? (
                  <Button 
                    variant="outline" 
                    className="rounded-lg hover:bg-amber-50 hover:text-amber-700 border-amber-200"
                    onClick={() => handleStatusChange("paused")}
                    disabled={updateMutation.isPending}
                  >
                    <Pause className="w-4 h-4 mr-2 fill-current" /> Pause
                  </Button>
                ) : null}

                {test.status !== 'completed' && (
                  <Button 
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => handleStatusChange("completed")}
                    disabled={updateMutation.isPending}
                  >
                    <SquareSquare className="w-4 h-4 mr-2" /> Complete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="variants" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 p-1 bg-muted/50 rounded-xl mb-8">
            <TabsTrigger value="variants" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Settings2 className="w-4 h-4 mr-2" />
              Variants
            </TabsTrigger>
            <TabsTrigger value="results" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="smart-traffic" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Brain className="w-4 h-4 mr-2" />
              Smart Traffic
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 bg-card border border-border/50 rounded-3xl shadow-sm p-1">
            <TabsContent value="variants" className="m-0 p-6 md:p-8 outline-none">
              <VariantsTab test={test} commentMode={false} />
            </TabsContent>

            <TabsContent value="results" className="m-0 p-6 md:p-8 outline-none">
              <ResultsTab test={test} results={results as any} />
            </TabsContent>

            <TabsContent value="smart-traffic" className="m-0 p-6 md:p-8 outline-none">
              <SmartTrafficTab
                testId={testId}
                variantNames={new Map(
                  (test.variants ?? []).map((v: any) => [v.id, v.name])
                )}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
