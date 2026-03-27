import { useState, useMemo, useEffect, useCallback } from "react";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import PaginationControls from "@/components/PaginationControls";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Plus,
  X,
  Play,
  Pause,
  Trash2,
  BarChart3,
  Eye,
  MousePointerClick,
  Clock,
  ChevronDown,
  Check,
  Trophy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { loadSkinConfig, MicrositeSkinConfig, SkinId } from "@/lib/microsite-skin-config";

// ── Types ────────────────────────────────────────────────────────────────────

type SuccessMetric = "views" | "cta_clicks" | "time_on_page";
type TestStatus = "draft" | "active" | "paused" | "completed";

type ABTest = {
  id: string;
  skin_key: string;
  test_name: string;
  content_block: string;
  variant_a_label: string;
  variant_a_value: string;
  variant_b_label: string;
  variant_b_value: string;
  success_metric: SuccessMetric;
  status: TestStatus;
  created_at: string;
  started_at: string | null;
};

type ABResult = {
  test_id: string;
  variant: "A" | "B";
  views: number;
  cta_clicks: number;
  avg_time_seconds: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SKINS = [
  { key: "flagship", label: "Flagship" },
  { key: "flagship-dark", label: "Flagship Dark" },
  { key: "solutions", label: "Solutions" },
  { key: "expansion", label: "Expansion" },
  { key: "heartland", label: "Heartland" },
  { key: "dandy", label: "Dandy" },
];

const CONTENT_BLOCKS = [
  { key: "hero_headline", label: "Hero Headline" },
  { key: "hero_subtext", label: "Hero Subtext" },
  { key: "hero_cta", label: "Hero CTA Text" },
  { key: "social_proof", label: "Social Proof / Stats" },
  { key: "value_prop", label: "Primary Value Prop" },
  { key: "cta_section", label: "CTA Section Copy" },
  { key: "layout", label: "Layout / Section Order" },
];

const METRICS: { key: SuccessMetric; label: string; icon: React.ReactNode }[] = [
  { key: "views", label: "Most Views", icon: <Eye className="w-3.5 h-3.5" /> },
  { key: "cta_clicks", label: "Most CTA Clicks", icon: <MousePointerClick className="w-3.5 h-3.5" /> },
  { key: "time_on_page", label: "Most Time on Page", icon: <Clock className="w-3.5 h-3.5" /> },
];

const STATUS_COLORS: Record<TestStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function metricValue(result: ABResult, metric: SuccessMetric): number {
  if (metric === "views") return result.views;
  if (metric === "cta_clicks") return result.cta_clicks;
  return result.avg_time_seconds;
}

function formatMetric(value: number, metric: SuccessMetric): string {
  if (metric === "time_on_page") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return value.toLocaleString();
}

// ── Extract current live value from skinConfig for a content block ─────────────

function extractCurrentValue(config: MicrositeSkinConfig, contentBlock: string): string {
  switch (contentBlock) {
    case "hero_headline": return config.heroHeadlinePattern ?? "";
    case "hero_subtext": return config.heroSubtext ?? "";
    case "hero_cta": return config.heroCTAText ?? "";
    case "cta_section": return config.finalCTAHeadline ?? "";
    case "value_prop": return config.challenges?.[0]?.title ?? "";
    case "social_proof": return config.statsBar?.map(s => `${s.value} — ${s.label}`).join("\n") ?? "";
    default: return "";
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DSOABTesting() {
  const qc = useQueryClient();
  const [showCreator, setShowCreator] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [skinFilter, setSkinFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    skin_key: "flagship",
    test_name: "",
    content_block: "hero_headline",
    variant_a_label: "Variant A (Current)",
    variant_a_value: "",
    variant_b_label: "Variant B (New)",
    variant_b_value: "",
    success_metric: "views" as SuccessMetric,
  });
  const [loadingCurrentCopy, setLoadingCurrentCopy] = useState(false);

  // Auto-fill Variant A with current live copy whenever skin or content block changes
  useEffect(() => {
    if (!showCreator) return;
    setLoadingCurrentCopy(true);
    loadSkinConfig(form.skin_key as SkinId)
      .then(cfg => {
        const currentValue = extractCurrentValue(cfg as MicrositeSkinConfig, form.content_block);
        setForm(f => ({ ...f, variant_a_value: currentValue }));
      })
      .catch(() => {})
      .finally(() => setLoadingCurrentCopy(false));
  }, [form.skin_key, form.content_block, showCreator]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["ab_tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("microsite_ab_tests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ABTest[];
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["ab_results", selectedTest?.id],
    enabled: !!selectedTest,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("microsite_ab_events")
        .select("test_id, variant, event_type, time_on_page_seconds")
        .eq("test_id", selectedTest!.id);
      if (error) throw error;

      const agg: Record<string, ABResult> = {};
      for (const row of (data as { test_id: string; variant: "A" | "B"; event_type: string; time_on_page_seconds?: number }[])) {
        const key = `${row.test_id}-${row.variant}`;
        if (!agg[key]) agg[key] = { test_id: row.test_id, variant: row.variant, views: 0, cta_clicks: 0, avg_time_seconds: 0 };
        if (row.event_type === "view") agg[key].views++;
        if (row.event_type === "cta_click") agg[key].cta_clicks++;
        if (row.event_type === "time_on_page" && row.time_on_page_seconds) {
          agg[key].avg_time_seconds = (agg[key].avg_time_seconds + row.time_on_page_seconds) / 2;
        }
      }
      return Object.values(agg);
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createTest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("microsite_ab_tests").insert({
        ...form,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      setShowCreator(false);
      setForm({ skin_key: "flagship", test_name: "", content_block: "hero_headline", variant_a_label: "Variant A (Current)", variant_a_value: "", variant_b_label: "Variant B (New)", variant_b_value: "", success_metric: "views" });
      toast.success("Test created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TestStatus }) => {
      const updates: Partial<ABTest> = { status };
      if (status === "active") updates.started_at = new Date().toISOString();
      const { error } = await supabase.from("microsite_ab_tests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      toast.success("Test updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("microsite_ab_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      if (selectedTest) setSelectedTest(null);
      toast.success("Test deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Filtered tests ────────────────────────────────────────────────────────
  const filtered = useMemo(() => tests.filter(t =>
    (skinFilter === "all" || t.skin_key === skinFilter) &&
    (statusFilter === "all" || t.status === statusFilter)
  ), [tests, skinFilter, statusFilter]);

  const testSearchFn = useCallback((t: ABTest, q: string) =>
    t.test_name.toLowerCase().includes(q) || t.skin_key.toLowerCase().includes(q), []);

  const { paged: pagedTests, page: testPage, setPage: setTestPage, pageSize: testPageSize, setPageSize: setTestPageSize, search: testSearch, setSearch: setTestSearch, totalPages: testTotalPages, totalFiltered: testTotalFiltered, PAGE_SIZES: testPAGE_SIZES } =
    usePaginatedList(filtered, testSearchFn);

  // ── Results helpers ───────────────────────────────────────────────────────
  const resultA = results.find(r => r.variant === "A");
  const resultB = results.find(r => r.variant === "B");
  const winner = selectedTest && resultA && resultB
    ? metricValue(resultA, selectedTest.success_metric) > metricValue(resultB, selectedTest.success_metric) ? "A"
    : metricValue(resultB, selectedTest.success_metric) > metricValue(resultA, selectedTest.success_metric) ? "B"
    : null
    : null;

  const totalViews = (resultA?.views ?? 0) + (resultB?.views ?? 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">A/B Testing</h1>
          <p className="text-sm text-muted-foreground">
            Test skin content variants across all microsites using that skin.
            {tests.length > 0 && (
              <span className="ml-2 font-medium text-foreground">
                {tests.filter(t => t.status === "active").length} active · {tests.length} total
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          New Test
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <select
            value={skinFilter}
            onChange={e => setSkinFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
          >
            <option value="all">All skins</option>
            {SKINS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Tests list + results panel */}
      <div className="flex gap-6">
        {/* Tests list */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FlaskConical className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">No tests yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first A/B test to start optimizing your skins.</p>
              <button
                onClick={() => setShowCreator(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" /> New Test
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <PaginationControls
                page={testPage} totalPages={testTotalPages} totalFiltered={testTotalFiltered}
                pageSize={testPageSize} pageSizes={testPAGE_SIZES} search={testSearch}
                onPageChange={setTestPage} onPageSizeChange={setTestPageSize} onSearchChange={setTestSearch}
                searchPlaceholder="Search tests…"
              />
              <div className="space-y-3">
              {pagedTests.map(test => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTest(selectedTest?.id === test.id ? null : test)}
                  className={`bg-card border rounded-xl px-5 py-4 cursor-pointer transition-all hover:shadow-sm ${
                    selectedTest?.id === test.id ? "border-primary/40 ring-2 ring-primary/10" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[test.status]}`}>
                          {test.status}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {SKINS.find(s => s.key === test.skin_key)?.label ?? test.skin_key}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {CONTENT_BLOCKS.find(b => b.key === test.content_block)?.label ?? test.content_block}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-foreground truncate">{test.test_name}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Success metric: {METRICS.find(m => m.key === test.success_metric)?.label}
                        {test.started_at && ` · Started ${new Date(test.started_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {test.status === "draft" && (
                        <button
                          onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: test.id, status: "active" }); }}
                          title="Activate"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {test.status === "active" && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: test.id, status: "paused" }); }}
                            title="Pause"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: test.id, status: "completed" }); }}
                            title="Mark complete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {test.status === "paused" && (
                        <button
                          onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: test.id, status: "active" }); }}
                          title="Resume"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm("Delete this test?")) deleteTest.mutate(test.id); }}
                        title="Delete"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* Results panel */}
        <AnimatePresence>
          {selectedTest && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-80 shrink-0 bg-card border border-border rounded-2xl overflow-hidden self-start sticky top-6"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Results</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{selectedTest.test_name}</p>
                </div>
                <button onClick={() => setSelectedTest(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Total views */}
                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-foreground">{totalViews.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Total visitors across both variants</p>
                </div>

                {/* Variant comparison */}
                {[{ variant: "A" as const, result: resultA, label: selectedTest.variant_a_label }, { variant: "B" as const, result: resultB, label: selectedTest.variant_b_label }].map(({ variant, result, label }) => {
                  const isWinner = winner === variant;
                  const val = result ? metricValue(result, selectedTest.success_metric) : 0;
                  const other = variant === "A" ? resultB : resultA;
                  const otherVal = other ? metricValue(other, selectedTest.success_metric) : 0;
                  const pct = (val + otherVal) > 0 ? Math.round((val / (val + otherVal)) * 100) : 50;
                  return (
                    <div key={variant} className={`rounded-xl border p-4 ${isWinner ? "border-green-200 bg-green-50/50" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${variant === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {variant}
                          </span>
                          <span className="text-[12px] font-semibold text-foreground truncate max-w-[120px]">{label}</span>
                        </div>
                        {isWinner && <Trophy className="w-3.5 h-3.5 text-green-600" />}
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${variant === "A" ? "bg-blue-500" : "bg-purple-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        {METRICS.map(m => (
                          <div key={m.key} className={`text-center p-1.5 rounded-lg ${selectedTest.success_metric === m.key ? "bg-primary/10" : "bg-muted/40"}`}>
                            <p className="text-[13px] font-bold text-foreground">
                              {result ? formatMetric(metricValue(result, m.key), m.key) : "—"}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
                              {m.key === "views" ? "Views" : m.key === "cta_clicks" ? "Clicks" : "Avg Time"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* No data state */}
                {!resultA && !resultB && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      {selectedTest.status === "draft"
                        ? "Activate the test to start collecting data."
                        : "No data yet — visitors will be assigned variants as they land on microsites using this skin."}
                    </p>
                  </div>
                )}

                {/* Variant content preview */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Variant Content</p>
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold text-blue-600 mb-0.5">A — {selectedTest.variant_a_label}</p>
                      <p className="text-[12px] text-foreground leading-snug">{selectedTest.variant_a_value || <span className="text-muted-foreground italic">No content set</span>}</p>
                    </div>
                    <div className="border-t border-border pt-2">
                      <p className="text-[10px] font-semibold text-purple-600 mb-0.5">B — {selectedTest.variant_b_label}</p>
                      <p className="text-[12px] text-foreground leading-snug">{selectedTest.variant_b_value || <span className="text-muted-foreground italic">No content set</span>}</p>
                    </div>
                  </div>
                </div>

                {/* Winner call */}
                {winner && (totalViews >= 100) && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-200">
                    <Trophy className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <p className="text-[12px] text-green-700 font-medium">
                      Variant {winner} is leading on {METRICS.find(m => m.key === selectedTest.success_metric)?.label.toLowerCase()}.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create test modal */}
      <AnimatePresence>
        {showCreator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreator(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-[14px] font-bold text-foreground">New A/B Test</h2>
                <button onClick={() => setShowCreator(false)} className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Test name */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Test Name</label>
                  <input
                    value={form.test_name}
                    onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))}
                    placeholder="e.g. Hero headline — pain point vs outcome"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Skin + Content block */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Skin</label>
                    <div className="relative">
                      <select
                        value={form.skin_key}
                        onChange={e => setForm(f => ({ ...f, skin_key: e.target.value }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      >
                        {SKINS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Content Block</label>
                    <div className="relative">
                      <select
                        value={form.content_block}
                        onChange={e => setForm(f => ({ ...f, content_block: e.target.value }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      >
                        {CONTENT_BLOCKS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Variants */}
                {(["A", "B"] as const).map(v => (
                  <div key={v} className={`rounded-xl border p-4 space-y-3 ${v === "A" ? "border-blue-200 bg-blue-50/30" : "border-purple-200 bg-purple-50/30"}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${v === "A" ? "text-blue-600" : "text-purple-600"}`}>Variant {v}</p>
                      {v === "A" && loadingCurrentCopy && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading current copy…
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Label</label>
                      <input
                        value={v === "A" ? form.variant_a_label : form.variant_b_label}
                        onChange={e => setForm(f => v === "A" ? { ...f, variant_a_label: e.target.value } : { ...f, variant_b_label: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-card"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">
                        Content {v === "A" && <span className="text-muted-foreground/60">(auto-filled from live skin)</span>}
                      </label>
                      <textarea
                        value={v === "A" ? form.variant_a_value : form.variant_b_value}
                        onChange={e => setForm(f => v === "A" ? { ...f, variant_a_value: e.target.value } : { ...f, variant_b_value: e.target.value })}
                        placeholder={v === "A" ? "Loading current copy…" : "New copy to test"}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-card"
                      />
                    </div>
                  </div>
                ))}

                {/* Success metric */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">Success Metric</label>
                  <div className="grid grid-cols-3 gap-2">
                    {METRICS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setForm(f => ({ ...f, success_metric: m.key }))}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-[11px] font-semibold transition-all ${
                          form.success_metric === m.key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
                <button onClick={() => setShowCreator(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => createTest.mutate()}
                  disabled={!form.test_name || !form.variant_a_value || !form.variant_b_value || createTest.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {createTest.isPending ? "Creating…" : "Create Test"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
