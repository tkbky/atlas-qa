import type { Observation } from "../core/types.js";
import { WebEnv } from "../browser/index.js";
import { CognitiveMap } from "../core/cognitive-map.js";
import { memory } from "../agents/index.js";
import { AtlasKnowledgeStore } from "../memory/index.js";

export async function seedCognitiveMap(startUrl: string, steps = 5) {
  const web = new WebEnv();
  const knowledgeStore = new AtlasKnowledgeStore();
  const M = new CognitiveMap(memory, knowledgeStore);
  await web.init("LOCAL");
  await web.goto(startUrl);

  let o: Observation = await web.currentObservation();
  await M.ensureDomainLoaded(o.url);

  for (let i = 0; i < steps; i++) {
    const safe = o.affordances.filter(a =>
      /nav|menu|link|read|view|open|details|next|more|docs|guide|learn/i.test(a.description) &&
      !/delete|buy|checkout|submit|purchase|remove/i.test(a.description)
    );
    const a = safe[0] ?? o.affordances[0];
    if (!a) break;

    await web.act(a);
    const oNext = await web.currentObservation();
    M.record(o, a, oNext, `seed ${i}`);
    await web.goBack();
    o = await web.currentObservation();
    await M.ensureDomainLoaded(o.url);
  }

  await web.close();
  return M;
}
