import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetMarketoDataLayerDedupeForTests,
  pushMarketoSubmissionToDataLayer,
} from "./gtm-datalayer";

type DataLayerEntry = Record<string, unknown>;

const EXPECTED_PAYLOAD: DataLayerEntry = {
  formName: "Demo Form",
  event: "Marketo Form Submission",
};

const globalAny = globalThis as unknown as {
  window?: { dataLayer?: DataLayerEntry[] };
};

function installWindowWithDataLayer(dataLayer: DataLayerEntry[] | undefined) {
  globalAny.window = { dataLayer };
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
