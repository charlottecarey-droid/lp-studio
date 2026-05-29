import { Router } from "express";
import { z } from "zod";
import { getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { callAIChat, aiErrorMessage } from "../../lib/ai-utils";

const router = Router();

/* ------------------------------------------------------------------------- */
/* POST /lp/rss/extract-guests                                               */
/*                                                                           */
/* Podcast RSS feeds carry NO structured guest field — the host/author tag   */
/* is the show producer, and the guest's identity only ever appears inside   */
/* the episode title and description prose. This endpoint reads that prose   */
/* and extracts the guest's name / title / company so the Content Series     */
/* editor can populate the per-episode guest fields (which drive the hero    */
/* when a visitor lands via ?episode=<slug>).                                */
/*                                                                           */
/* Auth-gated (editor action) + rate-limited (costs an AI call).            */
/* Body: { episodes: [{ title, description }] }                              */
/* Returns: { guests: [{ guestName, guestTitle, guestCompany }] } aligned    */
/* by index with the input episodes. Fields are "" when no guest is present  */
/* (e.g. a solo/host-only episode) — never guessed.                          */
/* ------------------------------------------------------------------------- */

const BodySchema = z.object({
  episodes: z
    .array(
      z.object({
        title: z.string().max(500).default(""),
        description: z.string().max(8000).default(""),
      }),
    )
    .min(1)
    .max(50),
});

interface ExtractedGuest {
  guestName: string;
  guestTitle: string;
  guestCompany: string;
}

const SYSTEM_PROMPT = `You extract the featured GUEST's identity from podcast episode metadata.

You are given a JSON array of episodes, each with an index "i", a "title", and a "description". For each episode, identify the single primary guest being interviewed and return their name, professional title/role, and company/organization.

Rules:
- The guest is the person being INTERVIEWED, never the show, host, or producer. Ignore the podcast's own name and host.
- Use ONLY information stated in that episode's title/description. Do not invent, infer beyond the text, or pull from outside knowledge.
- If a field is not clearly stated, return an empty string "" for it. If there is no guest at all (solo or host-only episode), return "" for all three fields.
- "guestName": person's full name including honorifics if present (e.g. "Dr. Trey Mueller"). If two co-guests are clearly featured, join with " & ".
- "guestTitle": their role/title (e.g. "Chief Clinical Officer", "CEO & Founder"). No company name here.
- "guestCompany": their organization/company (e.g. "Dental Care Alliance"). No title here.
- Do NOT duplicate the company inside guestTitle or vice versa.

Return ONLY valid JSON of the exact shape:
{"guests":[{"i":0,"guestName":"","guestTitle":"","guestCompany":""}, ...]}
Include one object per input episode, matched by its "i" index.`;

router.post(
  "/lp/rss/extract-guests",
  aiLightLimiter,
  aiLightHourlyLimiter,
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A non-empty episodes array is required." });
      return;
    }
    const { episodes } = parsed.data;

    const userPayload = JSON.stringify(
      episodes.map((e, i) => ({
        i,
        title: e.title.slice(0, 500),
        description: e.description.slice(0, 2500),
      })),
    );

    try {
      const content = await callAIChat({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        temperature: 0,
        responseFormat: { type: "json_object" },
        geminiFallbackModel: "gemini-2.5-flash",
      });

      let raw: { guests?: Array<{ i?: number; guestName?: string; guestTitle?: string; guestCompany?: string }> };
      try {
        raw = JSON.parse(content) as typeof raw;
      } catch {
        res.status(502).json({ error: "AI returned a malformed response. Please try again." });
        return;
      }

      // Re-align by index so the response order always matches the input order,
      // and coerce every field to a trimmed string (never undefined/null).
      const byIndex = new Map<number, ExtractedGuest>();
      for (const g of raw.guests ?? []) {
        if (typeof g.i !== "number") continue;
        byIndex.set(g.i, {
          guestName: String(g.guestName ?? "").trim(),
          guestTitle: String(g.guestTitle ?? "").trim(),
          guestCompany: String(g.guestCompany ?? "").trim(),
        });
      }
      const guests: ExtractedGuest[] = episodes.map(
        (_, i) => byIndex.get(i) ?? { guestName: "", guestTitle: "", guestCompany: "" },
      );

      res.json({ guests });
    } catch (err) {
      const { status, message } = aiErrorMessage(err, "Failed to extract guests");
      req.log?.error?.({ err }, "extract-guests failed");
      res.status(status).json({ error: message });
    }
  },
);

export default router;
