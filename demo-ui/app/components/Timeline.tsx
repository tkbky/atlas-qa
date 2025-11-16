"use client";

import { useState, useEffect, useRef } from "react";
import type { StepData } from "../types";

type TimelineProps = {
  steps: StepData[];
  currentStep: number;
  status?: "idle" | "running" | "completed" | "error" | "paused";
};

export function Timeline({ steps, currentStep, status }: TimelineProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);

  const toggleStep = (step: number) => {
    setExpandedStep(expandedStep === step ? null : step);
  };

  // Auto-scroll to current step and auto-expand it
  useEffect(() => {
    if (currentStep >= 0) {
      setExpandedStep(currentStep);
      setTimeout(() => {
        currentStepRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
    }
  }, [currentStep]);

  if (steps.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#555",
          fontFamily: "Consolas, Monaco, monospace",
          fontSize: "12px",
          fontStyle: "italic",
        }}
      >
        no steps yet - start a run to see the timeline
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      {steps.map((step) => {
        const isExpanded = expandedStep === step.step;
        const isCurrent = step.step === currentStep;
        const isLastStep = step.step === Math.max(...steps.map((s) => s.step));
        const isCompleted = isLastStep && status === "completed";
        const displayStep = (step.logicalStep ?? step.step) + 1;

        return (
          <div
            key={step.step}
            ref={isCurrent ? currentStepRef : null}
            style={{
              marginBottom: "1px",
              border: "1px solid #333",
              backgroundColor: isCompleted
                ? "#0a2a0a"
                : isCurrent
                  ? "#1a1a1a"
                  : "#0a0a0a",
            }}
          >
            <div
              onClick={() => toggleStep(step.step)}
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                fontFamily: "Consolas, Monaco, monospace",
                fontSize: "12px",
                userSelect: "none",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span style={{ color: "#888" }}>{isExpanded ? "▼" : "▶"}</span>
                <span
                  style={{
                    color: isCompleted
                      ? "#00ff00"
                      : isCurrent
                        ? "#ffb000"
                        : "#00ff00",
                    fontWeight: "bold",
                  }}
                >
                  Step {displayStep}
                </span>
                {isCompleted && (
                  <span style={{ color: "#00ff00", fontSize: "10px" }}>
                    [COMPLETED ✓]
                  </span>
                )}
                {isCurrent && !isCompleted && (
                  <span style={{ color: "#ffb000", fontSize: "10px" }}>
                    [ACTIVE]
                  </span>
                )}
                {step.selectedAction && (
                  <span
                    style={{
                      color: "#888",
                      fontSize: "11px",
                      fontStyle: "italic",
                    }}
                  >
                    {step.selectedAction.description.substring(0, 60)}
                    {step.selectedAction.description.length > 60 ? "..." : ""}
                  </span>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: "12px", borderTop: "1px solid #333" }}>
                {/* Plan */}
                {step.plan && (
                  <Section title="Plan">
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "20px",
                        fontSize: "11px",
                      }}
                    >
                      {step.plan.subgoals.map((sg: any) => (
                        <li
                          key={sg.id}
                          style={{ marginBottom: "6px", color: "#888" }}
                        >
                          <span style={{ color: "#ffb000" }}>{sg.text}</span> -{" "}
                          {sg.successPredicate}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Input State (Working Memory) */}
                {step.inputState && (
                  <Section title="Working Memory">
                    {/* Recent Actions - Show prominently at the top */}
                    {step.inputState.recentActions &&
                      step.inputState.recentActions.length > 0 && (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "8px",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #444",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              marginBottom: "6px",
                              color: "#ffb000",
                              fontWeight: "bold",
                            }}
                          >
                            Recent Actions (last{" "}
                            {step.inputState.recentActions.length}):
                          </div>
                          <div
                            style={{
                              fontSize: "10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            {step.inputState.recentActions.map(
                              (ra: any, i: number) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <span
                                    style={{ color: "#888", minWidth: "50px" }}
                                  >
                                    Step {ra.step}:
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ color: "#00ff00" }}>
                                      {ra.action.description}
                                    </div>
                                    <div
                                      style={{
                                        color: "#ffb000",
                                        fontStyle: "italic",
                                        marginTop: "2px",
                                      }}
                                    >
                                      → {ra.outcome}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Form State Summary */}
                    <div style={{ fontSize: "11px", marginBottom: "6px" }}>
                      <span style={{ color: "#888" }}>
                        required fields empty:
                      </span>{" "}
                      <span style={{ color: "#ffb000" }}>
                        {step.inputState.requiredEmpty}
                      </span>
                    </div>
                    {step.inputState.filledInputs !== undefined &&
                      step.inputState.filledInputs.length > 0 && (
                        <details style={{ marginTop: "8px" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "#888",
                              fontSize: "11px",
                            }}
                          >
                            filled inputs (
                            {
                              step.inputState.filledInputs
                                .split("\n")
                                .filter((l: string) => l.trim()).length
                            }
                            )
                          </summary>
                          <pre
                            style={{
                              fontSize: "10px",
                              overflow: "auto",
                              backgroundColor: "#000",
                              padding: "8px",
                              border: "1px solid #333",
                              color: "#00ff00",
                              marginTop: "6px",
                            }}
                          >
                            {step.inputState.filledInputs}
                          </pre>
                        </details>
                      )}
                    {step.inputState.filledInputs !== undefined &&
                      step.inputState.filledInputs.length === 0 && (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "11px",
                            color: "#555",
                            fontStyle: "italic",
                          }}
                        >
                          No inputs filled yet
                        </div>
                      )}
                    {step.inputState.emptyInputs !== undefined &&
                      step.inputState.emptyInputs.length > 0 && (
                        <details style={{ marginTop: "8px" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "#888",
                              fontSize: "11px",
                            }}
                          >
                            empty inputs (
                            {
                              step.inputState.emptyInputs
                                .split("\n")
                                .filter((l: string) => l.trim()).length
                            }
                            )
                          </summary>
                          <pre
                            style={{
                              fontSize: "10px",
                              overflow: "auto",
                              backgroundColor: "#000",
                              padding: "8px",
                              border: "1px solid #333",
                              color: "#00ff00",
                              marginTop: "6px",
                            }}
                          >
                            {step.inputState.emptyInputs}
                          </pre>
                        </details>
                      )}
                  </Section>
                )}

                {/* Actor: Candidates */}
                {step.candidates && step.candidates.length > 0 && (
                  <Section title="Actor - Proposed Candidates">
                    <div style={{ display: "grid", gap: "8px" }}>
                      {step.candidates.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px",
                            border: "1px solid #333",
                            backgroundColor: "#000",
                          }}
                        >
                          <div
                            style={{
                              color: "#ffb000",
                              marginBottom: "4px",
                              fontSize: "11px",
                            }}
                          >
                            candidate #{i}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              marginBottom: "4px",
                              color: "#888",
                            }}
                          >
                            <span style={{ fontStyle: "italic" }}>
                              rationale:
                            </span>{" "}
                            <span style={{ color: "#00ff00" }}>
                              {c.rationale}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#888",
                              marginBottom: "4px",
                            }}
                          >
                            <span style={{ fontStyle: "italic" }}>action:</span>{" "}
                            <span style={{ color: "#00ff00" }}>
                              {c.action.description}
                            </span>
                          </div>
                          <div style={{ fontSize: "10px", color: "#555" }}>
                            method: {c.action.method || "N/A"} | selector:{" "}
                            {c.action.selector || "N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Critic: Evaluation */}
                {step.critique && (
                  <Section title="Critic - Evaluation">
                    <div style={{ marginBottom: "8px", fontSize: "11px" }}>
                      <span style={{ color: "#888", fontStyle: "italic" }}>
                        chosen:
                      </span>{" "}
                      <span style={{ color: "#ffb000", fontWeight: "bold" }}>
                        candidate #{step.critique.chosenIndex}
                      </span>
                    </div>
                    {step.critique.ranked &&
                      step.critique.ranked.length > 0 && (
                        <div>
                          <div
                            style={{
                              color: "#888",
                              fontSize: "11px",
                              marginBottom: "4px",
                            }}
                          >
                            rankings:
                          </div>
                          <ul
                            style={{
                              margin: "5px 0",
                              paddingLeft: "20px",
                              fontSize: "11px",
                            }}
                          >
                            {step.critique.ranked.map((r: any, i: number) => (
                              <li
                                key={i}
                                style={{ marginBottom: "4px", color: "#888" }}
                              >
                                <span style={{ color: "#ffb000" }}>
                                  #{r.index}
                                </span>{" "}
                                - value:{" "}
                                <span style={{ color: "#00ff00" }}>
                                  {r.value.toFixed(2)}
                                </span>{" "}
                                - {r.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </Section>
                )}

                {/* Agent Rationales */}
                {step.rationales && step.rationales.length > 0 && (
                  <Section title="Agent Rationales">
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {step.rationales.map((rationale, idx) => (
                        <div
                          key={`${rationale.agent}-${idx}-${rationale.title ?? "log"}`}
                          style={{
                            padding: "8px",
                            border: "1px solid #333",
                            backgroundColor: "#000",
                            fontSize: "11px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                color: "#ffb000",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              {rationale.agent}
                            </span>
                            {rationale.title && (
                              <span
                                style={{
                                  color: "#888",
                                  fontStyle: "italic",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {rationale.title}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              color: "#00ff00",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.4,
                            }}
                          >
                            {rationale.rationale}
                          </div>
                          {rationale.relatedAction && (
                            <div
                              style={{
                                color: "#888",
                                marginTop: "6px",
                                fontStyle: "italic",
                              }}
                            >
                              focus: {rationale.relatedAction}
                            </div>
                          )}
                          {(rationale.prompt || rationale.output) && (
                            <div
                              style={{
                                marginTop: "8px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              {rationale.prompt && (
                                <details>
                                  <summary
                                    style={{
                                      cursor: "pointer",
                                      color: "#888",
                                    }}
                                  >
                                    view prompt
                                  </summary>
                                  <pre
                                    style={{
                                      marginTop: "4px",
                                      backgroundColor: "#0a0a0a",
                                      padding: "8px",
                                      border: "1px solid #222",
                                      color: "#00ff00",
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
                                      color: "#888",
                                    }}
                                  >
                                    view output
                                  </summary>
                                  <pre
                                    style={{
                                      marginTop: "4px",
                                      backgroundColor: "#0a0a0a",
                                      padding: "8px",
                                      border: "1px solid #222",
                                      color: "#00ff00",
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
                  </Section>
                )}

                {/* Selected Action */}
                {step.selectedAction && (
                  <Section title="Selected Action">
                    <div
                      style={{
                        padding: "8px",
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #333",
                      }}
                    >
                      <div
                        style={{
                          color: "#00ff00",
                          fontWeight: "bold",
                          fontSize: "11px",
                        }}
                      >
                        {step.selectedAction.description}
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#888",
                          marginTop: "4px",
                        }}
                      >
                        method: {step.selectedAction.method} | selector:{" "}
                        {step.selectedAction.selector || "N/A"}
                      </div>
                      {step.selectedAction.arguments &&
                        step.selectedAction.arguments.length > 0 && (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#888",
                              marginTop: "4px",
                            }}
                          >
                            args:{" "}
                            {JSON.stringify(step.selectedAction.arguments)}
                          </div>
                        )}
                    </div>
                  </Section>
                )}

                {/* Observation Changes */}
                {step.observationBefore && step.observationAfter && (
                  <Section title="Observation">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          before:
                        </div>
                        <div style={{ fontSize: "10px", marginTop: "4px" }}>
                          <div style={{ color: "#888" }}>
                            url:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationBefore.url.substring(0, 30)}...
                            </span>
                          </div>
                          <div style={{ color: "#888" }}>
                            title:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationBefore.title}
                            </span>
                          </div>
                          <div style={{ color: "#888" }}>
                            affordances:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationBefore.affordances.length}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          after:
                        </div>
                        <div style={{ fontSize: "10px", marginTop: "4px" }}>
                          <div style={{ color: "#888" }}>
                            url:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationAfter.url.substring(0, 30)}...
                            </span>
                          </div>
                          <div style={{ color: "#888" }}>
                            title:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationAfter.title}
                            </span>
                          </div>
                          <div style={{ color: "#888" }}>
                            affordances:{" "}
                            <span style={{ color: "#00ff00" }}>
                              {step.observationAfter.affordances.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Section>
                )}

                {/* Cognitive Map Edge */}
                {step.edge && (
                  <Section title="Cognitive Map Update">
                    <div style={{ fontSize: "10px" }}>
                      <div style={{ marginBottom: "4px" }}>
                        <span style={{ color: "#888", fontStyle: "italic" }}>
                          from:
                        </span>{" "}
                        <span style={{ color: "#00ff00" }}>
                          {step.edge.fromKey}
                        </span>
                      </div>
                      <div style={{ marginBottom: "4px" }}>
                        <span style={{ color: "#888", fontStyle: "italic" }}>
                          action:
                        </span>{" "}
                        <span style={{ color: "#ffb000" }}>
                          {step.edge.actionKey}
                        </span>
                      </div>
                      <div style={{ marginBottom: "4px" }}>
                        <span style={{ color: "#888", fontStyle: "italic" }}>
                          to:
                        </span>{" "}
                        <span style={{ color: "#00ff00" }}>
                          {step.edge.to.url} - {step.edge.to.title}
                        </span>
                      </div>
                      {step.edge.delta && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontStyle: "italic",
                            color: "#555",
                          }}
                        >
                          {step.edge.delta}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Flow Analysis */}
                {step.flowAnalysis && (
                  <Section title="Flow Analysis">
                    <div style={{ fontSize: "11px" }}>
                      <div style={{ marginBottom: "8px" }}>
                        <span style={{ color: "#888", fontStyle: "italic" }}>
                          state:
                        </span>{" "}
                        <span
                          style={{
                            color:
                              step.flowAnalysis === "start"
                                ? "#00ff00"
                                : step.flowAnalysis === "end"
                                  ? "#ff4444"
                                  : "#ffb000",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                          }}
                        >
                          {step.flowAnalysis.replace(/_/g, " ")}
                        </span>
                      </div>
                      {step.flowAnalysis === "start" && (
                        <div
                          style={{
                            color: "#00ff00",
                            fontSize: "10px",
                            fontStyle: "italic",
                          }}
                        >
                          ✓ Flow boundary detected - this is the starting point
                        </div>
                      )}
                      {step.flowAnalysis === "end" && (
                        <div
                          style={{
                            color: "#ff4444",
                            fontSize: "10px",
                            fontStyle: "italic",
                          }}
                        >
                          ✓ Flow boundary detected - this is the end point
                        </div>
                      )}
                      {step.flowAnalysis === "intermediate" && (
                        <div
                          style={{
                            color: "#ffb000",
                            fontSize: "10px",
                            fontStyle: "italic",
                          }}
                        >
                          • Intermediate state - continuing exploration
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Judge Decision */}
                {step.judgeDecision && (
                  <Section title="Judge Decision">
                    <div style={{ fontSize: "11px" }}>
                      <div style={{ marginBottom: "8px" }}>
                        <span style={{ color: "#888", fontStyle: "italic" }}>
                          verdict:
                        </span>{" "}
                        <span
                          style={{
                            color: step.judgeDecision.isCorrect
                              ? "#00ff00"
                              : "#ff4444",
                            fontWeight: "bold",
                          }}
                        >
                          {step.judgeDecision.isCorrect
                            ? "✓ CORRECT"
                            : "✗ INCORRECT"}
                        </span>
                      </div>
                      {step.judgeDecision.explanation && (
                        <div style={{ marginTop: "6px", fontSize: "10px" }}>
                          <div style={{ color: "#888", marginBottom: "4px" }}>
                            explanation:
                          </div>
                          <div
                            style={{ color: "#ffb000", fontStyle: "italic" }}
                          >
                            {step.judgeDecision.explanation}
                          </div>
                        </div>
                      )}
                      {step.judgeDecision.correctState && (
                        <div style={{ marginTop: "6px", fontSize: "10px" }}>
                          <div style={{ color: "#888", marginBottom: "4px" }}>
                            correct state:
                          </div>
                          <div
                            style={{
                              color: "#00ff00",
                              textTransform: "uppercase",
                            }}
                          >
                            {step.judgeDecision.correctState.replace(/_/g, " ")}
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "12px",
        paddingBottom: "12px",
        borderBottom: "1px solid #333",
      }}
    >
      <div
        style={{
          margin: "0 0 8px 0",
          color: "#ffb000",
          fontSize: "12px",
          fontWeight: "bold",
          fontFamily: "Consolas, Monaco, monospace",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
