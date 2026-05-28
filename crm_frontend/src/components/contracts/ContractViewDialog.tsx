import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RateGrid } from "@/components/RateGrid";
import {
  createEmptyRateGridValue,
  normalizeRateGridValue,
  type RateGridValue,
} from "@/models/contract";
import type { Contract } from "@/services/contracts";
import { ContractOverviewStep } from "./ContractWizardSteps";

function statusBadgeClass(status: Contract["status"]) {
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

interface ContractViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  propertyMap: Map<string, string>;
  contactName?: string;
  onEdit?: (contract: Contract) => void;
}

export function ContractViewDialog({
  open,
  onOpenChange,
  contract,
  propertyMap,
  contactName,
  onEdit,
}: ContractViewDialogProps) {
  const rateGridValue = useMemo((): RateGridValue => {
    if (!contract?.rateGrid) return createEmptyRateGridValue();
    return normalizeRateGridValue(contract.rateGrid);
  }, [contract?.id, contract?.rateGrid]);

  const hasRates =
    contract?.rateGrid &&
    (rateGridValue.b2b.rows.some((r) => r.single || r.double || r.triple || r.rn) ||
      rateGridValue.b2c.rows.some((r) => r.single || r.double || r.triple || r.rn));

  if (!contract) return null;

  const submittedOn = contract.createdAt
    ? new Date(contract.createdAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[min(90vh,820px)] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <DialogTitle className="text-xl font-semibold pr-4">
                {contract.companyName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Submitted {submittedOn}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Badge variant="outline">{contract.channel}</Badge>
              <Badge variant="outline" className={statusBadgeClass(contract.status)}>
                {contract.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Contract details
              </h3>
              <ContractOverviewStep
                contract={contract}
                propertyMap={propertyMap}
                contactName={contactName}
              />
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Rate grid
              </h3>
              {hasRates ? (
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                  <RateGrid
                    value={rateGridValue}
                    onChange={() => {}}
                    embedded
                    readOnly
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
                  No rate grid configured for this contract.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEdit(contract);
              }}
            >
              Edit contract
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
