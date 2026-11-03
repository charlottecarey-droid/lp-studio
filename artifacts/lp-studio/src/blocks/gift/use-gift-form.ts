import { useEffect, useMemo, useState } from "react";
import { usePageContext } from "@/lib/page-context";
import { buildAttributionBody, resolveHiddenValue } from "@/lib/global-form-submission";
import type { GiftFormBlockProps } from "../BlockGiftForm";
import { readGiftFromSearch, selectGift, useGiftSelection, type GiftDetail } from "./gift-selection";

export type GiftFormValues = Record<string, string>;
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
  const [values, setValues] = useState<GiftFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<GiftFormStatus>("idle");

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
    const fields: Record<string, string> = {
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
      Source: props.source || "holiday-gift",
    };
    try {
      if (pid) {
        const resp = await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: pid, variantId: opts.variantId ?? ctx.variantId, fields, ...buildAttributionBody() }),
        });
        if (!resp.ok) throw new Error("submit failed");
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return { options, details, sizes, askSize, step, values, errors, status, gift, set, chooseGift, goNext, goBack, goTo, submit };
}
