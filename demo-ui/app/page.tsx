"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AtlasEvent,
  KnowledgeEntry,
  RunState,
  RunSummary,
  StoredRun,
} from "./types";
import { Controls } from "./components/Controls";
import { Timeline } from "./components/Timeline";
import { Sidebar } from "./components/Sidebar";
import { RunList } from "./components/RunList";
import {
  KnowledgeStoreView,
  type KnowledgeFilters,
} from "./components/KnowledgeStoreView";
import {
  applyEventToRunState,
  createInitialRunState,
} from "./utils/runState";

const atlasEventTypes: Array<AtlasEvent["type"]> = [
  "init",
  "plan",
  "semantic_rules",
  "propose",
  "critique",
  "selected_action",
  "action_executed",
  "observation_after",
  "map_update",
  "replan",
  "analysis",
  "judgement",
  "test_generation",
  "rationale",
  "done",
  "error",
];

export default function Home() {
  const [runSummaries, setRunSummaries] = useState<Record<string, RunSummary>>({});
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [knowledgeFilters, setKnowledgeFilters] = useState<KnowledgeFilters>({
    runId: null,
    host: "",
    url: "",
    q: "",
  });
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const eventSourcesRef = useRef(new Map<string, EventSource>());
  const summariesRef = useRef(runSummaries);
  const runStatesRef = useRef(runStates);

  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((source) => source.close());
      eventSourcesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    summariesRef.current = runSummaries;
  }, [runSummaries]);
  useEffect(() => {
    runStatesRef.current = runStates;
  }, [runStates]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, RunSummary> = {};
      (data.runs as RunSummary[]).forEach((run) => {
        map[run.id] = run;
      });
      setRunSummaries(map);
      if (!activeRunId && data.runs.length > 0) {
        setActiveRunId((prev) => prev ?? data.runs[0].id);
      }
    } catch (error) {
      console.error("Failed to load runs", error);
    }
  }, [activeRunId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const loadRunState = useCallback(async (runId: string) => {
    if (runStatesRef.current[runId]) return;
    try {
      const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (!res.ok) return;
      const run = (await res.json()) as StoredRun;
      const derived = run.events.reduce(
        (acc, event) => applyEventToRunState(acc, event),
        createInitialRunState({
          status: run.status,
          goal: run.goal,
          startUrl: run.startUrl,
          mode: run.mode,
        })
      );
      setRunStates((prev) => ({ ...prev, [runId]: derived }));
      const { events: _events, ...summaryFields } = run;
      setRunSummaries((prev) => ({
        ...prev,
        [runId]: {
          ...(prev[runId] ?? summaryFields),
          ...summaryFields,
        },
      }));
    } catch (error) {
      console.error(`Failed to load run ${runId}`, error);
    }
  }, []);

  useEffect(() => {
    if (activeRunId) {
      loadRunState(activeRunId);
    }
  }, [activeRunId, loadRunState]);

  useEffect(() => {
    if (!knowledgeFilters.runId && activeRunId) {
      setKnowledgeFilters((prev) => ({ ...prev, runId: activeRunId }));
    }
  }, [activeRunId, knowledgeFilters.runId]);

  const fetchKnowledge = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (knowledgeFilters.runId) params.set("runId", knowledgeFilters.runId);
      if (knowledgeFilters.host) params.set("host", knowledgeFilters.host);
      if (knowledgeFilters.url) params.set("url", knowledgeFilters.url);
      if (knowledgeFilters.q) params.set("q", knowledgeFilters.q);
      const query = params.toString();
      const res = await fetch(`/api/knowledge${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setKnowledgeEntries((data.entries as KnowledgeEntry[]) ?? []);
    } catch (error) {
      console.error("Failed to fetch knowledge store", error);
    }
  }, [knowledgeFilters]);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  const handleAtlasEvent = useCallback(
    (eventName: string, evt: MessageEvent, source: EventSource) => {
      const payload = safeParse(evt.data);
      if (!payload || !payload.runId) return;
      const runId = payload.runId as string;
      const atlasEvent = payload as AtlasEvent;
      setRunStates((prev) => {
        const meta = summariesRef.current[runId];
        const current =
          prev[runId] ??
          createInitialRunState({
            status: "running",
            goal: meta?.goal ?? "",
            startUrl: meta?.startUrl ?? "",
            mode: meta?.mode ?? "goal",
          });
        return { ...prev, [runId]: applyEventToRunState(current, atlasEvent) };
      });

      if (eventName === "done" || eventName === "error") {
        setRunSummaries((prev) => {
          const summary = prev[runId];
          if (!summary) return prev;
          const isDoneEvent = atlasEvent.type === "done";
          const isErrorEvent = atlasEvent.type === "error";
          return {
            ...prev,
            [runId]: {
              ...summary,
              status: isDoneEvent ? "completed" : "error",
              endedReason: isDoneEvent ? atlasEvent.endedReason : summary.endedReason,
              errorMessage: isErrorEvent ? atlasEvent.message : summary.errorMessage,
              updatedAt: new Date().toISOString(),
            },
          };
        });
        source.close();
        eventSourcesRef.current.delete(runId);
      }
    },
    []
  );

  const connectRunStream = useCallback(
    (runId: string) => {
      if (eventSourcesRef.current.has(runId)) return;
      const eventSource = new EventSource(`/api/runs/${runId}/stream`);
      atlasEventTypes.forEach((eventName) => {
        eventSource.addEventListener(eventName, (evt) =>
          handleAtlasEvent(eventName, evt as MessageEvent, eventSource)
        );
      });
      eventSource.onerror = () => {
        console.error(`Run stream connection issue for ${runId}`);
      };
      eventSourcesRef.current.set(runId, eventSource);
    },
    [handleAtlasEvent]
  );

  useEffect(() => {
    Object.values(runSummaries).forEach((run) => {
      if (run.status === "running" || run.status === "paused" || run.status === "stopping") {
        connectRunStream(run.id);
      }
    });
  }, [runSummaries, connectRunStream]);

  const startAtlasStream = useCallback(
    (params: URLSearchParams) => {
      const eventSource = new EventSource(`/api/atlas/stream?${params.toString()}`);
      let currentRunId: string | null = null;

      eventSource.addEventListener("run_created", (evt) => {
        const payload = safeParse(evt.data);
        if (!payload || !payload.runId) return;
        const run: RunSummary = payload.run;
        setRunSummaries((prev) => ({ ...prev, [run.id]: run }));
        setRunStates((prev) => ({
          ...prev,
          [run.id]: createInitialRunState({
            status: "running",
            goal: run.goal,
            startUrl: run.startUrl,
            mode: run.mode,
          }),
        }));
        setActiveRunId(run.id);
        currentRunId = run.id;
        eventSourcesRef.current.set(run.id, eventSource);
      });

      atlasEventTypes.forEach((eventName) => {
        eventSource.addEventListener(eventName, (evt) =>
          handleAtlasEvent(eventName, evt as MessageEvent, eventSource)
        );
      });

      eventSource.onerror = () => {
        console.error(
          `EventSource connection issue for ${currentRunId ?? "pending-run"}`
        );
      };
    },
    [handleAtlasEvent]
  );

  const handleStart = useCallback(
    (
      goal: string,
      startUrl: string,
      env: string,
      beamSize: number,
      maxSteps: number,
      mode: "goal" | "flow-discovery"
    ) => {
      const params = new URLSearchParams({
        goal,
        startUrl,
        env,
        beamSize: beamSize.toString(),
        maxSteps: maxSteps.toString(),
        mode,
      });
      startAtlasStream(params);
    },
    [startAtlasStream]
  );

  const handleResumeRun = useCallback(async (runId: string) => {
    try {
      setRetryingRunId(runId);
      const res = await fetch(`/api/runs/${runId}/retry`, { method: "POST" });
      if (!res.ok) {
        console.error(`Failed to retry run ${runId}: ${res.status}`);
        return;
      }
      setRunSummaries((prev) => {
        const existing = prev[runId];
        if (!existing) return prev;
        return {
          ...prev,
          [runId]: {
            ...existing,
            status: "running",
            errorMessage: undefined,
          },
        };
      });
    } catch (error) {
      console.error(`Failed to retry run ${runId}`, error);
    } finally {
      setRetryingRunId((prev) => (prev === runId ? null : prev));
    }
  }, []);

  const handleStopRun = useCallback(async (runId: string) => {
    const refreshRunSummary = async () => {
      try {
        const latestRes = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!latestRes.ok) return;
        const run = (await latestRes.json()) as StoredRun;
        const { events: _events, ...summaryFields } = run;
        setRunSummaries((prev) => ({
          ...prev,
          [runId]: {
            ...(prev[runId] ?? summaryFields),
            ...summaryFields,
          },
        }));
        setRunStates((prev) => {
          const existing = prev[runId];
          if (!existing) return prev;
          return {
            ...prev,
            [runId]: {
              ...existing,
              status: summaryFields.status as RunState["status"],
            },
          };
        });
      } catch (refreshError) {
        console.error(`Failed to refresh run ${runId}`, refreshError);
      }
    };

    const applyStatusUpdate = (
      status: RunSummary["status"],
      extras?: { endedReason?: string; errorMessage?: string }
    ) => {
      setRunSummaries((prev) => {
        const existing = prev[runId];
        if (!existing) return prev;
        return {
          ...prev,
          [runId]: {
            ...existing,
            status,
            endedReason: extras?.endedReason ?? existing.endedReason,
            errorMessage: extras?.errorMessage ?? existing.errorMessage,
            updatedAt: new Date().toISOString(),
          },
        };
      });
      setRunStates((prev) => {
        const existing = prev[runId];
        if (!existing) return prev;
        return {
          ...prev,
          [runId]: {
            ...existing,
            status,
          },
        };
      });
    };

    try {
      const res = await fetch(`/api/runs/${runId}/stop`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 409) {
          await refreshRunSummary();
        }
        console.error(`Failed to stop run ${runId}: ${res.status}`);
        return;
      }
      const payload: { status?: string; endedReason?: string; errorMessage?: string } | null =
        await res
          .json()
          .catch(() => null);
      if (payload?.status) {
        applyStatusUpdate(payload.status as RunSummary["status"], {
          endedReason: payload.endedReason,
          errorMessage: payload.errorMessage,
        });
      } else {
        applyStatusUpdate("stopping");
      }
    } catch (error) {
      console.error(`Failed to stop run ${runId}`, error);
    }
  }, []);

  const handleRename = async (runId: string, name: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as RunSummary;
      setRunSummaries((prev) => ({ ...prev, [runId]: updated }));
    } catch (error) {
      console.error("Failed to rename run", error);
    }
  };

  const selectedRunState = activeRunId ? runStates[activeRunId] : undefined;
  const selectedRunSummary = activeRunId ? runSummaries[activeRunId] : undefined;
  const lastStepRecord =
    selectedRunState?.steps.length
      ? selectedRunState.steps[selectedRunState.steps.length - 1]
      : undefined;
  const retryStep =
    (lastStepRecord?.logicalStep ?? lastStepRecord?.step ?? 0) + 1;
  const canRetry = Boolean(activeRunId && selectedRunState?.status === "error");
  const retryDisabled = Boolean(activeRunId && retryingRunId === activeRunId);
  const runsForList = Object.values(runSummaries);

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
            <Controls onStart={handleStart} />
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "22% 38% 40%",
          gap: "1px",
          backgroundColor: "#333",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "#000",
            padding: "15px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", marginBottom: "8px" }}>Runs</div>
            <RunList
              runs={runsForList}
              activeRunId={activeRunId}
              onSelect={(id) => setActiveRunId(id)}
              onRename={handleRename}
              onStop={handleStopRun}
            />
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#000",
            padding: "15px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflow: "hidden",
          }}
        >
          {selectedRunState ? (
            <>
              <div style={{ flexShrink: 0 }}>
                <Sidebar
                  runState={selectedRunState}
                  onRetry={
                    canRetry && activeRunId
                      ? () => handleResumeRun(activeRunId)
                      : undefined
                  }
                  retryStep={retryStep}
                  retryDisabled={retryDisabled}
                />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Timeline
                  steps={selectedRunState.steps}
                  currentStep={selectedRunState.currentStep}
                  status={selectedRunState.status}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#555",
                fontStyle: "italic",
              }}
            >
              Select a run to view details
            </div>
          )}
        </div>

        <div
          style={{
            backgroundColor: "#000",
            padding: "15px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#00ff00",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            knowledge store
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <KnowledgeStoreView
              entries={knowledgeEntries}
              filters={knowledgeFilters}
              onFiltersChange={setKnowledgeFilters}
              runs={runsForList}
              onRefresh={fetchKnowledge}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const safeParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
