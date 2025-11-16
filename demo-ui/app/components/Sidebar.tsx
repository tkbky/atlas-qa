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

export function Sidebar({ runState, onRetry, retryStep, retryDisabled }: SidebarProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(
      runState.mode === "flow-discovery"
        ? ["url", "flow", "flow-analysis"]
        : ["url", "flow"]
    )
  );

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
        gap: "10px",
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
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
            color: "#00ff00",
            wordBreak: "break-all",
          }}
        >
          {currentUrl}
        </div>
      </Panel>

      {/* Flow Panel */}
      <Panel
        title="Flow"
        isExpanded={expandedPanels.has("flow")}
        onToggle={() => togglePanel("flow")}
      >
        <div
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>status:</span>{" "}
            <span
              style={{
                color:
                  runState.status === "running"
                    ? "#ffb000"
                    : runState.status === "completed"
                      ? "#00ff00"
                      : runState.status === "error"
                        ? "#ff4444"
                        : runState.status === "paused"
                          ? "#8888ff"
                          : "#888",
                fontWeight: "bold",
              }}
            >
              {runState.status}
            </span>
            {runState.status === "completed" && runState.endedReason && (
              <span
                style={{ color: "#888", fontSize: "10px", marginLeft: "8px" }}
              >
                ({runState.endedReason.replace(/_/g, " ")})
              </span>
            )}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>step:</span>{" "}
            <span style={{ color: "#00ff00" }}>
              {currentDisplayStep > 0 ? currentDisplayStep : 0}/{maxSteps}
            </span>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>total actions:</span>{" "}
            <span style={{ color: "#00ff00" }}>{totalSteps}</span>
          </div>
          {runState.status === "error" && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                border: "1px solid #442222",
                backgroundColor: "#1a0000",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  color: "#ff7777",
                  fontWeight: "bold",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Last error
              </div>
              <div style={{ color: "#ffb0b0", fontSize: "11px", lineHeight: 1.4 }}>
                {runState.errorMessage || "Unknown failure"}
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={retryDisabled}
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    padding: "6px 8px",
                    backgroundColor: retryDisabled ? "#222" : "#002200",
                    border: "1px solid #004400",
                    color: retryDisabled ? "#555" : "#00ff00",
                    cursor: retryDisabled ? "not-allowed" : "pointer",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
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
            <div style={{ marginTop: "12px" }}>
              <div style={{ color: "#888", marginBottom: "4px" }}>goal:</div>
              <div
                style={{
                  color: "#ffb000",
                  fontStyle: "italic",
                  fontSize: "11px",
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
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "11px",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#888" }}>nodes:</span>{" "}
          <span style={{ color: "#00ff00" }}>
            {
              new Set(
                runState.cognitiveMap.flatMap((e) => [e.fromKey, e.to.url])
              ).size
            }
          </span>
          {" | "}
          <span style={{ color: "#888" }}>edges:</span>{" "}
          <span style={{ color: "#00ff00" }}>
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
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "11px",
            color: "#888",
          }}
        >
          {runState.semanticRules ? (
            <div style={{ whiteSpace: "pre-wrap", color: "#00ff00" }}>
              {runState.semanticRules}
            </div>
          ) : (
            <div style={{ color: "#555", fontStyle: "italic" }}>
              No semantic rules learned yet for this domain.
              <div style={{ marginTop: "8px", fontSize: "10px" }}>
                Semantic memory stores:
                <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
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
              fontFamily: "Consolas, Monaco, monospace",
              fontSize: "11px",
            }}
          >
            {runState.flowAnalysis?.currentState ? (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#888", marginBottom: "4px" }}>
                    Current State:
                  </div>
                  <div
                    style={{
                      color:
                        runState.flowAnalysis.currentState === "start"
                          ? "#00ff00"
                          : runState.flowAnalysis.currentState === "end"
                            ? "#ff4444"
                            : "#ffb000",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {runState.flowAnalysis.currentState.replace(/_/g, " ")}
                  </div>
                </div>

                {runState.flowAnalysis.judgeDecisions.length > 0 && (
                  <div>
                    <div style={{ color: "#888", marginBottom: "8px" }}>
                      Judge Decisions:
                    </div>
                    <div style={{ fontSize: "10px" }}>
                      {runState.flowAnalysis.judgeDecisions.map((jd, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: "8px",
                            paddingBottom: "8px",
                            borderBottom:
                              i <
                              runState.flowAnalysis!.judgeDecisions.length - 1
                                ? "1px solid #222"
                                : "none",
                          }}
                        >
                          <div style={{ color: "#888" }}>
                            Step {jd.step}: {jd.analysis.replace(/_/g, " ")}
                          </div>
                          <div
                            style={{
                              color: jd.decision.isCorrect
                                ? "#00ff00"
                                : "#ff4444",
                              marginTop: "4px",
                            }}
                          >
                            {jd.decision.isCorrect
                              ? "✓ Correct"
                              : "✗ Incorrect"}
                            {jd.decision.explanation && (
                              <div
                                style={{
                                  color: "#888",
                                  marginTop: "4px",
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
              <div style={{ color: "#555", fontStyle: "italic" }}>
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
              fontFamily: "Consolas, Monaco, monospace",
              fontSize: "10px",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(runState.generatedTest || "");
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "10px",
                  backgroundColor: "#1a1a1a",
                  color: "#00ff00",
                  border: "1px solid #333",
                  fontFamily: "Consolas, Monaco, monospace",
                  cursor: "pointer",
                }}
              >
                [Copy to Clipboard]
              </button>
            </div>
            <pre
              style={{
                backgroundColor: "#000",
                padding: "12px",
                border: "1px solid #333",
                overflowX: "auto",
                margin: 0,
                color: "#00ff00",
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
        border: "1px solid #333",
        backgroundColor: "#0a0a0a",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          backgroundColor: "#1a1a1a",
          borderBottom: isExpanded ? "1px solid #333" : "none",
          fontFamily: "Consolas, Monaco, monospace",
          fontSize: "13px",
          color: "#00ff00",
          fontWeight: "bold",
          userSelect: "none",
        }}
      >
        <span style={{ marginRight: "8px", color: "#888" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
        {title}
      </div>
      {isExpanded && <div style={{ padding: "12px" }}>{children}</div>}
    </div>
  );
}
