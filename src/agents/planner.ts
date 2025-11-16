import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { Observation, Plan, AtlasEventCallback } from "../core/types.js";
import { logInfo } from "../utils/logger.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";
import { emitRationaleEvent } from "./helpers.js";

export function createPlannerAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-planner",
    model: "openai/gpt-4.1",
    memory,
    instructions: [
      "You are the Planner in an actor–critic web agent.",
      "Decompose the goal into concise subgoals with explicit success predicates.",
      "Prefer UI-anchored steps (e.g., 'Reports → Sales → Set dates → Read table').",
      "If the goal mentions specific credentials or field values, include subgoals to enter each value before attempting submission.",
    ],
  });
}

const PlanSchema = z.object({
  subgoals: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      successPredicate: z.string(),
    })
  ),
});

export async function plan(
  agent: Agent,
  goal: string,
  o0: Observation,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions,
  step?: number
): Promise<Plan> {
  logInfo("Planner agent invoked", { goal, url: o0.url, title: o0.title });
  const userPrompt = `Goal: ${goal}\nStart: ${o0.url} | ${o0.title}`;
  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: PlanSchema } },
      invocation
    )
  );
  const planResult = (res.object as Plan) ?? { subgoals: [] };
  logInfo("Planner agent response received", { plan: planResult });

  // Emit plan event
  if (onEvent) {
    await onEvent({ type: "plan", plan: planResult });
  }

  await emitRationaleEvent(onEvent, {
    agent: "planner",
    step,
    title: step !== undefined ? "Plan update" : "Initial plan",
    rationale:
      res.text?.trim() || JSON.stringify(planResult, null, 2) || "(no rationale)",
    prompt: userPrompt,
    output: JSON.stringify(planResult, null, 2),
  }, step);

  return planResult;
}
