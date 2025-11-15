import type { Request, Response } from "express";
import type { AtlasEvent } from "../core/types.js";
import { runAtlas } from "../core/atlas.js";
import { runStore } from "./run-store.js";
import {
  clearRunController,
  emitRunEvent,
  registerRunController,
} from "./run-events.js";

/**
 * Server-Sent Events handler for ATLAS streaming
 */
export async function handleAtlasStream(req: Request, res: Response) {
  const goal = (req.query.goal as string) || "Test form";
  const startUrl = (req.query.startUrl as string) || "http://localhost:3000";
  const env = (req.query.env as "LOCAL" | "BROWSERBASE") || "LOCAL";
  const beamSize = parseInt((req.query.beamSize as string) || "3", 10);
  const maxSteps = parseInt((req.query.maxSteps as string) || "15", 10);
  const timeBudgetMs = req.query.timeBudgetMs
    ? parseInt(req.query.timeBudgetMs as string, 10)
    : undefined;
  const mode = (req.query.mode as "goal" | "flow-discovery") || "goal";

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  const runRecord = await runStore.createRun({
    goal,
    startUrl,
    env,
    beamSize,
    maxSteps,
    mode,
  });
  const runId = runRecord.id;
  const controller = new AbortController();
  registerRunController(runId, controller);

  // Helper to send SSE messages
  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("run_created", { runId, run: runRecord });

  try {
    const artifacts = await runAtlas(goal, startUrl, {
      env,
      beamSize,
      maxSteps,
      timeBudgetMs,
      abortSignal: controller.signal,
      onEvent: async (event: AtlasEvent) => {
        runStore.appendEvent(runId, event).catch(() => {});
        emitRunEvent(runId, event);
        sendEvent(event.type, { ...event, runId });
        if (event.type === "done" || event.type === "error") {
          clearRunController(runId);
        }
      },
    });
    await runStore.markCompleted(runId, artifacts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent("error", { type: "error", message: errorMessage, runId });
    await runStore.markError(runId, errorMessage);
    clearRunController(runId);
  } finally {
    res.end();
  }
}
