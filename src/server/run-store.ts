import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AtlasEvent } from "../core/types.js";
import type { AtlasRunArtifacts } from "../core/atlas.js";

const DEFAULT_RUN_DIR =
  process.env.ATLAS_RUN_DIR ?? path.resolve(process.cwd(), ".atlas", "runs");

export type RunStatus = "running" | "completed" | "error";

export type StoredRunEvent = AtlasEvent & { timestamp: string };

export type RunSummary = {
  id: string;
  name: string;
  goal: string;
  startUrl: string;
  mode: "goal" | "flow-discovery";
  env: "LOCAL" | "BROWSERBASE";
  beamSize: number;
  maxSteps: number;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  endedReason?: string;
  errorMessage?: string;
};

export type StoredRun = RunSummary & {
  events: StoredRunEvent[];
  artifacts?: AtlasRunArtifacts;
};

export type CreateRunOptions = {
  goal: string;
  startUrl: string;
  mode: "goal" | "flow-discovery";
  env: "LOCAL" | "BROWSERBASE";
  beamSize: number;
  maxSteps: number;
  name?: string;
};

const serialize = (value: unknown) => JSON.stringify(value, null, 2);

export class RunStore {
  private baseDir: string;
  private runLocks = new Map<string, Promise<void>>();

  constructor(baseDir: string = DEFAULT_RUN_DIR) {
    this.baseDir = baseDir;
  }

  private async ensureDir() {
    await mkdir(this.baseDir, { recursive: true }).catch(() => {});
  }

  private filePath(id: string) {
    return path.join(this.baseDir, `${id}.json`);
  }

  private parseRun(id: string, raw: string): { run: StoredRun; needsRewrite: boolean } | null {
    try {
      return { run: JSON.parse(raw) as StoredRun, needsRewrite: false };
    } catch {
      const lastBrace = raw.lastIndexOf("}");
      if (lastBrace !== -1) {
        try {
          const trimmed = raw.slice(0, lastBrace + 1);
          return { run: JSON.parse(trimmed) as StoredRun, needsRewrite: true };
        } catch {
          // continue to fallback
        }
      }
      const balanced = this.extractBalancedJson(raw);
      if (balanced) {
        try {
          return { run: JSON.parse(balanced) as StoredRun, needsRewrite: false };
        } catch {
          // continue
        }
      }
      const withoutEvents = this.stripEventsArray(raw);
      if (withoutEvents) {
        try {
          const parsed = JSON.parse(withoutEvents) as StoredRun;
          // Ensure events array exists even if stripped
          parsed.events = parsed.events ?? [];
          return { run: parsed, needsRewrite: false };
        } catch {
          return null;
        }
      }
      // As last resort, fabricate a minimal summary so past runs still show up.
      return {
        run: {
          id,
          name: id,
          goal: "",
          startUrl: "",
          mode: "goal",
          env: "LOCAL",
          beamSize: 1,
          maxSteps: 1,
          status: "error",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [],
        },
        needsRewrite: false,
      };
    }
  }

  private extractBalancedJson(raw: string): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let startIndex = -1;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (ch === "{") {
        if (depth === 0) {
          startIndex = i;
        }
        depth++;
      } else if (ch === "}") {
        if (depth === 0) {
          continue;
        }
        depth--;
        if (depth === 0 && startIndex !== -1) {
          return raw.slice(startIndex, i + 1);
        }
      }
    }
    return null;
  }

  private stripEventsArray(raw: string): string | null {
    const keyIdx = raw.indexOf("\"events\"");
    if (keyIdx === -1) {
      return null;
    }
    const bracketStart = raw.indexOf("[", keyIdx);
    if (bracketStart === -1) {
      return null;
    }
    let inString = false;
    let escaped = false;
    let depth = 0;
    for (let i = bracketStart; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0) {
          const before = raw.slice(0, bracketStart);
          const after = raw.slice(i + 1);
          return `${before}[]${after}`;
        }
      }
    }
    return null;
  }

  private async readRunFile(id: string, sanitize = false): Promise<StoredRun | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf-8");
      const parsed = this.parseRun(id, raw);
      if (!parsed) {
        return null;
      }
      if (sanitize && parsed.needsRewrite) {
        await this.writeRunFile(parsed.run);
      }
      return parsed.run;
    } catch {
      return null;
    }
  }

  private async writeRunFile(run: StoredRun) {
    await this.ensureDir();
    await writeFile(this.filePath(run.id), serialize(run), "utf-8");
  }

  private async withRunLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.runLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.runLocks.set(id, tail);
    await previous.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
      if (this.runLocks.get(id) === tail) {
        this.runLocks.delete(id);
      }
    }
  }

  async createRun(opts: CreateRunOptions): Promise<StoredRun> {
    await this.ensureDir();
    const id = randomUUID();
    const now = new Date().toISOString();
    const run: StoredRun = {
      id,
      name: opts.name?.trim() || this.defaultName(opts.goal, now),
      goal: opts.goal,
      startUrl: opts.startUrl,
      mode: opts.mode,
      env: opts.env,
      beamSize: opts.beamSize,
      maxSteps: opts.maxSteps,
      status: "running",
      createdAt: now,
      updatedAt: now,
      events: [],
    };
    await this.writeRunFile(run);
    return run;
  }

  private defaultName(goal: string, timestamp: string) {
    if (goal) {
      const trimmed = goal.trim();
      if (trimmed.length > 0) {
        return trimmed.slice(0, 60);
      }
    }
    return `Run ${timestamp}`;
  }

  async appendEvent(id: string, event: AtlasEvent) {
    await this.withRunLock(id, async () => {
      const run = await this.readRunFile(id, true);
      if (!run) return;
      run.events.push({ ...event, timestamp: new Date().toISOString() });
      run.updatedAt = new Date().toISOString();
      await this.writeRunFile(run);
    });
  }

  async markCompleted(id: string, artifacts: AtlasRunArtifacts) {
    await this.withRunLock(id, async () => {
      const run = await this.readRunFile(id, true);
      if (!run) return;
      run.status = "completed";
      run.endedReason = artifacts.endedReason;
      run.artifacts = artifacts;
      run.updatedAt = new Date().toISOString();
      await this.writeRunFile(run);
    });
  }

  async markError(id: string, message: string) {
    await this.withRunLock(id, async () => {
      const run = await this.readRunFile(id, true);
      if (!run) return;
      run.status = "error";
      run.errorMessage = message;
      run.updatedAt = new Date().toISOString();
      await this.writeRunFile(run);
    });
  }

  async renameRun(id: string, name: string): Promise<StoredRun | null> {
    return this.withRunLock(id, async () => {
      const run = await this.readRunFile(id, true);
      if (!run) return null;
      run.name = name.trim() || run.name;
      run.updatedAt = new Date().toISOString();
      await this.writeRunFile(run);
      return run;
    });
  }

  async getRun(id: string): Promise<StoredRun | null> {
    return this.withRunLock(id, () => this.readRunFile(id));
  }

  async listRuns(): Promise<RunSummary[]> {
    await this.ensureDir();
    let files: string[] = [];
    try {
      files = await readdir(this.baseDir);
    } catch {
      return [];
    }
    const runs: RunSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const id = path.basename(file, ".json");
      const run = await this.withRunLock(id, () => this.readRunFile(id));
      if (run) {
        runs.push(this.toSummary(run));
      }
    }
    return runs.sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    );
  }

  private toSummary(run: StoredRun): RunSummary {
    const { events, artifacts, ...summary } = run;
    void events;
    void artifacts;
    return summary;
  }
}

export const runStore = new RunStore();
