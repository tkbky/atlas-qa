// Re-export types from core for UI use
import type {
  Observation,
  Plan,
  Candidate,
  Critique,
  Transition,
  Affordance,
  AtlasEvent,
  InputState,
} from "@atlas-core/types.js";

export type {
  Observation,
  Plan,
  Candidate,
  Critique,
  Transition,
  Affordance,
  AtlasEvent,
  InputState,
};

export type StepData = {
  step: number;
  plan: Plan;
  inputState?: InputState;
  candidates?: Candidate[];
  critique?: Critique;
  selectedAction?: Affordance;
  observationBefore?: Observation;
  observationAfter?: Observation;
  edge?: Transition;
  semanticRules?: string;
};

export type RunState = {
  status: "idle" | "running" | "completed" | "error";
  goal: string;
  startUrl: string;
  plan?: Plan;
  steps: StepData[];
  currentStep: number;
  cognitiveMap: Transition[];
  semanticRules: string;
  errorMessage?: string;
};
