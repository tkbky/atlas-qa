// Core ATLAS exports
export { runAtlas, type AtlasOptions, type AtlasRunArtifacts, type AtlasStepArtifact } from "./core/atlas.js";
export { CognitiveMap } from "./core/cognitive-map.js";

// Type exports
export type {
  Affordance,
  Observation,
  Plan,
  Candidate,
  Critique,
  Transition,
  FormFieldInfo,
  FormFieldOption,
  RecentAction,
  InputState,
  AtlasEvent,
  AtlasEventCallback,
} from "./core/types.js";

// Browser exports
export { WebEnv } from "./browser/index.js";

// Agent exports
export { plan, propose, critique, isFormControl, getMethodForElement, memory, mastra } from "./agents/index.js";

// Memory exports
export { AtlasMemory, AtlasKnowledgeStore, type SemanticRule } from "./memory/index.js";

// Strategy exports
export { applyTemporalInput } from "./strategies/index.js";

// Utility exports
export {
  initRunLogger,
  getRunLogger,
  logInfo,
  logDebug,
  logWarn,
  logError,
  shutdownLogger,
  type RunLoggerHandle,
} from "./utils/logger.js";

// Script exports
export { seedCognitiveMap } from "./scripts/seed.js";
