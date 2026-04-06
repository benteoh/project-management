import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRowSelection } from "./useRowSelection";
import type { FlatNode } from "./types";

const makeFlat = (...ids: string[]): FlatNode[] =>
  ids.map((id) => ({
    node: {
      id,
      name: id,
      type: "activity" as const,
      totalHours: null,
      start: "",
      finish: "",
      forecastTotalHours: null,
      status: "Not Started" as const,
      children: [],
    },
    depth: 0,
    parentId: null,
  }));

const mouseEvent = (overrides: Partial<React.MouseEvent> = {}): React.MouseEvent =>
  ({
    preventDefault: () => {},
    target: document.createElement("div"),
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  }) as unknown as React.MouseEvent;

describe("useRowSelection", () => {
  it("selects a single row on click", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("b", mouseEvent()));

    expect(result.current.selectedIds).toEqual(new Set(["b"]));
    expect(result.current.anchorId).toBe("b");
  });

  it("replaces selection when clicking a different row", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onRowMouseDown("c", mouseEvent()));

    expect(result.current.selectedIds).toEqual(new Set(["c"]));
  });

  it("extends range on shift-click", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c", "d")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onRowMouseDown("c", mouseEvent({ shiftKey: true })));

    expect(result.current.selectedIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("extends range in reverse on shift-click", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c", "d")));

    act(() => result.current.onRowMouseDown("c", mouseEvent()));
    act(() => result.current.onRowMouseDown("a", mouseEvent({ shiftKey: true })));

    expect(result.current.selectedIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("toggles individual rows with ctrl-click", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onRowMouseDown("c", mouseEvent({ ctrlKey: true })));

    expect(result.current.selectedIds).toEqual(new Set(["a", "c"]));
  });

  it("deselects a selected row with ctrl-click", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onRowMouseDown("c", mouseEvent({ ctrlKey: true })));
    act(() => result.current.onRowMouseDown("a", mouseEvent({ ctrlKey: true })));

    expect(result.current.selectedIds).toEqual(new Set(["c"]));
  });

  it("extends selection during drag", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c", "d")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onRowMouseEnter("c"));

    expect(result.current.selectedIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("does not extend selection on mouseEnter without drag", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("a", mouseEvent()));
    act(() => result.current.onMouseUp());
    act(() => result.current.onRowMouseEnter("c"));

    expect(result.current.selectedIds).toEqual(new Set(["a"]));
  });

  it("clears selection", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("b", mouseEvent()));
    act(() => result.current.clearSelection());

    expect(result.current.selectedIds).toEqual(new Set());
    expect(result.current.anchorId).toBeNull();
  });

  it("isSelected reflects current selection", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b", "c")));

    act(() => result.current.onRowMouseDown("b", mouseEvent()));

    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("ignores clicks on interactive elements inside the row", () => {
    const { result } = renderHook(() => useRowSelection(() => makeFlat("a", "b")));

    const button = document.createElement("button");
    act(() => result.current.onRowMouseDown("a", mouseEvent({ target: button })));

    expect(result.current.selectedIds).toEqual(new Set());
  });
});
