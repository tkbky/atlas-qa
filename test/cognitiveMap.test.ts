import { CognitiveMap } from "../src/core/cognitive-map.js";
import type { Observation, Affordance } from "../src/core/types.js";
import { memory } from "../src/agents/index.js";
import { AtlasKnowledgeStore } from "../src/memory/knowledge-store.js";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import os from "node:os";

describe("CognitiveMap", () => {
  it("records and looks up transitions", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "atlas-map-test-"));
    const knowledgeStore = new AtlasKnowledgeStore(tmp);
    const M = new CognitiveMap(memory, knowledgeStore);
    const o: Observation = { url: "https://a", title: "A", affordances: [] };
    const a: Affordance = { description: "click next", selector: "/html/x", method: "click" };
    const o2: Observation = { url: "https://b", title: "B", affordances: [] };

    expect(M.lookup(o, a)).toBeNull();
    M.record(o, a, o2, "A->B");
    expect(M.lookup(o, a)?.url).toBe("https://b");
  });
});
