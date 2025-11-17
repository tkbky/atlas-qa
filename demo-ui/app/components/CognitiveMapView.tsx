"use client";

import { useEffect, useRef, useState } from "react";
import type { Transition } from "../types";
import { tokens } from "../designSystem";

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
  const { colors, typography } = tokens;
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
                "background-color": mini ? colors.accent : colors.info,
                label: mini ? "" : "data(label)",
                color: mini ? colors.background : colors.accent,
                "text-valign": "center",
                "text-halign": "center",
                "font-size": mini ? "6px" : "10px",
                width: mini ? 20 : 60,
                height: mini ? 20 : 60,
                "text-wrap": "wrap",
                "text-max-width": mini ? "40px" : "80px",
                "font-family": typography.fontFamily,
              },
            },
            {
              selector: "edge",
              style: {
                width: mini ? 1 : 2,
                "line-color": mini ? colors.textMuted : colors.textSecondary,
                "target-arrow-color": mini ? colors.textMuted : colors.textSecondary,
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                label: mini ? "" : "data(label)",
                "font-size": mini ? "6px" : "8px",
                "text-rotation": "autorotate",
                "text-margin-y": -10,
                color: colors.textSecondary,
                "font-family": typography.fontFamily,
              },
            },
            {
              selector: ".current",
              style: {
                "background-color": mini ? colors.warning : colors.danger,
                "line-color": mini ? colors.warning : colors.danger,
                "target-arrow-color": mini ? colors.warning : colors.danger,
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
            padding: "var(--space-xxl)",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
            fontFamily: "var(--font-mono)",
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
          backgroundColor: "var(--color-background)",
          border: "1px solid var(--color-border)",
          padding: "var(--space-xl)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "var(--space-xl)",
          }}
        >
          {edges.map((edge, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-lg)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  color: "var(--color-info)",
                  fontWeight: "bold",
                  marginBottom: "var(--space-md)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Transition #{idx + 1}
              </div>

              <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>From State: </span>
                  <span style={{ color: "var(--color-accent)" }}>{edge.fromKey}</span>
                </div>

                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>Action: </span>
                  <span style={{ color: "var(--color-warning)" }}>{edge.actionKey}</span>
                </div>

                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>To URL: </span>
                  <span style={{ color: "var(--color-accent)" }}>{edge.to.url}</span>
                </div>

                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>To Title: </span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {edge.to.title || "(no title)"}
                  </span>
                </div>

                {edge.delta && (
                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Delta: </span>
                    <span style={{ color: "var(--color-danger)" }}>{edge.delta}</span>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "var(--space-sm)",
                    paddingTop: "var(--space-sm)",
                    borderTop: "1px solid var(--color-divider)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Uncertainty: </span>
                    <span style={{ color: "var(--color-info)" }}>
                      {(edge as any).uncertainty?.toFixed(3) ?? "N/A"}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Visits: </span>
                    <span style={{ color: "var(--color-info)" }}>
                      {(edge as any).visits ?? 1}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>First Seen: </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {(edge as any).firstSeenAt
                        ? formatTimestamp((edge as any).firstSeenAt)
                        : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Last Seen: </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {(edge as any).lastSeenAt
                        ? formatTimestamp((edge as any).lastSeenAt)
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {edge.to.affordances && edge.to.affordances.length > 0 && (
                  <div
                    style={{
                      marginTop: "var(--space-sm)",
                      paddingTop: "var(--space-sm)",
                      borderTop: "1px solid var(--color-divider)",
                    }}
                  >
                    <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-xs)" }}>
                      Available Affordances ({edge.to.affordances.length}):
                    </div>
                    <div
                      style={{
                        maxHeight: "100px",
                        overflowY: "auto",
                        backgroundColor: "var(--color-surface)",
                        padding: "var(--space-sm)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {edge.to.affordances
                        .slice(0, 5)
                        .map((aff: any, affIdx: number) => (
                          <div
                            key={affIdx}
                            style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}
                          >
                            • {aff.description}
                          </div>
                        ))}
                      {edge.to.affordances.length > 5 && (
                        <div
                          style={{
                            color: "var(--color-text-muted)",
                            fontSize: "var(--font-size-xs)",
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
            padding: "var(--space-lg)",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-xs)",
            fontFamily: "var(--font-mono)",
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
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-background)",
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
          gap: "var(--space-md)",
          marginBottom: "var(--space-lg)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <button
          onClick={() => setViewMode("graph")}
          style={{
            padding: "var(--space-md) var(--space-xl)",
            backgroundColor: viewMode === "graph" ? "var(--color-info)" : "var(--color-surface-raised)",
            color: viewMode === "graph" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            border: "none",
            borderBottom:
              viewMode === "graph"
                ? "2px solid var(--color-info)"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            transition: "all 0.2s",
          }}
        >
          Graph View
        </button>
        <button
          onClick={() => setViewMode("details")}
          style={{
            padding: "var(--space-md) var(--space-xl)",
            backgroundColor: viewMode === "details" ? "var(--color-info)" : "var(--color-surface-raised)",
            color: viewMode === "details" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            border: "none",
            borderBottom:
              viewMode === "details"
                ? "2px solid var(--color-info)"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
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
                padding: "var(--space-xxl)",
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: "var(--font-size-sm)",
                fontFamily: "var(--font-mono)",
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
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background)",
                }}
              />
              <div
                style={{
                  marginTop: "var(--space-lg)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
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
