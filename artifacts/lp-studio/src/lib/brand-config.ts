export interface BrandConfig {
  primaryColor: string;
  accentColor: string;
  navBgColor: string;
  navCtaText: string;
  navCtaUrl: string;
  defaultCtaText: string;
  defaultCtaUrl: string;
  copyrightName: string;
  socialUrls: {
    facebook: string;
    instagram: string;
    linkedin: string;
  };
}

export const DEFAULT_BRAND: BrandConfig = {
  primaryColor: "#003A30",
  accentColor: "#C7E738",
  navBgColor: "#000000",
  navCtaText: "Get Pricing",
  navCtaUrl: "https://www.meetdandy.com/get-started/",
  defaultCtaText: "Get Started Free",
  defaultCtaUrl: "https://www.meetdandy.com/get-started/",
  copyrightName: "Dandy",
  socialUrls: {
    facebook: "https://www.facebook.com/meetdandy/",
    instagram: "https://www.instagram.com/meetdandy/",
    linkedin: "https://www.linkedin.com/company/meetdandy/",
  },
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export async function fetchBrandConfig(): Promise<BrandConfig> {
  try {
    const res = await fetch(`${BASE}/api/lp/brand`);
    if (!res.ok) return DEFAULT_BRAND;
    const data = await res.json();
    return { ...DEFAULT_BRAND, ...data };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function saveBrandConfig(config: BrandConfig): Promise<void> {
  const res = await fetch(`${BASE}/api/lp/brand`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save brand config");
}
