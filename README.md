ATLAS QA

the last QA built!

## Overview

ATLAS is a memory-augmented actor-critic web agent that performs long-horizon web tasks through inference-time planning, look-ahead simulation, and dynamic replanning.

### Core Components

- **Planner**: Decomposes tasks into hierarchical subgoals
- **Actor**: Proposes diverse candidate actions with reasoning
- **Critic**: Evaluates candidates via cognitive map look-ahead
- **Multi-layer Memory**:
  - Working Memory: current form state and context
  - Cognitive Map: state transition graph (observation → action → next observation)
  - Semantic Memory: domain-specific rules and constraints

## Running the Core

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Demo UI

A live Next.js UI that visualizes agent collaboration, reasoning, and memory state in real-time via Server-Sent Events.

### Setup Demo UI

```bash
# Navigate to demo-ui directory
cd demo-ui

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### What the Demo Shows

1. **Timeline View**: Step-by-step agent collaboration
   - 📋 Planner's hierarchical subgoals
   - 🧠 Working Memory: form input state (filled vs empty)
   - 🎭 Actor: proposed action candidates with rationales
   - ⚖️ Critic: evaluation scores and reasoning
   - ✅ Selected action and execution
   - 👁️ Observation changes (before/after)

2. **Cognitive Map View**: Interactive graph visualization
   - Nodes = observations (web pages/states)
   - Edges = actions taken
   - Shows how ATLAS navigates through the environment

### Usage

1. Configure your test:
   - **Goal**: Natural language task (e.g., "Fill signup form with email test@example.com")
   - **Start URL**: Target webpage
   - **Environment**: LOCAL (Playwright) or BROWSERBASE
   - **Beam Size**: Number of action candidates (N)
   - **Max Steps**: Maximum steps before timeout

2. Click **Start Run** to begin live streaming

3. Watch the timeline update in real-time as:
   - Planner decomposes the goal
   - Actor proposes actions
   - Critic evaluates via cognitive map look-ahead
   - Selected actions execute
   - Memory layers update

4. Switch to **Cognitive Map** tab to see the state-transition graph

## Architecture Highlights

See [doc/atlas.md](doc/atlas.md) for implementation details:
- Modular actor-critic loop
- Look-ahead Action Simulation (LAS) via Cognitive Map
- Dynamic replanning on unexpected state changes
- Agentic summarization for memory efficiency
