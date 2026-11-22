/**
 * Is the rollout where it should be today? The plan is taken as a straight
 * line from nothing live at kickoff to the target live on the last day, so a
 * hub a third of the way through should have about a third of its practices
 * live. "A little behind" is anything within a tenth of the target of that
 * line, so one late practice does not raise a flag.
 */
export type RolloutPace = { state: "ahead" | "on-track" | "behind" | "done"; live: number; expected: number; target: number; line: string };

export function rolloutPace(input: { live: number; total: number; day: number | null; rolloutDays: number; /** The "practices live" goal, when the hub has one. */ target?: number | null }): RolloutPace | null {
  const target = Math.max(0, Math.round(input.target && input.target > 0 ? input.target : input.total));
  const { live, day, rolloutDays } = input;
  if (!target || !day || day < 1 || !(rolloutDays > 0)) return null;
  if (live >= target) return { state: "done", live, expected: target, target, line: `All ${target} practices are live` };
  const expected = Math.min(target, Math.round((Math.min(day, rolloutDays) / rolloutDays) * target));
  const gap = live - expected;
  const slack = Math.max(1, Math.round(target * 0.1));
  const state = gap > slack ? "ahead" : gap < -slack ? "behind" : "on-track";
  const by = `${expected} expected by day ${Math.min(day, rolloutDays)}`;
  return {
    state,
    live,
    expected,
    target,
    line: state === "behind" ? `Behind plan: ${live} live, ${by} (${-gap} short)` : state === "ahead" ? `Ahead of plan: ${live} live, ${by}` : `On track: ${live} live, ${by}`,
  };
}
