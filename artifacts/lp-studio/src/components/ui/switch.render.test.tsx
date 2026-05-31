// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Switch } from "./switch";

/**
 * Render-level regression guard for the shared `Switch`'s live "On"/"Off"
 * status label. The label has to stay correct for both controlled
 * (`checked`) and uncontrolled (`defaultChecked`) usage, update the instant
 * the switch toggles, dim (but still show) when disabled, disappear entirely
 * under `showStateLabel={false}`, and never interfere with the underlying
 * Radix pill's props/ref/className passthrough. The component is used app-wide,
 * so a small regression here would ship silently.
 */
describe("Switch state label", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows 'Off'/'On' for a controlled (checked) switch", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText("Off")).toBeDefined();
    expect(screen.queryByText("On")).toBeNull();

    rerender(<Switch checked onCheckedChange={() => {}} />);
    expect(screen.getByText("On")).toBeDefined();
    expect(screen.queryByText("Off")).toBeNull();
  });

  it("reflects the initial state for an uncontrolled (defaultChecked) switch", () => {
    cleanup();
    render(<Switch defaultChecked />);
    expect(screen.getByText("On")).toBeDefined();
    expect(screen.queryByText("Off")).toBeNull();

    cleanup();
    render(<Switch />);
    expect(screen.getByText("Off")).toBeDefined();
    expect(screen.queryByText("On")).toBeNull();
  });

  it("updates the label instantly when an uncontrolled switch is toggled", () => {
    render(<Switch defaultChecked={false} />);
    expect(screen.getByText("Off")).toBeDefined();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("On")).toBeDefined();
    expect(screen.queryByText("Off")).toBeNull();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Off")).toBeDefined();
    expect(screen.queryByText("On")).toBeNull();
  });

  it("updates the label instantly when a controlled switch is toggled by its parent", () => {
    function Controlled() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} />;
    }
    render(<Controlled />);
    expect(screen.getByText("Off")).toBeDefined();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("On")).toBeDefined();
    expect(screen.queryByText("Off")).toBeNull();
  });

  it("still renders the label (dimmed) when disabled", () => {
    render(<Switch checked disabled onCheckedChange={() => {}} />);
    const label = screen.getByText("On");
    expect(label).toBeDefined();
    expect(label.className).toContain("opacity-50");
  });

  it("renders the bare pill with no label when showStateLabel is false", () => {
    render(<Switch checked showStateLabel={false} onCheckedChange={() => {}} />);
    expect(screen.queryByText("On")).toBeNull();
    expect(screen.queryByText("Off")).toBeNull();
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("passes className, ref and extra props through to the underlying pill", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Switch
        ref={(node) => {
          ref.current = node;
        }}
        className="custom-class"
        data-testid="my-switch"
        aria-label="Toggle thing"
        checked={false}
        onCheckedChange={() => {}}
      />,
    );

    const pill = screen.getByRole("switch");
    expect(pill).toBe(ref.current);
    expect(pill.className).toContain("custom-class");
    expect(pill.getAttribute("data-testid")).toBe("my-switch");
    expect(pill.getAttribute("aria-label")).toBe("Toggle thing");
  });

  it("invokes onCheckedChange with the next value on toggle", () => {
    const onCheckedChange = vi.fn();
    render(<Switch defaultChecked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
