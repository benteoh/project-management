// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgrammeRow } from "./ProgrammeRow";
import { ProgrammeNode } from "./types";

afterEach(cleanup);

const node: ProgrammeNode = {
  id: "s1",
  name: "Test Scope",
  type: "scope",
  totalHours: 100,
  start: "01-Jan-26",
  finish: "31-Mar-26",
  forecastTotalHours: 100,
  status: "",
  children: [],
};

const baseProps = {
  depth: 0,
  collapsed: new Set<string>(),
  editingCell: null,
  onToggleCollapse: vi.fn(),
  onStartEdit: vi.fn(),
  onCommitEdit: vi.fn(),
  onEditingCellChange: vi.fn(),
  onCancelEdit: vi.fn(),
  onOpenCal: vi.fn(),
  onSaveField: vi.fn(),
  onContextMenu: vi.fn(),
};

describe("ProgrammeRow", () => {
  it("renders node name", () => {
    render(<ProgrammeRow node={node} {...baseProps} />);
    expect(screen.getByText("Test Scope")).toBeTruthy();
  });

  it("renders total and forecast hours", () => {
    render(<ProgrammeRow node={node} {...baseProps} />);
    expect(screen.getAllByText("100")).toHaveLength(2);
  });

  it("renders start and finish dates", () => {
    render(<ProgrammeRow node={node} {...baseProps} />);
    expect(screen.getByText("01-Jan-26")).toBeTruthy();
    expect(screen.getByText("31-Mar-26")).toBeTruthy();
  });

  it("does not crash when editingCell is set for a different node", () => {
    // Regression: ProgrammeRow used to crash with editingCell!.value when
    // editingCell belonged to a sibling row (editingCell was non-null but
    // this row's isEditing() returned false, yet the input was built eagerly).
    const editingCell = { nodeId: "other-node", field: "name" as const, value: "editing" };
    expect(() =>
      render(<ProgrammeRow node={node} {...baseProps} editingCell={editingCell} />)
    ).not.toThrow();
  });

  it("shows dash when totalHours is null", () => {
    const nullHours = { ...node, totalHours: null };
    render(<ProgrammeRow node={nullHours} {...baseProps} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders activity ID when present", () => {
    const withId = { ...node, type: "activity" as const, activityId: "A3610" };
    render(<ProgrammeRow node={withId} {...baseProps} />);
    expect(screen.getByText("A3610")).toBeTruthy();
  });

  it("renders children when not collapsed", () => {
    const parent: ProgrammeNode = {
      ...node,
      children: [{ ...node, id: "a1", name: "Child Activity", type: "activity" }],
    };
    render(<ProgrammeRow node={parent} {...baseProps} />);
    expect(screen.getByText("Child Activity")).toBeTruthy();
  });

  it("hides children when collapsed", () => {
    const parent: ProgrammeNode = {
      ...node,
      children: [{ ...node, id: "a1", name: "Child Activity", type: "activity" }],
    };
    render(<ProgrammeRow node={parent} {...baseProps} collapsed={new Set(["s1"])} />);
    expect(screen.queryByText("Child Activity")).toBeNull();
  });
});
