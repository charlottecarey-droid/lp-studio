// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoomPlanSection, type HubPlan, type PlanGroup } from "./RoomPlanSection";
import { UnsavedSettings } from "./RoomAccountSettings";

const plan: HubPlan = {
  expansion: false,
  groups: [{ title: "Setup", checkpoint: "Ready", rows: [{ key: "practice-roster", task: "Upload your practice list", status: "done", customerAction: "upload" }] }],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Settings › Mutual action plan", () => {
  it("shows the plan's phases and steps, editable", () => {
    render(<RoomPlanSection pageId={7} plan={plan} onSaved={() => {}} />);
    expect(screen.getByDisplayValue("Setup")).toBeTruthy();
    expect(screen.getByDisplayValue("Ready")).toBeTruthy();
    expect(screen.getByDisplayValue("Upload your practice list")).toBeTruthy();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("done");
    expect((screen.getByLabelText("What the customer can do") as HTMLSelectElement).value).toBe("upload");
    expect(screen.getByText(/1 step in 1 phase/)).toBeTruthy();
  });

  it("an edit marks the section unsaved; Save sends the plan and hands back what was saved; Discard goes back", async () => {
    const report = vi.fn();
    const onSaved = vi.fn();
    render(
      <UnsavedSettings.Provider value={report}>
        <RoomPlanSection pageId={7} plan={plan} onSaved={onSaved} />
      </UnsavedSettings.Provider>,
    );
    fireEvent.change(screen.getByLabelText("Step"), { target: { value: "Upload your practice roster" } });
    expect(report).toHaveBeenLastCalledWith("plan", true);
    fireEvent.click(screen.getByText("Discard"));
    expect(screen.getByDisplayValue("Upload your practice list")).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith("plan", false);

    fireEvent.click(screen.getByText("Add a step"));
    fireEvent.change(screen.getAllByLabelText("Step")[1], { target: { value: "Join the kickoff" } });
    const saved: PlanGroup[] = [{ title: "Setup", checkpoint: "Ready", rows: [...plan.groups[0].rows, { task: "Join the kickoff", status: "not-started" }] }];
    fetchMock.mockResolvedValueOnce(json({ ok: true, plan: { groups: saved, expansion: false } }));
    fireEvent.click(screen.getByText("Save plan"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/lp/partner-rooms/7/plan");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).groups[0].rows[1]).toMatchObject({ task: "Join the kickoff" });
  });

  it("an upload fills the editor for review (nothing saved yet), with what was skipped", async () => {
    const imported: PlanGroup[] = [{ title: "Kickoff", rows: [{ key: "agree-goals", task: "Agree goals", status: "on-track" }] }];
    fetchMock.mockResolvedValueOnce(json({ groups: imported, steps: 1, phases: 1, warnings: ["Row 3: no step, skipped."] }));
    const { container } = render(<RoomPlanSection pageId={7} plan={plan} onSaved={() => {}} />);
    fireEvent.click(screen.getByText("Upload your MAP"));
    const input = container.querySelector("[data-room-plan-file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["Phase,Step\nKickoff,Agree goals\n"], "acme-map.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(screen.getByDisplayValue("Agree goals")).toBeTruthy());
    expect(screen.getByText(/From acme-map\.csv: 1 step in 1 phase, replacing the plan/)).toBeTruthy();
    expect(screen.getByText("Row 3: no step, skipped.")).toBeTruthy();
    expect(screen.getByText("Save plan")).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/lp/partner-rooms/7/plan/import");
    expect(JSON.parse(init.body)).toMatchObject({ fileName: "acme-map.csv", mode: "replace" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a file that can't be used says why and leaves the plan alone", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "No Step column found. Use the template, or name the column with the steps “Step”." }, 400));
    const { container } = render(<RoomPlanSection pageId={7} plan={plan} onSaved={() => {}} />);
    fireEvent.click(screen.getByText("Upload your MAP"));
    fireEvent.change(container.querySelector("[data-room-plan-file]") as HTMLInputElement, { target: { files: [new File(["x"], "bad.csv")] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/No Step column/));
    expect(screen.getByDisplayValue("Upload your practice list")).toBeTruthy();
  });

  it("shows what goes in each column, and downloads the template or this plan", async () => {
    render(<RoomPlanSection pageId={7} plan={plan} onSaved={() => {}} />);
    fireEvent.click(screen.getByText("What goes in each column"));
    expect(screen.getByText(/Not started, On track, Pending, Overdue or Done/)).toBeTruthy();
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    fetchMock.mockResolvedValue(json({ fileName: "t.csv", csv: "Phase,Step\n" }));
    fireEvent.click(screen.getByText("Download this plan"));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lp/partner-rooms/7/plan/template?current=1");
    fireEvent.click(screen.getByText("Download template"));
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toBe("/api/lp/partner-rooms/7/plan/template"));
  });
});
