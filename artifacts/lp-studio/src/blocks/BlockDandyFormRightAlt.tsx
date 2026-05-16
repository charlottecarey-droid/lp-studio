import { useState, useEffect } from "react";
import { Check, Loader2, Calendar } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type {
  DandyFormRightAltBlockProps,
  ChiliPiperHandoffConfig,
  FormStep,
} from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { MarketoForm } from "@/components/MarketoForm";
import { ChiliPiperIframe, useChiliPiperBookingTracking } from "@/blocks/ChiliPiperModal";
import { buildChiliPiperHandoffUrl } from "@/lib/chili-piper-handoff";
import { safeNavigate } from "@/lib/safe-url";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";

const API_BASE = "/api";

interface Props {
  props: DandyFormRightAltBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyFormRightAltBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

type FormState = "idle" | "loading" | "success";

interface GlobalFormConfig {
  id: number;
  steps: FormStep[];
  multiStep: boolean;
  submitButtonText: string;
  successMessage: string | null;
  redirectUrl: string | null;
  chiliPiperConfig?: ChiliPiperHandoffConfig | null;
}

const ASPECT_CLASS: Record<NonNullable<DandyFormRightAltBlockProps["imageAspect"]>, string> = {
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  landscape: "aspect-[5/4]",
  wide: "aspect-[16/10]",
};

function buildLegacyCpUrl(base: string, email: string): string {
  try {
    const url = new URL(base);
    if (email) url.searchParams.set("email", email);
    return url.toString();
  } catch {
    return base;
  }
}

export function BlockDandyFormRightAlt({ props, brand: _brand, onFieldChange, pageId, variantId }: Props) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [chiliPiperHandoffUrl, setChiliPiperHandoffUrl] = useState<string | null>(null);
  // Native fields used when no global form is linked.
  const [native, setNative] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  // Generic field values used when a global form IS linked. Keyed by field id.
  const [linkedValues, setLinkedValues] = useState<Record<string, string>>({});

  const [globalForm, setGlobalForm] = useState<GlobalFormConfig | null>(null);
  const [globalFormFetched, setGlobalFormFetched] = useState(false);

  // Stable per-mount session id so the form_submit + chilipiper_booking
  // conversion events stitch together in funnel reports.
  const [anonSessionId] = useState(() => `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Mirror BlockForm: wires the booking-confirmed postMessage listener so
  // the in-place Chili Piper iframe still records the second
  // `chilipiper_booking` conversion. Empty url is benign.
  useChiliPiperBookingTracking({
    url: chiliPiperHandoffUrl ?? "",
    pageId,
    variantId,
    sessionId: anonSessionId,
  });

  const field = (key: keyof DandyFormRightAltBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const bullets = [...(props.bullets ?? [])];
    bullets[i] = v;
    onFieldChange({ ...props, bullets });
  };

  // Fetch the linked global form (if any). Mirrors BlockForm's pattern so the
  // Chili Piper handoff config is available at submit time.
  useEffect(() => {
    if (!props.formId) {
      setGlobalForm(null);
      setGlobalFormFetched(true);
      return;
    }
    setGlobalFormFetched(false);
    fetch(`${API_BASE}/lp/forms/${props.formId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GlobalFormConfig | null) => setGlobalForm(data))
      .catch(() => {})
      .finally(() => setGlobalFormFetched(true));
  }, [props.formId]);

  // Flatten global form steps into a single field list — this card is a
  // single-screen form so multi-step global forms are collapsed inline.
  const linkedFields = (globalForm?.steps ?? []).flatMap((s) => s.fields);
  const hasLinkedForm = !!globalForm;
  const submitText =
    (hasLinkedForm ? globalForm?.submitButtonText : undefined) ||
    props.submitText ||
    "Get a Free Demo";
  const successMessage =
    (hasLinkedForm ? globalForm?.successMessage : undefined) ||
    props.successMessage ||
    "Thanks! We'll be in touch shortly.";

  // Map collected values into a flat fields object for /api/lp/leads.
  const collectFields = (): Record<string, string> => {
    if (hasLinkedForm) {
      const out: Record<string, string> = {};
      for (const f of linkedFields) {
        const v = linkedValues[f.id];
        if (v != null && v !== "") out[f.label || f.id] = v;
      }
      return out;
    }
    return {
      firstName: native.firstName,
      lastName: native.lastName,
      email: native.email,
      phone: native.phone || "",
      source: "dandy-form-right-alt",
    };
  };

  // Find an "email"-typed value so legacy chilipiperUrl can prefill.
  const collectedEmail = (): string => {
    if (hasLinkedForm) {
      const emailField = linkedFields.find((f) => f.type === "email");
      return (emailField && linkedValues[emailField.id]) || "";
    }
    return native.email;
  };

  const handoffAfterSubmit = (): boolean => {
    // Prefer the global form's per-form Chili Piper config (modal/redirect).
    const cp = globalForm?.chiliPiperConfig;
    if (cp?.url) {
      const cpUrl = buildChiliPiperHandoffUrl(cp, collectFields());
      if (cp.mode === "redirect") {
        safeNavigate(cpUrl, "_blank");
      } else {
        setChiliPiperHandoffUrl(cpUrl);
      }
      return true;
    }
    // Legacy: a raw chilipiperUrl on the block hands off in-place too.
    if (props.chilipiperUrl) {
      setChiliPiperHandoffUrl(buildLegacyCpUrl(props.chilipiperUrl, collectedEmail()));
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("loading");
    try {
      if (pageId) {
        const body: Record<string, unknown> = {
          pageId,
          variantId,
          fields: collectFields(),
        };
        if (props.formId != null) body.formId = props.formId;
        await fetch(`${API_BASE}/lp/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    } catch {
      // silently continue — failure to record shouldn't block UX
    }
    // GTM dataLayer push (marketing's "Marketo Form Submission" event).
    // Helper dedupes per page load and is safe to call after any submit.
    try {
      pushMarketoSubmissionToDataLayer();
    } catch (err) {
      console.error("[lp-studio] dataLayer push threw:", err);
    }
    if (handoffAfterSubmit()) {
      // Stay in "loading" so the form contents swap to the iframe instead
      // of flashing the success state behind it. The iframe replaces the
      // form area below.
      setFormState("idle");
    } else {
      setFormState("success");
    }
  };

  const bg = props.bgColor ?? "#FDFCFA";
  const leftMode = props.leftMode ?? "bullets";
  const headlineLayout = props.headlineLayout ?? "default";
  const aspect = ASPECT_CLASS[props.imageAspect ?? "portrait"];

  // Headline group — re-used either above the grid (centered) or in the left column.
  const headlineGroup = (centered: boolean) => (
    <div className={`flex flex-col gap-5 ${centered ? "items-center text-center max-w-3xl mx-auto" : ""}`}>
      {props.eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
          <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
        </p>
      )}
      <h2 className="text-4xl md:text-5xl font-bold text-[var(--brand-primary)] leading-[1.1] tracking-tight">
        <InlineText value={props.headline} onUpdate={field("headline")} />
      </h2>
      {props.subheadline && (
        <p className="text-lg text-slate-600 leading-relaxed">
          <InlineText value={props.subheadline} onUpdate={field("subheadline")} multiline />
        </p>
      )}
    </div>
  );

  // Left column content (bullets or image), plus optional trust note.
  const leftColumn = (
    <div className="flex flex-col gap-7">
      {headlineLayout === "default" && headlineGroup(false)}
      {leftMode === "image" ? (
        props.imageUrl || onFieldChange ? (
          <InlineImage
            src={props.imageUrl ?? ""}
            alt={props.imageAlt ?? ""}
            wrapperClassName="block w-full"
            className={`w-full ${aspect} object-cover rounded-2xl ${(props.imageShadow ?? true) ? "shadow-xl" : ""}`}
            onUpdate={field("imageUrl")}
          />
        ) : null
      ) : (
        (props.bullets ?? []).length > 0 && (
          <ul className="space-y-4">
            {(props.bullets ?? []).map((b, i) => (
              <li key={i} className="flex items-start gap-4 text-base text-slate-700">
                <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[var(--brand-accent)] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                </span>
                <InlineText
                  value={b}
                  onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined}
                  multiline
                />
              </li>
            ))}
          </ul>
        )
      )}
      {props.trustNote && (
        <p className="text-sm text-slate-400 mt-1">
          <InlineText value={props.trustNote} onUpdate={field("trustNote")} multiline />
        </p>
      )}
    </div>
  );

  // Submit button shared by both renderers. Disabled while loading / when
  // the handoff iframe has already taken over the card.
  const submitButton = (
    <button
      type="submit"
      disabled={formState === "loading"}
      className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-4 rounded-xl text-base hover:brightness-105 transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
    >
      {formState === "loading" ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <InlineText value={submitText} onUpdate={field("submitText")} />
      )}
    </button>
  );

  // Generic input renderer for the global-form path.
  const renderLinkedField = (f: (typeof linkedFields)[number]) => {
    const v = linkedValues[f.id] ?? "";
    const onChange = (val: string) => setLinkedValues((s) => ({ ...s, [f.id]: val }));
    const label = (
      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
        {f.label}
        {f.required ? <span className="text-rose-500"> *</span> : null}
      </label>
    );
    const inputCls =
      "w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[var(--brand-primary)] transition-colors";
    if (f.type === "textarea") {
      return (
        <div key={f.id}>
          {label}
          <textarea
            value={v}
            onChange={(e) => onChange(e.target.value)}
            placeholder={f.placeholder ?? ""}
            required={f.required}
            disabled={formState === "loading"}
            rows={4}
            className={inputCls}
          />
        </div>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.id}>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            required={f.required}
            disabled={formState === "loading"}
            className={inputCls}
          >
            <option value="">{f.placeholder ?? "Select…"}</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    if (f.type === "checkbox") {
      return (
        <label key={f.id} className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={v === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            required={f.required}
            disabled={formState === "loading"}
            className="mt-1"
          />
          <span>{f.label}{f.required ? <span className="text-rose-500"> *</span> : null}</span>
        </label>
      );
    }
    if (f.type === "hidden") {
      return <input key={f.id} type="hidden" value={v} />;
    }
    const htmlType = f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text";
    return (
      <div key={f.id}>
        {label}
        <input
          type={htmlType}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          required={f.required}
          disabled={formState === "loading"}
          className={inputCls}
        />
      </div>
    );
  };

  // Form card (right column).
  const formCard = (
    <div className="bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
      {props.formHeadline && (
        <h3 className="text-2xl font-bold text-[var(--brand-primary)] mb-1">
          <InlineText value={props.formHeadline} onUpdate={field("formHeadline")} />
        </h3>
      )}
      {props.formSubheadline && (
        <p className="text-sm text-slate-500 mb-7">
          <InlineText value={props.formSubheadline} onUpdate={field("formSubheadline")} />
        </p>
      )}

      {chiliPiperHandoffUrl ? (
        // In-place Chili Piper iframe takes over the card after submit.
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Schedule a meeting</h3>
            <button
              type="button"
              onClick={() => { setChiliPiperHandoffUrl(null); setFormState("success"); }}
              className="text-sm rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
              aria-label="Close scheduler"
            >
              Close
            </button>
          </div>
          <ChiliPiperIframe
            url={chiliPiperHandoffUrl}
            className="w-full h-[min(70vh,560px)] border-0 rounded-lg"
            onUnavailable={() => {
              safeNavigate(chiliPiperHandoffUrl, "_blank");
              setChiliPiperHandoffUrl(null);
              setFormState("success");
            }}
          />
        </div>
      ) : props.formMode === "marketo" ? (
        props.marketoBaseUrl && props.marketoMunchkinId && props.marketoFormId ? (
          <MarketoForm
            baseUrl={props.marketoBaseUrl}
            munchkinId={props.marketoMunchkinId}
            formId={props.marketoFormId}
            onSuccess={() => {
              if (!handoffAfterSubmit()) setFormState("success");
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Marketo form is not configured. Add the instance URL, Munchkin ID, and Form ID in the panel.
          </p>
        )
      ) : formState === "success" ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-accent)] flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-[var(--brand-primary)]" />
          </div>
          <p className="text-xl font-bold text-[var(--brand-primary)] mb-3">{successMessage}</p>
          {props.chilipiperUrl && !globalForm?.chiliPiperConfig?.url && (
            <button
              onClick={() => setChiliPiperHandoffUrl(buildLegacyCpUrl(props.chilipiperUrl!, collectedEmail()))}
              className="mt-2 inline-flex items-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-accent)] font-bold px-5 py-2.5 rounded-full text-sm"
            >
              <Calendar className="w-3.5 h-3.5" /> Schedule a call
            </button>
          )}
        </div>
      ) : hasLinkedForm ? (
        // Global form path: render its fields generically.
        props.formId && !globalFormFetched ? (
          <p className="text-sm text-slate-500">Loading form…</p>
        ) : linkedFields.length === 0 ? (
          <p className="text-sm text-slate-500">This form has no fields configured yet.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {linkedFields.map(renderLinkedField)}
            {submitButton}
            {props.formDisclaimer && (
              <p className="text-xs text-slate-400 text-center mt-1">
                <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} />
              </p>
            )}
          </form>
        )
      ) : (
        // Native (built-in) path — original 4 fields.
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">First Name</label>
              <input
                type="text"
                value={native.firstName}
                onChange={(e) => setNative({ ...native, firstName: e.target.value })}
                placeholder="Jane"
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[var(--brand-primary)] transition-colors"
                required
                disabled={formState === "loading"}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Last Name</label>
              <input
                type="text"
                value={native.lastName}
                onChange={(e) => setNative({ ...native, lastName: e.target.value })}
                placeholder="Smith"
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[var(--brand-primary)] transition-colors"
                required
                disabled={formState === "loading"}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Work Email</label>
            <input
              type="email"
              value={native.email}
              onChange={(e) => setNative({ ...native, email: e.target.value })}
              placeholder="jane@yourpractice.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[var(--brand-primary)] transition-colors"
              required
              disabled={formState === "loading"}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Phone Number</label>
            <input
              type="tel"
              value={native.phone}
              onChange={(e) => setNative({ ...native, phone: e.target.value })}
              placeholder="(555) 000-0000"
              className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[var(--brand-primary)] transition-colors"
              disabled={formState === "loading"}
            />
          </div>
          {submitButton}
          {props.formDisclaimer && (
            <p className="text-xs text-slate-400 text-center mt-1">
              <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} />
            </p>
          )}
        </form>
      )}
    </div>
  );

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {headlineLayout === "centered-over-block" && (
          <div className="mb-14 md:mb-16">
            {headlineGroup(true)}
          </div>
        )}
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-14 md:gap-20 items-center">
          {leftColumn}
          {formCard}
        </div>
      </div>
    </section>
  );
}
