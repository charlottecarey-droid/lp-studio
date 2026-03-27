import type { BriefContext } from "./copy-api";

let _briefContext: BriefContext | null = null;

export function setBriefContext(ctx: BriefContext | null) {
  _briefContext = ctx;
}

export function getBriefContext(): BriefContext | null {
  return _briefContext;
}
