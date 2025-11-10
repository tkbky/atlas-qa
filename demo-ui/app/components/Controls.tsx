"use client";

import { useState } from "react";

type ControlsProps = {
  onStart: (goal: string, startUrl: string, env: string, beamSize: number, maxSteps: number) => void;
  onStop: () => void;
  isRunning: boolean;
};

export function Controls({ onStart, onStop, isRunning }: ControlsProps) {
  const [goal, setGoal] = useState("Add 2 books into the cart. Check the cart and verify the books are added.");
  const [startUrl, setStartUrl] = useState("https://amazon.sg");
  const [env, setEnv] = useState("LOCAL");
  const [beamSize, setBeamSize] = useState(3);
  const [maxSteps, setMaxSteps] = useState(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRunning && goal && startUrl) {
      onStart(goal, startUrl, env, beamSize, maxSteps);
    }
  };

  return (
    <div style={{ padding: "0" }}>
      <form onSubmit={handleSubmit}>
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
            Goal
          </label>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
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
            disabled={isRunning || !goal || !startUrl}
            style={{
              padding: "8px 24px",
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor: isRunning || !goal || !startUrl ? "#1a1a1a" : "#00ff00",
              color: isRunning || !goal || !startUrl ? "#555" : "#000",
              border: "1px solid #333",
              fontFamily: "Consolas, Monaco, monospace",
              cursor: isRunning || !goal || !startUrl ? "not-allowed" : "pointer",
              textTransform: "uppercase",
            }}
          >
            {isRunning ? "[Running...]" : "[Start Run]"}
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
