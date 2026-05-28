import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle } from "lucide-react";
import { getAllocationConfig, updateAllocationConfig } from "@/services/allocation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function LeadAllocationCapacity() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cfg = await getAllocationConfig();
      setConfig(cfg);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBlur = (key: string, value: string) => {
    if (config[key] === value) return;
    setConfig((c) => ({ ...c, [key]: value }));
    updateAllocationConfig({ [key]: value })
      .then(() => {
        setSavedFeedback(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSavedFeedback(false), 1500);
      })
      .catch((e) => {
        toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
        void load();
      });
  };

  if (loading) return <div className="py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Daily cap and login window affect which agents are eligible for new leads. Manual mode disables auto-assignment.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Daily lead cap per agent</Label>
          <Input
            type="number"
            value={config.daily_lead_cap ?? "30"}
            onBlur={(e) => handleBlur("daily_lead_cap", e.target.value)}
            onChange={(e) => setConfig((c) => ({ ...c, daily_lead_cap: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Allocation window (hours after login)</Label>
          <Input
            type="number"
            value={config.allocation_window_hours ?? "8"}
            onBlur={(e) => handleBlur("allocation_window_hours", e.target.value)}
            onChange={(e) => setConfig((c) => ({ ...c, allocation_window_hours: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Overflow mode</Label>
          <select
            className="mt-1 w-full h-9 px-3 border rounded-md text-sm"
            value={config.overflow_mode ?? "queue"}
            onChange={(e) => {
              const v = e.target.value;
              setConfig((c) => ({ ...c, overflow_mode: v }));
              handleBlur("overflow_mode", v);
            }}
          >
            <option value="queue">Queue</option>
            <option value="smart_queue">Smart Queue</option>
          </select>
        </div>
        <div>
          <Label>Alert threshold (%)</Label>
          <Input
            type="number"
            value={config.alert_threshold_percent ?? "90"}
            onBlur={(e) => handleBlur("alert_threshold_percent", e.target.value)}
            onChange={(e) => setConfig((c) => ({ ...c, alert_threshold_percent: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>Assignment mode</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">Manual only = no auto-assignment; leads stay unassigned until manually assigned</p>
        <div className="inline-flex border rounded-md overflow-hidden">
          {(["round_robin", "manual"] as const).map((mode) => {
            const isActive = (config.allocation_mode ?? "round_robin") === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setConfig((c) => ({ ...c, allocation_mode: mode }));
                  handleBlur("allocation_mode", mode);
                }}
                className={`px-4 py-2 text-sm border-r last:border-r-0 ${isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
              >
                {mode === "round_robin" ? "Round Robin" : "Manual Only"}
              </button>
            );
          })}
        </div>
      </div>

      {savedFeedback && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          Saved
        </div>
      )}
    </div>
  );
}
