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
          gap: "var(--space-md)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <label style={labelStyle}>Host contains</label>
          <input
            value={filters.host ?? ""}
            style={inputStyle}
            placeholder="example.com"
            onChange={(e) => updateFilter("host", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <label style={labelStyle}>URL contains</label>
          <input
            value={filters.url ?? ""}
            style={inputStyle}
            placeholder="/signup"
            onChange={(e) => updateFilter("url", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <label style={labelStyle}>Text search</label>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <input
              value={filters.q ?? ""}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Delta, rule notes, ..."
              onChange={(e) => updateFilter("q", e.target.value)}
            />
            <button
              onClick={onRefresh}
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                padding: "var(--space-xs) var(--space-lg)",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--color-divider)" }}>
        {entries.length === 0 && (
          <div
            style={{
              padding: "var(--space-xxl)",
              textAlign: "center",
              color: "var(--color-text-muted)",
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
              borderBottom: "1px solid var(--color-divider)",
              padding: "var(--space-lg)",
              backgroundColor: "var(--color-background)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
              <div style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{entry.host}</div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)" }}>
                {entry.transitions.length} transitions · {entry.semanticRules.length} rules
              </div>
            </div>

            {entry.transitions.length > 0 && (
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={sectionLabel}>Transitions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {entry.transitions.map((transition, idx) => (
                    <div
                      key={`${transition.fromKey}-${transition.actionKey}-${idx}`}
                      style={{
                        border: "1px solid var(--color-divider)",
                        padding: "var(--space-md)",
                        backgroundColor: "var(--color-surface-raised)",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      <div style={{ color: "var(--color-warning)" }}>{transition.to?.title}</div>
                      <div style={{ color: "var(--color-text-secondary)", wordBreak: "break-all" }}>
                        {transition.to?.url}
                      </div>
                      {transition.delta && (
                        <div style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-xs)" }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {entry.semanticRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        border: "1px solid var(--color-divider)",
                        padding: "var(--space-md)",
                        backgroundColor: "var(--color-surface-raised)",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                        {rule.category && (
                          <span style={badgeStyle}>{rule.category}</span>
                        )}
                        <span style={{ color: "var(--color-warning)", textTransform: "uppercase" }}>
                          {rule.kind}
                        </span>
                      </div>
                      {rule.tags && rule.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
                          {rule.tags.map((tag) => (
                            <span key={tag} style={tagStyle}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {rule.note && (
                        <div style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-xs)" }}>{rule.note}</div>
                      )}
                      {rule.firstSeenAt && (
                        <div style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
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
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-background)",
  color: "var(--color-accent)",
  fontFamily: "var(--font-mono)",
  padding: "var(--space-sm) var(--space-md)",
  fontSize: "var(--font-size-sm)",
};

const sectionLabel: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-xs)",
  letterSpacing: "var(--letter-spacing-caps)",
  textTransform: "uppercase",
  marginBottom: "var(--space-sm)",
};

const badgeStyle: React.CSSProperties = {
  backgroundColor: "var(--color-accent-muted)",
  border: "1px solid var(--color-accent)",
  color: "var(--color-accent)",
  fontSize: "var(--font-size-xs)",
  padding: "1px var(--space-xs)",
  borderRadius: "var(--radius-sm)",
  textTransform: "uppercase",
  letterSpacing: "var(--letter-spacing-caps)",
};

const tagStyle: React.CSSProperties = {
  backgroundColor: "var(--color-overlay)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-xs)",
  padding: "1px var(--space-xs)",
  borderRadius: "var(--radius-sm)",
};
