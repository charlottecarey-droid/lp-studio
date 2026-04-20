import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpBrandSettingsTable } from "@workspace/db";

const router = Router();

const DEFAULT_CONFIG = {
  primaryColor: "#003A30",
  accentColor: "#C7E738",
  navBgColor: "#000000",
  navCtaText: "Get Pricing",
  navCtaUrl: "https://www.meetdandy.com/get-started/",
  defaultCtaText: "Get Started Free",
  defaultCtaUrl: "https://www.meetdandy.com/get-started/",
  copyrightName: "Dandy",
  socialUrls: {
    facebook: "https://www.facebook.com/meetdandy/",
    instagram: "https://www.instagram.com/meetdandy/",
    linkedin: "https://www.linkedin.com/company/meetdandy/",
  },
  // Dandy default typography. Both families are loaded by the lp-studio app
  // shell (Bagoss Standard via local @font-face, Inter via the global stylesheet
  // import in `index.css`) and are listed as `selfHosted` in the font catalog.
  // `BrandFontLoader` therefore skips them — no per-page Google Fonts call is
  // issued for the default brand.
  displayFont: "Bagoss Standard",
  bodyFont: "Inter",
};

router.get("/lp/brand", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const rows = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    res.json(DEFAULT_CONFIG);
    return;
  }
  res.json({ ...DEFAULT_CONFIG, ...(rows[0].config as object) });
});

router.put("/lp/brand", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const config = req.body;
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "Invalid config" });
    return;
  }
  const existing = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (existing.length === 0) {
    const [row] = await db.insert(lpBrandSettingsTable).values({ tenantId, config }).returning();
    res.json(row.config);
  } else {
    const [row] = await db
      .update(lpBrandSettingsTable)
      .set({ config, updatedAt: new Date() })
      .where(and(eq(lpBrandSettingsTable.tenantId, tenantId), eq(lpBrandSettingsTable.id, existing[0].id)))
      .returning();
    res.json(row.config);
  }
});

export default router;
