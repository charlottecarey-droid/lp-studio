/**
 * A minimal .xlsx reader: enough to turn a customer's uploaded roster into
 * rows of text, with no spreadsheet dependency. An .xlsx is a zip of XML; we
 * read the zip's central directory, inflate the parts we need (shared strings
 * + worksheets) and pull cell text out with a small scanner.
 *
 * Deliberately narrow: text and numbers only, no formulas' computed styles,
 * dates come through as their stored number. Bounded so a hostile file cannot
 * balloon memory: at most 40 MB inflated per part and 20,000 rows per sheet.
 */
import { inflateRawSync } from "zlib";

const MAX_PART_BYTES = 40 * 1024 * 1024;
const MAX_ROWS = 20_000;

function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  // End of central directory record: signature 0x06054b50, searched from the end.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    const wanted = name === "xl/workbook.xml" || name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
    if (!wanted || uncompSize > MAX_PART_BYTES || localOffset + 30 > buf.length) continue;
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + compSize);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }));
  }
  return out;
}

const unescapeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const textOf = (xml: string) => unescapeXml((xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""));

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface XlsxSheet {
  name: string;
  rows: string[][];
}

/** Every sheet of an .xlsx as rows of cell text. Throws when the bytes are not a readable workbook. */
export function readXlsx(buf: Buffer): XlsxSheet[] {
  const parts = readZip(buf);
  const workbook = parts.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const names = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unescapeXml(m[1]));
  const shared = (parts.get("xl/sharedStrings.xml")?.toString("utf8").match(/<si>[\s\S]*?<\/si>/g) ?? []).map(textOf);
  const sheets: XlsxSheet[] = [];
  const files = [...parts.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  files.forEach((file, i) => {
    const xml = parts.get(file)!.toString("utf8");
    const rows: string[][] = [];
    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const row: string[] = [];
      for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value = "";
        if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = textOf(inner);
        else if (v !== undefined) value = unescapeXml(v);
        const idx = ref ? colIndex(ref) : row.length;
        while (row.length < idx) row.push("");
        row[idx] = value.trim();
      }
      if (row.some((cell) => cell)) rows.push(row);
    }
    sheets.push({ name: names[i] ?? `Sheet ${i + 1}`, rows });
  });
  if (sheets.length === 0) throw new Error("no worksheets");
  return sheets;
}
