import { describe, it, expect } from "vitest";
import { assertNoDependencyCycle, ValidationError } from "./index.js";

describe("Dependency Cycle Detector", () => {
  it("allows valid acyclic task dependencies", () => {
    // A depends on B; B depends on C
    const deps = new Map<string, string[]>();
    deps.set("task-A", ["task-B"]);
    deps.set("task-B", ["task-C"]);

    // Add D depending on A -> valid DAG
    expect(() =>
      assertNoDependencyCycle(deps, {
        taskId: "task-D",
        dependsOnId: "task-A",
      }),
    ).not.toThrow();
  });

  it("rejects immediate self-dependency", () => {
    const deps = new Map<string, string[]>();
    expect(() =>
      assertNoDependencyCycle(deps, {
        taskId: "task-A",
        dependsOnId: "task-A",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects direct 2-node cycle (A -> B -> A)", () => {
    const deps = new Map<string, string[]>();
    deps.set("task-A", ["task-B"]);

    // Attempting to make B depend on A creates cycle
    expect(() =>
      assertNoDependencyCycle(deps, {
        taskId: "task-B",
        dependsOnId: "task-A",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects multi-node transitive cycle (A -> B -> C -> A)", () => {
    const deps = new Map<string, string[]>();
    deps.set("task-A", ["task-B"]);
    deps.set("task-B", ["task-C"]);

    // Attempting to make C depend on A creates cycle
    expect(() =>
      assertNoDependencyCycle(deps, {
        taskId: "task-C",
        dependsOnId: "task-A",
      }),
    ).toThrow(ValidationError);
  });
});
