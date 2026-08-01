import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetMarketoDataLayerDedupeForTests,
  pushMarketoSubmissionToDataLayer,
  toWebflowApiName,
} from "./gtm-datalayer";

type DataLayerEntry = Record<string, unknown>;

const EXPECTED_PAYLOAD: DataLayerEntry = {
  formName: "Demo Form",
  event: "Marketo Form Submission",
};

const globalAny = globalThis as unknown as {
  window?: {
    dataLayer?: DataLayerEntry[];
    wf?: { sendEvent?: (apiName: string) => void };
    intellimize?: { sendEvent?: (apiName: string) => void };
  };
};

function installWindowWithDataLayer(
  dataLayer: DataLayerEntry[] | undefined,
  wf?: { sendEvent?: (apiName: string) => void },
) {
  globalAny.window = { dataLayer, ...(wf ? { wf } : {}) };
}

function removeWindow() {
  delete globalAny.window;
}

describe("pushMarketoSubmissionToDataLayer", () => {
  beforeEach(() => {
    __resetMarketoDataLayerDedupeForTests();
  });

  afterEach(() => {
    removeWindow();
    __resetMarketoDataLayerDedupeForTests();
  });

  it("pushes the hardcoded Marketo Form Submission payload on first call", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer();

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual(EXPECTED_PAYLOAD);
  });

  it("is a no-op on a second call within the same page load (dedupe sentinel holds)", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer();
    pushMarketoSubmissionToDataLayer();

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual(EXPECTED_PAYLOAD);
  });

  it("pushes again after __resetMarketoDataLayerDedupeForTests clears the sentinel", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer();
    __resetMarketoDataLayerDedupeForTests();
    pushMarketoSubmissionToDataLayer();

    expect(dataLayer).toHaveLength(2);
    expect(dataLayer[0]).toEqual(EXPECTED_PAYLOAD);
    expect(dataLayer[1]).toEqual(EXPECTED_PAYLOAD);
  });

  it("is a safe no-op when window is undefined (SSR / node)", () => {
    removeWindow();

    expect(() => pushMarketoSubmissionToDataLayer()).not.toThrow();
  });

  it("is a safe no-op when window.dataLayer is undefined (GTM not loaded)", () => {
    installWindowWithDataLayer(undefined);

    expect(() => pushMarketoSubmissionToDataLayer()).not.toThrow();
    expect(globalAny.window?.dataLayer).toBeUndefined();
  });

  it("honours a per-form override for event + formName", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer({
      enabled: true,
      event: "Custom Event",
      formName: "Pricing Page Form",
    });

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual({
      event: "Custom Event",
      formName: "Pricing Page Form",
    });
  });

  it("falls back to defaults when override fields are missing or blank", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer({ enabled: true, event: "   " });

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual(EXPECTED_PAYLOAD);
  });

  it("skips the push entirely when enabled is false", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer({ enabled: false });

    expect(dataLayer).toHaveLength(0);
  });

  it("treats a null config as default-on (preserves historical behavior)", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer);

    pushMarketoSubmissionToDataLayer(null);

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual(EXPECTED_PAYLOAD);
  });
});

describe("Webflow Optimize sendEvent channel", () => {
  beforeEach(() => {
    __resetMarketoDataLayerDedupeForTests();
  });

  afterEach(() => {
    removeWindow();
    __resetMarketoDataLayerDedupeForTests();
  });

  it("fires wf.sendEvent with the camelCase apiName alongside the dataLayer push", () => {
    const dataLayer: DataLayerEntry[] = [];
    const sent: string[] = [];
    installWindowWithDataLayer(dataLayer, { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer();

    expect(dataLayer).toHaveLength(1);
    expect(sent).toEqual(["marketoFormSubmission"]);
  });

  it("derives the apiName from a per-form event override", () => {
    const sent: string[] = [];
    installWindowWithDataLayer([], { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer({ enabled: true, event: "Webinar Replay Signup" });

    expect(sent).toEqual(["webinarReplaySignup"]);
  });

  it("dedupes wf.sendEvent within the same page load", () => {
    const sent: string[] = [];
    installWindowWithDataLayer([], { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer();
    pushMarketoSubmissionToDataLayer();

    expect(sent).toEqual(["marketoFormSubmission"]);
  });

  it("skips wf.sendEvent when the form disables the push", () => {
    const sent: string[] = [];
    installWindowWithDataLayer([], { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer({ enabled: false });

    expect(sent).toEqual([]);
  });

  it("still delivers to Webflow when window.dataLayer is missing, and latches the dedupe", () => {
    const sent: string[] = [];
    installWindowWithDataLayer(undefined, { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer();
    pushMarketoSubmissionToDataLayer();

    expect(sent).toEqual(["marketoFormSubmission"]);
  });

  it("does not latch the dedupe when neither channel is available (retry allowed)", () => {
    installWindowWithDataLayer(undefined);

    pushMarketoSubmissionToDataLayer();

    const dataLayer: DataLayerEntry[] = [];
    const sent: string[] = [];
    installWindowWithDataLayer(dataLayer, { sendEvent: (n) => sent.push(n) });

    pushMarketoSubmissionToDataLayer();

    expect(dataLayer).toHaveLength(1);
    expect(sent).toEqual(["marketoFormSubmission"]);
  });

  it("a throwing sendEvent never breaks the submit path and the dataLayer still latches", () => {
    const dataLayer: DataLayerEntry[] = [];
    installWindowWithDataLayer(dataLayer, {
      sendEvent: () => {
        throw new Error("optimize exploded");
      },
    });

    expect(() => pushMarketoSubmissionToDataLayer()).not.toThrow();
    expect(dataLayer).toHaveLength(1);
  });
});

describe("toWebflowApiName", () => {
  it("camelCases display names the way Webflow Optimize auto-generates apiNames", () => {
    expect(toWebflowApiName("Marketo Form Submission")).toBe("marketoFormSubmission");
    expect(toWebflowApiName("Demo Form")).toBe("demoForm");
    expect(toWebflowApiName("newsletter-subscribe (v2)")).toBe("newsletterSubscribeV2");
    expect(toWebflowApiName("already camelCased")).toBe("alreadyCamelcased");
  });
});
