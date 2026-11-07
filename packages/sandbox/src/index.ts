export * from "./types.js";
export * from "./mock-driver.js";
export * from "./docker-driver.js";
export * from "./microvm-driver.js";
export * from "./worktree.js";

import { ISandboxDriver } from "./types.js";
import { MockSandboxDriver } from "./mock-driver.js";
import { DockerSandboxDriver } from "./docker-driver.js";
import { MicroVMSandboxDriver } from "./microvm-driver.js";

export function createSandboxDriver(
  type: "docker" | "microvm" | "mock" = "mock",
): ISandboxDriver {
  switch (type) {
    case "docker":
      return new DockerSandboxDriver();
    case "microvm":
      return new MicroVMSandboxDriver();
    case "mock":
    default:
      return new MockSandboxDriver();
  }
}
