import type { Observation, Plan, Candidate, Critique, Transition, Affordance } from "./types.js";
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
  timeBudgetMs?: number;
};

export type AtlasStepArtifact = {
  step: number;
  plan: Plan;
  candidates: Candidate[];
  critique: Critique;
  chosenIndex: number;
  action: Affordance;
  observationBefore: Observation;
  observationAfter: Observation;
};

export type AtlasRunArtifacts = {
  goal: string;
  startUrl: string;
  steps: AtlasStepArtifact[];
  finalObservation: Observation;
  cognitiveMap: Transition[];
  endedReason: string;
};

const clone = <T>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: (value: unknown) => unknown }).structuredClone;
  if (structuredCloneFn) {
    return structuredCloneFn(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export async function runAtlas(goal: string, startUrl: string, opts: AtlasOptions = {}): Promise<AtlasRunArtifacts> {
  const { env = "LOCAL", maxSteps = 15, beamSize = 3, logDir, runLabel, timeBudgetMs } = opts;
  const vetoThreshold = 0.0; // Minimal critic veto: skip clearly negative choices

  const logger = initRunLogger({ logDir, runLabel });
  logInfo("Atlas run started", { goal, startUrl, env, maxSteps, beamSize, runLabel: logger.runId });

  const web = new WebEnv();
  const M = new CognitiveMap();
  const steps: AtlasStepArtifact[] = [];
  let runArtifacts: AtlasRunArtifacts | null = null;
  const startTime = Date.now();
  let endedReason = "max_steps_reached";

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

      if (timeBudgetMs && Date.now() - startTime > timeBudgetMs) {
        endedReason = "time_budget_exceeded";
        logWarn("Time budget exceeded, terminating loop", { step: t, timeBudgetMs });
        break;
      }

      // ACTOR: ask for at least 2 to give the Critic a choice
      let C = await propose(goal, P, o, Math.max(beamSize, 2));
      logInfo("Candidates proposed", { step: t, candidates: C });
      if (C.length === 0) {
        logWarn("No candidates proposed, terminating loop", { step: t });
        endedReason = "no_candidates";
        break;
      }

      const lookaheads = C.map(c => M.lookup(o, c.action) ?? M.placeholder(o, c.action));
      logDebug("Lookahead states prepared", { step: t, lookaheads });

      const critiqueRes = await critique(goal, P, o, C, lookaheads);
      logInfo("Critique results received", { step: t, critique: critiqueRes });

      const best = critiqueRes.ranked?.[0];
      // Minimal, generic safety: if Critic says "bad", don't execute it; diversify once.
      if (best && best.value < vetoThreshold) {
        C = await propose(
          `${goal} (prefer actions that increase data completeness before clicks)`,
          P, o, Math.max(beamSize, 3)
        );
        if (C.length === 0) {
          // Nothing better; replan and continue without executing a bad click
          P = await plan(goal, o);
          continue;
        }
      }
      const choice = C[Math.max(0, Math.min(C.length - 1, critiqueRes.chosenIndex))];
      logInfo("Selected action", { step: t, chosenIndex: critiqueRes.chosenIndex, action: choice });

      await web.act(choice.action);
      logInfo("Action executed", { step: t, action: choice.action });

      const oNext = await web.currentObservation();
      logDebug("Observation after action", { step: t, observation: summarizeObservation(oNext) });

      const delta = `${o.title} -> ${oNext.title} via ${choice.action.description}`;
      M.record(o, choice.action, oNext, delta);
      logDebug("Cognitive map updated", { step: t, delta });

      steps.push({
        step: t,
        plan: clone(P),
        candidates: clone(C),
        critique: clone(critiqueRes),
        chosenIndex: critiqueRes.chosenIndex,
        action: clone(choice.action),
        observationBefore: clone(o),
        observationAfter: clone(oNext),
      });

      const noMove = o.url === oNext.url && o.title === oNext.title;
      if (noMove || t % 3 === 2) {
        logInfo("Replanning triggered", { step: t, reason: noMove ? "no-move" : "periodic" });
        P = await plan(goal, oNext);
        logInfo("Plan updated", { step: t, plan: P });
      }

      o = oNext;

      if (/success|completed|done/i.test(o.title)) {
        logInfo("Success heuristic matched, terminating run", { step: t, title: o.title });
        endedReason = "success_heuristic";
        break;
      }
    }

    runArtifacts = {
      goal,
      startUrl,
      steps,
      finalObservation: clone(o),
      cognitiveMap: M.snapshot(),
      endedReason,
    };
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

  if (!runArtifacts) {
    throw new Error("Atlas run did not produce artifacts");
  }

  return runArtifacts;
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
