export type FormFieldOption = {
  value: string;
  label: string;
  selected: boolean;
};

export type FormFieldInfo = {
  tagName: string;
  label?: string | null;
  ariaLabel?: string | null;
  placeholder?: string | null;
  name?: string | null;
  id?: string | null;
  type?: string | null;
  required?: boolean;
  disabled?: boolean;
  value?: string | null;
  checked?: boolean | null;
  multiple?: boolean | null;
  options?: FormFieldOption[] | null;
};

export type Affordance = {
  selector?: string | null; // XPath from Stagehand.observe()
  description: string; // human-readable
  method?: string | null; // e.g., "click" | "fill" | "type"
  arguments?: string[] | null;
  instruction?: string | null; // natural-language fallback for Stagehand.act()
  currentValue?: string | null; // observed current field value (for fill actions)
  fieldInfo?: FormFieldInfo; // additional metadata for form fields
};

export type Observation = {
  url: string;
  title: string;
  affordances: Affordance[];
  pageText?: string;
};

export type Plan = {
  subgoals: { id: string; text: string; successPredicate: string }[];
};

export type Candidate = {
  rationale: string;
  action: Affordance;
};

export type Critique = {
  goalMet: boolean;
  goalMetReason: string;
  chosenIndex: number;
  ranked: { index: number; value: number; reason: string }[];
};

export type Transition = {
  fromKey: string;
  actionKey: string;
  to: Observation;
  delta?: string;
  uncertainty?: number; // U(s,a): 0..1, where 0 = fully confident, 1 = completely uncertain
  visits?: number; // Number of times this transition has been observed
  firstSeenAt?: number; // Timestamp when first recorded
  lastSeenAt?: number; // Timestamp when last observed
};

// --- Recent action tracking for working memory ---

export type RecentAction = {
  step: number;
  action: Affordance;
  outcome: string;
};

// --- Event streaming types for demo UI ---

export type InputState = {
  filledInputs: string;
  emptyInputs: string;
  requiredEmpty: number;
  recentActions: RecentAction[]; // Working memory: recent actions with outcomes
};

export type AtlasEvent =
  | { type: "init"; goal: string; startUrl: string; opts: any }
  | { type: "plan"; plan: Plan }
  | { type: "semantic_rules"; step: number; url: string; rules: string }
  | {
      type: "propose";
      step: number;
      prompt: string;
      candidates: Candidate[];
      inputState: InputState;
    }
  | { type: "critique"; step: number; prompt: string; critique: Critique }
  | { type: "selected_action"; step: number; action: Affordance }
  | { type: "action_executed"; step: number; action: Affordance }
  | {
      type: "observation_after";
      step: number;
      before: Observation;
      after: Observation;
    }
  | { type: "map_update"; step: number; edge: Transition }
  | { type: "replan"; step: number; reason: string; plan: Plan }
  | {
      type: "analysis";
      step: number;
      prompt: string;
      analysis: "start" | "end" | "intermediate";
    }
  | {
      type: "judgement";
      step: number;
      prompt: string;
      decision: {
        isCorrect: boolean;
        explanation?: string;
        correctState?: "start" | "end" | "intermediate";
      };
    }
  | {
      type: "test_generation";
      step: number;
      prompt: string;
      generatedCode: string;
    }
  | {
      type: "done";
      finalObservation: Observation;
      endedReason: string;
      cognitiveMap: Transition[];
    }
  | { type: "error"; message: string };

export type AtlasEventCallback = (event: AtlasEvent) => void | Promise<void>;
