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
    "CRITICAL METHOD SELECTION RULES:",
    "- For <input> elements: use method='fill' with the value as first argument",
    "- For <input type='datetime-local'>: use method='fill' with ISO format 'YYYY-MM-DDThh:mm' (e.g., '2024-12-25T14:30')",
    "  - Must use future date/time if the goal requires 'future' or 'next' availability",
    "  - Generate a date approximately 7-30 days in the future with a reasonable time (e.g., 14:30 or 10:00)",
    "- For <select> elements: use method='selectOption' with the option value(s) as first argument",
    "  - Single select: pass single value string matching an option's value attribute",
    "  - Multi-select: pass ARRAY of individual option values, e.g., ['cooking', 'painting'] NOT 'cooking, painting'",
    "- For <textarea> elements: use method='fill' with the text as first argument",
    "- For spinbutton controls (if datetime-local not available): use method='fill' with appropriate values",
    "- For checkboxes/radios: use method='click' (no arguments needed)",
    "- For buttons/links: use method='click' (no arguments needed)",
    "Do not leave fill/selectOption arguments empty—copy the value from the goal or prior observations.",
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
    "IMPORTANT: If the goal explicitly requires filling an optional field, prioritize that over advancing.",
    "Check goal/plan requirements before skipping 'optional' fields - they may be required by the task.",
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
 * Helper to identify form control elements.
 * Includes all HTML form controls that can hold values: input, select, textarea.
 * Also includes spinbutton controls (often used for date/time widgets).
 */
export function isFormControl(affordance: any): boolean {
  const tagName = affordance?.fieldInfo?.tagName;
  const type = affordance?.fieldInfo?.type;
  const description = affordance?.description?.toLowerCase() || "";

  // Standard form controls with proper fieldInfo
  if (["input", "select", "textarea"].includes(tagName)) {
    return true;
  }

  // Explicitly check for datetime-local inputs
  if (tagName === "input" && type === "datetime-local") {
    return true;
  }

  // DateTime/spinbutton controls (may lack fieldInfo but are form inputs)
  if (description.includes("spinbutton") && description.includes("selecting")) {
    return true;
  }

  // Check description for datetime-local inputs
  if (description.includes("datetime-local")) {
    return true;
  }

  return false;
}

/**
 * Determine the correct interaction method based on element type.
 * This ensures we use the appropriate method for each form control type.
 */
export function getMethodForElement(affordance: any): string {
  const fi = affordance?.fieldInfo ?? {};
  const tagName = fi.tagName;
  const type = fi.type;

  // Select elements require selectOption
  if (tagName === "select") {
    return "selectOption";
  }

  // Checkboxes and radios require click
  if (tagName === "input" && (type === "checkbox" || type === "radio")) {
    return "click";
  }

  // Text inputs, textareas, and other input types use fill
  if (tagName === "input" || tagName === "textarea") {
    return "fill";
  }

  // Default for buttons, links, etc.
  return "click";
}

/**
 * Generic, keyword-free summary of current input state.
 * Separates filled and empty inputs to make state explicit.
 */
function summarizeFormState(o: Observation) {
  const formControls = (o.affordances as any[]).filter(isFormControl);

  // Separate filled and empty inputs for clarity
  const filledInputs: string[] = [];
  const emptyInputs: string[] = [];

  formControls.forEach(a => {
    const fi = a.fieldInfo ?? {};
    const description = a.description || "";

    // Handle datetime-local inputs explicitly
    if (fi.type === "datetime-local" || description.toLowerCase().includes("datetime-local")) {
      const id = fi.name || fi.id || fi.label || description;
      const req = fi.required ? "required" : "optional";
      const val = (a.currentValue ?? fi.value ?? "") as string;
      const hasValue = val && String(val).length > 0;
      const entry = `• ${id} [datetime-local, ${req}]`;

      if (hasValue) {
        filledInputs.push(`${entry} = "${val}"`);
      } else {
        emptyInputs.push(entry);
      }
      return; // Skip normal processing
    }

    // Handle datetime spinbuttons (which lack fieldInfo)
    if (description.toLowerCase().includes("spinbutton") && description.toLowerCase().includes("selecting")) {
      const isDateTimeField = description.toLowerCase().includes("availability") ||
                             description.toLowerCase().includes("date") ||
                             description.toLowerCase().includes("time");
      if (isDateTimeField) {
        // Check if it's for required availability field
        const req = description.toLowerCase().includes("availability") ? "required" : "optional";
        const entry = `• Next availability [datetime, ${req}]`;
        // DateTime fields are complex - check if any text is visible (not just placeholder)
        const hasValue = !description.includes("dd") && !description.includes("mm") && !description.includes("yyyy");
        if (!hasValue) {
          emptyInputs.push(entry);
        }
      }
      return; // Skip normal processing for these special controls
    }

    // Normal form control processing
    const id = fi.name || fi.id || fi.label || description;
    const tagName = fi.tagName || "input";
    const type = fi.type || (tagName === "select" ? "select" : tagName === "textarea" ? "textarea" : "text");
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

  const requiredEmpty = formControls.filter(a => {
    const fi = a.fieldInfo ?? {};
    const description = (a.description || "").toLowerCase();

    // Check datetime-local inputs
    if (fi.type === "datetime-local" || description.includes("datetime-local")) {
      const val = (a.currentValue ?? fi.value ?? "") as string;
      return !!fi.required && String(val).length === 0;
    }

    // Check datetime spinbuttons for availability (goal requires this)
    if (description.includes("spinbutton") && description.includes("availability")) {
      // Check if still showing placeholders (not filled)
      return description.includes("dd") || description.includes("mm") || description.includes("yyyy");
    }

    // Normal form controls
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
    .map(a => {
      const fi = (a as any).fieldInfo ?? {};
      const tagName = fi.tagName;
      const type = fi.type;
      let elementInfo = "";

      // Add element type information to help agent choose correct method
      if (tagName === "select") {
        const isMultiple = fi.multiple;
        if (isMultiple) {
          elementInfo = " [MULTI-SELECT element - use selectOption with ARRAY of values]";
        } else {
          elementInfo = " [SELECT element - use selectOption]";
        }
      } else if (tagName === "input" && type === "checkbox") {
        elementInfo = " [CHECKBOX - use click]";
      } else if (tagName === "input" && type === "radio") {
        elementInfo = " [RADIO - use click]";
      } else if (tagName === "textarea") {
        elementInfo = " [TEXTAREA - use fill]";
      } else if (tagName === "input") {
        elementInfo = ` [INPUT type=${type || "text"} - use fill]`;
      }

      return `- ${a.description}${elementInfo}${(a as any).selector ? ` (selector=${(a as any).selector})` : ""}`;
    })
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

CRITICAL RULES:
1. Only propose actions for inputs listed as "STILL EMPTY". Do NOT re-fill "ALREADY FILLED" inputs.
2. Use the EXACT method shown in brackets for each element:
   - [SELECT element - use selectOption] → method: "selectOption" with single value string
   - [MULTI-SELECT element - use selectOption with ARRAY of values] → method: "selectOption" with array like ["value1", "value2"]
   - [INPUT type=X - use fill] → method: "fill"
   - [TEXTAREA - use fill] → method: "fill"
   - [CHECKBOX - use click] → method: "click"
   - [RADIO - use click] → method: "click"
3. For multi-select: pass individual option values as array ["cooking", "painting"], NOT as single string "cooking, painting"
4. When all required inputs are filled (Required inputs still empty: 0), propose clicking submit/next buttons.`;

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
