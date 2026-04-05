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

/**
 * Generate a PDF from a custom template by drawing field overlays on top of the background image.
 * @param tpl The custom template to generate a PDF from
 * @param values Field values to inject (e.g. { dso_name: "Acme DSO", phone: "555-1234" })
 * @param dandyLogoSvgPath Optional path to the Dandy logo SVG (defaults to /src/assets/dandy-logo.svg)
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

    if (field.type === "qr_code") {
      const url = values.qr_url || field.defaultValue || "https://meetdandy.com";
      try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
        const sz = w * ((field.qrSize || 12) / 100);
        doc.addImage(qrDataUrl, "PNG", fx, fy, sz, sz);
      } catch { /* skip */ }
      continue;
    }

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

    const rgb = hexToRgb(field.color || "#000000");
    const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
    doc.setFont(field.fontFamily || "helvetica", fontStyle);
    doc.setFontSize(field.fontSize || 12);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    let text = "";
    if (field.type === "dso_name") text = `${field.prefix || ""}${values.dso_name || field.defaultValue || ""}${field.suffix || ""}`;
    else if (field.type === "phone") text = values.phone || field.defaultValue || "";
    else text = values[`custom_${field.id}`] || field.defaultValue || (field as OverlayField).label || "";

    if (text) {
      doc.text(text, fx, fy);
    }
  }

  return doc;
}
