# ATLAS Demo UI

Live visualization of ATLAS agent collaboration via Server-Sent Events.

## Architecture

This demo UI uses a **standalone API server architecture** to avoid webpack bundling issues:

```
┌─────────────────┐         ┌──────────────────┐
│   Next.js UI    │  HTTP   │  Express API     │
│  (port 3000)    │ ◄────► │  (port 4000)     │
│                 │  Proxy  │                  │
│  - React UI     │         │  - ATLAS Core    │
│  - SSE Client   │         │  - Mastra Agents │
│  - Visualization│         │  - Playwright    │
└─────────────────┘         └──────────────────┘
```

**Benefits:**

- ✅ No webpack bundling of Node.js-specific dependencies
- ✅ Clean separation of concerns
- ✅ Both services can run independently
- ✅ Easy to test and debug

## Quick Start

### 1. Start the ATLAS API Server

From the **parent directory** (`atlas-qa/`):

```bash
npm run api
```

This starts the Express server on `http://localhost:4000`

### 2. Start the Next.js Demo UI

From this directory (`demo-ui/`):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Prerequisites

- Node.js 18+
- ATLAS core must be built first: `npm run build` in parent directory
- `.env` file with `OPENAI_API_KEY` in parent directory

## Configuration

### Environment Variables

Create a `.env` file in the `demo-ui/` directory (or configure via system env):

```bash
# ATLAS API Server URL (default: http://localhost:4000)
ATLAS_API_URL=http://localhost:4000
```

You can also set this in the parent directory's `.env` file and it will be inherited.

## What You'll See

### Timeline View

- 📋 **Planner**: Hierarchical task decomposition
- 🧠 **Working Memory**: Current form state (filled vs empty fields)
- 🎭 **Actor**: Proposed action candidates with rationales
- ⚖️ **Critic**: Evaluation scores based on cognitive map look-ahead
- ✅ **Selected Action**: Chosen action and execution
- 👁️ **Observations**: Page state changes (before/after)

### Cognitive Map View

- Interactive graph showing state transitions
- Nodes = Observations (web pages)
- Edges = Actions taken
- Visualizes how ATLAS navigates the environment

## Configuration Options

- **Goal**: Natural language task description
- **Start URL**: Target webpage to test
- **Environment**: LOCAL (Playwright) or BROWSERBASE
- **Beam Size (N)**: Number of action candidates to generate
- **Max Steps**: Maximum steps before timeout

## API Endpoints

### ATLAS API Server (port 4000)

- `GET /health` - Health check endpoint
- `GET /api/atlas/stream` - SSE streaming endpoint for ATLAS runs

### Next.js Demo UI (port 3000)

- `/` - Main UI
- `/api/atlas/stream` - Proxy endpoint to ATLAS API server

## Troubleshooting

### "Failed to connect to ATLAS API server"

**Solution**: Make sure the ATLAS API server is running:

```bash
cd /Users/kheryee.ting/oss/atlas-qa
npm run api
```

### "API key not found for provider openai"

**Solution**: Create a `.env` file in the **parent directory** with:

```bash
OPENAI_API_KEY=sk-...
```

### Build fails

**Solution**: Build the parent package first:

```bash
cd /Users/kheryee.ting/oss/atlas-qa
npm run build
```

### Port conflicts

If ports 3000 or 4000 are already in use:

**For API server**, set `ATLAS_API_PORT` environment variable:

```bash
ATLAS_API_PORT=5000 npm run api
```

**For Next.js**, it will automatically suggest an alternative port.

Then update the demo-ui `.env` file:

```bash
ATLAS_API_URL=http://localhost:5000
```

## Development

### Project Structure

```
demo-ui/
├── app/
│   ├── api/
│   │   └── atlas/
│   │       └── stream/
│   │           └── route.ts      # Proxy to API server
│   ├── components/
│   │   ├── Controls.tsx          # Input controls
│   │   ├── Timeline.tsx          # Step-by-step visualization
│   │   └── CognitiveMapView.tsx  # Graph visualization
│   ├── page.tsx                  # Main UI
│   └── types.ts                  # TypeScript types
├── package.json
├── next.config.ts
└── README.md
```

### Adding Features

To add new visualization or functionality:

1. The API route (`app/api/atlas/stream/route.ts`) is just a proxy - no changes needed
2. Add new event types to `app/types.ts` if needed
3. Update UI components to handle new events
4. The API server handles all ATLAS logic in the parent package

## Testing

Test the API server directly:

```bash
curl http://localhost:4000/health
curl -N "http://localhost:4000/api/atlas/stream?goal=test%20form&startUrl=http://example.com&env=LOCAL&beamSize=2&maxSteps=1"
```

Test through the Next.js proxy:

```bash
curl -N "http://localhost:3000/api/atlas/stream?goal=test%20form&startUrl=http://example.com&env=LOCAL&beamSize=2&maxSteps=1"
```
