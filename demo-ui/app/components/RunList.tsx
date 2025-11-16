"use client";

import { useState } from "react";
import type { RunSummary } from "../types";

type RunListProps = {
  runs: RunSummary[];
  activeRunId: string | null;
  onSelect: (runId: string) => void;
  onRename: (runId: string, name: string) => Promise<void> | void;
  onStop: (runId: string) => Promise<void> | void;
};

export function RunList({
  runs,
  activeRunId,
  onSelect,
  onRename,
  onStop,
}: RunListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");

  const handleRename = async () => {
    if (editingId && draftName.trim().length > 0) {
      await onRename(editingId, draftName.trim());
    }
    setEditingId(null);
  };

  const sortedRuns = [...runs].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {sortedRuns.map((run) => {
        const isActive = run.id === activeRunId;
        const isEditing = editingId === run.id;
        const statusColor =
          run.status === "running"
            ? "#ffb000"
            : run.status === "stopping"
              ? "#ff8800"
              : run.status === "completed"
                ? "#00ff00"
                : run.status === "paused"
                  ? "#8888ff"
                  : "#ff4444";

        return (
          <div
            key={run.id}
            style={{
              border: isActive ? "1px solid #00ff00" : "1px solid #222",
              padding: "10px",
              backgroundColor: isActive ? "#111" : "#050505",
              cursor: "pointer",
              fontFamily: "Consolas, Monaco, monospace",
              fontSize: "12px",
            }}
            onClick={() => onSelect(run.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: statusColor,
                  display: "inline-block",
                }}
              />
              {isEditing ? (
                <input
                  autoFocus
                  value={draftName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename();
                    }
                    if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#000",
                    border: "1px solid #333",
                    color: "#00ff00",
                    padding: "2px 4px",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <span style={{ flex: 1, color: "#fff", fontWeight: "bold" }}>
                  {run.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(run.id);
                  setDraftName(run.name);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
                title="Rename run"
              >
                ✎
              </button>
              {run.status === "running" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onStop(run.id);
                  }}
                  style={{
                    border: "1px solid #333",
                    backgroundColor: "#2a0000",
                    color: "#ff4444",
                    fontSize: "10px",
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
                >
                  Stop
                </button>
              )}
              {run.status === "stopping" && (
                <button
                  onClick={(e) => e.stopPropagation()}
                  disabled
                  style={{
                    border: "1px solid #333",
                    backgroundColor: "#331a00",
                    color: "#ffb000",
                    fontSize: "10px",
                    padding: "2px 6px",
                    cursor: "not-allowed",
                  }}
                >
                  Stopping…
                </button>
              )}
            </div>

            <div style={{ marginTop: "6px", color: "#888" }}>
              <div style={{ fontSize: "11px" }}>{run.goal}</div>
              <div style={{ fontSize: "10px", marginTop: "4px", wordBreak: "break-all" }}>
                {run.startUrl}
              </div>
              <div style={{ fontSize: "10px", marginTop: "4px" }}>
                {new Date(run.createdAt).toLocaleTimeString()} · {run.mode}
              </div>
              {run.status === "error" && run.errorMessage && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "10px",
                    color: "#ff7777",
                    lineHeight: 1.4,
                  }}
                >
                  Error: {run.errorMessage}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {sortedRuns.length === 0 && (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            fontStyle: "italic",
            color: "#555",
            border: "1px dashed #222",
          }}
        >
          No runs yet. Start one to populate the list.
        </div>
      )}
    </div>
  );
}
