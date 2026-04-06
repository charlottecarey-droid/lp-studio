import jsPDF from "jspdf";

// ── Shared constants ───────────────────────────────────────────────────
const darkGreen: [number, number, number] = [0, 40, 32];
const midGreen: [number, number, number] = [0, 55, 45];
const lime: [number, number, number] = [163, 190, 60];
const white: [number, number, number] = [255, 255, 255];
const offWhite: [number, number, number] = [248, 248, 244];
const textDark: [number, number, number] = [30, 40, 35];
const textMuted: [number, number, number] = [90, 100, 95];
const subtleText: [number, number, number] = [140, 150, 145];
const lineColor: [number, number, number] = [200, 205, 200];

function drawSep(doc: jsPDF, x: number, y: number, len: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + len, y);
}

async function cropImage(
  src: string,
  targetW: number,
  targetH: number,
  anchor: "top" | "center" | "bottom" = "center",
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const srcAspect = img.naturalWidth / img.naturalHeight;
      const dstAspect = targetW / targetH;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcAspect > dstAspect) {
        sw = Math.round(img.naturalHeight * dstAspect);
        sx = Math.round((img.naturalWidth - sw) / 2);
      } else {
        sh = Math.round(img.naturalWidth / dstAspect);
        if (anchor === "top") sy = 0;
        else if (anchor === "bottom") sy = img.naturalHeight - sh;
        else sy = Math.round((img.naturalHeight - sh) / 2);
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(targetW * 2);
      canvas.height = Math.round(targetH * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function drawDandyLogo(doc: jsPDF, x: number, y: number, logoPng: string | null, w = 80, h = 28) {
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", x, y, w, h); return; } catch { }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...white);
  doc.text("dandy", x, y + h * 0.8);
}

// ── Shared types ───────────────────────────────────────────────────────
export type Audience = "executive" | "clinical" | "practice-manager";

export interface TeamContact {
  name: string;
  title: string;
  contactInfo: string;
}

export interface AudienceContent {
  subtitle: string;
  introText?: string;
  features: { icon: string; title: string; description: string }[];
  checklist?: string[];
}

export const defaultAudienceContent: Record<Audience, AudienceContent> = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
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
    features: [
      { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
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

// ── Pilot One-Pager ────────────────────────────────────────────────────
export interface PilotOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  checkboxImgData?: string | null;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    bodyCfg?: Record<string, unknown>;
    teamCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generatePilotOnePager = async (
  dsoName: string,
  audience: Audience,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  editedContent: AudienceContent,
  customLinkText?: string,
  customLinkUrl?: string,
  opts?: PilotOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const bCfg = opts?.layoutOverrides?.bodyCfg ?? {};
  const tCfg = opts?.layoutOverrides?.teamCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;
  const checkboxImgData = opts?.checkboxImgData ?? null;
  const content = editedContent;

  const headerH = (hCfg.height as number | undefined) ?? 280;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 48) / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawDandyLogo(doc, margin, 50, logoPng);

  const logoEndX = margin + 90;
  doc.setDrawColor(180, 210, 195);
  doc.setLineWidth(0.75);
  doc.line(logoEndX, 50, logoEndX, 78);

  if (prospectLogoData) {
    try {
      const maxW = 135, maxH = 36;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      doc.addImage(prospectLogoData, "PNG", logoEndX + 12, 64 - (prospectLogoDims.h * ratio) / 2, prospectLogoDims.w * ratio, prospectLogoDims.h * ratio);
    } catch { }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(dsoName.length > 15 ? 12 : 16);
    doc.setTextColor(...white);
    doc.text(dsoName, logoEndX + 12, 70);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(dsoName.length > 15 ? 22 : ((hCfg.titleFontSize as number | undefined) ?? 28));
  doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize(`Dandy x ${dsoName}\n90-Day Pilot`, splitX - margin - 20);
  doc.text(titleLines, margin, 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize((hCfg.subtitleFontSize as number | undefined) ?? 11);
  doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize(content.subtitle, splitX - margin - 20);
  doc.text(subLines, margin, 220 + ((hCfg.subtitleOffsetY as number | undefined) ?? 0));

  let y = headerH + 35;
  const offsetX = (bCfg.contentOffsetX as number | undefined) ?? 0;
  const sectionGap = (bCfg.sectionSpacing as number | undefined) ?? 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize((bCfg.headlineFontSize as number | undefined) ?? 16);
  doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(
    "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.",
    contentW
  );
  doc.text(headlineLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW });
  y += headlineLines.length * 20 + sectionGap;

  if (content.introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize((bCfg.introFontSize as number | undefined) ?? 9.5);
    doc.setTextColor(...textMuted);
    const introLines = doc.splitTextToSize(content.introText, contentW - 40);
    doc.text(introLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW - 40 });
    y += introLines.length * 13 + sectionGap;
  }

  const titleDescGap = (bCfg.featureTitleDescSpacing as number | undefined) ?? 14;

  if (audience === "practice-manager" && content.checklist) {
    y += 4;
    const leftColW = contentW * 0.42;
    const rightColX = margin + contentW * 0.48;
    const rightColW = contentW * 0.52;
    const checkGreen: [number, number, number] = [0, 80, 60];
    const checkFontSize = (bCfg.checklistFontSize as number | undefined) ?? 9;
    const checkSpacing = (bCfg.checklistSpacing as number | undefined) ?? 10;
    const showDividers = (bCfg.checklistShowDividers as boolean | undefined) ?? false;
    const divLen = (bCfg.dividerLength as number | undefined) ?? 0;
    const divOffX = (bCfg.dividerOffsetX as number | undefined) ?? 0;
    const divOffY = (bCfg.dividerOffsetY as number | undefined) ?? 0;

    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...textDark);
    doc.text("How to get the most out of this pilot:", margin, y);
    let checkY = y + 20;
    content.checklist.forEach((item, idx) => {
      if (checkboxImgData) {
        try { doc.addImage(checkboxImgData, "PNG", margin + 4, checkY - 9, 11, 11); }
        catch {
          doc.setDrawColor(...checkGreen); doc.setLineWidth(1.2);
          doc.line(margin + 6, checkY - 2, margin + 8, checkY); doc.line(margin + 8, checkY, margin + 12, checkY - 6);
        }
      } else {
        doc.setDrawColor(...checkGreen); doc.setLineWidth(1.2);
        doc.line(margin + 6, checkY - 2, margin + 8, checkY); doc.line(margin + 8, checkY, margin + 12, checkY - 6);
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(checkFontSize); doc.setTextColor(...textDark);
      const lineH = checkFontSize * 1.35;
      const lines = doc.splitTextToSize(item, leftColW - 40);
      doc.text(lines, margin + 22, checkY);
      checkY += lines.length * lineH + checkSpacing;
      if (showDividers && idx < content.checklist!.length - 1) {
        const dLen = divLen > 0 ? divLen : leftColW - 20;
        drawSep(doc, margin + divOffX, checkY - checkSpacing / 2 + divOffY, dLen, lineColor);
      }
    });
    let featY = y;
    content.features.forEach((feat, idx) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize((bCfg.featureTitleFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
      doc.text(feat.title, rightColX + 28, featY);
      doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.featureDescFontSize as number | undefined) ?? 8.5); doc.setTextColor(...textMuted);
      const descLines = doc.splitTextToSize(feat.description, rightColW - 40);
      doc.text(descLines, rightColX + 28, featY + titleDescGap);
      featY += titleDescGap + descLines.length * 11 + 18;
      if (showDividers && idx < content.features.length - 1) {
        const dLen = divLen > 0 ? divLen : rightColW - 20;
        drawSep(doc, rightColX + divOffX, featY - 9 + divOffY, dLen, lineColor);
      }
    });
    y = Math.max(checkY, featY) + 4;
  } else {
    const bx = (bCfg.bulletOffsetX as number | undefined) ?? 0;
    const by = (bCfg.bulletOffsetY as number | undefined) ?? 0;
    y += 4 + by;
    const colW = contentW / 2;
    const features = content.features;
    const rows = Math.ceil(features.length / 2);
    const rowH = (features.length > 4 ? 64 : 80) + ((bCfg.sectionSpacing as number | undefined) ?? 0);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        if (idx >= features.length) continue;
        const feat = features[idx];
        const fx = margin + col * colW + offsetX + bx;
        const fy = y + row * rowH;
        doc.setFont("helvetica", "bold"); doc.setFontSize((bCfg.featureTitleFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
        doc.text(feat.title, fx, fy);
        doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.featureDescFontSize as number | undefined) ?? 8.5); doc.setTextColor(...textMuted);
        const descLines = doc.splitTextToSize(feat.description, colW - 32);
        doc.text(descLines, fx, fy + titleDescGap);
      }
    }
    y += rows * rowH + 4;
    if (audience === "clinical") {
      const quoteShow = (bCfg.quoteShow as boolean | undefined) !== false;
      if (quoteShow) {
        y -= 20;
        drawSep(doc, margin, y, contentW, lineColor);
        y += 30;
        doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(...lime);
        doc.text("\u201C", margin, y + 7);
        const quoteText = (bCfg.quoteText as string | undefined) ?? "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
        const quoteFontSize = (bCfg.quoteFontSize as number | undefined) ?? 9.5;
        doc.setFont("helvetica", "italic"); doc.setFontSize(quoteFontSize); doc.setTextColor(...textDark);
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
  }

  const showTeam = (tCfg.show as boolean | undefined) !== false;
  const filteredContacts = teamContacts.filter(c => c.name.trim());
  if (showTeam && filteredContacts.length > 0) {
    drawSep(doc, margin, y, contentW, lineColor);
    y += 29;
    doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.headingFontSize as number | undefined) ?? 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and pilot check-ins.", w / 2, y + 15, { align: "center" });
    y += 44;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.nameFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
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
  if (y < footerY) { doc.setFillColor(255, 255, 255); doc.rect(0, y, w, footerY - y, "F"); }
  doc.setFillColor(...darkGreen);
  doc.rect(0, footerY, w, footerH, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 10); doc.setTextColor(...white);
  const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : "www.meetdandy.com/dso";
  doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 20 : 28), { align: "center" });
  if (customLinkText?.trim() && customLinkUrl?.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 10); doc.setTextColor(180, 210, 195);
    doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 38, { url: customLinkUrl });
  }

  return doc;
};

// ── Comparison One-Pager ───────────────────────────────────────────────
export const defaultComparisonRows = [
  { capability: "Quality & Remakes", then: "Greater variability across cases", now: "Standardized quality control systems + 96% remake rate reduction with AI scan review" },
  { capability: "Case Acceptance & Diagnostics", then: "Limited diagnostic scan support", now: "Free Dandy diagnostic scans driving ~30% average lift in case acceptance" },
  { capability: "Workflow & Case Management", then: "More manual coordination and back-and-forth", now: "Real-time lab support — 88% say it makes case management easier" },
  { capability: "Turnaround & Predictability", then: "Less predictable production timelines", now: "National manufacturing scale with more consistent turnaround windows" },
  { capability: "Digital Integration", then: "Early-stage digital workflow", now: "Fully integrated digital lab system with streamlined file submission" },
  { capability: "Product Offering", then: "More limited restorative options", now: "Expanded product portfolio across key restorative categories" },
  { capability: "Support Structure", then: "General support model", now: "Dedicated account support with more proactive case visibility" },
] as const;

export const defaultComparisonStats = [
  { value: "88%", label: "say real-time lab support makes case management easier" },
  { value: "~30%", label: "average increase in case acceptance with free Dandy diagnostic scans" },
  { value: "96%", label: "remake rate reduction with AI scan review" },
];

export interface ComparisonOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    teamCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
    comparisonRows?: Array<{ capability: string; then: string; now: string }>;
    stats?: Array<{ value: string; label: string }>;
  };
}

export const generateComparisonOnePager = async (
  dsoName: string,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  customLinkText?: string,
  customLinkUrl?: string,
  opts?: ComparisonOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const tCfg = opts?.layoutOverrides?.teamCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};
  const activeRows = (opts?.layoutOverrides?.comparisonRows?.length
    ? opts.layoutOverrides.comparisonRows
    : defaultComparisonRows) as Array<{ capability: string; then: string; now: string }>;
  const stats = (opts?.layoutOverrides?.stats?.length
    ? opts.layoutOverrides.stats
    : defaultComparisonStats) as Array<{ value: string; label: string }>;

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;

  const headerH = (hCfg.height as number | undefined) ?? 200;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 55) / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawDandyLogo(doc, margin, 22, logoPng, 70, 24);

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
    doc.setFont("helvetica", "italic");
    doc.setFontSize(dsoName.length > 15 ? 11 : 14);
    doc.setTextColor(...white);
    doc.text(dsoName, logoEndX + 10, 40);
  }

  const titleSize = (hCfg.titleFontSize as number | undefined) ?? 20;
  const titleLineH = Math.round(titleSize * 1.32);
  doc.setFont("helvetica", "normal"); doc.setFontSize(titleSize); doc.setTextColor(...white);
  doc.text("Stronger Systems.", margin, 90);
  doc.text("Better Outcomes.", margin, 90 + titleLineH);
  doc.setFont("helvetica", "normal"); doc.setFontSize((hCfg.subtitleFontSize as number | undefined) ?? 9.5); doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize("See how Dandy has matured to deliver more consistent clinical performance across practices.", splitX - margin - 20);
  doc.text(subLines, margin, 90 + titleLineH * 2 + 8 + ((hCfg.subtitleOffsetY as number | undefined) ?? 0));

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
  activeRows.forEach((row, i) => {
    const bgColor: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === activeRows.length - 1;
    doc.setFillColor(...bgColor);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH, 4, 4, "F"); doc.rect(margin, y, contentW, rowH - 4, "F"); }
    else { doc.rect(margin, y, contentW, rowH, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...darkGreen);
    const capLines = doc.splitTextToSize(row.capability, col1W - 24);
    doc.text(capLines, margin + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText);
    const thenLines = doc.splitTextToSize(row.then, col2W - 24);
    doc.text(thenLines, margin + col1W + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const nowLines = doc.splitTextToSize(row.now, col2W - 24);
    doc.text(nowLines, margin + col1W + col2W + 12, y + 14);
    y += rowH;
  });
  y += 24;

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
    drawSep(doc, margin, y, contentW, lineColor); y += 29;
    doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.headingFontSize as number | undefined) ?? 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and check-ins.", w / 2, y + 15, { align: "center" });
    y += 39;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.nameFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
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
  if (y < footerY) { doc.setFillColor(255, 255, 255); doc.rect(0, y, w, footerY - y, "F"); }
  doc.setFillColor(...darkGreen); doc.rect(0, footerY, w, footerH, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(...white);
  const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : "meetdandy.com";
  doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 16 : 24), { align: "center" });
  if (customLinkText?.trim() && customLinkUrl?.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(180, 210, 195);
    doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 28, { url: customLinkUrl });
  }

  return doc;
};

// ── New Partner One-Pager ──────────────────────────────────────────────
export const defaultPartnerFeatures = [
  { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
  { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
  { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
  { title: "Get your new partnership perks and preferred pricing", desc: "" },
];

export const defaultPartnerStats = [
  { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
  { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
  { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
];

export interface NewPartnerContent {
  headline?: string;
  intro?: string;
  features?: Array<{ title: string; desc: string }>;
  stats?: Array<{ value: string; desc: string }>;
  footerLink?: string;
}

export interface NewPartnerOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  content?: NewPartnerContent;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    bodyCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generateNewPartnerOnePager = async (
  dsoName: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  qrUrl: string,
  _fieldValues?: Record<string, string>,
  opts?: NewPartnerOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const bCfg = opts?.layoutOverrides?.bodyCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const content = opts?.content ?? {};
  const headline = content.headline ?? "Unlock the Power of Digital Dentistry with Dandy";
  const introRaw = content.intro ?? `As ${dsoName}'s newest preferred lab partner, Dandy is here to help your practice thrive with the most advanced digital dental lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.`;
  const intro = introRaw.replace(/\{dso\}/g, dsoName).replace(/\{dsoName\}/g, dsoName);
  const features = content.features ?? defaultPartnerFeatures;
  const stats = content.stats ?? defaultPartnerStats;
  const footerLink = content.footerLink ?? (fCfg.link as string | undefined) ?? "meetdandy.com";
  const savedQrUrl = (hCfg as Record<string, unknown>).partnerQrUrl as string | undefined ?? qrUrl;

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;

  const headerH = (hCfg.height as number | undefined) ?? 280;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 55) / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawDandyLogo(doc, w - margin - 160, 30, logoPng, 70, 24);

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

  doc.setFont("helvetica", "bold"); doc.setFontSize((bCfg.headlineFontSize as number | undefined) ?? 18); doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(headline, contentW);
  doc.text(headlineLines, margin, y);
  y += headlineLines.length * 22 + 14;

  doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.introFontSize as number | undefined) ?? 10); doc.setTextColor(...textMuted);
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 14 + 24;

  const cardGap = 14;
  const cardW = (contentW - cardGap) / 2;
  const cardH = 90;
  const cardBorderColor: [number, number, number] = [180, 200, 60];
  const cardBorderW = 3;
  const cardOffWhite: [number, number, number] = [240, 240, 236];

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const feat = features[idx];
      const cx = margin + col * (cardW + cardGap);
      const cy = y + row * (cardH + cardGap);
      doc.setFillColor(...cardOffWhite); doc.roundedRect(cx, cy, cardW, cardH, 4, 4, "F");
      doc.setFillColor(...cardBorderColor); doc.roundedRect(cx, cy, cardBorderW, cardH, 2, 0, "F");
      if (idx === 3) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...textDark);
        doc.text("Learn more about the\nDandy experience \u2192", cx + 16, cy + 30);
        try {
          const QRCode = (await import("qrcode")).default;
          const qrDataUrl: string = await QRCode.toDataURL(savedQrUrl || "https://meetdandy.com", { width: 400, margin: 1 });
          doc.addImage(qrDataUrl, "PNG", cx + cardW - 72, cy + 14, 58, 58);
        } catch { }
      } else if (feat) {
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

  const statGap = 14;
  const statW = (contentW - statGap * 2) / 3;
  const statH = 120;

  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(...darkGreen);
    doc.text(stat.value, sx + statW / 2, y + 45, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...textMuted);
    const statDesc = stat.desc;
    const statLines = doc.splitTextToSize(statDesc, statW - 24);
    doc.text(statLines, sx + statW / 2, y + 62, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 30;

  doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 11); doc.setTextColor(...textMuted);
  doc.text(footerLink, w / 2, y, { align: "center" });
  void h;

  return doc;
};

// ── ROI One-Pager ──────────────────────────────────────────────────────
export interface ROIOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generateROIOnePager = async (
  dsoName: string,
  numPractices: number,
  opts?: ROIOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;

  const headerH = 160;
  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, w, headerH, "F");

  if (headerImgData) {
    const format = headerImgData.startsWith("data:image/png") ? "PNG" : "JPEG";
    const imgNativeW = 1194, imgNativeH = 976;
    const imgAspect = imgNativeW / imgNativeH;
    const imgH = headerH, imgW = imgH * imgAspect;
    const imgX = w - imgW;
    doc.addImage(headerImgData, format, imgX, 0, imgW, imgH);
    doc.setFillColor(...darkGreen);
    doc.rect(0, 0, imgX + imgW * 0.05, headerH, "F");
  }

  drawDandyLogo(doc, margin, 36, logoPng);

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
    drawSep(doc, px + 16, y + 86, pillarW - 32, [220, 220, 215]);
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(70, 80, 75);
    const quoteLines = doc.splitTextToSize(`"${cs.quote}"`, pillarW - 32);
    doc.text(quoteLines, px + 16, y + 100);
    const qy = y + 100 + quoteLines.length * 11 + 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...textDark);
    doc.text(cs.authorName, px + 16, qy);
    if (cs.authorTitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...subtleText); doc.text(cs.authorTitle, px + 16, qy + 10); }
  });
  y += pillarH + 24;

  // Next steps
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
    doc.setTextColor(...textMuted); doc.text(item, margin + 42, pilotY); pilotY += 16;
  });
  y += 105 + 20;

  // Quote block fills remaining page height
  const footerH = 36;
  const quoteBlockH = h - footerH - y - 20;
  doc.setFillColor(...midGreen); doc.roundedRect(margin, y, contentW, quoteBlockH, 6, 6, "F");
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5);
  const bottomQuote = "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
  const bqLines = doc.splitTextToSize(bottomQuote, contentW - 110);
  const quoteTextH = bqLines.length * 13;
  const attrH2 = 12; const quoteMarkH = 24; const gapBetween = 10;
  const totalContentH = quoteMarkH + quoteTextH + gapBetween + attrH2;
  const contentStartY = y + (quoteBlockH - totalContentH) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(...lime); doc.text("\u201C", margin + 24, contentStartY + quoteMarkH + 19);
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...white); doc.text(bqLines, margin + 50, contentStartY + quoteMarkH);
  const attrY = contentStartY + quoteMarkH + quoteTextH + gapBetween - 11;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...lime); doc.text("Dr. Tania Arthur", margin + 50, attrY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 210, 195); doc.text("  —  Oasis Modern Dentistry", margin + 50 + doc.getTextWidth("Dr. Tania Arthur "), attrY);

  // Page 1 footer
  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, h - footerH + 10, 48, 17); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 1 of 2`, w - margin, h - footerH + 22, { align: "right" });

  // PAGE 2
  doc.addPage();
  const p2HeaderH = 80;
  doc.setFillColor(...darkGreen); doc.rect(0, 0, w, p2HeaderH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, 22, 70, 24); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", margin, 40);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", margin, 40);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(15); doc.setTextColor(...white); doc.text("The Dandy Difference & ROI", margin, 66);
  y = p2HeaderH + 28;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("THE DANDY DIFFERENCE", margin, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...textMuted); doc.text("Built for DSO scale. Designed for provider trust.", margin, y + 12); y += 28;

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

  // ROI Breakdown
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("ROI BREAKDOWN", margin, y); y += 6;
  const n = practices;
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

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
  doc.text(`Estimated annual financial impact for ${dsoName} (based on ${n} practices).`, margin, y + 12); y += 30;

  const cardGap2 = 14; const cardW2 = (contentW - cardGap2) / 2; const cardH2 = 145;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, cardW2, cardH2, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(margin, y, cardW2, 3, 3, 3, "F"); doc.rect(margin, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("DENTURE WORKFLOW IMPACT", margin + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(dentureProductionPerYear), margin + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("incremental production / year", margin + 16, y + 66);
  drawSep(doc, margin + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const dentureItems = [`${apptFreedPerMonth.toLocaleString()} appointments freed / month`, `${chairHoursPerMonth} chair hours recovered / month`, "1.5 fewer appointments per case", `${fmtDollar2(dentureProductionPerMonth)} incremental production / month`];
  let dentY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  dentureItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(margin + 22, dentY - 2.5, 2, "F"); doc.setTextColor(...textMuted); doc.text(item, margin + 30, dentY); dentY += 14; });

  const rightX = margin + cardW2 + cardGap2;
  doc.setFillColor(...offWhite); doc.roundedRect(rightX, y, cardW2, cardH2, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(rightX, y, cardW2, 3, 3, 3, "F"); doc.rect(rightX, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("FIXED RESTO REMAKE IMPACT", rightX + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(restoUpsidePerYear), rightX + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("total financial upside / year", rightX + 16, y + 66);
  drawSep(doc, rightX + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const restoItems = ["60% fewer remakes with AI Scan Review", `${remakesAvoidedPerMonth} remakes avoided / month`, `${fmtDollar2(labCostsAvoidedPerYear)} lab costs avoided / year`, `${chairHoursRestoPerYear} chair hours recovered / year`];
  let restoY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  restoItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(rightX + 22, restoY - 2.5, 2, "F"); doc.setTextColor(...textMuted); doc.text(item, rightX + 30, restoY); restoY += 14; });
  y += cardH2 + 20;

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
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted); doc.text("Start a risk-free pilot with 5–10 locations. Get a custom ROI analysis at meetdandy.com/dso", margin + 20, y + 38);

  // Page 2 footer
  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, h - footerH + 10, 48, 17); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 2 of 2`, w - margin, h - footerH + 22, { align: "right" });

  return doc;
};
