/**
 * Pure merge/prefill helpers for the new-tenant onboarding "import brand from a
 * website" path. These were extracted out of `OnboardingWizard.tsx` so the
 * precedence rules (reviewed fields beat imported ones, salesConsole merges
 * without dropping existing keys, the UI-only `logoAlternates` list is stripped,
 * and the tagline falls back to imported values only when the user leaves it
 * blank) can be unit-tested in isolation and locked against silent regressions.
 *
 * Keeping them framework-free (no React, no fetch) means the component can stay
 * a thin wrapper of state + setters and the behavior lives in one tested place.
 */

import type { BrandConfig } from "./brand-config";
import type { BrandImportResult } from "./brand-import-client";

/** A fully-specified 6-digit hex color (e.g. `#1a2b3c`). Half-typed or named
 *  colors are rejected so we never persist an unrenderable brand color. */
export const isFullHex = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * The user-reviewed brand fields collected by the wizard's name/logo/colors
 * steps. These always take precedence over anything the importer proposed.
 */
export interface ReviewedBrandFields {
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
}

/**
 * Prefill values derived from a successful import, ready to drive the wizard's
 * state setters. Color/text fields are `undefined` when the importer didn't
 * produce a usable value, so the caller leaves the existing default in place
 * (mirroring the original `if (...) setX(...)` guards).
 */
export interface OnboardingImportPrefill {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  /** True when the importer returned no usable primary OR accent color, so the
   *  Colors step should own up to showing defaults instead of pretending they
   *  were imported. */
  colorImportFailed: boolean;
  /** Full proposed field map to persist at finish, minus the UI-only
   *  `logoAlternates` picker list, with the chosen logo pinned into `logoUrl`. */
  proposedForSave: Record<string, unknown>;
  /** Canonical source URL to record for provenance (importer's resolved URL,
   *  falling back to what the user typed). */
  sourceUrl: string;
}

/**
 * Turn a raw {@link BrandImportResult} into the prefill the wizard applies after
 * an import succeeds. `requestUrl` is what the user typed, used as the fallback
 * provenance URL when the importer doesn't echo a resolved `sourceUrl`.
 */
export function computeImportPrefill(
  imported: BrandImportResult,
  requestUrl: string,
): OnboardingImportPrefill {
  const p = imported.proposed;

  const brandName =
    typeof p.brandName === "string" && p.brandName.trim()
      ? p.brandName.trim()
      : undefined;

  const tg = Array.isArray(p.taglines)
    ? p.taglines.find((t) => typeof t === "string" && t.trim())
    : undefined;
  const tagline = typeof tg === "string" ? tg.trim() : undefined;

  // Prefer the top-ranked logo candidate; fall back to the flat logoUrl.
  const pickedLogo =
    imported.logoAlternates?.[0]?.url ??
    (typeof p.logoUrl === "string" ? p.logoUrl : "");

  const gotPrimary = typeof p.primaryColor === "string" && isFullHex(p.primaryColor);
  const gotAccent = typeof p.accentColor === "string" && isFullHex(p.accentColor);

  // Keep the full proposed map (minus the UI-only logo picker list) so the
  // richer fields are saved at finish. Pin the chosen logo into it.
  const proposedForSave: Record<string, unknown> = { ...p };
  delete proposedForSave.logoAlternates;
  if (pickedLogo) proposedForSave.logoUrl = pickedLogo;

  return {
    brandName,
    tagline,
    logoUrl: pickedLogo || undefined,
    primaryColor: gotPrimary ? (p.primaryColor as string) : undefined,
    accentColor: gotAccent ? (p.accentColor as string) : undefined,
    colorImportFailed: !gotPrimary && !gotAccent,
    proposedForSave,
    sourceUrl: imported.sourceUrl ?? requestUrl,
  };
}

/**
 * Build the final {@link BrandConfig} to persist when the wizard finishes.
 *
 * Precedence, highest-wins:
 *   1. The user's reviewed `brandName`, `logoUrl`, `primaryColor`,
 *      `accentColor` (and the CTA colors derived from them).
 *   2. The imported `proposed` fields (fonts, voice, messaging, products, …).
 *   3. The tenant's `existing` config (anything neither the user nor the
 *      importer touched).
 *
 * `salesConsole` is deep-merged a single level so imported sales fields don't
 * wipe existing ones. `logoAlternates` (a UI-only picker list) is always
 * stripped. The tagline falls back to imported → existing only when the user
 * left it blank. Colors that aren't full hex fall back to safe defaults.
 *
 * @param importedProposed the persisted proposed map, or `null` when the user
 *   skipped the import or it failed (so nothing imported is merged in).
 */
export function buildOnboardingBrandConfig(
  existing: BrandConfig,
  importedProposed: Record<string, unknown> | null,
  reviewed: ReviewedBrandFields,
): BrandConfig {
  const safeColor = (v: string, fallback: string) => (isFullHex(v) ? v : fallback);
  const safePrimary = safeColor(reviewed.primaryColor, "#1a1a2e");
  const safeAccent = safeColor(reviewed.accentColor, "#4f46e5");

  // Merge the imported brand fields under the user's reviewed values below.
  const proposed: Record<string, unknown> = { ...(importedProposed ?? {}) };
  delete proposed.logoAlternates;

  const mergedSalesConsole =
    proposed.salesConsole && typeof proposed.salesConsole === "object"
      ? { ...(existing.salesConsole ?? {}), ...(proposed.salesConsole as Record<string, unknown>) }
      : existing.salesConsole;

  return {
    ...existing,
    ...proposed,
    ...(mergedSalesConsole ? { salesConsole: mergedSalesConsole } : {}),
    brandName: reviewed.brandName.trim(),
    taglines: reviewed.tagline.trim()
      ? [reviewed.tagline.trim()]
      : Array.isArray(proposed.taglines)
        ? (proposed.taglines as string[])
        : existing.taglines,
    logoUrl: reviewed.logoUrl || existing.logoUrl,
    primaryColor: safePrimary,
    accentColor: safeAccent,
    ctaBackground: safeAccent,
    ctaText: safePrimary,
  } as BrandConfig;
}
