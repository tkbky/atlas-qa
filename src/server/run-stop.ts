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
  const canRequestStop =
    run.status === "running" || run.status === "paused" || run.status === "stopping";
  if (!canRequestStop) {
    res.json({
      status: run.status,
      message: "Run already finished",
      endedReason: run.endedReason,
      errorMessage: run.errorMessage,
    });
    return;
  }

  if (run.status !== "stopping") {
    await runStore.updateStatus(runId, "stopping");
  }
  const stopped = abortRun(runId);
  if (!stopped) {
    const latest = await runStore.getRun(runId);
    if (latest && latest.status !== "running" && latest.status !== "paused") {
      res.json({
        status: latest.status,
        message: "Run already finished",
        endedReason: latest.endedReason,
        errorMessage: latest.errorMessage,
      });
      return;
    }
    res.status(409).json({ error: "Run controller not available" });
    return;
  }

  res.json({ status: "stopping" });
}
