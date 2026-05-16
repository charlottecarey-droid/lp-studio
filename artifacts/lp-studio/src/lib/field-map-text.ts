/**
 * Shared parser/serializer for the "Field map" textareas used to configure
 * Marketo → Chili Piper prefill mappings. Kept in one place so the Global
 * Forms editor and the per-block/CTA panels stay in lockstep — changes to
 * the text format only need to happen here.
 *
 * Text format: one mapping per line, `SubmittedFieldName:cpParam`. Blank
 * lines are ignored. Keys/values are trimmed. Values may themselves contain
 * `:` (the first `:` is the separator, everything after it is the value).
 */
export function mappingsToText(m?: Record<string, string> | null): string {
  return Object.entries(m ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");
}

export function textToMappings(text: string): Record<string, string> {
  const m: Record<string, string> = {};
  text.split("\n").forEach((line) => {
    const [k, ...rest] = line.split(":");
    if (k && rest.length) m[k.trim()] = rest.join(":").trim();
  });
  return m;
}
