import type { Express, Request, Response } from "express";
import { handleAtlasStream } from "./sse.js";
import { runStore } from "./run-store.js";
import { handleKnowledgeRequest } from "./knowledge.js";
import { handleRunStream } from "./run-stream.js";
import { handleRunStop } from "./run-stop.js";

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SSE endpoint for ATLAS runs
  app.get("/api/atlas/stream", handleAtlasStream);

  app.get("/api/runs/:id/stream", handleRunStream);
  app.post("/api/runs/:id/stop", handleRunStop);

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
