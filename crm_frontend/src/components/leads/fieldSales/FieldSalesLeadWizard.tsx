import { useEffect, useState } from "react";
import { formatInr } from "@/lib/leadDates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { listProperties, type Property } from "@/services/properties";
import { listAccounts, type Account } from "@/services/accounts";
import {
  FIELD_SALES_SOURCES,
  MEAL_PLAN_OPTIONS,
  OCCASION_OPTIONS,
  SOURCES_REQUIRING_ACCOUNT,
  type ItineraryPricingLine,
} from "@/constants/fieldSalesLeadOptions";
import { checkDuplicateLeads, type DuplicateLeadMatch } from "@/services/fieldSalesLeads";
import {
  useFieldSalesLeadForm,
  type FieldSalesLeadFormState,
} from "./useFieldSalesLeadForm";
import { getLeadDetail } from "@/services/leads";

interface FieldSalesLeadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string;
  defaultAccountName?: string;
  editLeadId?: string | null;
  onSuccess?: () => void;
}

export function FieldSalesLeadWizard({
  open,
  onOpenChange,
  defaultAccountId,
  defaultAccountName,
  editLeadId: editLeadIdProp,
  onSuccess,
}: FieldSalesLeadWizardProps) {
  const leadForm = useFieldSalesLeadForm({ defaultAccountId });
  const { form, setForm, isSubmitting, estimatedValue, resetForm, loadForEdit, submit, editLeadId } =
    leadForm;

  const [hotels, setHotels] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateLeadMatch[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listProperties().then((props) =>
      setHotels(props.filter((p) => p.status === "ACTIVE"))
    );
    void listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setDuplicates([]);
      return;
    }
    if (editLeadIdProp) {
      setLoadingEdit(true);
      void getLeadDetail(editLeadIdProp)
        .then(loadForEdit)
        .finally(() => setLoadingEdit(false));
    } else {
      resetForm();
    }
  }, [open, editLeadIdProp]);

  const patch = (partial: Partial<FieldSalesLeadFormState>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const updatePricingLine = (index: number, field: keyof ItineraryPricingLine, value: string) => {
    setForm((prev) => {
      const lines = [...prev.pricingLines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, pricingLines: lines };
    });
  };

  const runDuplicateCheck = async () => {
    const matches = await checkDuplicateLeads({
      phone: form.phone,
      email: form.email,
      accountId: form.accountId || defaultAccountId,
      checkIn: form.checkInDate,
      checkOut: form.checkOutDate,
      excludeLeadId: editLeadId || undefined,
    });
    return matches;
  };

  const handleSubmit = async (force = false) => {
    try {
      if (!force && !editLeadId) {
        const matches = await runDuplicateCheck();
        if (matches.length > 0) {
          setDuplicates(matches);
          setShowDuplicateDialog(true);
          return;
        }
      }
      await submit();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save lead");
    }
  };

  const filteredAccounts = accounts.filter((a) =>
    !accountSearch.trim()
      ? true
      : a.name?.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const showAccountPicker =
    SOURCES_REQUIRING_ACCOUNT.has(form.source) && !defaultAccountId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface">
          <DialogHeader>
            <DialogTitle>{editLeadId ? "Edit field sales lead" : "Add field sales lead"}</DialogTitle>
            <DialogDescription>
              {defaultAccountName
                ? `Account: ${defaultAccountName}`
                : "Capture POC, stay, rate offer, and follow-up."}
            </DialogDescription>
          </DialogHeader>

          {loadingEdit ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-2">
              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">Contact</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Lead POC name *</Label>
                    <Input
                      value={form.pocName}
                      onChange={(e) => patch({ pocName: e.target.value })}
                      placeholder="Primary contact at TA / company"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Alternate contact</Label>
                    <Input
                      value={form.alternateContact}
                      onChange={(e) => patch({ alternateContact: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">Source & account</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Lead source *</Label>
                    <Select value={form.source} onValueChange={(v) => patch({ source: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_SALES_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lead temperature *</Label>
                    <Select
                      value={form.heatLevel}
                      onValueChange={(v) => patch({ heatLevel: v as FieldSalesLeadFormState["heatLevel"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOT">Hot</SelectItem>
                        <SelectItem value="WARM">Warm</SelectItem>
                        <SelectItem value="COLD">Cold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {showAccountPicker && (
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Account (TA / Corporate) *</Label>
                      <Input
                        placeholder="Search accounts..."
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        className="mb-1"
                      />
                      <Select value={form.accountId} onValueChange={(v) => patch({ accountId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredAccounts.slice(0, 50).map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label>Company name (snapshot)</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => patch({ companyName: e.target.value })}
                      placeholder="Optional if not linked to account"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">Stay</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Hotel</Label>
                    <Select
                      value={form.hotelName}
                      onValueChange={(name) => {
                        const p = hotels.find((h) => h.name === name);
                        patch({ hotelName: name, propertyId: p?._id || "" });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select hotel (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {hotels.map((p) => (
                          <SelectItem key={p._id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Check-in</Label>
                    <Input
                      type="date"
                      value={form.checkInDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        patch({
                          checkInDate: v,
                          checkOutDate:
                            form.checkOutDate && v && form.checkOutDate < v ? "" : form.checkOutDate,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Check-out</Label>
                    <Input
                      type="date"
                      min={form.checkInDate || undefined}
                      value={form.checkOutDate}
                      onChange={(e) => patch({ checkOutDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Total rooms</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.roomsRequested}
                      onChange={(e) => patch({ roomsRequested: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Occasion</Label>
                    <Select value={form.occasion} onValueChange={(v) => patch({ occasion: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select occasion" />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCASION_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Rate offer</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patch({
                        pricingLines: [
                          ...form.pricingLines,
                          { roomCategory: "", mealPlan: "CP", ratePerNight: "", inclusions: "" },
                        ],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add line
                  </Button>
                </div>
                {form.pricingLines.map((line, idx) => (
                  <div key={idx} className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Room category</Label>
                      <Input
                        value={line.roomCategory}
                        onChange={(e) => updatePricingLine(idx, "roomCategory", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Meal plan</Label>
                      <Select
                        value={line.mealPlan}
                        onValueChange={(v) => updatePricingLine(idx, "mealPlan", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEAL_PLAN_OPTIONS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Rate per room per night (₹)</Label>
                      <Input
                        value={line.ratePerNight}
                        onChange={(e) => updatePricingLine(idx, "ratePerNight", e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Other inclusions</Label>
                        <Textarea
                          rows={2}
                          value={line.inclusions}
                          onChange={(e) => updatePricingLine(idx, "inclusions", e.target.value)}
                        />
                      </div>
                      {form.pricingLines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6"
                          onClick={() =>
                            patch({
                              pricingLines: form.pricingLines.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-sm font-medium text-green-700">
                  Estimated booking value: {formatInr(estimatedValue)}
                </p>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">Follow-up (manual)</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Follow-up date</Label>
                    <Input
                      type="date"
                      value={form.followUpDate}
                      onChange={(e) => patch({ followUpDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={form.followUpTime}
                      onChange={(e) => patch({ followUpTime: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.followUpNotes}
                      onChange={(e) => patch({ followUpNotes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={2} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isSubmitting || loadingEdit} onClick={() => void handleSubmit()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editLeadId ? "Save changes" : "Create lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="bg-surface">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Possible duplicate leads
            </DialogTitle>
            <DialogDescription>
              Review matches before creating this lead.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
            {duplicates.map((d) => (
              <li key={d.leadId} className="rounded border p-2">
                <span className="font-medium">{d.leadNumber}</span>
                {d.contactName && ` — ${d.contactName}`}
                <p className="text-muted-foreground">{d.reason}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Go back
            </Button>
            <Button onClick={() => {
              setShowDuplicateDialog(false);
              void handleSubmit(true);
            }}>
              Create anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
