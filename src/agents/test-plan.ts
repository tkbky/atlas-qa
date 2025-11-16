import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { HostSnapshot, TestPlanSuggestion } from "../test-lab/types.js";

const SuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string().describe("Stable identifier for this flow").optional(),
        rank: z.number().int().min(1).describe("Priority (1 = highest)").optional(),
        title: z.string().describe("Short, descriptive name"),
        goal: z.string().describe("Single sentence describing what the user achieves"),
        description: z.string().describe("Why this flow matters / business value"),
        preconditions: z.string().describe("Setup required before starting the test").optional(),
        steps: z
          .array(z.string().describe("User-facing action in order"))
          .min(3)
          .describe("Ordered list of actions (>=3)"),
        expectedResults: z
          .array(z.string().describe("Assertion that proves success"))
          .min(2)
          .describe("Assertions verifying the flow"),
        playwrightHints: z
          .array(z.string().describe("Selector/timing guidance for Playwright"))
          .optional(),
        valueScore: z
          .number()
          .min(0)
          .max(1)
          .describe("Relative impact score 0-1")
          .optional(),
        prerequisites: z
          .array(z.string().describe("External dependency (feature flag, backend, etc.)"))
          .optional(),
        tags: z.array(z.string().describe("Keywords like auth, checkout")).optional(),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Confidence the flow will pass")
          .optional(),
      })
    )
    .min(1)
    .max(5),
});


const summarizeSemanticRules = (snapshot: HostSnapshot) => {
  if (snapshot.semanticRules.length === 0) {
    return "No semantic rules captured yet.";
  }
  const bullets = snapshot.semanticRules.slice(0, 6).map((rule) => {
    const scope = rule.fieldSig?.label || rule.fieldSig?.name || rule.kind;
    const location = rule.firstSeenAt ? ` @ ${rule.firstSeenAt}` : "";
    return `- ${rule.kind}: ${rule.note ?? ""}${location ? location : ""}`.trim();
  });
  return bullets.join("\n");
};

const summarizeTransitions = (snapshot: HostSnapshot) => {
  if (snapshot.transitions.length === 0) {
    return "No cognitive map edges stored yet.";
  }
  return snapshot.transitions
    .slice(0, 6)
    .map((edge) => {
      const action = edge.delta || edge.actionKey;
      const destination = edge.to?.title || edge.to?.url || "unknown";
      return `- ${action} -> ${destination}`;
    })
    .join("\n");
};

export function createTestPlanAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-test-plan",
    model: "openai/gpt-5-mini",
    memory,
    instructions: [
      "You are a QA strategist that recommends high-value end-to-end Playwright tests.",
      "Use the provided knowledge snapshot (cognitive map edges + semantic rules) to reason about which flows matter most for the given host.",
      "Prefer actionable flows such as sign-up, sign-in, checkout, booking, or domain-specific journeys.",
      "Return concise, value-ranked test ideas with clear user-facing goal statements.",
    ],
  });
}

type SuggestionInput = {
  host: string;
  url?: string;
  snapshot: HostSnapshot;
  userPrompt?: string;
};

export async function suggestTestPlans(
  agent: Agent,
  input: SuggestionInput
): Promise<{
  suggestions: TestPlanSuggestion[];
  prompt: string;
  rawOutput: string;
}> {
  const { host, url, snapshot, userPrompt } = input;
  const semanticSummary = summarizeSemanticRules(snapshot);
  const transitionSummary = summarizeTransitions(snapshot);
  const prompt = `Host: ${host}
Focus URL: ${url ?? "(any relevant page)"}
User request: ${userPrompt ?? "suggest impactful regression tests"}

Semantic rules:
${semanticSummary}

Cognitive map samples:
${transitionSummary}

Return 3-5 high-value Playwright test ideas, each with at least 3 ordered steps and 2 expected results, plus Playwright hints where helpful. Be concise and leverage the knowledge above.`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    {
      structuredOutput: {
        schema: SuggestionSchema,
        jsonPromptInjection: true,
      },
    }
  );

  const parsed = SuggestionSchema.safeParse(res.object);
  const rawOutput = res.text?.trim() || JSON.stringify(res.object ?? {}, null, 2);
  if (!parsed.success) {
    const fallback: TestPlanSuggestion = {
      title: `Explore ${host}`,
      goal: `Explore critical flows on ${host}`,
      description: userPrompt ?? "Explore the primary conversion flow.",
      valueScore: 0.5,
    };
    return { suggestions: [fallback], prompt, rawOutput };
  }
  return {
    suggestions: parsed.data.suggestions as TestPlanSuggestion[],
    prompt,
    rawOutput,
  };
}
