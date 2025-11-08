import { CognitiveMap } from "../src/cognitiveMap.js";
import type { Observation, Affordance } from "../src/types.js";

describe("CognitiveMap", () => {
  it("records and looks up transitions", () => {
    const M = new CognitiveMap();
    const o: Observation = { url: "https://a", title: "A", affordances: [] };
    const a: Affordance = { description: "click next", selector: "/html/x", method: "click" };
    const o2: Observation = { url: "https://b", title: "B", affordances: [] };

    expect(M.lookup(o, a)).toBeNull();
    M.record(o, a, o2, "A->B");
    expect(M.lookup(o, a)?.url).toBe("https://b");
  });
});
