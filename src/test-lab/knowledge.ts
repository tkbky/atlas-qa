import { AtlasKnowledgeStore } from "../memory/index.js";
import type { Transition } from "../core/types.js";
import type { SemanticRule } from "../memory/atlas-memory.js";
import type { HostSnapshot, HostSummary } from "./types.js";

const knowledgeStore = new AtlasKnowledgeStore();

const deriveLastSeen = (snapshot: {
  transitions: Transition[];
  semanticRules: SemanticRule[];
}): string | undefined => {
  const transitionTs = snapshot.transitions
    .map((t) => t.lastSeenAt ?? t.firstSeenAt ?? 0)
    .filter((ts): ts is number => Number.isFinite(ts));
  const semanticTs = snapshot.semanticRules
    .map((rule) => (rule.firstSeenAt ? Date.parse(rule.firstSeenAt) : 0))
    .filter((ts): ts is number => Number.isFinite(ts));
  const latest = Math.max(0, ...transitionTs, ...semanticTs);
  if (!Number.isFinite(latest) || latest <= 0) {
    return undefined;
  }
  return new Date(latest).toISOString();
};

export async function listHostSummaries(): Promise<HostSummary[]> {
  const hosts = await knowledgeStore.listHosts();
  const summaries = await Promise.all(
    hosts.map(async (host) => {
      const [transitions, semanticRules] = await Promise.all([
        knowledgeStore.loadTransitions(host),
        knowledgeStore.getSemanticRules(host),
      ]);
      return {
        host,
        transitionCount: transitions.length,
        semanticRuleCount: semanticRules.length,
        lastSeenAt: deriveLastSeen({ transitions, semanticRules }),
      } satisfies HostSummary;
    })
  );
  return summaries.sort((a, b) => (b.lastSeenAt ?? "") > (a.lastSeenAt ?? "") ? 1 : -1);
}

export async function getHostSnapshot(hostOrUrl: string): Promise<HostSnapshot> {
  const transitions = await knowledgeStore.loadTransitions(hostOrUrl);
  const semanticRules = await knowledgeStore.getSemanticRules(hostOrUrl);
  let host = hostOrUrl;
  try {
    host = new URL(hostOrUrl).host || hostOrUrl;
  } catch {
    host = hostOrUrl;
  }
  return { host, transitions, semanticRules };
}
