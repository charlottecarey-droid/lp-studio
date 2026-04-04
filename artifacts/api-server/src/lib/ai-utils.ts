/**
 * Shared AI utilities used across sales routes (draft-email, person-brief, etc.)
 */

/** Returns the configured AI (OpenAI-compatible) client info, or null. */
export function getAIClient(): { baseURL: string; apiKey: string } | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return { baseURL: integrationBase, apiKey: integrationKey };
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return { baseURL: "https://api.openai.com/v1", apiKey: directKey };
  return null;
}

/** Fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Account briefing data shape (superset used by draft-email & person-brief). */
export type BriefingData = {
  overview?: string;
  tier?: string;
  organizationalModel?: string;
  leadership?: Array<{ name: string; title: string }>;
  sizeAndLocations?: {
    locationCount?: string;
    regions?: string[];
    headquarters?: string;
    ownership?: string;
  };
  recentNews?: Array<{ headline: string; summary: string; date?: string }>;
  buyingCommittee?: Array<{
    role: string;
    painPoints: string;
    recommendedMessage: string;
  }>;
  fitAnalysis?: {
    primaryValueProp?: string;
    keyPainPoints?: string[];
    proofPoints?: string[];
    potentialObjections?: string[];
    recommendedApproach?: string;
  };
  talkingPoints?: string[];
  pageRecommendations?: {
    heroHeadline?: string;
    contentFocus?: string;
    ctaStrategy?: string;
  };
};
