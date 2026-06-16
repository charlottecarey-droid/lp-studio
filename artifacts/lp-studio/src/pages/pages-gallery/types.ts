import type { PageBlock } from "@/lib/block-types";

export const API_BASE = "/api";

export interface Page {
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  isTemplate?: boolean;
  templateLabel?: string | null;
  templateDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  segmentId?: string | null;
  audienceType?: string | null;
}

export interface Test {
  id: number;
  name: string;
  slug: string;
  status: string;
  testType: string;
  variantCount?: number;
}

export type FilterStatus = "All" | "Mine" | "Draft" | "Published" | "Running" | "Templates";
export type SortBy = "recent" | "author" | "created";

export interface ColumnVisibility {
  author: boolean;
  lastEdited: boolean;
  createdBy: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  author: false,
  lastEdited: false,
  createdBy: false,
};

export const COLUMN_VISIBILITY_STORAGE_KEY = "lpStudio.pagesGallery.columnVisibility.v1";

export interface CreatePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  audienceType?: string | null;
  segmentId?: string | null;
  fromTemplateId?: number | null;
  /** Strict Facts — normalized quote fact-forms trusted because they came from
   *  the per-request generation reference URL. Persisted on the page so the
   *  later /fact-flags/sync never flags them. */
  trustedFactForms?: string[];
}

export interface ApiTemplate {
  id: number;
  /** URL slug of the source template page. Returned by GET /lp/templates and
   *  used to match a generator preset's `tiedTemplateSlug` to a visible
   *  template (the eligibility-gated chip-tie resolution). */
  slug: string;
  title: string;
  templateLabel: string;
  templateDescription: string;
  blockCount: number;
  /** Block-type identifiers in this template; used for audience gating. */
  blockTypes?: string[];
  isGlobal: boolean;
  industry: "dental" | "generic" | null;
  /** Per-workspace "featured" flag (star toggle from the Templates page). When
   *  true, the template is offered as a starting point under "Featured" in the
   *  create-page modal. Managed from the Template Marketplace, read-only here. */
  featured?: boolean;
  /** Creation timestamp (ISO string). Drives the "Newest" ordering that
   *  mirrors the Template Library's default sort in the create dialog. */
  createdAt?: string;
}

export interface PerfScore {
  cvr: number;
  scroll: number;
  engagement: number;
  composite: number;
  visits: number;
}
