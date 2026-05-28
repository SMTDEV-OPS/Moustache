import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormWizardShell } from "@/components/forms/FormWizardShell";
import { WizardStepIndicator } from "@/components/forms/WizardStepIndicator";
import {
  saveAccountPotential,
  type AccountPotential,
  type LocationType,
  type SegmentType,
} from "@/services/accountPotentials";
import { MAJOR_INDIAN_CITIES, INDIAN_STATES, CITIES_BY_STATE } from "@/constants/accountData";
import {
  ComboRow,
  FIELD_LABELS,
  LOCATION_OPTIONS,
  SEGMENT_OPTIONS,
  defaultComboData,
  emptyEventPotential,
  emptyRoomPotential,
  getSegmentFields,
} from "./potentialConstants";

const STEPS = [
  { num: 1, label: "Market" },
  { num: 2, label: "Segments" },
  { num: 3, label: "Targets" },
  { num: 4, label: "Review" },
] as const;

const STEP_SUBTITLES: Record<number, string> = {
  1: "City and year for this potential",
  2: "Location and segment combinations",
  3: "Revenue targets and competition",
  4: "Review and save",
};

interface PotentialWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  selectedYear: number;
  /** When editing a single existing record */
  editPotential?: AccountPotential | null;
  onSuccess: () => void;
}

export function PotentialWizard({
  open,
  onOpenChange,
  accountId,
  selectedYear,
  editPotential,
  onSuccess,
}: PotentialWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [city, setCity] = useState("");
  const [year, setYear] = useState(selectedYear);
  const [remarks, setRemarks] = useState("");
  const [dialogStateFilter, setDialogStateFilter] = useState("");
  const [comboRows, setComboRows] = useState<ComboRow[]>([
    { id: "1", location: "CBD", segment: "LUXURY" },
  ]);
  const [comboData, setComboData] = useState<Record<string, Partial<AccountPotential>>>(
    defaultComboData() as Record<string, Partial<AccountPotential>>
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      return;
    }
    if (editPotential) {
      setCity(editPotential.city);
      setYear(editPotential.year);
      setRemarks(editPotential.remarks ?? "");
      const rowId = "1";
      setComboRows([{ id: rowId, location: editPotential.location, segment: editPotential.segment }]);
      setComboData({
        [rowId]: {
          fitPotential: editPotential.fitPotential || { ...emptyRoomPotential },
          groupPotential: editPotential.groupPotential || { ...emptyRoomPotential },
          longStayPotential: editPotential.longStayPotential || { ...emptyRoomPotential },
          banquetPotential: editPotential.banquetPotential || { ...emptyEventPotential },
          fbPotential: editPotential.fbPotential || { ...emptyEventPotential },
          spaPotential: editPotential.spaPotential || { ...emptyEventPotential },
          competitors: editPotential.competitors || [],
        },
      });
    } else {
      setCity("");
      setYear(selectedYear);
      setRemarks("");
      setDialogStateFilter("");
      setComboRows([{ id: "1", location: "CBD", segment: "LUXURY" }]);
      setComboData(defaultComboData() as Record<string, Partial<AccountPotential>>);
    }
  }, [open, editPotential?.id, selectedYear]);

  const getComboFormData = (rowId: string): Partial<AccountPotential> =>
    comboData[rowId] || {
      fitPotential: { ...emptyRoomPotential },
      groupPotential: { ...emptyRoomPotential },
      longStayPotential: { ...emptyRoomPotential },
      banquetPotential: { ...emptyEventPotential },
      fbPotential: { ...emptyEventPotential },
      spaPotential: { ...emptyEventPotential },
      competitors: [],
    };

  const updateComboData = (rowId: string, updates: Partial<AccountPotential>) => {
    setComboData((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), ...updates } }));
  };

  const addRow = () => {
    const id = `row-${Date.now()}`;
    setComboRows((prev) => [...prev, { id, location: "CBD", segment: "LUXURY" }]);
    setComboData((prev) => ({
      ...prev,
      [id]: {
        fitPotential: { ...emptyRoomPotential },
        groupPotential: { ...emptyRoomPotential },
        longStayPotential: { ...emptyRoomPotential },
        banquetPotential: { ...emptyEventPotential },
        fbPotential: { ...emptyEventPotential },
        spaPotential: { ...emptyEventPotential },
        competitors: [],
      },
    }));
  };

  const removeRow = (rowId: string) => {
    if (comboRows.length <= 1) return;
    setComboRows((prev) => prev.filter((r) => r.id !== rowId));
    setComboData((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const updateRow = (rowId: string, updates: Partial<{ location: LocationType; segment: SegmentType }>) => {
    setComboRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)));
  };

  const validateStep = (s: number): boolean => {
    if (s === 1 && !city.trim()) {
      toast({ title: "Required", description: "Select a city", variant: "destructive" });
      return false;
    }
    if (s === 2 && comboRows.length === 0) {
      toast({ title: "Required", description: "Add at least one location/segment", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    setIsSubmitting(true);
    try {
      for (const row of comboRows) {
        const data = getComboFormData(row.id);
        await saveAccountPotential(accountId, {
          city: city.trim(),
          year: year ?? selectedYear,
          location: row.location,
          segment: row.segment,
          remarks,
          fitPotential: data.fitPotential || { ...emptyRoomPotential },
          groupPotential: data.groupPotential || { ...emptyRoomPotential },
          longStayPotential: data.longStayPotential || { ...emptyRoomPotential },
          banquetPotential: data.banquetPotential || { ...emptyEventPotential },
          fbPotential: data.fbPotential || { ...emptyEventPotential },
          spaPotential: data.spaPotential || { ...emptyEventPotential },
          competitors: data.competitors || [],
        });
      }
      toast({ title: "Saved", description: `${comboRows.length} potential record(s) saved` });
      onOpenChange(false);
      onSuccess();
    } catch {
      toast({ title: "Error", description: "Failed to save potential data", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewTotal = useMemo(() => {
    let total = 0;
    for (const row of comboRows) {
      const data = getComboFormData(row.id);
      for (const key of getSegmentFields(row.segment)) {
        const d = (data as Record<string, { roomRevenue?: number; revenue?: number }>)[key];
        if (!d) continue;
        if ("roomRevenue" in d) total += d.roomRevenue || 0;
        else total += d.revenue || 0;
      }
    }
    return total;
  }, [comboRows, comboData]);

  const renderRoomFields = (fieldKey: string, rowId: string) => {
    const data = (getComboFormData(rowId) as Record<string, typeof emptyRoomPotential>)[fieldKey] || {
      ...emptyRoomPotential,
    };
    const updateField = (updates: Partial<typeof emptyRoomPotential>) =>
      updateComboData(rowId, { [fieldKey]: { ...data, ...updates } });
    return (
      <div key={fieldKey} className="rounded-lg border border-border p-4 space-y-3 bg-surface">
        <Label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {FIELD_LABELS[fieldKey]?.label}
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Potential</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">RN</Label>
                <Input type="number" className="h-9" value={data.roomNights} onChange={(e) => updateField({ roomNights: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Rev (₹)</Label>
                <Input type="number" className="h-9" value={data.roomRevenue} onChange={(e) => updateField({ roomRevenue: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Actual</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">RN</Label>
                <Input type="number" className="h-9" value={data.actualRoomNights} onChange={(e) => updateField({ actualRoomNights: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Rev (₹)</Label>
                <Input type="number" className="h-9" value={data.actualRoomRevenue} onChange={(e) => updateField({ actualRoomRevenue: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEventFields = (fieldKey: string, rowId: string) => {
    const data = (getComboFormData(rowId) as Record<string, typeof emptyEventPotential>)[fieldKey] || {
      ...emptyEventPotential,
    };
    const updateField = (updates: Partial<typeof emptyEventPotential>) =>
      updateComboData(rowId, { [fieldKey]: { ...data, ...updates } });
    return (
      <div key={fieldKey} className="rounded-lg border border-border p-4 space-y-3 bg-surface">
        <Label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {FIELD_LABELS[fieldKey]?.label}
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Potential</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Events</Label>
                <Input type="number" className="h-9" value={data.events} onChange={(e) => updateField({ events: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Rev (₹)</Label>
                <Input type="number" className="h-9" value={data.revenue} onChange={(e) => updateField({ revenue: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Actual</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Events</Label>
                <Input type="number" className="h-9" value={data.actualEvents} onChange={(e) => updateField({ actualEvents: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-text-muted">Rev (₹)</Label>
                <Input type="number" className="h-9" value={data.actualRevenue} onChange={(e) => updateField({ actualRevenue: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
        Cancel
      </Button>
      <div className="flex gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button
            type="button"
            onClick={() => {
              if (!validateStep(step)) return;
              setStep((s) => s + 1);
            }}
            disabled={isSubmitting}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save potential"
            )}
          </Button>
        )}
      </div>
    </>
  );

  const cityList = useMemo(() => {
    const base = dialogStateFilter ? CITIES_BY_STATE[dialogStateFilter] || MAJOR_INDIAN_CITIES : MAJOR_INDIAN_CITIES;
    if (city && !base.includes(city)) return [...base, city].sort();
    return base;
  }, [dialogStateFilter, city]);

  return (
    <FormWizardShell
      open={open}
      onOpenChange={onOpenChange}
      title={editPotential ? "Edit market potential" : "Add market potential"}
      subtitle={STEP_SUBTITLES[step]}
      stepIndicator={<WizardStepIndicator steps={STEPS} currentStep={step} />}
      footer={footer}
      maxWidth="4xl"
      maxHeight="min(90vh,860px)"
    >
      {step === 1 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>State (filter)</Label>
              <Select value={dialogStateFilter || "__all__"} onValueChange={(v) => setDialogStateFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All states</SelectItem>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                City <span className="text-destructive">*</span>
              </Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {cityList.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || selectedYear)} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">Add one or more location and segment combinations for {city || "this city"}.</p>
          {comboRows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-surface">
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label className="text-xs">Location</Label>
                <Select value={row.location} onValueChange={(v: LocationType) => updateRow(row.id, { location: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label className="text-xs">Segment</Label>
                <Select value={row.segment} onValueChange={(v: SegmentType) => updateRow(row.id, { segment: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {comboRows.length > 1 && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" /> Add another combination
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {comboRows.map((row) => {
            const fields = getSegmentFields(row.segment);
            const locLabel = LOCATION_OPTIONS.find((o) => o.value === row.location)?.label ?? row.location;
            const segLabel = SEGMENT_OPTIONS.find((o) => o.value === row.segment)?.label ?? row.segment;
            return (
              <Card key={row.id} className="border-border">
                <CardHeader className="py-3 px-4 border-b bg-muted/30">
                  <p className="text-sm font-semibold">
                    {locLabel} · {segLabel}
                  </p>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-4">
                    {fields
                      .filter((fk) => FIELD_LABELS[fk])
                      .map((fieldKey) =>
                        FIELD_LABELS[fieldKey]!.type === "room"
                          ? renderRoomFields(fieldKey, row.id)
                          : renderEventFields(fieldKey, row.id)
                      )}
                  </div>
                  <div className="pt-2 border-t border-border space-y-2">
                    <Label className="text-xs font-semibold">Competition</Label>
                    {((getComboFormData(row.id).competitors) || []).map((comp, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2">
                        <Input placeholder="Brand" className="h-8 flex-1 min-w-[100px]" value={comp.brandName || ""} onChange={(e) => {
                          const list = [...(getComboFormData(row.id).competitors || [])];
                          list[idx] = { ...list[idx], brandName: e.target.value };
                          updateComboData(row.id, { competitors: list });
                        }} />
                        <Input placeholder="Rates" className="h-8 w-28" value={comp.rates || ""} onChange={(e) => {
                          const list = [...(getComboFormData(row.id).competitors || [])];
                          list[idx] = { ...list[idx], rates: e.target.value };
                          updateComboData(row.id, { competitors: list });
                        }} />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          const list = (getComboFormData(row.id).competitors || []).filter((_, i) => i !== idx);
                          updateComboData(row.id, { competitors: list });
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      const list = [...(getComboFormData(row.id).competitors || []), { brandName: "", rates: "" }];
                      updateComboData(row.id, { competitors: list });
                    }}>
                      <Plus className="h-3 w-3 mr-1" /> Add competitor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div className="space-y-1.5">
            <Label>Strategy remarks (shared)</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Competitors, goals, notes…" />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-border bg-hover/40 p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="text-text-muted">City</span>
              <p className="font-medium">{city || "—"}</p>
            </div>
            <div>
              <span className="text-text-muted">Year</span>
              <p className="font-medium">{year}</p>
            </div>
            <div className="col-span-2">
              <span className="text-text-muted">Combinations</span>
              <p className="font-medium">{comboRows.length}</p>
            </div>
            <div className="col-span-2">
              <span className="text-text-muted">Total target revenue</span>
              <p className="font-medium">₹{reviewTotal.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            {comboRows.map((row) => (
              <li key={row.id}>
                {LOCATION_OPTIONS.find((o) => o.value === row.location)?.label} —{" "}
                {SEGMENT_OPTIONS.find((o) => o.value === row.segment)?.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormWizardShell>
  );
}
