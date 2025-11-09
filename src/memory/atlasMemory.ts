import type { Observation, Affordance } from "../types.js";
import type { Memory } from "@mastra/memory";

/**
 * Minimal Mastra-backed memory wrapper for ATLAS:
 * - Threads:
 *    semantic://{host}  (SEM_RULE messages)
 *    cogmap://{host}    (COG_EDGE messages)
 * - Scoping:
 *    resourceId = {host}  (so semanticRecall can retrieve per-domain)
 * - Signals & Structure:
 *    Messages are typed ("SEM_RULE", "COG_EDGE") and carry a small JSON block.
 */

export type SemanticRule = {
  id: string;
  kind:
    | "future-datetime"
    | "datetime-format"
    | "non-recoverable"
    | "rate-limit"
    | "other";
  fieldSig?: {
    type?: string | null;
    label?: string | null;
    name?: string | null;
    id?: string | null;
  };
  constraints?: Record<string, any>;
  source: "dom" | "server" | "critic";
  confidence?: number; // 0..1
  note?: string;
  firstSeenAt?: string;  // URL
};

const tid = () => `m:${Date.now()}:${Math.round(Math.random() * 1e9)}`;

export class AtlasMemory {
  constructor(private mem: Memory) {}

  private host(url: string): string {
    try { return new URL(url).host; } catch { return "unknown"; }
  }
  private semThread(host: string) { return `semantic://${host}`; }
  private mapThread(host: string) { return `cogmap://${host}`; }

  /** Ensure threads exist (idempotent). */
  async ensureDomainThreads(url: string) {
    const h = this.host(url);
    try {
      await this.mem.createThread({
        threadId: this.semThread(h),
        resourceId: h,
        title: `Semantic rules for ${h}`,
        metadata: { layer: "semantic" },
      }).catch(() => {});
      await this.mem.createThread({
        threadId: this.mapThread(h),
        resourceId: h,
        title: `Cognitive map for ${h}`,
        metadata: { layer: "cogmap" },
      }).catch(() => {});
    } catch { /* best effort */ }
  }

  /** Persist a cognitive-map transition as a compact text + JSON. */
  async recordTransition(from: Observation, a: Affordance, to: Observation, delta?: string) {
    const h = this.host(from.url);
    await this.ensureDomainThreads(from.url);
    const content = [
      `[COG_EDGE] ${from.title} (${from.url}) -- ${a.description} --> ${to.title} (${to.url})`,
      delta ? `Delta: ${delta}` : undefined,
      "```json",
      JSON.stringify({ kind: "cog-edge", from: { url: from.url, title: from.title }, action: a, to: { url: to.url, title: to.title } }),
      "```",
    ].filter(Boolean).join("\n");

    // NOTE: Mastra Memory exposes saveMessages in server runtime
    await (this.mem as any).saveMessages?.({
      messages: [{
        id: tid(),
        role: "system",
        type: "text",
        content,
        threadId: this.mapThread(h),
        createdAt: new Date(),
      }],
      resourceId: h,
    }).catch(() => {});
  }

  /** Upsert (append) a semantic rule as text + JSON. */
  async writeSemanticRule(url: string, rule: SemanticRule) {
    const h = this.host(url);
    await this.ensureDomainThreads(url);
    const content = [
      `[SEM_RULE] ${rule.kind} @ ${h}`,
      rule.note ? `Note: ${rule.note}` : undefined,
      "```json",
      JSON.stringify(rule),
      "```",
    ].filter(Boolean).join("\n");

    await (this.mem as any).saveMessages?.({
      messages: [{
        id: rule.id || tid(),
        role: "system",
        type: "text",
        content,
        threadId: this.semThread(h),
        createdAt: new Date(),
      }],
      resourceId: h,
    }).catch(() => {});
  }

  /**
   * Retrieve a short, friendly rules context for the given URL's host.
   * Uses semantic recall under the hood; returns a compact bulleted string
   * that can be passed as a "system" message to Actor/Critic.
   */
  async summarizeRulesForUrl(url: string, topK = 4): Promise<string> {
    const h = this.host(url);
    try {
      // Memory.query() is available on server runtime for semantic recall
      const q = `site constraints rules datetime format future hazards for ${h}`;
      const result: any = await (this.mem as any).query?.({
        query: q,
        topK,
        resourceId: h,
        threadId: this.semThread(h),
        scope: "resource",
      });
      const msgs: { content: string }[] = result?.messages ?? [];
      if (msgs.length === 0) return "";
      const bullets = msgs.map((m) => `• ${m.content.replace(/```json[\s\S]*?```/g, "").trim().slice(0, 300)}`);
      return `Known site constraints (from prior runs on ${h}):\n${bullets.join("\n")}`;
    } catch {
      return "";
    }
  }
}
