import { useCallback, useEffect, useState } from "react";
import { listSalesTargets, upsertSalesTarget } from "@/services/accountsDashboard";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function SalesTargetsSetup() {
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const [values, setValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listSalesTargets(year);
      const map: Record<number, string> = {};
      for (const r of rows) {
        if (!r.userId) {
          map[r.month] = String(r.targetCount ?? r.targetAmount ?? "");
        }
      }
      setValues(map);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (month: number) => {
    const raw = values[month];
    const targetCount = raw ? parseInt(raw, 10) : 0;
    try {
      await upsertSalesTarget({ year, month, targetCount: Number.isFinite(targetCount) ? targetCount : 0 });
      toast({ title: "Saved", description: `${MONTHS[month - 1]} target updated` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading targets…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Org-wide monthly targets for {year} (booked leads count). Achievement is calculated from CRM.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MONTHS.map((label, idx) => {
          const month = idx + 1;
          return (
            <div key={month} className="flex items-center gap-2 rounded-md border border-border p-3">
              <span className="w-10 text-sm font-medium">{label}</span>
              <Input
                type="number"
                min={0}
                className="h-8"
                placeholder="Target"
                value={values[month] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [month]: e.target.value }))}
                onBlur={() => void save(month)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
