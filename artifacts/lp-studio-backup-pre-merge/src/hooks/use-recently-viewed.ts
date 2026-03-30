const STORAGE_KEY = "lp_studio_recent";
const MAX_ITEMS = 30;

export interface RecentEntry {
  kind: "page" | "experiment";
  id: number;
  viewedAt: string;
}

function readEntries(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentEntry[];
  } catch {
    return [];
  }
}

function writeEntries(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — silently skip
  }
}

export function trackView(kind: "page" | "experiment", id: number): void {
  const entries = readEntries().filter(e => !(e.kind === kind && e.id === id));
  entries.unshift({ kind, id, viewedAt: new Date().toISOString() });
  writeEntries(entries.slice(0, MAX_ITEMS));
}

export function getRecentEntries(): RecentEntry[] {
  return readEntries();
}
