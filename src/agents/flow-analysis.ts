import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { Observation, AtlasEventCallback } from "../core/types.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";
import { emitRationaleEvent } from "./helpers.js";

export function createFlowAnalysisAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-flow-analysis",
    model: "openai/gpt-4o",
    memory,
    instructions: [
      `You are an expert at analyzing web page content to determine its role in a user flow.
Your task is to determine if the current page state represents the 'start', 'end', or an 'intermediate' step of this flow.

- 'start': The page is the clear beginning of the flow.
- 'end': The page is the clear conclusion of the flow (e.g., a success message, a dashboard after login).
- 'intermediate': The page is a step along the way, but not the start or end.

Analyze the provided page URL, title, and a snippet of the page text.
Respond with your analysis.`,
    ],
  });
}

const AnalysisSchema = z.object({
  analysis: z
    .enum(["start", "end", "intermediate"])
    .describe(
      "Your analysis of the page's role in the flow: 'start', 'end', or 'intermediate'."
    ),
});

export async function analyze(
  agent: Agent,
  flowDescription: string,
  pageState: Observation,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<"start" | "end" | "intermediate"> {
  const { url, title, pageText } = pageState;

  const prompt = `The user is trying to explore a flow described as: "${flowDescription}".

Analyze the following page state:
- URL: ${url}
- Title: ${title}
- Page Text Snippet:
---
${pageText.slice(0, 2000)}
---`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: AnalysisSchema } },
      invocation
    )
  );

  const result = (res.object as { analysis: "start" | "end" | "intermediate" })
    ?.analysis;

  if (onEvent && step !== undefined) {
    await onEvent({
      type: "analysis",
      step,
      prompt,
      analysis: result || "intermediate",
    });
  }

  await emitRationaleEvent(
    onEvent,
    {
      agent: "flow-analysis",
      step,
      title: "Flow state analysis",
      rationale:
        res.text?.trim() ||
        JSON.stringify(res.object ?? {}, null, 2) ||
        "Flow analysis agent returned no rationale.",
      prompt,
      output: JSON.stringify(res.object ?? {}, null, 2),
    },
    step
  );

  return result || "intermediate";
}
