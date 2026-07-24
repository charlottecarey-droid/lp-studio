/**
 * Shared Resend domain-verification vocabulary. Used by the Settings →
 * Email → Sending page (which owns the sender-identity + domain wizards)
 * and by the Sales Console Setup-status checklist on Brand Settings
 * (which only *reads* verification state to render readiness hints).
 */

export interface SalesBrandSetupSummary {
  hasSendingDomain: boolean;
  hasSendingDomainConfigured?: boolean;
  hasSendingDomainVerified?: boolean;
  hasReplyTo: boolean;
  hasSenderName: boolean;
  hasSenderLocalPart: boolean;
  hasValuePropPairs: boolean;
  isReadyToSend: boolean;
}

export type DomainVerificationState =
  | "verified"
  | "pending"
  | "not_started"
  | "failed"
  | "temporary_failure"
  | "unknown"
  | "not_found"
  | "not_configured"
  | "api_unavailable";

export interface DomainVerification {
  status: DomainVerificationState;
  domain: string;
  checkedAt: number;
  provider: "resend";
}

export const RESEND_DOMAINS_DASHBOARD_URL = "https://resend.com/domains";

export function describeDomainVerification(v: DomainVerification | null): {
  label: string;
  tone: "verified" | "pending" | "neutral";
  detail: string;
} {
  if (!v) return { label: "Checking…", tone: "neutral", detail: "Fetching DNS status from Resend." };
  switch (v.status) {
    case "verified":
      return { label: "Verified", tone: "verified", detail: "Resend reports SPF/DKIM are live for this domain." };
    case "pending":
      return { label: "Pending DNS", tone: "pending", detail: "Resend is still waiting for SPF/DKIM records to propagate." };
    case "not_started":
      return { label: "Pending DNS", tone: "pending", detail: "DNS verification hasn't started yet in Resend." };
    case "failed":
      return { label: "DNS failed", tone: "pending", detail: "Resend couldn't verify this domain's DNS records." };
    case "temporary_failure":
      return { label: "Pending DNS", tone: "pending", detail: "Temporary verification failure — Resend will retry." };
    case "not_found":
      return { label: "Not in Resend", tone: "pending", detail: "This domain isn't registered in your Resend account yet." };
    case "not_configured":
      return { label: "Not set", tone: "neutral", detail: "No sending domain is configured." };
    case "api_unavailable":
      return { label: "Status unavailable", tone: "neutral", detail: "Couldn't reach Resend to confirm DNS status." };
    default:
      return { label: "Unknown", tone: "neutral", detail: "Resend returned an unrecognized status." };
  }
}

/** Badge classes for the three verification tones, shared by every pill. */
export function domainVerificationPillClass(tone: "verified" | "pending" | "neutral"): string {
  return tone === "verified"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : tone === "pending"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-slate-300 bg-slate-50 text-slate-600";
}
