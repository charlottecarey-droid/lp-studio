import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  BarChart3,
  Wand2,
  FileText,
} from "lucide-react";

const API_BASE = "/api";

// ─── Types matching real API responses ───────────────────────────────

interface PageSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  variableCount: number;
  variables: Record<string, string>;
}

interface DTRRule {
  variable: string;
  defaultValue: string;
  source: string;
  inBlocks: boolean;
}

interface DTRRulesResponse {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  rules: DTRRule[];
  tokenCount: number;
}

interface TemplateSummary {
  id: number;
  title: string;
  slug: string;
}

interface BulkResult {
  success: boolean;
  pagesGenerated: number;
  errors: number;
  created: Array<{ id: number; slug: string }>;
  failed: Array<{ slug: string; error: string }>;
}

// ─── Component ───────────────────────────────────────────────────────

export default function ProgrammaticPages() {
  // Page selector
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);

  // DTR rules for selected page
  const [dtrData, setDtrData] = useState<DTRRulesResponse | null>(null);
  const [loadingRules, setLoadingRules] = useState(false);

  // Add variable form
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarDefault, setNewVarDefault] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk generator
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<Array<{ slug: string; variables: Record<string, string> }>>([
    { slug: "", variables: {} },
  ]);
  const [generating, setGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  // ─── Load pages ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/pages`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: PageSummary[]) => {
        const list = Array.isArray(data) ? data : [];
        setPages(list);
        if (list.length > 0 && !selectedPageId) setSelectedPageId(list[0].id);
      })
      .catch(() => setPages([]))
      .finally(() => setLoadingPages(false));
  }, []);

  // ─── Load DTR rules when page changes ────────────────────────────
  const loadRules = useCallback((pageId: number) => {
    setLoadingRules(true);
    setDtrData(null);
    fetch(`${API_BASE}/lp/programmatic/dtr-rules/${pageId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: DTRRulesResponse) => setDtrData(data))
      .catch(() => setDtrData(null))
      .finally(() => setLoadingRules(false));
  }, []);

  useEffect(() => {
    if (selectedPageId) loadRules(selectedPageId);
  }, [selectedPageId, loadRules]);

  // ─── Load templates for bulk gen ─────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/templates`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: TemplateSummary[]) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // ─── Add variable ────────────────────────────────────────────────
  const handleAddVariable = async () => {
    if (!newVarName.trim() || !selectedPageId || !dtrData) return;
    const key = newVarName.trim().toLowerCase().replace(/\s+/g, "_");

    // Build updated variables map from current rules
    const vars: Record<string, string> = {};
    for (const rule of dtrData.rules) {
      if (rule.source === "page_variable") vars[rule.variable] = rule.defaultValue;
    }
    vars[key] = newVarDefault.trim() || "";

    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/lp/programmatic/dtr-rules/${selectedPageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: vars }),
      });
      if (r.ok) {
        loadRules(selectedPageId);
        setNewVarName("");
        setNewVarDefault("");
        setShowAddVar(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete variable ─────────────────────────────────────────────
  const handleDeleteVariable = async (varName: string) => {
    if (!selectedPageId || !dtrData) return;
    const vars: Record<string, string> = {};
    for (const rule of dtrData.rules) {
      if (rule.source === "page_variable" && rule.variable !== varName) {
        vars[rule.variable] = rule.defaultValue;
      }
    }

    const r = await fetch(`${API_BASE}/lp/programmatic/dtr-rules/${selectedPageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: vars }),
    });
    if (r.ok) loadRules(selectedPageId);
  };

  // ─── Bulk generate ───────────────────────────────────────────────
  const handleBulkGenerate = async () => {
    if (!selectedTemplateId || bulkRows.length === 0) return;
    const validRows = bulkRows.filter(r => r.slug.trim());
    if (validRows.length === 0) return;

    setGenerating(true);
    setBulkResult(null);
    try {
      const r = await fetch(`${API_BASE}/lp/programmatic/bulk-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          rows: validRows.map(row => ({
            slug: row.slug.trim().toLowerCase().replace(/\s+/g, "-"),
            variables: row.variables,
          })),
        }),
      });
      if (r.ok) {
        const data = await r.json() as BulkResult;
        setBulkResult(data);
      }
    } finally {
      setGenerating(false);
    }
  };

  const addBulkRow = () => setBulkRows([...bulkRows, { slug: "", variables: {} }]);
  const removeBulkRow = (idx: number) => setBulkRows(bulkRows.filter((_, i) => i !== idx));
  const updateBulkRow = (idx: number, field: string, value: string) => {
    const updated = [...bulkRows];
    if (field === "slug") {
      updated[idx] = { ...updated[idx], slug: value };
    } else {
      updated[idx] = { ...updated[idx], variables: { ...updated[idx].variables, [field]: value } };
    }
    setBulkRows(updated);
  };

  // Get template variable names for bulk gen column headers
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const templatePage = pages.find(p => p.id === selectedTemplateId);
  const templateVarNames = templatePage ? Object.keys(templatePage.variables) : [];

  // ─── Helpers ─────────────────────────────────────────────────────
  const getSourceBadge = (source: string) => {
    if (source === "page_variable") return <Badge className="bg-blue-100 text-blue-800">Declared</Badge>;
    if (source === "detected_in_blocks") return <Badge className="bg-yellow-100 text-yellow-800">Detected</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">{source}</Badge>;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Programmatic Pages</h1>
            <p className="text-slate-600 mt-2">
              Dynamic text replacement and bulk page generation from your templates
            </p>
          </div>

          <Tabs defaultValue="dtr" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="dtr" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                DTR Variables
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Bulk Generator
              </TabsTrigger>
            </TabsList>

            {/* ─── DTR Tab ──────────────────────────────────────── */}
            <TabsContent value="dtr" className="space-y-4">
              {/* Page selector */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select a Page</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPages ? (
                    <Skeleton className="h-10 w-full" />
                  ) : pages.length === 0 ? (
                    <p className="text-sm text-slate-500">No pages found. Create a landing page first.</p>
                  ) : (
                    <select
                      className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                      value={selectedPageId ?? ""}
                      onChange={e => setSelectedPageId(parseInt(e.target.value, 10))}
                    >
                      {pages.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.variableCount} variables) — /{p.slug}
                        </option>
                      ))}
                    </select>
                  )}
                </CardContent>
              </Card>

              {/* How it works */}
              <Card>
                <CardContent className="pt-5">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-blue-900">How DTR works</p>
                        <p className="text-sm text-blue-800 mt-1">
                          {`Add {{variables}} to your page content in the builder. Define default values here. When visitors arrive via URL params (e.g. ?city=Austin), the tokens swap automatically.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* DTR Rules */}
              {selectedPageId && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-base">
                        {dtrData ? dtrData.pageTitle : "Variables"}
                      </CardTitle>
                      <CardDescription>
                        {dtrData ? `/${dtrData.pageSlug}` : "Loading..."}
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowAddVar(!showAddVar)} className="gap-1">
                      <Plus className="w-4 h-4" />
                      Add Variable
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {showAddVar && (
                      <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Variable Name</label>
                            <Input placeholder="e.g. city" value={newVarName} onChange={e => setNewVarName(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Value</label>
                            <Input placeholder="e.g. your city" value={newVarDefault} onChange={e => setNewVarDefault(e.target.value)} />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button onClick={handleAddVariable} size="sm" disabled={saving || !newVarName.trim()} className="flex-1">
                              {saving ? "Saving..." : "Add"}
                            </Button>
                            <Button onClick={() => setShowAddVar(false)} size="sm" variant="outline" className="flex-1">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {loadingRules ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : !dtrData || dtrData.rules.length === 0 ? (
                      <div className="text-center py-8">
                        <Wand2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-1">No variables yet</p>
                        <p className="text-xs text-slate-400">
                          {`Add {{tokens}} to your page content in the builder, or add variables above.`}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="font-semibold px-3 py-2">Variable</th>
                              <th className="font-semibold px-3 py-2">Default</th>
                              <th className="font-semibold px-3 py-2">Status</th>
                              <th className="font-semibold px-3 py-2">In Blocks</th>
                              <th className="font-semibold px-3 py-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dtrData.rules.map((rule, idx) => (
                              <tr key={idx} className="border-b hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-3">
                                  <code className="font-mono font-semibold bg-slate-100 px-2 py-1 rounded text-sm">
                                    {`{{${rule.variable}}}`}
                                  </code>
                                </td>
                                <td className="px-3 py-3 text-slate-600">
                                  {rule.defaultValue || <span className="italic text-slate-400">none</span>}
                                </td>
                                <td className="px-3 py-3">{getSourceBadge(rule.source)}</td>
                                <td className="px-3 py-3">
                                  {rule.inBlocks
                                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    : <span className="text-slate-400 text-xs">unused</span>}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {rule.source === "page_variable" && (
                                    <button
                                      onClick={() => handleDeleteVariable(rule.variable)}
                                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── Bulk Generator Tab ───────────────────────────── */}
            <TabsContent value="bulk" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Page Generator</CardTitle>
                  <CardDescription>
                    Clone a template page multiple times with different variable values to create location-specific, industry-specific, or persona-specific pages at scale.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template selector */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Template</label>
                    {loadingTemplates ? (
                      <Skeleton className="h-10 w-full" />
                    ) : templates.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">No templates available</p>
                        <p className="text-xs text-slate-400 mt-1">Mark a page as a template in the builder to use it here.</p>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                        value={selectedTemplateId ?? ""}
                        onChange={e => setSelectedTemplateId(parseInt(e.target.value, 10) || null)}
                      >
                        <option value="">Select a template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.title} — /{t.slug}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedTemplateId && (
                    <>
                      {/* Row editor */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-slate-700">Pages to Generate</label>
                          <Button size="sm" variant="outline" onClick={addBulkRow} className="gap-1">
                            <Plus className="w-3 h-3" /> Add Row
                          </Button>
                        </div>

                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b">
                                <th className="text-left font-medium px-3 py-2">Slug</th>
                                {templateVarNames.map(v => (
                                  <th key={v} className="text-left font-medium px-3 py-2">{v}</th>
                                ))}
                                <th className="w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {bulkRows.map((row, idx) => (
                                <tr key={idx} className="border-b">
                                  <td className="px-2 py-1.5">
                                    <Input
                                      placeholder="e.g. austin-dentists"
                                      value={row.slug}
                                      onChange={e => updateBulkRow(idx, "slug", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </td>
                                  {templateVarNames.map(v => (
                                    <td key={v} className="px-2 py-1.5">
                                      <Input
                                        placeholder={v}
                                        value={row.variables[v] || ""}
                                        onChange={e => updateBulkRow(idx, v, e.target.value)}
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1.5 text-center">
                                    {bulkRows.length > 1 && (
                                      <button onClick={() => removeBulkRow(idx)} className="text-slate-400 hover:text-red-600 p-1">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <Button
                        onClick={handleBulkGenerate}
                        disabled={generating || bulkRows.every(r => !r.slug.trim())}
                        className="gap-2"
                      >
                        {generating ? (
                          <>Generating...</>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            Generate {bulkRows.filter(r => r.slug.trim()).length} Page{bulkRows.filter(r => r.slug.trim()).length !== 1 ? "s" : ""}
                          </>
                        )}
                      </Button>

                      {/* Results */}
                      {bulkResult && (
                        <Card className={bulkResult.errors > 0 ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <p className="font-medium text-slate-900">
                                {bulkResult.pagesGenerated} page{bulkResult.pagesGenerated !== 1 ? "s" : ""} created
                              </p>
                            </div>
                            {bulkResult.created.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {bulkResult.created.map(c => (
                                  <div key={c.id} className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    <a href={`/builder/${c.id}`} className="text-blue-600 hover:underline">/{c.slug}</a>
                                  </div>
                                ))}
                              </div>
                            )}
                            {bulkResult.failed.length > 0 && (
                              <div className="space-y-1 mt-3">
                                <p className="text-sm font-medium text-red-800">Failed:</p>
                                {bulkResult.failed.map((f, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    /{f.slug}: {f.error}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
