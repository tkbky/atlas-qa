import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import type { Observation, Plan, Candidate, Critique } from "./types.js";
import { logDebug, logInfo } from "./logger.js";

/**
 * Mastra Agents:
 * - `Agent.generate(messages, { structuredOutput: { schema } })` returns `response.object` (typed by Zod)
 * - Memory: working memory + history; configure storage via LibSQLStore
 * Docs: structured output, generate(), working memory, LibSQL storage.
 * :contentReference[oaicite:6]{index=6}
 */

const storage = new LibSQLStore({
  // simple file DB for local dev; use DATABASE_URL for remote
  url: "file:./mastra.db",
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 12,
    workingMemory: { enabled: true }, // thread-scoped scratchpad
  },
});

export const plannerAgent = new Agent({
  name: "atlas-planner",
  model: "openai/gpt-4.1",
  memory,
  instructions: [
    "You are the Planner in an actor–critic web agent.",
    "Decompose the goal into concise subgoals with explicit success predicates.",
    "Prefer UI-anchored steps (e.g., 'Reports → Sales → Set dates → Read table').",
    "If the goal mentions specific credentials or field values, include subgoals to enter each value before attempting submission.",
  ],
});

export const actorAgent = new Agent({
  name: "atlas-actor",
  model: "openai/gpt-4.1",
  memory,
  instructions: [
    "You are the Actor. Given the plan + current observation affordances, propose up to N safe next actions.",
    "Only propose actions visible in the observation; avoid destructive actions (delete/purchase).",
    "Return short rationales.",
    "Always include the action fields: description, selector, method, arguments, instruction; use null (or []) when a value is not applicable.",
    "When suggesting form interactions, prefer deterministic actions (fill/type/click).",
    "For input fields, set method to 'fill' and provide the exact string to enter as the first item of 'arguments'. Do not leave fill arguments empty—copy the value from the goal or prior observations.",
    "Provide one action per field (email, password, etc.) before submitting forms.",
  ],
});

export const criticAgent = new Agent({
  name: "atlas-critic",
  model: "openai/gpt-4.1",
  memory,
  instructions: [
    "You are the Critic. For each candidate, consider the cognitive-map look-ahead (o_hat).",
    "Score candidates in [-1,1] for goal alignment, recoverability, and plan consistency.",
    "Prefer actions that expose new affordances while avoiding dead-ends or irreversible transitions.",
    "Down-rank candidates that submit forms without first filling required fields with the goal-specified values.",
  ],
});

// ---------- helpers with structured schemas ----------

const PlanSchema = z.object({
  subgoals: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      successPredicate: z.string(),
    })
  ),
});

export async function plan(goal: string, o0: Observation): Promise<Plan> {
  logInfo("Planner agent invoked", { goal, url: o0.url, title: o0.title });
  const res = await plannerAgent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: `Goal: ${goal}\nStart: ${o0.url} | ${o0.title}` },
    ],
    { structuredOutput: { schema: PlanSchema } }
  );
  const planResult = (res.object as Plan) ?? { subgoals: [] };
  logInfo("Planner agent response received", { plan: planResult });
  return planResult;
}

const ActionSchema = z.object({
  description: z.string(),
  selector: z.string().nullable(),
  method: z.string().nullable(),
  arguments: z.array(z.string()).nullable(),
  instruction: z.string().nullable(),
});

const CandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        rationale: z.string(),
        action: ActionSchema,
      })
    )
    .min(1)
    .max(5),
});

/**
 * Generic, keyword-free summary of current input state.
 * Separates filled and empty inputs to make state explicit.
 */
function summarizeFormState(o: Observation) {
  const inputs = (o.affordances as any[]).filter(a => a?.fieldInfo?.tagName === "input");

  // Separate filled and empty inputs for clarity
  const filledInputs: string[] = [];
  const emptyInputs: string[] = [];

  inputs.forEach(a => {
    const fi = a.fieldInfo ?? {};
    const id = fi.name || fi.id || fi.label || a.description || "";
    const type = fi.type || "text";
    const req = fi.required ? "required" : "optional";
    const val = (a.currentValue ?? fi.value ?? "") as string;
    const hasValue = val && String(val).length > 0;

    const entry = `• ${id} [${type}, ${req}]`;
    if (hasValue) {
      // Show actual value for filled inputs
      const displayValue = type === "password" ? "***" : val.substring(0, 50);
      filledInputs.push(`${entry} = "${displayValue}"`);
    } else {
      emptyInputs.push(entry);
    }
  });

  const requiredEmpty = inputs.filter(a => {
    const fi = a.fieldInfo ?? {};
    const val = (a.currentValue ?? fi.value ?? "") as string;
    return !!fi.required && String(val).length === 0;
  }).length;

  return {
    filledInputs: filledInputs.join("\n"),
    emptyInputs: emptyInputs.join("\n"),
    requiredEmpty
  };
}

export async function propose(
  goal: string,
  P: Plan,
  o: Observation,
  N = 3
): Promise<Candidate[]> {
  const affordanceHints = o.affordances
    .map(a => `- ${a.description}${(a as any).selector ? ` (selector=${(a as any).selector})` : ""}`)
    .join("\n");
  const fs = summarizeFormState(o);

  logInfo("Actor agent invoked", { goal, subgoals: P.subgoals, url: o.url, title: o.title, beam: N });

  const promptContent = `Goal: ${goal}
Plan:
${P.subgoals.map(s => `• ${s.text} [${s.successPredicate}]`).join("\n")}
Page: ${o.url} | ${o.title}

Visible affordances:
${affordanceHints}

Observed input state:
${fs.filledInputs.length > 0 ? `ALREADY FILLED (do NOT re-fill these):\n${fs.filledInputs}` : 'No inputs filled yet'}
${fs.emptyInputs.length > 0 ? `\nSTILL EMPTY (can be filled):\n${fs.emptyInputs}` : ''}
Required inputs still empty: ${fs.requiredEmpty}

CRITICAL RULE: Only propose 'fill' actions for inputs listed as "STILL EMPTY". Do NOT re-fill inputs shown as "ALREADY FILLED" - they already contain the correct values.
When all required inputs are filled (Required inputs still empty: 0), propose clicking submit/next buttons instead.`;

  // Log the full prompt for debugging LLM reasoning
  logDebug("Actor agent prompt", { prompt: promptContent });

  const res = await actorAgent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: promptContent },
    ],
    { structuredOutput: { schema: CandidatesSchema } }
  );
  const candidates = res.object?.candidates as Candidate[] || [];
  logInfo("Actor agent response received", { candidateCount: candidates.length });
  logDebug("Actor agent candidates detail", { candidates });
  return candidates;
}

const CritiqueSchema = z.object({
  chosenIndex: z.number(),
  ranked: z.array(
    z.object({ index: z.number(), value: z.number(), reason: z.string() })
  ),
});

export async function critique(
  goal: string,
  P: Plan,
  o: Observation,
  candidates: Candidate[],
  lookaheads: (Observation | null)[],
): Promise<Critique> {
  logInfo("Critic agent invoked", {
    goal,
    subgoals: P.subgoals,
    url: o.url,
    title: o.title,
    candidateCount: candidates.length,
  });
  const fs = summarizeFormState(o);
  const candBlock = candidates
    .map((c, i) => `#${i} ${c.action.description} | selector=${c.action.selector ?? ""} | method=${c.action.method ?? ""}`)
    .join("\n");
  const laBlock = lookaheads
    .map((h, i) => `#${i} => ${h ? `${h.title} @ ${h.url}` : "UNKNOWN"}`)
    .join("\n");

  const promptContent = `Goal: ${goal}
Plan: ${P.subgoals.map(s => s.text).join(" / ")}
Observation: ${o.title} @ ${o.url}

Observed input state:
${fs.filledInputs.length > 0 ? `ALREADY FILLED:\n${fs.filledInputs}` : 'No inputs filled yet'}
${fs.emptyInputs.length > 0 ? `\nSTILL EMPTY:\n${fs.emptyInputs}` : ''}
Required inputs still empty: ${fs.requiredEmpty}

Candidates:
${candBlock}

Lookahead (cognitive map):
${laBlock}

CRITICAL: Down-rank candidates that try to re-fill inputs shown as "ALREADY FILLED".
When Required inputs still empty = 0, prefer candidates that advance the flow (e.g., clicking Next/Submit buttons).
Score each in [-1,1] and pick best index as 'chosenIndex'.`;

  // Log the full prompt for debugging LLM reasoning
  logDebug("Critic agent prompt", { prompt: promptContent });

  const res = await criticAgent.generate(
    [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: promptContent },
    ],
    { structuredOutput: { schema: CritiqueSchema } }
  );
  const critiqueResult = (res.object as Critique) ?? { chosenIndex: 0, ranked: [] };
  logInfo("Critic agent response received", { critique: critiqueResult });
  logDebug("Critic agent ranked detail", { ranked: critiqueResult.ranked });
  return critiqueResult;
}
