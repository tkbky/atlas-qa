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
          padding: "var(--space-xxl)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-sm)",
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
              border: "1px solid var(--color-border)",
              backgroundColor: isCompleted
                ? "var(--color-accent-muted)"
                : isCurrent
                  ? "var(--color-overlay)"
                  : "var(--color-surface)",
            }}
          >
            <div
              onClick={() => toggleStep(step.step)}
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-lg) var(--space-lg)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-sm)",
                userSelect: "none",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}
              >
                <span style={{ color: "var(--color-text-secondary)" }}>{isExpanded ? "▼" : "▶"}</span>
                <span
                  style={{
                    color: isCompleted
                      ? "var(--color-accent)"
                      : isCurrent
                        ? "var(--color-warning)"
                        : "var(--color-accent)",
                    fontWeight: "bold",
                  }}
                >
                  Step {displayStep}
                </span>
                {isCompleted && (
                  <span style={{ color: "var(--color-accent)", fontSize: "var(--font-size-xs)" }}>
                    [COMPLETED ✓]
                  </span>
                )}
                {isCurrent && !isCompleted && (
                  <span style={{ color: "var(--color-warning)", fontSize: "var(--font-size-xs)" }}>
                    [ACTIVE]
                  </span>
                )}
                {step.selectedAction && (
                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "var(--font-size-sm)",
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
              <div style={{ padding: "var(--space-lg)", borderTop: "1px solid var(--color-border)" }}>
                {/* Plan */}
                {step.plan && (
                  <Section title="Plan">
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "var(--space-xxl)",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      {step.plan.subgoals.map((sg: any) => (
                        <li
                          key={sg.id}
                          style={{ marginBottom: "var(--space-sm)", color: "var(--color-text-secondary)" }}
                        >
                          <span style={{ color: "var(--color-warning)" }}>{sg.text}</span> -{" "}
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
                            marginBottom: "var(--space-lg)",
                            padding: "var(--space-md)",
                            backgroundColor: "var(--color-overlay)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "var(--font-size-sm)",
                              marginBottom: "var(--space-sm)",
                              color: "var(--color-warning)",
                              fontWeight: "bold",
                            }}
                          >
                            Recent Actions (last{" "}
                            {step.inputState.recentActions.length}):
                          </div>
                          <div
                            style={{
                              fontSize: "var(--font-size-xs)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "var(--space-xs)",
                            }}
                          >
                            {step.inputState.recentActions.map(
                              (ra: any, i: number) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    gap: "var(--space-sm)",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <span
                                    style={{ color: "var(--color-text-secondary)", minWidth: "50px" }}
                                  >
                                    Step {ra.step}:
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ color: "var(--color-accent)" }}>
                                      {ra.action.description}
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--color-warning)",
                                        fontStyle: "italic",
                                        marginTop: "var(--space-xxs)",
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
                    <div style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-sm)" }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        required fields empty:
                      </span>{" "}
                      <span style={{ color: "var(--color-warning)" }}>
                        {step.inputState.requiredEmpty}
                      </span>
                    </div>
                    {step.inputState.filledInputs !== undefined &&
                      step.inputState.filledInputs.length > 0 && (
                        <details style={{ marginTop: "var(--space-md)" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "var(--color-text-secondary)",
                              fontSize: "var(--font-size-sm)",
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
                              fontSize: "var(--font-size-xs)",
                              overflow: "auto",
                              backgroundColor: "var(--color-background)",
                              padding: "var(--space-md)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-accent)",
                              marginTop: "var(--space-sm)",
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
                            marginTop: "var(--space-md)",
                            fontSize: "var(--font-size-sm)",
                            color: "var(--color-text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          No inputs filled yet
                        </div>
                      )}
                    {step.inputState.emptyInputs !== undefined &&
                      step.inputState.emptyInputs.length > 0 && (
                        <details style={{ marginTop: "var(--space-md)" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "var(--color-text-secondary)",
                              fontSize: "var(--font-size-sm)",
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
                              fontSize: "var(--font-size-xs)",
                              overflow: "auto",
                              backgroundColor: "var(--color-background)",
                              padding: "var(--space-md)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-accent)",
                              marginTop: "var(--space-sm)",
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
                    <div style={{ display: "grid", gap: "var(--space-md)" }}>
                      {step.candidates.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "var(--space-md)",
                            border: "1px solid var(--color-border)",
                            backgroundColor: "var(--color-background)",
                          }}
                        >
                          <div
                            style={{
                              color: "var(--color-warning)",
                              marginBottom: "var(--space-xs)",
                              fontSize: "var(--font-size-sm)",
                            }}
                          >
                            candidate #{i}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--font-size-sm)",
                              marginBottom: "var(--space-xs)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <span style={{ fontStyle: "italic" }}>
                              rationale:
                            </span>{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {c.rationale}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "var(--font-size-sm)",
                              color: "var(--color-text-secondary)",
                              marginBottom: "var(--space-xs)",
                            }}
                          >
                            <span style={{ fontStyle: "italic" }}>action:</span>{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {c.action.description}
                            </span>
                          </div>
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
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
                    <div style={{ marginBottom: "var(--space-md)", fontSize: "var(--font-size-sm)" }}>
                      <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                        chosen:
                      </span>{" "}
                      <span style={{ color: "var(--color-warning)", fontWeight: "bold" }}>
                        candidate #{step.critique.chosenIndex}
                      </span>
                    </div>
                    {step.critique.ranked &&
                      step.critique.ranked.length > 0 && (
                        <div>
                          <div
                            style={{
                              color: "var(--color-text-secondary)",
                              fontSize: "var(--font-size-sm)",
                              marginBottom: "var(--space-xs)",
                            }}
                          >
                            rankings:
                          </div>
                          <ul
                            style={{
                              margin: "5px 0",
                              paddingLeft: "var(--space-xxl)",
                              fontSize: "var(--font-size-sm)",
                            }}
                          >
                            {step.critique.ranked.map((r: any, i: number) => (
                              <li
                                key={i}
                                style={{ marginBottom: "var(--space-xs)", color: "var(--color-text-secondary)" }}
                              >
                                <span style={{ color: "var(--color-warning)" }}>
                                  #{r.index}
                                </span>{" "}
                                - value:{" "}
                                <span style={{ color: "var(--color-accent)" }}>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                      {step.rationales.map((rationale, idx) => (
                        <div
                          key={`${rationale.agent}-${idx}-${rationale.title ?? "log"}`}
                          style={{
                            padding: "var(--space-md)",
                            border: "1px solid var(--color-border)",
                            backgroundColor: "var(--color-background)",
                            fontSize: "var(--font-size-sm)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "var(--space-md)",
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
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {rationale.title}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              color: "var(--color-accent)",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.4,
                            }}
                          >
                            {rationale.rationale}
                          </div>
                          {rationale.relatedAction && (
                            <div
                              style={{
                                color: "var(--color-text-secondary)",
                                marginTop: "var(--space-sm)",
                                fontStyle: "italic",
                              }}
                            >
                              focus: {rationale.relatedAction}
                            </div>
                          )}
                          {(rationale.prompt || rationale.output) && (
                            <div
                              style={{
                                marginTop: "var(--space-md)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "var(--space-sm)",
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
                  </Section>
                )}

                {/* Selected Action */}
                {step.selectedAction && (
                  <Section title="Selected Action">
                    <div
                      style={{
                        padding: "var(--space-md)",
                        backgroundColor: "var(--color-overlay)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--color-accent)",
                          fontWeight: "bold",
                          fontSize: "var(--font-size-sm)",
                        }}
                      >
                        {step.selectedAction.description}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--color-text-secondary)",
                          marginTop: "var(--space-xs)",
                        }}
                      >
                        method: {step.selectedAction.method} | selector:{" "}
                        {step.selectedAction.selector || "N/A"}
                      </div>
                      {step.selectedAction.arguments &&
                        step.selectedAction.arguments.length > 0 && (
                          <div
                            style={{
                              fontSize: "var(--font-size-xs)",
                              color: "var(--color-text-secondary)",
                              marginTop: "var(--space-xs)",
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
                        gap: "var(--space-lg)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "var(--font-size-sm)",
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          before:
                        </div>
                        <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-xs)" }}>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            url:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {step.observationBefore.url.substring(0, 30)}...
                            </span>
                          </div>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            title:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {step.observationBefore.title}
                            </span>
                          </div>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            affordances:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {step.observationBefore.affordances.length}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "var(--font-size-sm)",
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          after:
                        </div>
                        <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-xs)" }}>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            url:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {step.observationAfter.url.substring(0, 30)}...
                            </span>
                          </div>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            title:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
                              {step.observationAfter.title}
                            </span>
                          </div>
                          <div style={{ color: "var(--color-text-secondary)" }}>
                            affordances:{" "}
                            <span style={{ color: "var(--color-accent)" }}>
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
                    <div style={{ fontSize: "var(--font-size-xs)" }}>
                      <div style={{ marginBottom: "var(--space-xs)" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          from:
                        </span>{" "}
                        <span style={{ color: "var(--color-accent)" }}>
                          {step.edge.fromKey}
                        </span>
                      </div>
                      <div style={{ marginBottom: "var(--space-xs)" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          action:
                        </span>{" "}
                        <span style={{ color: "var(--color-warning)" }}>
                          {step.edge.actionKey}
                        </span>
                      </div>
                      <div style={{ marginBottom: "var(--space-xs)" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          to:
                        </span>{" "}
                        <span style={{ color: "var(--color-accent)" }}>
                          {step.edge.to.url} - {step.edge.to.title}
                        </span>
                      </div>
                      {step.edge.delta && (
                        <div
                          style={{
                            marginTop: "var(--space-sm)",
                            fontStyle: "italic",
                            color: "var(--color-text-muted)",
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
                    <div style={{ fontSize: "var(--font-size-sm)" }}>
                      <div style={{ marginBottom: "var(--space-md)" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          state:
                        </span>{" "}
                        <span
                          style={{
                            color:
                              step.flowAnalysis === "start"
                                ? "var(--color-accent)"
                                : step.flowAnalysis === "end"
                                  ? "var(--color-danger)"
                                  : "var(--color-warning)",
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
                            color: "var(--color-accent)",
                            fontSize: "var(--font-size-xs)",
                            fontStyle: "italic",
                          }}
                        >
                          ✓ Flow boundary detected - this is the starting point
                        </div>
                      )}
                      {step.flowAnalysis === "end" && (
                        <div
                          style={{
                            color: "var(--color-danger)",
                            fontSize: "var(--font-size-xs)",
                            fontStyle: "italic",
                          }}
                        >
                          ✓ Flow boundary detected - this is the end point
                        </div>
                      )}
                      {step.flowAnalysis === "intermediate" && (
                        <div
                          style={{
                            color: "var(--color-warning)",
                            fontSize: "var(--font-size-xs)",
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
                    <div style={{ fontSize: "var(--font-size-sm)" }}>
                      <div style={{ marginBottom: "var(--space-md)" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          verdict:
                        </span>{" "}
                        <span
                          style={{
                            color: step.judgeDecision.isCorrect
                              ? "var(--color-accent)"
                              : "var(--color-danger)",
                            fontWeight: "bold",
                          }}
                        >
                          {step.judgeDecision.isCorrect
                            ? "✓ CORRECT"
                            : "✗ INCORRECT"}
                        </span>
                      </div>
                      {step.judgeDecision.explanation && (
                        <div style={{ marginTop: "var(--space-sm)", fontSize: "var(--font-size-xs)" }}>
                          <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-xs)" }}>
                            explanation:
                          </div>
                          <div
                            style={{ color: "var(--color-warning)", fontStyle: "italic" }}
                          >
                            {step.judgeDecision.explanation}
                          </div>
                        </div>
                      )}
                      {step.judgeDecision.correctState && (
                        <div style={{ marginTop: "var(--space-sm)", fontSize: "var(--font-size-xs)" }}>
                          <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-xs)" }}>
                            correct state:
                          </div>
                          <div
                            style={{
                              color: "var(--color-accent)",
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
        marginBottom: "var(--space-lg)",
        paddingBottom: "var(--space-lg)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          margin: "0 0 8px 0",
          color: "var(--color-warning)",
          fontSize: "var(--font-size-sm)",
          fontWeight: "bold",
          fontFamily: "var(--font-mono)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
