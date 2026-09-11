import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VisualChoiceStrip } from "./VisualChoiceStrip";

const options = [
  { value: "A", label: "Choice A", caption: "A", thumbnail: <svg /> },
  { value: "B", label: "Choice B", caption: "B", thumbnail: <svg /> },
  { value: "C", label: "Choice C", caption: "C", disabled: true, thumbnail: <svg /> }
] as const;

afterEach(cleanup);

describe("VisualChoiceStrip", () => {
  it("renders one accessible selected choice and a native overflow rail", () => {
    render(
      <VisualChoiceStrip
        label="Shapes"
        options={options}
        value="B"
        onChange={() => {}}
      />
    );

    const strip = screen.getByRole("radiogroup", { name: "Shapes" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toEqual([
      screen.getByRole("radio", { name: "Choice B" })
    ]);
    expect(getComputedStyle(strip).overflowX).toBe("auto");
    expect(screen.getByRole("radio", { name: "Choice C" }).hasAttribute("disabled")).toBe(true);
  });

  it("selects by click, Space, Enter, arrows, Home, and End without invoking disabled choices", () => {
    const onChange = vi.fn();
    render(
      <VisualChoiceStrip
        label="Shapes"
        options={options}
        value="A"
        onChange={onChange}
      />
    );
    const first = screen.getByRole("radio", { name: "Choice A" });
    const second = screen.getByRole("radio", { name: "Choice B" });
    const disabled = screen.getByRole("radio", { name: "Choice C" });

    fireEvent.click(second);
    fireEvent.keyDown(first, { key: " " });
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    fireEvent.keyDown(first, { key: "End" });
    fireEvent.keyDown(second, { key: "Home" });
    fireEvent.click(disabled);

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      "B", "A", "A", "B", "B", "B", "A"
    ]);
  });
});
