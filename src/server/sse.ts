import type { Request, Response } from "express";
import type { AtlasEvent } from "../core/types.js";
import { runAtlas } from "../core/atlas.js";

/**
 * Server-Sent Events handler for ATLAS streaming
 */
export async function handleAtlasStream(req: Request, res: Response) {
  const goal = (req.query.goal as string) || "Test form";
  const startUrl = (req.query.startUrl as string) || "http://localhost:3000";
  const env = (req.query.env as "LOCAL" | "BROWSERBASE") || "LOCAL";
  const beamSize = parseInt(req.query.beamSize as string || "3", 10);
  const maxSteps = parseInt(req.query.maxSteps as string || "15", 10);
  const timeBudgetMs = req.query.timeBudgetMs
    ? parseInt(req.query.timeBudgetMs as string, 10)
    : undefined;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Helper to send SSE messages
  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runAtlas(goal, startUrl, {
      env,
      beamSize,
      maxSteps,
      timeBudgetMs,
      onEvent: async (event: AtlasEvent) => {
        sendEvent(event.type, event);
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent("error", { type: "error", message: errorMessage });
  } finally {
    res.end();
  }
}
