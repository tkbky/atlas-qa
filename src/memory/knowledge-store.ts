import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Affordance, Observation, Transition } from "../core/types.js";
import type { SemanticRule } from "./atlas-memory.js";

const DEFAULT_KNOWLEDGE_DIR =
  process.env.ATLAS_KNOWLEDGE_DIR ?? path.resolve(process.cwd(), ".atlas", "knowledge");

const COGMAP_FOLDER = "cogmap";
const SEMANTIC_FOLDER = "semantic";

const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const serialize = (value: unknown) => JSON.stringify(value, null, 2);

export class AtlasKnowledgeStore {
  private baseDir: string;
  private cogmapDir: string;
  private semanticDir: string;

  constructor(baseDir: string = DEFAULT_KNOWLEDGE_DIR) {
    this.baseDir = baseDir;
    this.cogmapDir = path.join(baseDir, COGMAP_FOLDER);
    this.semanticDir = path.join(baseDir, SEMANTIC_FOLDER);
  }

  private async ensureDirs() {
    try {
      await mkdir(this.cogmapDir, { recursive: true });
      await mkdir(this.semanticDir, { recursive: true });
    } catch {
      // best-effort: swallow any filesystem errors so core flows don't crash
    }
  }

  private host(input: string): string {
    if (!input) return "unknown";
    if (input.includes("://")) {
      try {
        return new URL(input).host || "unknown";
      } catch {
        return "unknown";
      }
    }
    return input;
  }

  private transitionPath(host: string) {
    return path.join(this.cogmapDir, `${host}.json`);
  }

  private semanticPath(host: string) {
    return path.join(this.semanticDir, `${host}.json`);
  }

  async loadTransitions(hostOrUrl: string): Promise<Transition[]> {
    const host = this.host(hostOrUrl);
    try {
      const raw = await readFile(this.transitionPath(host), "utf-8");
      return safeParseJson<Transition[]>(raw, []);
    } catch {
      return [];
    }
  }

  private async writeTransitions(host: string, transitions: Transition[]) {
    await this.ensureDirs();
    try {
      await writeFile(this.transitionPath(host), serialize(transitions), "utf-8");
    } catch {
      // ignore write failures
    }
  }

  async recordTransition(from: Observation, action: Affordance, transition: Transition) {
    const host = this.host(from.url);
    const transitions = await this.loadTransitions(host);
    const idx = transitions.findIndex(
      (t) => t.fromKey === transition.fromKey && t.actionKey === transition.actionKey
    );
    if (idx >= 0) {
      transitions[idx] = { ...transition };
    } else {
      transitions.push({ ...transition });
    }
    await this.writeTransitions(host, transitions);
  }

  async getSemanticRules(hostOrUrl: string): Promise<SemanticRule[]> {
    const host = this.host(hostOrUrl);
    try {
      const raw = await readFile(this.semanticPath(host), "utf-8");
      return safeParseJson<SemanticRule[]>(raw, []);
    } catch {
      return [];
    }
  }

  private async writeSemanticRules(host: string, rules: SemanticRule[]) {
    await this.ensureDirs();
    try {
      await writeFile(this.semanticPath(host), serialize(rules), "utf-8");
    } catch {
      // ignore write failures
    }
  }

  async recordSemanticRule(url: string, rule: SemanticRule) {
    const host = this.host(url);
    const rules = await this.getSemanticRules(host);
    const idx = rules.findIndex((existing) => existing.id === rule.id);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], ...rule };
    } else {
      rules.push({ ...rule });
    }
    await this.writeSemanticRules(host, rules);
  }
}
