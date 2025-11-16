import type { Request, Response } from "express";
import { runStore } from "./run-store.js";
import { launchRunExecution } from "./run-launcher.js";

/**
 * Server-Sent Events handler for ATLAS streaming
 */
export async function handleAtlasStream(req: Request, res: Response) {
  const goal = (req.query.goal as string) || "Test form";
  const startUrl =
    (req.query.startUrl as string) || "http://localhost:3000";
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

  // Helper to send SSE messages
  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("run_created", { runId, run: runRecord });

  try {
    await launchRunExecution({
      runId,
      goal,
      startUrl,
      env,
      beamSize,
      maxSteps,
      timeBudgetMs,
      sendEvent,
      runLabel: runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent("error", { type: "error", message: errorMessage, runId });
  } finally {
    res.end();
  }
}
