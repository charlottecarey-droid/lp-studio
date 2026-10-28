/**
 * Pure rule for the Content Hub Slack alert (no db import, unit-tested): does
 * the block that owns a resource ask for a Slack post on identified activity?
 * A beacon names its block; when it doesn't (older page), any hub block with
 * the alert on counts.
 */
type Block = { id?: string; type?: string; props?: { gate?: { enabled?: boolean; alertSlack?: boolean } } };

export function blockWantsSlackAlert(blocks: unknown, blockId: string | null): boolean {
  if (!Array.isArray(blocks)) return false;
  const list = blocks as Block[];
  const match = blockId ? list.find((b) => b?.id === blockId) : undefined;
  const candidates = match ? [match] : list.filter((b) => typeof b?.type === "string" && b.type.startsWith("hub-"));
  return candidates.some((b) => b?.props?.gate?.enabled === true && b.props.gate.alertSlack === true);
}
