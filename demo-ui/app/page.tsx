"use client";

import { useState, useRef } from "react";
import type { RunState, StepData } from "./types";
import type { AtlasEvent } from "./types";
import { Controls } from "./components/Controls";
import { Timeline } from "./components/Timeline";
import { Sidebar } from "./components/Sidebar";

export default function Home() {
  const [runState, setRunState] = useState<RunState>({
    status: "idle",
    mode: "goal",
    goal: "",
    startUrl: "",
    steps: [],
    currentStep: -1,
    cognitiveMap: [],
    semanticRules: "",
    flowAnalysis: {
      currentState: null,
      judgeDecisions: [],
    },
  });
  const [showControls, setShowControls] = useState<boolean>(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStart = (
    goal: string,
    startUrl: string,
    env: string,
    beamSize: number,
    maxSteps: number,
    mode: "goal" | "flow-discovery"
  ) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setRunState({
      status: "running",
      mode,
      goal,
      startUrl,
      steps: [],
      currentStep: -1,
      cognitiveMap: [],
      semanticRules: "",
      flowAnalysis: {
        currentState: null,
        judgeDecisions: [],
      },
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
        plan: event.plan,
        steps: prev.steps.map((s) => ({ ...s, plan: event.plan })),
      }));
    });

    eventSource.addEventListener("semantic_rules", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & {
        type: "semantic_rules";
      };
      console.log("Semantic rules:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.semanticRules = event.rules;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        } else {
          newSteps.push(stepData as StepData);
        }
        return {
          ...prev,
          steps: newSteps,
          semanticRules: event.rules || prev.semanticRules, // Update global semantic rules
        };
      });
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
          // New step - include current plan
          newSteps.push({ ...stepData, plan: prev.plan } as StepData);
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
      const event = JSON.parse(e.data) as AtlasEvent & {
        type: "selected_action";
      };
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
      const event = JSON.parse(e.data) as AtlasEvent & {
        type: "observation_after";
      };
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
        plan: event.plan,
        steps: prev.steps.map((s) => ({ ...s, plan: event.plan })),
      }));
    });

    eventSource.addEventListener("analysis", (e) => {
      const event = JSON.parse(e.data) as Extract<
        AtlasEvent,
        { type: "analysis" }
      >;
      console.log("Flow Analysis:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.flowAnalysis = event.analysis;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        }
        return {
          ...prev,
          steps: newSteps,
          flowAnalysis: {
            ...prev.flowAnalysis!,
            currentState: event.analysis,
          },
        };
      });
    });

    eventSource.addEventListener("judgement", (e) => {
      const event = JSON.parse(e.data) as Extract<
        AtlasEvent,
        { type: "judgement" }
      >;
      console.log("Judge Decision:", event);
      const stepData = getOrCreateStepData(event.step);
      stepData.judgeDecision = event.decision;

      setRunState((prev) => {
        const newSteps = [...prev.steps];
        const idx = newSteps.findIndex((s) => s.step === event.step);
        if (idx >= 0) {
          newSteps[idx] = { ...newSteps[idx], ...stepData } as StepData;
        }
        return {
          ...prev,
          steps: newSteps,
          flowAnalysis: {
            ...prev.flowAnalysis!,
            judgeDecisions: [
              ...prev.flowAnalysis!.judgeDecisions,
              {
                step: event.step,
                analysis: prev.flowAnalysis!.currentState || "intermediate",
                decision: event.decision,
                prompt: event.prompt,
              },
            ],
          },
        };
      });
    });

    eventSource.addEventListener("test_generation", (e) => {
      const event = JSON.parse(e.data) as Extract<
        AtlasEvent,
        { type: "test_generation" }
      >;
      console.log("Test Generation:", event);
      setRunState((prev) => ({
        ...prev,
        generatedTest: event.generatedCode,
      }));
    });

    eventSource.addEventListener("done", (e) => {
      const event = JSON.parse(e.data) as AtlasEvent & { type: "done" };
      console.log("Done:", event);
      setRunState((prev) => ({
        ...prev,
        status: "completed",
        cognitiveMap: event.cognitiveMap,
        endedReason: event.endedReason,
      }));
      eventSource.close();
    });

    eventSource.addEventListener("error", (e: Event) => {
      const msgEvent = e as MessageEvent;
      let errorMessage = "Unknown error";
      try {
        const event = JSON.parse(msgEvent.data) as AtlasEvent & {
          type: "error";
        };
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#000",
        color: "#00ff00",
        fontFamily: "Consolas, Monaco, monospace",
        overflow: "hidden",
      }}
    >
      {/* Header with collapsible controls */}
      <div
        style={{
          borderBottom: "1px solid #333",
          backgroundColor: "#0a0a0a",
        }}
      >
        <div
          onClick={() => setShowControls(!showControls)}
          style={{
            padding: "12px 20px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          <span style={{ marginRight: "8px", color: "#888" }}>
            {showControls ? "▼" : "▶"}
          </span>
          ATLAS Control Panel
        </div>
        {showControls && (
          <div style={{ padding: "0 20px 20px 20px" }}>
            <Controls
              onStart={handleStart}
              onStop={handleStop}
              isRunning={runState.status === "running"}
            />
          </div>
        )}
      </div>

      {/* Error display */}
      {runState.status === "error" && (
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#2a0000",
            border: "1px solid #ff4444",
            borderLeft: "4px solid #ff4444",
            color: "#ff4444",
            fontFamily: "Consolas, Monaco, monospace",
            fontSize: "12px",
          }}
        >
          <span style={{ fontWeight: "bold" }}>ERROR:</span>{" "}
          {runState.errorMessage}
        </div>
      )}

      {/* Main content area with two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "30% 70%",
          gap: "1px",
          backgroundColor: "#333",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar */}
        <div
          style={{
            backgroundColor: "#000",
            padding: "15px",
            overflowY: "auto",
          }}
        >
          <Sidebar runState={runState} />
        </div>

        {/* Right Main Area - Timeline */}
        <div
          style={{
            backgroundColor: "#000",
            padding: "15px",
            overflowY: "auto",
          }}
        >
          <Timeline
            steps={runState.steps}
            currentStep={runState.currentStep}
            status={runState.status}
          />
        </div>
      </div>
    </div>
  );
}
