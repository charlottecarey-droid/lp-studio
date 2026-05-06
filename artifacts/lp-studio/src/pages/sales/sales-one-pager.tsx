import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";
import headerImgExecutiveUrl from "@/assets/ai-scan-review-news.jpg";
import headerImgClinicalUrl from "@/assets/ai-scan-review-clinical.png";
import headerImgPracticeManagerUrl from "@/assets/dandy-dso-enterprise-data.webp";
import dandyScannerUrl from "@/assets/dandy-scanner-transparent.png?url";
import { useLocation, Link as RouterLink } from "wouter";
import {
  FileDown, Loader2, ChevronDown, Upload, X, Pencil, AlertTriangle, Link, QrCode, Settings2, RotateCcw
} from "lucide-react";
import { AgreementNumbersEditor } from "./agreement-numbers-editor";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import type { CustomTemplate } from "./one-pager-custom-utils";
import { fetchCustomTemplates, generateCustomTemplatePdf, apiLoadLayoutDefault, TEMPLATE_VISIBILITY_KEY, DELETED_BUILTINS_KEY } from "./one-pager-custom-utils";
import {
  generatePilotOnePager as sharedGeneratePilotOnePager,
  generateComparisonOnePager as sharedGenerateComparisonOnePager,
  generateNewPartnerOnePager as sharedGenerateNewPartnerOnePager,
  generateROIOnePager as sharedGenerateROIOnePager,
  generateAgreementSummaryOnePager as sharedGenerateAgreementSummaryOnePager,
  defaultAudienceContent as sharedDefaultAudienceContent,
  defaultAgreementSummaryContent as sharedDefaultAgreementSummaryContent,
  type Audience,
  type TeamContact,
  type AudienceContent,
  type NewPartnerContent,
  type NewPartnerOpts,
  type AgreementSummaryContent,
  type AgreementSection,
  type AgreementContact,
} from "@workspace/one-pager-types/generators";

// =============================================
// LAYOUT DEFAULTS (API with localStorage fallback)
// =============================================

const API_BASE = "/api";

export async function loadLayoutDefault(key: string): Promise<Record<string, any> | null> {
  // The API is the source of truth — sales reps must always see the freshest
  // template-editor saves, never a stale browser/HTTP cache or stale data left
  // in localStorage from a previous tenant or session.
  //
  //   • `cache: "no-store"` — bypass the HTTP cache so we never serve a stale
  //     `200 OK null` response captured before the user saved.
  //   • A successful response (even when the body is `null`) is authoritative;
  //     do NOT fall back to localStorage in that case, otherwise data from a
  //     different tenant context can leak through and override real defaults.
  //   • LocalStorage is only a fallback for true network failures (offline /
  //     server unreachable).
  try {
    const res = await fetch(
      `${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`,
      { cache: "no-store", credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        try { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(data)); } catch { /* quota — API is source of truth */ }
        return data as Record<string, any>;
      }
      // API explicitly says "no saved row" — clear stale local cache so we
      // can't accidentally show another tenant's old data, then return null.
      try { localStorage.removeItem(`lp_studio_${key}`); } catch {}
      return null;
    }
    // Non-OK (4xx/5xx): treat as transient. Do NOT poison with localStorage —
    // returning null lets the generator fall through to its built-in defaults
    // rather than render someone else's saved layout.
    return null;
  } catch {
    // True network error (offline, DNS, etc.) — last-resort cache.
    try {
      const raw = localStorage.getItem(`lp_studio_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

async function saveLayoutDefault(key: string, config: Record<string, any>): Promise<void> {
  // Always cache locally
  try {
    localStorage.setItem(`lp_studio_${key}`, JSON.stringify(config));
  } catch {}
  // Persist to API
  try {
    await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
  } catch {}
}

async function deleteLayoutDefault(key: string): Promise<void> {
  try {
    localStorage.removeItem(`lp_studio_${key}`);
  } catch {}
  try {
    await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`, { method: "DELETE" });
  } catch {}
}

// =============================================
// IMAGE HELPERS
// =============================================

const svgToPng = (svgSrc: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width * 2, height * 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = svgSrc;
  });
};

const loadImageAsBase64 = (src: string, format: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL(format));
    };
    img.onerror = reject;
    img.src = src;
  });
};


// =============================================
// LP-STUDIO TYPES (re-exported from shared)
// =============================================

// Audience, TeamContact, AudienceContent are imported from @workspace/one-pager-types/generators

// LP Studio extends AudienceContent with a local header image path
type LPAudienceContent = AudienceContent & { headerImage: string };

// =============================================
// IMAGE URLS
// =============================================

const headerImgExecutive = headerImgExecutiveUrl;
const headerImgClinical = headerImgClinicalUrl;
const headerImgPracticeManager = headerImgPracticeManagerUrl;
const dandyLogoWhite = dandyLogoWhiteUrl;

// =============================================
// AUDIENCE-SPECIFIC CONTENT (LP Studio version with headerImage)
// =============================================

export const defaultAudienceContent: Record<Audience, LPAudienceContent> = {
  executive: {
    ...sharedDefaultAudienceContent.executive,
    headerImage: headerImgExecutive,
  },
  clinical: {
    ...sharedDefaultAudienceContent.clinical,
    headerImage: headerImgClinical,
  },
  "practice-manager": {
    ...sharedDefaultAudienceContent["practice-manager"],
    headerImage: headerImgPracticeManager,
  },
};

// =============================================
// LP STUDIO PDF GENERATOR WRAPPERS
// These pre-load LP-Studio-specific assets and call the shared generators.
// The optional layoutOverride param lets the editor pass live config without
// an API round-trip; omit it for normal generation (loads from layout-defaults API).
// =============================================

export const generatePilotOnePager = async (
  dsoName: string,
  audience: Audience,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  editedContent: LPAudienceContent,
  customLinkText?: string,
  customLinkUrl?: string,
  layoutOverride?: Record<string, unknown>,
) => {
  // When no override is passed (normal generation), load both the shared config AND the
  // per-audience body config — the editor saves bodyCfg to separate audience-specific keys.
  let layoutOverrides: Record<string, unknown>;
  if (layoutOverride) {
    layoutOverrides = layoutOverride;
  } else {
    const audienceKeyMap: Record<Audience, string> = {
      executive: "dandy_pilot_executive_layout",
      clinical: "dandy_pilot_clinical_layout",
      "practice-manager": "dandy_pilot_practicemgr_layout",
    };
    const [shared, audienceData] = await Promise.all([
      loadLayoutDefault("dandy_pilot_template_layout").catch(() => null),
      loadLayoutDefault(audienceKeyMap[audience]).catch(() => null),
    ]);
    // Per-audience header image: the editor saves them in audienceHeaderImages[audience]
    // inside the shared pilot key. Pull it out and merge into headerCfg so the generator
    // uses the right image for each audience.
    const sharedData = shared ?? {};
    const audienceHeaderImages = (sharedData.audienceHeaderImages ?? {}) as Record<string, string | null>;
    const savedAudienceImg = audienceHeaderImages[audience] ?? null;
    layoutOverrides = {
      ...sharedData,
      // audience-specific bodyCfg takes precedence over any bodyCfg in the shared key
      ...(audienceData?.bodyCfg ? { bodyCfg: audienceData.bodyCfg } : {}),
      // audience-specific headerCfg merges on top of shared headerCfg
      // Priority (highest → lowest): per-audience headerCfg > legacy audienceHeaderImages > shared headerCfg
      headerCfg: {
        ...(sharedData.headerCfg as Record<string, unknown> ?? {}),
        // backward compat: old saves stored image-only in audienceHeaderImages
        ...(savedAudienceImg !== null && !audienceData?.headerCfg
          ? { headerImage: savedAudienceImg }
          : {}),
        // per-audience headerCfg overrides everything (most specific)
        ...(audienceData?.headerCfg as Record<string, unknown> ?? {}),
      },
    };
  }
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string | null };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    // Priority: saved per-audience image (in headerCfg) > editedContent.headerImage fallback
    const resolvedImg = hCfg.headerImage ?? editedContent.headerImage;
    if (resolvedImg) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      // If it's already a data URL (uploaded image), use it directly
      if (resolvedImg.startsWith("data:")) {
        headerImgData = resolvedImg;
      } else {
        [logoPng, headerImgData] = await Promise.all([
          svgToPng(dandyLogoWhite, 206, 74),
          loadImageAsBase64(resolvedImg),
        ]);
      }
    } else {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
    }
  } catch { /* continue without assets */ }

  return sharedGeneratePilotOnePager(
    dsoName, audience, teamContacts, phoneNumber,
    prospectLogoData, prospectLogoDims, editedContent,
    customLinkText, customLinkUrl,
    { logoPng, headerImgData, layoutOverrides },
  );
};

export const generateComparisonOnePager = async (
  dsoName: string,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  customLinkText?: string,
  customLinkUrl?: string,
  layoutOverride?: Record<string, unknown>,
) => {
  const layoutOverrides = layoutOverride ?? await loadLayoutDefault("dandy_comparison_template_layout").catch(() => null) ?? {};
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPng, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgExecutive),
      ]);
    }
  } catch { /* continue without assets */ }

  return sharedGenerateComparisonOnePager(
    dsoName, teamContacts, phoneNumber,
    prospectLogoData, prospectLogoDims,
    customLinkText, customLinkUrl,
    { logoPng, headerImgData, layoutOverrides },
  );
};

export const generateNewPartnerOnePager = async (
  dsoName: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  qrUrl: string,
  layoutOverride?: Record<string, unknown>,
) => {
  const saved = layoutOverride ?? await loadLayoutDefault("dandy_partner_template_layout").catch(() => null) ?? {};
  const hCfg = (saved.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPng, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgClinical),
      ]);
    }
  } catch { /* continue without assets */ }

  const content: NewPartnerContent = {
    headline: saved.partnerHeadline as string | undefined,
    intro: saved.partnerIntro as string | undefined,
    features: saved.partnerFeatures as Array<{ title: string; desc: string }> | undefined,
    stats: saved.partnerStats as Array<{ value: string; desc: string }> | undefined,
    footerLink: (saved.footerCfg as { link?: string } | undefined)?.link,
  };

  const opts: NewPartnerOpts = { logoPng, headerImgData, layoutOverrides: saved, content };
  return sharedGenerateNewPartnerOnePager(dsoName, prospectLogoData, prospectLogoDims, qrUrl, {}, opts);
};

export const generateROIOnePager = async (
  dsoName: string,
  numPractices: number,
  layoutOverride?: Record<string, unknown>,
) => {
  const layoutOverrides = layoutOverride ?? await loadLayoutDefault("dandy_roi_template_layout").catch(() => null) ?? {};
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPng, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgExecutive),
      ]);
    }
  } catch { /* continue without assets */ }

  return sharedGenerateROIOnePager(dsoName, numPractices, { logoPng, headerImgData, layoutOverrides });
};

export const generateAgreementSummaryOnePager = async (content: AgreementSummaryContent) => {
  // Load each asset independently so a single failure doesn't drop the other.
  const [logoResult, scannerResult] = await Promise.allSettled([
    svgToPng(dandyLogoWhite, 206, 74),
    loadImageAsBase64(dandyScannerUrl, "image/png"),
  ]);
  const logoPng = logoResult.status === "fulfilled" ? logoResult.value : null;
  const scannerPng = scannerResult.status === "fulfilled" ? scannerResult.value : null;
  return sharedGenerateAgreementSummaryOnePager(content, { logoPng, scannerPng });
};

export const defaultAgreementSummaryContent = sharedDefaultAgreementSummaryContent;
export type { AgreementSummaryContent, AgreementSection, AgreementContact };

// =============================================
// COMPONENT
// =============================================

type Template = "roi" | "pilot" | "comparison" | "new-partner" | "partner2" | "agreement-summary";

const SalesOnePager = () => {
  const [location] = useLocation();
  const { user, hasPerm } = useAuth();

  const [dsoName, setDsoName] = useState("");
  const [numPractices, setNumPractices] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<Template>("roi");
  const [audience, setAudience] = useState<Audience>("executive");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [teamContacts, setTeamContacts] = useState<TeamContact[]>([
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
  ]);
  const [showTeam, setShowTeam] = useState(false);
  const [showEditContent, setShowEditContent] = useState(false);
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");

  const [prospectLogoData, setProspectLogoData] = useState<string | null>(null);
  const [prospectLogoName, setProspectLogoName] = useState<string>("");
  const [prospectLogoDims, setProspectLogoDims] = useState<{ w: number; h: number }>({ w: 200, h: 100 });
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [editedContent, setEditedContent] = useState<Record<Audience, typeof defaultAudienceContent[Audience]>>(
    JSON.parse(JSON.stringify(defaultAudienceContent))
  );

  // Custom templates from Template Manager
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [templateVisibility, setTemplateVisibility] = useState<Record<string, boolean>>({});
  const [deletedBuiltins, setDeletedBuiltins] = useState<Record<string, boolean>>({});
  const [selectedCustomId, setSelectedCustomId] = useState<number | null>(null);
  const [customTemplateError, setCustomTemplateError] = useState<string | null>(null);
  const [visibilityLoaded, setVisibilityLoaded] = useState(false);
  // Per-field values for the currently selected custom template, keyed by
  // field.id so values survive across template switches without colliding.
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Agreement Summary content — sales reps can edit prices/numbers and any
  // section text inline before downloading. Seeded from defaults, then merged
  // with any admin-saved layout (so admin edits in the Template Editor still
  // flow through as the starting point).
  const [agreementContent, setAgreementContent] = useState<AgreementSummaryContent>(() => ({
    ...sharedDefaultAgreementSummaryContent,
    sections: sharedDefaultAgreementSummaryContent.sections.map(s => ({ ...s })),
  }));
  const [agreementLoaded, setAgreementLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadLayoutDefault("dandy_agreement_summary_template_layout")
      .catch(() => null)
      .then(saved => {
        if (cancelled) return;
        if (saved) {
          setAgreementContent(prev => ({
            ...prev,
            ...saved,
            sections: Array.isArray((saved as AgreementSummaryContent).sections) && (saved as AgreementSummaryContent).sections.length
              ? (saved as AgreementSummaryContent).sections.map(s => ({ ...s }))
              : prev.sections,
          }));
        }
        setAgreementLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);
  const resetAgreementContent = () => {
    setAgreementContent({
      ...sharedDefaultAgreementSummaryContent,
      sections: sharedDefaultAgreementSummaryContent.sections.map(s => ({ ...s })),
    });
  };

  // When the active custom template changes, seed the form with each
  // editable-by-sales field's defaultValue so empty inputs still ship the
  // marketing default (matches resolveValue() in pdf.ts).
  useEffect(() => {
    if (selectedCustomId === null) return;
    const ct = customTemplates.find(t => t.id === selectedCustomId);
    if (!ct) return;
    setCustomFieldValues(prev => {
      const next: Record<string, string> = { ...prev };
      ct.fields.forEach(f => {
        if (f.editableBySales && next[f.id] === undefined) {
          next[f.id] = f.defaultValue || "";
        }
      });
      return next;
    });
  }, [selectedCustomId, customTemplates]);

  const selectedCustomTemplate = selectedCustomId !== null
    ? customTemplates.find(t => t.id === selectedCustomId) ?? null
    : null;
  const customEditableFields = selectedCustomTemplate?.fields.filter(f => f.editableBySales) ?? [];

  const loadCustomTemplates = useCallback(async () => {
    setCustomTemplateError(null);
    try {
      const [tpls, vis, del] = await Promise.all([
        fetchCustomTemplates(),
        apiLoadLayoutDefault(TEMPLATE_VISIBILITY_KEY),
        apiLoadLayoutDefault(DELETED_BUILTINS_KEY),
      ]);
      setCustomTemplates(tpls.filter(t => !t.isDeleted));
      if (vis) setTemplateVisibility(vis as Record<string, boolean>);
      if (del) setDeletedBuiltins(del as Record<string, boolean>);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load custom templates";
      setCustomTemplateError(msg);
    } finally {
      setVisibilityLoaded(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get("accountId");
    if (accountId) {
      fetch(`/api/sales/accounts/${accountId}`)
        .then(r => r.json())
        .then(data => {
          if (data.name) setDsoName(data.name);
        })
        .catch(() => { });
    }
    loadCustomTemplates();
    // Seed editedContent from saved template-editor audienceContent so custom
    // subtitles, intro text, and feature copy from the editor flow into generated PDFs.
    loadLayoutDefault("dandy_pilot_template_layout").then(saved => {
      if (saved?.audienceContent && typeof saved.audienceContent === "object") {
        setEditedContent(prev => {
          const updated = { ...prev };
          for (const aud of ["executive", "clinical", "practice-manager"] as Audience[]) {
            const savedAud = (saved.audienceContent as Record<string, unknown>)[aud];
            if (savedAud && typeof savedAud === "object") {
              updated[aud] = { ...prev[aud], ...savedAud as object };
            }
          }
          return updated;
        });
      }
    }).catch(() => {});
  }, [loadCustomTemplates]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProspectLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setProspectLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
        setProspectLogoData(dataUrl);
      };
      img.onerror = () => setProspectLogoData(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setProspectLogoData(null);
    setProspectLogoName("");
    setProspectLogoDims({ w: 200, h: 100 });
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const logoWarnings = useMemo(() => {
    if (!prospectLogoData) return [];
    const warnings: string[] = [];
    const { w, h } = prospectLogoDims;
    if (w < 200 || h < 80) warnings.push(`Image is too small (${w}×${h}px). Min recommended: 200×80px.`);
    if (w > 800 || h > 400) warnings.push(`Image is very large (${w}×${h}px). Max recommended: 800×400px.`);
    if (h > w) warnings.push("Portrait logos may not render well. Horizontal logos work best.");
    if (w / h > 6) warnings.push("Logo is extremely wide and may be cropped.");
    return warnings;
  }, [prospectLogoData, prospectLogoDims]);

  const updateContact = (idx: number, field: keyof TeamContact, value: string) => {
    setTeamContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const updateFeature = (audienceKey: Audience, featureIdx: number, field: "title" | "description", value: string) => {
    setEditedContent(prev => {
      const updated = { ...prev };
      updated[audienceKey] = { ...updated[audienceKey], features: [...updated[audienceKey].features] };
      updated[audienceKey].features[featureIdx] = { ...updated[audienceKey].features[featureIdx], [field]: value };
      return updated;
    });
  };

  const updateSubtitle = (audienceKey: Audience, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [audienceKey]: { ...prev[audienceKey], subtitle: value },
    }));
  };

  const updateIntroText = (audienceKey: Audience, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [audienceKey]: { ...prev[audienceKey], introText: value },
    }));
  };

  const handleGenerate = async () => {
    // Agreement Summary doesn't need a DSO name — it ships with default copy.
    if (template !== "agreement-summary" && !dsoName.trim()) return;
    setGenerating(true);
    try {
      let doc;
      // Check if a custom template is selected
      if (selectedCustomId !== null) {
        const ct = customTemplates.find(t => t.id === selectedCustomId);
        if (ct) {
          // Build values: per-field-id from auto-rendered inputs PLUS
          // legacy generic keys (dso_name/phone/qr_url) so templates that
          // haven't flagged any fields editableBySales still pick up the
          // form's DSO Name + (when shown) phone/link inputs.
          const values: Record<string, string> = { ...customFieldValues };
          values.dso_name = values.dso_name || dsoName.trim();
          values.phone = values.phone || phoneNumber;
          values.qr_url = values.qr_url || customLinkUrl;
          doc = await generateCustomTemplatePdf(ct, values);
          const dsoLabel = (values.dso_name || dsoName.trim() || ct.name).replace(/\s+/g, "_");
          doc.save(`${ct.name.replace(/\s+/g, "_")}_${dsoLabel}.pdf`);
        }
      } else if (template === "pilot") {
        // Load the freshest saved audienceContent from the API so edits made in the
        // template editor always flow through, even if the user has had this tab open a while.
        let freshContent = editedContent[audience];
        try {
          const savedLayout = await loadLayoutDefault("dandy_pilot_template_layout");
          if (savedLayout?.audienceContent && typeof savedLayout.audienceContent === "object") {
            const savedAud = (savedLayout.audienceContent as Record<string, unknown>)[audience];
            if (savedAud && typeof savedAud === "object") {
              freshContent = { ...freshContent, ...savedAud as object } as typeof freshContent;
            }
          }
        } catch { /* use local editedContent */ }
        doc = await generatePilotOnePager(dsoName.trim(), audience, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, freshContent, customLinkText, customLinkUrl);
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_90Day_Pilot_${audience}.pdf`);
      } else if (template === "comparison") {
        doc = await generateComparisonOnePager(dsoName.trim(), teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, customLinkText, customLinkUrl);
        doc.save(`Dandy_Evolution_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
      } else if (template === "new-partner") {
        doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_New_Partner.pdf`);
      } else if (template === "partner2") {
        doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_Partner2.pdf`);
      } else if (template === "agreement-summary") {
        // Use the rep-edited content (which was seeded from defaults +
        // admin-saved layout on mount), so any number/price/text edits made
        // here flow into the generated PDF.
        doc = await generateAgreementSummaryOnePager(agreementContent);
        doc.save("Summary_of_Dandy_Agreement.pdf");
      } else {
        doc = await generateROIOnePager(dsoName.trim(), numPractices);
        doc.save(`Dandy_for_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
      }

      await fetch("/api/sales/pdf-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dso_name: dsoName.trim(),
          practice_count: numPractices,
        }),
      }).catch(() => { });
    } finally {
      setGenerating(false);
    }
  };

  const currentContent = editedContent[audience];
  const isAdmin = hasPerm("sales_campaigns");

  return (
    <SalesLayout>
      <div className="py-12">
        <div className="max-w-[900px] mx-auto px-6 md:px-10">
          <div className="mb-10">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back
            </button>
            <h1 className="text-3xl font-bold text-foreground text-center">One-Pager Generator</h1>
            <p className="text-sm text-muted-foreground mt-2 text-center">Generate branded PDF one-pagers for DSO prospects</p>
            {isAdmin && (
              <div className="flex justify-center mt-3">
                <RouterLink href="/sales/one-pager/editor">
                  <button className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted/40 transition-all">
                    <Settings2 className="w-3.5 h-3.5" />
                    Edit Templates
                  </button>
                </RouterLink>
              </div>
            )}
          </div>

          {customTemplateError && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-2 mb-4">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Custom templates unavailable: {customTemplateError}. Built-in templates are still available below.</span>
            </div>
          )}

          <div className={`flex flex-wrap items-center justify-center gap-3 mb-8 transition-opacity duration-150 ${visibilityLoaded ? "opacity-100" : "opacity-0"}`}>
            <div className="inline-flex rounded-full border border-border overflow-hidden flex-wrap">
              {!deletedBuiltins["roi"] && templateVisibility["roi"] !== false && (
                <button
                  onClick={() => { setTemplate("roi"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "roi" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  ROI One-Pager
                </button>
              )}
              {!deletedBuiltins["new-partner"] && templateVisibility["new-partner"] !== false && (
                <button
                  onClick={() => { setTemplate("new-partner"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "new-partner" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  Partner Practices
                </button>
              )}
              {!deletedBuiltins["partner2"] && templateVisibility["partner2"] !== false && (
                <button
                  onClick={() => { setTemplate("partner2"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "partner2" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  Partner 2
                </button>
              )}
              {!deletedBuiltins["comparison"] && templateVisibility["comparison"] !== false && (
                <button
                  onClick={() => { setTemplate("comparison"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "comparison" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  Dandy Evolution
                </button>
              )}
              {!deletedBuiltins["pilot"] && templateVisibility["pilot"] !== false && (
                <button
                  onClick={() => { setTemplate("pilot"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "pilot" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  90-Day Pilot
                </button>
              )}
              {!deletedBuiltins["agreement-summary"] && templateVisibility["agreement-summary"] !== false && (
                <button
                  onClick={() => { setTemplate("agreement-summary"); setSelectedCustomId(null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "agreement-summary" && selectedCustomId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  Agreement Summary
                </button>
              )}
              {customTemplates.filter(t => templateVisibility[`custom:${t.id}`] !== false).map(ct => (
                <button
                  key={ct.id}
                  onClick={() => { setTemplate("roi" as Template); setSelectedCustomId(ct.id ?? null); }}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${selectedCustomId === ct.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  {ct.name}
                </button>
              ))}
            </div>

            {template === "pilot" && (
              <div className="inline-flex rounded-full border border-border overflow-hidden">
                {(["executive", "clinical", "practice-manager"] as Audience[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${audience === a ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                  >
                    {a === "practice-manager" ? "Practice Mgr" : a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {template === "agreement-summary" && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Edit Agreement Details</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      All text is editable. Use the <span className="font-medium text-foreground">Numbers / Prices</span> chips to quickly update dollar amounts, percentages, and time periods.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetAgreementContent}
                    disabled={!agreementLoaded}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 hover:bg-muted/40 transition-colors disabled:opacity-50"
                    title="Reset to default text"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Headline</label>
                    <input
                      type="text"
                      value={agreementContent.headline}
                      onChange={e => setAgreementContent(p => ({ ...p, headline: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Subheadline</label>
                    <textarea
                      value={agreementContent.subheadline}
                      onChange={e => setAgreementContent(p => ({ ...p, subheadline: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  {agreementContent.sections.map((section, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
                      <input
                        type="text"
                        value={section.label}
                        onChange={e =>
                          setAgreementContent(p => ({
                            ...p,
                            sections: p.sections.map((s, j) => j === idx ? { ...s, label: e.target.value } : s),
                          }))
                        }
                        placeholder="Section label"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <textarea
                        value={section.body}
                        onChange={e =>
                          setAgreementContent(p => ({
                            ...p,
                            sections: p.sections.map((s, j) => j === idx ? { ...s, body: e.target.value } : s),
                          }))
                        }
                        rows={4}
                        placeholder="Section body"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-snug"
                      />
                      <AgreementNumbersEditor
                        body={section.body}
                        size="xs"
                        onChange={next =>
                          setAgreementContent(p => ({
                            ...p,
                            sections: p.sections.map((s, j) => j === idx ? { ...s, body: next } : s),
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Footer</label>
                    <textarea
                      value={agreementContent.footer}
                      onChange={e => setAgreementContent(p => ({ ...p, footer: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${template === "agreement-summary" ? "hidden" : ""}`}>
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">DSO Name</label>
                <input
                  type="text"
                  placeholder="Enter prospect name"
                  maxLength={25}
                  value={dsoName}
                  onChange={(e) => setDsoName(e.target.value.slice(0, 25))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {template === "roi" && (
                <div>
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block"># Practices</label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={numPractices}
                    onChange={(e) => setNumPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {(template === "new-partner" || template === "partner2") && (
                <div>
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">QR Code URL</label>
                  <input
                    type="url"
                    placeholder="https://meetdandy.com"
                    value={customLinkUrl}
                    onChange={(e) => setCustomLinkUrl(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}
            </div>

            {/* Custom-template fields exposed to sales by marketing.
                Each input is auto-rendered from the field's editableBySales
                flag and keyed by field.id, so values flow straight into
                generateCustomTemplatePdf via resolveValue() in pdf.ts. */}
            {selectedCustomTemplate && customEditableFields.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    {selectedCustomTemplate.name} — editable fields
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customEditableFields.map(f => (
                    <div key={f.id}>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        {f.salesLabel || f.label}
                      </label>
                      <input
                        type={f.type === "qr_code" || f.type === "link" ? "url" : "text"}
                        value={customFieldValues[f.id] ?? ""}
                        onChange={(e) => setCustomFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={f.defaultValue || ""}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      {f.salesHelpText && (
                        <p className="text-[10px] text-muted-foreground mt-1">{f.salesHelpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy fallback for custom templates with NO fields flagged
                editableBySales: marketing may still have generic phone/QR
                fields in the template that read from values.phone /
                values.qr_url. The custom-template path forces template="roi"
                (so the built-in Phone/QR conditionals below don't render),
                which would leave reps with no way to set those values.
                Render a minimal Phone + QR card here so resolveValue's legacy
                key fallback still has something to read. DSO Name is always
                shown above for every template, so we don't repeat it here. */}
            {selectedCustomTemplate && customEditableFields.length === 0 && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    {selectedCustomTemplate.name} — optional fields
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Phone (optional)</label>
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">QR / Link URL (optional)</label>
                    <input
                      type="url"
                      placeholder="https://meetdandy.com"
                      value={customLinkUrl}
                      onChange={(e) => setCustomLinkUrl(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  This template has no fields flagged "editable by sales" — these
                  values only fill in if marketing left a generic phone/QR field on the layout.
                </p>
              </div>
            )}

            {(template === "pilot" || template === "comparison" || template === "new-partner" || template === "partner2") && (
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">Prospect Logo (optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {prospectLogoData ? "Change Logo" : "Upload Logo"}
                  </button>
                  {prospectLogoData && (
                    <div className="flex items-center gap-2">
                      <img src={prospectLogoData} alt="Prospect logo" className="h-8 w-auto max-w-[80px] object-contain rounded border border-border p-0.5" />
                      <span className="text-xs text-muted-foreground">{prospectLogoName}</span>
                      <button onClick={clearLogo} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">PNG or JPG, transparent background recommended. Min 200×80px, max 800×400px.</p>
                {logoWarnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {logoWarnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(template === "pilot" || template === "comparison") && (
              <div>
                <button
                  onClick={() => setShowTeam(!showTeam)}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTeam ? "rotate-180" : ""}`} />
                  {showTeam ? "Hide" : "Edit"} Team & Phone
                </button>

                {showTeam && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {teamContacts.map((contact, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          placeholder={`Contact ${i + 1} name`}
                          value={contact.name}
                          onChange={(e) => updateContact(i, "name", e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          placeholder="Title"
                          value={contact.title}
                          onChange={(e) => updateContact(i, "title", e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          placeholder="Email or phone"
                          value={contact.contactInfo}
                          onChange={(e) => updateContact(i, "contactInfo", e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    ))}
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="Phone number (optional)"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        Custom Link (optional)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Link text (e.g. View Product Guide)"
                          value={customLinkText}
                          onChange={(e) => setCustomLinkText(e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={customLinkUrl}
                          onChange={(e) => setCustomLinkUrl(e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {template === "pilot" && (
              <div>
                <button
                  onClick={() => setShowEditContent(!showEditContent)}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEditContent ? "rotate-180" : ""}`} />
                  {showEditContent ? "Hide" : "Edit"} Content
                </button>

                {showEditContent && (
                  <div className="mt-4 space-y-4 rounded-xl border border-border p-4 bg-muted/30">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Subtitle <span className="font-normal text-muted-foreground/60">({currentContent.subtitle.length}/80 chars)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={currentContent.subtitle}
                        onChange={(e) => updateSubtitle(audience, e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>

                    {currentContent.introText !== undefined && (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Intro Text <span className="font-normal text-muted-foreground/60">({(currentContent.introText || "").length}/250 chars)</span>
                        </label>
                        <textarea
                          value={currentContent.introText}
                          maxLength={250}
                          onChange={(e) => updateIntroText(audience, e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Features <span className="font-normal text-muted-foreground/60">(title max 35 chars, description max 150 chars)</span>
                      </label>
                      {currentContent.features.map((feat, i) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                          <input
                            type="text"
                            maxLength={35}
                            value={feat.title}
                            onChange={(e) => updateFeature(audience, i, "title", e.target.value)}
                            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Feature title"
                          />
                          <input
                            type="text"
                            maxLength={150}
                            value={feat.description}
                            onChange={(e) => updateFeature(audience, i, "description", e.target.value)}
                            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Feature description"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!dsoName.trim() || generating}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-bold uppercase tracking-widest text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Generate & Download PDF
            </button>
          </div>
        </div>
      </div>
    </SalesLayout>
  );
};

export default SalesOnePager;
