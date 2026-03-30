const API = "/api/lp/copy-generate";

export async function suggestCopy(
  blockType: string,
  field: string,
  currentValue: string,
  siblingFields: Record<string, string> = {},
  count = 3,
): Promise<string[]> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockType, field, currentValue, siblingFields, count }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Copy generation failed");
  }
  const data = await res.json() as { suggestions: string[] };
  return data.suggestions;
}

export async function refreshBlockCopy(
  blockType: string,
  fields: string[],
  currentValues: Record<string, string>,
): Promise<Record<string, string>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockType, action: "refresh", fields, currentValues }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Copy refresh failed");
  }
  const data = await res.json() as { updated: Record<string, string> };
  return data.updated;
}
