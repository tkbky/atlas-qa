export type HostSummary = {
  host: string;
  transitionCount: number;
  semanticRuleCount: number;
  lastSeenAt?: string;
};

export type HostSnapshot = {
  host: string;
  transitions: Array<{ actionKey: string; delta?: string; to?: { title?: string; url: string } }>;
  semanticRules: Array<{ id: string; kind: string; note?: string; firstSeenAt?: string }>; // minimal fields for UI
};

export type TestPlanSuggestion = {
  id?: string;
  rank?: number;
  title: string;
  goal: string;
  description: string;
  valueScore: number;
  prerequisites?: string[];
  tags?: string[];
  confidence?: number;
  preconditions?: string;
  steps?: string[];
  expectedResults?: string[];
  playwrightHints?: string[];
};

export type PlanSuggestionResponse = {
  host: string;
  suggestions: TestPlanSuggestion[];
  prompt?: string;
  rawOutput?: string;
};

export type TestGenerationResult = {
  host: string;
  goal: string;
  code: string;
  assumptions: string[];
  usedRules: string[];
  notes?: string;
  prompt?: string;
  rawOutput?: string;
  actionCatalog?: ActionHint[];
};

export type ActionHint = {
  method: string;
  selector?: string | null;
  description?: string;
  arguments?: string[];
};
