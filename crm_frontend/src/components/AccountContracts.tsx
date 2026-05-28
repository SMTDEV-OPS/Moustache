import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Download, Eye, Loader2, Pencil, Plus, Upload, XCircle } from "lucide-react";
import { downloadContractRateTemplate } from "@/utils/contractRateTemplate";
import { ContractViewDialog } from "@/components/contracts/ContractViewDialog";
import {
  approveContract,
  listContracts,
  rejectContract,
  type Contract,
  uploadContractPricingExcel,
} from "@/services/contracts";
import { listProperties, type Property } from "@/services/properties";
import { getAccountContacts, type Contact } from "@/services/contacts";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { ContractWizard } from "@/components/contracts/ContractWizard";

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
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

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
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load contracts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accountId]);

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

  const handleApprove = async (contract: Contract) => {
    try {
      await approveContract(contract.id);
      toast({ title: "Approved", description: "Contract approved" });
      await load();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve",
        variant: "destructive",
      });
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
    } catch (err: unknown) {
      toast({
        title: "Failed to reject",
        description: err instanceof Error ? err.message : "Failed to reject",
        variant: "destructive",
      });
    }
  };

  const openUpload = (contractId: string) => {
    setUploadingFor(contractId);
    uploadInputRef.current?.click();
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;
    try {
      await uploadContractPricingExcel(uploadingFor, file);
      toast({ title: "Uploaded", description: "Pricing grid imported" });
      await load();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
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
            <Plus className="h-4 w-4 mr-2" /> New contract
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
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
                      <p>Properties: {propertyNames.length ? propertyNames.join(", ") : "—"}</p>
                      <p>Contact: {contract.contactEmail || userMap.get(contract.contactId || "") || "—"}</p>
                    </div>

                    {contract.approvals && contract.approvals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Approval chain
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
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingContract(contract)}
                      >
                        <Eye className="h-4 w-4 mr-2" /> View contract
                      </Button>
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => setEditingContract(contract)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit contract
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadContractRateTemplate()}
                          >
                            <Download className="h-4 w-4 mr-2" /> Download template
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openUpload(contract.id)}>
                            <Upload className="h-4 w-4 mr-2" /> Upload Excel
                          </Button>
                        </>
                      )}
                      {canActOnContract && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(contract)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectingContract(contract)}
                          >
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

      <ContractViewDialog
        open={!!viewingContract}
        onOpenChange={(open) => !open && setViewingContract(null)}
        contract={viewingContract}
        propertyMap={propertyMap}
        contactName={
          viewingContract?.contactId
            ? userMap.get(viewingContract.contactId)
            : undefined
        }
        onEdit={canManage ? (c) => setEditingContract(c) : undefined}
      />

      <ContractWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        accountId={accountId}
        contacts={contacts}
        apiProperties={properties}
        mode="create"
        onComplete={() => void load()}
      />

      <ContractWizard
        open={!!editingContract}
        onOpenChange={(open) => !open && setEditingContract(null)}
        accountId={accountId}
        contacts={contacts}
        apiProperties={properties}
        mode="edit"
        contract={editingContract}
        contactName={
          editingContract?.contactId
            ? userMap.get(editingContract.contactId)
            : undefined
        }
        onComplete={() => void load()}
      />

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
            <DialogTitle>Reject contract</DialogTitle>
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
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
