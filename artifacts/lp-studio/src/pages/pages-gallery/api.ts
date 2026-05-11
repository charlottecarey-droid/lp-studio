import { useQuery } from "@tanstack/react-query";
import { API_BASE, type CreatePageData, type Page, type Test } from "./types";

export async function fetchPages(): Promise<Page[]> {
  const res = await fetch(`${API_BASE}/lp/pages`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json() as Promise<Page[]>;
}

export function useRunningTests() {
  return useQuery<Test[]>({
    queryKey: ["lp-tests-running"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lp/tests`);
      if (!res.ok) throw new Error("Failed to fetch tests");
      const all: Test[] = await res.json();
      return all.filter(t => t.status === "running");
    },
  });
}

export function useCommentSummary() {
  return useQuery<{ pageId: number; unresolvedCount: number }[]>({
    queryKey: ["lp-comment-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lp/comments/summary`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export async function createPage(data: CreatePageData) {
  const res = await fetch(`${API_BASE}/lp/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create page" }));
    throw new Error(err.error ?? "Failed to create page");
  }
  return res.json();
}

export async function deletePage(id: number) {
  await fetch(`${API_BASE}/lp/pages/${id}`, { method: "DELETE" });
}
