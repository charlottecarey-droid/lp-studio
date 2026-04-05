import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { OverlayField, CustomTemplate } from "./index.js";

export const svgToPng = (svgSrc: string, w: number, h: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w * 2, h * 2);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject; img.src = svgSrc;
  });

export const hexToRgb = (hex: string): [number, number, number] => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
};

export const loadImg = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0); resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject; img.src = src;
  });

// Draw a circle clipped image (or initials fallback) for a team member photo.
async function drawTeamPhoto(
  doc: jsPDF,
  photoUrl: string | undefined,
  initials: string,
  cx: number, cy: number, radius: number,
  bgColor: [number, number, number],
) {
  // Draw circle background
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.circle(cx, cy, radius, "F");

  if (photoUrl) {
    try {
      const imgData = await loadImg(photoUrl);
      // jsPDF doesn't natively clip to circle — draw square image then overlay
      // Use a canvas to produce a circular PNG
      const sz = Math.round(radius * 2 * 4); // 4× for quality
      const canvas = document.createElement("canvas");
      canvas.width = sz; canvas.height = sz;
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = imgData; });
      ctx.drawImage(img, 0, 0, sz, sz);
      const circleData = canvas.toDataURL("image/png");
      doc.addImage(circleData, "PNG", cx - radius, cy - radius, radius * 2, radius * 2);
      return;
    } catch { /* fall through to initials */ }
  }

  // Initials fallback
  const fontSize = Math.max(8, radius * 0.9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  const tw = doc.getTextWidth(initials);
  doc.text(initials, cx - tw / 2, cy + fontSize * 0.35);
}

/**
 * Generate a PDF from a custom template by drawing field overlays on top of the background image.
 */
export async function generateCustomTemplatePdf(
  tpl: CustomTemplate,
  values: Record<string, string>,
  dandyLogoSvgPath = "/src/assets/dandy-logo.svg",
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: tpl.orientation === "landscape" ? "landscape" : "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  if (tpl.background_url) {
    try {
      const imgData = await loadImg(tpl.background_url);
      doc.addImage(imgData, "PNG", 0, 0, w, h);
    } catch {
      doc.setFillColor(240, 240, 240); doc.rect(0, 0, w, h, "F");
    }
  } else {
    doc.setFillColor(240, 240, 240); doc.rect(0, 0, w, h, "F");
  }

  for (const field of tpl.fields) {
    const fx = w * (field.x / 100);
    const fy = h * (field.y / 100);

    // ── QR Code ───────────────────────────────────────────────────────
    if (field.type === "qr_code") {
      const url = values.qr_url || field.defaultValue || "https://meetdandy.com";
      try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
        const sz = w * ((field.qrSize || 12) / 100);
        doc.addImage(qrDataUrl, "PNG", fx, fy, sz, sz);
      } catch { /* skip */ }
      continue;
    }

    // ── Dandy Logo ────────────────────────────────────────────────────
    if (field.type === "dandy_logo") {
      try {
        const dandyPng = await svgToPng(dandyLogoSvgPath, 206, 74);
        const scale = field.logoScale || 11.4;
        const lw = w * (scale / 100); const lh = lw * (74 / 206);
        doc.addImage(dandyPng, "PNG", fx, fy, lw, lh);
      } catch {
        const rgb = hexToRgb(field.color || "#FFFFFF");
        doc.setFont("helvetica", "bold"); doc.setFontSize(field.fontSize || 18); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text("dandy", fx, fy + (field.fontSize || 18));
      }
      continue;
    }

    // ── Logo (prospect) ───────────────────────────────────────────────
    if (field.type === "logo") {
      const logoUrl = values.logo_url || field.logoUrl;
      if (logoUrl) {
        try {
          const imgData = await loadImg(logoUrl);
          const scale = field.logoScale || 15; const lw = w * (scale / 100);
          const img = new Image(); img.src = imgData;
          await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); });
          const lh = img.height > 0 ? lw * (img.height / img.width) : lw * 0.4;
          doc.addImage(imgData, "PNG", fx, fy, lw, lh);
        } catch { /* skip */ }
      }
      continue;
    }

    // ── Divider ───────────────────────────────────────────────────────
    if (field.type === "divider") {
      const rgb = hexToRgb(field.color || "#CCCCCC");
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(field.lineThickness || 0.75);
      const lineW = w * ((field.width ?? 80) / 100);
      doc.line(fx, fy, fx + lineW, fy);
      continue;
    }

    // ── Meet The Team ─────────────────────────────────────────────────
    if (field.type === "meet_the_team") {
      const members = field.teamMembers ?? [];
      if (members.length === 0) continue;

      const sectionTitle = field.sectionTitle || "Meet The Team";
      const blockW = w * ((field.width ?? 80) / 100);
      const titleFontSize = field.fontSize || 14;
      const nameFontSize = Math.max(8, titleFontSize - 2);
      const subtitleFontSize = Math.max(6, titleFontSize - 4);
      const photoRadius = w * ((field.photoSize ?? 5) / 100);
      const cardW = blockW / members.length;
      const sectionRgb = hexToRgb(field.color || "#FFFFFF");

      // Section heading
      doc.setFont(field.fontFamily || "helvetica", "bold");
      doc.setFontSize(titleFontSize);
      doc.setTextColor(sectionRgb[0], sectionRgb[1], sectionRgb[2]);
      doc.text(sectionTitle, fx, fy);

      const cardsY = fy + titleFontSize * 1.5;

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const cardX = fx + i * cardW + cardW / 2; // center of card
        const initials = m.name.split(" ").map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);

        // Photo circle — use a muted dark green for the bg
        await drawTeamPhoto(doc, m.photoUrl, initials, cardX, cardsY + photoRadius, photoRadius, [30, 80, 60]);

        // Name
        doc.setFont(field.fontFamily || "helvetica", "bold");
        doc.setFontSize(nameFontSize);
        doc.setTextColor(sectionRgb[0], sectionRgb[1], sectionRgb[2]);
        const nameW = doc.getTextWidth(m.name);
        doc.text(m.name, cardX - nameW / 2, cardsY + photoRadius * 2 + nameFontSize * 1.4);

        // Title
        doc.setFont(field.fontFamily || "helvetica", "normal");
        doc.setFontSize(subtitleFontSize);
        const titleRgb: [number, number, number] = [
          Math.min(255, sectionRgb[0] + 40),
          Math.min(255, sectionRgb[1] + 40),
          Math.min(255, sectionRgb[2] + 40),
        ];
        doc.setTextColor(titleRgb[0], titleRgb[1], titleRgb[2]);
        const titleW = doc.getTextWidth(m.title);
        doc.text(m.title, cardX - titleW / 2, cardsY + photoRadius * 2 + nameFontSize * 1.4 + subtitleFontSize * 1.3);
      }
      continue;
    }

    // ── Text-based fields (heading / footer / link / custom_text / dso_name / phone) ──
    const rgb = hexToRgb(field.color || "#000000");
    const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
    doc.setFont(field.fontFamily || "helvetica", fontStyle);
    doc.setFontSize(field.fontSize || 12);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    let text = "";
    if (field.type === "dso_name") {
      text = `${field.prefix || ""}${values.dso_name || field.defaultValue || ""}${field.suffix || ""}`;
    } else if (field.type === "phone") {
      text = values.phone || field.defaultValue || "";
    } else if (field.type === "link") {
      text = field.defaultValue || "";
    } else {
      // heading, footer, custom_text
      text = field.defaultValue || field.label || "";
    }

    if (text) {
      doc.text(text, fx, fy, { lineHeightFactor: field.lineHeight ?? 1.15 });
      // Underline for links
      if (field.type === "link" && field.underline !== false) {
        const tw = doc.getTextWidth(text);
        const lineY = fy + 1.5;
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        doc.setLineWidth(0.5);
        doc.line(fx, lineY, fx + tw, lineY);
      }
    }
  }

  return doc;
}
