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
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "11px",
              color: "#888",
              textTransform: "uppercase",
            }}
          >
            Mode
          </label>
          <div style={{ display: "flex", gap: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "12px",
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
              <span style={{ color: mode === "goal" ? "#00ff00" : "#888" }}>
                Goal Execution
              </span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "12px",
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
                  color: mode === "flow-discovery" ? "#00ff00" : "#888",
                }}
              >
                Flow Discovery
              </span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "4px",
              fontSize: "11px",
              color: "#888",
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
              padding: "6px 8px",
              fontSize: "12px",
              border: "1px solid #333",
              backgroundColor: "#0a0a0a",
              color: "#00ff00",
              fontFamily: "Consolas, Monaco, monospace",
              outline: "none",
            }}
            placeholder={
              mode === "goal"
                ? "e.g., Fill the signup form with email test@example.com"
                : "e.g., explore the sign-up flow"
            }
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "4px",
              fontSize: "11px",
              color: "#888",
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
              padding: "6px 8px",
              fontSize: "12px",
              border: "1px solid #333",
              backgroundColor: "#0a0a0a",
              color: "#00ff00",
              fontFamily: "Consolas, Monaco, monospace",
              outline: "none",
            }}
            placeholder="http://localhost:8000"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "11px",
                color: "#888",
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
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                fontFamily: "Consolas, Monaco, monospace",
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
                marginBottom: "4px",
                fontSize: "11px",
                color: "#888",
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
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                fontFamily: "Consolas, Monaco, monospace",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "11px",
                color: "#888",
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
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                fontFamily: "Consolas, Monaco, monospace",
                outline: "none",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          style={{
            padding: "8px 24px",
            fontSize: "12px",
            fontWeight: "bold",
            backgroundColor: isDisabled ? "#1a1a1a" : "#00ff00",
            color: isDisabled ? "#555" : "#000",
            border: "1px solid #333",
            fontFamily: "Consolas, Monaco, monospace",
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
