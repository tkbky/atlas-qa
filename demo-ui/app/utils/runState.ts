import type { AtlasEvent, Plan, RunState, StepData } from "../types";

const EMPTY_PLAN: Plan = { subgoals: [] };

const baseState: RunState = {
  status: "idle",
  mode: "goal",
  goal: "",
  startUrl: "",
  steps: [],
  currentStep: -1,
  cognitiveMap: [],
  semanticRules: "",
  flowAnalysis: {
    currentState: null,
    judgeDecisions: [],
  },
};

export function createInitialRunState(partial: Partial<RunState> = {}): RunState {
  const flowAnalysis = partial.flowAnalysis ?? baseState.flowAnalysis;
  return {
    ...baseState,
    ...partial,
    steps: partial.steps ?? [],
    cognitiveMap: partial.cognitiveMap ?? [],
    flowAnalysis: {
      currentState: flowAnalysis?.currentState ?? null,
      judgeDecisions: flowAnalysis?.judgeDecisions ?? [],
    },
  };
}

const planForStep = (state: RunState, fallback?: Plan) => state.plan ?? fallback ?? EMPTY_PLAN;

const upsertStep = (
  steps: StepData[],
  step: number,
  partial: Partial<StepData>,
  state: RunState
): StepData[] => {
  const idx = steps.findIndex((s) => s.step === step);
  if (idx >= 0) {
    const updated = { ...steps[idx], ...partial } as StepData;
    const next = [...steps];
    next[idx] = updated;
    return next;
  }
  const nextStep: StepData = {
    step,
    plan: planForStep(state),
    ...partial,
  } as StepData;
  return [...steps, nextStep].sort((a, b) => a.step - b.step);
};

export function applyEventToRunState(state: RunState, event: AtlasEvent): RunState {
  switch (event.type) {
    case "init":
      return {
        ...state,
        status: "running",
        goal: event.goal,
        startUrl: event.startUrl,
      };
    case "plan":
      return {
        ...state,
        plan: event.plan,
        steps: state.steps.map((s) => ({ ...s, plan: event.plan })),
      };
    case "semantic_rules":
      return {
        ...state,
        semanticRules: event.rules || state.semanticRules,
        steps: upsertStep(
          state.steps,
          event.step,
          { semanticRules: event.rules, logicalStep: event.logicalStep },
          state
        ),
      };
    case "propose":
      return {
        ...state,
        currentStep: event.step,
        steps: upsertStep(
          state.steps,
          event.step,
          {
            logicalStep: event.logicalStep,
            candidates: event.candidates,
            inputState: event.inputState,
          },
          state
        ),
      };
    case "critique":
      return {
        ...state,
        steps: upsertStep(
          state.steps,
          event.step,
          { critique: event.critique, logicalStep: event.logicalStep },
          state
        ),
      };
    case "selected_action":
      return {
        ...state,
        steps: upsertStep(
          state.steps,
          event.step,
          { selectedAction: event.action, logicalStep: event.logicalStep },
          state
        ),
      };
    case "observation_after":
      return {
        ...state,
        steps: upsertStep(
          state.steps,
          event.step,
          {
            logicalStep: event.logicalStep,
            observationBefore: event.before,
            observationAfter: event.after,
          },
          state
        ),
      };
    case "map_update":
      return {
        ...state,
        cognitiveMap: [...state.cognitiveMap, event.edge],
        steps: upsertStep(
          state.steps,
          event.step,
          { edge: event.edge, logicalStep: event.logicalStep },
          state
        ),
      };
    case "replan":
      return {
        ...state,
        plan: event.plan,
        steps: state.steps.map((s) => ({ ...s, plan: event.plan })),
      };
    case "analysis":
      return {
        ...state,
        flowAnalysis: {
          ...state.flowAnalysis!,
          currentState: event.analysis,
        },
        steps: upsertStep(
          state.steps,
          event.step,
          { flowAnalysis: event.analysis, logicalStep: event.logicalStep },
          state
        ),
      };
    case "judgement":
      return {
        ...state,
        flowAnalysis: {
          ...state.flowAnalysis!,
          judgeDecisions: [
            ...state.flowAnalysis!.judgeDecisions,
            {
              step: event.step,
              analysis: state.flowAnalysis!.currentState || "intermediate",
              decision: event.decision,
              prompt: event.prompt,
            },
          ],
        },
        steps: upsertStep(
          state.steps,
          event.step,
          { judgeDecision: event.decision, logicalStep: event.logicalStep },
          state
        ),
      };
    case "test_generation":
      return {
        ...state,
        generatedTest: event.generatedCode,
        steps: upsertStep(
          state.steps,
          event.step,
          { generatedTest: event.generatedCode, logicalStep: event.logicalStep },
          state
        ),
      };
    case "done":
      return {
        ...state,
        status: "completed",
        cognitiveMap: event.cognitiveMap,
        endedReason: event.endedReason,
      };
    case "error":
      return {
        ...state,
        status: "error",
        errorMessage: event.message,
      };
    default:
      return state;
  }
}
