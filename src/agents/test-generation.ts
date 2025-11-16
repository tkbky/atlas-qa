import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { AtlasEventCallback, Affordance } from "../core/types.js";
import type { AgentInvocationOptions } from "./invocation.js";
import { withAgentInvocationOptions } from "./invocation.js";
import { emitRationaleEvent } from "./helpers.js";

export function createTestGenerationAgent(memory: Memory): Agent {
  return new Agent({
    name: "atlas-test-generation",
    model: "openai/gpt-4o",
    memory,
    instructions: [
      "You are a Playwright test generation expert.",
      "You will be given a flow description, a sequence of actions, and the final state of the page.",
      "Your task is to generate a valid Playwright test file that replicates the flow and asserts the final state.",
      "Use `page.locator()` for actions and assertions.",
      "Format the code beautifully.",
    ],
  });
}

const TestCodeSchema = z.object({
  testCode: z.string().describe("The generated Playwright test code."),
});

export async function generate(
  agent: Agent,
  flowDescription: string,
  actions: Affordance[],
  finalState: any,
  step?: number,
  onEvent?: AtlasEventCallback,
  invocation?: AgentInvocationOptions
): Promise<string> {
  const actionSteps = actions
    .map((action) => {
      switch (action.method) {
        case "goto":
          return `await page.goto('${action.arguments?.[0]}');`;
        case "click":
          return `await page.locator('${action.selector}').click();`;
        case "fill":
          return `await page.locator('${action.selector}').fill('${action.arguments?.[0]}');`;
        default:
          return `// Unsupported action: ${action.method}`;
      }
    })
    .join("\n    ");

  const assertion = `await expect(page.locator('body')).toContainText('${
    finalState.title || ""
  }');`;

  const initialCode = `
import { test, expect } from '@playwright/test';

test.describe('${flowDescription}', () => {
  test('should complete the flow', async ({ page }) => {
    ${actionSteps}

    // Assertion based on the final state
    ${assertion}
  });
});
`;

  const prompt = `Please format the following Playwright test code beautifully.

${initialCode}`;

  const res = await agent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: prompt },
    ],
    withAgentInvocationOptions(
      { structuredOutput: { schema: TestCodeSchema } },
      invocation
    )
  );

  const generatedCode =
    (res.object as { testCode: string })?.testCode || initialCode;

  if (onEvent && step !== undefined) {
    await onEvent({
      type: "test_generation",
      step,
      prompt,
      generatedCode,
    });
  }

  await emitRationaleEvent(
    onEvent,
    {
      agent: "test-generation",
      step,
      title: "Test generation",
      rationale:
        res.text?.trim() ||
        JSON.stringify(res.object ?? {}, null, 2) ||
        "Test generation agent returned no explanation.",
      prompt,
      output: generatedCode,
    },
    step
  );

  return generatedCode;
}
