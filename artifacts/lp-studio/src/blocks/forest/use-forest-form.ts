import { useEffect, useState } from "react";
import { usePageContext } from "@/lib/page-context";
import { buildAttributionBody, resolveHiddenValue } from "@/lib/global-form-submission";
import { safeNavigate } from "@/lib/safe-url";
import { fetchGlobalForm, mapToGlobalForm, type ForestLeadValues, type PublicGlobalForm } from "./global-form-map";
import type { ForestCloseBlockProps } from "../BlockForestClose";

export type ForestFormStatus = "idle" | "loading" | "success" | "error";
export type ForestFormKey = keyof ForestLeadValues;

const EMAIL_RE = /.+@.+\..+/;

/** The labels the close form files its qualifying answers under (the panel's labels, with the artifact's defaults). */
export function forestNativeLabels(props: ForestCloseBlockProps) {
  return {
    role: props.roleLabel || "Role",
    locations: props.locationsLabel || "Locations",
    stage: props.stageLabel || "Lab strategy today",
    why: props.whyLabel || "What prompted this",
  };
}

/**
 * State, validation and submission for the forest-close inline form: the
 * artifact's required + email check, label-keyed fields + UTM attribution
 * POSTed to /api/lp/leads, optionally filed under a linked global form's
 * labels (see global-form-map.ts) so its routing and redirect apply.
 */
export function useForestForm(props: ForestCloseBlockProps, opts: { pageId?: number; variantId?: number; isEditor: boolean }) {
  const ctx = usePageContext();
  const { isEditor } = opts;
  const [values, setValues] = useState<ForestLeadValues>({});
  const [errors, setErrors] = useState<Partial<Record<ForestFormKey, boolean>>>({});
  const [status, setStatus] = useState<ForestFormStatus>("idle");

  // Linked global form: load its definition once so the submission can be
  // filed under that form's field labels.
  const [globalForm, setGlobalForm] = useState<PublicGlobalForm | null>(null);
  useEffect(() => {
    let alive = true;
    if (!props.formId) { setGlobalForm(null); return; }
    fetchGlobalForm(props.formId).then((f) => { if (alive) setGlobalForm(f); });
    return () => { alive = false; };
  }, [props.formId]);

  const set = (key: ForestFormKey, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const validate = (): boolean => {
    const next: Partial<Record<ForestFormKey, boolean>> = {};
    if (!(values.name ?? "").trim()) next.name = true;
    if (!(values.email ?? "").trim() || !EMAIL_RE.test(values.email ?? "")) next.email = true;
    if (!(values.org ?? "").trim()) next.org = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isEditor) return;
    if (!validate()) return;
    setStatus("loading");
    const pid = opts.pageId ?? ctx.pageId;
    const labels = forestNativeLabels(props);
    const nativeFields: Record<string, string> = {
      Name: (values.name ?? "").trim(),
      // The server's submitter-email detection looks for an exact "Email" key.
      Email: (values.email ?? "").trim(),
      Organization: (values.org ?? "").trim(),
      ...((props.askRole ?? true) ? { [labels.role]: values.role ?? "" } : {}),
      ...((props.askLocations ?? true) ? { [labels.locations]: values.locations ?? "" } : {}),
      ...((props.askStage ?? true) ? { [labels.stage]: values.stage ?? "" } : {}),
      ...((props.askWhy ?? true) ? { [labels.why]: values.why ?? "" } : {}),
      Campaign: resolveHiddenValue("{{utm_campaign}}"),
      Source: props.source || "dso-page",
    };
    const fields = props.formId ? mapToGlobalForm(globalForm?.steps, values, labels, nativeFields) : nativeFields;
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

  return { values, errors, status, set, submit };
}
