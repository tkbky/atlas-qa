import { getHostSnapshot, listHostSummaries } from "./knowledge.js";
import type { HostSnapshot } from "./types.js";
import {
  generateTestFromKnowledge,
  suggestTestPlans,
} from "../agents/index.js";
import type {
  TestGenerationResult,
  TestPlanSuggestion,
} from "./types.js";
import { buildActionCatalog } from "./actions.js";

export { getHostSnapshot, listHostSummaries };

export async function suggestFlowsForHost(
  host: string,
  userPrompt?: string,
  url?: string
): Promise<{
  snapshot: HostSnapshot;
  suggestions: TestPlanSuggestion[];
  prompt: string;
  rawOutput: string;
}> {
  const snapshot = await getHostSnapshot(host);
  const { suggestions, prompt, rawOutput } = await suggestTestPlans(
    host,
    snapshot,
    userPrompt,
    url
  );
  return { snapshot, suggestions, prompt, rawOutput };
}

export async function generateTestForHost(
  host: string,
  goal: string,
  userPrompt?: string
): Promise<{ snapshot: HostSnapshot; result: TestGenerationResult }> {
  const snapshot = await getHostSnapshot(host);
  const actionCatalog = buildActionCatalog(snapshot, goal);
  const result = await generateTestFromKnowledge(host, goal, snapshot, userPrompt, actionCatalog);
  return { snapshot, result };
}
