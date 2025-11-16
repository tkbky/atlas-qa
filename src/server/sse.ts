import type { Request, Response } from "express";
import type { AtlasEvent } from "../core/types.js";
import { runAtlas, type AtlasCheckpoint } from "../core/atlas.js";
import { AtlasRunControl } from "../core/run-control.js";
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
  const resumeFrom = (req.query.resumeFrom as string) || undefined;
  let resumeSource: Awaited<ReturnType<typeof runStore.getRun>> | null = null;
  let checkpoint: AtlasCheckpoint | undefined;
  if (resumeFrom) {
    resumeSource = await runStore.getRun(resumeFrom);
    if (!resumeSource || !resumeSource.checkpoint) {
      res.status(400).json({ error: `Run ${resumeFrom} cannot be resumed` });
      return;
    }
    checkpoint = resumeSource.checkpoint;
  }

  let goal = (req.query.goal as string) || resumeSource?.goal || "Test form";
  let startUrl =
    (req.query.startUrl as string) || resumeSource?.startUrl || "http://localhost:3000";
  let env =
    (req.query.env as "LOCAL" | "BROWSERBASE") || resumeSource?.env || "LOCAL";
  let beamSize = parseInt(
    (req.query.beamSize as string) || String(resumeSource?.beamSize ?? 3),
    10
  );
  let maxSteps = parseInt(
    (req.query.maxSteps as string) || String(resumeSource?.maxSteps ?? 15),
    10
  );
  const timeBudgetMs = req.query.timeBudgetMs
    ? parseInt(req.query.timeBudgetMs as string, 10)
    : undefined;
  const mode = (req.query.mode as "goal" | "flow-discovery") || "goal";

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  if (checkpoint?.maxSteps && checkpoint.maxSteps > maxSteps) {
    maxSteps = checkpoint.maxSteps;
  }

  const runRecord = await runStore.createRun({
    goal,
    startUrl,
    env,
    beamSize,
    maxSteps,
    mode,
    checkpoint,
    currentStep: checkpoint?.stepCount,
    resumedFromId: resumeFrom,
  });
  const runId = runRecord.id;
  const controller = new AbortController();
  const control = new AtlasRunControl({
    maxSteps,
    startStep: checkpoint?.stepCount ?? 0,
    abortSignal: controller.signal,
  });
  registerRunController(runId, controller, control);

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
      control,
      checkpoint,
      onCheckpoint: (cp) => runStore.saveCheckpoint(runId, cp),
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
