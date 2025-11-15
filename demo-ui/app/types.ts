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
  RecentAction,
} from "@atlas-core/core/types.js";

export type {
  Observation,
  Plan,
  Candidate,
  Critique,
  Transition,
  Affordance,
  AtlasEvent,
  InputState,
  RecentAction,
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
  flowAnalysis?: "start" | "end" | "intermediate";
  judgeDecision?: {
    isCorrect: boolean;
    explanation?: string;
    correctState?: "start" | "end" | "intermediate";
  };
  generatedTest?: string;
};

export type RunState = {
  status: "idle" | "running" | "completed" | "error";
  mode: "goal" | "flow-discovery";
  goal: string;
  startUrl: string;
  plan?: Plan;
  steps: StepData[];
  currentStep: number;
  cognitiveMap: Transition[];
  semanticRules: string;
  errorMessage?: string;
  endedReason?: string;
  flowAnalysis?: {
    currentState: "start" | "end" | "intermediate" | null;
    judgeDecisions: Array<{
      step: number;
      analysis: "start" | "end" | "intermediate";
      decision: {
        isCorrect: boolean;
        explanation?: string;
        correctState?: "start" | "end" | "intermediate";
      };
      prompt: string;
    }>;
  };
  generatedTest?: string;
};
