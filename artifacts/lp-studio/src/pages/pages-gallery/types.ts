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
export type SortBy = "recent" | "author";

export interface CreatePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  audienceType?: string | null;
  segmentId?: string | null;
  fromTemplateId?: number | null;
}

export interface ApiTemplate {
  id: number;
  title: string;
  templateLabel: string;
  templateDescription: string;
  blockCount: number;
  /** Block-type identifiers in this template; used for audience gating. */
  blockTypes?: string[];
  isGlobal: boolean;
  industry: "dental" | "generic" | null;
}

export interface PerfScore {
  cvr: number;
  scroll: number;
  engagement: number;
  composite: number;
  visits: number;
}
