import "dotenv/config";
import { Mastra } from "@mastra/core";
import { ConsoleLogger } from "@mastra/core/logger";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { createPlannerAgent } from "../agents/planner.js";
import { createActorAgent } from "../agents/actor.js";
import { createCriticAgent } from "../agents/critic.js";

/**
 * Mastra Studio Entry Point
 *
 * This file is the entry point for Mastra Studio. It initializes Mastra
 * with all agents registered so they can be discovered and tested in Studio.
 */

const storage = new LibSQLStore({
  // simple file DB for local dev; use DATABASE_URL for remote
  url: "file:./mastra.db",
});

export const memory = new Memory({
  storage,
  vector: new LibSQLVector({ connectionUrl: "file:./mastra-vectors.db" }),
  embedder: "openai/text-embedding-3-small",
  options: {
    lastMessages: 12,
    workingMemory: { enabled: true },            // episode scratchpad
    semanticRecall: { topK: 4, messageRange: 2,  // enables cross-thread/domain recall
      scope: "resource" },
    threads: { generateTitle: true },
  },
});

// Create agent instances
const plannerAgent = createPlannerAgent(memory);
const actorAgent = createActorAgent(memory);
const criticAgent = createCriticAgent(memory);

// Initialize Mastra with observability enabled and agents registered
export const mastra = new Mastra({
  logger: new ConsoleLogger({ name: "atlas-qa" }),
  storage, // Storage is required for AI tracing
  agents: {
    plannerAgent,
    actorAgent,
    criticAgent,
  },
  observability: {
    default: { enabled: true }, // Enables AI Tracing
  },
  telemetry: {
    serviceName: "atlas-qa",
    enabled: true, // Enables OTEL Tracing
  },
});
