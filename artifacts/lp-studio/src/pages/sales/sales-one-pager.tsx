import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  FileDown, Loader2, ChevronDown, Upload, X, Pencil, AlertTriangle, Link, QrCode
} from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";

// =============================================
// LAYOUT DEFAULTS (API with localStorage fallback)
// =============================================

const API_BASE = "/api";

async function loadLayoutDefault(key: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        // Cache in localStorage
        localStorage.setItem(`lp_studio_${key}`, JSON.stringify(data));
        return data;
      }
    }
  } catch {
    // API unavailable — fall back to localStorage
  }
  try {
    const raw = localStorage.getItem(`lp_studio_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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

const drawSeparator = (doc: jsPDF, x: number, y: number, length: number, color: [number, number, number]) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + length, y);
};

// =============================================
// TYPES
// =============================================

type Audience = "executive" | "clinical" | "practice-manager";

interface TeamContact {
  name: string;
  title: string;
  contactInfo: string;
}

// =============================================
// IMAGE URLS (from Supabase CDN)
// =============================================

const headerImgExecutive = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80";
const headerImgClinical = "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=1200&q=80";
const headerImgPracticeManager = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80";
const dandyLogoWhite = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 206 74'%3E%3Ctext x='20' y='50' font-size='40' font-weight='bold' fill='white'%3Edandy%3C/text%3E%3C/svg%3E";

// =============================================
// AUDIENCE-SPECIFIC CONTENT
// =============================================

const defaultAudienceContent: Record<Audience, {
  subtitle: string;
  headerImage: string;
  introText?: string;
  features: { icon: string; title: string; description: string }[];
  checklist?: string[];
}> = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
    headerImage: headerImgExecutive,
    introText: "What to expect during this pilot: Over the next 90 days, we'll partner with your organization to onboard clinicians efficiently, support adoption of digital workflows, and ensure cases run smoothly in practice.",
    features: [
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
      { icon: "💬", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "📊", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
      { icon: "📋", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
      { icon: "💰", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
    ],
  },
  clinical: {
    subtitle: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
    headerImage: headerImgClinical,
    features: [
      { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
    headerImage: headerImgPracticeManager,
    checklist: [
      "Attend an in-person or virtual onboarding session",
      "Use the Dandy Portal to track, manage, and review orders",
      "Access Dandy Insights to get an overview of pilot performance",
      "Check in with clinicians to gather high-level feedback",
    ],
    features: [
      { icon: "💰", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
      { icon: "📊", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, seamless communicate with the lab, scanner, manage payment, and more." },
      { icon: "💬", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
    ],
  },
};

// =============================================
// 90-DAY PILOT PDF GENERATOR
// =============================================

export const generatePilotOnePager = async (
  dsoName: string,
  audience: Audience,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  editedContent: typeof defaultAudienceContent[Audience],
  customLinkText?: string,
  customLinkUrl?: string,
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  let layoutOverrides: { headerCfg?: any; bodyCfg?: any; teamCfg?: any; footerCfg?: any } = {};
  try {
    const saved = await loadLayoutDefault("dandy_pilot_template_layout");
    if (saved) layoutOverrides = saved;
  } catch { }
  const hCfg = layoutOverrides.headerCfg || {};
  const bCfg = layoutOverrides.bodyCfg || {};
  const tCfg = layoutOverrides.teamCfg || {};
  const fCfg = layoutOverrides.footerCfg || {};

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lineColor: [number, number, number] = [200, 205, 200];
  const checkGreen: [number, number, number] = [0, 80, 60];

  const content = editedContent;

  let headerImgData: string | null = null;
  let logoPngData: string | null = null;
  try {
    if (hCfg.headerImage) {
      [logoPngData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
      ]);
      headerImgData = hCfg.headerImage;
    } else {
      [headerImgData, logoPngData] = await Promise.all([
        loadImageAsBase64(content.headerImage),
        svgToPng(dandyLogoWhite, 206, 74),
      ]);
    }
  } catch { }

  const headerH = hCfg.height || 280;
  const splitX = w * ((hCfg.splitRatio || 48) / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const panelW = w - splitX;
    const panelH = headerH;
    const imgFormat = headerImgData.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(headerImgData, imgFormat, splitX, 0, panelW, panelH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  if (logoPngData) {
    try {
      doc.addImage(logoPngData, "PNG", margin, 50, 80, 28);
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...white); doc.text("dandy", margin, 68);
    }
  }

  const logoEndX = margin + 90;
  doc.setDrawColor(180, 210, 195);
  doc.setLineWidth(0.75);
  doc.line(logoEndX, 50, logoEndX, 78);

  if (prospectLogoData) {
    try {
      const maxW = 135, maxH = 36;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      doc.addImage(prospectLogoData, "PNG", logoEndX + 12, 64 - lh / 2, lw, lh);
    } catch { }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(dsoName.length > 15 ? 12 : 16);
    doc.setTextColor(...white);
    doc.text(dsoName, logoEndX + 12, 70);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(dsoName.length > 15 ? 22 : (hCfg.titleFontSize || 28));
  doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize(`Dandy x ${dsoName}\n90-Day Pilot`, splitX - margin - 20);
  doc.text(titleLines, margin, 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(hCfg.subtitleFontSize || 11);
  doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize(content.subtitle, splitX - margin - 20);
  doc.text(subLines, margin, 220 + (hCfg.subtitleOffsetY || 0));

  let y = headerH + 35;

  const offsetX = bCfg.contentOffsetX || 0;
  const sectionGap = bCfg.sectionSpacing ?? 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(bCfg.headlineFontSize || 16);
  doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(
    "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.",
    contentW
  );
  doc.text(headlineLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW });
  y += headlineLines.length * 20 + sectionGap;

  if (content.introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bCfg.introFontSize || 9.5);
    doc.setTextColor(...textMuted);
    const introLines = doc.splitTextToSize(content.introText, contentW - 40);
    doc.text(introLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW - 40 });
    y += introLines.length * 13 + sectionGap;
  }

  if (audience === "practice-manager" && content.checklist) {
    y += 4;
    const leftColW = contentW * 0.42;
    const rightColX = margin + contentW * 0.48;
    const rightColW = contentW * 0.52;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textDark);
    doc.text("How to get the most out of this pilot:", margin, y);

    let checkY = y + 20;
    content.checklist.forEach((item) => {
      doc.setDrawColor(...checkGreen); doc.setLineWidth(1.2);
      doc.line(margin + 6, checkY - 2, margin + 8, checkY); doc.line(margin + 8, checkY, margin + 12, checkY - 6);

      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textDark);
      const lines = doc.splitTextToSize(item, leftColW - 40);
      doc.text(lines, margin + 22, checkY);
      checkY += lines.length * 12 + 10;
    });

    let featY = y;
    content.features.forEach((feat) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(bCfg.featureTitleFontSize || 10); doc.setTextColor(...textDark);
      doc.text(feat.title, rightColX + 28, featY);
      doc.setFont("helvetica", "normal"); doc.setFontSize(bCfg.featureDescFontSize || 8.5); doc.setTextColor(...textMuted);
      const descLines = doc.splitTextToSize(feat.description, rightColW - 40);
      doc.text(descLines, rightColX + 28, featY + 14);
      featY += 14 + descLines.length * 11 + 18;
    });
    y = Math.max(checkY, featY) + 4;
  } else {
    const bx = bCfg.bulletOffsetX || 0;
    const by = bCfg.bulletOffsetY || 0;
    y += 4 + by;
    const colW = contentW / 2;
    const features = content.features;
    const rows = Math.ceil(features.length / 2);
    const rowH = (features.length > 4 ? 64 : 80) + (bCfg.sectionSpacing || 0);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        if (idx >= features.length) continue;
        const feat = features[idx];
        const fx = margin + col * colW + offsetX + bx;
        const fy = y + row * rowH;
        doc.setFont("helvetica", "bold"); doc.setFontSize(bCfg.featureTitleFontSize || 10); doc.setTextColor(...textDark);
        doc.text(feat.title, fx, fy);
        doc.setFont("helvetica", "normal"); doc.setFontSize(bCfg.featureDescFontSize || 8.5); doc.setTextColor(...textMuted);
        const descLines = doc.splitTextToSize(feat.description, colW - 32);
        doc.text(descLines, fx, fy + 14);
      }
    }
    y += rows * rowH + 4;

    if (audience === "clinical") {
      y -= 20;
      drawSeparator(doc, margin, y, contentW, lineColor);
      y += 30;
      doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(163, 190, 60);
      doc.text("\u201C", margin, y + 7);
      const quoteText = "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
      doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...textDark);
      const quoteLines = doc.splitTextToSize(quoteText, contentW - 30);
      doc.text(quoteLines, margin + 18, y);
      y += quoteLines.length * 13 + 8;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...textDark);
      doc.text("Dr. Tania Arthur", margin + 18, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...textMuted);
      doc.text("Dentist, Oasis Modern Dentistry, TX US", margin + 18, y + 12);
      y += 30;
    }
  }

  const showTeam = tCfg.show !== false;
  const filteredContacts = teamContacts.filter(c => c.name.trim());
  if (showTeam && filteredContacts.length > 0) {
    drawSeparator(doc, margin, y, contentW, lineColor);
    y += 29;
    doc.setFont("helvetica", "bold"); doc.setFontSize(tCfg.headingFontSize || 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and pilot check-ins.", w / 2, y + 15, { align: "center" });
    y += 44;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(tCfg.nameFontSize || 10); doc.setTextColor(...textDark);
      doc.text(contact.name, cx, y, { align: "center" });
      let contactY = y + 14;
      if (contact.title) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
        doc.text(contact.title, cx, contactY, { align: "center" });
        contactY += 14;
      }
      if (contact.contactInfo) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
        doc.text(contact.contactInfo, cx, contactY, { align: "center" });
        contactY += 12;
      }
      maxContactBottom = Math.max(maxContactBottom, contactY);
    });
    y = maxContactBottom + 10;
  }

  const footerH = customLinkText?.trim() && customLinkUrl?.trim() ? 56 : 44;
  const footerY = h - footerH;
  const gapStart = y;
  if (gapStart < footerY) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, gapStart, w, footerY - gapStart, "F");
  }
  doc.setFillColor(...darkGreen);
  doc.rect(0, footerY, w, footerH, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(fCfg.fontSize || 10); doc.setTextColor(...white);
  const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : "www.meetdandy.com/dso";
  doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 20 : 28), { align: "center" });
  if (customLinkText?.trim() && customLinkUrl?.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(fCfg.fontSize || 10); doc.setTextColor(180, 210, 195);
    doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 38, { url: customLinkUrl });
  }

  return doc;
};

// =============================================
// COMPARISON ONE-PAGER
// =============================================

const comparisonRows = [
  { capability: "Quality & Remakes", then: "Greater variability across cases", now: "Standardized quality control systems + 96% remake rate reduction with AI scan review" },
  { capability: "Case Acceptance & Diagnostics", then: "Limited diagnostic scan support", now: "Free Dandy diagnostic scans driving ~30% average lift in case acceptance" },
  { capability: "Workflow & Case Management", then: "More manual coordination and back-and-forth", now: "Real-time lab support — 88% say it makes case management easier" },
  { capability: "Turnaround & Predictability", then: "Less predictable production timelines", now: "National manufacturing scale with more consistent turnaround windows" },
  { capability: "Digital Integration", then: "Early-stage digital workflow", now: "Fully integrated digital lab system with streamlined file submission" },
  { capability: "Product Offering", then: "More limited restorative options", now: "Expanded product portfolio across key restorative categories" },
  { capability: "Support Structure", then: "General support model", now: "Dedicated account support with more proactive case visibility" },
];

export const generateComparisonOnePager = async (
  dsoName: string,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  customLinkText?: string,
  customLinkUrl?: string,
) => {
  let layoutOverrides: { headerCfg?: any; teamCfg?: any; footerCfg?: any; comparisonRows?: any[]; stats?: any[] } = {};
  try {
    const saved = await loadLayoutDefault("dandy_comparison_template_layout");
    if (saved) layoutOverrides = saved;
  } catch { }
  const hCfg = layoutOverrides.headerCfg || {};
  const tCfg = layoutOverrides.teamCfg || {};
  const fCfg = layoutOverrides.footerCfg || {};
  const savedRows = layoutOverrides.comparisonRows;
  const savedStats = layoutOverrides.stats;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lineColor: [number, number, number] = [200, 205, 200];
  const lime: [number, number, number] = [163, 190, 60];
  const offWhite: [number, number, number] = [248, 248, 244];
  const subtleText: [number, number, number] = [140, 150, 145];

  let logoPngData: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPngData = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPngData, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgClinical),
      ]);
    }
  } catch { }

  const headerH = hCfg.height || 200;
  const splitX = w * (hCfg.splitRatio ? hCfg.splitRatio / 100 : 0.55);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const panelW = w - splitX;
    const imgFormat = headerImgData.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(headerImgData, imgFormat, splitX, 0, panelW, headerH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  if (logoPngData) {
    try { doc.addImage(logoPngData, "PNG", margin, 22, 70, 24); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...white); doc.text("dandy", margin, 40);
    }
  }

  if (prospectLogoData) {
    const logoEndX = margin + 80;
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    try {
      const maxW = 135, maxH = 30;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      doc.addImage(prospectLogoData, "PNG", logoEndX + 10, 34 - lh / 2, lw, lh);
    } catch { }
  } else if (dsoName) {
    const logoEndX = margin + 80;
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    doc.setFont("helvetica", "italic"); doc.setFontSize(dsoName.length > 15 ? 11 : 14);
    doc.setTextColor(...white); doc.text(dsoName, logoEndX + 10, 40);
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(hCfg.titleFontSize || 20); doc.setTextColor(...white);
  doc.text("Stronger Systems.", margin, 95);
  doc.text("Better Outcomes.", margin, 115);

  doc.setFont("helvetica", "normal"); doc.setFontSize(hCfg.subtitleFontSize || 9.5); doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize("See how Dandy has matured to deliver more consistent clinical performance across practices.", splitX - margin - 20);
  doc.text(subLines, margin, 150 + (hCfg.subtitleOffsetY || 0));

  let y = headerH + 20;
  const col1W = 130;
  const col2W = (contentW - col1W) / 2;
  const tableHeaderH = 28;

  doc.setFillColor(...darkGreen);
  doc.roundedRect(margin, y, contentW, tableHeaderH, 4, 4, "F");
  doc.rect(margin, y + 4, contentW, tableHeaderH - 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190);
  doc.text("CAPABILITY", margin + 12, y + 18);
  doc.setTextColor(...lime); doc.text("DANDY 2022", margin + col1W + 12, y + 18);
  doc.text("DANDY TODAY", margin + col1W + col2W + 12, y + 18);
  y += tableHeaderH;

  const rowH = 40;
  const activeRows = savedRows && savedRows.length > 0 ? savedRows : comparisonRows;
  activeRows.forEach((row, i) => {
    const bgColor: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === activeRows.length - 1;
    doc.setFillColor(...bgColor);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH, 4, 4, "F"); doc.rect(margin, y, contentW, rowH - 4, "F"); } else { doc.rect(margin, y, contentW, rowH, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...darkGreen);
    const capLines = doc.splitTextToSize(row.capability, col1W - 24); doc.text(capLines, margin + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText);
    const thenLines = doc.splitTextToSize(row.then, col2W - 24); doc.text(thenLines, margin + col1W + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const nowLines = doc.splitTextToSize(row.now, col2W - 24); doc.text(nowLines, margin + col1W + col2W + 12, y + 14);
    y += rowH;
  });
  y += 24;

  const stats = savedStats && savedStats.length > 0 ? savedStats : [
    { value: "88%", label: "say real-time lab support makes case management easier" },
    { value: "~30%", label: "average increase in case acceptance with free Dandy diagnostic scans" },
    { value: "96%", label: "remake rate reduction with AI scan review" },
  ];
  const statGap = 14;
  const statW = (contentW - statGap * 2) / 3;
  const statH = 80;
  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFillColor(...lime); doc.roundedRect(sx, y, statW, 3, 3, 3, "F"); doc.rect(sx, y + 2, statW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...darkGreen);
    doc.text(stat.value, sx + statW / 2, y + 32, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...textMuted);
    const labelLines = doc.splitTextToSize(stat.label, statW - 24);
    doc.text(labelLines, sx + statW / 2, y + 48, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 20;

  const filteredContacts = teamContacts.filter(c => c.name.trim());
  if (filteredContacts.length > 0) {
    drawSeparator(doc, margin, y, contentW, lineColor); y += 29;
    doc.setFont("helvetica", "bold"); doc.setFontSize(tCfg.headingFontSize || 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and check-ins.", w / 2, y + 15, { align: "center" });
    y += 39;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(tCfg.nameFontSize || 10); doc.setTextColor(...textDark);
      doc.text(contact.name, cx, y, { align: "center" });
      let contactY = y + 14;
      if (contact.title) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
        doc.text(contact.title, cx, contactY, { align: "center" });
        contactY += 14;
      }
      if (contact.contactInfo) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
        doc.text(contact.contactInfo, cx, contactY, { align: "center" });
        contactY += 12;
      }
      maxContactBottom = Math.max(maxContactBottom, contactY);
    });
    y = maxContactBottom + 30;
  }

  const footerH = customLinkText?.trim() && customLinkUrl?.trim() ? 38 : 30;
  const footerY = h - footerH;
  const gapStart = y;
  if (gapStart < footerY) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, gapStart, w, footerY - gapStart, "F");
  }
  doc.setFillColor(...darkGreen); doc.rect(0, footerY, w, footerH, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(fCfg.fontSize || 8); doc.setTextColor(...white);
  const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : "meetdandy.com";
  doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 16 : 24), { align: "center" });
  if (customLinkText?.trim() && customLinkUrl?.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(fCfg.fontSize || 8); doc.setTextColor(180, 210, 195);
    doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 28, { url: customLinkUrl });
  }

  return doc;
};

// =============================================
// NEW PARTNERS ONE-PAGER
// =============================================

export const generateNewPartnerOnePager = async (
  dsoName: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  qrUrl: string,
) => {
  let saved: Record<string, any> | null = null;
  try {
    saved = await loadLayoutDefault("dandy_partner_template_layout");
  } catch { }

  const headerCfg = saved?.headerCfg || { height: 233, splitRatio: 53, titleFontSize: 26, subtitleFontSize: 16, subtitleOffsetY: 5 };
  const bodyCfg = saved?.bodyCfg || { headlineFontSize: 15, introFontSize: 10, contentOffsetX: -7, sectionSpacing: 20, featureTitleFontSize: 10, featureDescFontSize: 11, showIntro: true };
  const footerCfg = saved?.footerCfg || { fontSize: 9, link: "meetdandy.com", show: true };
  const savedHeadline = saved?.partnerHeadline || "Unlock the Power of Digital Dentistry with Dandy";
  const savedIntroRaw = saved?.partnerIntro || `As {dso}'s newest preferred lab partner, Dandy is here to help your practice thrive with the most advanced digital dental lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.`;
  const savedIntro = savedIntroRaw.replace(/\{dso\}/g, dsoName).replace(/\{dsoName\}/g, dsoName);
  const savedFeatures = saved?.partnerFeatures || [
    { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
    { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
    { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
    { title: "Get your new partnership perks and preferred pricing", desc: "" },
  ];
  const savedStats = saved?.partnerStats || [
    { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
    { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
    { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
  ];
  const savedQrUrl = saved?.partnerQrUrl || qrUrl;
  const savedFooterLink = footerCfg?.link || "meetdandy.com";

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lime: [number, number, number] = [163, 190, 60];
  const offWhite: [number, number, number] = [240, 240, 236];
  const cardBorder: [number, number, number] = [180, 200, 60];

  let logoPngData: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (headerCfg.headerImage) {
      logoPngData = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = headerCfg.headerImage;
    } else {
      [logoPngData, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgClinical),
      ]);
    }
  } catch { }

  const headerH = headerCfg.height || 280;
  const splitX = w * ((headerCfg.splitRatio || 55) / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const headerFormat = headerImgData.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(headerImgData, headerFormat, splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  if (logoPngData) {
    try {
      doc.addImage(logoPngData, "PNG", w - margin - 160, 30, 70, 24);
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", w - margin - 100, 48);
    }
  }

  const logoSepX = w - margin - 82;
  if (prospectLogoData) {
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoSepX, 28, logoSepX, 56);
    try {
      const maxW = 70, maxH = 26;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      doc.addImage(prospectLogoData, "PNG", logoSepX + 8, 42 - lh / 2, lw, lh);
    } catch { }
  } else if (dsoName) {
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoSepX, 28, logoSepX, 56);
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...white);
    doc.text(dsoName, logoSepX + 8, 46);
  }

  doc.setFont("helvetica", "italic"); doc.setFontSize(16); doc.setTextColor(200, 215, 210);
  doc.text(`Dandy & ${dsoName}:`, margin, 100);

  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize("The Winning Combo for Predictable, Precise Dentistry", splitX - margin - 20);
  doc.text(titleLines, margin, 135);

  let y = headerH + 40;

  doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.headlineFontSize || 18); doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(savedHeadline, contentW);
  doc.text(headlineLines, margin, y);
  y += headlineLines.length * 22 + 14;

  doc.setFont("helvetica", "normal"); doc.setFontSize(bodyCfg.introFontSize || 10); doc.setTextColor(...textMuted);
  const introLines = doc.splitTextToSize(savedIntro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 14 + 24;

  const features = savedFeatures;

  const cardGap = 14;
  const cardW = (contentW - cardGap) / 2;
  const cardH = 90;
  const cardBorderW = 3;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const feat = features[idx];
      const cx = margin + col * (cardW + cardGap);
      const cy = y + row * (cardH + cardGap);

      doc.setFillColor(...offWhite);
      doc.roundedRect(cx, cy, cardW, cardH, 4, 4, "F");

      doc.setFillColor(...cardBorder);
      doc.roundedRect(cx, cy, cardBorderW, cardH, 2, 0, "F");

      if (idx === 3) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...textDark);
        const qrTitle = "Learn more about the\nDandy experience →";
        doc.text(qrTitle, cx + 16, cy + 30);

        try {
          const qrDataUrl = await QRCode.toDataURL(savedQrUrl || "https://meetdandy.com", { width: 400, margin: 1 });
          doc.addImage(qrDataUrl, "PNG", cx + cardW - 72, cy + 14, 58, 58);
        } catch { }
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...textDark);
        doc.text(feat.title, cx + 16, cy + 28);

        if (feat.desc) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
          const descLines = doc.splitTextToSize(feat.desc, cardW - 36);
          doc.text(descLines, cx + 16, cy + 44);
        }
      }
    }
  }
  y += 2 * (cardH + cardGap) + 28;

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...darkGreen);
  doc.text("See what Dandy doctors are saying:", margin, y);
  y += 28;

  const stats = savedStats;

  const statGap = 14;
  const statW = (contentW - statGap * 2) / 3;
  const statH = 120;

  stats.forEach((stat: any, i: number) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite);
    doc.roundedRect(sx, y, statW, statH, 6, 6, "F");

    doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(...darkGreen);
    doc.text(stat.value, sx + statW / 2, y + 45, { align: "center" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...textMuted);
    const statDesc = stat.desc || stat.label || "";
    const statLines = doc.splitTextToSize(statDesc, statW - 24);
    doc.text(statLines, sx + statW / 2, y + 62, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 30;

  doc.setFont("helvetica", "normal"); doc.setFontSize(footerCfg?.fontSize || 11); doc.setTextColor(...textMuted);
  doc.text(savedFooterLink, w / 2, y, { align: "center" });

  return doc;
};

// =============================================
// ROI ONE-PAGER (unchanged logic)
// =============================================

export const generateROIOnePager = async (dsoName: string, numPractices: number) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const midGreen: [number, number, number] = [0, 55, 45];
  const lime: [number, number, number] = [163, 190, 60];
  const white: [number, number, number] = [255, 255, 255];
  const offWhite: [number, number, number] = [248, 248, 244];
  const mutedText: [number, number, number] = [90, 100, 95];
  const subtleText: [number, number, number] = [140, 150, 145];

  let headerImgData: string | null = null;
  let logoPngData: string | null = null;
  try {
    [headerImgData, logoPngData] = await Promise.all([
      loadImageAsBase64(headerImgExecutive),
      svgToPng(dandyLogoWhite, 206, 74),
    ]);
  } catch { }

  const headerH = 160;
  doc.setFillColor(...darkGreen); doc.rect(0, 0, w, headerH, "F");
  if (headerImgData) {
    const imgNativeW = 1194; const imgNativeH = 976;
    const imgAspect = imgNativeW / imgNativeH;
    const imgH = headerH; const imgW = imgH * imgAspect;
    const imgX = w - imgW;
    doc.addImage(headerImgData, "JPEG", imgX, 0, imgW, imgH);
    doc.setFillColor(...darkGreen); doc.rect(0, 0, imgX + imgW * 0.05, headerH, "F");
  }
  if (logoPngData) {
    try { doc.addImage(logoPngData, "PNG", margin, 36, 80, 28); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...white); doc.text("dandy", margin, 45);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...white); doc.text("dandy", margin, 45);
  }

  const roiNameSize = dsoName.length > 15 ? 16 : 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(roiNameSize); doc.setTextColor(...white);
  doc.text("& ", margin, 92);
  const ampWidth = doc.getTextWidth("& ");
  doc.text(dsoName, margin + ampWidth, 92);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(180, 210, 195);
  doc.text("Your custom partnership overview — built for scale, savings & growth", margin, 128);

  let y = headerH + 28;
  const metricsH = 70;
  doc.setFillColor(...midGreen); doc.roundedRect(margin, y, contentW, metricsH, 6, 6, "F");

  const practices = numPractices;
  const apptsSavedYear = Math.round(22.5 * practices * 12);
  const chairHoursSavedYear = Math.round(11.25 * practices * 12 + 4.5 * practices);
  const totalUpsideYear = (7500 * practices * 12) + (32500 * practices);
  const fmtShort = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`;

  const metrics = [
    { value: fmtShort(totalUpsideYear), label: "Revenue upside / yr" },
    { value: "96%", label: "First-time right rate" },
    { value: apptsSavedYear.toLocaleString(), label: "Appointments saved / yr" },
    { value: chairHoursSavedYear.toLocaleString(), label: "Chair hours recovered / yr" },
    { value: "$0", label: "CAPEX to start" },
  ];

  const colW = contentW / metrics.length;
  metrics.forEach((m, i) => {
    const cx = margin + colW * i + colW / 2;
    if (i > 0) { doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(margin + colW * i, y + 16, margin + colW * i, y + metricsH - 16); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.setTextColor(...lime); doc.text(m.value, cx, y + 31, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(m.label, cx, y + 45, { align: "center" });
  });
  y += metricsH + 28;

  const caseStudies = [
    { org: "APEX Dental Partners", stat: "12.5%", statLabel: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", authorName: "Dr. Layla Lohmann", authorTitle: "Founder" },
    { org: "Open & Affordable Dental", stat: "96%", statLabel: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", authorName: "Clinical Director", authorTitle: "" },
    { org: "Dental Care Alliance", stat: "99%", statLabel: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", authorName: "Dr. Trey Mueller", authorTitle: "Chief Clinical Officer" },
  ];

  const gap = 14;
  const pillarW = (contentW - gap * 2) / 3;
  const pillarH = 215;

  caseStudies.forEach((cs, i) => {
    const px = margin + (pillarW + gap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(px, y, pillarW, pillarH, 6, 6, "F");
    doc.setFillColor(...lime); doc.roundedRect(px, y, pillarW, 3, 3, 3, "F"); doc.rect(px, y + 2, pillarW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text(cs.org.toUpperCase(), px + 16, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(26); doc.setTextColor(...darkGreen); doc.text(cs.stat, px + 16, y + 54);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...subtleText);
    const labelLines = doc.splitTextToSize(cs.statLabel, pillarW - 32); doc.text(labelLines, px + 16, y + 68);
    drawSeparator(doc, px + 16, y + 86, pillarW - 32, [220, 220, 215]);
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...mutedText);
    const quoteLines = doc.splitTextToSize(`"${cs.quote}"`, pillarW - 40); doc.text(quoteLines, px + 20, y + 102);
    const authorY = y + pillarH - 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0, 120, 80); doc.text(`— ${cs.authorName}`, px + 16, authorY);
    if (cs.authorTitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text(cs.authorTitle, px + 28, authorY + 11); }
  });
  y += pillarH + 24;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 105, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...darkGreen); doc.text("Recommended Next Step: Risk-Free Pilot", margin + 20, y + 24);
  const pilotItems = [
    "Start with 5–10 locations — no long-term commitment required",
    "Measure remake reduction, chair time recovered, and revenue lift in real time",
    "Dedicated onboarding team + change management support included",
    "Scale across the full network once ROI is validated",
  ];
  let pilotY = y + 44;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  pilotItems.forEach((item) => {
    doc.setFillColor(...lime); doc.circle(margin + 30, pilotY - 3, 3, "F");
    doc.setTextColor(...mutedText); doc.text(item, margin + 42, pilotY); pilotY += 16;
  });
  y += 105 + 20;

  const quoteBlockH = h - 36 - y - 20;
  doc.setFillColor(...midGreen); doc.roundedRect(margin, y, contentW, quoteBlockH, 6, 6, "F");
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5);
  const bottomQuote = "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
  const bqLines = doc.splitTextToSize(bottomQuote, contentW - 110);
  const quoteTextH = bqLines.length * 13;
  const attrH = 12; const quoteMarkH = 24; const gapBetween = 10;
  const totalContentH = quoteMarkH + quoteTextH + gapBetween + attrH;
  const contentStartY = y + (quoteBlockH - totalContentH) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(...lime); doc.text("\u201C", margin + 24, contentStartY + quoteMarkH + 19);
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...white); doc.text(bqLines, margin + 50, contentStartY + quoteMarkH);
  const attrY = contentStartY + quoteMarkH + quoteTextH + gapBetween - 11;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...lime); doc.text("Dr. Tania Arthur", margin + 50, attrY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 210, 195); doc.text("  —  Oasis Modern Dentistry", margin + 50 + doc.getTextWidth("Dr. Tania Arthur "), attrY);

  const footerH = 36;
  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, h - footerH + 10, 48, 17); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 1 of 2`, w - margin, h - footerH + 22, { align: "right" });

  doc.addPage();
  const p2HeaderH = 80;
  doc.setFillColor(...darkGreen); doc.rect(0, 0, w, p2HeaderH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, 22, 70, 24); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", margin, 40);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(15); doc.setTextColor(...white); doc.text("The Dandy Difference & ROI", margin, 66);
  y = p2HeaderH + 28;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("THE DANDY DIFFERENCE", margin, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...mutedText); doc.text("Built for DSO scale. Designed for provider trust.", margin, y + 12); y += 28;

  const tableRows = [
    { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
    { need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
    { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
    { need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
    { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
    { need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" },
  ];

  const col1W2 = 120; const col2W2 = (contentW - col1W2) / 2; const rowH2 = 36;
  doc.setFillColor(...darkGreen); doc.roundedRect(margin, y, contentW, 28, 4, 4, "F"); doc.rect(margin, y + 4, contentW, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("WHAT YOUR DSO NEEDS", margin + 12, y + 18);
  doc.setTextColor(...lime); doc.text("DANDY", margin + col1W2 + 12, y + 18);
  doc.setTextColor(180, 200, 190); doc.text("TRADITIONAL LABS", margin + col1W2 + col2W2 + 12, y + 18); y += 28;

  tableRows.forEach((row, i) => {
    const bgColor2: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === tableRows.length - 1;
    doc.setFillColor(...bgColor2);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH2, 4, 4, "F"); doc.rect(margin, y, contentW, rowH2 - 4, "F"); } else { doc.rect(margin, y, contentW, rowH2, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...darkGreen); doc.text(row.need, margin + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const dandyLines = doc.splitTextToSize(row.dandy, col2W2 - 24); doc.text(dandyLines, margin + col1W2 + 12, y + 14);
    doc.setTextColor(...subtleText);
    const tradLines = doc.splitTextToSize(row.traditional, col2W2 - 24); doc.text(tradLines, margin + col1W2 + col2W2 + 12, y + 14);
    y += rowH2;
  });
  y += 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("ROI BREAKDOWN", margin, y); y += 6;
  const n = numPractices;
  const apptFreedPerMonth = Math.round(22.5 * n);
  const chairHoursPerMonth = Math.round(11.25 * n * 10) / 10;
  const dentureProductionPerMonth = Math.round(7500 * n);
  const dentureProductionPerYear = dentureProductionPerMonth * 12;
  const remakesAvoidedPerMonth = Math.round(0.75 * n * 10) / 10;
  const labCostsAvoidedPerYear = Math.round(600 * n);
  const chairHoursRestoPerYear = Math.round(4.5 * n * 10) / 10;
  const restoUpsidePerYear = Math.round(32500 * n);
  const combinedTotal = dentureProductionPerYear + restoUpsidePerYear;
  const fmtK = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M+` : `$${Math.round(v / 1000)}K+`;
  const fmtDollar2 = (v: number) => `$${v.toLocaleString()}`;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mutedText);
  doc.text(`Estimated annual financial impact for ${dsoName} (based on ${n} practices).`, margin, y + 12); y += 30;

  const cardGap = 14; const cardW2 = (contentW - cardGap) / 2; const cardH = 145;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, cardW2, cardH, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(margin, y, cardW2, 3, 3, 3, "F"); doc.rect(margin, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("DENTURE WORKFLOW IMPACT", margin + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(dentureProductionPerYear), margin + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("incremental production / year", margin + 16, y + 66);
  drawSeparator(doc, margin + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const dentureItems = [`${apptFreedPerMonth.toLocaleString()} appointments freed / month`, `${chairHoursPerMonth} chair hours recovered / month`, "1.5 fewer appointments per case", `${fmtDollar2(dentureProductionPerMonth)} incremental production / month`];
  let dentY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  dentureItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(margin + 22, dentY - 2.5, 2, "F"); doc.setTextColor(...mutedText); doc.text(item, margin + 30, dentY); dentY += 14; });

  const rightX = margin + cardW2 + cardGap;
  doc.setFillColor(...offWhite); doc.roundedRect(rightX, y, cardW2, cardH, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(rightX, y, cardW2, 3, 3, 3, "F"); doc.rect(rightX, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("FIXED RESTO REMAKE IMPACT", rightX + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(restoUpsidePerYear), rightX + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("total financial upside / year", rightX + 16, y + 66);
  drawSeparator(doc, rightX + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const restoItems = ["60% fewer remakes with AI Scan Review", `${remakesAvoidedPerMonth} remakes avoided / month`, `${fmtDollar2(labCostsAvoidedPerYear)} lab costs avoided / year`, `${chairHoursRestoPerYear} chair hours recovered / year`];
  let restoY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  restoItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(rightX + 22, restoY - 2.5, 2, "F"); doc.setTextColor(...mutedText); doc.text(item, rightX + 30, restoY); restoY += 14; });
  y += cardH + 20;

  doc.setFillColor(...darkGreen); doc.roundedRect(margin, y, contentW, 58, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(`COMBINED ANNUAL UPSIDE (${n} PRACTICES)`, margin + 20, y + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...lime); doc.text(fmtK(combinedTotal), margin + 20, y + 42);
  const div1X = margin + contentW - 280; doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(div1X, y + 12, div1X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("DENTURE", div1X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...lime); doc.text(fmtK(dentureProductionPerYear), div1X + 16, y + 42);
  const div2X = div1X + 140; doc.line(div2X, y + 12, div2X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("FIXED RESTO REMAKES", div2X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...lime); doc.text(fmtK(restoUpsidePerYear), div2X + 16, y + 42);
  y += 58 + 16;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 55, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...darkGreen); doc.text("Ready to validate these numbers?", margin + 20, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mutedText); doc.text("Start a risk-free pilot with 5–10 locations. Get a custom ROI analysis at meetdandy.com/dso", margin + 20, y + 38);

  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, h - footerH + 10, 48, 17); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 2 of 2`, w - margin, h - footerH + 22, { align: "right" });

  return doc;
};

// =============================================
// COMPONENT
// =============================================

type Template = "roi" | "pilot" | "comparison" | "new-partner" | "partner2";

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
  }, []);

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
    if (!dsoName.trim()) return;
    setGenerating(true);
    try {
      let doc;
      if (template === "pilot") {
        doc = await generatePilotOnePager(dsoName.trim(), audience, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, editedContent[audience], customLinkText, customLinkUrl);
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_90Day_Pilot.pdf`);
      } else if (template === "comparison") {
        doc = await generateComparisonOnePager(dsoName.trim(), teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, customLinkText, customLinkUrl);
        doc.save(`Dandy_Evolution_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
      } else if (template === "new-partner") {
        doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_New_Partner.pdf`);
      } else if (template === "partner2") {
        doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_Partner2.pdf`);
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
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground">One-Pager Generator</h1>
            <p className="text-sm text-muted-foreground mt-2">Generate branded PDF one-pagers for DSO prospects</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <div className="inline-flex rounded-full border border-border overflow-hidden flex-wrap">
              <button
                onClick={() => setTemplate("roi")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "roi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                ROI One-Pager
              </button>
              <button
                onClick={() => setTemplate("new-partner")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "new-partner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Partner Practices
              </button>
              <button
                onClick={() => setTemplate("partner2")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "partner2" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Partner 2
              </button>
              <button
                onClick={() => setTemplate("comparison")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "comparison" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Dandy Evolution
              </button>
              <button
                onClick={() => setTemplate("pilot")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "pilot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                90-Day Pilot
              </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
