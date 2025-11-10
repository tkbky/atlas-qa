import type { Observation, Plan, Candidate, Critique, Transition, Affordance, AtlasEventCallback } from "./types.js";
import { CognitiveMap } from "./cognitiveMap.js";
import { WebEnv } from "./browser.js";
import { plan, propose, critique, isFormControl, memory } from "./agents.js";
import { AtlasMemory } from "./memory/atlasMemory.js";
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
  onEvent?: AtlasEventCallback;
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

// --- progress-aware helper (generic, keyword-free) ---
// Treat "fewer empty required form controls" as progress even if URL/title are unchanged.
const requiredEmptyCount = (o: Observation) =>
  o.affordances
    .filter(isFormControl)
    .filter(a => {
      const fi = (a as any).fieldInfo ?? {};
      const description = ((a as any).description || "").toLowerCase();

      // Check datetime-local inputs
      if (fi.type === "datetime-local" || description.includes("datetime-local")) {
        const val = (a as any).currentValue ?? fi.value ?? "";
        return !!fi.required && String(val).length === 0;
      }

      // Check datetime spinbuttons for availability (goal requires this)
      if (description.includes("spinbutton") && description.includes("availability")) {
        // Check if still showing placeholders (not filled)
        return description.includes("dd") || description.includes("mm") || description.includes("yyyy");
      }

      // Normal form controls
      const val = (a as any).currentValue ?? fi.value ?? "";
      return !!fi.required && String(val).length === 0;
    }).length;

const clone = <T>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: (value: unknown) => unknown }).structuredClone;
  if (structuredCloneFn) {
    return structuredCloneFn(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export async function runAtlas(goal: string, startUrl: string, opts: AtlasOptions = {}): Promise<AtlasRunArtifacts> {
  const { env = "LOCAL", maxSteps = 15, beamSize = 3, logDir, runLabel, timeBudgetMs, onEvent } = opts;
  const vetoThreshold = 0.0; // optional: ignore obviously bad actions from Critic

  const logger = initRunLogger({ logDir, runLabel });
  logInfo("Atlas run started", { goal, startUrl, env, maxSteps, beamSize, runLabel: logger.runId });

  const web = new WebEnv();
  const M = new CognitiveMap();
  const atlasMem = new AtlasMemory(memory);
  const steps: AtlasStepArtifact[] = [];
  let runArtifacts: AtlasRunArtifacts | null = null;
  const startTime = Date.now();
  let endedReason = "max_steps_reached";

  try {
    // Emit init event
    if (onEvent) {
      await onEvent({ type: "init", goal, startUrl, opts });
    }

    await web.init(env);
    logInfo("Web environment initialized", { env });

    await web.goto(startUrl);
    logInfo("Navigated to start URL", { startUrl });

    let o: Observation = await web.currentObservation();
    logDebug("Initial observation captured", summarizeObservation(o));

    let P = await plan(goal, o, onEvent);
    logInfo("Initial plan generated", { plan: P });

    // Track last executed action to influence subsequent proposals (e.g., avoid repeated picker clicks)
    let lastAction: Affordance | null = null;

    for (let t = 0; t < maxSteps; t++) {
      logInfo("Step started", { step: t, plan: P.subgoals });

      if (timeBudgetMs && Date.now() - startTime > timeBudgetMs) {
        endedReason = "time_budget_exceeded";
        logWarn("Time budget exceeded, terminating loop", { step: t, timeBudgetMs });
        break;
      }

      // Retrieve semantic memory (learned rules) for the current domain
      const semanticRules = await atlasMem.summarizeRulesForUrl(o.url);
      if (semanticRules && onEvent) {
        await onEvent({ type: "semantic_rules", step: t, url: o.url, rules: semanticRules });
        logDebug("Semantic rules retrieved", { step: t, url: o.url, rulesLength: semanticRules.length });
      }

      // Nudge the Actor with context derived from last action to prevent loops (e.g., repeated picker clicks)
      let augmentedGoal = goal;
      if (lastAction?.description?.toLowerCase().includes("show local date and time picker")) {
        augmentedGoal = `${goal} (date/time picker already clicked; now set Year/Month/Day/Hours/Minutes/AM-PM via segmented controls—do NOT click the picker again)`;
      }

      // Ask for at least 2 so the Critic has a choice
      let C = await propose(augmentedGoal, P, o, Math.max(beamSize, 2), t, onEvent);
      logInfo("Candidates proposed", { step: t, candidates: C });
      if (C.length === 0) {
        logWarn("No candidates proposed, terminating loop", { step: t });
        endedReason = "no_candidates";
        if (onEvent) {
          await onEvent({ type: "done", finalObservation: clone(o), endedReason, cognitiveMap: M.snapshot() });
        }
        break;
      }

      // CRITIC: look-ahead via cognitive map (D=1 naive)
      const lookaheads = C.map(c => M.lookup(o, c.action) ?? M.placeholder(o, c.action));
      logDebug("Lookahead states prepared", { step: t, lookaheads });

      const critiqueRes = await critique(goal, P, o, C, lookaheads, t, onEvent);
      logInfo("Critique results received", { step: t, critique: critiqueRes });

      // Check if goal is met according to critic evaluation
      if (critiqueRes.goalMet) {
        logInfo("Goal met by critic evaluation", { step: t, reason: critiqueRes.goalMetReason });
        endedReason = "goal_met";
        if (onEvent) {
          await onEvent({ type: "done", finalObservation: clone(o), endedReason, cognitiveMap: M.snapshot() });
        }
        break;
      }

      const choiceIdx = Math.max(0, Math.min(C.length - 1, critiqueRes.chosenIndex));
      let choice = C[choiceIdx];

      // If any required input has empty value, generally don't execute clicks yet—ask for a fill first.
      // EXCEPTIONS:
      // - Allow clicking the 'Show local date and time picker' button once for datetime-local workflows
      // - If the only required empty input is a datetime-local, allow proceeding without gating
      const inputs = o.affordances.filter(a => (a as any)?.fieldInfo?.tagName === "input");
      const requiredEmpty = inputs.filter(a => {
        const fi = (a as any).fieldInfo ?? {};
        const val = (a as any).currentValue ?? fi.value ?? "";
        return !!fi.required && String(val).length === 0;
      });
      // Count required empty inputs that are NOT datetime-local
      const requiredEmptyNonDatetime = inputs.filter(a => {
        const fi = (a as any).fieldInfo ?? {};
        const val = (a as any).currentValue ?? fi.value ?? "";
        if (!(!!fi.required && String(val).length === 0)) return false;
        return (fi.type || "").toLowerCase() !== "datetime-local";
      }).length;
      const hasFillOption = o.affordances.some(a => a.method === "fill");
      const isClick = choice.action.method === "click";
      const isPickerClick =
        isClick &&
        (choice.action.description?.toLowerCase().includes("show local date and time picker") ?? false);
      const repeatedPickerClick =
        isPickerClick &&
        (lastAction?.description?.toLowerCase().includes("show local date and time picker") ?? false);

      if (isClick && requiredEmpty.length > 0 && hasFillOption) {
        // Skip gating when only datetime-local remains or when clicking the picker for the first time
        if (!isPickerClick && requiredEmptyNonDatetime > 0) {
          // Do not execute; ask the Actor again with a tiny nudge toward completeness.
          C = await propose(
            `${goal} (fill required inputs with empty values before any clicks)`,
            P,
            o,
            Math.max(beamSize, 3),
            t,
            onEvent
          );
          if (C.length === 0) {
            P = await plan(goal, o, onEvent);
            continue;
          }
          choice = C[0];
        }
      }

      // Prevent repeated picker clicks if the last action already clicked the picker
      if (repeatedPickerClick) {
        const noRepeatGoal = `${goal} (picker already clicked; now set Year/Month/Day/Hours/Minutes/AM-PM via segmented controls—do NOT click the picker again)`;
        const newCandidates = await propose(noRepeatGoal, P, o, Math.max(beamSize, 3), t, onEvent);
        const alt = newCandidates.find(c =>
          !(c.action.description?.toLowerCase().includes("show local date and time picker") ?? false)
        );
        if (alt) {
          C = newCandidates;
          choice = alt;
          logInfo("Avoiding repeated picker click; selecting segment-setting candidate instead", { step: t, choice });
        }
      }
      // ---------------------------- optional critic veto ----------------------------
      const best = critiqueRes.ranked?.[0];
      if (best && best.value < vetoThreshold) {
        C = await propose(`${goal} (avoid low-value actions; prefer increasing data completeness first)`, P, o, Math.max(beamSize, 3), t, onEvent);
        if (C.length === 0) { P = await plan(goal, o, onEvent); continue; }
        choice = C[0];
      }
      // -------------------------------------------------------------------------------

      logInfo("Selected action", { step: t, chosenIndex: critiqueRes.chosenIndex, action: choice });

      // Emit selected_action event
      if (onEvent) {
        await onEvent({ type: "selected_action", step: t, action: clone(choice.action) });
      }

      // EXECUTE
      await web.act(choice.action);
      logInfo("Action executed", { step: t, action: choice.action });

      // Emit action_executed event
      if (onEvent) {
        await onEvent({ type: "action_executed", step: t, action: clone(choice.action) });
      }

      // OBSERVE NEXT
      const oNext = await web.currentObservation();
      logDebug("Observation after action", { step: t, observation: summarizeObservation(oNext) });

      // Emit observation_after event
      if (onEvent) {
        await onEvent({ type: "observation_after", step: t, before: clone(o), after: clone(oNext) });
      }

      // Remember last action for next-step steering
      lastAction = choice.action;

      const delta = `${o.title} -> ${oNext.title} via ${choice.action.description}`;
      M.record(o, choice.action, oNext, delta);
      logDebug("Cognitive map updated", { step: t, delta });

      // Emit map_update event
      if (onEvent) {
        const edge: Transition = {
          fromKey: o.url,
          actionKey: choice.action.description,
          to: clone(oNext),
          delta,
        };
        await onEvent({ type: "map_update", step: t, edge });
      }

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

      // PROGRESS-AWARE REPLANNING:
      // Only treat as "no progress" if URL/title stayed the same AND the count of empty required inputs did not decrease.
      const sameUrlTitle = (o.url === oNext.url && o.title === oNext.title);
      const noProgress = sameUrlTitle && (requiredEmptyCount(oNext) >= requiredEmptyCount(o));
      if (noProgress && t % 4 === 3) {
        logInfo("Replanning triggered", { step: t, reason: "no-progress" });
        P = await plan(goal, oNext, onEvent);
        logInfo("Plan updated", { step: t, plan: P });

        // Emit replan event
        if (onEvent) {
          await onEvent({ type: "replan", step: t, reason: "no-progress", plan: P });
        }
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

    // Emit done event
    if (onEvent) {
      await onEvent({
        type: "done",
        finalObservation: runArtifacts.finalObservation,
        endedReason: runArtifacts.endedReason,
        cognitiveMap: runArtifacts.cognitiveMap
      });
    }
  } catch (error) {
    logError("Atlas run encountered an error", { error });

    // Emit error event
    if (onEvent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      try {
        await onEvent({ type: "error", message: errorMessage });
      } catch {}
    }

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
