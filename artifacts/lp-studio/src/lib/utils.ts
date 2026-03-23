import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CANONICAL_DOMAIN = "https://meetdandy-lp.com";

export function getLpPublicBase(): string {
  return CANONICAL_DOMAIN;
}
