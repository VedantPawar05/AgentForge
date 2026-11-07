import { describe, it, expect } from "vitest";
import { MockSandboxDriver } from "./index.js";

describe("MockSandboxDriver", () => {
  it("provisions, executes commands, reads/writes files, and destroys cleanly", async () => {
    const driver = new MockSandboxDriver();
    await driver.provision({
      sandboxId: "sb-123",
      workspaceDir: "/tmp/workspace-123",
    });

    expect(driver.isProvisioned).toBe(true);

    // Read default file
    const readme = await driver.readFile("README.md");
    expect(readme).toContain("# Mock Project");

    // Write file
    await driver.writeFile("src/test.txt", "Hello Sandbox");
    const content = await driver.readFile("src/test.txt");
    expect(content).toBe("Hello Sandbox");

    // Execute command with stdout capture
    let captured = "";
    const result = await driver.executeCommand("npm", ["test"], {
      onStdout: (c) => {
        captured += c;
      },
    });

    expect(result.exitCode).toBe(0);
    expect(captured).toContain("npm test");

    // Get diff
    const diff = await driver.getDiff();
    expect(diff).toContain("diff --git");

    // Destroy
    await driver.destroy();
    expect(driver.isDestroyed).toBe(true);
    expect(driver.isProvisioned).toBe(false);
  });

  it("rejects commands when not provisioned", async () => {
    const driver = new MockSandboxDriver();
    await expect(driver.executeCommand("echo", ["hi"])).rejects.toThrow(
      /not provisioned/,
    );
  });

  it("handles simulated timeouts", async () => {
    const driver = new MockSandboxDriver({ shouldTimeout: true });
    await driver.provision({ sandboxId: "sb-t", workspaceDir: "/tmp" });

    const result = await driver.executeCommand("sleep", ["100"]);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
  });
});
