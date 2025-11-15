import type { Observation, Affordance, Transition } from "./types.js";
import type { Memory } from "@mastra/memory";
import { AtlasMemory, AtlasKnowledgeStore } from "../memory/index.js";

const norm = (s: string) => s?.replace(/\s+/g, " ").trim() ?? "";
const keyAction = (a: Affordance) =>
  `${a.method ?? "NL"}::${norm(a.selector ?? "")}::${norm(a.instruction ?? "")}::${norm(a.description)}`;

/**
 * Generate a state key that combines URL with a hash of key affordances.
 * This provides better state differentiation than URL alone (e.g., form validation states).
 */
const keyObs = (o: Observation): string => {
  // Start with URL as base
  let key = o.url;

  // Add a simple hash of affordances to differentiate states at same URL
  // Use first 3 affordances as a simple state signature
  if (o.affordances && o.affordances.length > 0) {
    const affordSig = o.affordances
      .slice(0, 3)
      .map(a => a.description)
      .join("|");
    // Simple hash: just truncate for now, could use proper hash later
    const hash = affordSig.slice(0, 20);
    key = `${o.url}#${hash}`;
  }

  return key;
};

export class CognitiveMap {
  private edges = new Map<string, Transition>(); // key = fromKey + ">>" + keyAction
  // Optional: also persist to Mastra memory so future runs can recall
  private atlasMem: AtlasMemory;
  private knowledgeStore: AtlasKnowledgeStore;
  private hydratedHosts = new Set<string>();

  constructor(memory: Memory, knowledgeStore?: AtlasKnowledgeStore) {
    this.knowledgeStore = knowledgeStore ?? new AtlasKnowledgeStore();
    this.atlasMem = new AtlasMemory(memory, this.knowledgeStore);
  }

  private host(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return "unknown";
    }
  }

  async ensureDomainLoaded(url: string): Promise<void> {
    const host = this.host(url);
    if (this.hydratedHosts.has(host)) return;
    const transitions = await this.knowledgeStore.loadTransitions(host);
    transitions.forEach((tr) => {
      const k = `${tr.fromKey}>>${tr.actionKey}`;
      const existing = this.edges.get(k);
      if (!existing || (existing.lastSeenAt ?? 0) < (tr.lastSeenAt ?? 0)) {
        this.edges.set(k, tr);
      }
    });
    this.hydratedHosts.add(host);
  }

  lookup(from: Observation, a: Affordance): Observation | null {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    return this.edges.get(k)?.to ?? null;
  }

  /**
   * Get the full transition (including uncertainty) for a state-action pair.
   */
  getTransition(from: Observation, a: Affordance): Transition | null {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    return this.edges.get(k) ?? null;
  }

  /**
   * Get the uncertainty for a specific transition.
   * Returns 1.0 (maximum uncertainty) if transition hasn't been observed.
   */
  getUncertainty(from: Observation, a: Affordance): number {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    return this.edges.get(k)?.uncertainty ?? 1.0;
  }

  record(from: Observation, a: Affordance, to: Observation, delta?: string) {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    const existing = this.edges.get(k);
    const now = Date.now();

    // Calculate uncertainty based on visit count (more visits = more confident)
    // U(s,a) = 1 / (1 + visits) — decreases with more observations
    const visits = (existing?.visits ?? 0) + 1;
    const uncertainty = 1 / (1 + visits);

    const record = {
      fromKey: keyObs(from),
      actionKey: keyAction(a),
      to,
      delta,
      uncertainty,
      visits,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
    } satisfies Transition;

    this.edges.set(k, record);
    this.hydratedHosts.add(this.host(from.url));

    // Best-effort persist for cross-run retrieval:
    this.atlasMem.recordTransition(from, a, to, delta).catch(() => {});
    this.knowledgeStore.recordTransition(from, a, record).catch(() => {});
  }

  placeholder(from: Observation, a: Affordance): Observation {
    return {
      url: from.url,
      title: `[UNKNOWN AFTER: ${a.description}]`,
      affordances: [],
    };
  }

  snapshot(): Transition[] {
    return Array.from(this.edges.values()).map(tr => JSON.parse(JSON.stringify(tr)) as Transition);
  }
}
