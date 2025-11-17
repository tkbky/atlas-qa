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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {sortedRuns.map((run) => {
        const isActive = run.id === activeRunId;
        const isEditing = editingId === run.id;
        const statusColor =
          run.status === "running"
            ? "var(--color-warning)"
            : run.status === "stopping"
              ? "var(--color-warning)"
              : run.status === "completed"
                ? "var(--color-accent)"
                : run.status === "paused"
                  ? "var(--color-info)"
                  : "var(--color-danger)";

        return (
          <div
            key={run.id}
            style={{
              border: isActive
                ? "1px solid var(--color-accent)"
                : "1px solid var(--color-divider)",
              padding: "var(--space-lg)",
              backgroundColor: isActive ? "var(--color-surface-raised)" : "var(--color-background)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
            }}
            onClick={() => onSelect(run.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
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
                    backgroundColor: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-accent)",
                    padding: "var(--space-xxs) var(--space-xs)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              ) : (
                <span style={{ flex: 1, color: "var(--color-text-primary)", fontWeight: "bold" }}>
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
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  fontSize: "var(--font-size-sm)",
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
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-overlay)",
                    color: "var(--color-danger)",
                    fontSize: "var(--font-size-xs)",
                    padding: "var(--space-xxs) var(--space-sm)",
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
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-overlay)",
                    color: "var(--color-warning)",
                    fontSize: "var(--font-size-xs)",
                    padding: "var(--space-xxs) var(--space-sm)",
                    cursor: "not-allowed",
                  }}
                >
                  Stopping…
                </button>
              )}
            </div>

            <div style={{ marginTop: "var(--space-sm)", color: "var(--color-text-secondary)" }}>
              <div style={{ fontSize: "var(--font-size-sm)" }}>{run.goal}</div>
              <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-xs)", wordBreak: "break-all" }}>
                {run.startUrl}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-xs)" }}>
                {new Date(run.createdAt).toLocaleTimeString()} · {run.mode}
              </div>
              {run.status === "error" && run.errorMessage && (
                <div
                  style={{
                    marginTop: "var(--space-sm)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-danger)",
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
            padding: "var(--space-lg)",
            textAlign: "center",
            fontStyle: "italic",
            color: "var(--color-text-muted)",
            border: "1px dashed var(--color-divider)",
          }}
        >
          No runs yet. Start one to populate the list.
        </div>
      )}
    </div>
  );
}
