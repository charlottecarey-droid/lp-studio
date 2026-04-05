import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  BarChart3,
  Zap,
} from "lucide-react";

const API_BASE = "/api";

interface DTRVariable {
  id: number;
  variable: string;
  defaultValue: string;
  source: "url_param" | "utm" | "cookie" | "api";
  paramName: string;
}

interface Batch {
  batchId: string;
  templateName: string;
  pagesGenerated: number;
  createdAt: string;
  status: "completed" | "in_progress" | "failed";
}

const TEMPLATE_OPTIONS = [
  { id: 1, name: "SaaS Launch Pro", description: "Enterprise software landing page" },
  { id: 2, name: "eCommerce Blitz", description: "Product promotion and sales" },
  { id: 3, name: "B2B Lead Gen", description: "Lead generation and conversions" },
];

const SAMPLE_CSV_DATA = [
  { company: "Acme Corp", industry: "Technology", city: "San Francisco", product: "CRM" },
  { company: "Global Industries", industry: "Healthcare", city: "Austin", product: "ERP" },
  { company: "Dynamic Solutions", industry: "Finance", city: "New York", product: "Analytics" },
  { company: "Prime Ventures", industry: "Retail", city: "Los Angeles", product: "Inventory" },
  { company: "Nexus Labs", industry: "Education", city: "Chicago", product: "Learning Platform" },
];

export default function ProgrammaticPages() {
  const [dtrRules, setDtrRules] = useState<DTRVariable[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // DTR Tab State
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariable, setNewVariable] = useState({ name: "", defaultValue: "", source: "url_param" as const });
  const [previewHeadline, setPreviewHeadline] = useState(
    "Best {{product}} for {{industry}} in {{city}}"
  );

  // Bulk Generator State
  const [bulkStep, setBulkStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [csvData, setCsvData] = useState<typeof SAMPLE_CSV_DATA>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    company: "company_name",
    industry: "industry_type",
    city: "location",
    product: "product_name",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Load DTR rules
  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/dtr-rules`)
      .then(r => r.json() as Promise<DTRVariable[]>)
      .then(data => {
        setDtrRules(data);
        setLoadingRules(false);
      })
      .catch(() => {
        setDtrRules([
          { id: 1, variable: "city", defaultValue: "your city", source: "url_param", paramName: "city" },
          { id: 2, variable: "company", defaultValue: "your company", source: "url_param", paramName: "company" },
          { id: 3, variable: "industry", defaultValue: "your industry", source: "utm", paramName: "utm_content" },
          { id: 4, variable: "product", defaultValue: "our product", source: "url_param", paramName: "product" },
          { id: 5, variable: "region", defaultValue: "North America", source: "cookie", paramName: "region" },
          { id: 6, variable: "company_size", defaultValue: "Enterprise", source: "api", paramName: "company_size" },
        ]);
        setLoadingRules(false);
      });
  }, []);

  // Load batch history
  useEffect(() => {
    fetch(`${API_BASE}/lp/programmatic/batches`)
      .then(r => r.json() as Promise<Batch[]>)
      .then(data => {
        setBatches(data);
        setLoadingBatches(false);
      })
      .catch(() => {
        setBatches([
          {
            batchId: "batch-1",
            templateName: "SaaS Launch Pro",
            pagesGenerated: 150,
            createdAt: "2026-04-03T14:00:00Z",
            status: "completed",
          },
        ]);
        setLoadingBatches(false);
      });
  }, []);

  const handleAddVariable = () => {
    if (newVariable.name && newVariable.defaultValue) {
      const newVar: DTRVariable = {
        id: Date.now(),
        variable: newVariable.name.toLowerCase().replace(/\s+/g, "_"),
        defaultValue: newVariable.defaultValue,
        source: newVariable.source as "url_param" | "utm" | "cookie" | "api",
        paramName: newVariable.name.toLowerCase().replace(/\s+/g, "_"),
      };
      setDtrRules([...dtrRules, newVar]);
      setNewVariable({ name: "", defaultValue: "", source: "url_param" });
      setShowAddVariable(false);

      fetch(`${API_BASE}/lp/programmatic/dtr-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVar),
      }).catch(() => {});
    }
  };

  const handleDeleteVariable = (id: number) => {
    setDtrRules(dtrRules.filter(v => v.id !== id));
  };

  const generatePreview = () => {
    let preview = previewHeadline;
    dtrRules.slice(0, 3).forEach(rule => {
      const exampleValues: Record<string, string> = {
        city: "Austin",
        company: "TechCorp",
        industry: "Healthcare",
        product: "CRM",
        region: "West Coast",
        company_size: "Mid-Market",
      };
      const value = exampleValues[rule.variable] || rule.defaultValue;
      preview = preview.replace(`{{${rule.variable}}}`, value);
    });
    return preview;
  };

  const handleGeneratePages = () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setGenerationProgress(p => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + Math.random() * 20;
      });
    }, 500);

    fetch(`${API_BASE}/lp/programmatic/bulk-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedTemplate,
        dataRowCount: csvData.length,
        columnMapping,
      }),
    })
      .then(r => r.json() as Promise<{ success: boolean; pagesGenerated: number; batchId: string }>)
      .then(data => {
        clearInterval(interval);
        setGenerationProgress(100);
        if (data.success) {
          setBatches([
            {
              batchId: data.batchId,
              templateName: TEMPLATE_OPTIONS.find(t => t.id.toString() === selectedTemplate)?.name || "Unknown",
              pagesGenerated: data.pagesGenerated,
              createdAt: new Date().toISOString(),
              status: "completed",
            },
            ...batches,
          ]);
          setTimeout(() => {
            setIsGenerating(false);
            setGenerationProgress(0);
            setBulkStep(1);
            setSelectedTemplate("");
          }, 1000);
        }
      })
      .catch(() => {
        clearInterval(interval);
        setIsGenerating(false);
        setGenerationProgress(0);
      });
  };

  const getSourceBadgeColor = (source: string) => {
    const colors: Record<string, string> = {
      url_param: "bg-blue-100 text-blue-800",
      utm: "bg-purple-100 text-purple-800",
      cookie: "bg-green-100 text-green-800",
      api: "bg-orange-100 text-orange-800",
    };
    return colors[source] || "bg-gray-100 text-gray-800";
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      url_param: "URL Param",
      utm: "UTM",
      cookie: "Cookie",
      api: "API",
    };
    return labels[source] || source;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Programmatic Pages</h1>
          <p className="text-lg text-muted-foreground">
            Generate hundreds of personalized landing pages from a single template
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dtr" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dtr" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Dynamic Text Replacement
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Bulk Generator
            </TabsTrigger>
          </TabsList>

          {/* DTR Tab */}
          <TabsContent value="dtr" className="space-y-6">
            {/* Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle>Dynamic Text Replacement</CardTitle>
                <CardDescription>
                  Automatically swap text on your landing page based on URL parameters or visitor data. Transform a single template into hundreds of personalized versions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">How it works:</p>
                      <p className="text-sm text-blue-800 mt-1">
                        {`Create variables like {{city}}, {{company}}, {{industry}}, etc. When users visit your page with URL parameters (e.g., ?city=Austin), these variables automatically swap in real-time.`}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DTR Rules Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>DTR Variables</CardTitle>
                  <CardDescription>Manage variables for text replacement</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={showAddVariable ? "default" : "outline"}
                  onClick={() => setShowAddVariable(!showAddVariable)}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Variable
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddVariable && (
                  <div className="rounded-lg border border-dashed border-muted-foreground/50 p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          Variable Name
                        </label>
                        <Input
                          placeholder="e.g., Region"
                          value={newVariable.name}
                          onChange={e => setNewVariable({ ...newVariable, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          Default Value
                        </label>
                        <Input
                          placeholder="e.g., North America"
                          value={newVariable.defaultValue}
                          onChange={e => setNewVariable({ ...newVariable, defaultValue: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          Source
                        </label>
                        <select
                          value={newVariable.source}
                          onChange={e => setNewVariable({ ...newVariable, source: e.target.value as any })}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                        >
                          <option value="url_param">URL Param</option>
                          <option value="utm">UTM</option>
                          <option value="cookie">Cookie</option>
                          <option value="api">API</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button onClick={handleAddVariable} size="sm" className="flex-1">
                          Add
                        </Button>
                        <Button
                          onClick={() => setShowAddVariable(false)}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {loadingRules ? (
                  <div className="text-center py-8 text-muted-foreground">Loading variables...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left font-semibold px-3 py-2">Variable</th>
                          <th className="text-left font-semibold px-3 py-2">Default Value</th>
                          <th className="text-left font-semibold px-3 py-2">Source</th>
                          <th className="text-left font-semibold px-3 py-2">Example</th>
                          <th className="text-center font-semibold px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dtrRules.map(rule => (
                          <tr key={rule.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="px-3 py-3">
                              <code className="font-mono font-semibold text-sm bg-muted px-2 py-1 rounded">
                                {`{{${rule.variable}}}`}
                              </code>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">{rule.defaultValue}</td>
                            <td className="px-3 py-3">
                              <Badge className={getSourceBadgeColor(rule.source)}>
                                {getSourceLabel(rule.source)}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              ?{rule.paramName}=Austin
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => handleDeleteVariable(rule.id)}
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>See how your template looks with variable substitution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Template Headline
                  </label>
                  <Textarea
                    value={previewHeadline}
                    onChange={e => setPreviewHeadline(e.target.value)}
                    className="min-h-20 font-mono text-sm"
                    placeholder="Enter your template headline with {{variables}}"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Template
                    </p>
                    <p className="text-base font-semibold text-foreground">{previewHeadline}</p>
                  </div>

                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                      Rendered Output
                    </p>
                    <p className="text-base font-semibold text-green-900">{generatePreview()}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto">
                  <div className="mb-1 text-slate-400"># URL Example:</div>
                  <code>https://your-landing-page.com?city=Austin&industry=Healthcare&product=CRM</code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Generator Tab */}
          <TabsContent value="bulk" className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between px-1">
              {[1, 2, 3, 4].map((step, idx) => (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-all ${
                      bulkStep >= step
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {bulkStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  {idx < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded transition-all ${
                        bulkStep > step ? "bg-blue-600" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step Labels */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-center text-muted-foreground">
              <div>Template</div>
              <div>Upload</div>
              <div>Map</div>
              <div>Generate</div>
            </div>

            {/* Step 1: Select Template */}
            {bulkStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Select Base Template</CardTitle>
                  <CardDescription>Choose the template to use for bulk page generation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {TEMPLATE_OPTIONS.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id.toString())}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          selectedTemplate === template.id.toString()
                            ? "border-blue-600 bg-blue-50"
                            : "border-muted hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="font-semibold">{template.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setBulkStep(2)}
                      disabled={!selectedTemplate}
                      className="gap-2"
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Upload Data */}
            {bulkStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Upload Data</CardTitle>
                  <CardDescription>Upload a CSV file with the data for your pages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/50 p-12 text-center hover:border-muted-foreground transition-colors cursor-pointer bg-muted/30">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold mb-1">Drag & drop your CSV file</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-2">Sample CSV structure:</p>
                    <code className="block text-xs bg-muted p-3 rounded overflow-x-auto">
                      company,industry,city,product
                    </code>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setBulkStep(1)}>
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        setCsvData(SAMPLE_CSV_DATA);
                        setBulkStep(3);
                      }}
                      className="gap-2"
                    >
                      Continue with Sample
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Map Columns */}
            {bulkStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 3: Map Columns</CardTitle>
                  <CardDescription>
                    Map CSV columns to template variables ({csvData.length} rows)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column Mapping */}
                    <div>
                      <p className="font-medium text-sm mb-3">Column Mapping</p>
                      <div className="space-y-2">
                        {Object.entries(columnMapping).map(([csvCol, variable]) => (
                          <div key={csvCol} className="flex items-center gap-2">
                            <div className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                              {csvCol}
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <select
                              value={variable}
                              onChange={e => setColumnMapping({ ...columnMapping, [csvCol]: e.target.value })}
                              className="flex-1 px-3 py-2 text-sm border rounded-md bg-white"
                            >
                              <option value="company_name">{`{{company_name}}`}</option>
                              <option value="industry_type">{`{{industry_type}}`}</option>
                              <option value="location">{`{{location}}`}</option>
                              <option value="product_name">{`{{product_name}}`}</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Preview */}
                    <div>
                      <p className="font-medium text-sm mb-3">Data Preview</p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted">
                              {Object.keys(SAMPLE_CSV_DATA[0]).map(key => (
                                <th key={key} className="px-2 py-2 text-left font-semibold">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.slice(0, 4).map((row, idx) => (
                              <tr key={idx} className="border-b hover:bg-muted/50">
                                {Object.values(row).map((val, cellIdx) => (
                                  <td key={cellIdx} className="px-2 py-2 text-muted-foreground">
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setBulkStep(2)}>
                      Back
                    </Button>
                    <Button onClick={() => setBulkStep(4)} className="gap-2">
                      Review & Generate
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Preview & Generate */}
            {bulkStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 4: Preview & Generate</CardTitle>
                  <CardDescription>Review your bulk generation settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1">Template</p>
                      <p className="font-semibold text-sm">
                        {TEMPLATE_OPTIONS.find(t => t.id.toString() === selectedTemplate)?.name}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1">Data Rows</p>
                      <p className="font-semibold text-sm">{csvData.length}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <p className="text-xs text-blue-700 mb-1">Pages Ready</p>
                      <p className="font-semibold text-sm text-blue-900">{csvData.length}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                      <p className="text-xs text-green-700 mb-1">Est. Time</p>
                      <p className="font-semibold text-sm text-green-900">{"~"}5 min</p>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <p className="font-medium text-sm mb-3">Preview First 3 Generated Pages</p>
                    <div className="space-y-2">
                      {csvData.slice(0, 3).map((data, idx) => (
                        <div key={idx} className="rounded-lg border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">Page {idx + 1}</div>
                          <p className="font-mono text-sm">
                            {TEMPLATE_OPTIONS.find(t => t.id.toString() === selectedTemplate)?.name.replace(
                              /\s+/g,
                              "_"
                            )}
                            _
                            {data.company.toLowerCase().replace(/\s+/g, "_")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Headline: Best {data.product} for {data.industry} in {data.city}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generation Progress */}
                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating pages...</span>
                        <span className="font-semibold text-blue-600">{Math.round(generationProgress)}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                          style={{ width: `${generationProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setBulkStep(3)}
                      disabled={isGenerating}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleGeneratePages}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate {csvData.length} Pages
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch History */}
            {batches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Generation History</CardTitle>
                  <CardDescription>Your recent batch generation runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {batches.slice(0, 5).map(batch => (
                      <div key={batch.batchId} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{batch.templateName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {batch.pagesGenerated} pages generated on {new Date(batch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={batch.status === "completed" ? "default" : "secondary"}
                            className={
                              batch.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                          </Badge>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
