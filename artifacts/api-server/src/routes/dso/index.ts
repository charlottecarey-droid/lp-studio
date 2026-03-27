import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

function getOpenAIClient(): OpenAI | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return new OpenAI({ apiKey: integrationKey, baseURL: integrationBase });
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) {
    return new OpenAI({ apiKey: directKey });
  }
  return null;
}

function getGeminiClient(): GoogleGenAI | null {
  const integrationBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (integrationBase && integrationKey) {
    return new GoogleGenAI({ apiKey: integrationKey, httpOptions: { apiVersion: "", baseUrl: integrationBase } });
  }
  const directKey = process.env.GEMINI_API_KEY;
  if (directKey) {
    return new GoogleGenAI({ apiKey: directKey });
  }
  return null;
}

async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

const router = Router();

// ─── Table name mapping (source name → dso_ prefixed) ───────────────────────
const ALLOWED_TABLES: Record<string, string> = {
  microsites: "dso_microsites",
  practice_signups: "dso_practice_signups",
  microsite_views: "dso_microsite_views",
  microsite_hotlinks: "dso_microsite_hotlinks",
  microsite_events: "dso_microsite_events",
  microsite_alerts: "dso_microsite_alerts",
  microsite_alert_emails: "dso_microsite_alert_emails",
  microsite_ab_tests: "dso_microsite_ab_tests",
  microsite_ab_events: "dso_microsite_ab_events",
  target_contacts: "dso_target_contacts",
  email_lists: "dso_email_lists",
  email_list_members: "dso_email_list_members",
  email_campaigns: "dso_email_campaigns",
  email_campaign_sends: "dso_email_campaign_sends",
  email_outreach_log: "dso_email_outreach_log",
  marketing_templates: "dso_marketing_templates",
  email_unsubscribes: "dso_email_unsubscribes",
  suppressed_emails: "dso_suppressed_emails",
  layout_defaults: "dso_layout_defaults",
  custom_templates: "dso_custom_templates",
  pdf_submissions: "dso_pdf_submissions",
};

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function quoteIdentifier(name: string): string {
  if (!isValidIdentifier(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
}

// ─── Generic CRUD endpoint ───────────────────────────────────────────────────
router.post("/db/:table", async (req: Request, res: Response) => {
  try {
    const sourceTable = req.params.table;
    const dsoTable = ALLOWED_TABLES[sourceTable];
    if (!dsoTable) {
      return res.status(400).json({ error: `Unknown table: ${sourceTable}` });
    }

    const { method, data, filters = [], columns = "*", limit, single, order, range, onConflict, count: countOpt, head } = req.body;
    const quotedTable = quoteIdentifier(dsoTable);

    // Build WHERE clause
    const params: any[] = [];
    let whereClause = "";
    if (filters.length > 0) {
      const parts = filters.map((f: any) => {
        if (!isValidIdentifier(f.field)) throw new Error(`Invalid field: ${f.field}`);
        const col = quoteIdentifier(f.field);
        const idx = params.length + 1;
        const negate = f.negate ? "NOT " : "";

        switch (f.op) {
          case "eq": params.push(f.value); return f.negate ? `${col} != $${idx}` : `${col} = $${idx}`;
          case "neq": params.push(f.value); return f.negate ? `${col} = $${idx}` : `${col} != $${idx}`;
          case "ilike": params.push(f.value); return `${negate}${col} ILIKE $${idx}`;
          case "is": {
            if (f.value === null) return f.negate ? `${col} IS NOT NULL` : `${col} IS NULL`;
            return f.negate ? `${col} IS NULL` : `${col} IS NOT NULL`;
          }
          case "in": {
            const placeholders = (f.value as any[]).map((v) => { params.push(v); return `$${params.length}`; }).join(", ");
            return f.negate ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
          }
          case "gt": params.push(f.value); return f.negate ? `${col} <= $${idx}` : `${col} > $${idx}`;
          case "gte": params.push(f.value); return f.negate ? `${col} < $${idx}` : `${col} >= $${idx}`;
          case "lt": params.push(f.value); return f.negate ? `${col} >= $${idx}` : `${col} < $${idx}`;
          case "lte": params.push(f.value); return f.negate ? `${col} > $${idx}` : `${col} <= $${idx}`;
          default: throw new Error(`Unknown operator: ${f.op}`);
        }
      });
      whereClause = "WHERE " + parts.join(" AND ");
    }

    if (method === "select") {
      // COUNT query (head: true means don't return rows, just the count)
      if (countOpt === "exact") {
        const countResult = await query(`SELECT COUNT(*) FROM ${quotedTable} ${whereClause}`, params);
        const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
        if (head) return res.json({ data: null, count: total });
        // Also return rows alongside count
        const safeColumns = columns === "*" ? "*" : columns.split(",").map((c: string) => {
          const col = c.trim(); if (!isValidIdentifier(col)) throw new Error(`Invalid column: ${col}`); return quoteIdentifier(col);
        }).join(", ");
        const dataResult = await query(`SELECT ${safeColumns} FROM ${quotedTable} ${whereClause}`, params);
        return res.json({ data: dataResult.rows, count: total });
      }

      const safeColumns = columns === "*" ? "*" :
        columns.split(",").map((c: string) => {
          const col = c.trim();
          if (!isValidIdentifier(col)) throw new Error(`Invalid column: ${col}`);
          return quoteIdentifier(col);
        }).join(", ");

      let orderClause = "";
      if (order) {
        if (!isValidIdentifier(order.column)) throw new Error(`Invalid order column`);
        orderClause = `ORDER BY ${quoteIdentifier(order.column)} ${order.ascending ? "ASC" : "DESC"}`;
      }

      let limitClause = "";
      if (range) {
        params.push(range.to - range.from + 1);
        params.push(range.from);
        limitClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
      } else if (limit) {
        params.push(limit);
        limitClause = `LIMIT $${params.length}`;
      }

      const queryStr = `SELECT ${safeColumns} FROM ${quotedTable} ${whereClause} ${orderClause} ${limitClause}`.trim();
      const result = await query(queryStr, params);
      const rows = result.rows as any[];

      if (single) {
        return res.json({ data: rows[0] ?? null });
      }
      return res.json({ data: rows });
    }

    if (method === "insert") {
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length === 0) return res.json({ data: [] });

      const firstRow = rows[0];
      const colNames = Object.keys(firstRow);
      colNames.forEach(c => { if (!isValidIdentifier(c)) throw new Error(`Invalid column: ${c}`); });
      const quotedCols = colNames.map(quoteIdentifier).join(", ");

      const valuesClauses: string[] = [];
      rows.forEach(row => {
        const placeholders = colNames.map(col => {
          const val = row[col];
          params.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
          return `$${params.length}`;
        });
        valuesClauses.push(`(${placeholders.join(", ")})`);
      });

      const queryStr = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${valuesClauses.join(", ")} RETURNING *`;
      const result = await query(queryStr, params)
      const insertedRows = result.rows as any[];
      return res.json({ data: Array.isArray(data) ? insertedRows : (insertedRows[0] ?? null) });
    }

    if (method === "upsert") {
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length === 0) return res.json({ data: [] });

      const firstRow = rows[0];
      const colNames = Object.keys(firstRow);
      colNames.forEach(c => { if (!isValidIdentifier(c)) throw new Error(`Invalid column: ${c}`); });
      const quotedCols = colNames.map(quoteIdentifier).join(", ");

      const valuesClauses: string[] = [];
      rows.forEach(row => {
        const placeholders = colNames.map(col => {
          const val = row[col];
          params.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
          return `$${params.length}`;
        });
        valuesClauses.push(`(${placeholders.join(", ")})`);
      });

      const conflictCol = onConflict ? quoteIdentifier(onConflict) : "id";
      const updateCols = colNames.filter(c => c !== "id" && c !== onConflict)
        .map(c => `${quoteIdentifier(c)} = EXCLUDED.${quoteIdentifier(c)}`).join(", ");

      const queryStr = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${valuesClauses.join(", ")} ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateCols} RETURNING *`;
      const result = await query(queryStr, params)
      const upsertedRows = result.rows as any[];
      return res.json({ data: Array.isArray(data) ? upsertedRows : (upsertedRows[0] ?? null) });
    }

    if (method === "update") {
      if (!data || filters.length === 0) {
        return res.status(400).json({ error: "Update requires data and at least one filter" });
      }
      const updateEntries = Object.entries(data);
      updateEntries.forEach(([c]) => { if (!isValidIdentifier(c)) throw new Error(`Invalid column: ${c}`); });
      const setClauses = updateEntries.map(([col, val]) => {
        params.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
        return `${quoteIdentifier(col)} = $${params.length}`;
      }).join(", ");

      const queryStr = `UPDATE ${quotedTable} SET ${setClauses} ${whereClause} RETURNING *`;
      const result = await query(queryStr, params)
      const rows = result.rows as any[];
      return res.json({ data: rows });
    }

    if (method === "delete") {
      const queryStr = `DELETE FROM ${quotedTable} ${whereClause}`;
      await query(queryStr, params)
      return res.json({ data: null });
    }

    return res.status(400).json({ error: `Unknown method: ${method}` });
  } catch (err: any) {
    console.error("DSO DB error:", err);
    return res.status(500).json({ error: err.message || "Database error" });
  }
});

// ─── Storage (local disk for dev) ────────────────────────────────────────────
const STORAGE_DIR = path.join(process.cwd(), ".dso-storage");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({ dest: path.join(STORAGE_DIR, "tmp") });

router.post("/storage/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    const bucket = (req.body.bucket as string) || "default";
    const filePath = (req.body.path as string) || (req.file?.originalname ?? "file");
    const dir = path.join(STORAGE_DIR, bucket, path.dirname(filePath));
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(STORAGE_DIR, bucket, filePath);
    if (req.file) fs.renameSync(req.file.path, dest);
    res.json({ path: filePath, bucket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/storage/list", (req: Request, res: Response) => {
  const bucket = (req.query.bucket as string) || "default";
  const prefix = (req.query.prefix as string) || "";
  const dir = path.join(STORAGE_DIR, bucket, prefix);
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const files = fs.readdirSync(dir).map(name => ({ name, id: name }));
  res.json({ files });
});

router.get("/storage/file", (req: Request, res: Response) => {
  const bucket = (req.query.bucket as string) || "default";
  const filePath = (req.query.path as string) || "";
  if (!filePath) return res.status(400).json({ error: "Missing path" });
  const safeFilePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.join(STORAGE_DIR, bucket, safeFilePath);
  if (!fullPath.startsWith(STORAGE_DIR)) return res.status(400).json({ error: "Invalid path" });
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Not found" });
  res.sendFile(fullPath);
});

router.post("/storage/delete", (req: Request, res: Response) => {
  const { bucket, paths } = req.body as { bucket: string; paths: string[] };
  for (const p of paths || []) {
    const fullPath = path.join(STORAGE_DIR, bucket, p);
    if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { force: true });
  }
  res.json({ deleted: paths?.length ?? 0 });
});

// ─── Functions proxy ──────────────────────────────────────────────────────────
router.post("/functions/:name", async (req: Request, res: Response) => {
  const name = req.params.name;
  const body = req.body;

  if (name === "verify-admin-password") return handleVerifyPassword(req, res, body);
  if (name === "generate-email") return handleGenerateEmail(req, res, body);
  if (name === "account-briefing") return handleAccountBriefing(req, res, body);
  if (name === "import-contacts") return handleImportContacts(req, res, body);
  if (name === "send-marketing-campaign") return handleSendCampaign(req, res, body);
  if (name === "send-test-email") return handleSendTestEmail(req, res, body);

  return res.status(404).json({ error: `Unknown function: ${name}` });
});

// ─── Tracking endpoints ───────────────────────────────────────────────────────
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

router.get("/track-email-open", async (req: Request, res: Response) => {
  const id = req.query.id as string;
  if (id) {
    try {
      await query(
        `UPDATE "dso_email_campaign_sends" SET opened_at = NOW() WHERE id = $1 AND opened_at IS NULL`,
        [id]
      );
    } catch {}
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.send(PIXEL);
});

router.get("/track-email-click", async (req: Request, res: Response) => {
  const { campaign_id, contact_id, url: destination } = req.query as Record<string, string>;
  if (!destination) return res.status(400).send("Missing url");

  if (campaign_id && contact_id) {
    try {
      await query(
        `UPDATE "dso_email_campaign_sends" SET clicked_at = NOW() WHERE campaign_id = $1 AND contact_id = $2 AND clicked_at IS NULL`,
        [campaign_id, contact_id]
      );
    } catch {}
  }
  res.redirect(302, destination);
});

// ─── Handler: verify-admin-password ──────────────────────────────────────────
async function handleVerifyPassword(req: Request, res: Response, body: any) {
  const { password } = body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not configured — set it in environment secrets" });
  }
  const valid = password === adminPassword;
  return res.json({ valid });
}

// ─── Handler: generate-email ──────────────────────────────────────────────────
async function handleGenerateEmail(req: Request, res: Response, body: any) {
  const { prompt } = body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const systemPrompt = "You are an expert B2B sales email copywriter for Dandy, a dental lab platform for DSOs. Write compelling, personalized outreach emails. Output only the email (subject line + body). Nothing else.";

  // GPT-5 — primary
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      });
      const email = response.choices[0]?.message?.content ?? "Could not generate email.";
      return res.json({ email });
    } catch (err: any) {
      // fall through to Gemini
    }
  }

  // Gemini — fallback
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        config: { maxOutputTokens: 8192 },
      });
      const email = response.text ?? "Could not generate email.";
      return res.json({ email });
    } catch (err: any) {
      return res.status(500).json({ error: `AI error: ${err.message}` });
    }
  }

  const email = `Subject: Transforming Lab Operations at ${(prompt.match(/company[:\s]+([^\n,]+)/i) || [])[1] || "your organization"}\n\nHi [First Name],\n\n[No AI provider configured — this is a placeholder.]\n\nBest,\n[Your Name]`;
  return res.json({ email });
}

// ─── Handler: account-briefing ────────────────────────────────────────────────
const DANDY_CONTEXT = `
ABOUT DANDY:
Dandy is an enterprise dental lab platform that drives standardization, operational visibility, and predictable execution for DSOs (Dental Service Organizations). Unlike traditional labs, Dandy combines advanced U.S.-based manufacturing (450K+ sq ft across two U.S. facilities), AI-driven quality control (AI Scan Review), and network-wide analytics (Dandy Insights). Founded in 2019, Dandy has onboarded 8,000+ practices and 100+ corporate accounts with only 1% practice churn.

DANDY'S FOUR PILLARS:
1. Same-Store Growth — Drives measurable revenue growth from existing practices (30% avg case acceptance lift, 300% nightguard volume increase, 40% higher Invisalign/implant acceptance with scan presentation)
2. Network-Wide Standardization — One clinical and operational standard across every practice, every provider, every time. Resolves the "autonomy paradox" — 74% of DSO dentists have autonomy to choose labs, 62% use 3+ labs, creating fragmentation that blocks enterprise leverage.
3. Waste Prevention & Throughput — AI Scan Review catches issues in real time; 89% remake reduction; 96% first-time right rate; remakes eliminated at the source; 2-3 min saved per crown case
4. Executive Visibility & Decision Control — Dandy Insights gives leadership actionable data (not just dashboards) to intervene early and manage by exception

THE $780 CROWN ECONOMICS (Critical Sales Framework):
Most DSO finance teams manage lab spend as % of revenue. This is the WRONG frame. When a practice chases $10 unit savings on a crown:
- Lab unit price "savings": $10
- One remake due to quality variance (8% vs 2% rate): -$285 loss
- One additional appointment (impressions vs digital scan): -$320 opportunity cost
- Scheduling friction and patient dropout (5% vs 2%): -$175 lost revenue
- NET IMPACT of the "cheaper" crown: $780 LOSS per case
At 50,000 annual restorative procedures for a mid-size DSO, that's $2M+ annually in hidden waste from decisions that looked like savings.
The right question isn't "how do we reduce lab costs" — it's "how do lab workflows either enable or constrain enterprise performance?"

LAB RATIONALIZATION PLAYBOOK (Why Preferred Lab Lists Fail):
Most DSOs try two approaches that both fail:
- Option 1 (Centralize aggressively): Gain pricing leverage, but clinician trust erodes. Adoption becomes compliance. Quality issues surface 6 months later.
- Option 2 (Defer to local preference): Preserve autonomy but enterprise leverage never materializes.
- Dandy's Third Path: Embed enterprise standards into technology and workflows that clinicians CHOOSE to use.

THE AUTONOMY PARADOX:
"We can't just make these decisions in a vacuum and force our own agenda for the greater good of the company. These labs are a very personal thing to these providers." — VP of Procurement, 400+ practice DSO
"We kept working on lab consolidation, it didn't move an inch. Fast forward to a partnership with Dandy, we go from no movement to tremendous movement." — Dr. Eric Tobler, Fmr. CCO

DSO TIER CLASSIFICATION:
- Tier 1 (Strategic): 200+ locations, PE-backed or public, mature governance. Care about EBITDA growth, standardization, risk reduction.
- Tier 2 (Large Enterprise): 50-200 practices, actively acquiring. Care about smooth practice onboarding, reducing operational friction.
- Tier 3 (Enterprise): 10-50 locations, founder-led, culture-forward. Care about growing efficiently without enterprise overhead.

DSO BUYING COMMITTEE PERSONAS:
- CEO/President: Enterprise value, scalability, governance.
- CFO: Costs, margins, waste. Use $780 crown economics to reframe cost conversation.
- COO/VP Ops: Visibility, burnout, adoption risk.
- CDO/Chief Clinical Officer: Variability, training, provider trust.
- IT/Procurement: Security, complexity, vendor sprawl.
`;

async function handleAccountBriefing(req: Request, res: Response, body: any) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const { company_name, company_url, additional_context, tier } = body;
    if (!company_name) return res.status(400).json({ success: false, error: "Missing company_name" });

    const allSources: string[] = [];

    // Step 1: Perplexity research (optional — skipped if key not configured)
    let researchText = "";
    if (PERPLEXITY_API_KEY) {
      const perplexityPrompt = `Research this dental DSO company for a B2B sales team at Dandy (a dental lab platform): "${company_name}"${company_url ? ` (website: ${company_url})` : ""}.

Find: executive leadership team, practice count, states/locations, PE backing or ownership structure, recent news, current lab/scanning technology, revenue estimates, and any info relevant to a dental lab partnership conversation.

Be specific and cite sources.`;

      const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [{ role: "user", content: perplexityPrompt }],
          return_citations: true,
        }),
      });

      if (perplexityRes.ok) {
        const perplexityData = await perplexityRes.json() as any;
        researchText = perplexityData.choices?.[0]?.message?.content ?? "";
        const citations = perplexityData.citations ?? [];
        allSources.push(...citations);
      } else {
        console.warn("Perplexity error:", await perplexityRes.text());
      }
    }

    // Step 2: Firecrawl website scrape (optional)
    let websiteContent = "";
    let teamContent = "";
    if (FIRECRAWL_API_KEY && company_url) {
      try {
        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: company_url, formats: ["markdown"], onlyMainContent: true }),
        });
        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json() as any;
          const md = scrapeData.data?.markdown || scrapeData.markdown || "";
          websiteContent = md.length > 8000 ? md.substring(0, 8000) + "\n...[truncated]" : md;
        }

        // Try team/about pages
        const baseUrl = new URL(company_url).origin;
        for (const path of ["/about", "/team", "/leadership", "/about-us", "/our-team"]) {
          try {
            const teamRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: `${baseUrl}${path}`, formats: ["markdown"], onlyMainContent: true }),
            });
            if (teamRes.ok) {
              const td = await teamRes.json() as any;
              const md = td.data?.markdown || td.markdown || "";
              if (md.length > 200) {
                teamContent = md.length > 5000 ? md.substring(0, 5000) + "\n...[truncated]" : md;
                break;
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn("Firecrawl error:", err);
      }
    }

    // Step 3: Gemini/OpenAI synthesis
    const synthPrompt = `${DANDY_CONTEXT}

---
RESEARCH DATA:
Company: ${company_name}${company_url ? ` (${company_url})` : ""}
${additional_context ? `Additional context: ${additional_context}` : ""}
${tier ? `DSO Tier: ${tier}` : ""}

Perplexity Research:
${researchText || "No Perplexity research available."}

${websiteContent ? `Website Content:\n${websiteContent}` : ""}
${teamContent ? `Team/Leadership Page:\n${teamContent}` : ""}

---
Based on the research data above, create a detailed, actionable briefing. Return ONLY valid JSON matching this exact structure (no markdown, no code blocks):

{
  "companyName": "string — short brand name from CRM/website",
  "overview": "string — 2-3 sentences focused on Dandy sales relevance",
  "tier": "string — Tier 1 - Strategic, Tier 2 - Large Enterprise, or Tier 3 - Enterprise",
  "tierRationale": "string — 1 sentence explaining tier classification",
  "organizationalModel": "string — Centralized, Decentralized, or Hybrid",
  "leadership": [{"name": "string", "title": "string", "persona": "string — CEO, CFO, COO, CDO, IT, or Other", "sourceUrl": "string"}],
  "sizeAndLocations": {"practiceCount": "string", "states": ["string"], "headquarters": "string", "estimatedRevenue": "string or null", "peBackerOrOwnership": "string"},
  "recentNews": [{"headline": "string", "summary": "string", "date": "string or null", "dandyRelevance": "string", "sourceUrl": "string"}],
  "currentLabSetup": "string — lab partners, scanning tech, digital maturity. Say Not found if unknown.",
  "buyingCommittee": [{"role": "string", "likelyPainPoints": "string", "recommendedMessage": "string — specific Dandy talking point"}],
  "dandyFitAnalysis": {
    "primaryValueProp": "string — single most compelling value prop for this DSO (150 chars max)",
    "keyPainPoints": ["string"],
    "relevantProofPoints": ["string"],
    "potentialObjections": ["string"],
    "recommendedPilotApproach": "string"
  },
  "micrositeRecommendations": {
    "heroHeadline": "string — compelling headline for personalized microsite",
    "contentFocus": "string — what content angles to emphasize",
    "ctaStrategy": "string — recommended CTA approach"
  }
}`;

    let briefingJson = "";

    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const geminiRes = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: synthPrompt }] }],
          config: { temperature: 0.3, maxOutputTokens: 8192 },
        });
        briefingJson = geminiRes.text ?? "";
      } catch (e) {
        // fall through to OpenAI
      }
    } else if (OPENAI_API_KEY) {
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: synthPrompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
      if (oaiRes.ok) {
        const od = await oaiRes.json() as any;
        briefingJson = od.choices?.[0]?.message?.content ?? "";
      }
    }

    // Parse JSON response — or return a minimal static briefing if no AI configured
    const hasAI = !!(getGeminiClient() || OPENAI_API_KEY);
    let briefing: any;
    if (!briefingJson && !hasAI) {
      briefing = {
        companyName: company_name,
        overview: `${company_name} is a dental DSO. AI synthesis is not yet configured.`,
        tier: tier || "Unknown",
        tierRationale: "AI synthesis not configured.",
        organizationalModel: "Unknown",
        leadership: [],
        sizeAndLocations: { practiceCount: "Unknown", states: [], headquarters: "Unknown", estimatedRevenue: null, peBackerOrOwnership: "Unknown" },
        recentNews: [],
        currentLabSetup: "Not available without AI synthesis.",
        buyingCommittee: [],
        dandyFitAnalysis: {
          primaryValueProp: "AI synthesis not configured.",
          keyPainPoints: [],
          relevantProofPoints: [],
          potentialObjections: [],
          recommendedPilotApproach: "AI synthesis not configured.",
        },
        micrositeRecommendations: { heroHeadline: company_name, contentFocus: "General Dandy value props", ctaStrategy: "Book a demo" },
        _note: researchText ? "Research gathered via Perplexity. AI synthesis is not configured." : "No AI configured. Add PERPLEXITY_API_KEY to enable research.",
        _rawResearch: researchText || null,
      };
    } else {
      try {
        const cleaned = briefingJson.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
        briefing = JSON.parse(cleaned);
      } catch {
        return res.status(500).json({ success: false, error: "Failed to parse AI response as JSON" });
      }
    }

    // Validate source URLs against trusted domains
    const trustedHosts = new Set<string>();
    for (const src of allSources) {
      try { trustedHosts.add(new URL(src).hostname); } catch {}
    }
    if (company_url) {
      try { trustedHosts.add(new URL(company_url).hostname); } catch {}
    }

    const isUrlTrusted = (url: string) => {
      if (!url?.trim()) return false;
      try { return trustedHosts.has(new URL(url).hostname); } catch { return false; }
    };

    if (Array.isArray(briefing.leadership)) {
      briefing.leadership = briefing.leadership.map((l: any) => ({
        ...l, sourceUrl: isUrlTrusted(l.sourceUrl) ? l.sourceUrl : "",
      }));
    }
    if (Array.isArray(briefing.recentNews)) {
      briefing.recentNews = briefing.recentNews.map((n: any) => ({
        ...n, sourceUrl: isUrlTrusted(n.sourceUrl) ? n.sourceUrl : "",
      }));
    }

    return res.json({ success: true, briefing });
  } catch (err: any) {
    console.error("account-briefing error:", err);
    return res.status(500).json({ success: false, error: err.message || "Unknown error" });
  }
}

// ─── Handler: import-contacts ─────────────────────────────────────────────────
async function handleImportContacts(req: Request, res: Response, body: any) {
  const { contacts, clearExisting } = body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: "No contacts provided" });
  }

  if (clearExisting) {
    await query(`DELETE FROM "dso_target_contacts" WHERE id != '00000000-0000-0000-0000-000000000000'`)
  }

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  const BATCH = 100;

  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH);
    for (const c of batch) {
      const contact = {
        salesforce_id: c.salesforceId || c.salesforce_id || null,
        parent_company: c.parentCompany || c.parent_company || "",
        first_name: c.firstName || c.first_name || null,
        last_name: c.lastName || c.last_name || null,
        title: c.title || null,
        title_level: c.titleLevel || c.title_level || null,
        department: c.department || null,
        contact_role: c.contactRole || c.contact_role || null,
        email: c.email || null,
        phone: c.phone || null,
        linkedin_url: c.linkedinUrl || c.linkedin_url || null,
        gender: c.gender || null,
        dso_size: c.dsoSize || c.dso_size || null,
        pe_firm: c.peFirm || c.pe_firm || null,
      };

      try {
        // Check by email first
        let existingId: string | null = null;
        if (contact.email) {
          const r = await query(
            `SELECT id FROM "dso_target_contacts" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [contact.email.trim()]
          );
          if (r.rows.length > 0) existingId = (r.rows[0] as any).id;
        }

        if (!existingId && contact.salesforce_id && contact.first_name && contact.last_name) {
          const r = await query(
            `SELECT id FROM "dso_target_contacts" WHERE salesforce_id = $1 AND LOWER(TRIM(first_name)) = LOWER($2) AND LOWER(TRIM(last_name)) = LOWER($3) LIMIT 1`,
            [contact.salesforce_id, contact.first_name.trim(), contact.last_name.trim()]
          );
          if (r.rows.length > 0) existingId = (r.rows[0] as any).id;
        }

        if (existingId) {
          const setClauses = Object.entries(contact)
            .map(([k], idx) => `"${k}" = $${idx + 2}`).join(", ");
          const vals = Object.values(contact);
          await query(
            `UPDATE "dso_target_contacts" SET ${setClauses} WHERE id = $1`,
            [existingId, ...vals]
          );
          updated++;
        } else {
          const cols = Object.keys(contact).map(k => `"${k}"`).join(", ");
          const placeholders = Object.keys(contact).map((_, i) => `$${i + 1}`).join(", ");
          await query(
            `INSERT INTO "dso_target_contacts" (${cols}) VALUES (${placeholders})`,
            Object.values(contact)
          );
          inserted++;
        }
      } catch (e: any) {
        errors.push(`${contact.first_name ?? "?"} ${contact.last_name ?? "?"}: ${e.message}`);
      }
    }
  }

  return res.json({ success: true, inserted, updated, total: contacts.length, errors: errors.length > 0 ? errors : undefined });
}

// ─── Handler: send-campaign ───────────────────────────────────────────────────
function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [k, v] of Object.entries(vars)) result = result.split(k).join(v);
  return result;
}

function appendUtms(html: string, utmParams: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `href="${url}${sep}${utmParams}"`;
  });
}

function injectTrackingPixel(html: string, trackUrl: string): string {
  const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
  return html.includes("</body>") ? html.replace("</body>", pixel + "</body>") : html + pixel;
}

const SENDER_DOMAIN = "dso.meetdandy.com";
const DEFAULT_SENDER_NAME = "Dandy DSO Partnerships";
const DEFAULT_SENDER_LOCAL = "partnerships";
const DEFAULT_REPLY_TO = "sales@meetdandy.com";

async function sendViaResend(payload: any, resendKey: string): Promise<{ status: "sent" | "failed" | "bounced" }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { status: "sent" };

    const errText = await res.text();
    const isBounce = /bounce|invalid|not found|does not exist|mailbox/i.test(errText);
    if (isBounce) return { status: "bounced" };
    return { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

async function handleSendCampaign(req: Request, res: Response, body: any) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  const { campaign_id } = body;
  if (!campaign_id) return res.status(400).json({ error: "Missing campaign_id" });

  // Load campaign
  const campResult = await query(`SELECT * FROM "dso_email_campaigns" WHERE id = $1`, [campaign_id])
  const campaign = campResult.rows[0] as any;
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  // Load template
  const tplResult = await query(`SELECT * FROM "dso_marketing_templates" WHERE id = $1`, [campaign.template_id])
  const template = tplResult.rows[0] as any;
  if (!template) return res.status(404).json({ error: "Template not found" });

  let templateB: any = null;
  if (campaign.ab_test_enabled && campaign.template_b_id) {
    const r = await query(`SELECT * FROM "dso_marketing_templates" WHERE id = $1`, [campaign.template_b_id])
    templateB = r.rows[0] ?? null;
  }

  // Load list members with contacts
  const membersResult = await query(
    `SELECT tc.* FROM "dso_email_list_members" elm 
     JOIN "dso_target_contacts" tc ON tc.id = elm.contact_id 
     WHERE elm.list_id = $1`,
    [campaign.list_id]
  );
  const allContacts = membersResult.rows as any[];

  if (allContacts.length === 0) {
    await query(`UPDATE "dso_email_campaigns" SET status = 'sent' WHERE id = $1`, [campaign_id])
    return res.json({ message: "No members in list", sent: 0 });
  }

  // Check suppressed/unsubscribed
  const suppressedResult = await query(`SELECT LOWER(email) as email FROM "dso_suppressed_emails"`)
  const suppressedEmails = new Set((suppressedResult.rows as any[]).map(r => r.email));
  const unsubResult = await query(`SELECT LOWER(email) as email FROM "dso_email_unsubscribes"`)
  const unsubEmails = new Set((unsubResult.rows as any[]).map(r => r.email));

  const validContacts = allContacts.filter(c => {
    if (!c.email) return false;
    const e = c.email.toLowerCase();
    return !suppressedEmails.has(e) && !unsubEmails.has(e);
  });

  const suppressedCount = allContacts.length - validContacts.length;

  // A/B split
  const isABTest = campaign.ab_test_enabled && templateB;
  const contactsA = isABTest ? validContacts.filter((_, i) => i % 2 === 0) : validContacts;
  const contactsB = isABTest ? validContacts.filter((_, i) => i % 2 === 1) : [];

  const utmParams = [
    campaign.utm_source ? `utm_source=${campaign.utm_source}` : "",
    campaign.utm_medium ? `utm_medium=${campaign.utm_medium}` : "",
    campaign.utm_campaign ? `utm_campaign=${campaign.utm_campaign}` : "",
    campaign.utm_content ? `utm_content=${campaign.utm_content}` : "",
  ].filter(Boolean).join("&");

  const host = `${req.protocol}://${req.get("host")}`;
  let sentCount = 0;
  let failCount = 0;
  let bounceCount = 0;
  const sendRows: any[] = [];

  const processContact = async (contact: any, tmpl: any, variant: string | null) => {
    if (!contact.email) return;

    const vars: Record<string, string> = {
      "{{first_name}}": contact.first_name ?? "",
      "{{last_name}}": contact.last_name ?? "",
      "{{company}}": contact.parent_company ?? "",
      "{{sender_name}}": campaign.sender_name ?? DEFAULT_SENDER_NAME,
      "{{email}}": contact.email,
    };

    const subject = replaceVars(tmpl.subject ?? "", vars);
    const isPlain = (tmpl.format ?? "html") === "plain";
    let body = replaceVars(isPlain ? (tmpl.plain_body ?? "") : (tmpl.html_body ?? tmpl.plain_body ?? ""), vars);

    if (!isPlain && utmParams) body = appendUtms(body, utmParams);

    const fromName = campaign.sender_name ?? DEFAULT_SENDER_NAME;
    const fromLocal = campaign.sender_email ?? DEFAULT_SENDER_LOCAL;
    const fromAddress = `${fromName} <${fromLocal}@${SENDER_DOMAIN}>`;

    const payload: any = { from: fromAddress, reply_to: campaign.reply_to_email ?? DEFAULT_REPLY_TO, to: [contact.email], subject };
    if (isPlain) { payload.text = body; } else { payload.html = body; }

    const result = await sendViaResend(payload, RESEND_API_KEY!);

    const row: any = {
      campaign_id, contact_id: contact.id, recipient_email: contact.email,
      status: result.status, sent_at: result.status === "sent" ? new Date().toISOString() : null,
    };
    if (variant) row.variant = variant;
    sendRows.push(row);

    if (result.status === "sent") { sentCount++; }
    else if (result.status === "bounced") {
      bounceCount++;
      try {
        await query(
          `INSERT INTO "dso_suppressed_emails" (email, reason) VALUES (LOWER($1), 'bounce') ON CONFLICT (email) DO NOTHING`,
          [contact.email]
        );
      } catch {}
    } else { failCount++; }

    if (validContacts.length > 10) await new Promise(r => setTimeout(r, 200));
  };

  for (const c of contactsA) await processContact(c, template, isABTest ? "A" : null);
  for (const c of contactsB) await processContact(c, templateB, "B");

  // Batch insert send records
  for (let i = 0; i < sendRows.length; i += 200) {
    const batch = sendRows.slice(i, i + 200);
    if (batch.length === 0) continue;
    const cols = Object.keys(batch[0]).map(k => `"${k}"`).join(", ");
    const params: any[] = [];
    const valuesClauses = batch.map(row => {
      const vals = Object.values(row);
      const placeholders = vals.map(v => { params.push(v); return `$${params.length}`; });
      return `(${placeholders.join(", ")})`;
    });
    try {
      await query(`INSERT INTO "dso_email_campaign_sends" (${cols}) VALUES ${valuesClauses.join(", ")}`, params)
    } catch (err) {
      console.error("Failed to insert send records:", err);
    }
  }

  await query(`UPDATE "dso_email_campaigns" SET status = 'sent' WHERE id = $1`, [campaign_id])

  return res.json({ message: "Campaign processed", sent: sentCount, failed: failCount, bounced: bounceCount, suppressed: suppressedCount });
}

// ─── Handler: send-test-email ─────────────────────────────────────────────────
async function handleSendTestEmail(req: Request, res: Response, body: any) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  const { to, subject, html_body, plain_body, format, sender_name, sender_email } = body;
  if (!to || !subject) return res.status(400).json({ error: "Missing required fields: to, subject" });

  const sampleVars: Record<string, string> = {
    "{{first_name}}": "Sarah", "{{last_name}}": "Johnson",
    "{{company}}": "Heartland Dental", "{{email}}": to,
    "{{sender_name}}": sender_name ?? DEFAULT_SENDER_NAME,
  };

  const renderedSubject = replaceVars(subject, sampleVars);
  const isPlain = format === "plain";
  const renderedBody = replaceVars(isPlain ? (plain_body ?? "") : (html_body ?? plain_body ?? ""), sampleVars);

  const fromName = sender_name ?? DEFAULT_SENDER_NAME;
  const fromLocal = sender_email ?? DEFAULT_SENDER_LOCAL;
  const fromAddress = `${fromName} <${fromLocal}@${SENDER_DOMAIN}>`;

  const payload: any = { from: fromAddress, reply_to: DEFAULT_REPLY_TO, to: [to], subject: `[TEST] ${renderedSubject}` };
  if (isPlain) { payload.text = renderedBody; } else { payload.html = renderedBody; }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(payload),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    return res.status(500).json({ error: `Email send failed: ${emailRes.status} ${errText}` });
  }

  return res.json({ message: "Test email sent", to });
}

export default router;
