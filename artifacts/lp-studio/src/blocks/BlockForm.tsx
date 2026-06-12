import { useState, useRef, useEffect, useMemo } from "react";
import type { FormBlockProps, FormField, FormStep, StepCondition, ChiliPiperHandoffConfig } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex, DEFAULT_BRAND } from "@/lib/brand-config";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";
import { MarketoForm } from "@/components/MarketoForm";
import { MunchkinLoader } from "@/components/MunchkinLoader";
import { ChiliPiperIframe, useChiliPiperBookingTracking } from "@/blocks/ChiliPiperModal";
import { buildChiliPiperHandoffUrl } from "@/lib/chili-piper-handoff";
import { pushMarketoSubmissionToDataLayer, type GtmDataLayerConfig } from "@/lib/gtm-datalayer";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { type FormStyling, mergeFormStyling } from "@/lib/form-styling";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const API_BASE = "/api";

/**
 * Temporarily disabled while the marketing team validates Graham's GTM
 * dataLayer-push approach for landing leads / firing conversion tags. The
 * Forms2 ghost-submit code path (mount hidden MarketoForm + await its
 * onSuccess in handleSubmit) is gated on this flag — flip back to `true`
 * to re-enable Munchkin association + Marketo Smart Campaign triggers.
 */
const GHOST_SUBMIT_ENABLED = false;

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
  /**
   * Human-readable name from the lp_forms row. Surfaced on the public form
   * fetch and used in analytics drill-downs. Optional because older cached
   * payloads may not include it.
   */
  name?: string;
  steps: FormStep[];
  multiStep: boolean;
  submitButtonText: string;
  successMessage: string | null;
  redirectUrl: string | null;
  /**
   * Per-form Chili Piper hand-off. Surfaced from the public form fetch so
   * a tenant's Marketo embed can punt the user into the scheduler with
   * their submitted identity prefilled. URL + field map live on the form
   * record, never in app code, to preserve per-tenant isolation.
   */
  chiliPiperConfig?: ChiliPiperHandoffConfig | null;
  /**
   * Per-form Marketo config. `fieldMappings` (label → Marketo REST name)
   * is used by the server-side REST sync AND by the client-side Forms2
   * "ghost submit" below. When `forms2` is fully populated (baseUrl +
   * munchkinId + formId), every standard-form submit on this global form
   * also fires a hidden Marketo Forms2 submission so the lead lands in
   * Marketo as if it had used the actual Marketo embed (Munchkin cookie
   * association, Smart Campaign triggers, GA4 mktoFormSubmit event).
   */
  marketoConfig?: {
    enabled?: boolean;
    fieldMappings?: Record<string, string>;
    forms2?: {
      baseUrl: string;
      munchkinId: string;
      formId: number;
    };
  } | null;
  /**
   * Per-form GTM dataLayer push override surfaced from
   * `lp_forms.gtm_data_layer_config`. NULL/omitted falls through to the
   * default SMB trios5 / form 6 payload
   * ({ enabled: true, event: "Marketo Form Submission",
   *    formName: "Demo Form" }).
   */
  gtmDataLayerConfig?: GtmDataLayerConfig | null;
  /**
   * Per-form visual styling (FormStyling shape). When populated, BlockForm
   * overrides its block-level surface / input / button / font tokens with
   * these values so a single linked global form carries the Inside Dandy
   * / Apple Vision Pro look across every CTA that references it. NULL or
   * an empty object falls through to the legacy per-block styling path.
   */
  styling?: FormStyling | null;
}

interface Props {
  props: FormBlockProps;
  brand: BrandConfig;
  pageId?: number;
  /**
   * A/B test attribution. Both `testId` and `variantId` are present together
   * (set by the viewer when the page is being rendered as a test variant) or
   * both absent (plain builder page with no test). They flow into the
   * conversion-tracking POSTs unchanged — when absent the POST omits them so
   * the row lands with NULL test_id/variant_id instead of violating the FK.
   */
  testId?: number;
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

/**
 * Live-format a phone number as the visitor types.
 *
 * - A leading `+` switches to international mode: keep the `+`, strip
 *   non-digits, and insert spaces every 3 digits (a loose grouping that
 *   reads correctly for any country code without us shipping a full
 *   metadata library like libphonenumber-js).
 * - 10 digits with no `+` is treated as a US/Canada number and rendered
 *   as `(NNN) NNN-NNNN`.
 * - 11 digits starting with `1` (typical US/Canada with country code)
 *   becomes `+1 (NNN) NNN-NNNN`.
 * - Anything in between just shows the raw digits so the visitor can
 *   keep typing without the formatter "fighting" them.
 */
export function formatPhoneNumber(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  const trimmed = raw.trim();
  const isIntl = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (isIntl) {
    // International: keep `+`, group every 3 digits with spaces.
    const groups = digits.match(/.{1,3}/g) ?? [];
    return `+${groups.join(" ")}`.trimEnd();
  }

  // 11-digit US with leading 1 → render as +1 (NNN) NNN-NNNN.
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Truncate to 10 digits while typing so paste-of-noise doesn't sprawl.
  const d = digits.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Normalize a website / domain string to a bare lowercase host.
 *
 *   "  Https://www.MeetDandy.com/contact/  " → "meetdandy.com/contact"
 *   "WWW.MeetDandy.COM"                       → "meetdandy.com"
 *
 * Run on blur (not on every keystroke) so the visitor isn't fighting the
 * formatter mid-paste. Empty input passes through unchanged.
 */
export function normalizeWebsite(raw: string): string {
  if (typeof raw !== "string") return "";
  let v = raw.trim();
  if (!v) return "";
  // Strip scheme.
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Strip leading `www.`.
  v = v.replace(/^www\./i, "");
  // Drop trailing slashes.
  v = v.replace(/\/+$/, "");
  // Lowercase only the host portion (preserve case-sensitive paths/queries).
  const slash = v.indexOf("/");
  if (slash === -1) return v.toLowerCase();
  return v.slice(0, slash).toLowerCase() + v.slice(slash);
}

/**
 * Heuristic: does this field look like it should hold a website / URL?
 * Triggers domain normalization on blur for the native lp-studio
 * "Practice/Company Website" labelling without requiring a new field type.
 */
function isWebsiteField(field: FormField): boolean {
  if (field.type !== "text") return false;
  const label = (field.label || "").toLowerCase();
  const placeholder = (field.placeholder || "").toLowerCase();
  const haystack = `${label} ${placeholder}`;
  return /\b(website|url|domain)\b/.test(haystack);
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
  errorId,
  onChange,
  inputRadius,
  inputAccentColor,
  isDark,
  inputBg,
  inputBorder,
  inputText,
  fontBody,
}: {
  field: FormField;
  value: string;
  error: string | null;
  /** id of the visible error message element — linked via aria-describedby when an error is shown. */
  errorId?: string;
  onChange: (v: string) => void;
  inputRadius: string;
  inputAccentColor: string;
  isDark: boolean;
  /** FormStyling override — when set, replaces the bg/border/text Tailwind classes with inline styles so AVP-style translucent surfaces work. */
  inputBg?: string;
  inputBorder?: string;
  inputText?: string;
  fontBody?: string;
}) {
  const hasStyling = !!(inputBg || inputBorder || inputText);
  const inputChrome = `w-full px-4 py-3.5 text-base outline-none border transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:ring-2 focus:ring-offset-0 placeholder:text-slate-400 ${inputRadius}`;
  const baseInput = hasStyling
    ? inputChrome
    : `${inputChrome} ${isDark ? "bg-white/95 text-slate-900" : "bg-white text-slate-900"}`;
  const borderClass = error ? "border-red-400" : (hasStyling ? "" : "border-slate-200");
  const focusStyle: React.CSSProperties = {
    ["--tw-ring-color" as string]: inputAccentColor,
    ...(inputBg ? { backgroundColor: inputBg } : null),
    ...(inputBorder && !error ? { borderColor: inputBorder } : null),
    ...(inputText ? { color: inputText } : null),
    ...(fontBody ? { fontFamily: fontBody } : null),
  };
  const onFocus = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = inputAccentColor; };
  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = error ? "" : (inputBorder ?? "");
    // Normalize website-like fields on blur (not while typing) so the
    // visitor's paste isn't mangled mid-flight. Only fires when the
    // result actually differs to avoid a spurious render.
    if (isWebsiteField(field) && value) {
      const normalized = normalizeWebsite(value);
      if (normalized !== value) onChange(normalized);
    }
  };

  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id}
        name={field.id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseInput} ${borderClass} resize-none`}
        style={focusStyle}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
    );
  }

  if (field.type === "select" && field.options) {
    // FormField.options is typed as `string[]`, but historical seed data
    // (and any future hand-edited templates) may store entries as
    // `{label, value}` objects. Coerce both shapes to a uniform
    // `{value, label}` so a stray object never reaches React as a child
    // — that's what produced the minified "objects are not valid as a
    // React child" crash on the Conversion Capture Page template.
    const normalizedOptions = (field.options as Array<unknown>)
      .map((raw): { value: string; label: string } | null => {
        if (typeof raw === "string") return { value: raw, label: raw };
        if (raw && typeof raw === "object") {
          const o = raw as { value?: unknown; label?: unknown };
          const v = typeof o.value === "string" ? o.value : typeof o.label === "string" ? o.label : null;
          const l = typeof o.label === "string" ? o.label : v;
          if (v !== null && l !== null) return { value: v, label: l };
        }
        return null;
      })
      .filter((o): o is { value: string; label: string } => o !== null);
    return (
      <select
        id={field.id}
        name={field.id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${baseInput} ${borderClass}`}
        style={focusStyle}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">Select an option…</option>
        {normalizedOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label htmlFor={field.id} className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: BODY }}>
        <input
          id={field.id}
          name={field.id}
          type="checkbox"
          checked={value === "true"}
          onChange={e => onChange(e.target.checked ? "true" : "")}
          className="w-4 h-4 rounded"
          style={{ accentColor: inputAccentColor }}
        />
        <span className={`text-sm ${isDark ? "text-white/90" : "text-slate-700"}`} style={{ fontFamily: BODY }}>{field.placeholder || field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === "email" ? "email" :
    field.type === "phone" ? "tel" :
    "text";

  return (
    <input
      id={field.id}
      name={field.id}
      type={inputType}
      value={value}
      // Phone inputs run through the live formatter so the visitor sees a
      // properly grouped number as they type — `(555) 123-4567` for US,
      // `+44 20 7946 0958` for international (anything with a leading `+`).
      onChange={e =>
        onChange(
          field.type === "phone"
            ? formatPhoneNumber(e.target.value)
            : e.target.value,
        )
      }
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={field.placeholder}
      className={`${baseInput} ${borderClass}`}
      style={focusStyle}
      aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined}
      // Mobile keyboards: `inputMode="tel"` shows the number pad, and
      // `autoComplete="tel"` lets the OS suggest the user's saved number.
      inputMode={field.type === "phone" ? "tel" : undefined}
      autoComplete={field.type === "phone" ? "tel" : undefined}
    />
  );
}

// URL-param-backed tokens. The right-hand side is the URL query parameter name.
// All of these are also persisted in localStorage on first hit so attribution
// survives page navigation (matches Google Ads / GA's recommended pattern).
const URL_PARAM_TOKENS: Record<string, string> = {
  "{{utm_source}}":   "utm_source",
  "{{utm_medium}}":   "utm_medium",
  "{{utm_campaign}}": "utm_campaign",
  "{{utm_content}}":  "utm_content",
  "{{utm_term}}":     "utm_term",
  "{{utm_ad_id}}":    "utm_ad_id",
  "{{gclid}}":        "gclid",
  "{{fbclid}}":       "fbclid",
  "{{gbraid}}":       "gbraid",
  "{{wbraid}}":       "wbraid",
  "{{msclkid}}":      "msclkid",
};
const LS_PREFIX = "lpstudio_attr_";

function readPersistedParam(name: string): string {
  if (typeof window === "undefined") return "";
  const live = new URLSearchParams(window.location.search).get(name);
  if (live) {
    try { window.localStorage.setItem(LS_PREFIX + name, live); } catch { /* private mode */ }
    return live;
  }
  try { return window.localStorage.getItem(LS_PREFIX + name) ?? ""; } catch { return ""; }
}

// Read the GA4 client ID from the `_ga` cookie (format: GA1.2.<clientId-2-parts>.<timestamp>).
function readGaClientId(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!m) return "";
  const parts = decodeURIComponent(m[1]).split(".");
  // GA1.2.123456789.1700000000 → "123456789.1700000000"
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  return "";
}

function resolveHiddenValue(template: string): string {
  if (!template) return "";
  let result = template;
  for (const [token, param] of Object.entries(URL_PARAM_TOKENS)) {
    if (!result.includes(token)) continue;
    result = result.replaceAll(token, readPersistedParam(param));
  }
  if (result.includes("{{ga_client_id}}")) {
    result = result.replaceAll("{{ga_client_id}}", readGaClientId());
  }
  result = result.replaceAll("{{page_url}}",   typeof window !== "undefined" ? window.location.href : "");
  result = result.replaceAll("{{page_title}}", typeof document !== "undefined" ? document.title : "");
  result = result.replaceAll("{{referrer}}",   typeof document !== "undefined" ? document.referrer : "");
  return result;
}

export function BlockForm({ props, brand, pageId, testId, variantId, sessionId, prefill }: Props) {
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
  // Tracks whether the public /api/lp/forms/:id fetch has resolved (success
  // OR failure). Without this we'd keep showing "Loading form…" forever if
  // the fetch 404s / errors, leaving the visitor staring at a dead block.
  const [globalFormFetched, setGlobalFormFetched] = useState(false);
  const [chiliPiperHandoffUrl, setChiliPiperHandoffUrl] = useState<string | null>(null);
  // When set, mounts a hidden MarketoForm with these prefill values and
  // auto-submits — the "ghost form" path. Set exactly once per successful
  // standard submit to avoid double-firing on re-render.
  const [ghostSubmitVals, setGhostSubmitVals] = useState<Record<string, string> | null>(null);
  // Resolver for the in-flight "Marketo ghost submit" promise. handleSubmit
  // sets this before mounting the hidden MarketoForm so it can await the
  // form's onSuccess callback (or a bounded timeout) before navigating —
  // otherwise the Chili Piper / redirectUrl branches can fire before the
  // Forms2 POST lands and silently drop the Munchkin-cookie association
  // for that visitor on slow networks.
  const ghostResolveRef = useRef<(() => void) | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Stable per-mount session id for analytics. Required because BlockForm
  // fires *two* conversion events (`form_submit` then `chilipiper_booking`)
  // and the funnel reports stitch them together by sessionId. When the
  // parent provides one (live A/B test pages), we use it verbatim. When it
  // doesn't (builder pages without an assigned test), we mint one anon id
  // *once* so both events share it — otherwise each call site would mint
  // its own `anon-${Date.now()}` and the booking would look like a brand
  // new visitor. Lazy useState ensures the id is computed exactly once.
  const [anonSessionId] = useState(() => `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const effectiveSessionId = sessionId ?? anonSessionId;

  // Wire the booking-confirmed postMessage listener so the inline-iframe
  // handoff still records the second `chilipiper_booking` conversion. Empty
  // url is benign — the listener still attaches but never matches anything
  // until the visitor reaches the scheduler.
  useChiliPiperBookingTracking({
    url: chiliPiperHandoffUrl ?? "",
    pageId,
    testId,
    variantId,
    sessionId: effectiveSessionId,
  });

  useEffect(() => {
    if (!props.formId) { setGlobalForm(null); setGlobalFormFetched(true); return; }
    setGlobalFormFetched(false);
    fetch(`${API_BASE}/lp/forms/${props.formId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: GlobalFormConfig | null) => setGlobalForm(data))
      .catch(() => {})
      .finally(() => setGlobalFormFetched(true));
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

        // GTM dataLayer push — fires the `Marketo Form Submission` event
        // (formName: "Demo Form") so marketing's GTM container can fan out
        // to ads-conversion / GA4 tags. Mirrors the push wired into the
        // visible MarketoForm embed (MarketoForm.tsx onSuccess) so native
        // lp-studio forms send the same signal. Idempotent per page load
        // — the helper dedupes internally.
        try {
          pushMarketoSubmissionToDataLayer(globalForm?.gtmDataLayerConfig ?? null);
        } catch (err) {
          // Analytics must never break the submit path.
          console.error("[lp-studio] dataLayer push threw:", err);
        }

        try {
          // Omit `testId` / `variantId` when this page isn't being rendered
          // as part of an A/B test — the API now allows null FKs and the row
          // is attributed via `sessionId`. Sending `testId: 0` was the
          // pre-existing bug that made every funnel report drop these
          // conversions (FK violation → 500 → swallowed by try/catch).
          const trackBody: Record<string, unknown> = {
            sessionId: effectiveSessionId,
            eventType: "conversion",
            conversionType: "form_submit",
          };
          if (testId != null) trackBody.testId = testId;
          if (variantId != null) trackBody.variantId = variantId;
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackBody),
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

      // Marketo Forms2 "ghost submit". When the linked global form has
      // `marketoConfig.forms2` configured (baseUrl + munchkinId + formId),
      // translate the submitted field map (keyed by form label) through
      // the form's `fieldMappings` into Marketo REST field names and fire
      // a hidden MarketoForm. The server already syncs to Marketo via
      // REST; the ghost form additionally lands the lead through the
      // Forms2 path so Munchkin cookie association, Smart Campaign
      // triggers and GA4 mktoFormSubmit all fire.
      // Promise that resolves once the hidden Marketo Forms2 "ghost submit"
      // has either reported success OR a bounded ~2s timeout has elapsed.
      // Defaults to already-resolved so the non-ghost path doesn't pay a
      // wait. Bound is intentional: a stuck Marketo response must never
      // block the visitor's success UX longer than this.
      let ghostSubmitDone: Promise<void> = Promise.resolve();
      const mkto = globalForm?.marketoConfig;
      if (GHOST_SUBMIT_ENABLED && mkto?.forms2?.baseUrl && mkto.forms2.munchkinId && mkto.forms2.formId) {
        const mappings = mkto.fieldMappings ?? {};
        const ghost: Record<string, string> = {};
        for (const [label, value] of Object.entries(allFields)) {
          if (!value) continue;
          // Map by label; fall back to the label itself when there is no
          // explicit mapping (Marketo will silently drop unknown fields).
          const mktoKey = mappings[label] ?? label;
          ghost[mktoKey] = value;
        }
        if (Object.keys(ghost).length > 0) {
          ghostSubmitDone = new Promise<void>((resolve) => {
            ghostResolveRef.current = resolve;
            setGhostSubmitVals(ghost);
            // Hard cap — Marketo script load + Forms2 round-trip should
            // comfortably finish in well under 2s on a healthy network;
            // when it doesn't we'd rather hand the visitor off than have
            // them stare at a stalled form.
            setTimeout(() => {
              if (ghostResolveRef.current === resolve) {
                ghostResolveRef.current = null;
                resolve();
              }
            }, 2000);
          });
        }
      }

      // Chili Piper handoff for native (non-Marketo) forms. Mirrors the
      // Marketo branch's behaviour so a global form with chiliPiperConfig
      // hands the visitor straight to the scheduler regardless of which
      // form-mode the form block is using.
      const cp = globalForm?.chiliPiperConfig;
      if (cp?.url) {
        const cpUrl = buildChiliPiperHandoffUrl(cp, allFields);
        // Wait for the hidden Forms2 POST to land (or the timeout) before
        // navigating away — otherwise the page can unload mid-request and
        // silently drop the Munchkin-cookie association for this lead.
        await ghostSubmitDone;
        if (cp.mode === "redirect") {
          // Open in a new tab so the visitor can return to the landing
          // page after booking; pop blockers degrade to current tab.
          safeNavigate(cpUrl, "_blank");
        } else {
          // Modal mode (default): swap the form contents in-place for the
          // scheduler iframe — no portal/modal overlay, no page change.
          setChiliPiperHandoffUrl(cpUrl);
        }
        return;
      }

      setSubmitted(true);
      if (activeRedirectUrl) {
        // Same reasoning as the Chili Piper branch: hold the redirect
        // until the ghost submit has either landed or hit the 2s cap.
        await ghostSubmitDone;
        setTimeout(() => { safeNavigate(activeRedirectUrl); }, 1500);
      }
    } catch {
      // Field values stay intact (state is untouched) and `finally` re-enables
      // the button, so the visitor can correct/retry without re-typing.
      setSubmitError("Something went wrong sending your info. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Per-form styling override (lp_forms.styling). When the linked global
  // form carries a FormStyling object, its tokens win over the per-block
  // colors — that's how a single global form (e.g. the Spatial Tour
  // form 1425) renders with the Inside Dandy / Apple Vision Pro look on
  // every CTA without each form block needing to be re-themed.
  // Resolve the styling chain: brand-level default → per-form styling
  // (lp_forms.styling). Per-block overrides (props-level FormStyling)
  // aren't a concept on BlockForm itself today — adding here would be
  // a separate UX surface — so we stop at the form layer.
  const formStyling: FormStyling | null = mergeFormStyling(
    brand?.formStyling ?? null,
    globalForm?.styling ?? null,
  );

  // Brand-aware defaults (Dandy-style), with FormStyling taking precedence.
  const submitBg = formStyling?.buttonBg || props.submitButtonColor || brand.accentColor || "var(--brand-accent)";
  // Derive the submit label color from the actual button fill so it stays
  // legible even when the brand's accent and primary are the same hue (which
  // previously rendered e.g. a blue label on a blue button).
  const submitBgHex = isValidHex(submitBg)
    ? submitBg
    : isValidHex(brand.accentColor)
      ? brand.accentColor
      : DEFAULT_BRAND.accentColor;
  const submitFg = formStyling?.buttonText || props.submitButtonTextColor || contrastTextColor(submitBgHex);
  const inputAccent = formStyling?.accent || props.inputAccentColor || brand.primaryColor || "var(--brand-primary)";
  const cardBg = formStyling?.surface || props.cardBgColor || (isDark ? undefined : "#ffffff");
  const cardBorderColor = formStyling?.border;
  // Optional global text colour override (per-page linked-form styling).
  // When set, applied as inline `color` to the form section so headline,
  // labels, helper text and body inherit it — overriding the hardcoded
  // Tailwind text-slate / brand colours used elsewhere in this block.
  const textOverride = formStyling?.headlineColor || (props as { textColor?: string }).textColor;
  const subheadlineColor = formStyling?.subheadlineColor;
  const labelColorOverride = formStyling?.labelColor;
  const displayFont = formStyling?.fontDisplay || DISPLAY;
  const bodyFont = formStyling?.fontBody || BODY;
  const cardStyle = props.cardStyle ?? "elevated";
  const cardRadius = props.cardRadius ?? "2xl";
  const radiusClass = { lg: "rounded-lg", xl: "rounded-xl", "2xl": "rounded-2xl", "3xl": "rounded-3xl" }[cardRadius];
  const inputRadiusClass = { lg: "rounded-md", xl: "rounded-lg", "2xl": "rounded-xl", "3xl": "rounded-2xl" }[cardRadius];
  const btnRadiusClass = inputRadiusClass;
  const cardShadowClass =
    cardStyle === "elevated" ? "shadow-[0_1px_2px_rgba(15,15,20,0.05),0_28px_64px_-28px_rgba(15,15,20,0.22)] border border-black/[0.06]" :
    cardStyle === "flat" ? "shadow-[0_8px_24px_-12px_rgba(15,15,20,0.12)] border border-black/[0.08]" :
    "border border-black/[0.1]";
  const labelStyle = props.labelStyle ?? "uppercase";
  const labelClass = labelStyle === "uppercase"
    ? `block text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? "text-white/70" : "text-slate-500"}`
    : `block text-sm font-medium mb-1.5 ${isDark ? "text-gray-200" : "text-slate-700"}`;

  const bgInlineStyle = formStyling?.background
    ? { background: formStyling.background }
    : (props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined);

  const isMarketo = props.formMode === "marketo";

  // Munchkin tracking script. Loaded as soon as the linked global form
  // config arrives so the visitor's _mkto_trk cookie is set well before
  // they submit — without this the eventual Forms2 ghost-submit would
  // land in Marketo as an anonymous lead and any "associate to existing
  // visitor session" Smart Campaigns / GA4 listeners wouldn't fire.
  // MarketoForm itself also mounts a MunchkinLoader, but for the ghost
  // pattern that wouldn't run until *after* submit (which is too late).
  const munchkinIdForPage =
    globalForm?.marketoConfig?.forms2?.munchkinId ??
    (props.formMode === "marketo" ? props.marketoMunchkinId : undefined);
  const munchkinLoaderNode = munchkinIdForPage ? (
    <MunchkinLoader munchkinId={munchkinIdForPage} />
  ) : null;

  // Hidden Marketo Forms2 "ghost submit". Mounted whenever a successful
  // standard submit set `ghostSubmitVals` AND the linked global form has
  // `marketoConfig.forms2` configured. Wrapped in display:none so the
  // visitor never sees Marketo's own form HTML — Forms2 still POSTs.
  const ghostMkto = globalForm?.marketoConfig?.forms2;
  const ghostFormNode = GHOST_SUBMIT_ENABLED && ghostSubmitVals && ghostMkto?.baseUrl && ghostMkto.munchkinId && ghostMkto.formId ? (
    <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", visibility: "hidden" }}>
      <MarketoForm
        baseUrl={ghostMkto.baseUrl}
        munchkinId={ghostMkto.munchkinId}
        formId={ghostMkto.formId}
        prefill={ghostSubmitVals}
        submitOnReady
        gtmDataLayerConfig={globalForm?.gtmDataLayerConfig ?? null}
        onGhostSubmitAttempted={() => {
          // Visible console log so operators (and the team) can verify
          // the ghost-submit path is firing on the live site without
          // needing GA / Webflow / Marketo dashboard access — open
          // DevTools → Console, submit the form, and look for these
          // two messages.
          console.log(
            "[lp-studio] Marketo ghost submit fired",
            { pageId, formId: props.formId, marketoFormId: ghostMkto?.formId },
          );
          // Telemetry: a hidden Marketo Forms2 submit() has just been
          // fired. Best-effort POST to /api/lp/track so the funnel report
          // can compare attempts to actual Marketo deliveries — failures
          // here must never break the submit path, so we swallow errors
          // and use keepalive so the request survives an immediate
          // navigation (Chili Piper / redirectUrl branches).
          try {
            const trackBody: Record<string, unknown> = {
              sessionId: effectiveSessionId,
              eventType: "conversion",
              conversionType: "ghost_submit_attempted",
            };
            if (testId != null) trackBody.testId = testId;
            if (variantId != null) trackBody.variantId = variantId;
            // Page + form attribution so the analytics drill-down can
            // pinpoint *which* page/form is firing ghost submits — the
            // tenant-wide count alone forced operators to manually
            // bisect across published pages when a CSP / Marketo regression hit.
            if (pageId != null) trackBody.pageId = pageId;
            if (props.formId != null) trackBody.formId = props.formId;
            fetch(`${API_BASE}/lp/track`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(trackBody),
              keepalive: true,
            }).catch(() => {});
          } catch {
            // ignore
          }
        }}
        onLoadError={() => {
          // Telemetry: the Marketo loader script (or loadForm) failed —
          // CSP block, network error, rate-limited Forms2 endpoint, etc.
          // The lead never reached Marketo via the Forms2 path. Surface
          // it so the admin funnel report can alert on regressions
          // instead of us learning from missing-leads complaints.
          try {
            console.warn("[lp-studio] Marketo ghost submit failed to load");
            const trackBody: Record<string, unknown> = {
              sessionId: effectiveSessionId,
              eventType: "conversion",
              conversionType: "ghost_submit_failed",
            };
            if (testId != null) trackBody.testId = testId;
            if (variantId != null) trackBody.variantId = variantId;
            // Same attribution story as the _attempted branch above —
            // attach pageId + formId so the failure can be charged to a
            // specific page/form pair on the analytics drill-down.
            if (pageId != null) trackBody.pageId = pageId;
            if (props.formId != null) trackBody.formId = props.formId;
            fetch(`${API_BASE}/lp/track`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(trackBody),
              keepalive: true,
            }).catch(() => {});
          } catch {
            // ignore
          }
          // Also release the handleSubmit waiter — without this, a
          // failed loader would block the visitor's success UX until
          // the 2s timeout cap kicks in.
          const r = ghostResolveRef.current;
          if (r) {
            ghostResolveRef.current = null;
            r();
          }
        }}
        onSuccess={() => {
          // Visible confirmation that Marketo Forms2 actually accepted
          // the hidden submit (i.e. the lead landed via Forms2, not
          // just the REST sync). Open DevTools → Console on the live
          // site and look for this message after submitting a form.
          console.log(
            "[lp-studio] Marketo form submission fire successful",
            { pageId, formId: props.formId, marketoFormId: ghostMkto?.formId },
          );
          // Release any handleSubmit branch that's blocked waiting for
          // the Forms2 POST to land. Cleared so the 2s timeout fallback
          // (which checks identity) becomes a no-op.
          const r = ghostResolveRef.current;
          if (r) {
            ghostResolveRef.current = null;
            r();
          }
        }}
      />
    </div>
  ) : null;

  if (submitted) {
    return (
      <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-20 px-4`} style={{ ...bgInlineStyle, ...(textOverride ? { color: textOverride } : null) }}>
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: submitBg }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={submitFg} strokeWidth="2.75" className="w-8 h-8">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3
            className={`text-2xl font-bold mb-2 ${isDark ? "text-[var(--brand-heading-on-dark)]" : "text-[var(--brand-heading-on-light)]"}`}
            style={{ ...(textOverride ? { color: textOverride } : undefined), fontFamily: displayFont }}
          >
            {activeSuccessMessage || "Thank you!"}
          </h3>
        </div>
        {munchkinLoaderNode}
        {ghostFormNode}
      </section>
    );
  }

  return (
    <section className={`${bgStyles[props.backgroundStyle] ?? "bg-white"} py-20 px-4`} style={{ ...bgInlineStyle, ...(textOverride ? { color: textOverride } : null) }}>
      {munchkinLoaderNode}
      {ghostFormNode}
      <div className="max-w-xl mx-auto">
        {/* Hide the form headline/subheadline once the scheduler iframe has
            taken over — the scheduler should fill the available space without
            a stale "Tell us about you"-style header pushing it down. */}
        {!chiliPiperHandoffUrl && (props.headline || props.subheadline) && (
          <div className="text-center mb-8">
            {props.headline && (
              <h2
                className={`text-3xl md:text-4xl font-bold leading-tight mb-3 ${isDark ? "text-[var(--brand-heading-on-dark)]" : "text-[var(--brand-heading-on-light)]"}`}
                style={{ ...(textOverride ? { color: textOverride } : undefined), fontFamily: displayFont }}
              >
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p
                className={`text-base md:text-lg ${isDark ? "text-white/80" : "text-slate-600"}`}
                style={{ ...(subheadlineColor ? { color: subheadlineColor } : (textOverride ? { color: textOverride } : undefined)), fontFamily: bodyFont }}
              >
                {props.subheadline}
              </p>
            )}
          </div>
        )}

        <div
          className={`${radiusClass} ${formStyling ? "" : cardShadowClass} p-8 md:p-10 ${isDark && !cardBg ? "bg-white/10 border-white/20" : ""}`}
          style={{
            ...(cardBg ? { backgroundColor: cardBg } : undefined),
            ...(cardBorderColor ? { border: `1px solid ${cardBorderColor}` } : undefined),
            ...(formStyling ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } : undefined),
          }}
        >
          {chiliPiperHandoffUrl ? (
            // In-place swap: once the visitor has submitted the form (native
            // OR Marketo) and we have a Chili Piper handoff URL, replace
            // the form contents with the scheduler iframe. We keep the
            // surrounding card chrome so the layout doesn't jump and the
            // visitor stays on the page (no portal/modal overlay). Hoisted
            // above the isMarketo branch so both modes share this path.
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`} style={{ fontFamily: DISPLAY }}>Schedule a meeting</h3>
                <button
                  type="button"
                  onClick={() => { setChiliPiperHandoffUrl(null); setSubmitted(true); }}
                  className={`text-sm rounded-md px-2 py-1 ${isDark ? "text-white/80 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"}`}
                  aria-label="Close scheduler"
                >
                  Close
                </button>
              </div>
              <ChiliPiperIframe
                url={chiliPiperHandoffUrl}
                className="w-full h-[min(80vh,680px)] border-0 rounded-lg"
                onUnavailable={() => {
                  // Iframe blocked / failed to load — pop the scheduler
                  // in a new tab so the lead can still book, then mark
                  // the form as submitted so the page reflects success.
                  safeNavigate(chiliPiperHandoffUrl, "_blank");
                  setChiliPiperHandoffUrl(null);
                  setSubmitted(true);
                }}
              />
            </div>
          ) : isMarketo ? (
            props.marketoBaseUrl && props.marketoMunchkinId && props.marketoFormId ? (
              // If a global form is linked we must wait for its config to
              // load before mounting MarketoForm — otherwise the onSuccess
              // closure captures `globalForm=null` and the Chili Piper
              // handoff silently no-ops on the first submission.
              props.formId && !globalForm && !globalFormFetched ? (
                <p className={`text-sm ${isDark ? "text-white/70" : "text-slate-500"}`} style={{ fontFamily: BODY }}>Loading form…</p>
              ) : (
              <>
                <MarketoForm
                  baseUrl={props.marketoBaseUrl}
                  munchkinId={props.marketoMunchkinId}
                  formId={props.marketoFormId}
                  gtmDataLayerConfig={globalForm?.gtmDataLayerConfig ?? null}
                  // The Chili Piper hand-off owns post-submit navigation when
                  // configured, so we drop the redirect to avoid double-firing.
                  followUpUrl={globalForm?.chiliPiperConfig?.url ? undefined : (activeRedirectUrl || undefined)}
                  onSuccess={(vals) => {
                    const cp = globalForm?.chiliPiperConfig;
                    if (cp?.url) {
                      const url = buildChiliPiperHandoffUrl(cp, vals);
                      // Best-effort lead persistence + analytics conversion so
                      // the operator sees the submission in lp-studio even
                      // though Marketo runs the form. Failures are swallowed
                      // because the user is already being handed to CP.
                      if (pageId != null) {
                        const fields: Record<string, string> = {};
                        for (const [k, v] of Object.entries(vals)) {
                          if (typeof v === "string" && v.length > 0) fields[k] = v;
                        }
                        const body: Record<string, unknown> = {
                          fields,
                          pageId,
                          formId: props.formId,
                        };
                        if (variantId != null) body.variantId = variantId;
                        if (sessionId) body.sessionId = sessionId;
                        fetch(`${API_BASE}/lp/leads`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        }).catch(() => undefined);
                        // Same caveat as the standard handleSubmit path:
                        // omit `testId` / `variantId` when not in an A/B test
                        // so the FK doesn't reject the row.
                        const mktoTrackBody: Record<string, unknown> = {
                          sessionId: effectiveSessionId,
                          eventType: "conversion",
                          conversionType: "form_submit",
                        };
                        if (testId != null) mktoTrackBody.testId = testId;
                        if (variantId != null) mktoTrackBody.variantId = variantId;
                        fetch(`${API_BASE}/lp/track`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(mktoTrackBody),
                        }).catch(() => undefined);
                      }
                      if (cp.mode === "redirect") {
                        // Open in a new tab so the visitor can return to the
                        // landing page after booking. Falls through to the
                        // current tab if the popup is blocked (safeNavigate
                        // honours its target and we accept the trade-off
                        // rather than dropping the handoff entirely).
                        safeNavigate(url, "_blank");
                      } else {
                        setChiliPiperHandoffUrl(url);
                      }
                      return;
                    }
                    setSubmitted(true);
                  }}
                />
                {/* In-place swap above replaces the form with the scheduler
                    iframe once chiliPiperHandoffUrl is set, so no portal
                    modal is needed here. */}
              </>
              )
            ) : (
              <p className={`text-sm ${isDark ? "text-white/70" : "text-slate-500"}`} style={{ fontFamily: BODY }}>
                Marketo form is not configured. Add the instance URL, Munchkin ID, and Form ID in the panel.
              </p>
            )
          ) : (
            <>
          {activeMultiStep && totalSteps > 1 && (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-white/70" : "text-slate-500"}`} style={{ fontFamily: BODY }}>
                  Step {clampedStep + 1} of {totalSteps}
                </span>
                {step.title && (
                  <span className={`text-sm font-semibold ${isDark ? "text-[var(--brand-heading-on-dark)]" : "text-[var(--brand-heading-on-light)]"}`} style={{ fontFamily: BODY }}>
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
                  <label htmlFor={field.id} className={labelClass} style={{ ...(labelColorOverride ? { color: labelColorOverride, opacity: 1 } : (textOverride ? { color: textOverride, opacity: 0.85 } : undefined)), fontFamily: bodyFont }}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5" style={{ fontFamily: bodyFont }}>*</span>}
                  </label>
                )}
                <FieldInput
                  field={field}
                  value={fieldValues[field.id] ?? ""}
                  error={fieldErrors[field.id] ?? null}
                  errorId={`${field.id}-error`}
                  inputRadius={inputRadiusClass}
                  inputAccentColor={inputAccent}
                  isDark={isDark}
                  inputBg={formStyling?.inputBg}
                  inputBorder={formStyling?.inputBorder}
                  inputText={formStyling?.inputText}
                  fontBody={formStyling?.fontBody}
                  onChange={val => {
                    setFieldValues(prev => ({ ...prev, [field.id]: val }));
                    setFieldErrors(prev => ({ ...prev, [field.id]: null }));
                  }}
                />
                {fieldErrors[field.id] && (
                  <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5" style={{ fontFamily: BODY }}>{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Spam honeypot. aria-hidden + tabIndex=-1 keep it out of the
              tab order and AT tree — but Chrome's Issues panel still flags
              <input> without a visible label, so add a hidden label too. */}
          <label htmlFor="_hp" className="hidden" aria-hidden="true" style={{ fontFamily: BODY }}>Leave blank</label>
          <input ref={honeypotRef} id="_hp" type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          {/* Always-mounted live region so screen readers announce the
              submit error when it appears. */}
          <div aria-live="polite">
            {submitError && (
              <p className="text-sm text-red-500 mt-4" style={{ fontFamily: BODY }}>{submitError}</p>
            )}
          </div>

          <div className="mt-7 flex gap-3">
            {activeMultiStep && clampedStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(s => s - 1)}
                className={`flex-1 py-3.5 px-4 ${btnRadiusClass} text-sm font-semibold border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isDark ? "border-white/30 text-white hover:bg-white/10 focus-visible:outline-white" : "border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400"}`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
              disabled={submitting}
              className={`flex-1 py-4 px-4 ${btnRadiusClass} text-base font-bold transition-all duration-200 ease-out hover:brightness-105 motion-safe:hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
              style={{ background: submitBg, color: submitFg, outlineColor: inputAccent }}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Submitting…
                </span>
              ) : isLastStep ? (activeSubmitText || "Submit") : "Next"}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
