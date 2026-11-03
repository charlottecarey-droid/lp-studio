import { useEffect } from "react";
import { registerGiftOptions, type GiftDetail } from "./gift-selection";

interface OptionLike {
  name: string;
  caption?: string;
  imageUrl?: string;
  imageAlt?: string;
  fit?: "contain" | "cover";
}

/** The picker (either layout) registers its gift names + photo/caption with the page-level store. */
export function useRegisterGiftOptions(options: OptionLike[]): void {
  const key = JSON.stringify(options.map((o) => [o.name, o.imageUrl ?? "", o.imageAlt ?? "", o.caption ?? "", o.fit ?? ""]));
  useEffect(() => {
    const parsed = JSON.parse(key) as Array<[string, string, string, string, string]>;
    const details: Record<string, GiftDetail> = {};
    for (const [name, imageUrl, imageAlt, caption, fit] of parsed) {
      details[name.trim()] = { imageUrl: imageUrl || undefined, imageAlt: imageAlt || undefined, caption: caption || undefined, fit: (fit || undefined) as GiftDetail["fit"] };
    }
    registerGiftOptions(parsed.map((p) => p[0]), details);
  }, [key]);
}
