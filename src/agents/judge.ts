import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { Observation, AtlasEventCallback } from "../core/types.js";
import { AtlasMemory } from "../memory/atlas-memory.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";

export function createJudgeAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-judge",
    model: "openai/gpt-4o",
    memory,
    instructions: [
      `You are a "judge" agent. Your role is to determine if a flow has reached its natural conclusion.
You will be given a page state and the flow analysis (start/intermediate/end).

Your task is to decide: Should the exploration end here?

- Respond with 'true' if the flow should END (e.g., reached a success page, cart page, confirmation page).
- Respond with 'false' if the flow should CONTINUE (e.g., still browsing, on listing pages, haven't completed the goal).

Base your decision on the provided page URL, title, and text snippet.
Respond with only 'true' or 'false'.`,
    ],
  });
}

const DecisionSchema = z.object({
  decision: z
    .boolean()
    .describe(
      "Your decision on whether the analysis is correct: 'true' or 'false'."
    ),
});

export async function decide(
  agent: Agent,
  flowDescription: string,
  pageState: Observation,
  analysis: "start" | "end" | "intermediate",
  atlasMemory: AtlasMemory,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<boolean> {
  const { url, title, pageText } = pageState;

  // First, check memory for a human-in-the-loop correction
  const storedDecision = await atlasMemory.getJudgeDecision(
    flowDescription,
    url,
    analysis
  );
  if (storedDecision !== null) {
    return storedDecision;
  }

  const prompt = `Context: The user is trying to: "${flowDescription}".

The flow analysis agent determined this page is an '${analysis}' step.

Should the exploration END here, or should it CONTINUE?

Page details:
- URL: ${url}
- Title: ${title}
- Page Text Snippet:
---
${pageText.slice(0, 2000)}
---

Respond with 'true' to END exploration (goal achieved), or 'false' to CONTINUE exploring.`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: DecisionSchema } },
      invocation
    )
  );

  const result = (res.object as { decision: boolean })?.decision ?? false;

  // Store the decision for future reference (and potential human correction)
  await atlasMemory.recordJudgeDecision(flowDescription, url, analysis, result);

  const decisionObject = {
    shouldEnd: result,
    isCorrect: result,
    explanation: undefined, // Can be extended later
    correctState: undefined, // Can be set by HITL
  };

  if (onEvent && step !== undefined) {
    await onEvent({
      type: "judgement",
      step,
      prompt,
      decision: decisionObject,
    });
  }

  return result;
}
