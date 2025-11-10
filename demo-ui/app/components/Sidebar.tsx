"use client";

import { useState } from "react";
import type { RunState } from "../types";
import { CognitiveMapView } from "./CognitiveMapView";

type SidebarProps = {
  runState: RunState;
};

export function Sidebar({ runState }: SidebarProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(["url", "flow"])
  );

  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId);
    } else {
      newExpanded.add(panelId);
    }
    setExpandedPanels(newExpanded);
  };

  const currentUrl =
    runState.steps.length > 0 &&
    runState.currentStep >= 0 &&
    runState.steps[runState.currentStep]?.observationAfter?.url
      ? runState.steps[runState.currentStep].observationAfter!.url
      : runState.startUrl || "No URL";

  const totalSteps = runState.steps.length;
  const maxSteps = 15; // Could be passed as prop if needed

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* URL Panel */}
      <Panel
        title="URL"
        isExpanded={expandedPanels.has("url")}
        onToggle={() => togglePanel("url")}
      >
        <div
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
            color: "#00ff00",
            wordBreak: "break-all",
          }}
        >
          {currentUrl}
        </div>
      </Panel>

      {/* Flow Panel */}
      <Panel
        title="Flow"
        isExpanded={expandedPanels.has("flow")}
        onToggle={() => togglePanel("flow")}
      >
        <div
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>status:</span>{" "}
            <span
              style={{
                color:
                  runState.status === "running"
                    ? "#ffb000"
                    : runState.status === "completed"
                    ? "#00ff00"
                    : runState.status === "error"
                    ? "#ff4444"
                    : "#888",
                fontWeight: "bold",
              }}
            >
              {runState.status}
            </span>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>step:</span>{" "}
            <span style={{ color: "#00ff00" }}>
              {runState.currentStep >= 0 ? runState.currentStep : 0}/{maxSteps}
            </span>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>total actions:</span>{" "}
            <span style={{ color: "#00ff00" }}>{totalSteps}</span>
          </div>
          {runState.goal && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ color: "#888", marginBottom: "4px" }}>goal:</div>
              <div style={{ color: "#ffb000", fontStyle: "italic", fontSize: "11px" }}>
                {runState.goal}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Cognitive Map Panel */}
      <Panel
        title="Cognitive Map"
        isExpanded={expandedPanels.has("map")}
        onToggle={() => togglePanel("map")}
      >
        <div
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "11px",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#888" }}>nodes:</span>{" "}
          <span style={{ color: "#00ff00" }}>
            {new Set(runState.cognitiveMap.flatMap((e) => [e.fromKey, e.to.url])).size}
          </span>
          {" | "}
          <span style={{ color: "#888" }}>edges:</span>{" "}
          <span style={{ color: "#00ff00" }}>{runState.cognitiveMap.length}</span>
        </div>
        <CognitiveMapView
          edges={runState.cognitiveMap}
          currentStep={runState.currentStep}
          mini={false}
        />
      </Panel>

      {/* Semantic Memory Panel */}
      <Panel
        title="Semantic Memory"
        isExpanded={expandedPanels.has("memory")}
        onToggle={() => togglePanel("memory")}
      >
        <div
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "11px",
            color: "#888",
          }}
        >
          {runState.semanticRules ? (
            <div style={{ whiteSpace: "pre-wrap", color: "#00ff00" }}>
              {runState.semanticRules}
            </div>
          ) : (
            <div style={{ color: "#555", fontStyle: "italic" }}>
              No semantic rules learned yet for this domain.
              <div style={{ marginTop: "8px", fontSize: "10px" }}>
                Semantic memory stores:
                <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
                  <li>Site-specific constraints</li>
                  <li>Date/time format rules</li>
                  <li>Non-recoverable actions</li>
                  <li>Rate limits & hazards</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

type PanelProps = {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function Panel({ title, isExpanded, onToggle, children }: PanelProps) {
  return (
    <div
      style={{
        border: "1px solid #333",
        backgroundColor: "#0a0a0a",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          backgroundColor: "#1a1a1a",
          borderBottom: isExpanded ? "1px solid #333" : "none",
          fontFamily: "Consolas, Monaco, monospace",
          fontSize: "13px",
          color: "#00ff00",
          fontWeight: "bold",
          userSelect: "none",
        }}
      >
        <span style={{ marginRight: "8px", color: "#888" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
        {title}
      </div>
      {isExpanded && (
        <div style={{ padding: "12px" }}>{children}</div>
      )}
    </div>
  );
}
