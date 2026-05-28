import { useCallback, useEffect, useState } from "react";
import {
  fetchSalesSettings,
  updateSalesSettings,
  type OrgSalesSettings,
} from "@/services/accountsDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function SalesSettingsSetup() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<OrgSalesSettings>({
    financialYearStartMonth: 4,
    financialYearStartDay: 1,
    achievementMetric: "booked_leads",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSalesSettings();
      setSettings({
        financialYearStartMonth: data.financialYearStartMonth ?? 4,
        financialYearStartDay: data.financialYearStartDay ?? 1,
        achievementMetric: data.achievementMetric ?? "booked_leads",
      });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      setSaving(true);
      await updateSalesSettings(settings);
      toast({ title: "Settings saved" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure financial year boundaries and how target achievement is measured on the accounts dashboard.
      </p>
      <div>
        <Label>FY start month</Label>
        <Select
          value={String(settings.financialYearStartMonth)}
          onValueChange={(v) =>
            setSettings((s) => ({ ...s, financialYearStartMonth: parseInt(v, 10) }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>FY start day</Label>
        <Input
          type="number"
          min={1}
          max={31}
          value={settings.financialYearStartDay}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              financialYearStartDay: parseInt(e.target.value, 10) || 1,
            }))
          }
        />
      </div>
      <div>
        <Label>Achievement metric</Label>
        <Select
          value={settings.achievementMetric}
          onValueChange={(v) =>
            setSettings((s) => ({
              ...s,
              achievementMetric: v as OrgSalesSettings["achievementMetric"],
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="booked_leads">Booked leads (count)</SelectItem>
            <SelectItem value="revenue">Revenue (estimated value)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
