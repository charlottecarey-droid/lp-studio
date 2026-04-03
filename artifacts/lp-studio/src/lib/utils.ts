import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLpPublicBase(micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}`;
  return window.location.origin;
}

export function getLpPageUrl(slug: string, micrositeDomain?: string | null): string {
  if (micrositeDomain) return `https://${micrositeDomain}/${slug}`;
  return `${window.location.origin}/lp/${slug}`;
}
