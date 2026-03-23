import { Router } from "express";
import { db } from "@workspace/db";
import { lpSessionsTable, lpPageVisitsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/lp/analytics/locations", async (_req, res): Promise<void> => {
  try {
    const [sessionCities, visitCities] = await Promise.all([
      db
        .select({
          city: lpSessionsTable.city,
          region: lpSessionsTable.region,
          country: lpSessionsTable.country,
          countryCode: lpSessionsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpSessionsTable)
        .where(sql`${lpSessionsTable.city} is not null`)
        .groupBy(
          lpSessionsTable.city,
          lpSessionsTable.region,
          lpSessionsTable.country,
          lpSessionsTable.countryCode,
        ),
      db
        .select({
          city: lpPageVisitsTable.city,
          region: lpPageVisitsTable.region,
          country: lpPageVisitsTable.country,
          countryCode: lpPageVisitsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpPageVisitsTable)
        .where(sql`${lpPageVisitsTable.city} is not null`)
        .groupBy(
          lpPageVisitsTable.city,
          lpPageVisitsTable.region,
          lpPageVisitsTable.country,
          lpPageVisitsTable.countryCode,
        ),
    ]);

    const merged = new Map<string, { city: string; region: string; country: string; countryCode: string; count: number }>();

    for (const row of [...sessionCities, ...visitCities]) {
      const key = `${row.city ?? ""}|${row.region ?? ""}|${row.country ?? ""}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += row.count;
      } else {
        merged.set(key, {
          city: row.city ?? "",
          region: row.region ?? "",
          country: row.country ?? "",
          countryCode: row.countryCode ?? "",
          count: row.count,
        });
      }
    }

    const results = [...merged.values()].sort((a, b) => b.count - a.count);
    res.json(results);
  } catch (_err) {
    res.json([]);
  }
});

router.get("/lp/analytics/countries", async (_req, res): Promise<void> => {
  try {
    const [sessionRows, visitRows] = await Promise.all([
      db
        .select({
          country: lpSessionsTable.country,
          countryCode: lpSessionsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpSessionsTable)
        .where(sql`${lpSessionsTable.country} is not null`)
        .groupBy(lpSessionsTable.country, lpSessionsTable.countryCode),
      db
        .select({
          country: lpPageVisitsTable.country,
          countryCode: lpPageVisitsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpPageVisitsTable)
        .where(sql`${lpPageVisitsTable.country} is not null`)
        .groupBy(lpPageVisitsTable.country, lpPageVisitsTable.countryCode),
    ]);

    const merged = new Map<string, { country: string; countryCode: string; count: number }>();
    for (const row of [...sessionRows, ...visitRows]) {
      const key = row.country ?? "";
      const existing = merged.get(key);
      if (existing) {
        existing.count += row.count;
      } else {
        merged.set(key, { country: row.country ?? "", countryCode: row.countryCode ?? "", count: row.count });
      }
    }

    const results = [...merged.values()].sort((a, b) => b.count - a.count);
    res.json(results);
  } catch (_err) {
    res.json([]);
  }
});

export default router;
