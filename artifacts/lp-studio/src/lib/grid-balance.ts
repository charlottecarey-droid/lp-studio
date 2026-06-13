/**
 * Last-row balancing for uniform card grids (testimonial-grid,
 * case-study-card-grid, benefits-grid, features-spotlight-cards).
 *
 * The trick mirrors BlockBenefitsIconGrid: the grid renders DOUBLED column
 * tracks (2 tracks per visual cell, e.g. lg:grid-cols-6 for a 3-column grid)
 * so a partial last row can be centered with col-start math — a half-cell
 * offset is expressible as one whole track. Items keep their natural source
 * order; only the FIRST item of an incomplete last row receives an explicit
 * col-start, and the rest auto-flow beside it.
 *
 * Pure helpers — no React. All emitted Tailwind classes are literal strings
 * (lookup tables below) so the JIT scanner picks them up.
 *
 * NOT for masonry/columns layouts (testimonial-wall, quote-library,
 * gallery-masonry) or bento layouts (benefits-bento,
 * how-it-works-numbered-bento) — uneven tiles are their design.
 */

export type GridBreakpointPrefix = "sm" | "md" | "lg";

/** One responsive breakpoint of a balanced grid: at `prefix` and up the grid
 *  shows `cols` visual cells per row (rendered as `cols * 2` tracks). */
export interface GridBreakpointSpec {
  prefix: GridBreakpointPrefix;
  cols: number;
}

/** Track-level placement for one item at one breakpoint. */
export interface TrackPlacement {
  /** col-span in TRACK units (2 tracks per visual cell). */
  spanTracks: number;
  /** 1-based col-start track, or null to auto-flow. */
  startTrack: number | null;
}

/**
 * Simulate CSS grid sparse auto-placement for items whose visual cell spans
 * are `spans` (clamped to [1, cols]) in a `cols`-cell row, then center the
 * LAST row when it doesn't fill: the first item of that row gets an explicit
 * startTrack of `(cols - lastRowCells) + 1`, which in doubled tracks shifts
 * the remainder right by half the empty space. Complete last rows (and
 * everything before them) are untouched.
 */
export function planBalancedTracks(spans: readonly number[], cols: number): TrackPlacement[] {
  const safeCols = Math.max(1, Math.floor(cols));
  const cellSpans = spans.map((s) => {
    const n = Number.isFinite(s) ? Math.floor(s) : 1;
    return Math.min(Math.max(1, n), safeCols);
  });

  // Sparse auto-flow: an item that doesn't fit in the row's remaining cells
  // wraps to the next row (any hole left behind stays a hole — matching the
  // browser's non-dense placement).
  const rowOf: number[] = [];
  let row = 0;
  let pos = 0;
  for (const s of cellSpans) {
    if (pos + s > safeCols) {
      row += 1;
      pos = 0;
    }
    rowOf.push(row);
    pos += s;
  }

  const lastRow = row;
  let lastRowCells = 0;
  let firstOfLastRow = -1;
  cellSpans.forEach((s, i) => {
    if (rowOf[i] !== lastRow) return;
    lastRowCells += s;
    if (firstOfLastRow < 0) firstOfLastRow = i;
  });
  const remainder = safeCols - lastRowCells;

  return cellSpans.map((s, i) => ({
    spanTracks: s * 2,
    startTrack: remainder > 0 && i === firstOfLastRow ? remainder + 1 : null,
  }));
}

/* Literal class lookup tables — Tailwind's scanner needs full class names. */
const COL_SPAN: Record<GridBreakpointPrefix, Record<number, string>> = {
  sm: { 2: "sm:col-span-2", 4: "sm:col-span-4" },
  md: { 2: "md:col-span-2", 4: "md:col-span-4", 6: "md:col-span-6" },
  lg: {
    2: "lg:col-span-2",
    4: "lg:col-span-4",
    6: "lg:col-span-6",
    8: "lg:col-span-8",
    10: "lg:col-span-10",
  },
};

const COL_START: Record<GridBreakpointPrefix, Record<number, string>> = {
  sm: { 2: "sm:col-start-2", 3: "sm:col-start-3" },
  md: { 2: "md:col-start-2", 3: "md:col-start-3", 4: "md:col-start-4" },
  lg: {
    2: "lg:col-start-2",
    3: "lg:col-start-3",
    4: "lg:col-start-4",
    5: "lg:col-start-5",
    6: "lg:col-start-6",
  },
};

const COL_START_AUTO: Record<GridBreakpointPrefix, string> = {
  sm: "sm:col-start-auto",
  md: "md:col-start-auto",
  lg: "lg:col-start-auto",
};

/**
 * Per-item Tailwind class strings for a balanced multi-breakpoint grid.
 *
 * `spans` are the items' visual cell spans (1 for a normal card, 2 for a
 * `featured` card that spans two columns). `specs` list the responsive
 * breakpoints in ascending order (e.g. md 2-col then lg 3-col). The grid
 * CONTAINER must render doubled tracks per spec (`{prefix}:grid-cols-{cols*2}`).
 *
 * A col-start emitted at a lower breakpoint is explicitly reset with
 * `{prefix}:col-start-auto` at higher breakpoints that don't set their own
 * start, so sm-level centering never leaks into the lg grid.
 */
export function balancedGridItemClasses(
  spans: readonly number[],
  specs: readonly GridBreakpointSpec[],
): string[] {
  const plans = specs.map((spec) => planBalancedTracks(spans, spec.cols));
  return spans.map((_, i) => {
    const cls: string[] = [];
    let prevSpanTracks: number | null = null;
    let hasEarlierStart = false;
    specs.forEach((spec, b) => {
      const { spanTracks, startTrack } = plans[b][i];
      // Spans cascade upward, so only emit when the track span changes.
      if (spanTracks !== prevSpanTracks) {
        const spanCls = COL_SPAN[spec.prefix][spanTracks];
        if (spanCls) cls.push(spanCls);
      }
      prevSpanTracks = spanTracks;
      if (startTrack != null) {
        const startCls = COL_START[spec.prefix][startTrack];
        if (startCls) {
          cls.push(startCls);
          hasEarlierStart = true;
        }
      } else if (hasEarlierStart) {
        cls.push(COL_START_AUTO[spec.prefix]);
        hasEarlierStart = false;
      }
    });
    return cls.join(" ");
  });
}
