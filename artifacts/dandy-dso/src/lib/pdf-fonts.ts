import jsPDF from "jspdf";

/**
 * Custom font registry for jsPDF.
 * Fetches TTF from Google Fonts CDN at runtime, converts to base64,
 * and registers with jsPDF so exported PDFs use the exact typeface.
 *
 * Fonts that are NOT freely distributable (Arial, Georgia, Helvetica Neue)
 * still fall back to the closest jsPDF built-in.
 */

interface FontEntry {
  /** jsPDF font family name used in doc.setFont() */
  family: string;
  /** Style key: "normal" | "bold" */
  style: string;
  /** URL to a .ttf file */
  url: string;
  /** Virtual file name for addFileToVFS */
  vfsName: string;
}

// Google Fonts direct TTF URLs (stable, redistributable under OFL/Apache-2.0)
const GOOGLE_FONTS: FontEntry[] = [
  {
    family: "OpenSans",
    style: "normal",
    url: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY1M2xLER.ttf",
    vfsName: "OpenSans-Regular.ttf",
  },
  {
    family: "OpenSans",
    style: "bold",
    url: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1C4nY1M2xLER.ttf",
    vfsName: "OpenSans-Bold.ttf",
  },
  {
    family: "OpenSans",
    style: "italic",
    url: "https://fonts.gstatic.com/s/opensans/v40/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0Rk8ZkaVcUwaERZjA.ttf",
    vfsName: "OpenSans-Italic.ttf",
  },
  {
    family: "OpenSans",
    style: "bolditalic",
    url: "https://fonts.gstatic.com/s/opensans/v40/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0Rk5hkaVcUwaERZjA.ttf",
    vfsName: "OpenSans-BoldItalic.ttf",
  },
  {
    family: "Lora",
    style: "normal",
    url: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuyJGmKxemMeZ.ttf",
    vfsName: "Lora-Regular.ttf",
  },
  {
    family: "Lora",
    style: "bold",
    url: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJGmKxemMeZ.ttf",
    vfsName: "Lora-Bold.ttf",
  },
  {
    family: "Lora",
    style: "italic",
    url: "https://fonts.gstatic.com/s/lora/v35/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFkqh8ndeZzZ0.ttf",
    vfsName: "Lora-Italic.ttf",
  },
  {
    family: "Lora",
    style: "bolditalic",
    url: "https://fonts.gstatic.com/s/lora/v35/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFoah8ndeZzZ0.ttf",
    vfsName: "Lora-BoldItalic.ttf",
  },
  {
    family: "Arimo",
    style: "normal",
    url: "https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk37cxsBxDAVQI4aA.ttf",
    vfsName: "Arimo-Regular.ttf",
  },
  {
    family: "Arimo",
    style: "bold",
    url: "https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk3McxsBxDAVQI4aA.ttf",
    vfsName: "Arimo-Bold.ttf",
  },
  {
    family: "Arimo",
    style: "italic",
    url: "https://fonts.gstatic.com/s/arimo/v29/P5sdzZCDf9_T_10c3i9MeUcyat4iJY-ERBrEdwcoaKww.ttf",
    vfsName: "Arimo-Italic.ttf",
  },
  {
    family: "Arimo",
    style: "bolditalic",
    url: "https://fonts.gstatic.com/s/arimo/v29/P5sdzZCDf9_T_10c3i9MeUcyat4iJY-ERFrCdwcoaKww.ttf",
    vfsName: "Arimo-BoldItalic.ttf",
  },
];

const fontCache = new Map<string, string>(); // url -> base64
let registered = false;

async function fetchFontAsBase64(url: string): Promise<string> {
  if (fontCache.has(url)) return fontCache.get(url)!;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Strip the data URL prefix to get raw base64
      const b64 = (reader.result as string).split(",")[1];
      fontCache.set(url, b64);
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Register all custom fonts on a jsPDF doc instance.
 * Call once before any doc.setFont() with custom families.
 * Safe to call multiple times – fonts are cached after first fetch.
 */
export async function registerCustomFonts(doc: jsPDF): Promise<void> {
  const promises = GOOGLE_FONTS.map(async (entry) => {
    try {
      const b64 = await fetchFontAsBase64(entry.url);
      doc.addFileToVFS(entry.vfsName, b64);
      doc.addFont(entry.vfsName, entry.family, entry.style);
    } catch (e) {
      console.warn(`Failed to load font ${entry.vfsName}:`, e);
    }
  });
  await Promise.all(promises);
  registered = true;
}

/**
 * Maps our font option values to the jsPDF font family name.
 * Uses exact embedded fonts where available, falls back to built-ins.
 */
export function getPdfFontFamily(fontFamily: string): string {
  switch (fontFamily) {
    case "open-sans":
      return "OpenSans";
    case "arial":
      return "Arimo"; // metrically equivalent to Arial
    case "georgia":
      return "Lora"; // elegant serif, similar to Georgia
    case "helvetica-neue":
    case "helvetica":
      return "helvetica"; // jsPDF built-in
    case "times":
      return "times"; // jsPDF built-in
    case "courier":
      return "courier"; // jsPDF built-in
    default:
      return "helvetica";
  }
}
