import type { Observation } from "./types.js";
import { WebEnv } from "./browser.js";
import { CognitiveMap } from "./cognitiveMap.js";

export async function seedCognitiveMap(startUrl: string, steps = 5) {
  const web = new WebEnv();
  const M = new CognitiveMap();
  await web.init("LOCAL");
  await web.goto(startUrl);

  let o: Observation = await web.currentObservation();

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
  }

  await web.close();
  return M;
}
