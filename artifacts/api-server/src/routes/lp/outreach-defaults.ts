// Outreach draft copy — the subject + opening lines prefilled into the email a
// rep opens from Pages → Copy email preview → Gmail / Mail.
//
// Three tiers, resolved client-side in that order:
//   1. tenant   — lp_brand_settings.salesConsole.outreachSubject / outreachIntro
//                 (Settings → Email → Sending)
//   2. platform — this single row (Superadmin → Outreach)
//   3. built-in — constants in lp-studio/src/lib/email-preview.ts
//
// Editing the platform row therefore only moves tenants who left their own
// fields blank; it is a default-of-the-default, not an override.
//
//  - GET  /lp/outreach-defaults        — any signed-in user (the sales UI reads
//                                        it to build the draft).
//  - GET  /admin/lp/outreach-defaults  — superadmin: the same row for editing.
//  - PUT  /admin/lp/outreach-defaults  — superadmin: upsert the single row.
//
// Mirrors announcement-banner.ts / homepage-og.ts. Unlike those, the plain GET
// is NOT in LP_PUBLIC: this copy is only ever needed by an authenticated rep,
// so there's no reason to serve it anonymously.

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";

const router = Router();

interface OutreachRow {
  subject: string;
  intro: string;
}

/** Length caps. These strings are pasted into a mail composer, not rendered as
 *  markup, so the risk is a runaway subject line rather than injection — but a
 *  compose URL is a URL, and an unbounded body can blow past what a client will
 *  accept. Generous enough for a real opener, bounded enough to stay safe. */
const MAX_SUBJECT = 300;
const MAX_INTRO = 2000;

function toPublic(r: OutreachRow | undefined) {
  return { subject: r?.subject ?? "", intro: r?.intro ?? "" };
}

async function readRow(): Promise<OutreachRow | undefined> {
  const result = await pool.query<OutreachRow>(
    `SELECT subject, intro FROM platform_outreach_defaults ORDER BY id ASC LIMIT 1`,
  );
  return result.rows[0];
}

router.get("/lp/outreach-defaults", async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /lp/outreach-defaults error:", String(err));
    // Fail soft: the caller falls back to its built-in copy, so a dead row
    // must never cost a rep their draft.
    res.json({ subject: "", intro: "" });
  }
});

router.get("/admin/lp/outreach-defaults", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /admin/lp/outreach-defaults error:", String(err));
    res.status(500).json({ error: "Failed to load outreach defaults" });
  }
});

router.put("/admin/lp/outreach-defaults", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const intro = typeof body.intro === "string" ? body.intro.trim() : "";

    if (subject.length > MAX_SUBJECT) {
      res.status(400).json({ error: `Subject must be ${MAX_SUBJECT} characters or fewer` });
      return;
    }
    if (intro.length > MAX_INTRO) {
      res.status(400).json({ error: `Opening lines must be ${MAX_INTRO} characters or fewer` });
      return;
    }

    await pool.query(
      `INSERT INTO platform_outreach_defaults (id, subject, intro, updated_at)
       VALUES (1, $1, $2, now())
       ON CONFLICT (id) DO UPDATE SET
         subject = EXCLUDED.subject,
         intro = EXCLUDED.intro,
         updated_at = now()`,
      [subject, intro],
    );

    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("PUT /admin/lp/outreach-defaults error:", String(err));
    res.status(500).json({ error: "Failed to save outreach defaults" });
  }
});

export default router;
