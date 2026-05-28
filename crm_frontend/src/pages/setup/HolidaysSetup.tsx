import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createHoliday,
  deleteHoliday,
  listHolidaysAdmin,
  type HolidayEntry,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export function HolidaysSetup() {
  const { toast } = useToast();
  const [items, setItems] = useState<HolidayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    type: "public_holiday" as "public_holiday" | "season",
    region: "",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await listHolidaysAdmin());
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    try {
      await createHoliday(form);
      setOpen(false);
      setForm({ name: "", startDate: "", endDate: "", type: "public_holiday", region: "" });
      await load();
      toast({ title: "Holiday added" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHoliday(id);
      await load();
      toast({ title: "Removed" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add holiday or season
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No holidays configured yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((h) => (
            <li key={h._id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-muted-foreground text-xs">
                  {format(parseISO(h.startDate.slice(0, 10)), "d MMM yyyy")} –{" "}
                  {format(parseISO(h.endDate.slice(0, 10)), "d MMM yyyy")}
                  {" · "}
                  {h.type === "season" ? "Season" : "Public holiday"}
                  {h.region ? ` · ${h.region}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void handleDelete(h._id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add holiday or season</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as "public_holiday" | "season" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public_holiday">Public holiday</SelectItem>
                  <SelectItem value="season">Season</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Region (optional)</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
