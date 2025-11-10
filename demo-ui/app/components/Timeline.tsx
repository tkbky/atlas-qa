"use client";

import { useState } from "react";
import type { StepData } from "../types";

type TimelineProps = {
  steps: StepData[];
  currentStep: number;
};

export function Timeline({ steps, currentStep }: TimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (step: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSteps(newExpanded);
  };

  if (steps.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
        No steps yet. Start a run to see the timeline.
      </div>
    );
  }

  return (
    <div style={{ padding: "10px" }}>
      <h2>Agent Collaboration Timeline</h2>
      {steps.map((step) => {
        const isExpanded = expandedSteps.has(step.step);
        const isCurrent = step.step === currentStep;

        return (
          <div
            key={step.step}
            style={{
              marginBottom: "20px",
              padding: "15px",
              border: isCurrent ? "2px solid #007bff" : "1px solid #ddd",
              borderRadius: "8px",
              backgroundColor: isCurrent ? "#f0f8ff" : "white",
            }}
          >
            <div
              onClick={() => toggleStep(step.step)}
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                Step {step.step} {isCurrent && <span style={{ color: "#007bff" }}>● Current</span>}
              </h3>
              <span style={{ fontSize: "20px" }}>{isExpanded ? "▼" : "▶"}</span>
            </div>

            {isExpanded && (
              <div style={{ marginTop: "15px" }}>
                {/* Plan */}
                {step.plan && (
                  <Section title="📋 Plan">
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {step.plan.subgoals.map((sg: any) => (
                        <li key={sg.id}>
                          <strong>{sg.text}</strong> - {sg.successPredicate}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Input State (Working Memory) */}
                {step.inputState && (
                  <Section title="🧠 Working Memory (Input State)">
                    <div>
                      <strong>Required fields still empty:</strong> {step.inputState.requiredEmpty}
                    </div>
                    {step.inputState.filledInputs && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                          Filled Inputs
                        </summary>
                        <pre style={{ fontSize: "12px", overflow: "auto", backgroundColor: "#f9f9f9", padding: "10px", borderRadius: "4px" }}>
                          {step.inputState.filledInputs}
                        </pre>
                      </details>
                    )}
                    {step.inputState.emptyInputs && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                          Empty Inputs
                        </summary>
                        <pre style={{ fontSize: "12px", overflow: "auto", backgroundColor: "#f9f9f9", padding: "10px", borderRadius: "4px" }}>
                          {step.inputState.emptyInputs}
                        </pre>
                      </details>
                    )}
                  </Section>
                )}

                {/* Actor: Candidates */}
                {step.candidates && step.candidates.length > 0 && (
                  <Section title="🎭 Actor: Proposed Candidates">
                    <div style={{ display: "grid", gap: "10px" }}>
                      {step.candidates.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px",
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            backgroundColor: "#fafafa",
                          }}
                        >
                          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                            Candidate #{i}
                          </div>
                          <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                            <strong>Rationale:</strong> {c.rationale}
                          </div>
                          <div style={{ fontSize: "13px", color: "#555" }}>
                            <strong>Action:</strong> {c.action.description}
                          </div>
                          <div style={{ fontSize: "12px", color: "#777" }}>
                            Method: {c.action.method || "N/A"} | Selector: {c.action.selector || "N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Critic: Evaluation */}
                {step.critique && (
                  <Section title="⚖️ Critic: Evaluation & Selection">
                    <div style={{ marginBottom: "10px" }}>
                      <strong>Chosen Index:</strong> {step.critique.chosenIndex}
                    </div>
                    {step.critique.ranked && step.critique.ranked.length > 0 && (
                      <div>
                        <strong>Rankings:</strong>
                        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                          {step.critique.ranked.map((r: any, i: number) => (
                            <li key={i}>
                              Candidate #{r.index} - Value: {r.value.toFixed(2)} - {r.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Section>
                )}

                {/* Selected Action */}
                {step.selectedAction && (
                  <Section title="✅ Selected Action">
                    <div style={{ padding: "10px", backgroundColor: "#e7f3ff", borderRadius: "4px" }}>
                      <div style={{ fontWeight: "bold" }}>{step.selectedAction.description}</div>
                      <div style={{ fontSize: "12px", color: "#555", marginTop: "5px" }}>
                        Method: {step.selectedAction.method} | Selector: {step.selectedAction.selector || "N/A"}
                      </div>
                      {step.selectedAction.arguments && step.selectedAction.arguments.length > 0 && (
                        <div style={{ fontSize: "12px", color: "#555" }}>
                          Arguments: {JSON.stringify(step.selectedAction.arguments)}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Observation Changes */}
                {step.observationBefore && step.observationAfter && (
                  <Section title="👁️ Observation (Before → After)">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <strong>Before:</strong>
                        <div style={{ fontSize: "13px", marginTop: "5px" }}>
                          <div>URL: {step.observationBefore.url}</div>
                          <div>Title: {step.observationBefore.title}</div>
                          <div>Affordances: {step.observationBefore.affordances.length}</div>
                        </div>
                      </div>
                      <div>
                        <strong>After:</strong>
                        <div style={{ fontSize: "13px", marginTop: "5px" }}>
                          <div>URL: {step.observationAfter.url}</div>
                          <div>Title: {step.observationAfter.title}</div>
                          <div>Affordances: {step.observationAfter.affordances.length}</div>
                        </div>
                      </div>
                    </div>
                  </Section>
                )}

                {/* Cognitive Map Edge */}
                {step.edge && (
                  <Section title="🗺️ Cognitive Map Update">
                    <div style={{ fontSize: "13px" }}>
                      <div>
                        <strong>From:</strong> {step.edge.fromKey}
                      </div>
                      <div>
                        <strong>Action:</strong> {step.edge.actionKey}
                      </div>
                      <div>
                        <strong>To:</strong> {step.edge.to.url} - {step.edge.to.title}
                      </div>
                      {step.edge.delta && (
                        <div style={{ marginTop: "5px", fontStyle: "italic", color: "#666" }}>
                          {step.edge.delta}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #eee" }}>
      <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>{title}</h4>
      {children}
    </div>
  );
}
