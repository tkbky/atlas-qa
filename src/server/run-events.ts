import type { AtlasEvent } from "../core/types.js";
import type { AtlasRunControl } from "../core/run-control.js";

export type RunStreamEvent = AtlasEvent & { runId: string };
type RunEventHandler = (event: RunStreamEvent) => void;

const runListeners = new Map<string, Set<RunEventHandler>>();
const runControllers = new Map<string, AbortController>();
const runControls = new Map<string, AtlasRunControl>();

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

export function registerRunController(
  runId: string,
  controller: AbortController,
  control: AtlasRunControl
) {
  runControllers.set(runId, controller);
  runControls.set(runId, control);
}

export function abortRun(runId: string): boolean {
  const controller = runControllers.get(runId);
  const control = runControls.get(runId);
  if (!controller && !control) {
    return false;
  }
  control?.stop();
  controller?.abort();
  runControllers.delete(runId);
  runControls.delete(runId);
  return true;
}

export function clearRunController(runId: string) {
  runControllers.delete(runId);
  runControls.delete(runId);
}

export function pauseRun(runId: string): boolean {
  const control = runControls.get(runId);
  if (!control) return false;
  control.pause();
  return true;
}

export function resumeRun(runId: string): boolean {
  const control = runControls.get(runId);
  if (!control) return false;
  control.resume();
  return true;
}

export function setRunBudget(runId: string, maxSteps: number): boolean {
  const control = runControls.get(runId);
  if (!control) return false;
  control.updateMaxSteps(maxSteps);
  return true;
}
