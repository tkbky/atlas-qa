"use client";

import { useState, useRef } from "react";
import type { RunState, StepData } from "./types";
import type { AtlasEvent } from "./types";
import { Controls } from "./components/Controls";
import { Timeline } from "./components/Timeline";
import { CognitiveMapView } from "./components/CognitiveMapView";

export default function Home() {
  const [runState, setRunState] = useState<RunState>({
    status: "idle",
    goal: "",
    startUrl: "",
    steps: [],
    currentStep: -1,
    cognitiveMap: [],
  });
  const [activeTab, setActiveTab] = useState<"timeline" | "map">("timeline");
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStart = (goal: string, startUrl: string, env: string, beamSize: number, maxSteps: number) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setRunState({
      status: "running",
      goal,
      startUrl,
      steps: [],
      currentStep: -1,
      cognitiveMap: [],
    });

    // Build SSE URL
    const params = new URLSearchParams({
      goal,
      startUrl,
      env,
      beamSize: beamSize.toString(),
      maxSteps: maxSteps.toString(),
    });
    const url = `/api/atlas/stream?${params.toString()}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Track step data by step index
    const stepDataMap = new Map<number, Partial<StepData>>();

    const getOrCreateStepData = (step: number): Partial<StepData> => {
      if (!stepDataMap.has(step)) {
        stepDataMap.set(step, { step });
      }
      return stepDataMap.get(step)!;
    };

    eventSource.addEventListener("init", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "init" };
      console.log("Init:", event);
    });

    eventSource.addEventListener("plan", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "plan" };
      console.log("Plan:", event);
      setRunState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => ({ ...s, plan: event.plan })),
      }));
    });

    eventSource.addEventListener("propose", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "propose" };
      console.log("Propose:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.candidates = event.candidates;
      stepData.inputState = event.inputState;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        } else {
          newSteps.push(stepData as StepData);
        }
        return { ...prev, steps: newSteps, currentStep: event.step };
      });
    });

    eventSource.addEventListener("critique", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "critique" };
      console.log("Critique:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.critique = event.critique;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        }
        return { ...prev, steps: newSteps };
      });
    });

    eventSource.addEventListener("selected_action", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "selected_action" };
      console.log("Selected action:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.selectedAction = event.action;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        }
        return { ...prev, steps: newSteps };
      });
    });

    eventSource.addEventListener("observation_after", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "observation_after" };
      console.log("Observation after:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.observationBefore = event.before;
      stepData.observationAfter = event.after;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        }
        return { ...prev, steps: newSteps };
      });
    });

    eventSource.addEventListener("map_update", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "map_update" };
      console.log("Map update:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.edge = event.edge;

      setRunState((prev) => ({
        ...prev,
        cognitiveMap: [...prev.cognitiveMap, event.edge],
      }));
    });

    eventSource.addEventListener("replan", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "replan" };
      console.log("Replan:", event);
      setRunState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => ({ ...s, plan: event.plan })),
      }));
    });

    eventSource.addEventListener("done", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "done" };
      console.log("Done:", event);
      setRunState((prev) => ({
        ...prev,
        status: "completed",
        cognitiveMap: event.cognitiveMap,
      }));
      eventSource.close();
    });

    eventSource.addEventListener("error", (e: Event) => {
      const msgEvent = e as MessageEvent;
      let errorMessage = "Unknown error";
      try {
        const event = JSON.parse(msgEvent.data) as AtlasEvent & { type: "error" };
        errorMessage = event.message;
      } catch {
        errorMessage = "Stream connection error";
      }
      console.error("Error:", errorMessage);
      setRunState((prev) => ({
        ...prev,
        status: "error",
        errorMessage,
      }));
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("EventSource closed");
      }
    };
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setRunState((prev) => ({
      ...prev,
      status: prev.status === "running" ? "idle" : prev.status,
    }));
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>ATLAS Demo UI</h1>

      <Controls
        onStart={handleStart}
        onStop={handleStop}
        isRunning={runState.status === "running"}
      />

      <div style={{ marginTop: "30px", borderTop: "2px solid #ccc", paddingTop: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setActiveTab("timeline")}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              backgroundColor: activeTab === "timeline" ? "#007bff" : "#e0e0e0",
              color: activeTab === "timeline" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("map")}
            style={{
              padding: "10px 20px",
              backgroundColor: activeTab === "map" ? "#007bff" : "#e0e0e0",
              color: activeTab === "map" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cognitive Map
          </button>
        </div>

        {runState.status === "error" && (
          <div style={{ padding: "15px", backgroundColor: "#fee", border: "1px solid #c00", borderRadius: "4px", marginBottom: "20px" }}>
            <strong>Error:</strong> {runState.errorMessage}
          </div>
        )}

        {activeTab === "timeline" && <Timeline steps={runState.steps} currentStep={runState.currentStep} />}
        {activeTab === "map" && <CognitiveMapView edges={runState.cognitiveMap} currentStep={runState.currentStep} />}
      </div>
    </div>
  );
}
