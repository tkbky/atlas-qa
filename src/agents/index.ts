import "dotenv/config";
import { createPlannerAgent, plan as planFn } from "./planner.js";
import { createActorAgent, propose as proposeFn } from "./actor.js";
import { createCriticAgent, critique as critiqueFn } from "./critic.js";

// Import the shared Mastra instance from mastra/index.ts
// This ensures we use the same instance with observability properly configured
import { mastra, memory } from "../mastra/index.js";

/**
 * Mastra Agents with Observability:
 * - Uses the shared Mastra instance from mastra/index.ts
 * - Agents are registered with Mastra for proper tracing
 * - Memory: working memory + history; configure storage via LibSQLStore
 * - Observability: AI tracing + OTEL tracing enabled via Mastra instance
 * Reference: https://mastra.ai/docs/observability/overview
 */

// Get agent instances from the shared Mastra instance
export const plannerAgent = mastra.getAgent("plannerAgent");
export const actorAgent = mastra.getAgent("actorAgent");
export const criticAgent = mastra.getAgent("criticAgent");

// Re-export mastra and memory for backward compatibility
export { mastra, memory };

// Export agent functions with agents bound
export function plan(goal: string, o0: any, onEvent?: any) {
  return planFn(plannerAgent, goal, o0, onEvent);
}

export function propose(goal: string, P: any, o: any, N = 3, step?: number, onEvent?: any, recentActions: any[] = []) {
  return proposeFn(actorAgent, goal, P, o, N, step, onEvent, recentActions);
}

export function critique(goal: string, P: any, o: any, candidates: any[], lookaheads: any[], step?: number, onEvent?: any, recentActions: any[] = [], uncertainties?: number[]) {
  return critiqueFn(criticAgent, goal, P, o, candidates, lookaheads, step, onEvent, recentActions, uncertainties);
}

// Re-export helper functions
export { isFormControl, getMethodForElement, generateDelta } from "./helpers.js";
