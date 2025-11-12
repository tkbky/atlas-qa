import express from "express";
import cors from "cors";
import type { AtlasEvent } from "./types.js";
import { runAtlas } from "./atlas.js";

const app = express();
const PORT = process.env.ATLAS_API_PORT || 4000;

// Enable CORS for Next.js dev server
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SSE endpoint for ATLAS runs
app.get("/api/atlas/stream", async (req, res) => {
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
});

// Handle client disconnect
app.use((_req, res, next) => {
  res.on("close", () => {
    console.log("Client disconnected");
  });
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ATLAS API Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Stream endpoint: http://localhost:${PORT}/api/atlas/stream`);
  console.log(`   Allowed origin: ${process.env.CORS_ORIGIN || "http://localhost:3000"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

