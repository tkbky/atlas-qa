import "dotenv/config";
import { plan as planFn } from "./planner.js";
import { propose as proposeFn } from "./actor.js";
import { critique as critiqueFn } from "./critic.js";
import { analyze as analyzeFn } from "./flow-analysis.js";
import { decide as decideFn } from "./judge.js";
import { generate as generateFn } from "./test-generation.js";
import type {
  Observation,
  Plan,
  Candidate,
  Critique,
  AtlasEventCallback,
  RecentAction,
  Affordance,
} from "../core/types.js";
import { AtlasMemory } from "../memory/atlas-memory.js";
import type { AgentInvocationOptions } from "./invocation.js";

// Import the shared Mastra instance from mastra/index.ts
// This ensures we use the same instance with observability properly configured
import { mastra, memory } from "../mastra/index.js";

/**
 * Mastra Agents with Observability:
 * - Uses the shared Mastra instance from mastra/index.ts
 * - All agents are registered with Mastra for proper tracing
 * - Agent calls use mastra.getAgent() to enable observability
 * - Memory: working memory + history; configure storage via LibSQLStore
 * - Observability: AI tracing + OTEL tracing enabled via Mastra instance
 * Reference: https://mastra.ai/docs/observability/overview
 */

// Re-export mastra and memory
export { mastra, memory };
export type { AgentInvocationOptions } from "./invocation.js";

// Export agent functions using mastra.getAgent() for observability
export function plan(
  goal: string,
  o0: Observation,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions,
  step?: number
): Promise<Plan> {
  const agent = mastra.getAgent("plannerAgent");
  return planFn(agent, goal, o0, onEvent, invocation, step);
}

export function propose(
  goal: string,
  P: Plan,
  o: Observation,
  N = 3,
  step?: number,
  onEvent?: AtlasEventCallback,
  recentActions: RecentAction[] = [],
  invocation?: AgentInvocationOptions
): Promise<Candidate[]> {
  const agent = mastra.getAgent("actorAgent");
  return proposeFn(
    agent,
    goal,
    P,
    o,
    N,
    step,
    onEvent,
    recentActions,
    invocation
  );
}

export function critique(
  goal: string,
  P: Plan,
  o: Observation,
  candidates: Candidate[],
  lookaheads: (Observation | null)[],
  step?: number,
  onEvent?: AtlasEventCallback,
  recentActions: RecentAction[] = [],
  uncertainties?: number[],
  invocation?: AgentInvocationOptions
): Promise<Critique> {
  const agent = mastra.getAgent("criticAgent");
  return critiqueFn(
    agent,
    goal,
    P,
    o,
    candidates,
    lookaheads,
    step,
    onEvent,
    recentActions,
    uncertainties,
    invocation
  );
}

export function analyzeFlow(
  flowDescription: string,
  pageState: Observation,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<"start" | "end" | "intermediate"> {
  const agent = mastra.getAgent("flowAnalysisAgent");
  return analyzeFn(
    agent,
    flowDescription,
    pageState,
    step,
    onEvent,
    invocation
  );
}

export function judge(
  flowDescription: string,
  pageState: Observation,
  analysis: "start" | "end" | "intermediate",
  atlasMemory: AtlasMemory,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<boolean> {
  const agent = mastra.getAgent("judgeAgent");
  return decideFn(
    agent,
    flowDescription,
    pageState,
    analysis,
    atlasMemory,
    step,
    onEvent,
    invocation
  );
}

export function generateTest(
  flowDescription: string,
  actions: Affordance[],
  finalState: Observation,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<string> {
  const agent = mastra.getAgent("testGenerationAgent");
  return generateFn(
    agent,
    flowDescription,
    actions,
    finalState,
    step,
    onEvent,
    invocation
  );
}

// Re-export helper functions
export {
  isFormControl,
  getMethodForElement,
  generateDelta,
} from "./helpers.js";
