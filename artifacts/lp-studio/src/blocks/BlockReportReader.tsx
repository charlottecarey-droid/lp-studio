import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportReaderBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { usePageContext } from "@/lib/page-context";
import { resolveCtaConfig } from "@/lib/cta/ctaConfig";
import { parseLpCtaMessage, resolveLpCtaAction } from "@/lib/custom-html-cta";
import {
  buildReportSrcDoc,
  isAllowedReportSrc,
  REPORT_HEIGHT_KEY,
  REPORT_MAX_HEIGHT,
} from "@/lib/report-reader";

interface Props {
  props: ReportReaderBlockProps;
  brand: BrandConfig;
}

type LoadState = { status: "idle" | "loading" | "error"; html: string; error?: string };

/**
 * Report reader block: fetches a paginated HTML report (see lib/report-reader)
 * and shows it as a page-turning magazine or a scrolling read, with an
 * optional PDF download. The report renders in the same origin-isolated
 * sandbox as the custom-html block and can open the page's native CTA modals.
 */
export function BlockReportReader({ props, brand }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = (props.src || "").trim();
  const [state, setState] = useState<LoadState>({ status: "idle", html: "" });

  useEffect(() => {
    if (!src) {
      setState({ status: "idle", html: "" });
      return;
    }
    if (!isAllowedReportSrc(src)) {
      setState({ status: "error", html: "", error: "Report URL must start with https:// or /" });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    fetch(src, { signal: ctrl.signal, credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load the report (HTTP ${r.status})`);
        return r.text();
      })
      .then((html) => setState({ status: "idle", html }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", html: "", error: err instanceof Error ? err.message : "Couldn't load the report" });
      });
    return () => ctrl.abort();
  }, [src]);

  const srcDoc = useMemo(
    () =>
      buildReportSrcDoc(state.html, {
        title: props.title ?? "",
        pdfUrl: props.pdfUrl ?? "",
        view: props.view ?? "auto",
        allowViewToggle: props.allowViewToggle ?? true,
      }),
    [state.html, props.title, props.pdfUrl, props.view, props.allowViewToggle],
  );

  const ctx = usePageContext();
  const [modal, setModal] = useState<{ mode: "chilipiper" | "form"; email: string; url?: string } | null>(null);
  const cta = useMemo(
    () => resolveCtaConfig({ tenantDefault: ctx.tenantDefaultCta, pageOverride: ctx.pageCta }),
    [ctx.tenantDefaultCta, ctx.pageCta],
  );
  const latest = useRef({ cta, brandCp: brand?.chilipiperUrl });
  latest.current = { cta, brandCp: brand?.chilipiperUrl };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const ctaReq = parseLpCtaMessage(e.data);
      if (ctaReq) {
        const action = resolveLpCtaAction(ctaReq, latest.current.cta, latest.current.brandCp);
        if (action.kind === "chilipiper") setModal({ mode: "chilipiper", email: action.email, url: action.url });
        else if (action.kind === "form") setModal({ mode: "form", email: action.email });
        else if (action.kind === "navigate") window.location.assign(action.url);
        else console.warn("[report-reader] __lpOpenCta ignored:", action.reason);
        return;
      }
      const data = e.data as Record<string, unknown> | null;
      const h = data && typeof data === "object" && typeof data[REPORT_HEIGHT_KEY] === "number" ? (data[REPORT_HEIGHT_KEY] as number) : null;
      if (h !== null && h > 0) iframe.style.height = Math.min(h, REPORT_MAX_HEIGHT) + "px";
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [srcDoc]);

  if (!src) {
    return (
      <div className="py-12 px-8 text-center text-muted-foreground text-sm italic">
        Report reader — add a report URL in the properties panel
      </div>
    );
  }
  if (state.status === "error") {
    return <div className="py-12 px-8 text-center text-sm text-destructive">{state.error}</div>;
  }
  if (!srcDoc) {
    return <div className="py-16 px-8 text-center text-muted-foreground text-sm">Loading report…</div>;
  }

  return (
    <div className="report-reader-block w-full overflow-hidden">
      <iframe
        ref={iframeRef}
        title={props.title || "Report"}
        // SECURITY: same contract as BlockCustomHtml — never add allow-same-origin.
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ minHeight: "480px", display: "block" }}
        scrolling="no"
      />
      {modal && (
        <EmailCaptureModal
          open
          onClose={() => setModal(null)}
          email={modal.email}
          mode={modal.mode}
          chilipiperUrl={modal.url}
          formSource={cta.modalFormSource ?? "simple"}
          linkedFormId={cta.modalFormId}
          marketoBaseUrl={cta.modalMarketoBaseUrl}
          marketoMunchkinId={cta.modalMarketoMunchkinId}
          marketoFormId={cta.modalMarketoFormId}
          chiliPiperConfig={
            cta.modalChiliPiperHandoffUrl
              ? { url: cta.modalChiliPiperHandoffUrl, mode: cta.modalChiliPiperHandoffMode ?? "modal", fieldMap: cta.modalChiliPiperHandoffFieldMap }
              : null
          }
          formConfig={{
            headline: cta.modalHeadline,
            subheadline: cta.modalSubheadline,
            submitText: cta.modalSubmitText,
            successMessage: cta.modalSuccessMessage,
            disclaimer: cta.modalDisclaimer,
            showFirstName: cta.modalShowFirstName,
            showLastName: cta.modalShowLastName,
            showPhone: cta.modalShowPhone,
            showCompany: cta.modalShowCompany,
          }}
          brand={brand}
          pageId={ctx.pageId ?? undefined}
          variantId={ctx.variantId ?? undefined}
          source="report-reader"
          theme={brand?.modalTheme ?? undefined}
        />
      )}
    </div>
  );
}
