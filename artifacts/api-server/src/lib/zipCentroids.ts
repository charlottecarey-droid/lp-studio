/**
 * Partner Hub map: where a practice sits, worked out from its ZIP code.
 *
 * Nothing leaves the server: a ZIP is looked up in a table that ships with
 * the code, so no address is ever sent to a geocoding service. A pin lands at
 * the middle of the ZIP code, which is close enough for a map of a region.
 */
import { zip5 } from "./partnerRoomGeo";
import { ZIP_CENTROID_DATA } from "./zipCentroidData";

let table: Map<string, [number, number]> | null = null;

function centroids(): Map<string, [number, number]> {
  if (table) return table;
  table = new Map();
  for (const rec of ZIP_CENTROID_DATA.split(";")) {
    const [zip, lat, lng] = rec.split(",");
    table.set(zip, [Number(lat), Number(lng)]);
  }
  return table;
}

/** The middle of a ZIP code; null for a ZIP we don't know. */
export function zipCentroid(raw: unknown): { lat: number; lng: number } | null {
  const zip = zip5(raw);
  const hit = zip ? centroids().get(zip) : undefined;
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}
