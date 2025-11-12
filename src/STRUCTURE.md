# Source Code Structure

This document describes the reorganized structure of the `src/` directory.

## Directory Overview

```
src/
├── core/                   # Core business logic & domain models
│   ├── types.ts           # All TypeScript type definitions
│   ├── atlas.ts           # Main ATLAS orchestrator (runAtlas function)
│   └── cognitive-map.ts   # Cognitive map implementation
│
├── agents/                # AI Agents (Mastra-based)
│   ├── index.ts          # Mastra config, memory setup, exports
│   ├── planner.ts        # Planner agent + plan() function
│   ├── actor.ts          # Actor agent + propose() function
│   ├── critic.ts         # Critic agent + critique() function
│   └── helpers.ts        # Shared utilities (isFormControl, etc.)
│
├── browser/              # Browser automation layer
│   ├── index.ts         # Export WebEnv and utilities
│   ├── web-env.ts       # WebEnv class (Stagehand wrapper)
│   ├── enrichment.ts    # Affordance enrichment logic
│   └── detectors.ts     # Element detection utilities
│
├── memory/               # Memory subsystem
│   ├── index.ts         # Export memory components
│   └── atlas-memory.ts  # AtlasMemory class (semantic & cognitive storage)
│
├── strategies/           # Input strategies
│   ├── index.ts         # Export all strategies
│   └── temporal-input.ts # Temporal input strategy
│
├── server/               # API server
│   ├── index.ts         # Express server setup
│   ├── routes.ts        # API route definitions
│   └── sse.ts           # Server-Sent Events handler
│
├── utils/                # Shared utilities
│   └── logger.ts        # Logging infrastructure
│
├── scripts/              # Executable scripts
│   ├── run.ts           # Example runner script
│   └── seed.ts          # Cognitive map seeding script
│
└── index.ts              # Public API exports
```

## Module Descriptions

### `core/` - Core Domain Logic

Contains the fundamental business logic of ATLAS:

- **types.ts**: All TypeScript types and interfaces (`Observation`, `Affordance`, `Plan`, etc.)
- **atlas.ts**: The main `runAtlas()` orchestrator implementing the actor-critic loop
- **cognitive-map.ts**: `CognitiveMap` class for state transition tracking

### `agents/` - AI Agents

Mastra-based AI agents implementing the actor-critic architecture:

- **index.ts**: Initializes Mastra, memory, and exports agent functions
- **planner.ts**: Planner agent that decomposes goals into subgoals
- **actor.ts**: Actor agent that proposes candidate actions
- **critic.ts**: Critic agent that evaluates candidates via look-ahead
- **helpers.ts**: Shared utilities for form state analysis and method selection

**Key Functions:**
- `plan(goal, observation, onEvent?)` → `Promise<Plan>`
- `propose(goal, plan, observation, N, step?, onEvent?, recentActions?)` → `Promise<Candidate[]>`
- `critique(goal, plan, observation, candidates, lookaheads, step?, onEvent?, recentActions?)` → `Promise<Critique>`

### `browser/` - Browser Automation

Stagehand wrapper and browser interaction utilities:

- **web-env.ts**: `WebEnv` class wrapping Stagehand for web automation
- **enrichment.ts**: Functions to enrich affordances with field metadata
- **detectors.ts**: Element detection logic (e.g., datetime inputs)

**Key Class:**
- `WebEnv`: Provides `init()`, `goto()`, `currentObservation()`, `act()`, `close()`

### `memory/` - Memory System

Multi-layer memory implementation:

- **atlas-memory.ts**: `AtlasMemory` class managing semantic rules and cognitive map persistence

**Features:**
- Semantic memory: domain-specific rules and constraints
- Cognitive map persistence: cross-run transition recall
- Thread-based organization per domain

### `strategies/` - Input Strategies

Specialized input handling strategies:

- **temporal-input.ts**: Native datetime input handling (bypasses pickers)

### `server/` - API Server

Express-based API server for streaming ATLAS runs:

- **index.ts**: Server initialization and configuration
- **routes.ts**: Route definitions (health check, stream endpoint)
- **sse.ts**: Server-Sent Events handler for real-time streaming

**Endpoints:**
- `GET /health` - Health check
- `GET /api/atlas/stream` - Stream ATLAS run events via SSE

### `utils/` - Utilities

Shared utility functions:

- **logger.ts**: Structured logging with run-specific log files

### `scripts/` - Executable Scripts

Example scripts for running ATLAS:

- **run.ts**: Example ATLAS run with a specific goal
- **seed.ts**: Utility to seed cognitive map by exploring a site

## Usage Examples

### Running ATLAS

```typescript
import { runAtlas } from "./core/atlas.js";

const artifacts = await runAtlas(
  "Fill the signup form with email test@example.com",
  "https://example.com/signup",
  {
    env: "LOCAL",
    maxSteps: 15,
    beamSize: 3,
  }
);
```

### Using Individual Components

```typescript
import { WebEnv } from "./browser/index.js";
import { plan, propose, critique } from "./agents/index.js";
import { CognitiveMap } from "./core/cognitive-map.js";

const web = new WebEnv();
await web.init();
await web.goto("https://example.com");

const observation = await web.currentObservation();
const goalPlan = await plan("Complete the form", observation);
```

### Starting the API Server

```bash
npm run api
```

Server will start on port 4000 (configurable via `ATLAS_API_PORT`).

## Benefits of This Structure

1. **Clear Separation of Concerns**: Each module has a well-defined responsibility
2. **Improved Testability**: Smaller, focused modules are easier to test in isolation
3. **Better Discoverability**: Logical grouping makes it easy to find relevant code
4. **Reduced Cognitive Load**: No more 600+ line files
5. **Scalability**: Easy to add new agents, strategies, or browser features
6. **Standard Conventions**: Follows TypeScript/Node.js best practices

## Migration Notes

### From Old Structure

Old imports need to be updated:

```typescript
// Old
import { runAtlas } from "./atlas.js";
import { WebEnv } from "./browser.js";
import { plan, propose, critique } from "./agents.js";

// New
import { runAtlas } from "./core/atlas.js";
import { WebEnv } from "./browser/index.js";
import { plan, propose, critique } from "./agents/index.js";
```

### Package.json Scripts

Updated to point to new entry points:

```json
{
  "scripts": {
    "dev": "tsx src/scripts/run.ts",
    "api": "tsx src/server/index.ts"
  }
}
```

## File Count

- **Before**: 9 files in root + 2 subdirectories
- **After**: 23 files organized in 8 modules

The increase in file count improves maintainability by keeping each file focused and manageable.
