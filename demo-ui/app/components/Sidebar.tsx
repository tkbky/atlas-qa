"use client";

import { useState } from "react";
import type { RunState } from "../types";
import { CognitiveMapView } from "./CognitiveMapView";

type SidebarProps = {
  runState: RunState;
  onRetry?: () => void;
  retryStep?: number;
  retryDisabled?: boolean;
};

export function Sidebar({
  runState,
  onRetry,
  retryStep,
  retryDisabled,
}: SidebarProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(
      runState.mode === "flow-discovery"
        ? ["url", "flow", "flow-analysis"]
        : ["url", "flow"]
    )
  );
  const runLevelRationales = runState.globalRationales ?? [];
  const latestRunRationales = runLevelRationales.slice(-4);

  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId);
    } else {
      newExpanded.add(panelId);
    }
    setExpandedPanels(newExpanded);
  };

  const currentUrl =
    runState.steps.length > 0 &&
    runState.currentStep >= 0 &&
    runState.steps[runState.currentStep]?.observationAfter?.url
      ? runState.steps[runState.currentStep].observationAfter!.url
      : runState.startUrl || "No URL";

  const totalSteps = runState.steps.length;
  const maxSteps = 15; // Could be passed as prop if needed
  const lastStepRecord =
    runState.steps.length > 0
      ? runState.steps[runState.steps.length - 1]
      : null;
  const currentDisplayStep =
    (lastStepRecord?.logicalStep ?? lastStepRecord?.step ?? -1) + 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* URL Panel */}
      <Panel
        title="URL"
        isExpanded={expandedPanels.has("url")}
        onToggle={() => togglePanel("url")}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-accent)",
            wordBreak: "break-all",
          }}
        >
          {currentUrl}
        </div>
      </Panel>

      {/* Run-level rationales */}
      <Panel
        title="Initial Plan + Rationales"
        isExpanded={expandedPanels.has("rationales")}
        onToggle={() => togglePanel("rationales")}
      >
        {latestRunRationales.length === 0 ? (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            Agent rationales will appear here as soon as the planner responds.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-lg)",
            }}
          >
            {latestRunRationales.map((rationale, idx) => (
              <div
                key={`${rationale.agent}-${idx}-${rationale.title ?? "run"}`}
                style={{
                  padding: "var(--space-md)",
                  border: "1px solid var(--color-divider)",
                  backgroundColor: "var(--color-background)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-sm)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-warning)",
                      textTransform: "uppercase",
                      letterSpacing: "var(--letter-spacing-caps)",
                    }}
                  >
                    {rationale.agent}
                  </span>
                  {rationale.title && (
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontStyle: "italic",
                      }}
                    >
                      {rationale.title}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: "var(--color-accent)",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {rationale.rationale}
                </div>
                {(rationale.prompt || rationale.output) && (
                  <div
                    style={{
                      marginTop: "var(--space-sm)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-xs)",
                    }}
                  >
                    {rationale.prompt && (
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          view prompt
                        </summary>
                        <pre
                          style={{
                            marginTop: "var(--space-xs)",
                            backgroundColor: "var(--color-surface)",
                            padding: "var(--space-md)",
                            border: "1px solid var(--color-divider)",
                            color: "var(--color-accent)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {rationale.prompt}
                        </pre>
                      </details>
                    )}
                    {rationale.output && (
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          view output
                        </summary>
                        <pre
                          style={{
                            marginTop: "var(--space-xs)",
                            backgroundColor: "var(--color-surface)",
                            padding: "var(--space-md)",
                            border: "1px solid var(--color-divider)",
                            color: "var(--color-accent)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {rationale.output}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Flow Panel */}
      <Panel
        title="Flow"
        isExpanded={expandedPanels.has("flow")}
        onToggle={() => togglePanel("flow")}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div style={{ marginBottom: "var(--space-md)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>
              status:
            </span>{" "}
            <span
              style={{
                color:
                  runState.status === "running"
                    ? "var(--color-warning)"
                    : runState.status === "stopping"
                      ? "var(--color-warning)"
                      : runState.status === "completed"
                        ? "var(--color-accent)"
                        : runState.status === "error"
                          ? "var(--color-danger)"
                          : runState.status === "paused"
                            ? "var(--color-info)"
                            : "var(--color-text-secondary)",
                fontWeight: "bold",
              }}
            >
              {runState.status}
            </span>
            {runState.status === "completed" && runState.endedReason && (
              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--font-size-xs)",
                  marginLeft: "var(--space-md)",
                }}
              >
                ({runState.endedReason.replace(/_/g, " ")})
              </span>
            )}
          </div>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>step:</span>{" "}
            <span style={{ color: "var(--color-accent)" }}>
              {currentDisplayStep > 0 ? currentDisplayStep : 0}/{maxSteps}
            </span>
          </div>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>
              total actions:
            </span>{" "}
            <span style={{ color: "var(--color-accent)" }}>{totalSteps}</span>
          </div>
          {runState.status === "error" && (
            <div
              style={{
                marginTop: "var(--space-lg)",
                padding: "var(--space-lg)",
                border: "1px solid var(--color-overlay)",
                backgroundColor: "var(--color-overlay)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                style={{
                  color: "var(--color-danger)",
                  fontWeight: "bold",
                  fontSize: "var(--font-size-sm)",
                  textTransform: "uppercase",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Last error
              </div>
              <div
                style={{
                  color: "var(--color-danger)",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: 1.4,
                }}
              >
                {runState.errorMessage || "Unknown failure"}
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={retryDisabled}
                  style={{
                    marginTop: "var(--space-lg)",
                    width: "100%",
                    padding: "var(--space-sm) var(--space-md)",
                    backgroundColor: retryDisabled
                      ? "var(--color-divider)"
                      : "var(--color-accent-muted)",
                    border: "1px solid var(--color-accent)",
                    color: retryDisabled
                      ? "var(--color-text-muted)"
                      : "var(--color-accent)",
                    cursor: retryDisabled ? "not-allowed" : "pointer",
                    fontSize: "var(--font-size-sm)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--letter-spacing-caps)",
                  }}
                >
                  {retryDisabled
                    ? "Retrying..."
                    : `Retry from step #${retryStep ?? Math.max(currentDisplayStep, 1)}`}
                </button>
              )}
            </div>
          )}

          {runState.goal && (
            <div style={{ marginTop: "var(--space-lg)" }}>
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                goal:
              </div>
              <div
                style={{
                  color: "var(--color-warning)",
                  fontStyle: "italic",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {runState.goal}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Cognitive Map Panel */}
      <Panel
        title="Cognitive Map"
        isExpanded={expandedPanels.has("map")}
        onToggle={() => togglePanel("map")}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            marginBottom: "var(--space-md)",
          }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>nodes:</span>{" "}
          <span style={{ color: "var(--color-accent)" }}>
            {
              new Set(
                runState.cognitiveMap.flatMap((e) => [e.fromKey, e.to.url])
              ).size
            }
          </span>
          {" | "}
          <span style={{ color: "var(--color-text-secondary)" }}>
            edges:
          </span>{" "}
          <span style={{ color: "var(--color-accent)" }}>
            {runState.cognitiveMap.length}
          </span>
        </div>
        <CognitiveMapView
          edges={runState.cognitiveMap}
          currentStep={runState.currentStep}
          mini={false}
        />
      </Panel>

      {/* Semantic Memory Panel */}
      <Panel
        title="Semantic Memory"
        isExpanded={expandedPanels.has("memory")}
        onToggle={() => togglePanel("memory")}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          {runState.semanticRules ? (
            <div
              style={{ whiteSpace: "pre-wrap", color: "var(--color-accent)" }}
            >
              {runState.semanticRules}
            </div>
          ) : (
            <div
              style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}
            >
              No semantic rules learned yet for this domain.
              <div
                style={{
                  marginTop: "var(--space-md)",
                  fontSize: "var(--font-size-xs)",
                }}
              >
                Semantic memory stores:
                <ul
                  style={{ margin: "4px 0", paddingLeft: "var(--space-xxl)" }}
                >
                  <li>Site-specific constraints</li>
                  <li>Date/time format rules</li>
                  <li>Non-recoverable actions</li>
                  <li>Rate limits & hazards</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Flow Analysis Panel - only in flow-discovery mode */}
      {runState.mode === "flow-discovery" && (
        <Panel
          title="Flow Analysis"
          isExpanded={expandedPanels.has("flow-analysis")}
          onToggle={() => togglePanel("flow-analysis")}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {runState.flowAnalysis?.currentState ? (
              <>
                <div style={{ marginBottom: "var(--space-lg)" }}>
                  <div
                    style={{
                      color: "var(--color-text-secondary)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    Current State:
                  </div>
                  <div
                    style={{
                      color:
                        runState.flowAnalysis.currentState === "start"
                          ? "var(--color-accent)"
                          : runState.flowAnalysis.currentState === "end"
                            ? "var(--color-danger)"
                            : "var(--color-warning)",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {runState.flowAnalysis.currentState.replace(/_/g, " ")}
                  </div>
                </div>

                {runState.flowAnalysis.judgeDecisions.length > 0 && (
                  <div>
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        marginBottom: "var(--space-md)",
                      }}
                    >
                      Judge Decisions:
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)" }}>
                      {runState.flowAnalysis.judgeDecisions.map((jd, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: "var(--space-md)",
                            paddingBottom: "var(--space-md)",
                            borderBottom:
                              i <
                              runState.flowAnalysis!.judgeDecisions.length - 1
                                ? "1px solid var(--color-divider)"
                                : "none",
                          }}
                        >
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            Step {jd.step}: {jd.analysis.replace(/_/g, " ")}
                          </div>
                          <div
                            style={{
                              color: jd.decision.isCorrect
                                ? "var(--color-accent)"
                                : "var(--color-danger)",
                              marginTop: "var(--space-xs)",
                            }}
                          >
                            {jd.decision.isCorrect
                              ? "✓ Correct"
                              : "✗ Incorrect"}
                            {jd.decision.explanation && (
                              <div
                                style={{
                                  color: "var(--color-text-secondary)",
                                  marginTop: "var(--space-xs)",
                                  fontStyle: "italic",
                                }}
                              >
                                {jd.decision.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                }}
              >
                No flow analysis yet. Analysis will appear as the agent
                explores.
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Test Code Panel - shown when test is generated */}
      {runState.generatedTest && (
        <Panel
          title="Generated Test"
          isExpanded={expandedPanels.has("test-code")}
          onToggle={() => togglePanel("test-code")}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-xs)",
            }}
          >
            <div style={{ marginBottom: "var(--space-md)" }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(runState.generatedTest || "");
                }}
                style={{
                  padding: "var(--space-xs) var(--space-md)",
                  fontSize: "var(--font-size-xs)",
                  backgroundColor: "var(--color-overlay)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >
                [Copy to Clipboard]
              </button>
            </div>
            <pre
              style={{
                backgroundColor: "var(--color-background)",
                padding: "var(--space-lg)",
                border: "1px solid var(--color-border)",
                overflowX: "auto",
                margin: 0,
                color: "var(--color-accent)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {runState.generatedTest}
            </pre>
          </div>
        </Panel>
      )}
    </div>
  );
}

type PanelProps = {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function Panel({ title, isExpanded, onToggle, children }: PanelProps) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "var(--space-md) var(--space-lg)",
          cursor: "pointer",
          backgroundColor: "var(--color-overlay)",
          borderBottom: isExpanded ? "1px solid var(--color-border)" : "none",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-md)",
          color: "var(--color-accent)",
          fontWeight: "bold",
          userSelect: "none",
        }}
      >
        <span
          style={{
            marginRight: "var(--space-md)",
            color: "var(--color-text-secondary)",
          }}
        >
          {isExpanded ? "▼" : "▶"}
        </span>
        {title}
      </div>
      {isExpanded && (
        <div style={{ padding: "var(--space-lg)" }}>{children}</div>
      )}
    </div>
  );
}
