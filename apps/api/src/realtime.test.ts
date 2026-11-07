import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { createApp } from "./app.js";
import { AgentForgeSocketServer } from "./realtime/socket-server.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryAuditRepository,
  InMemoryRunEventRepository,
} from "@agentforge/db";
import { AuthService } from "./auth/auth-service.js";

describe("Phase 8: Real-Time Communication & WebSockets", () => {
  let server: http.Server;
  let socketServer: AgentForgeSocketServer;
  let port: number;

  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let projectRepo: InMemoryProjectRepository;
  let taskRepo: InMemoryTaskRepository;
  let runRepo: InMemoryRunRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let auditRepo: InMemoryAuditRepository;
  let runEventRepo: InMemoryRunEventRepository;
  let authService: AuthService;

  let userA: any;
  let userB: any;
  let workspaceA: any;
  let workspaceB: any;
  let projectA: any;
  let taskA: any;
  let runA: any;

  beforeAll(async () => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    projectRepo = new InMemoryProjectRepository();
    taskRepo = new InMemoryTaskRepository();
    runRepo = new InMemoryRunRepository();
    outboxRepo = new InMemoryOutboxRepository();
    auditRepo = new InMemoryAuditRepository();
    runEventRepo = new InMemoryRunEventRepository();
    authService = new AuthService(userRepo);

    // Seed test users via auth service
    userA = await authService.authenticateToken("alice@tenant-a.com");
    userB = await authService.authenticateToken("bob@tenant-b.com");

    // Seed Workspace A
    workspaceA = await workspaceRepo.createWorkspace({
      name: "Tenant A Workspace",
      slug: "tenant-a",
      ownerId: userA.id,
    });

    // Seed Workspace B
    workspaceB = await workspaceRepo.createWorkspace({
      name: "Tenant B Workspace",
      slug: "tenant-b",
      ownerId: userB.id,
    });

    // Seed Project and Task for Workspace A
    projectA = await projectRepo.createProject({
      workspaceId: workspaceA.id,
      name: "API Service",
      repoOwner: "tenant-a-org",
      repoName: "api-service",
    });

    taskA = await taskRepo.createTask({
      workspaceId: workspaceA.id,
      projectId: projectA.id,
      createdById: userA.id,
      title: "Realtime log streaming task",
    });

    runA = await runRepo.createRun({
      taskId: taskA.id,
      workspaceId: workspaceA.id,
      attemptNumber: 1,
    });

    const app = createApp({
      userRepo,
      workspaceRepo,
      projectRepo,
      taskRepo,
      runRepo,
      outboxRepo,
      auditRepo,
      runEventRepo,
      authService,
    });

    server = http.createServer(app);
    socketServer = new AgentForgeSocketServer(
      server,
      authService,
      workspaceRepo,
      taskRepo,
      runEventRepo,
    );

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (socketServer) {
      await socketServer.close();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it("rejects unauthenticated socket connections", async () => {
    const client = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      autoConnect: true,
    });

    const err = await new Promise<any>((resolve) => {
      client.on("connect_error", (error) => {
        resolve(error);
        client.disconnect();
      });
    });

    expect(err.message).toContain("Authentication error");
  });

  it("connects successfully with valid bearer token in auth header", async () => {
    const client = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: {
        token: `Bearer ${userA.email}`,
      },
    });

    await new Promise<void>((resolve) => {
      client.on("connect", () => {
        resolve();
      });
    });

    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it("allows authorized user to join task room and receive streamed logs", async () => {
    const client = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: {
        token: `Bearer ${userA.email}`,
      },
    });

    await new Promise<void>((resolve) => {
      client.on("connect", () => resolve());
    });

    // Subscribe to task
    const joinResult = await new Promise<any>((resolve) => {
      client.emit(
        "join:task",
        { taskId: taskA.id, workspaceId: workspaceA.id },
        (res: any) => {
          resolve(res);
        },
      );
    });

    expect(joinResult.success).toBe(true);
    expect(joinResult.room).toBe(`task:${taskA.id}`);

    // Listen for streamed run events
    const receivedEvents: any[] = [];
    client.on("run:event", (data) => {
      receivedEvents.push(data);
    });

    // Emit event on server
    await socketServer.emitAndRecordEvent(
      workspaceA.id,
      taskA.id,
      runA.id,
      "LOG",
      { line: "Cloning repository into sandbox workspace...", level: "INFO" },
    );

    // Wait for event to arrive at client
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].event.type).toBe("LOG");
    expect(receivedEvents[0].event.sequenceNumber).toBe(1);
    expect(receivedEvents[0].event.payload.line).toContain(
      "Cloning repository",
    );

    client.disconnect();
  });

  it("rejects cross-tenant room subscriptions (Tenant B cannot listen to Tenant A)", async () => {
    const clientB = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: {
        token: `Bearer ${userB.email}`,
      },
    });

    await new Promise<void>((resolve) => {
      clientB.on("connect", () => resolve());
    });

    // User B attempts to subscribe to Task A in Workspace A
    const joinResult = await new Promise<any>((resolve) => {
      clientB.emit(
        "join:task",
        { taskId: taskA.id, workspaceId: workspaceA.id },
        (res: any) => {
          resolve(res);
        },
      );
    });

    expect(joinResult.success).toBe(false);
    expect(joinResult.error).toContain("Forbidden");

    clientB.disconnect();
  });

  it("recovers missed events via REST catch-up query using monotonic sequence numbers", async () => {
    // Record multiple events for runA
    await socketServer.emitAndRecordEvent(
      workspaceA.id,
      taskA.id,
      runA.id,
      "STATUS_CHANGE",
      { from: "QUEUED", to: "PROVISIONING" },
    );
    await socketServer.emitAndRecordEvent(
      workspaceA.id,
      taskA.id,
      runA.id,
      "TOOL_CALL",
      { tool: "readFile", path: "src/server.ts" },
    );
    await socketServer.emitAndRecordEvent(
      workspaceA.id,
      taskA.id,
      runA.id,
      "STATUS_CHANGE",
      { from: "PROVISIONING", to: "RUNNING" },
    );

    // Client requests all events
    const allRes = await request(server)
      .get(
        `/v1/workspaces/${workspaceA.id}/tasks/${taskA.id}/runs/${runA.id}/events`,
      )
      .set("Authorization", `Bearer ${userA.email}`);

    expect(allRes.status).toBe(200);
    expect(allRes.body.events.length).toBe(4); // 1 from previous test + 3 new

    // Client requests catch-up since sequence 2
    const catchupRes = await request(server)
      .get(
        `/v1/workspaces/${workspaceA.id}/tasks/${taskA.id}/runs/${runA.id}/events?sinceSeq=2`,
      )
      .set("Authorization", `Bearer ${userA.email}`);

    expect(catchupRes.status).toBe(200);
    expect(catchupRes.body.events.length).toBe(2);
    expect(catchupRes.body.events[0].sequenceNumber).toBe(3);
    expect(catchupRes.body.events[1].sequenceNumber).toBe(4);
  });

  it("Scenario 8: Runner or client network reconnection preserves complete durable history with zero event loss", async () => {
    // 1. Client connects and receives events 1-4
    const client = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: `Bearer ${userA.email}` },
    });

    await new Promise<void>((resolve) => client.on("connect", () => resolve()));
    await new Promise<any>((resolve) =>
      client.emit(
        "join:task",
        { taskId: taskA.id, workspaceId: workspaceA.id },
        resolve,
      ),
    );

    // 2. Client experiences sudden network drop / disconnection
    client.disconnect();
    expect(client.connected).toBe(false);

    // 3. During disconnection, runner/server continues generating durable task events
    const generatedEventsCount = 5;
    for (let i = 1; i <= generatedEventsCount; i++) {
      await socketServer.emitAndRecordEvent(
        workspaceA.id,
        taskA.id,
        runA.id,
        "LOG",
        {
          line: `Disconnected runner progress log message #${i}`,
          iteration: i,
        },
      );
    }

    // 4. Client reconnects with last acknowledged sequence (sinceSeq = 4)
    const reconnectClient = Client(`http://localhost:${port}`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: `Bearer ${userA.email}` },
    });
    await new Promise<void>((resolve) =>
      reconnectClient.on("connect", () => resolve()),
    );

    // Reconnection catch-up via durable REST query
    const catchupRes = await request(server)
      .get(
        `/v1/workspaces/${workspaceA.id}/tasks/${taskA.id}/runs/${runA.id}/events?sinceSeq=4`,
      )
      .set("Authorization", `Bearer ${userA.email}`);

    expect(catchupRes.status).toBe(200);
    expect(catchupRes.body.events.length).toBe(generatedEventsCount);

    // Verify all sequence numbers are monotonic, contiguous, and uncorrupted
    for (let idx = 0; idx < generatedEventsCount; idx++) {
      const expectedSeq = 5 + idx;
      expect(catchupRes.body.events[idx].sequenceNumber).toBe(expectedSeq);
      expect(catchupRes.body.events[idx].payload.iteration).toBe(idx + 1);
    }

    reconnectClient.disconnect();
  });
});
