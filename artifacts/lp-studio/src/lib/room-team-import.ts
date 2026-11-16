/**
 * A pasted or CSV list of people for a room's Team module.
 *
 * With a first row of column names the columns can be in any order:
 *   name (or first name + last name) · role / title · email · team / side · owns · when
 * Without one, each line is read as "Name, Role, Email" (the address is
 * found wherever it is; "Name <email>" works too). Commas, tabs or
 * semicolons separate the columns.
 */
export interface ImportedPerson {
  name: string;
  role?: string;
  email?: string;
  owns?: string;
  when?: string;
  /** Which side the list says the person is on, when it has a team column. */
  side?: "ours" | "partner";
}

export const TEAM_IMPORT_COLUMNS = "name, role, email, team";

const EMAIL_RE = /[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+/;

const HEADERS: Record<string, keyof ImportedPerson | "first" | "last"> = {
  name: "name", "full name": "name", person: "name", contact: "name", "contact name": "name",
  "first name": "first", first: "first", firstname: "first",
  "last name": "last", last: "last", lastname: "last", surname: "last",
  role: "role", title: "role", "job title": "role", position: "role",
  email: "email", "email address": "email", "e-mail": "email", "work email": "email",
  team: "side", side: "side", company: "side", group: "side", organization: "side", organisation: "side",
  owns: "owns", "what they own": "owns", responsibility: "owns", responsibilities: "owns",
  when: "when", "when they engage": "when",
};

/** One line → cells, honouring quotes. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === "") quoted = true;
    else if (ch === sep) out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.replace(/\s+/g, " ").trim());
}

/** "Dandy", "us", "our team", "internal" → ours; anything else named → the customer. The brand name counts as ours. */
function sideOf(raw: string, ourName: string): "ours" | "partner" | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (["us", "ours", "our team", "internal", "vendor", "team"].includes(v) || (ourName && v === ourName.trim().toLowerCase())) return "ours";
  return "partner";
}

export function parseTeamList(text: string, opts: { ourName?: string } = {}): { people: ImportedPerson[]; skipped: number } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 501);
  if (lines.length === 0) return { people: [], skipped: 0 };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const head = splitLine(lines[0], sep).map((h) => HEADERS[h.toLowerCase()]);
  const hasHeader = head.some((h) => h === "name" || h === "first" || h === "email") && !EMAIL_RE.test(lines[0]);
  const people: ImportedPerson[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitLine(line, sep);
    const p: ImportedPerson = { name: "" };
    if (hasHeader) {
      let first = "";
      let last = "";
      head.forEach((h, i) => {
        const v = cells[i] ?? "";
        if (!h || !v) return;
        if (h === "first") first = v;
        else if (h === "last") last = v;
        else if (h === "side") p.side = sideOf(v, opts.ourName ?? "");
        else if (h === "email") p.email = (v.match(EMAIL_RE)?.[0] ?? "").toLowerCase() || undefined;
        else p[h] = v;
      });
      if (!p.name) p.name = `${first} ${last}`.trim();
    } else {
      // "Name <email>" or loose cells: the address is wherever it is; the first other cell is the name, the next the role.
      const angle = line.match(/^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>(.*)$/);
      const parts = angle ? [...splitLine(angle[1], sep), angle[2], ...splitLine(angle[3], sep)] : cells;
      const rest: string[] = [];
      for (const c of parts) {
        const m = c.match(EMAIL_RE);
        if (m && !p.email) p.email = m[0].toLowerCase();
        else if (c) rest.push(c);
      }
      p.name = rest[0] ?? "";
      if (rest[1]) p.role = rest[1];
    }
    p.name = p.name.slice(0, 80);
    const key = (p.email ?? p.name).toLowerCase();
    if (!p.name || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    people.push(p);
  }
  return { people, skipped };
}

interface Member {
  name: string;
  role?: string;
  email?: string;
  owns?: string;
  when?: string;
}

const isPlaceholder = (name: string | undefined) => !name?.trim() || /^\[.*\]$/.test(name.trim()) || name.trim() === "New person";

/**
 * Add people to a group's members: someone already there (same address or
 * same name) is left as written, and the template's "[Name]" placeholders go
 * once real people are in.
 */
export function mergeTeamMembers<T extends Member>(current: T[], incoming: Member[]): { members: (T | Member)[]; added: number } {
  const has = (p: Member) => current.some((m) => (p.email && m.email?.trim().toLowerCase() === p.email.toLowerCase()) || m.name?.trim().toLowerCase() === p.name.trim().toLowerCase());
  const fresh = incoming.filter((p) => p.name.trim() && !has(p)).map((p) => ({ name: p.name.trim(), role: p.role ?? "", ...(p.email ? { email: p.email } : {}), ...(p.owns ? { owns: p.owns } : {}), ...(p.when ? { when: p.when } : {}) }));
  if (fresh.length === 0) return { members: current, added: 0 };
  return { members: [...current.filter((m) => !isPlaceholder(m.name)), ...fresh], added: fresh.length };
}
