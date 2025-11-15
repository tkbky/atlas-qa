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
  onStop: () => void;
  isRunning: boolean;
};

export function Controls({ onStart, onStop, isRunning }: ControlsProps) {
  const [mode, setMode] = useState<"goal" | "flow-discovery">("goal");
  const [goal, setGoal] = useState(
    "Fill out the datetime form with a valid future date and time, then submit it."
  );
  const [flowDescription, setFlowDescription] = useState(
    "explore the sign-up flow"
  );
  const [startUrl, setStartUrl] = useState(
    "http://localhost:3001/datetime-form"
  );
  const [env, setEnv] = useState("LOCAL");
  const [beamSize, setBeamSize] = useState(3);
  const [maxSteps, setMaxSteps] = useState(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveGoal = mode === "goal" ? goal : flowDescription;
    if (!isRunning && effectiveGoal && startUrl) {
      onStart(effectiveGoal, startUrl, env, beamSize, maxSteps, mode);
    }
  };

  return (
    <div style={{ padding: "0" }}>
      <form onSubmit={handleSubmit}>
        {/* Mode Selector */}
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
                disabled={isRunning}
                style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
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
                disabled={isRunning}
                style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
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

        {/* Goal or Flow Description */}
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
          {mode === "goal" ? (
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={isRunning}
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
              placeholder="e.g., Fill the signup form with email test@example.com"
            />
          ) : (
            <input
              type="text"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              disabled={isRunning}
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
              placeholder="e.g., explore the sign-up flow"
            />
          )}
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
            disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
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

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="submit"
            disabled={
              isRunning ||
              (mode === "goal" ? !goal : !flowDescription) ||
              !startUrl
            }
            style={{
              padding: "8px 24px",
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor:
                isRunning ||
                (mode === "goal" ? !goal : !flowDescription) ||
                !startUrl
                  ? "#1a1a1a"
                  : "#00ff00",
              color:
                isRunning ||
                (mode === "goal" ? !goal : !flowDescription) ||
                !startUrl
                  ? "#555"
                  : "#000",
              border: "1px solid #333",
              fontFamily: "Consolas, Monaco, monospace",
              cursor:
                isRunning ||
                (mode === "goal" ? !goal : !flowDescription) ||
                !startUrl
                  ? "not-allowed"
                  : "pointer",
              textTransform: "uppercase",
            }}
          >
            {isRunning
              ? "[Running...]"
              : mode === "goal"
                ? "[Start Run]"
                : "[Discover Flow]"}
          </button>

          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              style={{
                padding: "8px 24px",
                fontSize: "12px",
                fontWeight: "bold",
                backgroundColor: "#ff4444",
                color: "#000",
                border: "1px solid #333",
                fontFamily: "Consolas, Monaco, monospace",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              [Stop]
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
