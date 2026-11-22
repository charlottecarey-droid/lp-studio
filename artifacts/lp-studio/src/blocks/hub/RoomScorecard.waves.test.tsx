// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NO_WAVE, ScorecardView } from "./RoomScorecard";
import { PartnershipTimeline, timelineWaves } from "./RoomTimeline";

afterEach(cleanup);

const practices = {
  total: 5,
  byStage: { live: 2, trained: 1, scheduling: 2 },
  regions: ["Texas"],
  // "Wave 1" and "1" are the same wave; Wave 2 is planned with nobody in it yet.
  byWave: [
    { wave: "1", total: 1, live: 0, trained: 1 },
    { wave: "Wave 1", total: 2, live: 2, trained: 2 },
  ],
  noWave: 2,
};
const waveDefs = [
  { key: "1", name: "Wave 1", start: "2026-11-22", target: "2026-12-22" },
  { key: "2", name: "Wave 2", target: "2027-01-22" },
];
const rows = [
  { id: 11, name: "Alpha Dental", region: "Texas", city: null, state: "TX", wave: "Wave 1", stage: "live" },
  { id: 12, name: "Charlie Dental", region: "Texas", city: null, state: "TX", wave: null, stage: "scheduling" },
];

function setup(team: boolean) {
  const store = {
    loadPractices: vi.fn(async () => ({ rows, total: rows.length, page: 0, pageSize: 50, columns: { wave: true } })),
    checkScorecard: vi.fn(async () => ({ checked: false })),
    setPracticesWave: vi.fn(async (ids: number[]) => ({ ok: true, moved: ids.length })),
    wavePracticeIds: vi.fn(async () => ({ ok: true, ids: [11], kitSent: 0 })),
  };
  const snapshot = { practices, viewer: { email: "rae@vendor.com", name: "Rae", ...(team ? { team: true } : {}) } };
  render(<ScorecardView snapshot={snapshot as never} store={store as never} isEditor={false} noun="practices" display="Inter" goals={[]} onNeedEmail={() => {}} waveDefs={waveDefs} fmtDate={(d) => d} />);
  return store;
}

describe("Scorecard waves", () => {
  it("opens with every planned wave, its progress, and the practices still to place", async () => {
    setup(false);
    const panel = screen.getByText("Waves").closest("section")!;
    const w1 = within(panel).getByText("Wave 1").closest("button")!;
    expect(w1.textContent).toContain("2/3 live"); // "Wave 1" and "1" counted together
    expect(w1.textContent).toContain("3 trained");
    expect(w1.textContent).toContain("Starts 2026-11-22 · Target 2026-12-22");
    expect(w1.textContent).toContain("In progress");
    const w2 = within(panel).getByText("Wave 2").closest("button")!;
    expect(w2.textContent).toContain("No practices in this wave yet.");
    expect(panel.textContent).toContain("3 of 5 practices in a wave");
    expect(within(panel).getByText("2 not in a wave")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Alpha Dental")).toBeTruthy());
  });

  it("a wave card filters the list to that wave (and clicking it again shows every wave)", async () => {
    const store = setup(false);
    await waitFor(() => expect(store.loadPractices).toHaveBeenCalled());
    const panel = () => screen.getByText("Waves").closest("section")!;
    fireEvent.click(within(panel()).getByText("Wave 2").closest("button")!);
    await waitFor(() => expect(store.loadPractices).toHaveBeenLastCalledWith(expect.objectContaining({ wave: "2" })));
    expect((screen.getByLabelText("Wave") as HTMLSelectElement).value).toBe("2");
    fireEvent.click(within(panel()).getByText("Wave 2").closest("button")!);
    await waitFor(() => expect(store.loadPractices).toHaveBeenLastCalledWith(expect.not.objectContaining({ wave: expect.anything() })));
    fireEvent.click(screen.getByText("2 not in a wave"));
    await waitFor(() => expect(store.loadPractices).toHaveBeenLastCalledWith(expect.objectContaining({ wave: NO_WAVE })));
  });

  it("the team ticks practices and adds them to a wave (by its key), or takes them out", async () => {
    const store = setup(true);
    await waitFor(() => expect(screen.getByText("Charlie Dental")).toBeTruthy());
    expect(screen.queryByLabelText("Add the selected practices to a wave")).toBeNull();
    const row = screen.getByText("Charlie Dental").closest("tr")!;
    fireEvent.click(within(row).getByRole("checkbox"));
    const move = screen.getByLabelText("Add the selected practices to a wave") as HTMLSelectElement;
    expect([...move.options].map((o) => o.textContent)).toEqual(["Add to wave…", "Wave 1", "Wave 2", "Take out of their wave"]);
    fireEvent.change(move, { target: { value: "2" } });
    await waitFor(() => expect(store.setPracticesWave).toHaveBeenCalledWith([12], "2"));
    await waitFor(() => expect(screen.getByText("1 practice added to Wave 2.")).toBeTruthy());
    fireEvent.click(within(screen.getByText("Alpha Dental").closest("tr")!).getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Add the selected practices to a wave"), { target: { value: NO_WAVE } });
    await waitFor(() => expect(store.setPracticesWave).toHaveBeenLastCalledWith([11], ""));
  });

  it("a customer can see and filter waves but not move practices", async () => {
    setup(false);
    await waitFor(() => expect(screen.getByText("Charlie Dental")).toBeTruthy());
    expect(screen.queryByLabelText("Add the selected practices to a wave")).toBeNull();
    expect(screen.queryByText(/use Add to wave/)).toBeNull();
  });
});

describe("Overview timeline: one wave opens it in the Scorecard", () => {
  it("clicking a wave opens that wave; the rest of the timeline opens the Scorecard as before", () => {
    const onOpen = vi.fn();
    const onOpenWave = vi.fn();
    render(<PartnershipTimeline waves={timelineWaves(waveDefs, practices.byWave)} total={5} live={2} goal={null} defaultView="waves" noun="practices" fmtDate={(d) => d} onOpen={onOpen} onOpenWave={onOpenWave} />);
    fireEvent.click(screen.getByLabelText("Wave 2: 0 of 0 live. Open it in the Scorecard"));
    expect(onOpenWave).toHaveBeenCalledWith("2");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
