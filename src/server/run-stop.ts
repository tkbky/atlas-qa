import type { Request, Response } from "express";
import { runStore } from "./run-store.js";
import { abortRun } from "./run-events.js";

export async function handleRunStop(req: Request, res: Response) {
  const runId = req.params.id;
  const run = await runStore.getRun(runId);
  if (!run) {
    res.status(404).json({ error: `Run ${runId} not found` });
    return;
  }
  if (run.status !== "running") {
    res.status(400).json({ error: "Run is not currently running" });
    return;
  }

  const stopped = abortRun(runId);
  if (!stopped) {
    res.status(409).json({ error: "Run controller not available" });
    return;
  }

  res.json({ status: "stopping" });
}
