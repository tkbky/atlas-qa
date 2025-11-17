"use client";

import { useState } from "react";

type ControlsProps = {
  onStart: (
    goal: string,
    startUrl: string,
    env: string,
    beamSize: number,
    maxSteps: number,
    mode: "goal" | "flow-discovery"
  ) => void;
};

export function Controls({ onStart }: ControlsProps) {
  const [mode, setMode] = useState<"goal" | "flow-discovery">("goal");
  const [goal, setGoal] = useState("browse the top 3 articles");
  const [flowDescription, setFlowDescription] = useState(
    "explore the sign-up flow"
  );
  const [startUrl, setStartUrl] = useState("https://news.ycombinator.com");
  const [env, setEnv] = useState("LOCAL");
  const [beamSize, setBeamSize] = useState(3);
  const [maxSteps, setMaxSteps] = useState(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveGoal = mode === "goal" ? goal : flowDescription;
    if (effectiveGoal && startUrl) {
      onStart(effectiveGoal, startUrl, env, beamSize, maxSteps, mode);
    }
  };

  const isDisabled =
    (mode === "goal" ? !goal : !flowDescription) || startUrl.length === 0;

  return (
    <div style={{ padding: 0 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <label
            style={{
              display: "block",
              marginBottom: "var(--space-md)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            Mode
          </label>
          <div style={{ display: "flex", gap: "var(--space-xl)" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-md)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <input
                type="radio"
                value="goal"
                checked={mode === "goal"}
                onChange={(e) =>
                  setMode(e.target.value as "goal" | "flow-discovery")
                }
                style={{ cursor: "pointer" }}
              />
              <span style={{ color: mode === "goal" ? "var(--color-accent)" : "var(--color-text-secondary)" }}>
                Goal Execution
              </span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-md)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <input
                type="radio"
                value="flow-discovery"
                checked={mode === "flow-discovery"}
                onChange={(e) =>
                  setMode(e.target.value as "goal" | "flow-discovery")
                }
                style={{ cursor: "pointer" }}
              />
              <span
                style={{
                  color: mode === "flow-discovery" ? "var(--color-accent)" : "var(--color-text-secondary)",
                }}
              >
                Flow Discovery
              </span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: "var(--space-lg)" }}>
          <label
            style={{
              display: "block",
              marginBottom: "var(--space-xs)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            {mode === "goal" ? "Goal" : "Flow Description"}
          </label>
          <input
            type="text"
            value={mode === "goal" ? goal : flowDescription}
            onChange={(e) =>
              mode === "goal"
                ? setGoal(e.target.value)
                : setFlowDescription(e.target.value)
            }
            style={{
              width: "100%",
              padding: "var(--space-sm) var(--space-md)",
              fontSize: "var(--font-size-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-accent)",
              fontFamily: "var(--font-mono)",
              outline: "none",
            }}
            placeholder={
              mode === "goal"
                ? "e.g., Fill the signup form with email test@example.com"
                : "e.g., explore the sign-up flow"
            }
          />
        </div>

        <div style={{ marginBottom: "var(--space-lg)" }}>
          <label
            style={{
              display: "block",
              marginBottom: "var(--space-xs)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            Start URL
          </label>
          <input
            type="text"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-sm) var(--space-md)",
              fontSize: "var(--font-size-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-accent)",
              fontFamily: "var(--font-mono)",
              outline: "none",
            }}
            placeholder="http://localhost:8000"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "var(--space-lg)",
            marginBottom: "var(--space-lg)",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "var(--space-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              Environment
            </label>
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                fontSize: "var(--font-size-sm)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            >
              <option value="LOCAL">Local</option>
              <option value="BROWSERBASE">Browserbase</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "var(--space-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              Beam Size (N)
            </label>
            <input
              type="number"
              value={beamSize}
              onChange={(e) => setBeamSize(parseInt(e.target.value, 10))}
              min={1}
              max={5}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                fontSize: "var(--font-size-sm)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "var(--space-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
              }}
            >
              Max Steps
            </label>
            <input
              type="number"
              value={maxSteps}
              onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
              min={1}
              max={50}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                fontSize: "var(--font-size-sm)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          style={{
            padding: "var(--space-md) var(--space-xxl)",
            fontSize: "var(--font-size-sm)",
            fontWeight: "bold",
            backgroundColor: isDisabled ? "var(--color-overlay)" : "var(--color-accent)",
            color: isDisabled ? "var(--color-text-muted)" : "var(--color-background)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-mono)",
            cursor: isDisabled ? "not-allowed" : "pointer",
            textTransform: "uppercase",
          }}
        >
          {mode === "goal" ? "[Start Run]" : "[Discover Flow]"}
        </button>
      </form>
    </div>
  );
}
