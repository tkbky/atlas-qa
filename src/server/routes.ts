import type { Express, Request, Response } from "express";
import { handleAtlasStream } from "./sse.js";
import { runStore } from "./run-store.js";
import { handleKnowledgeRequest } from "./knowledge.js";
import { handleRunStream } from "./run-stream.js";
import { handleRunStop } from "./run-stop.js";
import { launchRunExecution } from "./run-launcher.js";
import { pauseRun, resumeRun, setRunBudget } from "./run-events.js";

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SSE endpoint for ATLAS runs
  app.get("/api/atlas/stream", handleAtlasStream);

  app.get("/api/runs/:id/stream", handleRunStream);
  app.post("/api/runs/:id/stop", handleRunStop);
  app.post("/api/runs/:id/pause", async (req: Request, res: Response) => {
    const runId = req.params.id;
    const run = await runStore.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run ${runId} not found` });
      return;
    }
    if (run.status !== "running") {
      res.status(400).json({ error: "Run is not running" });
      return;
    }
    const paused = pauseRun(runId);
    if (!paused) {
      res.status(409).json({ error: "Run controller not available" });
      return;
    }
    await runStore.updateStatus(runId, "paused");
    res.json({ status: "paused" });
  });

  app.post("/api/runs/:id/resume", async (req: Request, res: Response) => {
    const runId = req.params.id;
    const run = await runStore.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run ${runId} not found` });
      return;
    }
    if (run.status !== "paused") {
      res.status(400).json({ error: "Run is not paused" });
      return;
    }
    const resumed = resumeRun(runId);
    if (!resumed) {
      res.status(409).json({ error: "Run controller not available" });
      return;
    }
    await runStore.updateStatus(runId, "running");
    res.json({ status: "running" });
  });

  app.post("/api/runs/:id/budget", async (req: Request, res: Response) => {
    const runId = req.params.id;
    const maxSteps = Number(req.body?.maxSteps);
    if (!Number.isFinite(maxSteps) || maxSteps <= 0) {
      res.status(400).json({ error: "Invalid maxSteps" });
      return;
    }
    const updated = setRunBudget(runId, maxSteps);
    if (!updated) {
      res.status(404).json({ error: "Run controller not available" });
      return;
    }
    await runStore.updateMaxSteps(runId, maxSteps);
    res.json({ runId, maxSteps });
  });

  app.post("/api/runs/:id/retry", async (req: Request, res: Response) => {
    const runId = req.params.id;
    const run = await runStore.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run ${runId} not found` });
      return;
    }
    if (run.status === "running") {
      res.status(409).json({ error: "Run is already running" });
      return;
    }
    if (!run.checkpoint) {
      res.status(400).json({ error: "Run has no checkpoint to resume from" });
      return;
    }
    const checkpoint = JSON.parse(JSON.stringify(run.checkpoint));
    const lastLogical =
      checkpoint.steps.at(-1)?.logicalStep ??
      checkpoint.steps.at(-1)?.step ??
      0;
    const storedNext =
      typeof checkpoint.nextLogicalStep === "number"
        ? checkpoint.nextLogicalStep
        : lastLogical + 1;
    checkpoint.nextLogicalStep = Math.max(0, storedNext - 1);
    await runStore.updateStatus(runId, "running", { errorMessage: undefined });
    res.json({ status: "running" });
    launchRunExecution({
      runId,
      goal: run.goal,
      startUrl: run.startUrl,
      env: run.env,
      beamSize: run.beamSize,
      maxSteps: run.maxSteps,
      checkpoint,
      runLabel: runId,
    }).catch((error) => {
      console.error(`Failed to restart run ${runId}`, error);
    });
  });

  app.get("/api/runs", async (_req: Request, res: Response) => {
    const runs = await runStore.listRuns();
    res.json({ runs });
  });

  app.get("/api/runs/:id", async (req: Request, res: Response) => {
    const run = await runStore.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `Run ${req.params.id} not found` });
      return;
    }
    res.json(run);
  });

  app.patch("/api/runs/:id", async (req: Request, res: Response) => {
    const name = (req.body?.name as string)?.trim();
    if (!name) {
      res.status(400).json({ error: "Missing run name" });
      return;
    }
    const run = await runStore.renameRun(req.params.id, name);
    if (!run) {
      res.status(404).json({ error: `Run ${req.params.id} not found` });
      return;
    }
    const { events, artifacts, ...summary } = run;
    void events;
    void artifacts;
    res.json(summary);
  });

  app.get("/api/knowledge", handleKnowledgeRequest);
}
