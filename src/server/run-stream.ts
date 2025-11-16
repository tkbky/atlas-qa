import type { Request, Response } from "express";
import { runStore } from "./run-store.js";
import { subscribeToRunEvents } from "./run-events.js";

const writeSse = (res: Response, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

export async function handleRunStream(req: Request, res: Response) {
  const runId = req.params.id;
  const run = await runStore.getRun(runId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (!run) {
    writeSse(res, "error", { type: "error", message: `Run ${runId} not found`, runId });
    res.end();
    return;
  }

  const streamable =
    run.status === "running" || run.status === "paused" || run.status === "stopping";
  if (!streamable) {
    writeSse(res, "error", {
      type: "error",
      message: `Run ${runId} is not running`,
      runId,
    });
    res.end();
    return;
  }

  writeSse(res, "stream_open", { runId });

  const unsubscribe = subscribeToRunEvents(runId, (event) => {
    writeSse(res, event.type, event);
    if (event.type === "done" || event.type === "error") {
      unsubscribe();
      res.end();
    }
  });

  res.on("close", () => {
    unsubscribe();
  });
}
