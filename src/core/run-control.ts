export type AtlasRunControlState = {
  status: "running" | "paused" | "stopping";
  maxSteps: number;
  currentStep: number;
  rewindToStep?: number | null;
};

type PauseBarrier = { promise: Promise<void>; resolve: () => void };

const createBarrier = (): PauseBarrier => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

export type AtlasRunControlOptions = {
  maxSteps: number;
  startStep?: number;
  abortSignal?: AbortSignal;
};

/**
 * Cooperative control surface shared between the API layer and the Atlas runtime.
 * Allows pausing/resuming, updating the step budget, and reflecting abort/stop signals.
 */
export class AtlasRunControl {
  private state: AtlasRunControlState;
  private pauseBarrier: PauseBarrier | null = null;
  private externalAbort: AbortSignal | null = null;

  constructor(opts: AtlasRunControlOptions) {
    this.state = {
      status: "running",
      maxSteps: opts.maxSteps,
      currentStep: opts.startStep ?? 0,
    };
    if (opts.abortSignal) {
      this.attachAbortSignal(opts.abortSignal);
    }
  }

  attachAbortSignal(signal: AbortSignal) {
    if (this.externalAbort) {
      this.externalAbort.removeEventListener("abort", this.handleAbort);
    }
    this.externalAbort = signal;
    if (signal.aborted) {
      this.handleAbort();
    } else {
      signal.addEventListener("abort", this.handleAbort);
    }
  }

  private handleAbort = () => {
    this.state.status = "stopping";
    this.resume();
  };

  snapshot(): AtlasRunControlState {
    return { ...this.state };
  }

  getCurrentStep() {
    return this.state.currentStep;
  }

  setCurrentStep(step: number) {
    this.state.currentStep = step;
  }

  getMaxSteps() {
    return this.state.maxSteps;
  }

  updateMaxSteps(maxSteps: number) {
    if (maxSteps > this.state.maxSteps) {
      this.state.maxSteps = maxSteps;
      return;
    }
    this.state.maxSteps = maxSteps;
    if (this.state.currentStep >= maxSteps && this.state.status === "running") {
      // Force loop to exit gracefully.
      this.resume();
    }
  }

  async waitIfPaused() {
    if (this.state.status !== "paused") {
      return;
    }
    if (!this.pauseBarrier) {
      this.pauseBarrier = createBarrier();
    }
    await this.pauseBarrier.promise;
  }

  pause() {
    if (this.state.status === "running") {
      this.state.status = "paused";
    }
  }

  resume() {
    if (this.state.status === "running") {
      return;
    }
    this.state.status = "running";
    if (this.pauseBarrier) {
      this.pauseBarrier.resolve();
      this.pauseBarrier = null;
    }
  }

  stop() {
    this.state.status = "stopping";
    this.resume();
  }

  shouldStop() {
    return this.state.status === "stopping";
  }

  requestRewind(step: number) {
    this.state.rewindToStep = step;
  }

  consumeRewindRequest(): number | undefined {
    const target = this.state.rewindToStep;
    this.state.rewindToStep = undefined;
    return typeof target === "number" ? target : undefined;
  }
}
