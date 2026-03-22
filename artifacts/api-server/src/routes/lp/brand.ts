import { Router } from "express";
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
};

router.get("/lp/brand", async (_req, res): Promise<void> => {
  const rows = await db.select().from(lpBrandSettingsTable).limit(1);
  if (rows.length === 0) {
    res.json(DEFAULT_CONFIG);
    return;
  }
  res.json({ ...DEFAULT_CONFIG, ...(rows[0].config as object) });
});

router.put("/lp/brand", async (req, res): Promise<void> => {
  const config = req.body;
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "Invalid config" });
    return;
  }
  const existing = await db.select().from(lpBrandSettingsTable).limit(1);
  if (existing.length === 0) {
    const [row] = await db.insert(lpBrandSettingsTable).values({ config }).returning();
    res.json(row.config);
  } else {
    const [row] = await db
      .update(lpBrandSettingsTable)
      .set({ config, updatedAt: new Date() })
      .returning();
    res.json(row.config);
  }
});

export default router;
