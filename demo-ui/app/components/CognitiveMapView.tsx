"use client";

import { useEffect, useRef } from "react";
import type { Transition } from "../types";

type CognitiveMapViewProps = {
  edges: Transition[];
  currentStep: number;
};

export function CognitiveMapView({ edges, currentStep }: CognitiveMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  useEffect(() => {
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
                "background-color": "#4a90e2",
                label: "data(label)",
                color: "#000",
                "text-valign": "center",
                "text-halign": "center",
                "font-size": "10px",
                width: 60,
                height: 60,
                "text-wrap": "wrap",
                "text-max-width": "80px",
              },
            },
            {
              selector: "edge",
              style: {
                width: 2,
                "line-color": "#999",
                "target-arrow-color": "#999",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                label: "data(label)",
                "font-size": "8px",
                "text-rotation": "autorotate",
                "text-margin-y": -10,
              },
            },
            {
              selector: ".current",
              style: {
                "background-color": "#e74c3c",
                "line-color": "#e74c3c",
                "target-arrow-color": "#e74c3c",
              },
            },
          ],
          layout: {
            name: "breadthfirst",
            directed: true,
            padding: 20,
            spacingFactor: 1.5,
          },
        });
      }

      // Build nodes and edges from transitions
      const nodeMap = new Map<string, { id: string; label: string }>();
      const cyEdges: Array<{ id: string; source: string; target: string; label: string }> = [];

      edges.forEach((edge, idx) => {
        // Add source node
        if (!nodeMap.has(edge.fromKey)) {
          nodeMap.set(edge.fromKey, {
            id: edge.fromKey,
            label: edge.fromKey.length > 30 ? edge.fromKey.substring(0, 27) + "..." : edge.fromKey,
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
          label: edge.actionKey.length > 20 ? edge.actionKey.substring(0, 17) + "..." : edge.actionKey,
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
  }, [edges]);

  if (edges.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
        No cognitive map data yet. Start a run to see the state transition graph.
      </div>
    );
  }

  return (
    <div>
      <h2>Cognitive Map (State Transitions)</h2>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "600px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "#fafafa",
        }}
      />
      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        <strong>Legend:</strong> Nodes = Observations (pages), Edges = Actions. The graph shows how ATLAS navigates through the web environment.
      </div>
    </div>
  );
}
