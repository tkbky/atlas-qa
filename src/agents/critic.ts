import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type {
  Observation,
  Plan,
  Candidate,
  Critique,
  AtlasEventCallback,
  RecentAction,
} from "../core/types.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";
import { emitRationaleEvent } from "./helpers.js";

export function createCriticAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-critic",
    model: "openai/gpt-4.1",
    memory,
    instructions: [
      "You are the Critic agent. Evaluate candidate actions for goal alignment and recoverability.",
      "Score each candidate in [-1, 1]. Prefer actions that make progress toward the goal.",
      "Avoid repeating actions already completed (check Recent Actions).",
      "Set goalMet=true when the goal is fully achieved based on observation and recent actions.",
      "Provide goalMetReason explaining what confirms goal completion (reference Recent Actions if applicable).",
    ],
  });
}

const CritiqueSchema = z.object({
  goalMet: z
    .boolean()
    .describe(
      "True if all plan subgoals are satisfied and the goal is fully achieved"
    ),
  goalMetReason: z
    .string()
    .describe(
      "Explanation of why the goal is met if goalMet is true, or empty string if goalMet is false"
    ),
  chosenIndex: z.number(),
  ranked: z.array(
    z.object({ index: z.number(), value: z.number(), reason: z.string() })
  ),
});

export async function critique(
  agent: Agent,
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
  const recentActionsText =
    recentActions.length > 0
      ? recentActions
          .slice(-5)
          .map((ra) => `${ra.step}. ${ra.action.description} → ${ra.outcome}`)
          .join("\n")
      : "None yet";

  const candidatesText = candidates
    .map((c, i) => `${i}. ${c.action.description}`)
    .join("\n");

  // Include uncertainty information in lookahead text
  const lookaheadsText = lookaheads
    .map((h, i) => {
      const unc = uncertainties?.[i];
      const confidence = unc !== undefined ? Math.round((1 - unc) * 100) : "?";
      return `${i}. → ${h ? `${h.title} @ ${h.url}` : "unknown"} [confidence: ${confidence}%]`;
    })
    .join("\n");

  const prompt = `Goal: ${goal}
Plan: ${P.subgoals.map((s) => s.text).join(" → ")}

Current Page: ${o.title} @ ${o.url}

Recent Actions:
${recentActionsText}

Candidates:
${candidatesText}

Lookahead (predicted next states):
${lookaheadsText}

Available Affordances: ${o.affordances.length} interactive elements

Note: Confidence indicates how certain we are about the predicted next state based on past observations.
- High confidence (>80%): Action has been observed multiple times
- Low confidence (<50%): Action is uncertain or hasn't been tried before

Score each candidate [-1, 1] for goal alignment.
Consider both goal progress AND prediction confidence.
Slightly prefer actions with higher confidence if they're equally good for the goal.
Set goalMet=true if the goal is fully achieved based on recent actions and current observation.`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: CritiqueSchema } },
      invocation
    )
  );

  const critique = (res.object as Critique) ?? {
    goalMet: false,
    goalMetReason: "",
    chosenIndex: 0,
    ranked: [],
  };

  if (onEvent && step !== undefined) {
    await onEvent({ type: "critique", step, prompt, critique });
  }

  await emitRationaleEvent(
    onEvent,
    {
      agent: "critic",
      step,
      title: "Critic evaluation",
      rationale:
        res.text?.trim() ||
        JSON.stringify(critique, null, 2) ||
        "Critic did not provide an explanation.",
      prompt,
      output: JSON.stringify(critique, null, 2),
      relatedAction:
        candidates[critique.chosenIndex]?.action.description ?? undefined,
    },
    step
  );

  return critique;
}
