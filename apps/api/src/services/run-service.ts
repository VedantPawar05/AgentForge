import {
  IRunRepository,
  RunRecord,
  ITaskRepository,
  IOutboxRepository,
  IAuditRepository,
  IRunEventRepository,
  RunEventRecord,
} from "@agentforge/db";
import {
  TaskStatus,
  RunStatus,
  NotFoundError,
  ConflictError,
  PreconditionFailedError,
} from "@agentforge/shared";

export class RunService {
  constructor(
    private readonly runRepo: IRunRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly auditRepo: IAuditRepository,
    private readonly runEventRepo?: IRunEventRepository,
    private readonly maxConcurrencyPerWorkspace = 2,
  ) {}

  public async triggerTaskRun(
    workspaceId: string,
    taskId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RunRecord> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    // Guard: Prevent running already in-flight or merged tasks
    if (
      task.status === TaskStatus.PROVISIONING ||
      task.status === TaskStatus.RUNNING ||
      task.status === TaskStatus.TESTING
    ) {
      throw new ConflictError(
        `Task '${taskId}' is already actively executing in state '${task.status}'`,
      );
    }
    if (task.status === TaskStatus.MERGED) {
      throw new ConflictError(`Task '${taskId}' has already been merged`);
    }

    // Guard: Workspace concurrency limit
    const activeRuns =
      await this.runRepo.countActiveRunsInWorkspace(workspaceId);
    if (activeRuns >= this.maxConcurrencyPerWorkspace) {
      throw new PreconditionFailedError(
        `Workspace concurrency limit reached (max ${this.maxConcurrencyPerWorkspace} active runs). Task will remain queued.`,
      );
    }

    // Calculate attempt number
    const history = await this.runRepo.listRunsForTask(taskId);
    const attemptNumber = history.length + 1;

    // Create durable run record
    const run = await this.runRepo.createRun({
      taskId,
      workspaceId,
      attemptNumber,
    });

    // Update task state with optimistic concurrency
    await this.taskRepo.updateTask(taskId, task.version, {
      status: TaskStatus.QUEUED,
    });

    // Transactional Outbox Event
    await this.outboxRepo.createEvent({
      eventType: "TASK_RUN_REQUESTED",
      aggregateType: "Run",
      aggregateId: run.id,
      payload: {
        runId: run.id,
        taskId: task.id,
        workspaceId,
        attemptNumber,
        targetBranch: task.targetBranch,
      },
    });

    // Audit Log
    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_RUN_TRIGGERED",
      targetType: "Run",
      targetId: run.id,
      ipAddress,
      userAgent,
      metadata: { taskId, attemptNumber },
    });

    return run;
  }

  public async cancelRun(
    workspaceId: string,
    taskId: string,
    runId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RunRecord> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    const run = await this.runRepo.findById(runId);
    if (!run || run.taskId !== taskId) {
      throw new NotFoundError("Run", runId);
    }

    if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED) {
      throw new ConflictError(
        `Cannot cancel run '${runId}' in terminal state '${run.status}'`,
      );
    }

    const cancelledRun = await this.runRepo.cancelRun(runId);

    await this.taskRepo.updateTask(taskId, task.version, {
      status: TaskStatus.CANCELLED,
    });

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_RUN_CANCELLED",
      targetType: "Run",
      targetId: runId,
      ipAddress,
      userAgent,
      metadata: { taskId },
    });

    return cancelledRun;
  }

  public async getRun(
    workspaceId: string,
    taskId: string,
    runId: string,
  ): Promise<RunRecord> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    const run = await this.runRepo.findById(runId);
    if (!run || run.taskId !== taskId) {
      throw new NotFoundError("Run", runId);
    }

    return run;
  }

  public async listRuns(
    workspaceId: string,
    taskId: string,
  ): Promise<RunRecord[]> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }
    return this.runRepo.listRunsForTask(taskId);
  }

  public async getRunEvents(
    workspaceId: string,
    taskId: string,
    runId: string,
    options?: { sinceSeq?: number; limit?: number },
  ): Promise<RunEventRecord[]> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    const run = await this.runRepo.findById(runId);
    if (!run || run.taskId !== taskId) {
      throw new NotFoundError("Run", runId);
    }

    if (!this.runEventRepo) {
      return [];
    }

    return this.runEventRepo.getEvents(runId, options);
  }
}
