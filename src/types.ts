export type Affordance = {
    selector?: string | null;            // XPath from Stagehand.observe()
    description: string;                 // human-readable
    method?: string | null;              // e.g., "click" | "fill" | "type"
    arguments?: string[] | null;
    instruction?: string | null;         // natural-language fallback for Stagehand.act()
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
