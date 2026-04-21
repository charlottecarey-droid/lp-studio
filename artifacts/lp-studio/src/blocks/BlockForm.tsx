import { useState, useRef, useEffect, useMemo } from "react";
import type { FormBlockProps, FormField, FormStep, StepCondition } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";
import { MarketoForm } from "@/components/MarketoForm";

const API_BASE = "/api";

/** Evaluate a StepCondition against the current field values */
function evalCondition(cond: StepCondition, values: Record<string, string>): boolean {
  const actual = (values[cond.fieldId] ?? "").trim().toLowerCase();
  const expected = cond.value.trim().toLowerCase();
  switch (cond.operator) {
    case "equals": return actual === expected;
    case "not_equals": return actual !== expected;
    case "contains": return actual.includes(expected);
    case "any_of": return expected.split("|").map(s => s.trim().toLowerCase()).includes(actual);
    default: return true;
  }
}

interface GlobalFormConfig {
  id: number;
  steps: FormStep[];
  multiStep: boolean;
  submitButtonText: string;
  successMessage: string | null;
  redirectUrl: string | null;
}

interface Props {
  props: FormBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
  /** Pre-fill values for matching fields. Email maps to the first email-type field, etc. */
  prefill?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
  };
}

function validateField(field: FormField, value: string): string | null {
  if (field.required && !value.trim()) return `${field.label} is required`;
  if (!value.trim()) return null;
  if (field.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address";
  }
  if (field.type === "phone") {
    if (!/^[\d\s()\-+.]{7,}$/.test(value)) return "Please enter a valid phone number";
  }
  return null;
}

function FieldInput({
  field,
  value,
  error,
  onChange,
  inputRadius,
  inputAccentColor,
  isDark,
}: {
  field: FormField;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  inputRadius: string;
  inputAccentColor: string;
  isDark: boolean;
}) {
  const baseInput = `w-full px-4 py-3.5 text-base outline-none transition-colors border ${inputRadius} ${isDark ? "bg-white/95 text-slate-900" : "bg-white text-slate-900"}`;
  const borderClass = error ? "border-red-400" : "border-slate-200";
  const focusStyle = { ["--tw-ring-color" as string]: inputAccentColor } as React.CSSProperties;
  const onFocus = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = inputAccentColor; };
  const onBlur = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = ""; };

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseInput} ${borderClass} resize-none`}
        style={focusStyle}
        aria-invalid={!!error}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${baseInput} ${borderClass}`}
        style={focusStyle}
        aria-invalid={!!error}
      >
        <option value="">Select an option…</option>
        {field.options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={e => onChange(e.target.checked ? "true" : "")}
          className="w-4 h-4"
          style={{ accentColor: inputAccentColor }}
        />
        <span className={`text-sm ${isDark ? "text-white/90" : "text-slate-700"}`}>{field.placeholder || field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === "email" ? "email" :
    field.type === "phone" ? "tel" :
    "text";

  return (
    <input
      type={inputType}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={field.placeholder}
      className={`${baseInput} ${borderClass}`}
      style={focusStyle}
      aria-invalid={!!error}
    />
  );
}

const UTM_VARS: Record<string, string> = {
  "{{utm_source}}": "utm_source",
  "{{utm_medium}}": "utm_medium",
  "{{utm_campaign}}": "utm_campaign",
  "{{utm_content}}": "utm_content",
  "{{utm_term}}": "utm_term",
};

function resolveHiddenValue(template: string): string {
  if (!template) return "";
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  let result = template;
  for (const [token, param] of Object.entries(UTM_VARS)) {
    result = result.replaceAll(token, params.get(param) ?? "");
  }
  result = result.replaceAll("{{page_url}}", typeof window !== "undefined" ? window.location.href : "");
  result = result.replaceAll("{{page_title}}", typeof document !== "undefined" ? document.title : "");
  result = result.replaceAll("{{referrer}}", typeof document !== "undefined" ? document.referrer : "");
  return result;
}

export function BlockForm({ props, brand, pageId, variantId, sessionId, prefill }: Props) {
  const bgStyles: Record<string, string> = {
    "white": "bg-white",
    "light-gray": "bg-gray-50",
    "dark": "bg-[var(--brand-primary)] text-white",
    "muted": "bg-[hsl(42,18%,96%)]",
    "dandy-green": "bg-[var(--brand-primary)] text-white",
    "black": "bg-black text-white",
  };

  const isDark = isDarkBg(props.backgroundStyle);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [globalForm, setGlobalForm] = useState<GlobalFormConfig | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.formId) { setGlobalForm(null); return; }
    fetch(`${API_BASE}/lp/forms/${props.formId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: GlobalFormConfig | null) => setGlobalForm(data))
      .catch(() => {});
  }, [props.formId]);

  const allSteps = globalForm?.steps ?? props.steps ?? [];

  // Seed prefill values into matching fields by type / label.
  useEffect(() => {
    if (!prefill) return;
    const labelMatches = (label: string, ...needles: string[]) => {
      const l = label.toLowerCase();
      return needles.some(n => l.includes(n));
    };
    const seeds: Record<string, string> = {};
    for (const s of allSteps) {
      for (const f of s.fields) {
        if (!f.id) continue;
        if (prefill.email && f.type === "email" && !fieldValues[f.id]) {
          seeds[f.id] = prefill.email;
          continue;
        }
        if (prefill.phone && f.type === "phone" && !fieldValues[f.id]) {
          seeds[f.id] = prefill.phone;
          continue;
        }
        if (f.type === "text" && !fieldValues[f.id]) {
          if (prefill.firstName && labelMatches(f.label, "first")) { seeds[f.id] = prefill.firstName; continue; }
          if (prefill.lastName && labelMatches(f.label, "last")) { seeds[f.id] = prefill.lastName; continue; }
          if (prefill.company && labelMatches(f.label, "company", "practice", "organization")) { seeds[f.id] = prefill.company; continue; }
        }
      }
    }
    if (Object.keys(seeds).length > 0) {
      setFieldValues(prev => ({ ...seeds, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSteps, prefill?.email, prefill?.firstName, prefill?.lastName, prefill?.phone, prefill?.company]);
  const activeMultiStep = globalForm?.multiStep ?? props.multiStep;
  const activeSubmitText = globalForm?.submitButtonText ?? props.submitButtonText;
  const activeSuccessMessage = globalForm?.successMessage ?? props.successMessage;
  const activeRedirectUrl = globalForm?.redirectUrl ?? props.redirectUrl;

  // Filter steps by their conditions — only show steps whose condition is met (or have no condition)
  const visibleSteps = useMemo(() =>
    allSteps.filter(s => !s.condition || evalCondition(s.condition, fieldValues)),
    [allSteps, fieldValues]
  );

  const steps = visibleSteps;
  const totalSteps = steps.length;
  // Clamp currentStep if a previously-visible step became hidden
  const clampedStep = Math.min(currentStep, Math.max(totalSteps - 1, 0));
  if (clampedStep !== currentStep) setCurrentStep(clampedStep);
  const step = steps[clampedStep] ?? { title: "", fields: [] };
  const isLastStep = clampedStep === totalSteps - 1;

  // Filter fields within the current step by their visibility conditions; never render hidden fields
  const visibleFields = useMemo(() =>
    step.fields.filter(f => f.type !== "hidden" && (!f.visibilityCondition || evalCondition(f.visibilityCondition, fieldValues))),
    [step.fields, fieldValues]
  );

  const validateStep = () => {
    const errors: Record<string, string | null> = {};
    let hasError = false;
    // Only validate visible fields
    for (const field of visibleFields) {
      const val = fieldValues[field.id] ?? "";
      const err = validateField(field, val);
      errors[field.id] = err;
      if (err) hasError = true;
    }
    setFieldErrors(prev => ({ ...prev, ...errors }));
    return !hasError;
  };

  const handleNext = () => {
    if (validateStep()) setCurrentStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (honeypotRef.current?.value) return;

    setSubmitting(true);
    setSubmitError(null);

    // Submit visible fields + always include hidden fields with resolved values
    const allFields: Record<string, string> = {};
    for (const s of allSteps) {
      for (const field of s.fields) {
        if (field.type === "hidden") {
          allFields[field.label] = resolveHiddenValue(field.defaultValue ?? "");
          continue;
        }
        // Skip steps/fields hidden by conditions
        if (s.condition && !evalCondition(s.condition, fieldValues)) continue;
        if (field.visibilityCondition && !evalCondition(field.visibilityCondition, fieldValues)) continue;
        allFields[field.label] = fieldValues[field.id] ?? "";
      }
    }

    try {
      // Extract UTM params from the current page URL so they are stored as
      // dedicated columns on the lead (not just buried in the fields JSON).
      const urlParams = new URLSearchParams(window.location.search);
      const utmBody: Record<string, string> = {};
      const UTM_KEYS: [string, string][] = [
        ["utm_source", "utmSource"],
        ["utm_medium", "utmMedium"],
        ["utm_campaign", "utmCampaign"],
        ["utm_term", "utmTerm"],
        ["utm_content", "utmContent"],
      ];
      for (const [param, key] of UTM_KEYS) {
        const val = urlParams.get(param);
        if (val) utmBody[key] = val;
      }

      const body: Record<string, unknown> = {
        fields: allFields,
        ...utmBody,
      };
      if (pageId != null) body.pageId = pageId;
      if (variantId != null) body.variantId = variantId;
      if (sessionId) body.sessionId = sessionId;
      if (props.formId != null) body.formId = props.formId;

      if (pageId != null) {
        const resp = await fetch(`${API_BASE}/lp/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error("Submission failed");

        try {
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionId ?? `anon-${Date.now()}`,
              testId: 0,
              variantId: variantId ?? 0,
              eventType: "conversion",
              conversionType: "form_submit",
            }),
          });
        } catch (err) {
          console.error("Form tracking error:", err);
        }

        // Fire a sales signal if this page was opened via a hotlink
        try {
          const hlRaw = sessionStorage.getItem("hl_ctx");
          if (hlRaw) {
            const hlCtx = JSON.parse(hlRaw) as {
              hotlinkId: number;
              contactId: number;
              accountId: number | null;
              token: string;
            };
            await fetch(`${API_BASE}/sales/signals`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "form_submit",
                source: "microsite",
                hotlinkId: hlCtx.hotlinkId,
                contactId: hlCtx.contactId,
                accountId: hlCtx.accountId,
                metadata: { pageId, fields: Object.keys(allFields) },
              }),
            });
          }
        } catch (err) {
          console.error("Sales signal error:", err);
        }
      }

      setSubmitted(true);
      if (activeRedirectUrl) {
        setTimeout(() => { safeNavigate(activeRedirectUrl); }, 1500);
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Brand-aware defaults (Dandy-style)
  const submitBg = props.submitButtonColor || brand.accentColor || "var(--brand-accent)";
  const submitFg = props.submitButtonTextColor || brand.primaryColor || "var(--brand-primary)";
  const inputAccent = props.inputAccentColor || brand.primaryColor || "var(--brand-primary)";
  const cardBg = props.cardBgColor || (isDark ? undefined : "#ffffff");
  const cardStyle = props.cardStyle ?? "elevated";
  const cardRadius = props.cardRadius ?? "2xl";
  const radiusClass = { lg: "rounded-lg", xl: "rounded-xl", "2xl": "rounded-2xl", "3xl": "rounded-3xl" }[cardRadius];
  const inputRadiusClass = { lg: "rounded-md", xl: "rounded-lg", "2xl": "rounded-xl", "3xl": "rounded-2xl" }[cardRadius];
  const btnRadiusClass = inputRadiusClass;
  const cardShadowClass =
    cardStyle === "elevated" ? "shadow-2xl border border-slate-100" :
    cardStyle === "flat" ? "shadow-md border border-slate-200" :
    "border border-slate-200";
  const labelStyle = props.labelStyle ?? "uppercase";
  const labelClass = labelStyle === "uppercase"
    ? `block text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? "text-white/70" : "text-slate-500"}`
    : `block text-sm font-medium mb-1.5 ${isDark ? "text-gray-200" : "text-slate-700"}`;

  const bgInlineStyle = props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined;

  const isMarketo = props.formMode === "marketo";

  if (submitted) {
    return (
      <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-20 px-4`} style={bgInlineStyle}>
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: submitBg }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={submitFg} strokeWidth="2.75" className="w-8 h-8">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-[var(--brand-primary)]"}`}>
            {activeSuccessMessage || "Thank you!"}
          </h3>
        </div>
      </section>
    );
  }

  return (
    <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-20 px-4`} style={bgInlineStyle}>
      <div className="max-w-xl mx-auto">
        {(props.headline || props.subheadline) && (
          <div className="text-center mb-8">
            {props.headline && (
              <h2 className={`text-3xl md:text-4xl font-bold leading-tight mb-3 ${isDark ? "text-white" : "text-[var(--brand-primary)]"}`}>
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p className={`text-base md:text-lg ${isDark ? "text-white/80" : "text-slate-600"}`}>
                {props.subheadline}
              </p>
            )}
          </div>
        )}

        <div
          className={`${radiusClass} ${cardShadowClass} p-8 md:p-10 ${isDark && !cardBg ? "bg-white/10 border-white/20" : ""}`}
          style={cardBg ? { backgroundColor: cardBg } : undefined}
        >
          {isMarketo ? (
            props.marketoBaseUrl && props.marketoMunchkinId && props.marketoFormId ? (
              <MarketoForm
                baseUrl={props.marketoBaseUrl}
                munchkinId={props.marketoMunchkinId}
                formId={props.marketoFormId}
                followUpUrl={activeRedirectUrl || undefined}
                onSuccess={() => setSubmitted(true)}
              />
            ) : (
              <p className={`text-sm ${isDark ? "text-white/70" : "text-slate-500"}`}>
                Marketo form is not configured. Add the instance URL, Munchkin ID, and Form ID in the panel.
              </p>
            )
          ) : (
            <>
          {activeMultiStep && totalSteps > 1 && (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-white/70" : "text-slate-500"}`}>
                  Step {clampedStep + 1} of {totalSteps}
                </span>
                {step.title && (
                  <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-[var(--brand-primary)]"}`}>
                    {step.title}
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${((clampedStep + 1) / totalSteps) * 100}%`, background: submitBg }}
                />
              </div>
            </div>
          )}

          <div className="space-y-5">
            {visibleFields.map(field => (
              <div key={field.id}>
                {field.type !== "checkbox" && (
                  <label className={labelClass}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                )}
                <FieldInput
                  field={field}
                  value={fieldValues[field.id] ?? ""}
                  error={fieldErrors[field.id] ?? null}
                  inputRadius={inputRadiusClass}
                  inputAccentColor={inputAccent}
                  isDark={isDark}
                  onChange={val => {
                    setFieldValues(prev => ({ ...prev, [field.id]: val }));
                    setFieldErrors(prev => ({ ...prev, [field.id]: null }));
                  }}
                />
                {fieldErrors[field.id] && (
                  <p className="text-xs text-red-500 mt-1.5">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>

          <input ref={honeypotRef} type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

          {submitError && (
            <p className="text-sm text-red-500 mt-4">{submitError}</p>
          )}

          <div className="mt-7 flex gap-3">
            {activeMultiStep && clampedStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(s => s - 1)}
                className={`flex-1 py-3.5 px-4 ${btnRadiusClass} text-sm font-semibold border transition-colors ${isDark ? "border-white/30 text-white hover:bg-white/10" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
              disabled={submitting}
              className={`flex-1 py-4 px-4 ${btnRadiusClass} text-base font-bold transition-all hover:brightness-105 disabled:opacity-60`}
              style={{ background: submitBg, color: submitFg }}
            >
              {submitting ? "Submitting…" : isLastStep ? (activeSubmitText || "Submit") : "Next"}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
