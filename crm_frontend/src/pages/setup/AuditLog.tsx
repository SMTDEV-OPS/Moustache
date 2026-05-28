import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listAuditLog, type AuditLogEntry } from "@/services/adminAuditLog";
import { listUsers } from "@/services/users";
import { PageHeader, Button, Input, Select } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ENTITY_TYPES = ["All", "Lead", "Pipeline", "Workflow", "Field", "User"];
const ACTIONS = ["All", "Created", "Updated", "Deleted", "Stage Moved", "Assigned"];

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  created: { bg: "#d1fae5", text: "#065f46" },
  updated: { bg: "#dbeafe", text: "#1e40af" },
  deleted: { bg: "#fef2f2", text: "#ef4444" },
  default: { bg: "var(--border-light)", text: "var(--text-muted)" },
};

function JsonDiff({ oldVal, newVal }: { oldVal?: Record<string, any>; newVal?: Record<string, any> }) {
  const keys = new Set([
    ...Object.keys(oldVal ?? {}),
    ...Object.keys(newVal ?? {}),
  ]);
  return (
    <div
      style={{
        fontSize: 13,
        fontFamily: "monospace",
        background: "var(--bg)",
        padding: 8,
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}
    >
      {Array.from(keys).map((k) => {
        const o = oldVal?.[k];
        const n = newVal?.[k];
        const changed = JSON.stringify(o) !== JSON.stringify(n);
        return (
          <div key={k} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--text-muted)" }}>{k}: </span>
            {changed && o !== undefined && (
              <span style={{ color: "#ef4444", textDecoration: "line-through" }}>
                {JSON.stringify(o)}
              </span>
            )}
            {changed && o !== undefined && " → "}
            {n !== undefined && (
              <span style={{ color: changed ? "#059669" : "inherit" }}>
                {JSON.stringify(n)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AuditLog() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({
    entity_type: "",
    action: "",
    user_id: "",
    from: "",
    to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [res, usr] = await Promise.all([
        listAuditLog({
          page,
          limit,
          entity_type: appliedFilters.entity_type || undefined,
          action: appliedFilters.action
            ? appliedFilters.action.toLowerCase().replace(/ /g, "_")
            : undefined,
          user_id: appliedFilters.user_id || undefined,
          from: appliedFilters.from || undefined,
          to: appliedFilters.to || undefined,
        }),
        listUsers().catch(() => []),
      ]);
      setLogs(res.data ?? []);
      setTotal(res.total ?? 0);
      setUsers(usr.map((u: any) => ({ id: u.id ?? u._id, name: u.name })));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, limit, appliedFilters, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.ceil(total / limit);
  const userName = (entry: AuditLogEntry) =>
    (entry.userId as any)?.name ?? (entry.userId as any)?.email ?? "—";

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Audit Log"
        subtitle="Track all changes and actions in your CRM"
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
            Entity Type
          </label>
          <Select
            value={filters.entity_type || "All"}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                entity_type: e.target.value === "All" ? "" : e.target.value,
              }))
            }
            style={{ width: 140 }}
          >
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e === "All" ? "" : e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
            Action
          </label>
          <Select
            value={filters.action || "All"}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                action: e.target.value === "All" ? "" : e.target.value,
              }))
            }
            style={{ width: 140 }}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a === "All" ? "" : a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
            User
          </label>
          <Select
            value={filters.user_id || ""}
            onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))}
            style={{ width: 160 }}
          >
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
            From
          </label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            style={{ width: 140 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
            To
          </label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            style={{ width: 140 }}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAppliedFilters(filters)}
          >
            Apply Filters
          </Button>
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--border-light)" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>TIMESTAMP</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>USER</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ACTION</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ENTITY</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>CHANGES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                  No audit entries
                </td>
              </tr>
            ) : (
              logs.map((entry) => {
                const hasDiff =
                  (entry as any).old_value_json ||
                  (entry as any).new_value_json ||
                  (entry as any).before ||
                  (entry as any).after;
                const style =
                  ACTION_STYLES[entry.action] ?? ACTION_STYLES.default;
                const isExpanded = expandedId === entry._id;
                return (
                  <tr key={entry._id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        width: 160,
                      }}
                    >
                      {entry.createdAt
                        ? format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm")
                        : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "var(--primary-light)",
                            color: "var(--primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {(userName(entry) ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13 }}>{userName(entry)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: style.bg,
                          color: style.text,
                        }}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {entry.entity_type}
                      </span>{" "}
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {entry.entity_id}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {hasDiff && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry._id)
                          }
                          style={{
                            fontSize: 13,
                            color: "var(--primary)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {isExpanded ? "Hide diff" : "View diff"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {expandedId && (
          <div
            style={{
              padding: 16,
              borderTop: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          >
            {logs
              .filter((e) => e._id === expandedId)
              .map((e) => (
                <JsonDiff
                  key={e._id}
                  oldVal={(e as any).old_value_json ?? (e as any).before}
                  newVal={(e as any).new_value_json ?? (e as any).after}
                />
              ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
