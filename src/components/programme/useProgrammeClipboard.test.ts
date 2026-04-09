// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProgrammeClipboard } from "./useProgrammeClipboard";
import type { ProgrammeNode } from "./types";

const TSV_HELPERS = {
  forecastHoursByScope: {},
  engineerPool: [] as { id: string; code: string }[],
};

// Stub navigator.clipboard.writeText — it doesn't exist in jsdom
beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

const activity = (id: string): ProgrammeNode => ({
  id,
  name: `Activity ${id}`,
  type: "activity",
  totalHours: 10,
  start: "01-Jan-26",
  finish: "31-Jan-26",
  status: "Not Started",
  children: [],
});

const scope = (id: string, children: ProgrammeNode[] = []): ProgrammeNode => ({
  id,
  name: `Scope ${id}`,
  type: "scope",
  totalHours: 100,
  start: "01-Jan-26",
  finish: "31-Mar-26",
  status: "",
  children,
});

describe("useProgrammeClipboard — copy", () => {
  it("does nothing when nothing is selected", async () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useProgrammeClipboard([activity("a1")], new Set(), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("writes TSV to the system clipboard", async () => {
    const tree = [activity("a1")];
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(written).toContain("Activity a1");
  });

  it("sets copiedIds to the selected IDs", async () => {
    const tree = [activity("a1"), activity("a2")];
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1", "a2"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    expect(result.current.copiedIds).toEqual(new Set(["a1", "a2"]));
  });

  it("copiedIds starts empty", () => {
    const { result } = renderHook(() => useProgrammeClipboard([], new Set(), vi.fn(), TSV_HELPERS));
    expect(result.current.copiedIds).toEqual(new Set());
  });

  it("still stashes nodes when clipboard.writeText rejects", async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("denied")
    );
    const tree = [activity("a1")];
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    // paste should still work from in-memory stash
    act(() => result.current.paste());
    expect(onCommit).toHaveBeenCalledOnce();
  });
});

describe("useProgrammeClipboard — paste", () => {
  it("does nothing when nothing has been copied", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useProgrammeClipboard([activity("a1")], new Set(), onCommit, TSV_HELPERS)
    );
    act(() => result.current.paste());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("appends to root when no row is selected at paste time", async () => {
    const tree = [activity("a1")];
    const onCommit = vi.fn();

    // Copy with a1 selected
    const { result, rerender } = renderHook(
      ({ selected }: { selected: Set<string> }) =>
        useProgrammeClipboard(tree, selected, onCommit, TSV_HELPERS),
      { initialProps: { selected: new Set(["a1"]) } }
    );
    await act(() => result.current.copy());

    // Paste with nothing selected
    rerender({ selected: new Set() });
    act(() => result.current.paste());

    const committed = onCommit.mock.calls[0][0] as ProgrammeNode[];
    expect(committed).toHaveLength(2);
  });

  it("inserts cloned nodes after the last selected node", async () => {
    const tree = [activity("a1"), activity("a2"), activity("a3")];
    const onCommit = vi.fn();

    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    act(() => result.current.paste());

    const committed = onCommit.mock.calls[0][0] as ProgrammeNode[];
    expect(committed).toHaveLength(4);
    // Original a1 stays at index 0, cloned node inserted at index 1
    expect(committed[0].id).toBe("a1");
    expect(committed[1].id).not.toBe("a1"); // new UUID
    expect(committed[1].name).toBe("Activity a1"); // same name
    expect(committed[2].id).toBe("a2");
    expect(committed[3].id).toBe("a3");
  });

  it("inserts after a nested node", async () => {
    const tree = [scope("s1", [activity("a1"), activity("a2")])];
    const onCommit = vi.fn();

    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    act(() => result.current.paste());

    const committed = onCommit.mock.calls[0][0] as ProgrammeNode[];
    expect(committed[0].children).toHaveLength(3);
    expect(committed[0].children[0].id).toBe("a1");
    expect(committed[0].children[1].name).toBe("Activity a1"); // cloned
    expect(committed[0].children[2].id).toBe("a2");
  });

  it("assigns new IDs to pasted nodes", async () => {
    const tree = [activity("a1")];
    const onCommit = vi.fn();

    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    act(() => result.current.paste());

    const committed = onCommit.mock.calls[0][0] as ProgrammeNode[];
    const ids = committed.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length); // all IDs unique
    expect(committed[1].id).not.toBe("a1"); // cloned node has a new ID
  });

  it("can paste multiple times producing independent clones", async () => {
    const tree = [activity("a1")];
    const onCommit = vi.fn();

    const { result } = renderHook(() =>
      useProgrammeClipboard(tree, new Set(["a1"]), onCommit, TSV_HELPERS)
    );
    await act(() => result.current.copy());
    act(() => result.current.paste());
    act(() => result.current.paste());

    expect(onCommit).toHaveBeenCalledTimes(2);
    const first = (onCommit.mock.calls[0][0] as ProgrammeNode[])[1].id;
    const second = (onCommit.mock.calls[1][0] as ProgrammeNode[])[1].id;
    expect(first).not.toBe(second);
  });
});
