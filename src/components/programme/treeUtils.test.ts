import { describe, it, expect } from "vitest";
import {
  updateNodeInTree,
  addNodeToTree,
  deleteNodeFromTree,
  getAddOptions,
  getScopeNumberFromName,
} from "./treeUtils";
import { ProgrammeNode } from "./types";

const leaf = (id: string): ProgrammeNode => ({
  id,
  name: `Node ${id}`,
  type: "activity",
  totalHours: 10,
  start: "01-Jan-26",
  finish: "31-Jan-26",
  forecastTotalHours: 10,
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
  forecastTotalHours: 100,
  status: "",
  children,
});

describe("updateNodeInTree", () => {
  it("updates a top-level node field", () => {
    const tree = [scope("s1"), scope("s2")];
    const result = updateNodeInTree(tree, "s1", "name", "Updated");
    expect(result[0].name).toBe("Updated");
    expect(result[1].name).toBe("Scope s2");
  });

  it("updates a nested node", () => {
    const tree = [scope("s1", [leaf("a1"), leaf("a2")])];
    const result = updateNodeInTree(tree, "a2", "totalHours", 99);
    expect(result[0].children[1].totalHours).toBe(99);
    expect(result[0].children[0].totalHours).toBe(10);
  });

  it("updates a deeply nested node", () => {
    const task: ProgrammeNode = { ...scope("t1"), type: "task", children: [leaf("a1")] };
    const tree = [scope("s1", [task])];
    const result = updateNodeInTree(tree, "a1", "name", "Deep update");
    expect(result[0].children[0].children[0].name).toBe("Deep update");
  });

  it("leaves tree unchanged when id not found", () => {
    const tree = [scope("s1")];
    const result = updateNodeInTree(tree, "missing", "name", "X");
    expect(result[0].name).toBe("Scope s1");
  });

  it("does not mutate the original nodes", () => {
    const tree = [scope("s1")];
    const original = tree[0].name;
    updateNodeInTree(tree, "s1", "name", "Changed");
    expect(tree[0].name).toBe(original);
  });

  it("can set a field to null", () => {
    const tree = [leaf("a1")];
    const result = updateNodeInTree(
      tree,
      "a1",
      "totalHours",
      null as unknown as ProgrammeNode[keyof ProgrammeNode]
    );
    expect(result[0].totalHours).toBeNull();
  });

  it("handles an empty tree", () => {
    expect(updateNodeInTree([], "s1", "name", "X")).toEqual([]);
  });
});

describe("addNodeToTree", () => {
  it("adds a child to the correct parent", () => {
    const tree = [scope("s1", [leaf("a1")])];
    const result = addNodeToTree(tree, "s1", leaf("a2"));
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[1].id).toBe("a2");
  });

  it("appends after existing children (not prepend)", () => {
    const tree = [scope("s1", [leaf("a1"), leaf("a2")])];
    const result = addNodeToTree(tree, "s1", leaf("a3"));
    expect(result[0].children[2].id).toBe("a3");
  });

  it("adds to a nested parent", () => {
    const task: ProgrammeNode = { ...scope("t1"), type: "task", children: [leaf("a1")] };
    const tree = [scope("s1", [task])];
    const result = addNodeToTree(tree, "t1", leaf("a2"));
    expect(result[0].children[0].children).toHaveLength(2);
    expect(result[0].children[0].children[1].id).toBe("a2");
  });

  it("does nothing when parent not found", () => {
    const tree = [scope("s1")];
    const result = addNodeToTree(tree, "missing", leaf("a1"));
    expect(result[0].children).toHaveLength(0);
  });

  it("does not mutate the original tree", () => {
    const tree = [scope("s1", [leaf("a1")])];
    addNodeToTree(tree, "s1", leaf("a2"));
    expect(tree[0].children).toHaveLength(1);
  });

  it("handles an empty tree", () => {
    expect(addNodeToTree([], "s1", leaf("a1"))).toEqual([]);
  });
});

describe("deleteNodeFromTree", () => {
  it("deletes a top-level node", () => {
    const tree = [scope("s1"), scope("s2")];
    const result = deleteNodeFromTree(tree, "s1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s2");
  });

  it("deletes a nested node", () => {
    const tree = [scope("s1", [leaf("a1"), leaf("a2")])];
    const result = deleteNodeFromTree(tree, "a1");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe("a2");
  });

  it("deletes a deeply nested node", () => {
    const task: ProgrammeNode = {
      ...scope("t1"),
      type: "task",
      children: [leaf("a1"), leaf("a2")],
    };
    const tree = [scope("s1", [task])];
    const result = deleteNodeFromTree(tree, "a1");
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].id).toBe("a2");
  });

  it("deletes a scope along with all its children", () => {
    const tree = [scope("s1", [leaf("a1"), leaf("a2")]), scope("s2")];
    const result = deleteNodeFromTree(tree, "s1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s2");
  });

  it("does nothing when id not found", () => {
    const tree = [scope("s1", [leaf("a1")])];
    const result = deleteNodeFromTree(tree, "missing");
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
  });

  it("does not mutate the original tree", () => {
    const tree = [scope("s1"), scope("s2")];
    deleteNodeFromTree(tree, "s1");
    expect(tree).toHaveLength(2);
  });

  it("handles an empty tree", () => {
    expect(deleteNodeFromTree([], "s1")).toEqual([]);
  });
});

describe("getScopeNumberFromName", () => {
  it("extracts leading scope number", () => {
    expect(getScopeNumberFromName("12. NR Boiler Room")).toBe("12");
  });

  it("returns empty when no match", () => {
    expect(getScopeNumberFromName("No number here")).toBe("");
  });
});

describe("getAddOptions", () => {
  it("scope can add task or activity", () => {
    const opts = getAddOptions("scope");
    expect(opts.map((o) => o.type)).toEqual(["task", "activity"]);
    expect(opts.map((o) => o.label)).toEqual(["Add Task", "Add Activity"]);
  });

  it("task can add subtask or activity", () => {
    const opts = getAddOptions("task");
    expect(opts.map((o) => o.type)).toEqual(["subtask", "activity"]);
  });

  it("subtask can only add activity", () => {
    const opts = getAddOptions("subtask");
    expect(opts.map((o) => o.type)).toEqual(["activity"]);
  });

  it("activity has no add options", () => {
    expect(getAddOptions("activity")).toHaveLength(0);
  });
});
