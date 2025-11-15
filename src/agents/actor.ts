import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type {
  Observation,
  Plan,
  Candidate,
  AtlasEventCallback,
  InputState,
  RecentAction,
} from "../core/types.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";

export function createActorAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-actor",
    model: "openai/gpt-4.1",
    memory,
    instructions: [
      "You are the Actor agent. Propose up to N safe next actions based on the plan and visible affordances.",
      "Only propose actions for elements that are visible and not yet completed.",
      "Review Recent Actions to avoid repeating the same action.",
      "Method selection: use 'fill' for inputs/textareas, 'selectOption' for selects, 'click' for buttons/checkboxes/radios.",
      "Always include: description, selector, method, arguments, instruction (use null if not applicable).",
    ],
  });
}

const ActionSchema = z.object({
  description: z.string(),
  selector: z.string().nullable(),
  method: z.string().nullable(),
  arguments: z.array(z.string()).nullable(),
  instruction: z.string().nullable(),
});

const CandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        rationale: z.string(),
        action: ActionSchema,
      })
    )
    .min(1)
    .max(5),
});

/**
 * Simple helper to extract basic input state for debugging/UI display.
 * Just counts filled/empty inputs without complex preprocessing.
 */
function getInputState(
  o: Observation,
  recentActions: RecentAction[]
): InputState {
  const inputs = o.affordances.filter((a) => {
    const fi = (a as any).fieldInfo;
    return fi && ["input", "select", "textarea"].includes(fi.tagName);
  });

  const filled = inputs.filter((a) => {
    const val = (a as any).currentValue ?? (a as any).fieldInfo?.value ?? "";
    return String(val).length > 0;
  });

  const empty = inputs.filter((a) => {
    const val = (a as any).currentValue ?? (a as any).fieldInfo?.value ?? "";
    return String(val).length === 0;
  });

  const requiredEmpty = empty.filter(
    (a) => (a as any).fieldInfo?.required
  ).length;

  return {
    filledInputs: filled
      .map((a) => `• ${(a as any).description || "input"}`)
      .join("\n"),
    emptyInputs: empty
      .map((a) => `• ${(a as any).description || "input"}`)
      .join("\n"),
    requiredEmpty,
    recentActions: recentActions.slice(-5),
  };
}

export async function propose(
  agent: Agent,
  goal: string,
  P: Plan,
  o: Observation,
  N = 3,
  step?: number,
  onEvent?: AtlasEventCallback,
  recentActions: RecentAction[] = [],
  invocation?: AgentInvocationOptions
): Promise<Candidate[]> {
  const affordancesText = o.affordances
    .map((a) => `- ${(a as any).description || "element"}`)
    .join("\n");

  const recentActionsText =
    recentActions.length > 0
      ? recentActions
          .slice(-5)
          .map((ra) => `${ra.step}. ${ra.action.description} → ${ra.outcome}`)
          .join("\n")
      : "None yet";

  // Special handling when no affordances are available
  let specialGuidance = "";
  if (o.affordances.length === 0) {
    specialGuidance = `\n\nIMPORTANT: No interactive elements are currently visible. This could mean:
1. The page is still loading - propose "Scroll down the page." as instruction to reveal content
2. The page may have dynamic content - propose "Scroll down the page." to trigger lazy loading
3. You may need to go back - check if the previous action was incorrect

For actions with no visible elements, use the instruction field (set selector and method to null):
- To scroll: { "instruction": "Scroll down the page.", "selector": null, "method": null }
- To refresh: { "instruction": "Refresh the page.", "selector": null, "method": null }`;
  }

  const prompt = `Goal: ${goal}

Plan:
${P.subgoals.map((s) => `• ${s.text}`).join("\n")}

Current Page: ${o.title} @ ${o.url}

Recent Actions:
${recentActionsText}

Available Affordances:
${affordancesText || "(No interactive elements detected)"}${specialGuidance}

Propose ${N} next actions that make progress toward the goal. Avoid repeating recent actions.`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: CandidatesSchema } },
      invocation
    )
  );

  const C = (res.object as { candidates: Candidate[] })?.candidates ?? [];

  if (onEvent && step !== undefined) {
    const inputState = getInputState(o, recentActions);
    await onEvent({ type: "propose", step, prompt, candidates: C, inputState });
  }

  return C.slice(0, N);
}
