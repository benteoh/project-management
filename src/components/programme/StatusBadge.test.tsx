// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders Completed", () => {
    render(<StatusBadge status="Completed" />);
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("renders In Progress", () => {
    render(<StatusBadge status="In Progress" />);
    expect(screen.getByText("In Progress")).toBeTruthy();
  });

  it("renders Not Started", () => {
    render(<StatusBadge status="Not Started" />);
    expect(screen.getByText("Not Started")).toBeTruthy();
  });

  it("renders nothing for empty status", () => {
    const { container } = render(<StatusBadge status="" />);
    expect(container.firstChild).toBeNull();
  });

  it("Completed applies healthy colour classes", () => {
    render(<StatusBadge status="Completed" />);
    const el = screen.getByText("Completed");
    expect(el.className).toContain("text-status-healthy");
    expect(el.className).toContain("bg-status-healthy-bg");
  });

  it("In Progress applies info colour classes", () => {
    render(<StatusBadge status="In Progress" />);
    const el = screen.getByText("In Progress");
    expect(el.className).toContain("text-status-info");
    expect(el.className).toContain("bg-status-info-bg");
  });
});
