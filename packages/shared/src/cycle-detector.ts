import { ValidationError } from "./errors.js";

/**
 * Validates that adding a dependency from `taskId` -> `dependsOnId` will not create a cycle in the task graph.
 *
 * @param existingDependencies Map of taskId -> array of dependency IDs (tasks it depends on)
 * @param newDependency { taskId: string, dependsOnId: string }
 * @throws ValidationError if self-dependency or cycle detected
 */
export function assertNoDependencyCycle(
  existingDependencies: Map<string, string[]>,
  newDependency: { taskId: string; dependsOnId: string },
): void {
  const { taskId, dependsOnId } = newDependency;

  // Rule 1: Cannot depend on self
  if (taskId === dependsOnId) {
    throw new ValidationError(`Task '${taskId}' cannot depend on itself`);
  }

  // Clone adjacency list and add candidate edge
  const graph = new Map<string, string[]>();
  for (const [k, v] of existingDependencies.entries()) {
    graph.set(k, [...v]);
  }

  const currentDeps = graph.get(taskId) ?? [];
  if (currentDeps.includes(dependsOnId)) {
    // Already depends on it; not a new cycle, but idempotent
    return;
  }
  graph.set(taskId, [...currentDeps, dependsOnId]);

  // Ensure dependsOnId node exists in graph
  if (!graph.has(dependsOnId)) {
    graph.set(dependsOnId, []);
  }

  // Detect cycle using 3-color DFS
  // 0 = UNVISITED, 1 = VISITING (currently in recursion stack), 2 = VISITED
  const state = new Map<string, number>();

  function hasCycle(node: string, path: string[]): boolean {
    state.set(node, 1);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor) ?? 0;
      if (neighborState === 1) {
        // Cycle detected!
        const cycleStartIndex = path.indexOf(neighbor);
        const cyclePath = [...path.slice(cycleStartIndex), neighbor].join(
          " -> ",
        );
        throw new ValidationError(
          `Circular task dependency detected: ${cyclePath}`,
        );
      }
      if (neighborState === 0) {
        if (hasCycle(neighbor, path)) {
          return true;
        }
      }
    }

    path.pop();
    state.set(node, 2);
    return false;
  }

  for (const node of graph.keys()) {
    if ((state.get(node) ?? 0) === 0) {
      hasCycle(node, []);
    }
  }
}
