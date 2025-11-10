# ATLAS Architecture

## Overview

ATLAS is a web automation framework using AI agents (Planner, Actor, Critic) with cognitive mapping for intelligent task execution.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ATLAS Core Library                      │
│  (Node.js Package - src/)                                    │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │  Planner    │  │   Actor     │  │   Critic     │        │
│  │   Agent     │  │   Agent     │  │   Agent      │        │
│  └─────────────┘  └─────────────┘  └──────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Cognitive Map (State Transitions)         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │      Web Environment (Playwright/Browserbase)       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ imports
                              │
┌─────────────────────────────┴───────────────────────────────┐
│               Standalone API Server (Express)                │
│  (src/api-server.ts - port 4000)                            │
│                                                               │
│  - SSE Streaming Endpoint                                    │
│  - Health Check                                              │
│  - CORS Configuration                                        │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP/SSE
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Demo UI (Next.js App)                       │
│  (demo-ui/ - port 3000)                                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Route (Proxy)   →   Forwards to API Server    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  React Components:                                  │    │
│  │  - Controls (input forms)                           │    │
│  │  - Timeline (step visualization)                    │    │
│  │  - CognitiveMapView (graph viz)                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### Problem: Direct Import Fails

Initially, demo-ui tried to import ATLAS core directly:

```typescript
// ❌ This caused webpack bundling issues
import { runAtlas } from "@atlas-core/atlas.js";
```

**Issues:**

1. Next.js webpack tries to bundle Node.js-specific dependencies
2. TypeScript `.d.ts` files cause parse errors
3. Worker threads (pino-pretty) fail in webpack context
4. Playwright/libsql require native Node.js environment

### Solution: API Server Architecture

**Separation of Concerns:**

| Component  | Responsibility                           | Runtime           |
| ---------- | ---------------------------------------- | ----------------- |
| ATLAS Core | AI agents, web automation, cognitive map | Node.js           |
| API Server | HTTP/SSE endpoint, orchestration         | Node.js (Express) |
| Demo UI    | Visualization, user input                | Next.js/React     |

**Benefits:**

- ✅ No webpack bundling of heavy Node.js deps
- ✅ Each component can be developed/tested independently
- ✅ API server can be reused by other clients
- ✅ Clean HTTP boundary between services
- ✅ Standard microservices pattern

## Component Details

### ATLAS Core Library (`src/`)

**Purpose:** Core automation logic

**Key Files:**

- `atlas.ts` - Main orchestration loop
- `agents.ts` - Planner, Actor, Critic agents using Mastra
- `browser.ts` - Web environment wrapper (Playwright/Browserbase)
- `cognitiveMap.ts` - State transition tracking
- `memory/atlasMemory.ts` - Agent memory management

**Dependencies:**

- @mastra/core - AI agent framework
- @mastra/memory - Memory management
- @mastra/libsql - SQLite storage
- @browserbasehq/stagehand - Browser automation
- playwright - Headless browser

**Exports:**

```typescript
export async function runAtlas(
  goal: string,
  startUrl: string,
  opts: AtlasOptions
): Promise<AtlasRunArtifacts>;
```

### API Server (`src/api-server.ts`)

**Purpose:** HTTP/SSE interface to ATLAS core

**Endpoints:**

- `GET /health` - Health check
- `GET /api/atlas/stream` - SSE streaming endpoint

**Features:**

- CORS enabled for Next.js
- Graceful shutdown handling
- Real-time event streaming

**Start:**

```bash
npm run api
# Runs on http://localhost:4000
```

### Demo UI (`demo-ui/`)

**Purpose:** Interactive visualization and control

**Architecture:**

- **Next.js 15** (App Router)
- **Server Components** for API routes
- **Client Components** for interactive UI

**Key Files:**

- `app/api/atlas/stream/route.ts` - Proxy to API server
- `app/page.tsx` - Main UI with SSE client
- `app/components/Timeline.tsx` - Step visualization
- `app/components/CognitiveMapView.tsx` - Graph view (Cytoscape.js)

**Start:**

```bash
cd demo-ui
npm run dev
# Runs on http://localhost:3000
```

## Data Flow

### 1. User Initiates Run

```
User (Browser) → Next.js UI → SSE EventSource
```

### 2. Proxy Request

```
GET /api/atlas/stream?goal=...&startUrl=...
    ↓
Next.js API Route (proxy)
    ↓
Express API Server /api/atlas/stream
```

### 3. ATLAS Execution

```
API Server
    ↓
runAtlas() in ATLAS Core
    ↓
┌─────────────────────────┐
│  Agent Loop (maxSteps)  │
│                         │
│  1. Planner  → Plan     │
│  2. Actor    → Candidates│
│  3. Critic   → Ranking  │
│  4. Execute  → Action   │
│  5. Observe  → State    │
│  6. Update   → CogMap   │
└─────────────────────────┘
    ↓
onEvent() callback
```

### 4. Event Streaming

```
onEvent() callback
    ↓
SSE Event: { type: "plan", plan: {...} }
    ↓
Express response.write()
    ↓
Next.js proxy forwards
    ↓
Browser EventSource receives
    ↓
React setState()
    ↓
UI updates
```

## Event Types

```typescript
type AtlasEvent =
  | { type: "init"; goal: string; startUrl: string; opts: AtlasOptions }
  | { type: "plan"; plan: Plan }
  | {
      type: "propose";
      step: number;
      candidates: Candidate[];
      inputState: InputState;
    }
  | { type: "critique"; step: number; critique: Critique }
  | { type: "selected_action"; step: number; action: Affordance }
  | { type: "action_executed"; step: number; action: Affordance }
  | {
      type: "observation_after";
      step: number;
      before: Observation;
      after: Observation;
    }
  | { type: "map_update"; step: number; edge: Transition }
  | { type: "replan"; step: number; reason: string; plan: Plan }
  | {
      type: "done";
      finalObservation: Observation;
      endedReason: string;
      cognitiveMap: Transition[];
    }
  | { type: "error"; message: string };
```

## Development Workflow

### 1. Core Library Development

```bash
# Make changes to src/
cd /atlas-qa
npm run build
npm test
```

### 2. API Server Testing

```bash
# Start API server
npm run api

# Test directly
curl http://localhost:4000/health
curl -N "http://localhost:4000/api/atlas/stream?goal=test&startUrl=http://example.com&env=LOCAL"
```

### 3. UI Development

```bash
# Start both servers
npm run api  # Terminal 1
cd demo-ui && npm run dev  # Terminal 2

# Access at http://localhost:3000
```

## Configuration

### Environment Variables

**Parent directory (`.env`):**

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
BROWSERBASE_API_KEY=bb_...
BROWSERBASE_PROJECT_ID=proj_...
ATLAS_API_PORT=4000
CORS_ORIGIN=http://localhost:3000
```

**Demo UI (`.env`):**

```bash
ATLAS_API_URL=http://localhost:4000
```

## Deployment Considerations

### Option 1: Monolithic Deployment

Deploy both API server and Next.js UI together:

```bash
# Build
npm run build
cd demo-ui && npm run build

# Start
npm run api &
cd demo-ui && npm start
```

### Option 2: Separate Services

Deploy API server and UI independently:

**API Server:**

- Deploy as Node.js service (e.g., on Railway, Fly.io)
- Set `CORS_ORIGIN` to UI domain

**Demo UI:**

- Deploy Next.js app (e.g., Vercel, Netlify)
- Set `ATLAS_API_URL` to API server URL

### Option 3: Docker

```dockerfile
# API Server
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
CMD ["npm", "run", "api"]

# Demo UI
FROM node:18
WORKDIR /app
COPY demo-ui/package*.json ./
RUN npm install
COPY demo-ui/ ./
CMD ["npm", "run", "dev"]
```

## Future Enhancements

- [ ] Add authentication/authorization
- [ ] Implement run persistence (save/resume runs)
- [ ] Add multiple concurrent runs
- [ ] WebSocket instead of SSE for bidirectional communication
- [ ] Run history and replay
- [ ] Export runs as JSON/video
- [ ] API rate limiting and quotas
