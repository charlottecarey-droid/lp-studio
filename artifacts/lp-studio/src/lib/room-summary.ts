/**
 * A one-page summary of a hub for a manager or a business review: where the
 * rollout stands, the goals, how engaged the customer is, and what is open.
 * `summarySections` decides what it says (pure, so it can be tested); the PDF
 * only lays those sections out.
 */

export interface HubSummaryInput {
  name: string;
  /** "Live", "Draft"… as the page header says it. */
  status: string;
  stage: "rollout" | "expansion";
  day: number | null;
  rolloutDays: number;
  /** "On track: 9 live, 5 expected by day 12", when there is one. */
  pace: string | null;
  practices: { total: number; live: number; trained: number; scheduling: number; notStarted: number };
  goals: { title: string; status: string; target?: string; current?: string }[];
  engagement: { visits: number; people: number; seconds: number; lastAt: string | null; windowDays: number; top: { label: string; opens: number }[] } | null;
  openRequests: { subject: string; status: string }[];
  waitingOnCustomer: string[];
  today: Date;
}

export interface SummarySection {
  title: string;
  lines: string[];
}

const GOAL_STATUS: Record<string, string> = { "on-track": "On track", pending: "Needs attention", done: "Achieved" };
const day = (d: Date) => d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

export function summarySections(i: HubSummaryInput): SummarySection[] {
  const p = i.practices;
  const out: SummarySection[] = [];
  out.push({
    title: "Where it stands",
    lines: [
      [i.status, i.stage === "expansion" ? "Expansion" : i.day ? `Rollout, day ${Math.min(i.day, i.rolloutDays)} of ${i.rolloutDays}` : "Rollout not started"].join(" · "),
      ...(i.pace ? [i.pace] : []),
      ...(p.total ? [`${p.live} of ${p.total} practices live · ${p.trained} trained or live · ${p.scheduling} being scheduled · ${p.notStarted} not started`] : ["No practices loaded yet"]),
    ],
  });
  if (i.goals.length) out.push({ title: "Goals", lines: i.goals.map((g) => `${g.title}: ${GOAL_STATUS[g.status] ?? g.status}${[g.current ? `today ${g.current}` : "", g.target ? `target ${g.target}` : ""].filter(Boolean).length ? ` (${[g.current ? `today ${g.current}` : "", g.target ? `target ${g.target}` : ""].filter(Boolean).join(", ")})` : ""}`) });
  if (i.engagement) {
    const e = i.engagement;
    const mins = Math.round(e.seconds / 60);
    out.push({
      title: `Customer engagement, last ${e.windowDays} days`,
      lines: e.visits
        ? [`${e.visits} ${e.visits === 1 ? "visit" : "visits"} by ${e.people} ${e.people === 1 ? "person" : "people"}${mins ? `, ${mins} min in the hub` : ""}`, ...(e.lastAt ? [`Last visit ${day(new Date(e.lastAt))}`] : []), ...(e.top.length ? [`Most opened: ${e.top.slice(0, 3).map((t) => `${t.label} (${t.opens})`).join(", ")}`] : [])]
        : ["Nobody from the customer has opened the hub in this period"],
    });
  }
  out.push({ title: "Open with us", lines: i.openRequests.length ? i.openRequests.slice(0, 8).map((r) => `${r.subject} (${r.status})`).concat(i.openRequests.length > 8 ? [`and ${i.openRequests.length - 8} more`] : []) : ["No open requests"] });
  out.push({ title: "Waiting on the customer", lines: i.waitingOnCustomer.length ? i.waitingOnCustomer.slice(0, 8).concat(i.waitingOnCustomer.length > 8 ? [`and ${i.waitingOnCustomer.length - 8} more`] : []) : ["Nothing"] });
  return out;
}

/** The summary as a PDF, one page where it fits. */
export async function buildHubSummaryPdf(i: HubSummaryInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  let y = 72;
  const room = (n: number) => {
    if (y + n > H - 56) {
      doc.addPage();
      y = 72;
    }
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(24, 32, 28);
  doc.text(doc.splitTextToSize(i.name, W - M * 2) as string[], M, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(104, 114, 108);
  doc.text(`Partnership summary · ${day(i.today)}`, M, y);
  y += 26;
  for (const s of summarySections(i)) {
    room(40);
    doc.setDrawColor(226, 230, 227);
    doc.line(M, y, W - M, y);
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(24, 32, 28);
    doc.text(s.title, M, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(52, 60, 56);
    for (const line of s.lines) {
      const wrapped = doc.splitTextToSize(line, W - M * 2 - 12) as string[];
      room(wrapped.length * 14 + 4);
      doc.text("•", M, y);
      doc.text(wrapped, M + 12, y);
      y += wrapped.length * 14 + 3;
    }
    y += 10;
  }
  return doc.output("blob");
}
