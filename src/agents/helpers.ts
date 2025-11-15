import type { Observation, Affordance } from "../core/types.js";
import type { Agent } from "@mastra/core/agent";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";

/**
 * Helper to identify form control elements.
 * Includes all HTML form controls that can hold values: input, select, textarea.
 */
export function isFormControl(affordance: any): boolean {
  const tagName = affordance?.fieldInfo?.tagName;
  return ["input", "select", "textarea"].includes(tagName);
}

/**
 * Determine the correct interaction method based on element type.
 */
export function getMethodForElement(affordance: any): string {
  const fi = affordance?.fieldInfo ?? {};
  const tagName = fi.tagName;
  const type = fi.type;

  if (tagName === "select") {
    return "selectOption";
  }

  if (tagName === "input" && (type === "checkbox" || type === "radio")) {
    return "click";
  }

  if (tagName === "input" || tagName === "textarea") {
    return "fill";
  }

  return "click";
}

/**
 * Generate a concise, LLM-curated delta summary for cognitive map transitions.
 * Emphasizes:
 * - Key differences between observations
 * - Newly available/removed affordances
 * - State changes that matter for planning
 */
export async function generateDelta(
  agent: Agent,
  before: Observation,
  action: Affordance,
  after: Observation,
  invocation?: AgentInvocationOptions
): Promise<string> {
  // Fast path for same URL and similar affordances
  if (before.url === after.url && before.title === after.title) {
    const beforeAffs = before.affordances.map((a) => a.description).join(", ");
    const afterAffs = after.affordances.map((a) => a.description).join(", ");
    if (beforeAffs === afterAffs) {
      return `Same state after ${action.description}`;
    }
  }

  const prompt = `You are analyzing a web navigation transition for an autonomous agent's cognitive map.

**BEFORE state:**
- URL: ${before.url}
- Title: ${before.title}
- Available actions (${before.affordances.length}): ${before.affordances
    .slice(0, 5)
    .map((a) => a.description)
    .join(", ")}${before.affordances.length > 5 ? "..." : ""}

**ACTION taken:** ${action.description}

**AFTER state:**
- URL: ${after.url}
- Title: ${after.title}
- Available actions (${after.affordances.length}): ${after.affordances
    .slice(0, 5)
    .map((a) => a.description)
    .join(", ")}${after.affordances.length > 5 ? "..." : ""}

Generate a CONCISE summary (1-2 sentences max) emphasizing:
1. What changed (URL, title, page content)
2. Key NEW actions that became available
3. Key actions that DISAPPEARED
4. Any notable state transitions (e.g., form submitted, modal opened, error shown)

Be specific and action-oriented. This will help the agent predict future states.`;

  try {
    const result = await agent.generate(
      prompt,
      withAgentInvocationOptions({}, invocation)
    );
    return (
      result.text?.trim() ||
      `${before.title} -> ${after.title} via ${action.description}`
    );
  } catch {
    // Fallback to simple delta
    return `${before.title} -> ${after.title} via ${action.description}`;
  }
}
