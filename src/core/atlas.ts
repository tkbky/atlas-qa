import type {
  Observation,
  Plan,
  Candidate,
  Critique,
  Transition,
  Affordance,
  AtlasEventCallback,
  AtlasEvent,
  RecentAction,
} from "./types.js";
import { CognitiveMap } from "./cognitive-map.js";
import { AtlasRunControl } from "./run-control.js";
import { WebEnv } from "../browser/index.js";
import {
  plan,
  propose,
  critique,
  isFormControl,
  memory,
  mastra,
  analyzeFlow,
  judge,
} from "../agents/index.js";
import type { AgentInvocationOptions } from "../agents/index.js";
import {
  AtlasMemory,
  AtlasKnowledgeStore,
  deriveSemanticRulesFromObservation,
} from "../memory/index.js";
import { generateDelta } from "../agents/helpers.js";
import {
  initRunLogger,
  logDebug,
  logError,
  logInfo,
  logWarn,
  shutdownLogger,
} from "../utils/logger.js";

export type AtlasOptions = {
  env?: "LOCAL" | "BROWSERBASE";
  maxSteps?: number;
  beamSize?: number; // N
  depth?: number; // D (naive: 1)
  logDir?: string;
  runLabel?: string;
  timeBudgetMs?: number;
  onEvent?: AtlasEventCallback;
  abortSignal?: AbortSignal;
  control?: AtlasRunControl;
  checkpoint?: AtlasCheckpoint;
  onCheckpoint?: (checkpoint: AtlasCheckpoint) => Promise<void> | void;
};

export type AtlasStepArtifact = {
  step: number;
  logicalStep: number;
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

export type AtlasCheckpoint = {
  goal: string;
  startUrl: string;
  env: "LOCAL" | "BROWSERBASE";
  timestamp: string;
  plan: Plan;
  steps: AtlasStepArtifact[];
  recentActions: RecentAction[];
  currentObservation: Observation;
  lastAction: Affordance | null;
  cognitiveMap: Transition[];
  stepCount: number;
  maxSteps: number;
  beamSize: number;
  timeBudgetMs?: number;
  endedReason?: string;
  nextLogicalStep: number;
};

// --- progress-aware helper ---
// Treat "fewer empty required form controls" as progress even if URL/title are unchanged.
const requiredEmptyCount = (o: Observation) =>
  o.affordances.filter(isFormControl).filter((a) => {
    const fi = (a as any).fieldInfo ?? {};
    const val = (a as any).currentValue ?? fi.value ?? "";
    return !!fi.required && String(val).length === 0;
  }).length;

const clone = <T>(value: T): T => {
  const structuredCloneFn = (
    globalThis as { structuredClone?: (value: unknown) => unknown }
  ).structuredClone;
  if (structuredCloneFn) {
    return structuredCloneFn(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export async function runAtlas(
  goal: string,
  startUrl: string,
  opts: AtlasOptions = {}
): Promise<AtlasRunArtifacts> {
  const {
    env = "LOCAL",
    maxSteps = 15,
    beamSize = 3,
    logDir,
    runLabel,
    timeBudgetMs,
    onEvent,
    abortSignal,
    control: providedControl,
    checkpoint,
    onCheckpoint,
  } = opts;
  const vetoThreshold = 0.0; // optional: ignore obviously bad actions from Critic

  const logger = initRunLogger({ logDir, runLabel });
  logInfo("Atlas run started", {
    goal,
    startUrl,
    env,
    maxSteps,
    beamSize,
    runLabel: logger.runId,
  });

  const agentThreadPrefixes = {
    planner: "atlas-planner",
    actor: "atlas-actor",
    critic: "atlas-critic",
    flowAnalysis: "atlas-flow-analysis",
    judge: "atlas-judge",
    testGeneration: "atlas-test-generation",
  } as const;

  const buildInvocationOptions = (
    agentKey: keyof typeof agentThreadPrefixes,
    step?: number,
    scope?: string
  ): AgentInvocationOptions => {
    const parts = [logger.runId, agentThreadPrefixes[agentKey]];
    if (typeof step === "number") {
      parts.push(`step-${step}`);
    }
    if (scope) {
      parts.push(scope);
    }
    return {
      runId: logger.runId,
      memory: {
        resource: logger.runId,
        thread: parts.join(":"),
        readOnly: true,
      },
    };
  };

  const web = new WebEnv();
  const knowledgeStore = new AtlasKnowledgeStore();
  const M = new CognitiveMap(memory, knowledgeStore);
  const atlasMem = new AtlasMemory(memory, knowledgeStore);
  if (checkpoint?.cognitiveMap?.length) {
    M.hydrateSnapshot(checkpoint.cognitiveMap);
  }
  const steps: AtlasStepArtifact[] = checkpoint?.steps
    ? checkpoint.steps.map((s) => ({
        ...clone(s),
        logicalStep: typeof s.logicalStep === "number" ? s.logicalStep : s.step,
      }))
    : [];
  const stepLogical = new Map<number, number>();
  steps.forEach((artifact) => {
    stepLogical.set(
      artifact.step,
      typeof artifact.logicalStep === "number"
        ? artifact.logicalStep
        : artifact.step
    );
  });
  const emitEvent = async (
    event: AtlasEvent,
    fallbackLogical?: number
  ): Promise<void> => {
    if (!onEvent) {
      return;
    }
    if ("step" in event && typeof event.step === "number") {
      const logical =
        stepLogical.get(event.step) ??
        fallbackLogical ??
        (event as any).logicalStep ??
        event.step;
      await onEvent({ ...event, logicalStep: logical });
      return;
    }
    await onEvent(event);
  };
  let lastAction: Affordance | null = checkpoint?.lastAction
    ? clone(checkpoint.lastAction)
    : null;
  const recentActions: RecentAction[] = checkpoint?.recentActions
    ? checkpoint.recentActions.map((a) => clone(a))
    : [];
  const initialStep = steps.length;
  const runControl =
    providedControl ??
    new AtlasRunControl({
      maxSteps,
      startStep: initialStep,
      abortSignal,
    });
  if (abortSignal) {
    runControl.attachAbortSignal(abortSignal);
  }
  if (!providedControl) {
    runControl.updateMaxSteps(maxSteps);
  }
  runControl.setCurrentStep(initialStep);
  let nextLogicalStep =
    checkpoint?.nextLogicalStep ??
    (steps.length > 0
      ? (steps[steps.length - 1].logicalStep ?? steps[steps.length - 1].step) + 1
      : 0);

  let runArtifacts: AtlasRunArtifacts | null = null;
  const startTime = Date.now();
  let endedReason = "max_steps_reached";

  try {
    // Emit init event
    await emitEvent({ type: "init", goal, startUrl, opts });

    await web.init(env);
    logInfo("Web environment initialized", { env });

    await web.goto(startUrl);
    logInfo("Navigated to start URL", { startUrl });

    let o: Observation = await web.currentObservation();
    if (checkpoint) {
      o = (await replayStepsToCheckpoint(web, checkpoint.steps)) ?? o;
      logInfo("Resumed from checkpoint", {
        stepCount: checkpoint.stepCount,
      });
    }
    await M.ensureDomainLoaded(o.url);
    logDebug("Initial observation captured", summarizeObservation(o));

    let P: Plan;
    if (checkpoint) {
      P = clone(checkpoint.plan);
    } else {
      P = await plan(
        goal,
        o,
        emitEvent,
        buildInvocationOptions("planner", undefined, "initial")
      );
      logInfo("Initial plan generated", { plan: P });
    }

    const persistCheckpoint = async () => {
      if (!onCheckpoint) return;
      const checkpointPayload: AtlasCheckpoint = {
        goal,
        startUrl,
        env,
        timestamp: new Date().toISOString(),
        plan: clone(P),
        steps: clone(steps),
        recentActions: clone(recentActions),
        currentObservation: clone(o),
        lastAction: lastAction ? clone(lastAction) : null,
        cognitiveMap: M.snapshot(),
        stepCount: steps.length,
        maxSteps: runControl.getMaxSteps(),
        beamSize,
        timeBudgetMs,
        endedReason,
        nextLogicalStep,
      };
      try {
        await onCheckpoint(checkpointPayload);
      } catch (error) {
        logWarn("Failed to persist checkpoint", { error });
      }
    };

    await persistCheckpoint();

    let t = runControl.getCurrentStep();
    for (;;) {
      await runControl.waitIfPaused();
      if (runControl.shouldStop()) {
        endedReason = "aborted_by_user";
        logWarn("Run control requested stop, terminating run", { step: t });
        break;
      }
      const effectiveMaxSteps = runControl.getMaxSteps();
      if (t >= effectiveMaxSteps) {
        endedReason = "max_steps_reached";
        logInfo("Max steps reached", { step: t, maxSteps: effectiveMaxSteps });
        break;
      }
      logInfo("Step started", { step: t, plan: P.subgoals });
      const currentLogicalStep =
        stepLogical.get(t) ?? nextLogicalStep;

      if (timeBudgetMs && Date.now() - startTime > timeBudgetMs) {
        endedReason = "time_budget_exceeded";
        logWarn("Time budget exceeded, terminating loop", {
          step: t,
          timeBudgetMs,
        });
        break;
      }

      // Ensure we have the latest cognitive map context before using it.
      await M.ensureDomainLoaded(o.url);

      // Retrieve semantic memory (learned rules) for the current domain
      const semanticRules = await atlasMem.summarizeRulesForUrl(o.url);
      if (semanticRules) {
        await emitEvent(
          {
            type: "semantic_rules",
            step: t,
            url: o.url,
            rules: semanticRules,
          },
          currentLogicalStep
        );
        logDebug("Semantic rules retrieved", {
          step: t,
          url: o.url,
          rulesLength: semanticRules.length,
        });
      }

      // Nudge the Actor with context derived from last action to prevent loops (e.g., repeated picker clicks)
      let augmentedGoal = goal;
      if (
        lastAction?.description
          ?.toLowerCase()
          .includes("show local date and time picker")
      ) {
        augmentedGoal = `${goal} (date/time picker already clicked; now set Year/Month/Day/Hours/Minutes/AM-PM via segmented controls—do NOT click the picker again)`;
      }

      const stepEventCallback = onEvent
        ? (event: AtlasEvent) => emitEvent(event, currentLogicalStep)
        : undefined;

      // Ask for at least 2 so the Critic has a choice
      let C = await propose(
        augmentedGoal,
        P,
        o,
        Math.max(beamSize, 2),
        t,
        stepEventCallback,
        recentActions,
        semanticRules,
        buildInvocationOptions("actor", t)
      );
      logInfo("Candidates proposed", { step: t, candidates: C });
      if (C.length === 0) {
        logWarn("No candidates proposed, terminating loop", { step: t });
        endedReason = "no_candidates";
        await emitEvent({
          type: "done",
          finalObservation: clone(o),
          endedReason,
          cognitiveMap: M.snapshot(),
        });
        break;
      }

      // CRITIC: look-ahead via cognitive map (D=1 naive)
      const lookaheads = C.map(
        (c) => M.lookup(o, c.action) ?? M.placeholder(o, c.action)
      );
      const uncertainties = C.map((c) => M.getUncertainty(o, c.action));
      logDebug("Lookahead states prepared", {
        step: t,
        lookaheads,
        uncertainties,
      });

      const critiqueRes = await critique(
        goal,
        P,
        o,
        C,
        lookaheads,
        t,
        stepEventCallback,
        recentActions,
        uncertainties,
        semanticRules,
        buildInvocationOptions("critic", t)
      );
      if (runControl.shouldStop()) {
        endedReason = "aborted_by_user";
        logWarn("Run control requested stop after critique", { step: t });
        break;
      }
      logInfo("Critique results received", { step: t, critique: critiqueRes });

      const choiceIdx = Math.max(
        0,
        Math.min(C.length - 1, critiqueRes.chosenIndex)
      );
      let choice = C[choiceIdx];

      // If any required input has empty value, generally don't execute clicks yet—ask for a fill first.
      // EXCEPTIONS:
      // - Allow clicking the 'Show local date and time picker' button once for datetime-local workflows
      // - If the only required empty input is a datetime-local, allow proceeding without gating
      const inputs = o.affordances.filter(
        (a) => (a as any)?.fieldInfo?.tagName === "input"
      );
      const requiredEmpty = inputs.filter((a) => {
        const fi = (a as any).fieldInfo ?? {};
        const val = (a as any).currentValue ?? fi.value ?? "";
        return !!fi.required && String(val).length === 0;
      });
      // Count required empty inputs that are NOT datetime-local
      const requiredEmptyNonDatetime = inputs.filter((a) => {
        const fi = (a as any).fieldInfo ?? {};
        const val = (a as any).currentValue ?? fi.value ?? "";
        if (!(!!fi.required && String(val).length === 0)) return false;
        return (fi.type || "").toLowerCase() !== "datetime-local";
      }).length;
      const hasFillOption = o.affordances.some((a) => a.method === "fill");
      const isClick = choice.action.method === "click";
      const isPickerClick =
        isClick &&
        (choice.action.description
          ?.toLowerCase()
          .includes("show local date and time picker") ??
          false);
      const repeatedPickerClick =
        isPickerClick &&
        (lastAction?.description
          ?.toLowerCase()
          .includes("show local date and time picker") ??
          false);

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
            stepEventCallback,
            recentActions,
            semanticRules,
            buildInvocationOptions("actor", t, "retry-fill")
          );
          if (C.length === 0) {
            P = await plan(
              goal,
              o,
              stepEventCallback,
              buildInvocationOptions("planner", t, "retry"),
              t
            );
            continue;
          }
          choice = C[0];
        }
      }

      // Prevent repeated picker clicks if the last action already clicked the picker
      if (repeatedPickerClick) {
        const noRepeatGoal = `${goal} (picker already clicked; now set Year/Month/Day/Hours/Minutes/AM-PM via segmented controls—do NOT click the picker again)`;
        const newCandidates = await propose(
          noRepeatGoal,
          P,
          o,
          Math.max(beamSize, 3),
          t,
          stepEventCallback,
          recentActions,
          semanticRules,
          buildInvocationOptions("actor", t, "retry-picker")
        );
        const alt = newCandidates.find(
          (c) =>
            !(
              c.action.description
                ?.toLowerCase()
                .includes("show local date and time picker") ?? false
            )
        );
        if (alt) {
          C = newCandidates;
          choice = alt;
          logInfo(
            "Avoiding repeated picker click; selecting segment-setting candidate instead",
            { step: t, choice }
          );
        }
      }
      // ---------------------------- optional critic veto ----------------------------
      const best = critiqueRes.ranked?.[0];
      if (best && best.value < vetoThreshold) {
        C = await propose(
          `${goal} (avoid low-value actions; prefer increasing data completeness first)`,
          P,
          o,
          Math.max(beamSize, 3),
          t,
          stepEventCallback,
          recentActions,
          semanticRules,
          buildInvocationOptions("actor", t, "retry-veto")
        );
        if (C.length === 0) {
          P = await plan(
            goal,
            o,
            stepEventCallback,
            buildInvocationOptions("planner", t, "fallback"),
            t
          );
          continue;
        }
        choice = C[0];
      }
      // -------------------------------------------------------------------------------

      logInfo("Selected action", {
        step: t,
        chosenIndex: critiqueRes.chosenIndex,
        action: choice,
      });

      // Emit selected_action event
      await emitEvent(
        {
          type: "selected_action",
          step: t,
          action: clone(choice.action),
        },
        currentLogicalStep
      );

      // EXECUTE
      await web.act(choice.action);
      logInfo("Action executed", { step: t, action: choice.action });

      // Emit action_executed event
      await emitEvent(
        {
          type: "action_executed",
          step: t,
          action: clone(choice.action),
        },
        currentLogicalStep
      );

      // OBSERVE NEXT
      const oNext = await web.currentObservation();
      logDebug("Observation after action", {
        step: t,
        observation: summarizeObservation(oNext),
      });

      // Emit observation_after event
      await emitEvent(
        {
          type: "observation_after",
          step: t,
          before: clone(o),
          after: clone(oNext),
        },
        currentLogicalStep
      );

      // Remember last action for next-step steering
      lastAction = choice.action;

      // Generate rich delta summary using LLM
      const delta = await generateDelta(
        mastra.getAgent("criticAgent"),
        o,
        choice.action,
        oNext,
        buildInvocationOptions("critic", t, "delta")
      );
      M.record(o, choice.action, oNext, delta);
      logDebug("Cognitive map updated", { step: t, delta });

      // Opportunistically capture semantic rules from the DOM
      const derivedSemanticRules = deriveSemanticRulesFromObservation(oNext);
      if (derivedSemanticRules.length > 0) {
        await Promise.all(
          derivedSemanticRules.map((rule) =>
            atlasMem.writeSemanticRule(oNext.url, rule).catch(() => {})
          )
        );
        logDebug("Semantic rules derived", {
          step: t,
          count: derivedSemanticRules.length,
        });
      }

      // Add to recent actions for working memory
      recentActions.push({
        step: t,
        action: choice.action,
        outcome: delta || `${o.title} -> ${oNext.title}`,
      });

      // Keep only last 10 actions to avoid context bloat
      if (recentActions.length > 10) {
        recentActions.shift();
      }

      // Emit map_update event with full transition info
      const transition = M.getTransition(o, choice.action);
      if (transition) {
        await emitEvent(
          {
            type: "map_update",
            step: t,
            edge: clone(transition),
          },
          currentLogicalStep
        );
      }

      steps.push({
        step: t,
        logicalStep: currentLogicalStep,
        plan: clone(P),
        candidates: clone(C),
        critique: clone(critiqueRes),
        chosenIndex: critiqueRes.chosenIndex,
        action: clone(choice.action),
        observationBefore: clone(o),
        observationAfter: clone(oNext),
      });
      stepLogical.set(t, currentLogicalStep);
      nextLogicalStep = currentLogicalStep + 1;

      // Check if the flow has ended
      const analysis = await analyzeFlow(
        goal,
        oNext,
        t,
        stepEventCallback,
        buildInvocationOptions("flowAnalysis", t)
      );
      let isEnd = analysis === "end";

      if (analysis !== "start" && analysis !== "end") {
        const decision = await judge(
          goal,
          oNext,
          analysis,
          atlasMem,
          t,
          stepEventCallback,
          buildInvocationOptions("judge", t)
        );
        if (decision) {
          isEnd = true;
        }
      }

      if (isEnd) {
        logInfo("Flow end detected by analysis agent.", { step: t });
        endedReason = "flow_end_detected";
        // Capture final state for test generation
        const finalState = await web.captureFinalState();
        runArtifacts = {
          goal,
          startUrl,
          steps,
          finalObservation: clone(finalState),
          cognitiveMap: M.snapshot(),
          endedReason,
        };
        await persistCheckpoint();
        break;
      }

      // PROGRESS-AWARE REPLANNING:
      // Only treat as "no progress" if URL/title stayed the same AND the count of empty required inputs did not decrease.
      const sameUrlTitle = o.url === oNext.url && o.title === oNext.title;
      const noProgress =
        sameUrlTitle && requiredEmptyCount(oNext) >= requiredEmptyCount(o);
      if (noProgress && t % 4 === 3) {
        logInfo("Replanning triggered", { step: t, reason: "no-progress" });
        P = await plan(
          goal,
          oNext,
          stepEventCallback,
          buildInvocationOptions("planner", t, "replan"),
          t
        );
        logInfo("Plan updated", { step: t, plan: P });

        // Emit replan event
        await emitEvent(
          {
            type: "replan",
            step: t,
            reason: "no-progress",
            plan: P,
          },
          currentLogicalStep
        );
      }

      o = oNext;
      await M.ensureDomainLoaded(o.url);
      t += 1;
      runControl.setCurrentStep(t);
      await persistCheckpoint();
    }

    if (runControl.shouldStop() && endedReason !== "aborted_by_user") {
      endedReason = "aborted_by_user";
    }

    await persistCheckpoint();

    runArtifacts = {
      goal,
      startUrl,
      steps,
      finalObservation: clone(o),
      cognitiveMap: M.snapshot(),
      endedReason,
    };

    // Emit done event
    await emitEvent({
      type: "done",
      finalObservation: runArtifacts.finalObservation,
      endedReason: runArtifacts.endedReason,
      cognitiveMap: runArtifacts.cognitiveMap,
    });
  } catch (error) {
    logError("Atlas run encountered an error", { error });

    // Emit error event
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    try {
      await emitEvent({ type: "error", message: errorMessage });
    } catch (emitError) {
      logWarn("Failed to emit error event", { error: emitError });
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

async function replayStepsToCheckpoint(
  web: WebEnv,
  artifacts: AtlasStepArtifact[] | undefined
): Promise<Observation | null> {
  if (!artifacts || artifacts.length === 0) {
    return null;
  }
  let latest: Observation | null = null;
  for (const artifact of artifacts) {
    try {
      await web.act(artifact.action);
    } catch (error) {
      logWarn("Failed to replay checkpoint action", {
        step: artifact.step,
        error,
      });
      break;
    }
    latest = await web.currentObservation();
  }
  return latest;
}
