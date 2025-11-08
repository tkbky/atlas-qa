import type { Observation } from "./types.js";
import { CognitiveMap } from "./cognitiveMap.js";
import { WebEnv } from "./browser.js";
import { plan, propose, critique } from "./agents.js";

export type AtlasOptions = {
  env?: "LOCAL" | "BROWSERBASE";
  maxSteps?: number;
  beamSize?: number;   // N
  depth?: number;      // D (naive: 1)
};

export async function runAtlas(goal: string, startUrl: string, opts: AtlasOptions = {}) {
  const { env = "LOCAL", maxSteps = 15, beamSize = 3 } = opts;

  const web = new WebEnv();
  const M = new CognitiveMap();
  await web.init(env);
  await web.goto(startUrl);

  let o: Observation = await web.currentObservation();
  let P = await plan(goal, o);

  for (let t = 0; t < maxSteps; t++) {
    // ACTOR: propose up to N candidates visible on page
    const C = await propose(goal, P, o, beamSize);
    if (C.length === 0) break;

    // CRITIC + LAS (D=1 here): evaluate candidates against predicted next states from M
    const lookaheads = C.map(c => M.lookup(o, c.action) ?? M.placeholder(o, c.action));
    const critiqueRes = await critique(goal, P, o, C, lookaheads);
    const choice = C[Math.max(0, Math.min(C.length - 1, critiqueRes.chosenIndex))];

    // EXECUTE
    await web.act(choice.action);

    // OBSERVE NEXT + UPDATE MAP
    const oNext = await web.currentObservation();
    const delta = `${o.title} -> ${oNext.title} via ${choice.action.description}`;
    M.record(o, choice.action, oNext, delta);

    // SIMPLE REPLAN trigger: no movement or every few steps
    const noMove = o.url === oNext.url && o.title === oNext.title;
    if (noMove || t % 3 === 2) {
      P = await plan(goal, oNext);
    }

    o = oNext;

    // Naive goal check: stop if the current title hints success (replace with subgoal predicates)
    if (/success|completed|done/i.test(o.title)) break;
  }

  await web.close();
}
