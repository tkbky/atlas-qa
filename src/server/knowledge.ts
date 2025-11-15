import type { Request, Response } from "express";
import { AtlasKnowledgeStore } from "../memory/index.js";
import { runStore } from "./run-store.js";
import type { StoredRun } from "./run-store.js";

const knowledgeStore = new AtlasKnowledgeStore();

const hostFromUrl = (url?: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const hostsForRun = (run: StoredRun) => {
  const hosts = new Set<string>();
  const addUrl = (url?: string | null) => {
    const host = hostFromUrl(url ?? undefined);
    if (host) hosts.add(host);
  };
  run.events.forEach((event) => {
    switch (event.type) {
      case "observation_after":
        addUrl(event.before?.url);
        addUrl(event.after?.url);
        break;
      case "map_update":
        addUrl(event.edge?.to?.url);
        break;
      case "done":
        addUrl(event.finalObservation?.url);
        break;
      default:
        break;
    }
  });
  if (run.artifacts?.finalObservation?.url) {
    addUrl(run.artifacts.finalObservation.url);
  }
  return hosts;
};

export async function handleKnowledgeRequest(req: Request, res: Response) {
  const runId = (req.query.runId as string) || undefined;
  const hostFilter = ((req.query.host as string) || "").toLowerCase();
  const urlFilter = ((req.query.url as string) || "").toLowerCase();
  const textQuery = ((req.query.q as string) || "").toLowerCase();

  let allowedHosts: Set<string> | null = null;
  if (runId) {
    const run = await runStore.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run ${runId} not found` });
      return;
    }
    allowedHosts = hostsForRun(run);
  }

  const allHosts = await knowledgeStore.listHosts();
  const targetHosts = allHosts.filter((host) => {
    if (allowedHosts && !allowedHosts.has(host)) return false;
    if (hostFilter && !host.toLowerCase().includes(hostFilter)) return false;
    return true;
  });

  const entries: {
    host: string;
    transitions: any[];
    semanticRules: any[];
  }[] = [];

  for (const host of targetHosts) {
    const transitions = await knowledgeStore.loadTransitions(host);
    const semanticRules = await knowledgeStore.getSemanticRules(host);

    const filteredTransitions = transitions.filter((transition) => {
      const urlMatch = urlFilter
        ? transition.to?.url?.toLowerCase().includes(urlFilter) ||
          transition.delta?.toLowerCase().includes(urlFilter)
        : true;
      const textMatch = textQuery
        ? `${transition.to?.title ?? ""} ${transition.delta ?? ""}`
            .toLowerCase()
            .includes(textQuery)
        : true;
      return urlMatch && textMatch;
    });

    const filteredRules = semanticRules.filter((rule) => {
      const urlMatch = urlFilter
        ? (rule.firstSeenAt || "").toLowerCase().includes(urlFilter)
        : true;
      const textMatch = textQuery
        ? `${rule.kind} ${rule.note ?? ""}`.toLowerCase().includes(textQuery)
        : true;
      return urlMatch && textMatch;
    });

    if (filteredTransitions.length === 0 && filteredRules.length === 0) {
      continue;
    }

    entries.push({
      host,
      transitions: filteredTransitions,
      semanticRules: filteredRules,
    });
  }

  res.json({ entries });
}
