/** Which Asana project and person a hub's marketing requests go to. Pure: see partnerRoomAsana.ts for the order and the lookup. */
export const ASANA_GID_RE = /^\d{5,25}$/;

/** Pick the project from the hub's own and the workspace's setting. Pure. */
export function pickAsanaTarget(roomProjectGid: string | null | undefined, hubs: { projectGid?: string | null; assigneeGid?: string | null } | null | undefined): { projectGid: string | null; assigneeGid: string | null } {
  const ok = (v: string | null | undefined) => (v && ASANA_GID_RE.test(v.trim()) ? v.trim() : null);
  return { projectGid: ok(roomProjectGid) ?? ok(hubs?.projectGid), assigneeGid: ok(hubs?.assigneeGid) };
}
