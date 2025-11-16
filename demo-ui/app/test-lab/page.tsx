"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  HostSummary,
  HostSnapshot,
  TestPlanSuggestion,
  TestGenerationResult,
  PlanSuggestionResponse,
} from "./types";

type ToastState = {
  message: string;
  tone: "info" | "success" | "error";
};

const fetchJson = async <T,>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return (await res.json()) as T;
};

const formatDate = (value?: string) => {
  if (!value) return "unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function TestLabPage() {
  const [hosts, setHosts] = useState<HostSummary[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostSummary | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshot | null>(null);
  const [suggestions, setSuggestions] = useState<TestPlanSuggestion[]>([]);
  const [goalInput, setGoalInput] = useState<string>("");
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [result, setResult] = useState<TestGenerationResult | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [planDebug, setPlanDebug] = useState<{
    prompt?: string;
    rawOutput?: string;
  } | null>(null);
  const [generatorDebug, setGeneratorDebug] = useState<{
    prompt?: string;
    rawOutput?: string;
  } | null>(null);
  const [showPlanDebug, setShowPlanDebug] = useState(false);
  const [showGeneratorDebug, setShowGeneratorDebug] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    fetchJson<{ hosts: HostSummary[] }>("/api/test-lab/hosts")
      .then(({ hosts: data }) => {
        setHosts(data);
        if (data.length > 0) {
          setSelectedHost((prev) => prev ?? data[0]);
        }
      })
      .catch((error) => {
        setToast({
          message: `Failed to load hosts: ${error.message}`,
          tone: "error",
        });
      });
  }, []);

  useEffect(() => {
    if (!selectedHost) return;
    setLoadingSnapshot(true);
    setSnapshot(null);
    setSuggestions([]);
    setResult(null);
    setPlanDebug(null);
    setGeneratorDebug(null);
    setShowPlanDebug(false);
    setShowGeneratorDebug(false);
    setShowKnowledge(false);
    fetchJson<HostSnapshot>(
      `/api/test-lab/hosts/${encodeURIComponent(selectedHost.host)}`
    )
      .then((data) => {
        setSnapshot(data);
        setToast({
          message: `Loaded knowledge snapshot for ${selectedHost.host}`,
          tone: "info",
        });
      })
      .catch((error) => {
        setToast({
          message: `Failed to load snapshot: ${error.message}`,
          tone: "error",
        });
      })
      .finally(() => setLoadingSnapshot(false));
  }, [selectedHost]);

  const handleSuggest = async () => {
    if (!selectedHost) return;
    setLoadingPlan(true);
    setToast({ message: "Requesting flow suggestions...", tone: "info" });
    try {
      const data = await fetchJson<PlanSuggestionResponse>(
        `/api/test-lab/hosts/${encodeURIComponent(selectedHost.host)}/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt }),
        }
      );
      setSuggestions(data.suggestions);
      setPlanDebug({ prompt: data.prompt, rawOutput: data.rawOutput });
      setShowPlanDebug(false);
      if (data.suggestions[0]) {
        setGoalInput(data.suggestions[0].goal);
      }
      setToast({ message: "Plan suggestions ready", tone: "success" });
    } catch (error) {
      setToast({
        message: `Suggestion failed: ${(error as Error).message}`,
        tone: "error",
      });
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleGenerate = async (goalOverride?: string) => {
    if (!selectedHost) return;
    const goal = goalOverride || goalInput;
    if (!goal.trim()) {
      setToast({ message: "Describe the flow goal first", tone: "error" });
      return;
    }
    setLoadingGenerate(true);
    setToast({ message: "Generating Playwright test...", tone: "info" });
    try {
      const data = await fetchJson<TestGenerationResult>(
        `/api/test-lab/hosts/${encodeURIComponent(selectedHost.host)}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, userPrompt }),
        }
      );
      setResult(data);
      setGeneratorDebug({ prompt: data.prompt, rawOutput: data.rawOutput });
      setShowGeneratorDebug(false);
      setGoalInput(goal);
      setToast({ message: "Test ready", tone: "success" });
    } catch (error) {
      setToast({
        message: `Generation failed: ${(error as Error).message}`,
        tone: "error",
      });
    } finally {
      setLoadingGenerate(false);
    }
  };

  const sortedHosts = useMemo(() => {
    return [...hosts].sort((a, b) =>
      (b.lastSeenAt ?? "") > (a.lastSeenAt ?? "") ? 1 : -1
    );
  }, [hosts]);

  return (
    <div style={{ display: "flex", height: "100%", color: "#f5f5f5" }}>
      <aside
        style={{
          width: "280px",
          borderRight: "1px solid #222",
          padding: "16px",
          overflowY: "auto",
          backgroundColor: "#050505",
        }}
      >
        <h2 style={{ fontSize: "14px", marginBottom: "12px" }}>
          Knowledge Hosts
        </h2>
        {sortedHosts.map((host) => (
          <button
            key={host.host}
            onClick={() => setSelectedHost(host)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              marginBottom: "8px",
              padding: "10px",
              border:
                selectedHost?.host === host.host
                  ? "1px solid #00ff99"
                  : "1px solid #222",
              background: selectedHost?.host === host.host ? "#111" : "#0a0a0a",
              color: "inherit",
              fontFamily: "Consolas, Monaco, monospace",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              {host.host}
            </div>
            <div style={{ fontSize: "11px", color: "#aaa" }}>
              {host.semanticRuleCount} semantic rules · {host.transitionCount}{" "}
              edges
            </div>
            <div style={{ fontSize: "10px", color: "#777" }}>
              Seen {formatDate(host.lastSeenAt)}
            </div>
          </button>
        ))}
        {sortedHosts.length === 0 && !loadingSnapshot && (
          <div style={{ fontSize: "12px", color: "#777" }}>
            Run Atlas to populate knowledge.
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        <header style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "14px", marginBottom: "8px" }}>
            ATLAS - Test Lab
          </h1>
          <p style={{ color: "#aaa", fontSize: "10px" }}>
            Generate Playwright test ideas and scripts directly from the
            knowledge store.
          </p>
        </header>

        {selectedHost && (
          <section
            style={{
              border: "1px solid #222",
              padding: "16px",
              marginBottom: "16px",
              backgroundColor: "#080808",
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div>
                <strong>{selectedHost.host}</strong>
                <div style={{ fontSize: "11px", color: "#888" }}>
                  {selectedHost.semanticRuleCount} semantic ·{" "}
                  {selectedHost.transitionCount} edges
                </div>
              </div>
              <button
                onClick={handleSuggest}
                disabled={loadingPlan || loadingSnapshot}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  backgroundColor: "#101010",
                  border: "1px solid #00ff99",
                  color: loadingPlan ? "#555" : "#00ff99",
                  cursor: loadingPlan ? "not-allowed" : "pointer",
                }}
              >
                {loadingPlan ? "Suggesting..." : "Suggest flows"}
              </button>
            </div>
            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  fontSize: "11px",
                  color: "#888",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Optional instructions
              </label>
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g. focus on onboarding flows"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #333",
                  backgroundColor: "#050505",
                  color: "#f5f5f5",
                  fontFamily: "Consolas, Monaco, monospace",
                }}
              />
              {snapshot && !loadingSnapshot && (
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setShowKnowledge((prev) => !prev)}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #444",
                      backgroundColor: "#0f0f0f",
                      color: "#ddd",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {showKnowledge ? "Hide" : "Show"} knowledge snapshot
                  </button>
                  {showKnowledge && (
                    <div
                      style={{
                        marginTop: "10px",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      <div style={{ border: "1px solid #333", padding: "8px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginBottom: "6px",
                          }}
                        >
                          Semantic rules ({snapshot.semanticRules.length})
                        </div>
                        <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                          {snapshot.semanticRules.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "#666" }}>
                              No semantic rules stored yet.
                            </div>
                          ) : (
                            <ul
                              style={{
                                fontSize: "11px",
                                color: "#bbb",
                                paddingLeft: "16px",
                                margin: 0,
                              }}
                            >
                              {snapshot.semanticRules.map((rule) => (
                                <li key={rule.id}>
                                  <strong>{rule.kind}</strong> —{" "}
                                  {rule.note || rule.firstSeenAt || "unknown"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div style={{ border: "1px solid #333", padding: "8px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginBottom: "6px",
                          }}
                        >
                          Cognitive map edges ({snapshot.transitions.length})
                        </div>
                        <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                          {snapshot.transitions.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "#666" }}>
                              No transitions stored yet.
                            </div>
                          ) : (
                            <ul
                              style={{
                                fontSize: "11px",
                                color: "#bbb",
                                paddingLeft: "16px",
                                margin: 0,
                              }}
                            >
                              {snapshot.transitions.map((edge, idx) => (
                                <li key={`${edge.actionKey}-${idx}`}>
                                  {edge.delta || edge.actionKey} ⇒{" "}
                                  {edge.to?.title || edge.to?.url || "unknown"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div style={{ border: "1px solid #333", padding: "8px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginBottom: "6px",
                          }}
                        >
                          Affordances (from latest states)
                        </div>
                        <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                          {snapshot.transitions.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "#666" }}>
                              No affordances recorded yet.
                            </div>
                          ) : (
                            <ul
                              style={{
                                fontSize: "11px",
                                color: "#bbb",
                                paddingLeft: "16px",
                                margin: 0,
                              }}
                            >
                              {snapshot.transitions
                                .flatMap((edge) => edge.to?.affordances ?? [])
                                .slice(0, 30)
                                .map((aff, idx) => {
                                  const label =
                                    aff.description ||
                                    aff.fieldInfo?.label ||
                                    aff.fieldInfo?.placeholder ||
                                    aff.selector ||
                                    "(unknown)";
                                  return (
                                    <li key={`${aff.selector ?? label}-${idx}`}>
                                      {aff.method ?? "action"} · {label}
                                      {aff.selector &&
                                        label !== aff.selector && (
                                          <span style={{ color: "#666" }}>
                                            {" "}
                                            (selector: {aff.selector})
                                          </span>
                                        )}
                                    </li>
                                  );
                                })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {planDebug?.prompt && (
                <div style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowPlanDebug((prev) => !prev)}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #444",
                      backgroundColor: "#0f0f0f",
                      color: "#ddd",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {showPlanDebug ? "Hide" : "Show"} plan prompt & output
                  </button>
                  {showPlanDebug && (
                    <div
                      style={{ marginTop: "8px", display: "grid", gap: "8px" }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          Prompt
                        </div>
                        <pre
                          style={{
                            backgroundColor: "#010101",
                            border: "1px solid #222",
                            padding: "8px",
                            color: "#00ff99",
                            whiteSpace: "pre-wrap",
                            fontSize: "11px",
                          }}
                        >
                          {planDebug.prompt}
                        </pre>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          Model output
                        </div>
                        <pre
                          style={{
                            backgroundColor: "#010101",
                            border: "1px solid #222",
                            padding: "8px",
                            color: "#00bfff",
                            whiteSpace: "pre-wrap",
                            fontSize: "11px",
                          }}
                        >
                          {planDebug.rawOutput || "(no text)"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {suggestions.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>
              Suggested flows
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {suggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.goal}-${idx}`}
                  style={{
                    border: "1px solid #222",
                    padding: "12px",
                    backgroundColor: "#0a0a0a",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                        {suggestion.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "#888" }}>
                        {suggestion.goal}
                      </div>
                      {suggestion.preconditions && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#777",
                            marginTop: "2px",
                          }}
                        >
                          Preconditions: {suggestion.preconditions}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleGenerate(suggestion.goal)}
                      disabled={loadingGenerate}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #00bfff",
                        backgroundColor: "#051016",
                        color: "#00bfff",
                        fontSize: "11px",
                        cursor: loadingGenerate ? "not-allowed" : "pointer",
                      }}
                    >
                      Use plan
                    </button>
                  </div>
                  <div
                    style={{ fontSize: "12px", color: "#aaa", margin: "8px 0" }}
                  >
                    {suggestion.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      flexWrap: "wrap",
                      fontSize: "11px",
                      color: "#bbb",
                    }}
                  >
                    {suggestion.steps && (
                      <details style={{ flex: 1 }}>
                        <summary
                          style={{ cursor: "pointer", color: "#00ff99" }}
                        >
                          Steps
                        </summary>
                        <ol style={{ paddingLeft: "18px", marginTop: "6px" }}>
                          {suggestion.steps.map((step, stepIdx) => (
                            <li key={`${suggestion.goal}-step-${stepIdx}`}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                    {suggestion.expectedResults && (
                      <details style={{ flex: 1 }}>
                        <summary
                          style={{ cursor: "pointer", color: "#00ff99" }}
                        >
                          Expected
                        </summary>
                        <ul style={{ paddingLeft: "18px", marginTop: "6px" }}>
                          {suggestion.expectedResults.map((line, resIdx) => (
                            <li key={`${suggestion.goal}-res-${resIdx}`}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {suggestion.playwrightHints && (
                      <details style={{ flex: 1 }}>
                        <summary
                          style={{ cursor: "pointer", color: "#00bfff" }}
                        >
                          Hints
                        </summary>
                        <ul style={{ paddingLeft: "18px", marginTop: "6px" }}>
                          {suggestion.playwrightHints.map((hint, hintIdx) => (
                            <li key={`${suggestion.goal}-hint-${hintIdx}`}>
                              {hint}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            border: "1px solid #222",
            padding: "16px",
            backgroundColor: "#080808",
          }}
        >
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>
            Custom request
          </h3>
          <textarea
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="Describe the flow to test (e.g., Generate sign-up flow test cases for https://example.com)"
            rows={3}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #333",
              backgroundColor: "#050505",
              color: "#f5f5f5",
              resize: "vertical",
              fontFamily: "Consolas, Monaco, monospace",
            }}
          />
          <div style={{ marginTop: "10px" }}>
            <button
              onClick={() => handleGenerate()}
              disabled={loadingGenerate || loadingSnapshot || !selectedHost}
              style={{
                padding: "8px 16px",
                backgroundColor: "#00ff99",
                border: "none",
                color: "#000",
                fontWeight: "bold",
                cursor: loadingGenerate ? "not-allowed" : "pointer",
              }}
            >
              {loadingGenerate ? "Generating..." : "Generate Playwright Tests"}
            </button>
          </div>
        </section>

        <section
          style={{
            marginTop: "20px",
            border: "1px solid #222",
            padding: "16px",
            backgroundColor: "#050505",
          }}
        >
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Output</h3>
          {result ? (
            <>
              <div
                style={{
                  marginBottom: "12px",
                  fontSize: "12px",
                  color: "#aaa",
                }}
              >
                Goal: {result.goal}
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Assumptions:</strong>
                <ul
                  style={{
                    fontSize: "12px",
                    color: "#bbb",
                    paddingLeft: "16px",
                  }}
                >
                  {result.assumptions.length === 0 && <li>None noted.</li>}
                  {result.assumptions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Semantic rules referenced:</strong>
                <ul
                  style={{
                    fontSize: "12px",
                    color: "#bbb",
                    paddingLeft: "16px",
                  }}
                >
                  {result.usedRules.length === 0 && (
                    <li>Knowledge store empty — best effort only.</li>
                  )}
                  {result.usedRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
              {result.notes && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#aaa",
                    marginBottom: "8px",
                  }}
                >
                  Notes: {result.notes}
                </div>
              )}
              <pre
                style={{
                  backgroundColor: "#000",
                  border: "1px solid #222",
                  padding: "12px",
                  overflowX: "auto",
                  color: "#00ff99",
                  fontSize: "12px",
                }}
              >
                {result.code}
              </pre>
              {result.actionCatalog && result.actionCatalog.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <div
                    style={{
                      color: "#888",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    Actions provided to generator:
                  </div>
                  <ul
                    style={{
                      fontSize: "11px",
                      color: "#bbb",
                      paddingLeft: "16px",
                    }}
                  >
                    {result.actionCatalog.map((action, idx) => {
                      const label =
                        action.description ||
                        action.selector ||
                        "(no selector)";
                      return (
                        <li key={`${action.method}-${idx}`}>
                          {action.method} · {label}
                          {action.selector && action.selector !== label && (
                            <span style={{ color: "#666" }}>
                              {" "}
                              (selector: {action.selector})
                            </span>
                          )}
                          {action.arguments && action.arguments.length > 0 && (
                            <span> args={action.arguments.join(", ")}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {generatorDebug?.prompt && (
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setShowGeneratorDebug((prev) => !prev)}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #444",
                      backgroundColor: "#0f0f0f",
                      color: "#ddd",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {showGeneratorDebug ? "Hide" : "Show"} generator prompt &
                    output
                  </button>
                  {showGeneratorDebug && (
                    <div
                      style={{ marginTop: "8px", display: "grid", gap: "8px" }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          Prompt
                        </div>
                        <pre
                          style={{
                            backgroundColor: "#010101",
                            border: "1px solid #222",
                            padding: "8px",
                            color: "#00ff99",
                            whiteSpace: "pre-wrap",
                            fontSize: "11px",
                          }}
                        >
                          {generatorDebug.prompt}
                        </pre>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          Model output
                        </div>
                        <pre
                          style={{
                            backgroundColor: "#010101",
                            border: "1px solid #222",
                            padding: "8px",
                            color: "#00bfff",
                            whiteSpace: "pre-wrap",
                            fontSize: "11px",
                          }}
                        >
                          {generatorDebug.rawOutput || "(no text)"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: "12px", color: "#777" }}>
              Generate a test to see the output.
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 16px",
            borderRadius: "4px",
            backgroundColor:
              toast.tone === "error"
                ? "#531416"
                : toast.tone === "success"
                  ? "#0f3b26"
                  : "#1a1a1a",
            color: "#f5f5f5",
            fontSize: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
