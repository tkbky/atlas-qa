"use client";

import type { KnowledgeEntry, RunSummary } from "../types";

export type KnowledgeFilters = {
  runId?: string | null;
  host?: string;
  url?: string;
  q?: string;
};

type KnowledgeStoreViewProps = {
  entries: KnowledgeEntry[];
  filters: KnowledgeFilters;
  onFiltersChange: (filters: KnowledgeFilters) => void;
  runs: RunSummary[];
  onRefresh: () => void;
};

export function KnowledgeStoreView({
  entries,
  filters,
  onFiltersChange,
  runs,
  onRefresh,
}: KnowledgeStoreViewProps) {
const updateFilter = (
  key: keyof KnowledgeFilters,
  value: string | null | undefined
) => {
  onFiltersChange({ ...filters, [key]: value });
};

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={labelStyle}>Filter by Run</label>
          <select
            value={filters.runId ?? ""}
            onChange={(e) => updateFilter("runId", e.target.value || null)}
            style={inputStyle}
          >
            <option value="">All runs</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={labelStyle}>Host contains</label>
          <input
            value={filters.host ?? ""}
            style={inputStyle}
            placeholder="example.com"
            onChange={(e) => updateFilter("host", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={labelStyle}>URL contains</label>
          <input
            value={filters.url ?? ""}
            style={inputStyle}
            placeholder="/signup"
            onChange={(e) => updateFilter("url", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={labelStyle}>Text search</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              value={filters.q ?? ""}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Delta, rule notes, ..."
              onChange={(e) => updateFilter("q", e.target.value)}
            />
            <button
              onClick={onRefresh}
              style={{
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                fontFamily: "Consolas, Monaco, monospace",
                padding: "4px 10px",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #222" }}>
        {entries.length === 0 && (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "#555",
              fontStyle: "italic",
            }}
          >
            No knowledge entries for the selected filters.
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.host}
            style={{
              borderBottom: "1px solid #222",
              padding: "12px",
              backgroundColor: "#050505",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ color: "#00ff00", fontWeight: "bold" }}>{entry.host}</div>
              <div style={{ color: "#888", fontSize: "11px" }}>
                {entry.transitions.length} transitions · {entry.semanticRules.length} rules
              </div>
            </div>

            {entry.transitions.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={sectionLabel}>Transitions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {entry.transitions.map((transition, idx) => (
                    <div
                      key={`${transition.fromKey}-${transition.actionKey}-${idx}`}
                      style={{
                        border: "1px solid #222",
                        padding: "8px",
                        backgroundColor: "#0f0f0f",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ color: "#ffb000" }}>{transition.to?.title}</div>
                      <div style={{ color: "#888", wordBreak: "break-all" }}>
                        {transition.to?.url}
                      </div>
                      {transition.delta && (
                        <div style={{ color: "#aaa", marginTop: "4px" }}>
                          {transition.delta}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entry.semanticRules.length > 0 && (
              <div>
                <div style={sectionLabel}>Semantic Rules</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {entry.semanticRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        border: "1px solid #222",
                        padding: "8px",
                        backgroundColor: "#0f0f0f",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ color: "#ffb000", textTransform: "uppercase" }}>
                        {rule.kind}
                      </div>
                      {rule.note && (
                        <div style={{ color: "#aaa", marginTop: "4px" }}>{rule.note}</div>
                      )}
                      {rule.firstSeenAt && (
                        <div style={{ color: "#555", marginTop: "4px" }}>
                          First seen at {rule.firstSeenAt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#888",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #333",
  backgroundColor: "#050505",
  color: "#00ff00",
  fontFamily: "Consolas, Monaco, monospace",
  padding: "6px 8px",
  fontSize: "11px",
};

const sectionLabel: React.CSSProperties = {
  color: "#888",
  fontSize: "10px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: "6px",
};
