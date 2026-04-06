import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronDown, Download } from "lucide-react";
import jsPDF from "jspdf";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDollar = (n: number) => `$${fmt(n)}`;

type Scenario = "low" | "medium" | "high";
const scenarioApptsSaved: Record<Scenario, number> = { low: 1, medium: 1.5, high: 2 };

const InputField = ({
  label, value, onChange, prefix, suffix, type = "number", ...props
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  type?: string;
  [k: string]: any;
}) => (
  <div>
    <label className="text-[10px] font-semibold text-[#2A3A1A] uppercase tracking-wider mb-1 block">{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-background py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-[#003A30]/20 ${
          prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-7" : "px-3"
        }`}
        {...props}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const ResultRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="py-1">
    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-0">{label}</p>
    <p className={`text-xl font-bold tracking-tight ${highlight ? "text-[#C7E738]" : "text-white"}`}>{value}</p>
  </div>
);

interface DSOAccount {
  id: number;
  name: string;
}

const SalesRoiCalculator = () => {
  const [location] = useLocation();
  const [accountName, setAccountName] = useState<string>("");
  const [showDentureAdvanced, setShowDentureAdvanced] = useState(false);

  // Denture inputs
  const [dentureCases, setDentureCases] = useState(150);
  const [scenario, setScenario] = useState<Scenario>("medium");
  const [avgMinPerAppt, setAvgMinPerAppt] = useState(30);
  const [workingDays, setWorkingDays] = useState(20);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [pctReinvested, setPctReinvested] = useState(75);
  const [reinvestProdPerHr, setReinvestProdPerHr] = useState(750);

  // Fixed resto inputs
  const [restoCases, setRestoCases] = useState(250);
  const [avgCaseValue, setAvgCaseValue] = useState(1500);
  const [currentRemakeRate, setCurrentRemakeRate] = useState(5);
  const [improvedRemakeRate, setImprovedRemakeRate] = useState(2);
  const [chairTimePerAppt, setChairTimePerAppt] = useState(1);
  const [labCostPerCase, setLabCostPerCase] = useState(50);
  const [restoProdPerHour, setRestoProdPerHour] = useState(500);

  const [practices, setPractices] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get("accountId");
    if (accountId) {
      fetch(`${API_BASE}/sales/accounts/${accountId}`)
        .then((res) => res.json())
        .then((data: DSOAccount) => setAccountName(data.name))
        .catch((err) => console.error("Failed to load account:", err));
    }
  }, []);

  const apptsSaved = scenarioApptsSaved[scenario];

  const denture = useMemo(() => {
    const apptsFreed = dentureCases * apptsSaved;
    const chairMinFreed = apptsFreed * avgMinPerAppt;
    const chairHrsFreed = chairMinFreed / 60;
    const chairHrsPerDay = chairHrsFreed / workingDays;
    const incProdMonth = chairHrsFreed * prodPerHour;
    const incProdYear = incProdMonth * 12;
    const reinvestedHrs = chairHrsFreed * (pctReinvested / 100);
    const reinvestProdMonth = reinvestedHrs * reinvestProdPerHr;
    return { apptsFreed, chairHrsFreed, chairHrsPerDay, incProdMonth, incProdYear, reinvestedHrs, reinvestProdMonth };
  }, [dentureCases, apptsSaved, avgMinPerAppt, workingDays, prodPerHour, pctReinvested, reinvestProdPerHr]);

  const resto = useMemo(() => {
    const currentRemakes = restoCases * (currentRemakeRate / 100);
    const improvedRemakes = restoCases * (improvedRemakeRate / 100);
    const remakesAvoided = currentRemakes - improvedRemakes;
    const recoveredProdMonth = remakesAvoided * avgCaseValue;
    const recoveredProdYear = recoveredProdMonth * 12;
    const chairTimeSavedMonth = remakesAvoided * chairTimePerAppt;
    const chairTimeSavedYear = chairTimeSavedMonth * 12;
    const labCostsAvoidedMonth = remakesAvoided * labCostPerCase;
    const labCostsAvoidedYear = labCostsAvoidedMonth * 12;
    const opptyProdMonth = chairTimeSavedMonth * restoProdPerHour;
    const opptyProdYear = opptyProdMonth * 12;
    const totalUpsideYear = recoveredProdYear + labCostsAvoidedYear + opptyProdYear;
    return {
      currentRemakes, improvedRemakes, remakesAvoided,
      recoveredProdMonth, recoveredProdYear,
      chairTimeSavedMonth, chairTimeSavedYear,
      labCostsAvoidedMonth, labCostsAvoidedYear,
      opptyProdMonth, opptyProdYear, totalUpsideYear,
    };
  }, [restoCases, currentRemakeRate, improvedRemakeRate, avgCaseValue, chairTimePerAppt, labCostPerCase, restoProdPerHour]);

  const totalAnnualUpside = (denture.incProdYear + resto.totalUpsideYear) * practices;

  const exportPDF = useCallback(() => {
    const svgText = `<svg width="103" height="37" viewBox="0 0 103 37" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.9918 1.44019V7.70147C12.9219 7.09911 11.636 6.79355 10.1636 6.79355C7.31926 6.79355 4.74754 7.88547 2.924 9.86779C1.01102 11.9476 0 14.8521 0 18.2691C0 23.3092 2.7146 28.3953 8.77963 28.3953C10.7919 28.3953 12.7823 27.3702 13.9918 25.7471V27.8401H19.7907V0H18.4383L13.9918 1.44019ZM6.01813 16.8004C6.01813 12.3408 7.6999 9.34428 10.2018 9.34428C12.7037 9.34428 13.9907 11.3726 13.9907 15.3712V23.7506C13.0091 24.5994 12.0504 24.9312 10.5966 24.9312C9.14281 24.9312 7.92566 24.0978 7.11204 22.4528C6.4064 21.0257 6.01704 19.0182 6.01704 16.8004H6.01813Z" fill="white"/><path d="M76.4111 1.44019V7.70147C75.3319 7.09911 74.0349 6.79355 72.5497 6.79355C69.6806 6.79355 67.0865 7.88547 65.2471 9.86779C63.3175 11.9476 62.2977 14.8521 62.2977 18.2691C62.2977 23.3092 65.0359 28.3953 71.1536 28.3953C73.1834 28.3953 75.1911 27.3702 76.4111 25.7471V27.8401H82.2605V0H80.8963L76.4111 1.44019ZM68.3692 16.8004C68.3692 12.3408 70.0656 9.34428 72.5893 9.34428C75.113 9.34428 76.4111 11.3726 76.4111 15.3712V23.7506C75.421 24.5994 74.454 24.9312 72.9875 24.9312C71.5211 24.9312 70.2933 24.0978 69.4727 22.4528C68.7609 21.0257 68.3681 19.0182 68.3681 16.8004H68.3692Z" fill="white"/><path d="M54.1175 6.88379C51.8661 6.88379 49.871 7.89657 47.8649 10.0642V6.88379H46.4791L41.9907 8.32048V27.8791H47.8385L47.866 12.8567C49.2364 11.5096 50.5133 10.8541 51.7671 10.8541C54.1999 10.8541 54.7103 12.7671 54.7103 14.3721V27.8791H60.5768L60.5405 13.8181C60.5405 9.41193 58.1989 6.88379 54.1175 6.88379Z" fill="white"/><path d="M101.363 6.88488L96.9346 8.32107L96.951 21.1878C95.5794 22.5792 94.3357 23.2279 93.0384 23.2279C90.623 23.2279 90.1152 21.3156 90.1152 19.7112L90.1556 6.88379H88.7775L84.3256 8.31998V20.2649C84.3256 24.6707 86.6504 27.1968 90.7027 27.1968C92.9216 27.1968 94.9013 26.1866 96.9062 24.0241V29.1933C96.9062 32.5342 95.5412 34.6923 93.4272 34.6923C91.6505 34.6923 90.5029 33.5751 90.5029 31.8462C90.5029 31.1297 90.7081 30.4111 91.1144 29.711L91.2159 29.5363L86.1852 27.8871L86.1197 28.004C85.5988 28.9246 85.3466 29.7929 85.3466 30.659C85.3466 32.3791 86.2584 33.977 87.9149 35.1576C89.5812 36.3459 91.8624 37.0001 94.34 37.0001C99.599 37.0001 102.74 34.0818 102.74 29.1933V6.88488H101.365H101.363Z" fill="white"/><path d="M39.5814 14.6757C39.5814 9.79648 36.4396 6.88379 31.1754 6.88379C28.6958 6.88379 26.4129 7.53675 24.7453 8.72275C23.0874 9.90113 22.1749 11.4959 22.1749 13.2128C22.1749 14.0761 22.4285 14.9427 22.9487 15.8628L23.0142 15.9794L28.0489 14.3334L27.9472 14.159C27.5407 13.4591 27.3352 12.7419 27.3352 12.0279C27.3352 10.3023 28.4838 9.18713 30.2618 9.18713C32.3764 9.18713 33.7436 11.3411 33.7436 14.6757V15.2556L31.7317 15.7014C29.4575 16.2138 26.8708 16.8504 24.9704 17.9274C22.8754 19.1145 21.8558 20.6886 21.8558 22.7379C21.8558 26.0692 24.2207 28.3954 27.6063 28.3954C30.3602 28.3954 32.2245 27.4514 33.7425 25.2614V27.8231H39.5792V14.6746L39.5814 14.6757ZM27.8915 22.1852C27.8915 19.9222 29.2171 18.6218 32.3229 17.838L33.7447 17.4924V22.6998C32.9993 24.1648 31.8683 24.9072 30.382 24.9072C28.9854 24.9072 27.8915 23.7113 27.8915 22.1852Z" fill="white"/></svg>`;

    const canvas = document.createElement("canvas");
    const scale = 4;
    canvas.width = 103 * scale;
    canvas.height = 37 * scale;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const logoData = canvas.toDataURL("image/png");
      buildPDF(logoData);
    };
    img.src = url;

    function buildPDF(logoData: string) {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginL = 36;
      const marginR = 36;
      const contentW = pageW - marginL - marginR;
      const rightCol = pageW - marginR;

      const darkGreen: [number, number, number] = [0, 40, 32];
      const lime: [number, number, number] = [199, 231, 56];
      const white: [number, number, number] = [255, 255, 255];
      const mutedText: [number, number, number] = [90, 100, 95];
      const subtleText: [number, number, number] = [140, 150, 145];
      const footerH = 36;
      const headerH = 110;

      doc.setFillColor(...darkGreen);
      doc.rect(0, 0, pageW, headerH, "F");
      const logoW = 70;
      const logoH = (37 / 103) * logoW;
      doc.addImage(logoData, "PNG", marginL, 20, logoW, logoH);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("DSO ROI Calculator", marginL, 75);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 210, 195);
      doc.text(
        `${practices} practice${practices > 1 ? "s" : ""} · ${scenario} scenario · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        marginL, 90
      );

      let y = headerH + 28;

      const sectionTitle = (text: string) => {
        y += 6;
        doc.setFontSize(11);
        doc.setTextColor(...lime);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), marginL, y);
        y += 8;
        doc.setDrawColor(...lime);
        doc.setLineWidth(0.8);
        doc.line(marginL, y, marginL + 40, y);
        y += 22;
      };

      const categoryLabel = (text: string) => {
        doc.setFontSize(8);
        doc.setTextColor(...lime);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), marginL, y);
        y += 15;
      };

      const dataRow = (label: string, value: string, bold = false) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...subtleText);
        doc.text(label, marginL + 2, y);
        doc.setTextColor(...(bold ? darkGreen : mutedText));
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(value, rightCol, y, { align: "right" });
        y += 17;
      };

      const spacer = (h = 12) => { y += h; };

      const dividerLine = () => {
        doc.setDrawColor(220, 220, 215);
        doc.setLineWidth(0.3);
        doc.line(marginL, y, rightCol, y);
        y += 16;
      };

      sectionTitle("Denture Workflow Impact");
      categoryLabel("Inputs");
      dataRow("Denture Cases / Month", String(dentureCases));
      dataRow("Scenario", `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} (${apptsSaved} appts saved)`);
      dataRow("Avg Production / Hour", fmtDollar(prodPerHour));
      dataRow("Avg Minutes / Appointment", String(avgMinPerAppt));
      dataRow("Working Days / Month", String(workingDays));
      spacer(3);
      categoryLabel("Results");
      dataRow("Appointments Freed / Month", fmt(denture.apptsFreed));
      dataRow("Chair Hours Freed / Month", fmtDec(denture.chairHrsFreed));
      dataRow("Incremental Production / Month", fmtDollar(denture.incProdMonth), true);
      dataRow("Incremental Production / Year", fmtDollar(denture.incProdYear), true);
      spacer(4);
      dividerLine();

      sectionTitle("Fixed Restorations Remake Impact");
      categoryLabel("Inputs");
      dataRow("Cases / Month", String(restoCases));
      dataRow("Average Case Value", fmtDollar(avgCaseValue));
      dataRow("Current Remake Rate", `${currentRemakeRate}%`);
      dataRow("Improved Remake Rate", `${improvedRemakeRate}%`);
      dataRow("Avg Chair Time / Case", `${chairTimePerAppt} hr${chairTimePerAppt !== 1 ? "s" : ""}`);
      dataRow("Avg Lab Hard Cost / Case", fmtDollar(labCostPerCase));
      dataRow("Avg Production / Hour", fmtDollar(restoProdPerHour));
      spacer(3);
      categoryLabel("Results");
      dataRow("Remakes Avoided / Month", fmtDec(resto.remakesAvoided));
      dataRow("Recovered Production / Year", fmtDollar(resto.recoveredProdYear));
      dataRow("Lab Costs Avoided / Year", fmtDollar(resto.labCostsAvoidedYear));
      dataRow("Opportunity Production / Year", fmtDollar(resto.opptyProdYear), true);
      dataRow("Resto Total Upside / Year", fmtDollar(resto.totalUpsideYear), true);
      spacer(4);
      dividerLine();

      const boxH = 58;
      doc.setFillColor(...darkGreen);
      doc.roundedRect(marginL, y, contentW, boxH, 6, 6, "F");
      const titleText = `COMBINED ANNUAL UPSIDE${practices > 1 ? ` (${practices} PRACTICES)` : ""}`;
      doc.setFontSize(8);
      doc.setTextColor(180, 200, 190);
      doc.setFont("helvetica", "bold");
      doc.text(titleText, marginL + 20, y + 20);
      doc.setFontSize(22);
      doc.setTextColor(...lime);
      doc.setFont("helvetica", "bold");
      doc.text(fmtDollar(totalAnnualUpside), marginL + 20, y + 42);

      if (practices > 1) {
        const divX = marginL + contentW - 280;
        doc.setDrawColor(60, 90, 80);
        doc.setLineWidth(0.5);
        doc.line(divX, y + 12, divX, y + 46);
        doc.setFontSize(8);
        doc.setTextColor(180, 200, 190);
        doc.setFont("helvetica", "bold");
        doc.text("DENTURE", divX + 16, y + 20);
        doc.setFontSize(16);
        doc.setTextColor(...lime);
        doc.text(fmtDollar(denture.incProdYear * practices), divX + 16, y + 42);
        const div2X = divX + 140;
        doc.line(div2X, y + 12, div2X, y + 46);
        doc.setFontSize(8);
        doc.setTextColor(180, 200, 190);
        doc.setFont("helvetica", "bold");
        doc.text("REMAKES", div2X + 16, y + 20);
        doc.setFontSize(16);
        doc.setTextColor(...lime);
        doc.text(fmtDollar(resto.totalUpsideYear * practices), div2X + 16, y + 42);
      }

      y += boxH + 12;
      doc.setFontSize(7);
      doc.setTextColor(...subtleText);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.",
        marginL, y
      );

      doc.setFillColor(...darkGreen);
      doc.rect(0, pageH - footerH, pageW, footerH, "F");
      doc.addImage(logoData, "PNG", marginL, pageH - footerH + 10, 48, 17);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(160, 185, 175);
      doc.text("www.meetdandy.com/dso", pageW / 2, pageH - footerH + 22, { align: "center" });
      doc.setTextColor(...lime);
      doc.setFontSize(8);
      doc.text(`${practices} practices  •  ${scenario} scenario`, pageW - marginR, pageH - footerH + 22, { align: "right" });

      doc.save("dandy-roi-calculator.pdf");
    }
  }, [practices, scenario, apptsSaved, dentureCases, prodPerHour, avgMinPerAppt, workingDays, denture, restoCases, avgCaseValue, currentRemakeRate, improvedRemakeRate, chairTimePerAppt, labCostPerCase, restoProdPerHour, resto, totalAnnualUpside]);

  return (
    <SalesLayout>
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-[1100px] mx-auto">

          {/* Back button */}
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Back
          </button>

          {/* Header */}
          <div className="text-center mb-10">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-semibold tracking-[0.15em] text-[#003A30] mb-3 uppercase"
            >
              {accountName ? `For ${accountName}` : "Prove the Impact"}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-[#1A2A1A] leading-tight"
              style={{ fontFamily: "'Bagoss Standard','Inter',system-ui,sans-serif" }}
            >
              Calculate the cost of inaction.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto"
            >
              Estimate the cost of remakes and lost chair time across your DSO.
            </motion.p>
          </div>

          {/* Practices multiplier — centered like DSO */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-center gap-3"
          >
            <label className="text-[13px] font-medium text-[#2A3A1A]">Number of practices:</label>
            <input
              type="number"
              min={1}
              max={2000}
              value={practices}
              onChange={(e) => setPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] text-foreground text-center focus:outline-none focus:ring-2 focus:ring-[#003A30]/20"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="grid lg:grid-cols-5 gap-8 items-start"
          >
            {/* ── LEFT: Two input sections stacked (no Card wrappers — matches DSO) ── */}
            <div className="lg:col-span-3 space-y-6">

              {/* SECTION 1: Fixed Restoration Remake Impact */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-[#1A2A1A]" style={{ fontFamily: "'Inter', sans-serif" }}>Fixed Restoration Remake Impact</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Production recovered and costs avoided by reducing remakes.</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InputField label="Cases per Month:" value={restoCases}
                    onChange={(v) => setRestoCases(Math.max(1, parseInt(v) || 1))} min={1} max={9999} />
                  <InputField label="Average Case Value ($):" value={avgCaseValue} prefix="$"
                    onChange={(v) => setAvgCaseValue(parseInt(v) || 0)} min={100} max={10000} />
                  <InputField label="Current Remake Rate (%):" value={currentRemakeRate} suffix="%"
                    onChange={(v) => setCurrentRemakeRate(parseFloat(v) || 0)} min={0.5} max={20} step={0.5} />
                  <InputField label="Improved Remake Rate (%):" value={improvedRemakeRate} suffix="%"
                    onChange={(v) => setImprovedRemakeRate(parseFloat(v) || 0)} min={0} max={20} step={0.5} />
                  <InputField label="Avg Chair Time per Case (Hours):" value={chairTimePerAppt}
                    onChange={(v) => setChairTimePerAppt(parseFloat(v) || 0)} min={0} step={0.5} />
                  <InputField label="Avg Lab Hard Cost per Case ($):" value={labCostPerCase} prefix="$"
                    onChange={(v) => setLabCostPerCase(parseInt(v) || 0)} min={0} />
                  <InputField label="Avg Production per Hour ($):" value={restoProdPerHour} prefix="$"
                    onChange={(v) => setRestoProdPerHour(parseInt(v) || 0)} min={50} max={5000} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* SECTION 2: Denture Workflow Impact */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-[#1A2A1A]" style={{ fontFamily: "'Inter', sans-serif" }}>Denture Workflow Impact</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Chair time freed by reducing intermediate appointments.</p>
                </div>

                {/* Scenario toggle */}
                <div>
                  <label className="text-[10px] font-semibold text-[#2A3A1A] uppercase tracking-wider mb-1.5 block">
                    Benchmark Scenario:
                  </label>
                  <div className="grid grid-cols-3 gap-0 rounded-full border border-border overflow-hidden">
                    {(["low", "medium", "high"] as Scenario[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setScenario(s)}
                        className={`py-2 text-[13px] font-semibold capitalize transition-all ${
                          scenario === s
                            ? "bg-[#C7E738] text-[#003A30] font-bold"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{apptsSaved} appointments saved per case</p>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InputField label="Denture Cases / Month:" value={dentureCases}
                    onChange={(v) => setDentureCases(Math.max(0, parseInt(v) || 0))} min={0} max={9999} />
                  <InputField label="Avg Production per Hour ($):" value={prodPerHour} prefix="$"
                    onChange={(v) => setProdPerHour(parseInt(v) || 0)} min={50} max={5000} />
                </div>

                {/* Advanced */}
                <button
                  onClick={() => setShowDentureAdvanced(!showDentureAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDentureAdvanced ? "rotate-180" : ""}`} />
                  Advanced settings
                </button>
                {showDentureAdvanced && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 animate-in fade-in-0 slide-in-from-top-2">
                    <InputField label="Avg Min / Appointment:" value={avgMinPerAppt}
                      onChange={(v) => setAvgMinPerAppt(parseInt(v) || 30)} min={5} max={120} />
                    <InputField label="Working Days / Month:" value={workingDays}
                      onChange={(v) => setWorkingDays(parseInt(v) || 20)} min={1} max={31} />
                    <InputField label="% Time Reinvested:" value={pctReinvested} suffix="%"
                      onChange={(v) => setPctReinvested(parseInt(v) || 0)} min={0} max={100} />
                    <InputField label="Prod/Hr Reinvested Time ($):" value={reinvestProdPerHr} prefix="$"
                      onChange={(v) => setReinvestProdPerHr(parseInt(v) || 0)} min={50} max={5000} />
                  </div>
                )}
              </div>

              {/* CTA — lime green pill */}
              <button
                onClick={exportPDF}
                className="w-full rounded-full bg-[#C7E738] py-3 text-[13px] font-bold uppercase tracking-widest text-[#003A30] hover:brightness-105 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Print Results
              </button>
            </div>

            {/* ── RIGHT: Results panel — dark forest green, matches DSO ── */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl bg-[#003A30] p-5 md:p-6 space-y-0.5 sticky top-24">
                <h3 className="text-2xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Your results
                </h3>

                <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest pt-2">Denture Workflow</p>
                <ResultRow label="Appointments Freed / Month" value={fmt(denture.apptsFreed)} />
                <ResultRow label="Chair Hours Freed / Month" value={fmtDec(denture.chairHrsFreed)} />
                <ResultRow label="Incremental Production / Month ($)" value={fmtDollar(denture.incProdMonth)} highlight />
                <ResultRow label="Incremental Production / Year ($)" value={fmtDollar(denture.incProdYear)} highlight />

                <div className="border-t border-white/10 my-3" />

                <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest pt-2">Remake Impact</p>
                <ResultRow label="Remakes Avoided / Month" value={fmtDec(resto.remakesAvoided)} />
                <ResultRow label="Recovered Production / Year ($)" value={fmtDollar(resto.recoveredProdYear)} />
                <ResultRow label="Lab Costs Avoided / Year ($)" value={fmtDollar(resto.labCostsAvoidedYear)} />
                <ResultRow label="Opportunity Production / Year ($)" value={fmtDollar(resto.opptyProdYear)} highlight />

                <div className="border-t border-white/10 my-3" />

                <div className="pt-2">
                  <p className="text-[11px] font-bold text-[#C7E738] uppercase tracking-wider mb-0.5">
                    Total Financial Upside / Year ($){practices > 1 ? ` (${practices} practices)` : ""}
                  </p>
                  <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {fmtDollar(totalAnnualUpside)}
                  </p>
                  {practices > 1 && (
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/50">
                      <span>Denture: {fmtDollar(denture.incProdYear * practices)}</span>
                      <span>•</span>
                      <span>Remakes: {fmtDollar(resto.totalUpsideYear * practices)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <p className="mt-8 text-[11px] text-muted-foreground/50 leading-relaxed text-center">
            Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.
          </p>
        </div>
      </div>
    </SalesLayout>
  );
};

export default SalesRoiCalculator;
