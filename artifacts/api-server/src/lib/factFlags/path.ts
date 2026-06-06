// Task #1138 — tiny path accessor for fieldPaths like `props.stats[0].value`.
// Used to re-apply a resolved decision (edit / swap / remove) onto the exact
// block field that was flagged, on regeneration (regen memory).

type Key = string | number;

function parsePath(path: string): Key[] {
  const keys: Key[] = [];
  for (const seg of path.split(".")) {
    const m = seg.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) {
      keys.push(seg);
      continue;
    }
    if (m[1]) keys.push(m[1]);
    const idxs = m[2].match(/\d+/g);
    if (idxs) for (const i of idxs) keys.push(Number(i));
  }
  return keys;
}

/** Read the string at `fieldPath` on a single block, or undefined. */
export function getAtPath(block: unknown, fieldPath: string): string | undefined {
  let cur: unknown = block;
  for (const key of parsePath(fieldPath)) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<Key, unknown>)[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Set the string at `fieldPath` on a single block. No-op if the parent path
 *  doesn't resolve to an object/array (block shape changed on regen). Returns
 *  true if a value was written. */
export function setAtPath(block: unknown, fieldPath: string, value: string): boolean {
  const keys = parsePath(fieldPath);
  if (keys.length === 0) return false;
  let cur: unknown = block;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return false;
    cur = (cur as Record<Key, unknown>)[keys[i]];
  }
  if (cur == null || typeof cur !== "object") return false;
  const last = keys[keys.length - 1];
  if (!(last in (cur as Record<Key, unknown>))) return false;
  (cur as Record<Key, unknown>)[last] = value;
  return true;
}
