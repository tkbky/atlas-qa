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
  selector?: string | null;            // XPath from Stagehand.observe()
  description: string;                 // human-readable
  method?: string | null;              // e.g., "click" | "fill" | "type"
  arguments?: string[] | null;
  instruction?: string | null;         // natural-language fallback for Stagehand.act()
  currentValue?: string | null;        // observed current field value (for fill actions)
  fieldInfo?: FormFieldInfo;           // additional metadata for form fields
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
    chosenIndex: number;
    ranked: { index: number; value: number; reason: string }[];
  };

  export type Transition = {
    fromKey: string;
    actionKey: string;
    to: Observation;
    delta?: string;
  };
