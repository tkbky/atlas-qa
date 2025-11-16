import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type {
  HostSnapshot,
  TestGenerationResult,
  ActionHint,
} from "../test-lab/types.js";

const GenerationSchema = z.object({
  code: z.string().describe("Full Playwright test code including imports"),
  assumptions: z
    .array(z.string().describe("Assumptions about selectors/data"))
    .default([])
    .describe("Notes explaining guessed elements or required fixtures"),
  usedRules: z
    .array(z.string().describe("Semantic rule or domain constraint applied"))
    .default([])
    .describe("List of knowledge-store rules referenced"),
  notes: z
    .string()
    .default("")
    .describe("Brief summary or TODOs for the generated test"),
});


const describeSnapshot = (snapshot: HostSnapshot) => {
  const semanticLines = snapshot.semanticRules.length
    ? snapshot.semanticRules
        .slice(0, 10)
        .map((rule) => {
          const target = rule.fieldSig?.label || rule.fieldSig?.name || "field";
          const note = rule.note ? ` - ${rule.note}` : "";
          return `- ${rule.kind} on ${target}${note}`;
        })
        .join("\n")
    : "(no semantic rules recorded)";
  const transitionLines = snapshot.transitions.length
    ? snapshot.transitions
        .slice(0, 10)
        .map((edge) => {
          const toTitle = edge.to?.title || edge.to?.url || "next state";
          return `- ${edge.delta ?? edge.actionKey} => ${toTitle}`;
        })
        .join("\n")
    : "(no cognitive map edges available)";
  return { semanticLines, transitionLines };
};

export function createTestLabGeneratorAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-test-lab-generator",
    model: "openai/gpt-5-mini",
    memory,
    instructions: [
      "You write Playwright test files grounded in previously observed knowledge (semantic rules + cognitive map).",
      "When no structured knowledge exists, clearly state the assumption and still produce best-effort code.",
      "Emit selectors using aria roles or text expectations when DOM structure is unknown.",
      "Always return TypeScript Playwright syntax inside a `test.describe` block.",
    ],
  });
}

type GenerationInput = {
  host: string;
  goal: string;
  snapshot: HostSnapshot;
  userPrompt?: string;
  actionCatalog?: ActionHint[];
};

export async function generateTestFromSnapshot(
  agent: Agent,
  input: GenerationInput
): Promise<TestGenerationResult> {
  const { host, goal, snapshot, userPrompt, actionCatalog = [] } = input;
  const { semanticLines, transitionLines } = describeSnapshot(snapshot);
  const actionLines = actionCatalog.length
    ? actionCatalog
        .slice(0, 10)
        .map((action, idx) => {
          const args = action.arguments?.length ? ` args=${action.arguments.join(",")}` : "";
          return `${idx + 1}. ${action.method} ${action.selector ?? action.description ?? "(no selector)"}${args}`;
        })
        .join("\n")
    : "(no direct actions captured yet)";
  const prompt = `Host: ${host}
Goal: ${goal}
User instructions: ${userPrompt ?? "Use the stored knowledge to draft a test."}

Semantic rules:
${semanticLines}

Cognitive map edges:
${transitionLines}

 Known actions:
 ${actionLines}

Generate a Playwright test file that exercises the goal using the hints above. Use reliable selectors, wait for navigation appropriately, and describe any assumptions about missing data. Summarize coverage in the notes.`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    {
      structuredOutput: {
        schema: GenerationSchema,
        jsonPromptInjection: true,
      },
    }
  );

  const parsed = GenerationSchema.safeParse(res.object);
  const defaultResult: TestGenerationResult = {
    host,
    goal,
    code: `// Unable to format response. Proposed goal: ${goal}`,
    assumptions: [res.text?.trim() || "LLM response missing or invalid."],
    usedRules: [],
    notes: "",
    prompt,
    rawOutput: res.text?.trim(),
    actionCatalog,
  };
  if (!parsed.success) {
    return defaultResult;
  }
  return {
    host,
    goal,
    code: parsed.data.code,
    assumptions: parsed.data.assumptions ?? [],
    usedRules: parsed.data.usedRules ?? [],
    notes: parsed.data.notes,
    prompt,
    rawOutput: res.text?.trim() || JSON.stringify(res.object ?? {}, null, 2),
    actionCatalog,
  } satisfies TestGenerationResult;
}
