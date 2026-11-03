import { useEffect, useMemo, useState } from "react";
import { usePageContext } from "@/lib/page-context";
import { buildAttributionBody, resolveHiddenValue } from "@/lib/global-form-submission";
import { safeNavigate } from "@/lib/safe-url";
import { fetchGlobalForm, mapToGlobalForm, type PublicGlobalForm } from "./global-form-map";
import type { GiftFormBlockProps } from "../BlockGiftForm";
import { readGiftFromSearch, selectGift, useGiftSelection, type GiftDetail } from "./gift-selection";

export type GiftFormValues = Record<string, string>;

/** A prefill value, or "" when blank or still an unresolved {{token}} (the builder). */
export function cleanPrefill(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s && !s.includes("{{") ? s : "";
}

export function prefillValues(props: Pick<GiftFormBlockProps, "prefillFirstName" | "prefillLastName" | "prefillEmail" | "prefillCompany">): GiftFormValues {
  const out: GiftFormValues = {};
  const pairs: Array<[string, string | undefined]> = [
    ["firstName", props.prefillFirstName],
    ["lastName", props.prefillLastName],
    ["email", props.prefillEmail],
    ["company", props.prefillCompany],
  ];
  for (const [k, v] of pairs) { const c = cleanPrefill(v); if (c) out[k] = c; }
  return out;
}
export type GiftFormStatus = "idle" | "loading" | "success" | "error";

/**
 * State, validation and submission for the three-step gift form, shared by
 * both layouts (Classic and Atelier) so they capture leads identically:
 * label-keyed fields + UTM attribution POSTed to /api/lp/leads.
 */
export function useGiftForm(props: GiftFormBlockProps, opts: { pageId?: number; variantId?: number; isEditor: boolean }) {
  const ctx = usePageContext();
  const selection = useGiftSelection();
  const { isEditor } = opts;

  const ownOptions = (props.options ?? []).map((o) => o.trim()).filter(Boolean);
  const options = ownOptions.length > 0 ? ownOptions : selection.options;
  const details: Record<string, GiftDetail> = selection.details;
  const sizes = (props.sizeOptions ?? []).map((s) => s.trim()).filter(Boolean);
  const askSize = sizes.length > 0;

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<GiftFormValues>(() => prefillValues(props));
  // Prefill can arrive after mount (builder edits, hydration): fill only the
  // fields the visitor hasn't typed into.
  const prefillKey = JSON.stringify(prefillValues(props));
  useEffect(() => {
    const pre = JSON.parse(prefillKey) as GiftFormValues;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [k, v] of Object.entries(pre)) if (!next[k]) { next[k] = v; changed = true; }
      return changed ? next : prev;
    });
  }, [prefillKey]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<GiftFormStatus>("idle");

  // Linked global form: load its definition once so the submission can be
  // filed under that form's field labels (see global-form-map.ts).
  const [globalForm, setGlobalForm] = useState<PublicGlobalForm | null>(null);
  useEffect(() => {
    let alive = true;
    if (!props.formId) { setGlobalForm(null); return; }
    fetchGlobalForm(props.formId).then((f) => { if (alive) setGlobalForm(f); });
    return () => { alive = false; };
  }, [props.formId]);

  // The picker's choice (or a ?gift= deep link) pre-fills step one.
  const gift = selection.selected || values.gift || "";
  useEffect(() => {
    if (typeof window === "undefined" || selection.selected || options.length === 0) return;
    const fromUrl = readGiftFromSearch(window.location.search, options);
    if (fromUrl) selectGift(fromUrl);
  }, [options, selection.selected]);

  const set = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const chooseGift = (name: string) => {
    if (isEditor) return;
    selectGift(name);
    set("gift", name);
  };

  const requiredByStep: string[][] = useMemo(
    () => [
      ["gift"],
      ["firstName", "lastName", "email", ...((props.askCompany ?? true) ? ["company"] : [])],
      ["address", "city", "state", "zip"],
    ],
    [props.askCompany],
  );

  const validate = (s: number): boolean => {
    const next: Record<string, string> = {};
    for (const key of requiredByStep[s]) {
      const v = key === "gift" ? gift : (values[key] ?? "");
      if (!v.trim()) next[key] = key === "gift" ? "Pick one to continue." : "Required";
    }
    if (s === 1 && values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (isEditor) return;
    if (!validate(step)) return;
    setStep((s) => Math.min(2, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const goTo = (s: number) => {
    if (isEditor) return;
    // Only allow jumping back, or forward through steps that validate.
    if (s <= step) { setStep(s); return; }
    for (let i = step; i < s; i++) if (!validate(i)) { setStep(i); return; }
    setStep(s);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isEditor) return;
    if (step < 2) { goNext(); return; }
    if (!validate(2)) return;
    setStatus("loading");
    const pid = opts.pageId ?? ctx.pageId;
    const nativeFields: Record<string, string> = {
      Gift: gift,
      ...(askSize ? { Size: values.size ?? "" } : {}),
      "First name": values.firstName ?? "",
      "Last name": values.lastName ?? "",
      Email: values.email ?? "",
      ...((props.askCompany ?? true) ? { [props.companyLabel || "Company"]: values.company ?? "" } : {}),
      ...((props.askRole ?? true) ? { Role: values.role ?? "" } : {}),
      ...((props.askPhone ?? true) ? { Phone: values.phone ?? "" } : {}),
      "Shipping address": values.address ?? "",
      "Suite / unit": values.address2 ?? "",
      City: values.city ?? "",
      State: values.state ?? "",
      ZIP: values.zip ?? "",
      "Delivery notes": values.notes ?? "",
      Campaign: resolveHiddenValue("{{utm_campaign}}"),
      Rep: resolveHiddenValue("{{utm_content}}"),
      ...(cleanPrefill(props.sentBy) ? { "Sent by": cleanPrefill(props.sentBy) } : {}),
      Source: props.source || "holiday-gift",
    };
    const fields = props.formId
      ? mapToGlobalForm(globalForm?.steps, { firstName: values.firstName, lastName: values.lastName, email: values.email, company: values.company, role: values.role, phone: values.phone, address: values.address, address2: values.address2, city: values.city, state: values.state, zip: values.zip, notes: values.notes, gift, size: values.size }, nativeFields)
      : nativeFields;
    try {
      if (pid) {
        const body: Record<string, unknown> = { pageId: pid, variantId: opts.variantId ?? ctx.variantId, fields, ...buildAttributionBody() };
        if (props.formId) body.formId = props.formId;
        const resp = await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error("submit failed");
      }
      setStatus("success");
      // The global form's redirect (if any) wins after a short beat on the success state.
      const redirect = globalForm?.redirectUrl?.trim();
      if (props.formId && redirect) window.setTimeout(() => safeNavigate(redirect), 1500);
    } catch {
      setStatus("error");
    }
  };

  return { options, details, sizes, askSize, step, values, errors, status, gift, set, chooseGift, goNext, goBack, goTo, submit };
}
