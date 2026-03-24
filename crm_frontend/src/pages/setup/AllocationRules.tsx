import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle } from "lucide-react";
import {
  getAllocationConfig,
  updateAllocationConfig,
  getAllocationWorkload,
  updateAgentAvailability,
} from "@/services/allocation";
import { PageHeader, Input, Select } from "@/components/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export function AllocationRules() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [workloads, setWorkloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, wl] = await Promise.all([
        getAllocationConfig(),
        getAllocationWorkload(),
      ]);
      setConfig(cfg);
      setWorkloads(wl.workloads ?? []);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfigBlur = (key: string, value: string) => {
    if (config[key] === value) return;
    const next = { ...config, [key]: value };
    setConfig(next);
    const keys: Record<string, string> = {};
    keys[key] = value;
    updateAllocationConfig(keys).then(() => {
      setSavedFeedback(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSavedFeedback(false), 1500);
    }).catch((e) => {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
      void load();
    });
  };

  const handleAvailabilityToggle = async (agentId: string, isAvailable: boolean) => {
    try {
      await updateAgentAvailability(agentId, isAvailable);
      setWorkloads((prev) =>
        prev.map((w) =>
          w.agentId === agentId ? { ...w, isAvailable } : w
        )
      );
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const dailyCap = Number(config.daily_lead_cap ?? "30") || 30;

  const getProgressColor = (count: number, cap: number) => {
    const pct = cap > 0 ? (count / cap) * 100 : 0;
    if (pct >= 90) return "#ef4444";
    if (pct >= 70) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Allocation Rules"
        subtitle="Configure how leads are assigned to agents"
      />

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading...</div>
      ) : (
        <>
          {/* Allocation Config */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Allocation Config</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <Label>Daily Lead Cap</Label>
                <Input
                  type="number"
                  value={config.daily_lead_cap ?? "30"}
                  onBlur={(e) => handleConfigBlur("daily_lead_cap", e.target.value)}
                  onChange={(e) => setConfig((c) => ({ ...c, daily_lead_cap: e.target.value }))}
                />
              </div>
              <div>
                <Label>Allocation Window (hours after login)</Label>
                <Input
                  type="number"
                  value={config.allocation_window_hours ?? "8"}
                  onBlur={(e) => handleConfigBlur("allocation_window_hours", e.target.value)}
                  onChange={(e) => setConfig((c) => ({ ...c, allocation_window_hours: e.target.value }))}
                />
              </div>
              <div>
                <Label>Overflow Mode</Label>
                <Select
                  value={config.overflow_mode ?? "queue"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setConfig((c) => ({ ...c, overflow_mode: v }));
                    handleConfigBlur("overflow_mode", v);
                  }}
                >
                  <option value="queue">Queue</option>
                  <option value="smart_queue">Smart Queue</option>
                </Select>
              </div>
              <div>
                <Label>Alert Threshold (%)</Label>
                <Input
                  type="number"
                  value={config.alert_threshold_percent ?? "90"}
                  onBlur={(e) => handleConfigBlur("alert_threshold_percent", e.target.value)}
                  onChange={(e) => setConfig((c) => ({ ...c, alert_threshold_percent: e.target.value }))}
                />
              </div>
              <div>
                <Label>Assignment Mode</Label>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    marginBottom: 6,
                  }}
                >
                  How leads are distributed to available agents
                </p>
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  {(["round_robin", "manual"] as const).map((mode) => {
                    const isActive = (config.allocation_mode ?? "round_robin") === mode;
                    const isLeft = mode === "round_robin";
                    const label = mode === "round_robin" ? "Round Robin" : "Manual Only";
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          const value = mode;
                          setConfig((c) => ({ ...c, allocation_mode: value }));
                          handleConfigBlur("allocation_mode", value);
                        }}
                        style={{
                          height: 32,
                          padding: "0 14px",
                          fontSize: 13,
                          fontWeight: isActive ? 500 : 400,
                          border: "none",
                          borderRight: isLeft ? "1px solid #e5e7eb" : "none",
                          borderRadius: isLeft ? "6px 0 0 6px" : "0 6px 6px 0",
                          backgroundColor: isActive ? "#f0f0ff" : "#ffffff",
                          color: isActive ? "#4f46e5" : "#6b7280",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {savedFeedback && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  fontSize: 14,
                  color: "#059669",
                }}
              >
                <CheckCircle size={16} />
                Saved
              </div>
            )}
          </section>

          {/* Agent Workload */}
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agent Workload Today</h2>
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
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>AGENT</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>OPEN LEADS</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>TODAY&apos;S LEADS</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>CAP</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>AVAILABILITY</th>
                  </tr>
                </thead>
                <tbody>
                  {workloads.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                        No users found. Add team members first.
                      </td>
                    </tr>
                  ) : (
                    workloads.map((agent) => {
                      const leadsToday = agent.leadsToday ?? 0;
                      const openLeads = agent.openLeads ?? 0;
                      const isAvailable = agent.isAvailable !== false;
                      const initial = (agent.name ?? "?").slice(0, 1).toUpperCase();
                      const avatarBg = agent.isOnline ? "#10b981" : "#9ca3af";

                      return (
                        <tr key={agent.agentId} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: avatarBg,
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                {initial}
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>{agent.name ?? "Unknown"}</div>
                                {agent.email && (
                                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.email}</div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: agent.isOnline ? "#10b981" : "#9ca3af",
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {agent.isOnline ? "Online" : "Offline"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500 }}>
                            {openLeads}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 500 }}>
                                {leadsToday}/{dailyCap}
                              </span>
                              <div
                                style={{
                                  marginTop: 6,
                                  width: "100%",
                                  maxWidth: 140,
                                  height: 4,
                                  background: "var(--border-light)",
                                  borderRadius: 2,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, dailyCap > 0 ? (leadsToday / dailyCap) * 100 : 0)}%`,
                                    height: "100%",
                                    background: getProgressColor(leadsToday, dailyCap),
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 14 }}>{dailyCap}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <Switch
                              checked={isAvailable}
                              onCheckedChange={(v) => handleAvailabilityToggle(agent.agentId, v)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
