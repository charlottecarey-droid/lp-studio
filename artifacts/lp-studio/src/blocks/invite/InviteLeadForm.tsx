import { useState } from "react";
import { ArrowRight, Calendar, Check, Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { FormBlockProps } from "@/lib/block-types/generic-blocks";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";
import { InlineText } from "@/components/InlineText";
import { BlockForm } from "../BlockForm";
import { INVITE_BODY, INVITE_DISPLAY, INVITE_PILL_CLASS, pillStyle, type InvitePalette } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

/**
 * The Invite family's lead form. Dark editorial styling (hairline fields on
 * the panel surface), a configurable ≤6-field native form posting to the
 * shared /api/lp/leads pipeline, or the tenant's global form / Marketo embed
 * through <BlockForm> when `formId` / marketo fields are set. Under the
 * button: a risk-reversal line and an optional "pick a time now" link to a
 * Chili Piper booking URL, which also appears as a button on the success state.
 */
export type InviteFormField = "name" | "firstName" | "lastName" | "email" | "phone" | "company" | "locations" | "role" | "message";

export interface InviteFormConfig {
  fields?: InviteFormField[];
  locationOptions?: string[];
  roleOptions?: string[];
  ctaText?: string;
  riskLine?: string;
  successHeadline?: string;
  successMessage?: string;
  chilipiperUrl?: string;
  pickTimeText?: string;
  consentText?: string;
  formId?: number;
  formMode?: "native" | "marketo";
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;
}

export const INVITE_FORM_DEFAULTS: Required<Pick<InviteFormConfig, "fields" | "locationOptions" | "roleOptions" | "ctaText" | "riskLine" | "successHeadline" | "successMessage" | "pickTimeText" | "consentText">> = {
  fields: ["name", "email", "phone", "locations"],
  locationOptions: ["1–9", "10–19", "20–49", "50–199", "200+"],
  roleOptions: ["Executive / C-suite", "Operations", "Clinical leadership", "Finance", "Procurement", "IT", "Other"],
  ctaText: "Reserve my session",
  riskLine: "30 minutes. No commitment.",
  successHeadline: "You're on the list.",
  successMessage: "Watch for a confirmation from the team within one business day.",
  pickTimeText: "or pick a time now",
  consentText: "By submitting, you agree to be contacted about this request.",
};

const LABEL: Record<InviteFormField, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  company: "Company",
  locations: "Number of locations",
  role: "Your role",
  message: "Anything we should know?",
};

interface Props {
  config: InviteFormConfig;
  palette: InvitePalette;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  /** Lead source label saved with the lead. */
  source: string;
  /** Compact = tighter spacing for the hero's inline variant. */
  compact?: boolean;
  onConfigChange?: (patch: Partial<InviteFormConfig>) => void;
}

type FormState = "idle" | "loading" | "success";

export function InviteLeadForm({ config, palette, brand, pageId, variantId, source, compact, onConfigChange }: Props) {
  const ctx = usePageContext();
  const isEditor = !!onConfigChange;
  const fields = config.fields && config.fields.length > 0 ? config.fields : INVITE_FORM_DEFAULTS.fields;
  const locationOptions = config.locationOptions ?? INVITE_FORM_DEFAULTS.locationOptions;
  const roleOptions = config.roleOptions ?? INVITE_FORM_DEFAULTS.roleOptions;
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>("idle");

  const formMode = config.formMode === "marketo" ? "marketo" : "native";
  const hasMarketo = formMode === "marketo" && !!config.marketoBaseUrl && !!config.marketoMunchkinId && !!config.marketoFormId;
  const embedded = hasMarketo || (formMode === "native" && !!config.formId);
  const embeddedForm: FormBlockProps = {
    headline: "",
    subheadline: "",
    multiStep: false,
    steps: [],
    submitButtonText: config.ctaText || INVITE_FORM_DEFAULTS.ctaText,
    successMessage: config.successMessage || INVITE_FORM_DEFAULTS.successMessage,
    redirectUrl: "",
    backgroundStyle: "dark",
    formId: config.formId,
    cardStyle: "flat",
    formMode,
    marketoBaseUrl: config.marketoBaseUrl,
    marketoMunchkinId: config.marketoMunchkinId,
    marketoFormId: config.marketoFormId,
  };

  const text = (key: keyof InviteFormConfig) =>
    onConfigChange ? (v: string) => onConfigChange({ [key]: v } as Partial<InviteFormConfig>) : undefined;

  const openBooking = () => {
    if (!config.chilipiperUrl) return;
    try {
      const url = new URL(config.chilipiperUrl);
      if (values.email) url.searchParams.set("email", values.email);
      const first = values.firstName || (values.name ?? "").split(/\s+/)[0];
      const last = values.lastName || (values.name ?? "").split(/\s+/).slice(1).join(" ");
      if (first) url.searchParams.set("firstname", first);
      if (last) url.searchParams.set("lastname", last);
      safeNavigate(url.toString(), "_blank");
    } catch {
      safeNavigate(config.chilipiperUrl, "_blank");
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isEditor) return;
    setState("loading");
    const pid = pageId ?? ctx.pageId;
    const nameParts = (values.name ?? "").trim().split(/\s+/).filter(Boolean);
    try {
      if (pid) {
        await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: pid,
            variantId: variantId ?? ctx.variantId,
            fields: {
              firstName: values.firstName || nameParts[0] || undefined,
              lastName: values.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined),
              email: values.email,
              phone: values.phone || undefined,
              company: values.company || undefined,
              locations: values.locations || undefined,
              role: values.role || undefined,
              message: values.message || undefined,
              source,
            },
          }),
        });
      }
    } catch {
      // Best-effort capture; the visitor still sees the success state.
    }
    setState("success");
  };

  const fieldStyle: React.CSSProperties = {
    background: "transparent",
    borderBottom: `1px solid ${palette.hairline}`,
    color: palette.text,
    fontFamily: INVITE_BODY,
  };
  const inputCls = "inv-field w-full bg-transparent px-0 py-2.5 text-[15px] outline-none";
  const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em]";

  // Pair first/last (or name/email in compact mode) on one row.
  const rows: InviteFormField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f === "firstName" && fields[i + 1] === "lastName") { rows.push(["firstName", "lastName"]); i++; }
    else rows.push([f]);
  }

  const renderField = (f: InviteFormField) => {
    const id = `inv-${source}-${f}`;
    const common = {
      id,
      name: f,
      className: inputCls,
      style: fieldStyle,
      disabled: state === "loading",
      required: f === "email" || f === "name" || f === "firstName",
      value: values[f] ?? "",
    };
    if (f === "locations" || f === "role") {
      const opts = f === "locations" ? locationOptions : roleOptions;
      return (
        <select {...common} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} style={{ ...fieldStyle, colorScheme: "dark" }}>
          <option value="" disabled>Select…</option>
          {opts.map((o) => <option key={o} value={o} style={{ color: "#0B0B0F" }}>{o}</option>)}
        </select>
      );
    }
    if (f === "message") {
      return <textarea {...common} rows={compact ? 2 : 3} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />;
    }
    return (
      <input
        {...common}
        type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
        autoComplete={f === "email" ? "email" : f === "phone" ? "tel" : f === "name" ? "name" : f === "firstName" ? "given-name" : f === "lastName" ? "family-name" : f === "company" ? "organization" : "off"}
        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
      />
    );
  };

  if (embedded) {
    return <BlockForm props={embeddedForm} brand={brand} pageId={pageId ?? ctx.pageId} variantId={variantId ?? ctx.variantId} />;
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-start gap-3 py-2" role="status" style={{ color: palette.text }}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: palette.accent, color: palette.onAccent }}>
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <p className="text-2xl" style={{ fontFamily: INVITE_DISPLAY, letterSpacing: "-0.02em" }}>{config.successHeadline || INVITE_FORM_DEFAULTS.successHeadline}</p>
        <p className="text-sm leading-relaxed" style={{ color: palette.muted }}>{config.successMessage || INVITE_FORM_DEFAULTS.successMessage}</p>
        {config.chilipiperUrl && (
          <button type="button" onClick={openBooking} className={cn(INVITE_PILL_CLASS, "mt-2")} style={pillStyle(palette)}>
            <Calendar className="h-4 w-4" aria-hidden /> Pick a time now
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={cn("flex flex-col", compact ? "gap-3" : "gap-4")} style={{ color: palette.text }}>
      <style>{`.inv-field::placeholder{color:${palette.faint}} .inv-field:focus{border-bottom-color:${palette.accent}}`}</style>
      {rows.map((row, i) => (
        <div key={i} className={cn("grid gap-4", row.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {row.map((f) => (
            <div key={f}>
              <label htmlFor={`inv-${source}-${f}`} className={labelCls} style={{ color: palette.faint }}>{LABEL[f]}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
      ))}
      <button type="submit" disabled={state === "loading"} className={cn(INVITE_PILL_CLASS, "mt-2 w-full disabled:opacity-70")} style={pillStyle(palette)}>
        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        <InlineText as="span" value={config.ctaText || INVITE_FORM_DEFAULTS.ctaText} onUpdate={text("ctaText")} />
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {(config.riskLine || config.chilipiperUrl || isEditor) && (
        <p className="text-center text-xs" style={{ color: palette.muted }}>
          {(config.riskLine || isEditor) && <InlineText as="span" value={config.riskLine ?? ""} onUpdate={text("riskLine")} />}
          {config.chilipiperUrl && (
            <>
              {config.riskLine ? " " : ""}
              <button type="button" onClick={openBooking} className="font-semibold underline underline-offset-2" style={{ color: palette.text }}>
                <InlineText as="span" value={config.pickTimeText || INVITE_FORM_DEFAULTS.pickTimeText} onUpdate={text("pickTimeText")} />
              </button>
            </>
          )}
        </p>
      )}
      {(config.consentText || isEditor) && (
        <p className="text-[11px] leading-relaxed" style={{ color: palette.faint }}>
          <InlineText as="span" value={config.consentText ?? ""} onUpdate={text("consentText")} multiline />
        </p>
      )}
    </form>
  );
}
