import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import {
  DockerSandboxDriver,
  SecurityError,
  IProcessRunner,
  createSandboxDriver,
} from "./index.js";

describe("Phase 7: Adversarial Sandbox Security & Isolation Tests", () => {
  describe("Path Traversal & Filesystem Boundary Defenses", () => {
    it("strictly rejects relative path traversal attempts outside workspace", () => {
      const driver = new DockerSandboxDriver();

      expect(() => driver.validatePath("../../etc/passwd")).toThrow(
        SecurityError,
      );
      expect(() => driver.validatePath("../sensitive-credentials.env")).toThrow(
        SecurityError,
      );
      expect(() => driver.validatePath("src/../../etc/shadow")).toThrow(
        SecurityError,
      );
      expect(() => driver.validatePath("..")).toThrow(SecurityError);
    });

    it("strictly rejects absolute host paths and Windows drive letters", () => {
      const driver = new DockerSandboxDriver();

      expect(() => driver.validatePath("/etc/passwd")).toThrow(SecurityError);
      expect(() => driver.validatePath("/root/.ssh/id_rsa")).toThrow(
        SecurityError,
      );
      expect(() =>
        driver.validatePath("C:\\Windows\\System32\\cmd.exe"),
      ).toThrow(SecurityError);
      expect(() => driver.validatePath("D:/secrets/api_keys.json")).toThrow(
        SecurityError,
      );
    });

    it("strictly rejects null byte poison attacks", () => {
      const driver = new DockerSandboxDriver();
      expect(() => driver.validatePath("safe.txt\0/../../etc/passwd")).toThrow(
        SecurityError,
      );
    });

    it("accepts safe relative workspace paths and normalizes slashes", () => {
      const driver = new DockerSandboxDriver();
      expect(driver.validatePath("src/index.ts")).toBe("src/index.ts");
      expect(driver.validatePath("packages/core/package.json")).toBe(
        "packages/core/package.json",
      );
      expect(driver.validatePath("subfolder/nested/./file.txt")).toBe(
        "subfolder/nested/file.txt",
      );
    });
  });

  describe("SSRF & Cloud Metadata Access Defenses", () => {
    it("blocks access to cloud metadata services (AWS/GCP/Azure)", () => {
      const driver = new DockerSandboxDriver();

      // Even if network was theoretically requested, metadata targets must be blocked
      expect(() =>
        driver.assertNetworkAllowed("http://169.254.169.254/latest/meta-data"),
      ).toThrow(SecurityError);
      expect(() =>
        driver.assertNetworkAllowed(
          "http://metadata.google.internal/computeMetadata/v1",
        ),
      ).toThrow(SecurityError);
      expect(() =>
        driver.assertNetworkAllowed("http://169.254.170.2/v2/metadata"),
      ).toThrow(SecurityError);
      expect(() =>
        driver.assertNetworkAllowed("http://100.100.100.200/latest/meta-data"),
      ).toThrow(SecurityError);
    });

    it("blocks access to loopback / internal control plane services", () => {
      const driver = new DockerSandboxDriver();

      expect(() =>
        driver.assertNetworkAllowed("http://127.0.0.1:8080/admin"),
      ).toThrow(SecurityError);
      expect(() =>
        driver.assertNetworkAllowed("http://localhost:5432"),
      ).toThrow(SecurityError);
    });

    it("blocks any network access when network is disabled by policy", () => {
      const driver = new DockerSandboxDriver();
      expect(() =>
        driver.assertNetworkAllowed("https://registry.npmjs.org"),
      ).toThrow("Network access is strictly disabled for this sandbox");
    });
  });

  describe("Hardened Container Configuration & Resource Limits", () => {
    it("generates hardened Docker flags: non-root user, dropped capabilities, cgroups limits, read-only root, no network", () => {
      const driver = new DockerSandboxDriver();
      const runArgs = driver.getDockerRunArgs({
        sandboxId: "sb-adversarial-1",
        workspaceDir: "./tmp/test-workspace",
        limits: {
          cpuLimit: 2.0,
          memoryLimitMb: 2048,
          pidsLimit: 100,
          readOnlyRoot: true,
          allowNetwork: false,
        },
      });

      // Verify non-root user
      expect(runArgs).toContain("--user");
      expect(runArgs[runArgs.indexOf("--user") + 1]).toBe("1000:1000");

      // Verify capability dropping
      expect(runArgs).toContain("--cap-drop");
      expect(runArgs[runArgs.indexOf("--cap-drop") + 1]).toBe("ALL");

      // Verify no-new-privileges flag
      expect(runArgs).toContain("--security-opt");
      expect(runArgs[runArgs.indexOf("--security-opt") + 1]).toBe(
        "no-new-privileges:true",
      );

      // Verify cgroup limits
      expect(runArgs).toContain("--cpus");
      expect(runArgs[runArgs.indexOf("--cpus") + 1]).toBe("2");

      expect(runArgs).toContain("--memory");
      expect(runArgs[runArgs.indexOf("--memory") + 1]).toBe("2048m");

      // Verify fork bomb protection: pids limit
      expect(runArgs).toContain("--pids-limit");
      expect(runArgs[runArgs.indexOf("--pids-limit") + 1]).toBe("100");

      // Verify read-only rootfs
      expect(runArgs).toContain("--read-only");

      // Verify tmpfs mounted for volatile scratch space
      expect(runArgs).toContain("--tmpfs");
      expect(runArgs[runArgs.indexOf("--tmpfs") + 1]).toBe(
        "/tmp:rw,noexec,nosuid,size=64m",
      );

      // Verify no network egress
      expect(runArgs).toContain("--network");
      expect(runArgs[runArgs.indexOf("--network") + 1]).toBe("none");

      // Verify Docker socket is NEVER mounted
      expect(runArgs.join(" ")).not.toContain("/var/run/docker.sock");
    });
  });

  describe("Timeout Enforcement & Process Containment", () => {
    it("kills processes exceeding timeout threshold and returns timedOut flag", async () => {
      // Mock child process that hangs until killed
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn((signal) => {
        if (signal === "SIGTERM") {
          setTimeout(() => {
            mockChild.emit("close", 143);
          }, 10);
        }
      });

      const mockRunner: IProcessRunner = {
        spawn: vi.fn(() => mockChild),
      };

      const driver = new DockerSandboxDriver(mockRunner);

      // Force provision state for unit testing
      (driver as any).isProvisioned = true;
      (driver as any).containerName = "agentforge-sandbox-test-timeout";

      const result = await driver.executeCommand("sleep", ["100"], {
        timeoutMs: 50,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  describe("Sandbox Factory", () => {
    it("instantiates drivers according to driver type", () => {
      const mock = createSandboxDriver("mock");
      expect(mock.driverName).toBe("mock");

      const docker = createSandboxDriver("docker");
      expect(docker.driverName).toBe("docker");

      const microvm = createSandboxDriver("microvm");
      expect(microvm.driverName).toBe("microvm");
    });
  });
});
