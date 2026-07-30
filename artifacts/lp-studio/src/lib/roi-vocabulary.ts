/**
 * Vocabulary + defaults for the ROI calculator.
 *
 * The calculator's ARITHMETIC was never dental — only its nouns were. Both
 * models are industry-neutral shapes:
 *
 *   Model A — time recovered:  volume × time saved per unit → hours freed,
 *             valued at a revenue-per-hour rate, with a share reinvested.
 *   Model B — rework avoided:  volume × (current defect rate − improved rate)
 *             → units not redone, valued as revenue + recovered time +
 *             per-unit hard cost.
 *
 * A dental lab measures that in cases, chair time and remakes; a contractor in
 * projects, crew hours and rework; a manufacturer in orders, machine time and
 * scrap. Same equations. So "make the calculator generic" is a vocabulary
 * layer, not a second calculator — one set of maths, relabelled per tenant.
 *
 * Pure and UI-free so the label resolution and defaults can be unit tested
 * without rendering the page or touching the network.
 */

/** Every noun the calculator renders, so none are hardcoded in the page. */
export interface RoiVocabulary {
  /** Page title + subtitle. */
  title: string;
  subtitle: string;
  /** What one unit of work is: "case", "project", "order". */
  unit: string;
  unitPlural: string;
  /** What the org is a collection of: "practice", "location", "crew". */
  site: string;
  sitePlural: string;
  /** Model A. */
  modelAName: string;
  modelAVolumeLabel: string;
  /** The time being freed: "chair time", "crew time", "machine time". */
  timeNoun: string;
  /** What a unit of freed time is spent on producing. */
  revenuePerHourLabel: string;
  /** Model B. */
  modelBName: string;
  modelBVolumeLabel: string;
  /** What a redone unit is called: "remake", "rework", "callback". */
  rework: string;
  reworkPlural: string;
  /** Per-unit hard cost avoided: "lab cost", "material cost". */
  hardCostLabel: string;
  /** Value of one unit of work. */
  unitValueLabel: string;
}

/**
 * Neutral defaults — what every tenant gets unless they say otherwise.
 * Deliberately business-generic: no industry has to recognise itself here,
 * and nothing reads as a leftover from someone else's vertical.
 */
export const NEUTRAL_ROI_VOCABULARY: RoiVocabulary = {
  title: "ROI Calculator",
  subtitle: "Estimate the value of recovered time and avoided rework across your business.",
  unit: "job",
  unitPlural: "jobs",
  site: "location",
  sitePlural: "locations",
  modelAName: "Time Savings Impact",
  modelAVolumeLabel: "Jobs per month",
  timeNoun: "productive time",
  revenuePerHourLabel: "Revenue per hour",
  modelBName: "Rework Reduction Impact",
  modelBVolumeLabel: "Jobs per month",
  rework: "rework",
  reworkPlural: "reworks",
  hardCostLabel: "Material cost per job",
  unitValueLabel: "Average job value",
};

/**
 * Dandy's own wording. Kept as a PRESET rather than as the code default: the
 * dental vocabulary is one tenant's configuration, not the product's baseline.
 */
export const DENTAL_ROI_VOCABULARY: RoiVocabulary = {
  title: "DSO ROI Calculator",
  subtitle: "Estimate the cost of remakes and lost chair time across your DSO.",
  unit: "case",
  unitPlural: "cases",
  site: "practice",
  sitePlural: "practices",
  modelAName: "Denture Workflow Impact",
  modelAVolumeLabel: "Denture cases per month",
  timeNoun: "chair time",
  revenuePerHourLabel: "Production per chair hour",
  modelBName: "Restorative Quality Impact",
  modelBVolumeLabel: "Restorative cases per month",
  rework: "remake",
  reworkPlural: "remakes",
  hardCostLabel: "Lab cost per case",
  unitValueLabel: "Average case value",
};

/** Numeric starting points, so a tenant's reps open the page on THEIR numbers. */
export interface RoiDefaults {
  modelAVolume: number;
  minutesPerUnit: number;
  workingDays: number;
  revenuePerHour: number;
  pctReinvested: number;
  reinvestRevenuePerHour: number;
  modelBVolume: number;
  unitValue: number;
  currentReworkRate: number;
  improvedReworkRate: number;
  hoursPerRework: number;
  hardCostPerUnit: number;
  modelBRevenuePerHour: number;
  sites: number;
}

/** The values the calculator shipped with — unchanged, so nothing moves for
 *  anyone who doesn't configure it. */
export const DEFAULT_ROI_DEFAULTS: RoiDefaults = {
  modelAVolume: 150,
  minutesPerUnit: 30,
  workingDays: 20,
  revenuePerHour: 500,
  pctReinvested: 75,
  reinvestRevenuePerHour: 750,
  modelBVolume: 250,
  unitValue: 1500,
  currentReworkRate: 5,
  improvedReworkRate: 2,
  hoursPerRework: 1,
  hardCostPerUnit: 50,
  modelBRevenuePerHour: 500,
  sites: 1,
};

/** What a tenant may override. Every field optional — a partial config layers
 *  onto the base rather than replacing it, so a tenant that only renames
 *  "job" → "project" keeps every other label. */
export interface RoiCalculatorConfig {
  enabled?: boolean;
  vocabulary?: Partial<RoiVocabulary>;
  defaults?: Partial<RoiDefaults>;
}

/** Trimmed non-empty strings only: a blank field in the editor must fall back
 *  to the base label, never blank the UI. */
function overlayVocabulary(base: RoiVocabulary, override?: Partial<RoiVocabulary>): RoiVocabulary {
  if (!override) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === "string" && value.trim()) {
      (out as Record<string, string>)[key] = value.trim();
    }
  }
  return out;
}

/** Finite numbers only; NaN/blank/negative fall back to the base default. */
function overlayDefaults(base: RoiDefaults, override?: Partial<RoiDefaults>): RoiDefaults {
  if (!override) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) (out as Record<string, number>)[key] = n;
  }
  return out;
}

/**
 * Resolve what this tenant's calculator says.
 *
 * `isDandy` selects the dental preset as the BASE, which keeps Dandy's page
 * byte-identical to what it was while making dental just one configuration
 * among others. A tenant's own config always layers on top.
 */
export function resolveRoiVocabulary(
  config: RoiCalculatorConfig | null | undefined,
  isDandy: boolean,
): RoiVocabulary {
  return overlayVocabulary(isDandy ? DENTAL_ROI_VOCABULARY : NEUTRAL_ROI_VOCABULARY, config?.vocabulary);
}

export function resolveRoiDefaults(config: RoiCalculatorConfig | null | undefined): RoiDefaults {
  return overlayDefaults(DEFAULT_ROI_DEFAULTS, config?.defaults);
}

/**
 * Is the calculator offered to this tenant at all?
 *
 * Opt-OUT, not opt-in: it works for any business out of the box now, so
 * hiding it is the deliberate act. Dandy is always on.
 */
export function isRoiCalculatorEnabled(
  config: RoiCalculatorConfig | null | undefined,
  isDandy: boolean,
): boolean {
  if (isDandy) return true;
  return config?.enabled !== false;
}

/* ── the two models, extracted so the page renders results it doesn't compute ──
   Same arithmetic as before, renamed off dental nouns. Kept here so the maths
   is testable on its own and can't drift from the labels describing it. */

export interface TimeSavedInputs {
  volume: number;
  unitsSavedPer: number;      // e.g. appointments/visits avoided per unit
  minutesPerUnitSaved: number;
  workingDays: number;
  revenuePerHour: number;
  pctReinvested: number;
  reinvestRevenuePerHour: number;
}

export function computeTimeSaved(i: TimeSavedInputs) {
  const eventsFreed = i.volume * i.unitsSavedPer;
  const minutesFreed = eventsFreed * i.minutesPerUnitSaved;
  const hoursFreed = minutesFreed / 60;
  const hoursPerDay = i.workingDays > 0 ? hoursFreed / i.workingDays : 0;
  const revenueMonth = hoursFreed * i.revenuePerHour;
  const revenueYear = revenueMonth * 12;
  const reinvestedHrs = hoursFreed * (i.pctReinvested / 100);
  const reinvestRevenueMonth = reinvestedHrs * i.reinvestRevenuePerHour;
  return { eventsFreed, hoursFreed, hoursPerDay, revenueMonth, revenueYear, reinvestedHrs, reinvestRevenueMonth };
}

export interface ReworkInputs {
  volume: number;
  currentRatePct: number;
  improvedRatePct: number;
  unitValue: number;
  hoursPerRework: number;
  hardCostPerUnit: number;
  revenuePerHour: number;
}

export function computeReworkAvoided(i: ReworkInputs) {
  const currentRework = i.volume * (i.currentRatePct / 100);
  const improvedRework = i.volume * (i.improvedRatePct / 100);
  const reworkAvoided = currentRework - improvedRework;
  const recoveredMonth = reworkAvoided * i.unitValue;
  const recoveredYear = recoveredMonth * 12;
  const timeSavedMonth = reworkAvoided * i.hoursPerRework;
  const timeSavedYear = timeSavedMonth * 12;
  // Hard cost applies to EVERY unit, not just the ones redone — switching
  // supplier removes the per-unit cost across the whole volume.
  const hardCostMonth = i.volume * i.hardCostPerUnit;
  const hardCostYear = hardCostMonth * 12;
  const opportunityMonth = timeSavedMonth * i.revenuePerHour;
  const opportunityYear = opportunityMonth * 12;
  const totalUpsideYear = recoveredYear + hardCostYear + opportunityYear;
  return {
    currentRework, improvedRework, reworkAvoided,
    recoveredMonth, recoveredYear,
    timeSavedMonth, timeSavedYear,
    hardCostMonth, hardCostYear,
    opportunityMonth, opportunityYear, totalUpsideYear,
  };
}
