"use client";

import { useState } from "react";

type ControlsProps = {
  onStart: (goal: string, startUrl: string, env: string, beamSize: number, maxSteps: number) => void;
  onStop: () => void;
  isRunning: boolean;
};

export function Controls({ onStart, onStop, isRunning }: ControlsProps) {
  const [goal, setGoal] = useState("Add 2 books into the cart. Check the cart and verify the books are added.");
  const [startUrl, setStartUrl] = useState("https:amazon.sg");
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
    <div style={{ padding: "20px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0 }}>Run Configuration</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Goal:
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isRunning}
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            placeholder="e.g., Fill the signup form with email test@example.com"
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Start URL:
          </label>
          <input
            type="text"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            disabled={isRunning}
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            placeholder="http://localhost:8000"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Environment:
            </label>
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              disabled={isRunning}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <option value="LOCAL">Local</option>
              <option value="BROWSERBASE">Browserbase</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Beam Size (N):
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
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Max Steps:
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
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            disabled={isRunning || !goal || !startUrl}
            style={{
              padding: "10px 30px",
              fontSize: "16px",
              fontWeight: "bold",
              backgroundColor: isRunning ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            {isRunning ? "Running..." : "Start Run"}
          </button>

          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              style={{
                padding: "10px 30px",
                fontSize: "16px",
                fontWeight: "bold",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
