import type { Observation } from "./types.js";
import { CognitiveMap } from "./cognitiveMap.js";
import { WebEnv } from "./browser.js";
import { plan, propose, critique } from "./agents.js";
import {
  initRunLogger,
  logDebug,
  logError,
  logInfo,
  logWarn,
  shutdownLogger,
} from "./logger.js";

export type AtlasOptions = {
  env?: "LOCAL" | "BROWSERBASE";
  maxSteps?: number;
  beamSize?: number;   // N
  depth?: number;      // D (naive: 1)
  logDir?: string;
  runLabel?: string;
};

export async function runAtlas(goal: string, startUrl: string, opts: AtlasOptions = {}) {
  const { env = "LOCAL", maxSteps = 15, beamSize = 3, logDir, runLabel } = opts;

  const logger = initRunLogger({ logDir, runLabel });
  logInfo("Atlas run started", { goal, startUrl, env, maxSteps, beamSize, runLabel: logger.runId });

  const web = new WebEnv();
  const M = new CognitiveMap();

  try {
    await web.init(env);
    logInfo("Web environment initialized", { env });

    await web.goto(startUrl);
    logInfo("Navigated to start URL", { startUrl });

    let o: Observation = await web.currentObservation();
    logDebug("Initial observation captured", summarizeObservation(o));

    let P = await plan(goal, o);
    logInfo("Initial plan generated", { plan: P });

    for (let t = 0; t < maxSteps; t++) {
      logInfo("Step started", { step: t, plan: P.subgoals });

      const C = await propose(goal, P, o, beamSize);
      logInfo("Candidates proposed", { step: t, candidates: C });
      if (C.length === 0) {
        logWarn("No candidates proposed, terminating loop", { step: t });
        break;
      }

      const lookaheads = C.map(c => M.lookup(o, c.action) ?? M.placeholder(o, c.action));
      logDebug("Lookahead states prepared", { step: t, lookaheads });

      const critiqueRes = await critique(goal, P, o, C, lookaheads);
      logInfo("Critique results received", { step: t, critique: critiqueRes });

      const chosenIndex = Math.max(0, Math.min(C.length - 1, critiqueRes.chosenIndex));
      const choice = C[chosenIndex];
      logInfo("Selected action", { step: t, chosenIndex, action: choice });

      await web.act(choice.action);
      logInfo("Action executed", { step: t, action: choice.action });

      const oNext = await web.currentObservation();
      logDebug("Observation after action", { step: t, observation: summarizeObservation(oNext) });

      const delta = `${o.title} -> ${oNext.title} via ${choice.action.description}`;
      M.record(o, choice.action, oNext, delta);
      logDebug("Cognitive map updated", { step: t, delta });

      const noMove = o.url === oNext.url && o.title === oNext.title;
      if (noMove || t % 3 === 2) {
        logInfo("Replanning triggered", { step: t, reason: noMove ? "no-move" : "periodic" });
        P = await plan(goal, oNext);
        logInfo("Plan updated", { step: t, plan: P });
      }

      o = oNext;

      if (/success|completed|done/i.test(o.title)) {
        logInfo("Success heuristic matched, terminating run", { step: t, title: o.title });
        break;
      }
    }
  } catch (error) {
    logError("Atlas run encountered an error", { error });
    throw error;
  } finally {
    try {
      await web.close();
      logInfo("Web environment closed");
    } catch (closeError) {
      logError("Failed to close web environment", { error: closeError });
    }
    shutdownLogger();
  }
}

function summarizeObservation(o: Observation) {
  return {
    url: o.url,
    title: o.title,
    affordanceCount: o.affordances.length,
    affordances: o.affordances,
    pageTextLength: o.pageText?.length ?? 0,
    pageTextPreview: o.pageText ? o.pageText.slice(0, 500) : undefined,
  };
}
