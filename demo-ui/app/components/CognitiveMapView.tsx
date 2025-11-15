"use client";

import { useEffect, useRef, useState } from "react";
import type { Transition } from "../types";

type CognitiveMapViewProps = {
  edges: Transition[];
  currentStep: number;
  mini?: boolean;
};

type ViewMode = "graph" | "details";

export function CognitiveMapView({
  edges,
  currentStep,
  mini = false,
}: CognitiveMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");

  useEffect(() => {
    // Only initialize graph if in graph mode
    if (viewMode !== "graph") return;

    // Dynamically import Cytoscape to avoid SSR issues
    import("cytoscape").then((cytoscapeModule) => {
      const cytoscape = cytoscapeModule.default;

      if (!containerRef.current) return;

      // Initialize Cytoscape if not already done
      if (!cyRef.current) {
        cyRef.current = cytoscape({
          container: containerRef.current,
          style: [
            {
              selector: "node",
              style: {
                "background-color": mini ? "#00ff00" : "#4a90e2",
                label: mini ? "" : "data(label)",
                color: mini ? "#000" : "#00ff00",
                "text-valign": "center",
                "text-halign": "center",
                "font-size": mini ? "6px" : "10px",
                width: mini ? 20 : 60,
                height: mini ? 20 : 60,
                "text-wrap": "wrap",
                "text-max-width": mini ? "40px" : "80px",
                "font-family": "Consolas, Monaco, monospace",
              },
            },
            {
              selector: "edge",
              style: {
                width: mini ? 1 : 2,
                "line-color": mini ? "#555" : "#999",
                "target-arrow-color": mini ? "#555" : "#999",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                label: mini ? "" : "data(label)",
                "font-size": mini ? "6px" : "8px",
                "text-rotation": "autorotate",
                "text-margin-y": -10,
                color: mini ? "#888" : "#999",
                "font-family": "Consolas, Monaco, monospace",
              },
            },
            {
              selector: ".current",
              style: {
                "background-color": mini ? "#ffb000" : "#e74c3c",
                "line-color": mini ? "#ffb000" : "#e74c3c",
                "target-arrow-color": mini ? "#ffb000" : "#e74c3c",
              },
            },
          ],
          layout: {
            name: "breadthfirst",
            directed: true,
            padding: mini ? 10 : 20,
            spacingFactor: mini ? 1.2 : 1.5,
          },
        });
      }

      // Build nodes and edges from transitions
      const nodeMap = new Map<string, { id: string; label: string }>();
      const cyEdges: Array<{
        id: string;
        source: string;
        target: string;
        label: string;
      }> = [];

      edges.forEach((edge, idx) => {
        // Add source node
        if (!nodeMap.has(edge.fromKey)) {
          nodeMap.set(edge.fromKey, {
            id: edge.fromKey,
            label:
              edge.fromKey.length > 30
                ? edge.fromKey.substring(0, 27) + "..."
                : edge.fromKey,
          });
        }

        // Add target node
        const toKey = edge.to.url;
        if (!nodeMap.has(toKey)) {
          nodeMap.set(toKey, {
            id: toKey,
            label: edge.to.title || toKey.substring(0, 27) + "...",
          });
        }

        // Add edge
        cyEdges.push({
          id: `edge-${idx}`,
          source: edge.fromKey,
          target: toKey,
          label:
            edge.actionKey.length > 20
              ? edge.actionKey.substring(0, 17) + "..."
              : edge.actionKey,
        });
      });

      // Update Cytoscape elements
      const cy = cyRef.current;
      cy.elements().remove();

      const nodes = Array.from(nodeMap.values()).map((n) => ({ data: n }));
      const edgeElements = cyEdges.map((e) => ({ data: e }));

      cy.add([...nodes, ...edgeElements]);

      // Apply layout
      cy.layout({
        name: "breadthfirst",
        directed: true,
        padding: 20,
        spacingFactor: 1.5,
      }).run();

      // Fit to viewport
      cy.fit(undefined, 50);
    });
  }, [edges, viewMode, mini]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderDetailsView = () => {
    if (edges.length === 0) {
      return (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#555",
            fontSize: "12px",
            fontFamily: "Consolas, Monaco, monospace",
            fontStyle: "italic",
          }}
        >
          no cognitive map data yet - start a run to see transition details
        </div>
      );
    }

    return (
      <div
        style={{
          height: "600px",
          overflowY: "auto",
          backgroundColor: "#000",
          border: "1px solid #333",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {edges.map((edge, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: "#111",
                border: "1px solid #333",
                borderRadius: "4px",
                padding: "12px",
                fontFamily: "Consolas, Monaco, monospace",
                fontSize: "11px",
              }}
            >
              <div
                style={{
                  color: "#4a90e2",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  fontSize: "12px",
                }}
              >
                Transition #{idx + 1}
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <div>
                  <span style={{ color: "#888" }}>From State: </span>
                  <span style={{ color: "#00ff00" }}>{edge.fromKey}</span>
                </div>

                <div>
                  <span style={{ color: "#888" }}>Action: </span>
                  <span style={{ color: "#ffb000" }}>{edge.actionKey}</span>
                </div>

                <div>
                  <span style={{ color: "#888" }}>To URL: </span>
                  <span style={{ color: "#00ff00" }}>{edge.to.url}</span>
                </div>

                <div>
                  <span style={{ color: "#888" }}>To Title: </span>
                  <span style={{ color: "#fff" }}>
                    {edge.to.title || "(no title)"}
                  </span>
                </div>

                {edge.delta && (
                  <div>
                    <span style={{ color: "#888" }}>Delta: </span>
                    <span style={{ color: "#e74c3c" }}>{edge.delta}</span>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "1px solid #222",
                  }}
                >
                  <div>
                    <span style={{ color: "#888" }}>Uncertainty: </span>
                    <span style={{ color: "#ff6b9d" }}>
                      {(edge as any).uncertainty?.toFixed(3) ?? "N/A"}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#888" }}>Visits: </span>
                    <span style={{ color: "#9b59b6" }}>
                      {(edge as any).visits ?? 1}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#888" }}>First Seen: </span>
                    <span style={{ color: "#666" }}>
                      {(edge as any).firstSeenAt
                        ? formatTimestamp((edge as any).firstSeenAt)
                        : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#888" }}>Last Seen: </span>
                    <span style={{ color: "#666" }}>
                      {(edge as any).lastSeenAt
                        ? formatTimestamp((edge as any).lastSeenAt)
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {edge.to.affordances && edge.to.affordances.length > 0 && (
                  <div
                    style={{
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px solid #222",
                    }}
                  >
                    <div style={{ color: "#888", marginBottom: "4px" }}>
                      Available Affordances ({edge.to.affordances.length}):
                    </div>
                    <div
                      style={{
                        maxHeight: "100px",
                        overflowY: "auto",
                        backgroundColor: "#0a0a0a",
                        padding: "6px",
                        borderRadius: "2px",
                      }}
                    >
                      {edge.to.affordances
                        .slice(0, 5)
                        .map((aff: any, affIdx: number) => (
                          <div
                            key={affIdx}
                            style={{ color: "#666", fontSize: "10px" }}
                          >
                            • {aff.description}
                          </div>
                        ))}
                      {edge.to.affordances.length > 5 && (
                        <div
                          style={{
                            color: "#444",
                            fontSize: "10px",
                            fontStyle: "italic",
                          }}
                        >
                          ... and {edge.to.affordances.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mini view doesn't support tabs
  if (mini) {
    if (edges.length === 0) {
      return (
        <div
          style={{
            padding: "10px",
            textAlign: "center",
            color: "#555",
            fontSize: "10px",
            fontFamily: "Consolas, Monaco, monospace",
            fontStyle: "italic",
          }}
        >
          no map data
        </div>
      );
    }

    return (
      <div>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "200px",
            border: "1px solid #333",
            backgroundColor: "#000",
          }}
        />
      </div>
    );
  }

  // Full view with tabs
  return (
    <div>
      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
          borderBottom: "1px solid #333",
        }}
      >
        <button
          onClick={() => setViewMode("graph")}
          style={{
            padding: "8px 16px",
            backgroundColor: viewMode === "graph" ? "#4a90e2" : "#111",
            color: viewMode === "graph" ? "#fff" : "#888",
            border: "none",
            borderBottom:
              viewMode === "graph"
                ? "2px solid #4a90e2"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
            transition: "all 0.2s",
          }}
        >
          Graph View
        </button>
        <button
          onClick={() => setViewMode("details")}
          style={{
            padding: "8px 16px",
            backgroundColor: viewMode === "details" ? "#4a90e2" : "#111",
            color: viewMode === "details" ? "#fff" : "#888",
            border: "none",
            borderBottom:
              viewMode === "details"
                ? "2px solid #4a90e2"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
            transition: "all 0.2s",
          }}
        >
          Details View
        </button>
      </div>

      {/* Content Area */}
      {viewMode === "graph" ? (
        <div>
          {edges.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "#555",
                fontSize: "12px",
                fontFamily: "Consolas, Monaco, monospace",
                fontStyle: "italic",
              }}
            >
              no cognitive map data yet - start a run to see the state
              transition graph
            </div>
          ) : (
            <>
              <div
                ref={containerRef}
                style={{
                  width: "100%",
                  height: "600px",
                  border: "1px solid #333",
                  backgroundColor: "#000",
                }}
              />
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "#888",
                  fontFamily: "Consolas, Monaco, monospace",
                }}
              >
                <span style={{ fontStyle: "italic" }}>legend:</span> nodes =
                observations (pages), edges = actions
              </div>
            </>
          )}
        </div>
      ) : (
        renderDetailsView()
      )}
    </div>
  );
}
