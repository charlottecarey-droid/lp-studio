import type { RoiCalculatorBlockProps } from "./block-types";

export interface RoiPreset {
  id: string;
  name: string;
  description: string;
  config: Pick<RoiCalculatorBlockProps, "headline" | "subheadline" | "resultsPanelLabel" | "disclaimer" | "inputFields" | "outputFields">;
}

export const ROI_PRESETS: RoiPreset[] = [
  {
    id: "invisible-waste",
    name: "Invisible Waste Calculator",
    description: "DSO/Dental practice: quantifies hidden cost of lab inefficiency via remake rates and denture chair time.",
    config: {
      headline: "Calculate Your Hidden Cost of Inaction",
      subheadline: "Estimate the cost of remakes and lost chair time across your practice.",
      resultsPanelLabel: "Your Results",
      disclaimer: "Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.",
      inputFields: [
        { id: "practices", label: "Number of Practices", defaultValue: 1, min: 1, max: 2000, step: 1, inputType: "number" },
        { id: "restoCases", label: "Fixed Resto Cases / Month", defaultValue: 250, min: 1, max: 9999, step: 1, inputType: "number" },
        { id: "avgCaseValue", label: "Average Case Value", defaultValue: 1500, min: 100, max: 10000, step: 50, prefix: "$", inputType: "number" },
        { id: "currentRemakeRate", label: "Current Remake Rate (%)", defaultValue: 5, min: 0.5, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "improvedRemakeRate", label: "Improved Remake Rate (%)", defaultValue: 2, min: 0, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "prodPerHour", label: "Avg Production / Hour", defaultValue: 500, min: 50, max: 5000, step: 50, prefix: "$", inputType: "number" },
        { id: "dentureCases", label: "Denture Cases / Month", defaultValue: 150, min: 0, max: 9999, step: 1, inputType: "number" },
        { id: "apptsSaved", label: "Appointments Saved per Case", defaultValue: 1.5, min: 0.5, max: 5, step: 0.5, inputType: "slider" },
        { id: "avgMinPerAppt", label: "Avg Minutes / Appointment", defaultValue: 30, min: 5, max: 120, step: 5, inputType: "number" },
        { id: "workingDays", label: "Working Days / Month", defaultValue: 20, min: 1, max: 31, step: 1, inputType: "number" },
      ],
      outputFields: [
        { id: "remakesAvoided", label: "Remakes Avoided / Month", formula: "restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)", format: "number", decimals: 1 },
        { id: "recoveredProdYear", label: "Recovered Production / Year", formula: "(restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12", format: "currency", decimals: 0 },
        { id: "dentureChairHrs", label: "Chair Hours Freed / Month", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60", format: "number", decimals: 1 },
        { id: "dentureProdYear", label: "Denture Production Gain / Year", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12", format: "currency", decimals: 0 },
        { id: "totalAnnualUpside", label: "Total Annual Upside", formula: "((restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12 + dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12) * practices", format: "currency", decimals: 0, highlight: true },
      ],
    },
  },
  {
    id: "generic-roi",
    name: "Generic ROI Calculator",
    description: "Simple revenue impact calculator: current vs new conversion rates, with total revenue gain.",
    config: {
      headline: "See Your Revenue Potential",
      subheadline: "Enter your numbers to calculate your estimated return on investment.",
      resultsPanelLabel: "Your ROI Estimate",
      disclaimer: "Estimates are illustrative. Actual results will vary.",
      inputFields: [
        { id: "monthly_leads", label: "Monthly Leads", defaultValue: 500, min: 1, max: 100000, step: 10, inputType: "number" },
        { id: "current_rate", label: "Current Conversion Rate (%)", defaultValue: 2, min: 0.1, max: 100, step: 0.1, suffix: "%", inputType: "slider" },
        { id: "improved_rate", label: "Expected Conversion Rate (%)", defaultValue: 4, min: 0.1, max: 100, step: 0.1, suffix: "%", inputType: "slider" },
        { id: "avg_value", label: "Average Deal Value", defaultValue: 5000, min: 1, max: 1000000, step: 100, prefix: "$", inputType: "number" },
      ],
      outputFields: [
        { id: "current_rev", label: "Current Monthly Revenue", formula: "monthly_leads * (current_rate / 100) * avg_value", format: "currency", decimals: 0 },
        { id: "new_rev", label: "Projected Monthly Revenue", formula: "monthly_leads * (improved_rate / 100) * avg_value", format: "currency", decimals: 0 },
        { id: "annual_gain", label: "Annual Revenue Gain", formula: "(monthly_leads * (improved_rate / 100) * avg_value - monthly_leads * (current_rate / 100) * avg_value) * 12", format: "currency", decimals: 0, highlight: true },
      ],
    },
  },
];
