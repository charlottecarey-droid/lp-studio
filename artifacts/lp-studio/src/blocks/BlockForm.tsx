import { useState, useRef, useEffect, useMemo } from "react";
import type { FormBlockProps, FormField, FormStep, StepCondition } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";

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
}: {
  field: FormField;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const baseInput = "w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 transition-colors";
  const borderClass = error ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-blue-300";

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseInput} ${borderClass} resize-none`}
        aria-invalid={!!error}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${baseInput} ${borderClass}`}
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
          className="w-4 h-4 accent-current"
        />
        <span className="text-sm text-gray-700">{field.placeholder || field.label}</span>
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
      placeholder={field.placeholder}
      className={`${baseInput} ${borderClass}`}
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

export function BlockForm({ props, brand, pageId, variantId, sessionId }: Props) {
  const bgStyles: Record<string, string> = {
    "white": "bg-white",
    "light-gray": "bg-gray-50",
    "dark": "bg-[#003A30] text-white",
    "muted": "bg-[hsl(42,18%,96%)]",
    "dandy-green": "bg-[#003A30] text-white",
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
      const body: Record<string, unknown> = {
        fields: allFields,
      };
      if (pageId != null) body.pageId = pageId;
      if (variantId != null) body.variantId = variantId;
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

  const accentColor = props.submitButtonColor || brand.primaryColor || "#C7E738";

  const bgInlineStyle = props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined;

  if (submitted) {
    return (
      <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-16 px-4`} style={bgInlineStyle}>
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: `${accentColor}22` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" className="w-8 h-8">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {activeSuccessMessage || "Thank you!"}
          </h3>
        </div>
      </section>
    );
  }

  return (
    <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-16 px-4`} style={bgInlineStyle}>
      <div className="max-w-xl mx-auto">
        {(props.headline || props.subheadline) && (
          <div className="text-center mb-8">
            {props.headline && (
              <h2 className={`text-3xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p className={`text-base ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                {props.subheadline}
              </p>
            )}
          </div>
        )}

        <div className={`rounded-xl shadow-sm border p-8 ${isDark ? "bg-white/10 border-white/20" : "bg-white border-gray-200"}`}>
          {activeMultiStep && totalSteps > 1 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-600"}`}>
                  Step {clampedStep + 1} of {totalSteps}
                </span>
                {step.title && (
                  <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {step.title}
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${((clampedStep + 1) / totalSteps) * 100}%`, background: accentColor }}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {visibleFields.map(field => (
              <div key={field.id}>
                {field.type !== "checkbox" && (
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                )}
                <FieldInput
                  field={field}
                  value={fieldValues[field.id] ?? ""}
                  error={fieldErrors[field.id] ?? null}
                  onChange={val => {
                    setFieldValues(prev => ({ ...prev, [field.id]: val }));
                    setFieldErrors(prev => ({ ...prev, [field.id]: null }));
                  }}
                />
                {fieldErrors[field.id] && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>

          <input ref={honeypotRef} type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

          {submitError && (
            <p className="text-sm text-red-500 mt-4">{submitError}</p>
          )}

          <div className="mt-6 flex gap-3">
            {activeMultiStep && clampedStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(s => s - 1)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${isDark ? "border-white/30 text-white hover:bg-white/10" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: accentColor, color: props.submitButtonTextColor ?? (isDark ? "#003A30" : "#1a1a1a") }}
            >
              {submitting ? "Submitting…" : isLastStep ? (activeSubmitText || "Submit") : "Next"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
