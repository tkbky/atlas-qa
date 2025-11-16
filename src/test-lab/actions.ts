import type { ActionHint, HostSnapshot } from "./types.js";
import type { Affordance, Transition } from "../core/types.js";

const parseActionKey = (actionKey: string): Partial<ActionHint> => {
  const [method = "", selector = "", instruction = "", description = ""] = actionKey
    .split("::")
    .map((part) => part.trim());
  if (method === "NL") {
    return { method: "instruction", description: instruction || description };
  }
  return {
    method: method || "unknown",
    selector: selector || undefined,
    description: description || instruction || undefined,
  };
};

const flattenAffordances = (transitions: Transition[]): Affordance[] => {
  const collected: Affordance[] = [];
  for (const tr of transitions) {
    if (Array.isArray(tr.to?.affordances)) {
      collected.push(...(tr.to.affordances as Affordance[]));
    }
  }
  return collected;
};

export function buildActionCatalog(snapshot: HostSnapshot, goal?: string, limit = 10): ActionHint[] {
  const affordances = flattenAffordances(snapshot.transitions);
  const scored = new Map<string, { hint: ActionHint; score: number }>();
  const keywords = goal?.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) ?? [];

  for (const tr of snapshot.transitions) {
    const parsed = parseActionKey(tr.actionKey);
    const key = `${parsed.method}::${parsed.selector ?? parsed.description ?? ""}`;
    if (!parsed.method || scored.has(key)) continue;
    let score = 1;
    if (parsed.description && goal) {
      const desc = parsed.description.toLowerCase();
      score += keywords.some((k) => desc.includes(k)) ? 2 : 0;
    }
    scored.set(key, { hint: parsed as ActionHint, score });
  }

  for (const affordance of affordances) {
    const method = affordance.method || affordance.fieldInfo?.tagName || "unknown";
    const key = `${method}::${affordance.selector ?? affordance.description ?? ""}`;
    if (scored.has(key)) continue;
    let score = 0.5;
    if (affordance.description && goal) {
      const desc = affordance.description.toLowerCase();
      score += keywords.some((k) => desc.includes(k)) ? 1.5 : 0;
    }
    scored.set(key, {
      hint: {
        method,
        selector: affordance.selector,
        description: affordance.description,
        arguments: affordance.arguments ?? undefined,
      },
      score,
    });
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.hint);
}

