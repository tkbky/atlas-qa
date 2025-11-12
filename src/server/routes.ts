import type { Express, Request, Response } from "express";
import { handleAtlasStream } from "./sse.js";

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SSE endpoint for ATLAS runs
  app.get("/api/atlas/stream", handleAtlasStream);
}
