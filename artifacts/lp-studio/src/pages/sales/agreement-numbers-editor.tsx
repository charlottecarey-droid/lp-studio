import { useMemo } from "react";

/**
 * Detect numeric tokens inside an Agreement Summary section's body string and
 * render each one as a small editable input. Editing an input does an
 * index-based string splice back into the body (so duplicate values like two
 * "$20,000" mentions stay independent).
 *
 * Detected token shapes:
 *   - Money:        $1,234, $499.99, $20K, $2M
 *   - Percentages:  2.4%, 30%
 *   - Time periods: 30 days, 12 months, 2 years, 4 weeks
 *
 * Body remains the source of truth — no schema or PDF-generator changes
 * required. If the user edits a chip into a non-numeric form the next
 * re-render simply produces a different (or empty) match list, which is fine.
 */

const TOKEN_RE = /\$[\d,]+(?:\.\d+)?(?:[KkMm])?|\d+(?:\.\d+)?%|\b\d+\s*(?:days?|months?|years?|weeks?)\b/g;

interface Match {
  value: string;
  start: number;
  end: number;
}

function findMatches(body: string): Match[] {
  const out: Match[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(body)) !== null) {
    out.push({ value: m[0], start: m.index, end: m.index + m[0].length });
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++;
  }
  return out;
}

export function AgreementNumbersEditor({
  body,
  onChange,
  size = "sm",
}: {
  body: string;
  onChange: (newBody: string) => void;
  size?: "sm" | "xs";
}) {
  const matches = useMemo(() => findMatches(body), [body]);
  if (matches.length === 0) return null;

  const inputCls =
    size === "xs"
      ? "rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
      : "rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums";
  const labelCls =
    size === "xs"
      ? "text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1"
      : "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  return (
    <div className="space-y-1.5">
      <div className={labelCls}>Numbers / Prices</div>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((mm, i) => (
          <input
            key={`${mm.start}-${i}`}
            type="text"
            value={mm.value}
            // Auto-size to content so chips stay compact.
            style={{ width: `${Math.max(mm.value.length + 1, 4)}ch` }}
            onChange={e => {
              const next = e.target.value;
              const updated =
                body.slice(0, mm.start) + next + body.slice(mm.end);
              onChange(updated);
            }}
            className={inputCls}
            aria-label={`Edit number ${mm.value}`}
          />
        ))}
      </div>
    </div>
  );
}

export default AgreementNumbersEditor;
