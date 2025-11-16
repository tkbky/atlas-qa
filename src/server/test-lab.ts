import type { Express, Request, Response } from "express";
import {
  listHostSummaries,
  getHostSnapshot,
  suggestFlowsForHost,
  generateTestForHost,
} from "../test-lab/service.js";

const decodeHost = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function setupTestLabRoutes(app: Express) {
  app.get("/api/test-lab/hosts", async (_req: Request, res: Response) => {
    try {
      const hosts = await listHostSummaries();
      res.json({ hosts });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/test-lab/hosts/:host", async (req: Request, res: Response) => {
    const host = decodeHost(req.params.host);
    try {
      const snapshot = await getHostSnapshot(host);
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post(
    "/api/test-lab/hosts/:host/plan",
    async (req: Request, res: Response) => {
      const host = decodeHost(req.params.host);
      const url = typeof req.body?.url === "string" ? req.body.url : undefined;
      const userPrompt =
        typeof req.body?.userPrompt === "string" ? req.body.userPrompt : undefined;
      try {
      const { suggestions, prompt: agentPrompt, rawOutput } = await suggestFlowsForHost(
        host,
        userPrompt,
        url
      );
      res.json({ host, suggestions, prompt: agentPrompt, rawOutput });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  app.post(
    "/api/test-lab/hosts/:host/generate",
    async (req: Request, res: Response) => {
      const host = decodeHost(req.params.host);
      const goal = (req.body?.goal as string)?.trim();
      if (!goal) {
        res.status(400).json({ error: "Missing goal" });
        return;
      }
      const userPrompt =
        typeof req.body?.userPrompt === "string" ? req.body.userPrompt : undefined;
      try {
        const { result } = await generateTestForHost(host, goal, userPrompt);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );
}
