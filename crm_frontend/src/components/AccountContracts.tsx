import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Loader2, Pencil, Plus, Upload, XCircle } from "lucide-react";
import {
  approveContract,
  createContract,
  listContracts,
  rejectContract,
  type Contract,
  type ContractChannel,
  updateContractRateGrid,
  uploadContractPricingExcel,
} from "@/services/contracts";
import { listProperties, type Property } from "@/services/properties";
import { getAccountContacts, type Contact } from "@/services/contacts";
import { RateGrid } from "@/components/RateGrid";
import { createEmptyRateGridValue, normalizeRateGridValue, type RateGridValue } from "@/models/contract";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";

interface AccountContractsProps {
  accountId: string;
  canManage?: boolean;
}

function statusBadge(status: Contract["status"]) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-red-100 text-red-800 border-red-200";
    case "PENDING_APPROVAL":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function stepBadgeClass(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "bg-green-50 border-green-200 text-green-700";
  if (status === "REJECTED") return "bg-red-50 border-red-200 text-red-700";
  return "bg-amber-50 border-amber-200 text-amber-700";
}

export function AccountContracts({ accountId, canManage }: AccountContractsProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: "",
    channel: "B2B" as ContractChannel,
    propertyIds: [] as string[],
    contactId: "",
    contactEmail: "",
  });

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const [editingRatesFor, setEditingRatesFor] = useState<string | null>(null);
  const [rateGridValue, setRateGridValue] = useState<RateGridValue>(() => createEmptyRateGridValue());
  const [savingRates, setSavingRates] = useState(false);

  const [rejectNote, setRejectNote] = useState("");
  const [rejectingContract, setRejectingContract] = useState<Contract | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p, cont] = await Promise.all([
        listContracts(accountId),
        listProperties(),
        getAccountContacts(accountId),
      ]);
      setContracts(c);
      setProperties(p);
      setContacts(cont);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to load contracts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accountId]);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ id: p._id, name: p.name })),
    [properties]
  );

  const propertyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p._id, p.name);
    return m;
  }, [properties]);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts) m.set(c.id, c.name);
    return m;
  }, [contacts]);

  const handleCreate = async () => {
    if (!createForm.companyName.trim()) {
      toast({ title: "Validation", description: "Company name is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await createContract({
        accountId,
        companyName: createForm.companyName.trim(),
        channel: createForm.channel,
        propertyIds: createForm.propertyIds,
        contactId: createForm.contactId || undefined,
        contactEmail: createForm.contactEmail || undefined,
      });
      toast({ title: "Success", description: "Contract created (and emailed if possible)" });
      setIsCreateOpen(false);
      setCreateForm({ companyName: "", channel: "B2B", propertyIds: [], contactId: "", contactEmail: "" });
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create contract", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (contract: Contract) => {
    try {
      await approveContract(contract.id);
      toast({ title: "Approved", description: "Contract approved" });
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectingContract || !rejectNote.trim()) return;
    try {
      await rejectContract(rejectingContract.id, rejectNote.trim());
      toast({ title: "Contract rejected" });
      setRejectingContract(null);
      setRejectNote("");
      await load();
    } catch (err: any) {
      toast({
        title: "Failed to reject",
        description: err?.message || "Failed to reject",
        variant: "destructive",
      });
    }
  };

  const openUpload = (contractId: string) => {
    setUploadingFor(contractId);
    uploadInputRef.current?.click();
  };

  const openRatesEditor = (contract: Contract) => {
    const existing = (contract as any).rateGrid;
    if (existing?.b2b && existing?.b2c) {
      setRateGridValue(normalizeRateGridValue(existing) as RateGridValue);
    } else {
      setRateGridValue(createEmptyRateGridValue());
    }
    setEditingRatesFor(contract.id);
  };

  const saveRates = async () => {
    if (!editingRatesFor) return;
    setSavingRates(true);
    try {
      await updateContractRateGrid(editingRatesFor, rateGridValue as any);
      toast({ title: "Saved", description: "Rate grid updated" });
      setEditingRatesFor(null);
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setSavingRates(false);
    }
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;
    try {
      await uploadContractPricingExcel(uploadingFor, file);
      toast({ title: "Uploaded", description: "Pricing grid imported" });
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Upload failed", variant: "destructive" });
    } finally {
      e.target.value = "";
      setUploadingFor(null);
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contracts</CardTitle>
        {canManage && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Contract
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls"
          onChange={onUploadFile}
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No contracts yet.</div>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => {
              const currentUserId = user?._id || user?.id;
              const myPendingStep = contract.approvals?.find(
                (a) => a.status === "PENDING" && a.approverUserId === currentUserId
              );
              const canActOnContract = !!myPendingStep && contract.status === "PENDING_APPROVAL";
              const propertyNames = (contract.propertyIds ?? []).map((id) => propertyMap.get(id) ?? id);
              const submittedOn = contract.createdAt
                ? new Date(contract.createdAt).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—";

              return (
                <Card key={contract.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{contract.companyName}</p>
                        <Badge variant="outline">{contract.channel}</Badge>
                        <Badge variant="outline" className={statusBadge(contract.status)}>
                          {contract.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Submitted: {submittedOn}</p>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Properties: {propertyNames.length ? propertyNames.join(", ") : "—"}
                      </p>
                      <p>Contact: {contract.contactEmail || userMap.get(contract.contactId || "") || "—"}</p>
                      <p>Submitted By: {contract.submittedByUserId ?? "—"}</p>
                    </div>

                    {contract.approvals && contract.approvals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Approval Chain
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[...contract.approvals]
                            .sort((a, b) => a.step - b.step)
                            .map((approval, idx) => (
                              <div
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${stepBadgeClass(
                                  approval.status
                                )}`}
                              >
                                {approval.status === "APPROVED" && <CheckCircle2 className="h-3 w-3" />}
                                {approval.status === "REJECTED" && <XCircle className="h-3 w-3" />}
                                {approval.status === "PENDING" && <Clock className="h-3 w-3" />}
                                <span>{approval.label || `Step ${approval.step}`}</span>
                                <span>·</span>
                                <span>{approval.approverName || approval.approverUserId}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => openRatesEditor(contract)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit Rates
                        </Button>
                      )}
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => openUpload(contract.id)}>
                          <Upload className="h-4 w-4 mr-2" /> Upload Excel
                        </Button>
                      )}
                      {canActOnContract && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(contract)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectingContract(contract)}>
                            <XCircle className="h-4 w-4 mr-2" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={createForm.companyName}
                onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={createForm.channel}
                onValueChange={(v) => setCreateForm({ ...createForm, channel: v as ContractChannel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Send to Contact (optional)</Label>
              <Select
                value={createForm.contactId || "__none__"}
                onValueChange={(v) => setCreateForm({ ...createForm, contactId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No contact</SelectItem>
                  {contacts.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If contact has email, backend will email automatically (requires your email account connected).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Or Email (optional)</Label>
              <Input
                value={createForm.contactEmail}
                onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                placeholder="someone@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Properties</Label>
              <div className="grid grid-cols-1 gap-2">
                {propertyOptions.map((p) => {
                  const checked = createForm.propertyIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setCreateForm((prev) => ({
                            ...prev,
                            propertyIds: checked
                              ? prev.propertyIds.filter((x) => x !== p.id)
                              : [...prev.propertyIds, p.id],
                          }));
                        }}
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectingContract}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingContract(null);
            setRejectNote("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection reason</Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Provide the rejection reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingContract(null);
                setRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectNote.trim()}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!editingRatesFor} onOpenChange={(open) => !open && setEditingRatesFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle>Rate Grid</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="pb-8">
              <RateGrid value={rateGridValue} onChange={setRateGridValue} />
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setEditingRatesFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveRates} disabled={savingRates}>
              {savingRates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
