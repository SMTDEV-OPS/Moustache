import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Briefcase } from "lucide-react";
import {
  listDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  type Deal,
  type DealStage,
} from "@/services/deals";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive } from "lucide-react";

const STAGES: { value: DealStage; label: string }[] = [
  { value: "QUALIFICATION", label: "Qualification" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "NA", label: "NA" },
];

function getStageColor(stage: DealStage) {
  switch (stage) {
    case "QUALIFICATION":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "PROPOSAL":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "NEGOTIATION":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "WON":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "LOST":
      return "bg-red-100 text-red-800 border-red-200";
    case "NA":
      return "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(d: string | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return d;
  }
}

interface AccountDealsProps {
  accountId: string;
  isSystemAdmin?: boolean;
}

export function AccountDeals({ accountId, isSystemAdmin }: AccountDealsProps) {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [includeNa, setIncludeNa] = useState(false);
  const [markAsNaDeal, setMarkAsNaDeal] = useState<Deal | null>(null);
  const [deleteDealConfirm, setDeleteDealConfirm] = useState<Deal | null>(null);
  const [form, setForm] = useState({
    name: "",
    stage: "QUALIFICATION" as DealStage,
    value: 0,
    currency: "INR",
    probability: 50,
    expectedCloseDate: "",
    notes: "",
  });

  const loadDeals = async () => {
    setLoading(true);
    try {
      const data = await listDeals(accountId, includeNa);
      setDeals(data);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load deals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [accountId, includeNa]);

  const openCreate = () => {
    setEditingDeal(null);
    setForm({
      name: "",
      stage: "QUALIFICATION",
      value: 0,
      currency: "INR",
      probability: 50,
      expectedCloseDate: "",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const openEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setForm({
      name: deal.name,
      stage: deal.stage,
      value: deal.value,
      currency: deal.currency || "INR",
      probability: deal.probability ?? 50,
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split("T")[0] : "",
      notes: deal.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Validation", description: "Deal name is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingDeal) {
        await updateDeal(editingDeal.id, {
          name: form.name.trim(),
          stage: form.stage,
          value: form.value,
          currency: form.currency,
          probability: form.probability,
          expectedCloseDate: form.expectedCloseDate || undefined,
          notes: form.notes || undefined,
        });
        toast({ title: "Success", description: "Deal updated" });
      } else {
        await createDeal({
          accountId,
          name: form.name.trim(),
          stage: form.stage,
          value: form.value,
          currency: form.currency,
          probability: form.probability,
          expectedCloseDate: form.expectedCloseDate || undefined,
          notes: form.notes || undefined,
        });
        toast({ title: "Success", description: "Deal created" });
      }
      setIsDialogOpen(false);
      await loadDeals();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save deal", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (dealId: string) => {
    try {
      await deleteDeal(dealId);
      toast({ title: "Success", description: "Deal deleted" });
      setDeleteDealConfirm(null);
      loadDeals();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete deal", variant: "destructive" });
    }
  };

  const handleMarkAsNa = async (dealId: string) => {
    try {
      await updateDeal(dealId, { stage: "NA" });
      toast({ title: "Success", description: "Deal marked as NA" });
      setMarkAsNaDeal(null);
      loadDeals();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark deal as NA", variant: "destructive" });
    }
  };

  const totalValue = deals
    .filter((d) => d.stage !== "LOST")
    .reduce((sum, d) => sum + d.value, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Pipeline value:</span>
            <span className="font-bold">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="deals-include-na" checked={includeNa} onCheckedChange={(c) => setIncludeNa(!!c)} />
            <Label htmlFor="deals-include-na" className="text-sm cursor-pointer">Include NA</Label>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No deals yet. Add a deal to track opportunities.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Add Deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Expected Close</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id} className={deal.stage === "NA" ? "opacity-75" : ""}>
                  <TableCell className={deal.stage === "NA" ? "font-medium line-through text-muted-foreground" : "font-medium"}>{deal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStageColor(deal.stage)}>
                      {deal.stage.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(deal.value, deal.currency)}</TableCell>
                  <TableCell>{deal.probability != null ? `${deal.probability}%` : "—"}</TableCell>
                  <TableCell>{formatDate(deal.expectedCloseDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(deal)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!isSystemAdmin && deal.stage !== "NA" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Mark as NA"
                          onClick={() => setMarkAsNaDeal(deal)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      {isSystemAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeleteDealConfirm(deal)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "Edit Deal" : "Add Deal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Deal Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Corporate room contract"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm({ ...form, stage: v as DealStage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.value || ""}
                  onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  placeholder="INR"
                />
              </div>
              <div className="space-y-2">
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.probability}
                  onChange={(e) => setForm({ ...form, probability: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expected Close Date</Label>
              <Input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !form.name.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingDeal ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!markAsNaDeal} onOpenChange={(open) => !open && setMarkAsNaDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as NA</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {markAsNaDeal?.name} as NA? This deal will be hidden from active lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMarkAsNaDeal(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => markAsNaDeal && handleMarkAsNa(markAsNaDeal.id)}>Mark as NA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDealConfirm} onOpenChange={(open) => !open && setDeleteDealConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDealConfirm?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDealConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDealConfirm && handleDelete(deleteDealConfirm.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
