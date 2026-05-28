import { useEffect, useState, useCallback } from "react";
import { getAllocationWorkload, updateAgentAvailability } from "@/services/allocation";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface WorkloadItem {
  agentId: string;
  name?: string;
  agentName?: string;
  email?: string;
  leadsToday?: number;
  openLeads?: number;
  isAvailable?: boolean;
  daily_cap?: number;
}

export function LeadAllocationWorkload() {
  const { toast } = useToast();
  const [workloads, setWorkloads] = useState<WorkloadItem[]>([]);
  const [dailyCap, setDailyCap] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [wl, cfg] = await Promise.all([
        getAllocationWorkload(),
        import("@/services/allocation").then((m) => m.getAllocationConfig()),
      ]);
      const items = (wl.workloads ?? []) as WorkloadItem[];
      setWorkloads(items);
      const cap = Number((cfg as Record<string, string>).daily_lead_cap ?? "30") || 30;
      setDailyCap(cap);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (agentId: string, isAvailable: boolean) => {
    try {
      await updateAgentAvailability(agentId, isAvailable);
      setWorkloads((p) => p.map((w) => (w.agentId === agentId ? { ...w, isAvailable } : w)));
      toast({ title: isAvailable ? "Agent available" : "Agent unavailable" });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (loading) return <div className="py-8 text-muted-foreground">Loading...</div>;

  const getProgressColor = (count: number, cap: number) => {
    const pct = cap > 0 ? (count / cap) * 100 : 0;
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Today&apos;s lead count per agent. Toggle availability to exclude agents from receiving new leads.
      </p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Agent</th>
              <th className="text-left p-3 font-medium">Open leads</th>
              <th className="text-left p-3 font-medium">Today</th>
              <th className="text-left p-3 font-medium">Cap</th>
              <th className="text-left p-3 font-medium">Available</th>
            </tr>
          </thead>
          <tbody>
            {workloads.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No agents found
                </td>
              </tr>
            ) : (
              workloads.map((w) => {
                const leadsToday = w.leadsToday ?? 0;
                const openLeads = w.openLeads ?? 0;
                const name = w.name ?? w.agentName ?? "Unknown";
                const isAvailable = w.isAvailable !== false;

                return (
                  <tr key={w.agentId} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div className="font-medium">{name}</div>
                      {w.email && <div className="text-xs text-muted-foreground">{w.email}</div>}
                    </td>
                    <td className="p-3">{openLeads}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{leadsToday}/{dailyCap}</span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(leadsToday, dailyCap)}`}
                            style={{ width: `${Math.min(100, (leadsToday / dailyCap) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{dailyCap}</td>
                    <td className="p-3">
                      <Switch
                        checked={isAvailable}
                        onCheckedChange={(v) => handleToggle(w.agentId, v)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
