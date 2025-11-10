"use client";

import { useEffect, useRef } from "react";
import type { Transition } from "../types";

type CognitiveMapViewProps = {
  edges: Transition[];
  currentStep: number;
  mini?: boolean;
};

export function CognitiveMapView({ edges, currentStep, mini = false }: CognitiveMapViewProps) {
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
      <div
        style={{
          padding: mini ? "10px" : "20px",
          textAlign: "center",
          color: "#555",
          fontSize: mini ? "10px" : "12px",
          fontFamily: "Consolas, Monaco, monospace",
          fontStyle: "italic",
        }}
      >
        {mini ? "no map data" : "no cognitive map data yet - start a run to see the state transition graph"}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: mini ? "200px" : "600px",
          border: "1px solid #333",
          backgroundColor: "#000",
        }}
      />
      {!mini && (
        <div
          style={{
            marginTop: "12px",
            fontSize: "11px",
            color: "#888",
            fontFamily: "Consolas, Monaco, monospace",
          }}
        >
          <span style={{ fontStyle: "italic" }}>legend:</span> nodes = observations (pages), edges
          = actions
        </div>
      )}
    </div>
  );
}
