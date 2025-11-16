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
  AgentRationale,
} from "@atlas-core/core/types.js";
import type { SemanticRule } from "@atlas-core/memory/atlas-memory.js";

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
  AgentRationale,
};

export type StepData = {
  step: number;
  logicalStep?: number;
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
  rationales?: AgentRationale[];
};

export type RunState = {
  status: "idle" | "running" | "stopping" | "completed" | "error" | "paused";
  mode: "goal" | "flow-discovery";
  goal: string;
  startUrl: string;
  plan?: Plan;
  steps: StepData[];
  currentStep: number;
  cognitiveMap: Transition[];
  semanticRules: string;
  globalRationales?: AgentRationale[];
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

export type RunSummary = {
  id: string;
  name: string;
  goal: string;
  startUrl: string;
  mode: "goal" | "flow-discovery";
  env: "LOCAL" | "BROWSERBASE";
  beamSize: number;
  maxSteps: number;
  status: "running" | "stopping" | "completed" | "error" | "paused";
  createdAt: string;
  updatedAt: string;
  endedReason?: string;
  errorMessage?: string;
  currentStep?: number;
  resumedFromId?: string;
};

export type StoredRun = RunSummary & {
  events: Array<(AtlasEvent & { runId?: string }) & { timestamp: string }>;
  checkpoint?: {
    stepCount: number;
    timestamp?: string;
  };
};

export type KnowledgeEntry = {
  host: string;
  transitions: Transition[];
  semanticRules: SemanticRule[];
};
