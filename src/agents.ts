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

export async function propose(
  goal: string,
  P: Plan,
  o: Observation,
  N = 3
): Promise<Candidate[]> {
  const affordanceHints = o.affordances
    .slice(0, 20)
    .map(a => `- ${a.description} ${a.selector ? `(selector=${a.selector})` : ""}`)
    .join("\n");

  logInfo("Actor agent invoked", { goal, subgoals: P.subgoals, url: o.url, title: o.title, beam: N });
  const res = await actorAgent.generate(
    [
      { role: "system", content: "Return JSON only." },
      {
        role: "user",
        content:
          `Goal: ${goal}\nPlan:\n${P.subgoals.map(s => `• ${s.text} [${s.successPredicate}]`).join("\n")}\n` +
          `Page: ${o.url} | ${o.title}\nAffordances:\n${affordanceHints}\n` +
          `Produce at most ${N} safe candidates drawn from visible affordances. Use 'instruction' if needed.`,
      },
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
  const candBlock = candidates
    .map((c, i) => `#${i} ${c.action.description} | selector=${c.action.selector ?? ""} | method=${c.action.method ?? ""}`)
    .join("\n");
  const laBlock = lookaheads
    .map((h, i) => `#${i} => ${h ? `${h.title} @ ${h.url}` : "UNKNOWN"}`)
    .join("\n");

  const res = await criticAgent.generate(
    [
      { role: "system", content: "Return JSON only." },
      {
        role: "user",
        content:
          `Goal: ${goal}\nPlan: ${P.subgoals.map(s => s.text).join(" / ")}\n` +
          `Observation: ${o.title} @ ${o.url}\nCandidates:\n${candBlock}\n` +
          `Lookahead (cognitive map):\n${laBlock}\n` +
          `Score each in [-1,1] and pick best index as 'chosenIndex'.`,
      },
    ],
    { structuredOutput: { schema: CritiqueSchema } }
  );
  const critiqueResult = (res.object as Critique) ?? { chosenIndex: 0, ranked: [] };
  logInfo("Critic agent response received", { critique: critiqueResult });
  logDebug("Critic agent ranked detail", { ranked: critiqueResult.ranked });
  return critiqueResult;
}
