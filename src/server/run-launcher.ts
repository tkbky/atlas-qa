import { runAtlas, type AtlasCheckpoint } from "../core/atlas.js";
import type { AtlasEvent } from "../core/types.js";
import { AtlasRunControl } from "../core/run-control.js";
import { runStore } from "./run-store.js";
import {
  clearRunController,
  emitRunEvent,
  registerRunController,
} from "./run-events.js";

type LaunchRunOptions = {
  runId: string;
  goal: string;
  startUrl: string;
  env: "LOCAL" | "BROWSERBASE";
  beamSize: number;
  maxSteps: number;
  timeBudgetMs?: number;
  checkpoint?: AtlasCheckpoint;
  sendEvent?: (eventName: string, data: unknown) => void;
  runLabel?: string;
};

export async function launchRunExecution(options: LaunchRunOptions): Promise<void> {
  const {
    runId,
    goal,
    startUrl,
    env,
    beamSize,
    maxSteps,
    timeBudgetMs,
    checkpoint,
    sendEvent,
    runLabel,
  } = options;

  const controller = new AbortController();
  const control = new AtlasRunControl({
    maxSteps,
    startStep: checkpoint?.stepCount ?? 0,
    abortSignal: controller.signal,
  });
  registerRunController(runId, controller, control);

  const forwardEvent = async (event: AtlasEvent) => {
    runStore.appendEvent(runId, event).catch(() => {});
    emitRunEvent(runId, event);
    if (event.type === "done" || event.type === "error") {
      clearRunController(runId);
    }
    if (sendEvent) {
      sendEvent(event.type, { ...event, runId });
    }
  };

  try {
    const artifacts = await runAtlas(goal, startUrl, {
      env,
      beamSize,
      maxSteps,
      timeBudgetMs,
      abortSignal: controller.signal,
      control,
      checkpoint,
      runLabel,
      onEvent: forwardEvent,
      onCheckpoint: (cp) => runStore.saveCheckpoint(runId, cp),
    });
    await runStore.markCompleted(runId, artifacts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await runStore.markError(runId, errorMessage);
    throw error;
  } finally {
    clearRunController(runId);
  }
}
