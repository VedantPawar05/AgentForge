import { validateEnv, RunStatus, logger } from "@agentforge/shared";
import { MockAgentAdapter } from "@agentforge/agent-adapters";
import { MockSandboxDriver } from "@agentforge/sandbox";

const env = validateEnv();

export interface ExecutionJobData {
  taskId: string;
  runId: string;
  attemptNumber: number;
  workspaceId: string;
}

export class TaskExecutionWorker {
  private isRunning = false;
  private inFlightJobs = new Set<string>();

  constructor(
    public readonly workerId = `worker-${Math.random().toString(36).slice(2, 8)}`,
    private readonly agentAdapter = new MockAgentAdapter(),
    private readonly sandboxDriver = new MockSandboxDriver(),
  ) {}

  public async start(): Promise<void> {
    this.isRunning = true;
    logger.info(
      { workerId: this.workerId, env: env.NODE_ENV },
      `[AgentForge Worker] ${this.workerId} started`,
    );
  }

  public async processJob(
    job: ExecutionJobData,
  ): Promise<{ status: RunStatus; diff?: string }> {
    this.inFlightJobs.add(job.runId);
    const workerLogger = logger.child({
      service: "agentforge-worker",
      workerId: this.workerId,
      runId: job.runId,
      taskId: job.taskId,
      workspaceId: job.workspaceId,
    });

    workerLogger.info("Processing execution job");

    try {
      // 1. Provision Sandbox
      await this.sandboxDriver.provision({
        sandboxId: `sb-${job.runId}`,
        workspaceDir: `/tmp/agentforge/${job.runId}`,
      });

      // 2. Execute Agent Loop
      const agentResult = await this.agentAdapter.executeTask(
        {
          taskId: job.taskId,
          taskTitle: "Automated Task",
          taskDescription: "Execute requested modifications",
          repoOwner: "agentforge",
          repoName: "repo",
          targetBranch: "main",
          workspaceDir: `/tmp/agentforge/${job.runId}`,
        },
        (ev) => {
          workerLogger.info(
            { eventType: ev.type },
            `[Run ${job.runId}] [${ev.type}] ${ev.message}`,
          );
        },
      );

      if (!agentResult.success) {
        await this.sandboxDriver.destroy();
        return { status: RunStatus.FAILED };
      }

      // 3. Run Test Suite inside Sandbox
      const testResult = await this.sandboxDriver.executeCommand("npm", [
        "test",
      ]);
      const diff = await this.sandboxDriver.getDiff();

      // 4. Teardown Sandbox
      await this.sandboxDriver.destroy();

      const finalStatus =
        testResult.exitCode === 0 ? RunStatus.COMPLETED : RunStatus.FAILED;
      return { status: finalStatus, diff };
    } finally {
      this.inFlightJobs.delete(job.runId);
    }
  }

  public async stop(gracePeriodMs = 10000): Promise<void> {
    this.isRunning = false;
    logger.info(
      { workerId: this.workerId, inFlightCount: this.inFlightJobs.size },
      `Stopping worker, draining in-flight jobs...`,
    );

    const startTime = Date.now();
    while (
      this.inFlightJobs.size > 0 &&
      Date.now() - startTime < gracePeriodMs
    ) {
      await new Promise((r) => setTimeout(r, 200));
    }

    if (this.inFlightJobs.size > 0) {
      logger.warn(
        { inFlight: Array.from(this.inFlightJobs) },
        "Worker grace period expired with jobs still in-flight.",
      );
    } else {
      logger.info(
        { workerId: this.workerId },
        "All in-flight jobs completed. Worker stopped cleanly.",
      );
    }
  }

  public get active(): boolean {
    return this.isRunning;
  }

  public get inFlightCount(): number {
    return this.inFlightJobs.size;
  }
}

// Auto-run if executed directly as entrypoint
if (
  process.argv[1]?.endsWith("worker.js") ||
  process.argv[1]?.endsWith("worker.ts")
) {
  const worker = new TaskExecutionWorker();
  worker.start();

  const shutdown = async (sig: string) => {
    logger.info(
      { signal: sig },
      `Received shutdown signal. Stopping worker...`,
    );
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
