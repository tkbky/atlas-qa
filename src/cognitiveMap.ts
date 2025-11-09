import type { Observation, Affordance, Transition } from "./types.js";
import { memory } from "./agents.js";
import { AtlasMemory } from "./memory/atlasMemory.js";

const norm = (s: string) => s?.replace(/\s+/g, " ").trim() ?? "";
const keyAction = (a: Affordance) =>
  `${a.method ?? "NL"}::${norm(a.selector ?? "")}::${norm(a.instruction ?? "")}::${norm(a.description)}`;

const keyObs = (o: Observation) => o.url; // naive: URL identifies state

export class CognitiveMap {
  private edges = new Map<string, Transition>(); // key = fromKey + ">>" + keyAction
  // Optional: also persist to Mastra memory so future runs can recall
  private atlasMem = new AtlasMemory(memory);

  lookup(from: Observation, a: Affordance): Observation | null {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    return this.edges.get(k)?.to ?? null;
  }

  record(from: Observation, a: Affordance, to: Observation, delta?: string) {
    const k = `${keyObs(from)}>>${keyAction(a)}`;
    this.edges.set(k, { fromKey: keyObs(from), actionKey: keyAction(a), to, delta });
    // Best-effort persist for cross-run retrieval:
    this.atlasMem.recordTransition(from, a, to, delta).catch(() => {});
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
