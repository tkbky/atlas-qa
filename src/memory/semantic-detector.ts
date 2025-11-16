import type { Observation, Affordance, FormFieldInfo } from "../core/types.js";
import type { SemanticRule } from "./atlas-memory.js";

const DATETIME_TYPES = new Set([
  "date",
  "datetime",
  "datetime-local",
  "time",
  "month",
  "week",
]);

const hostFromUrl = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
};

const normalize = (value?: string | null): string =>
  (value ?? "").trim().toLowerCase();

const hashString = (input: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const fieldSignatureKey = (affordance: Affordance): string => {
  const fi = affordance.fieldInfo;
  const parts = [
    affordance.selector ?? "",
    affordance.description ?? "",
    fi?.label ?? "",
    fi?.ariaLabel ?? "",
    fi?.name ?? "",
    fi?.id ?? "",
    fi?.type ?? "",
  ];
  return parts.map(normalize).join("|");
};

const describeField = (affordance: Affordance): string => {
  const fi = affordance.fieldInfo;
  return (
    fi?.label ||
    fi?.ariaLabel ||
    fi?.placeholder ||
    fi?.name ||
    fi?.id ||
    affordance.description ||
    "this field"
  );
};

const toFieldSig = (fi?: FormFieldInfo) =>
  fi
    ? {
        type: fi.type ?? null,
        label: fi.label ?? fi.ariaLabel ?? null,
        name: fi.name ?? null,
        id: fi.id ?? null,
      }
    : undefined;

const buildRuleId = (host: string, kind: string, affordance: Affordance, extra?: string) => {
  const key = `${kind}::${fieldSignatureKey(affordance)}::${extra ?? ""}`;
  return `sem:${host}:${hashString(key)}`;
};

const buildDatetimeRule = (
  host: string,
  url: string,
  affordance: Affordance
): SemanticRule | null => {
  const fi = affordance.fieldInfo;
  if (!fi?.type) return null;
  const type = fi.type.toLowerCase();
  if (!DATETIME_TYPES.has(type)) return null;
  const friendlyType = type.replace(/-/g, " ");
  const note = `${describeField(affordance)} expects a ${friendlyType} value.`;
  return {
    id: buildRuleId(host, `datetime-${type}`, affordance),
    kind: "datetime-format",
    category: "format",
    tags: ["datetime", type],
    source: "dom",
    fieldSig: toFieldSig(fi),
    constraints: {
      inputType: type,
      required: Boolean(fi.required),
    },
    confidence: 0.7,
    note,
    firstSeenAt: url,
  };
};

const buildRequiredRule = (
  host: string,
  url: string,
  affordance: Affordance
): SemanticRule | null => {
  const fi = affordance.fieldInfo;
  if (!fi?.required) return null;
  const note = `${describeField(affordance)} must be filled before continuing.`;
  return {
    id: buildRuleId(host, "required", affordance),
    kind: "required-field",
    category: "validation",
    tags: ["required", "form"],
    source: "dom",
    fieldSig: toFieldSig(fi),
    constraints: {
      required: true,
    },
    confidence: 0.6,
    note,
    firstSeenAt: url,
  };
};

/**
 * Heuristically derive semantic rules from a single observation.
 */
export function deriveSemanticRulesFromObservation(
  observation: Observation
): SemanticRule[] {
  if (!observation?.affordances?.length) {
    return [];
  }
  const host = hostFromUrl(observation.url);
  const derived: SemanticRule[] = [];
  const seen = new Set<string>();

  for (const affordance of observation.affordances) {
    const candidates = [
      buildDatetimeRule(host, observation.url, affordance),
      buildRequiredRule(host, observation.url, affordance),
    ].filter((rule): rule is SemanticRule => Boolean(rule));

    for (const rule of candidates) {
      if (seen.has(rule.id)) continue;
      seen.add(rule.id);
      derived.push(rule);
    }
  }

  return derived;
}
