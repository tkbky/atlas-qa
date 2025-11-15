import type { AgentMemoryOption } from "@mastra/core/agent";

export type AgentInvocationOptions = {
  runId?: string;
  memory?: AgentMemoryOption;
};

/**
 * Merge per-call invocation metadata (runId, memory threading) into agent execution options.
 */
export function withAgentInvocationOptions<T extends Record<string, unknown>>(
  options: T,
  invocation?: AgentInvocationOptions
): T & AgentInvocationOptions {
  if (!invocation) {
    return options as T & AgentInvocationOptions;
  }

  const enriched = { ...options } as T & AgentInvocationOptions;

  if (invocation.runId) {
    enriched.runId = invocation.runId;
  }

  if (invocation.memory) {
    enriched.memory = invocation.memory;
  }

  return enriched;
}
