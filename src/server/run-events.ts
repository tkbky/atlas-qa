import type { AtlasEvent } from "../core/types.js";

export type RunStreamEvent = AtlasEvent & { runId: string };
type RunEventHandler = (event: RunStreamEvent) => void;

const runListeners = new Map<string, Set<RunEventHandler>>();
const runControllers = new Map<string, AbortController>();

const getListenerSet = (runId: string) => {
  let set = runListeners.get(runId);
  if (!set) {
    set = new Set<RunEventHandler>();
    runListeners.set(runId, set);
  }
  return set;
};

export function subscribeToRunEvents(runId: string, handler: RunEventHandler) {
  const set = getListenerSet(runId);
  set.add(handler);
  return () => {
    const listeners = runListeners.get(runId);
    if (!listeners) return;
    listeners.delete(handler);
    if (listeners.size === 0) {
      runListeners.delete(runId);
    }
  };
}

export function emitRunEvent(runId: string, event: AtlasEvent) {
  const listeners = runListeners.get(runId);
  if (!listeners || listeners.size === 0) return;
  const payload: RunStreamEvent = { ...event, runId };
  for (const handler of listeners) {
    handler(payload);
  }
  if (event.type === "done" || event.type === "error") {
    runListeners.delete(runId);
    runControllers.delete(runId);
  }
}

export function registerRunController(runId: string, controller: AbortController) {
  runControllers.set(runId, controller);
}

export function abortRun(runId: string): boolean {
  const controller = runControllers.get(runId);
  if (!controller) {
    return false;
  }
  controller.abort();
  runControllers.delete(runId);
  return true;
}

export function clearRunController(runId: string) {
  runControllers.delete(runId);
}
