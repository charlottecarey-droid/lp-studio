import { Router } from "express";

const router = Router();

interface DTRVariable {
  id: number;
  variable: string;
  defaultValue: string;
  source: "url_param" | "utm" | "cookie" | "api";
  paramName: string;
}

interface BatchRequest {
  templateId: string;
  dataRowCount: number;
  columnMapping: Record<string, string>;
}

interface BatchResponse {
  success: boolean;
  pagesGenerated: number;
  batchId: string;
}

interface Batch {
  batchId: string;
  templateName: string;
  pagesGenerated: number;
  createdAt: string;
  status: "completed" | "in_progress" | "failed";
}

// In-memory storage for demonstration
const dtrRulesStore: Map<number, DTRVariable> = new Map([
  [
    1,
    {
      id: 1,
      variable: "city",
      defaultValue: "your city",
      source: "url_param",
      paramName: "city",
    },
  ],
  [
    2,
    {
      id: 2,
      variable: "company",
      defaultValue: "your company",
      source: "url_param",
      paramName: "company",
    },
  ],
  [
    3,
    {
      id: 3,
      variable: "industry",
      defaultValue: "your industry",
      source: "utm",
      paramName: "utm_content",
    },
  ],
  [
    4,
    {
      id: 4,
      variable: "product",
      defaultValue: "our product",
      source: "url_param",
      paramName: "product",
    },
  ],
  [
    5,
    {
      id: 5,
      variable: "region",
      defaultValue: "North America",
      source: "cookie",
      paramName: "region",
    },
  ],
  [
    6,
    {
      id: 6,
      variable: "company_size",
      defaultValue: "Enterprise",
      source: "api",
      paramName: "company_size",
    },
  ],
]);

const batchesStore: Map<string, Batch> = new Map([
  [
    "batch-1",
    {
      batchId: "batch-1",
      templateName: "SaaS Launch Pro",
      pagesGenerated: 150,
      createdAt: "2026-04-03T14:00:00Z",
      status: "completed",
    },
  ],
]);

let nextDtrId = 7;
let batchCount = 1;

// GET /lp/programmatic/dtr-rules
// Returns all dynamic text replacement rules
router.get("/lp/programmatic/dtr-rules", async (_req, res): Promise<void> => {
  try {
    const rules = Array.from(dtrRulesStore.values());
    res.json(rules);
  } catch (error) {
    console.error("Error fetching DTR rules:", error);
    res.status(500).json({ error: "Failed to fetch DTR rules" });
  }
});

// POST /lp/programmatic/dtr-rules
// Create a new dynamic text replacement rule
router.post("/lp/programmatic/dtr-rules", async (req, res): Promise<void> => {
  try {
    const { variable, defaultValue, source, paramName } = req.body;

    if (!variable || !defaultValue || !source || !paramName) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const newRule: DTRVariable = {
      id: nextDtrId++,
      variable,
      defaultValue,
      source,
      paramName,
    };

    dtrRulesStore.set(newRule.id, newRule);

    res.json({
      success: true,
      id: newRule.id,
      rule: newRule,
    });
  } catch (error) {
    console.error("Error creating DTR rule:", error);
    res.status(500).json({ error: "Failed to create DTR rule" });
  }
});

// DELETE /lp/programmatic/dtr-rules/:id
// Delete a dynamic text replacement rule
router.delete("/lp/programmatic/dtr-rules/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid rule ID" });
      return;
    }

    const existed = dtrRulesStore.has(id);
    dtrRulesStore.delete(id);

    if (!existed) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    console.error("Error deleting DTR rule:", error);
    res.status(500).json({ error: "Failed to delete DTR rule" });
  }
});

// POST /lp/programmatic/bulk-generate
// Generate bulk pages from a template and CSV data
router.post("/lp/programmatic/bulk-generate", async (req, res): Promise<void> => {
  try {
    const { templateId, dataRowCount, columnMapping }: BatchRequest = req.body;

    if (!templateId || dataRowCount === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate template ID
    const validTemplates = ["1", "2", "3"];
    if (!validTemplates.includes(templateId)) {
      res.status(400).json({ error: "Invalid template ID" });
      return;
    }

    // Validate data row count
    if (dataRowCount < 1 || dataRowCount > 10000) {
      res.status(400).json({ error: "Invalid data row count" });
      return;
    }

    const templateNames: Record<string, string> = {
      "1": "SaaS Launch Pro",
      "2": "eCommerce Blitz",
      "3": "B2B Lead Gen",
    };

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const batch: Batch = {
      batchId,
      templateName: templateNames[templateId],
      pagesGenerated: dataRowCount,
      createdAt: new Date().toISOString(),
      status: "completed",
    };

    batchesStore.set(batchId, batch);

    const response: BatchResponse = {
      success: true,
      pagesGenerated: dataRowCount,
      batchId,
    };

    res.json(response);
  } catch (error) {
    console.error("Error generating bulk pages:", error);
    res.status(500).json({ error: "Failed to generate bulk pages" });
  }
});

// GET /lp/programmatic/batches
// Retrieve batch generation history
router.get("/lp/programmatic/batches", async (_req, res): Promise<void> => {
  try {
    const batches = Array.from(batchesStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(batches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});

// GET /lp/programmatic/batches/:batchId
// Retrieve details for a specific batch
router.get("/lp/programmatic/batches/:batchId", async (req, res): Promise<void> => {
  try {
    const { batchId } = req.params;

    const batch = batchesStore.get(batchId);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    res.json(batch);
  } catch (error) {
    console.error("Error fetching batch:", error);
    res.status(500).json({ error: "Failed to fetch batch" });
  }
});

// POST /lp/programmatic/preview
// Generate a preview of a page with DTR variables substituted
router.post("/lp/programmatic/preview", async (req, res): Promise<void> => {
  try {
    const { templateContent, variables } = req.body;

    if (!templateContent || !variables) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    let rendered = templateContent;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      rendered = rendered.replace(regex, String(value));
    }

    res.json({
      success: true,
      rendered,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// POST /lp/programmatic/validate-csv
// Validate CSV data and return column information
router.post("/lp/programmatic/validate-csv", async (req, res): Promise<void> => {
  try {
    const { csvContent } = req.body;

    if (!csvContent) {
      res.status(400).json({ error: "Missing CSV content" });
      return;
    }

    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      res.status(400).json({ error: "CSV must contain at least a header and one data row" });
      return;
    }

    const headers = lines[0].split(",").map((h: string) => h.trim());
    const rowCount = lines.length - 1;

    res.json({
      success: true,
      headers,
      rowCount,
      sampleRow: lines[1].split(",").map((v: string) => v.trim()),
    });
  } catch (error) {
    console.error("Error validating CSV:", error);
    res.status(500).json({ error: "Failed to validate CSV" });
  }
});

export default router;
