import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormWizardShell } from "@/components/forms/FormWizardShell";
import { WizardStepIndicator } from "@/components/forms/WizardStepIndicator";
import { RateGrid } from "@/components/RateGrid";
import {
  createEmptyRateGridValue,
  normalizeRateGridValue,
  type RateGridValue,
} from "@/models/contract";
import {
  createContract,
  updateContractRateGrid,
  type Contract,
} from "@/services/contracts";
import type { Contact } from "@/services/contacts";
import type { Property } from "@/services/properties";
import {
  buildPostcardPropertyOptions,
  propertyMapFromOptions,
} from "@/constants/postcardProperties";
import {
  ContractCreateForm,
  ContractStepBasics,
  ContractStepParties,
  ContractCreateReview,
  ContractOverviewStep,
} from "./ContractWizardSteps";

const CREATE_STEPS = [
  { num: 1, label: "Basics" },
  { num: 2, label: "Parties" },
  { num: 3, label: "Rates" },
  { num: 4, label: "Review" },
] as const;

const CREATE_SUBTITLES: Record<number, string> = {
  1: "Company name and sales channel",
  2: "Contact, email, and Postcard properties",
  3: "Configure B2B and B2C rate grid",
  4: "Review and create contract",
};

const EDIT_STEPS = [
  { num: 1, label: "Details" },
  { num: 2, label: "Rates" },
  { num: 3, label: "Save" },
] as const;

const EDIT_SUBTITLES: Record<number, string> = {
  1: "Contract summary",
  2: "Update B2B and B2C rates",
  3: "Review and save changes",
};

const emptyForm: ContractCreateForm = {
  companyName: "",
  channel: "B2B",
  propertyIds: [],
  contactId: "",
  contactEmail: "",
};

interface ContractWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  contacts: Contact[];
  apiProperties: Property[];
  mode?: "create" | "edit";
  contract?: Contract | null;
  contactName?: string;
  onComplete: () => void;
}

export function ContractWizard({
  open,
  onOpenChange,
  accountId,
  contacts,
  apiProperties,
  mode = "create",
  contract,
  contactName,
  onComplete,
}: ContractWizardProps) {
  const { toast } = useToast();
  const isEdit = mode === "edit";
  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS;
  const totalSteps = steps.length;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ContractCreateForm>({ ...emptyForm });
  const [rateGridValue, setRateGridValue] = useState<RateGridValue>(() => createEmptyRateGridValue());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const propertyOptions = useMemo(
    () => buildPostcardPropertyOptions(apiProperties),
    [apiProperties]
  );
  const propertyMap = useMemo(
    () => propertyMapFromOptions(propertyOptions, apiProperties),
    [propertyOptions, apiProperties]
  );

  const set = (patch: Partial<ContractCreateForm>) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!open) {
      setStep(1);
      if (!isEdit) {
        setForm({ ...emptyForm });
        setRateGridValue(createEmptyRateGridValue());
      }
      return;
    }
    if (isEdit && contract) {
      setForm({
        companyName: contract.companyName,
        channel: contract.channel,
        propertyIds: contract.propertyIds ?? [],
        contactId: contract.contactId ?? "",
        contactEmail: contract.contactEmail ?? "",
      });
      setRateGridValue(
        contract.rateGrid
          ? normalizeRateGridValue(contract.rateGrid as RateGridValue)
          : createEmptyRateGridValue()
      );
    }
  }, [open, isEdit, contract?.id]);

  const validateStep = (s: number): boolean => {
    if (!isEdit && s === 1 && !form.companyName.trim()) {
      toast({ title: "Required", description: "Company name is required", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const handleSubmit = async () => {
    if (!isEdit && !validateStep(1)) {
      setStep(1);
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && contract) {
        await updateContractRateGrid(contract.id, rateGridValue);
        toast({ title: "Saved", description: "Contract and rates updated" });
      } else {
        const created = await createContract({
          accountId,
          companyName: form.companyName.trim(),
          channel: form.channel,
          propertyIds: form.propertyIds,
          contactId: form.contactId || undefined,
          contactEmail: form.contactEmail || undefined,
        });
        await updateContractRateGrid(created.id, rateGridValue);
        toast({ title: "Success", description: "Contract created with rates" });
      }
      onOpenChange(false);
      onComplete();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save contract",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitle = isEdit ? EDIT_SUBTITLES[step] : CREATE_SUBTITLES[step];

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
        {step < totalSteps ? (
          <Button type="button" onClick={handleContinue} disabled={isSubmitting}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : isEdit ? (
              "Save contract"
            ) : (
              "Create contract"
            )}
          </Button>
        )}
      </div>
    </>
  );

  const ratesStep = (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <RateGrid value={rateGridValue} onChange={setRateGridValue} embedded />
    </div>
  );

  return (
    <FormWizardShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit contract" : "New contract"}
      subtitle={subtitle}
      stepIndicator={<WizardStepIndicator steps={steps} currentStep={step} />}
      footer={footer}
      maxWidth="3xl"
      maxHeight="min(90vh,800px)"
    >
      {!isEdit && step === 1 && <ContractStepBasics form={form} set={set} />}
      {!isEdit && step === 2 && (
        <ContractStepParties
          form={form}
          set={set}
          contacts={contacts}
          propertyOptions={propertyOptions}
        />
      )}
      {isEdit && step === 1 && contract && (
        <ContractOverviewStep
          contract={contract}
          propertyMap={propertyMap}
          contactName={contactName}
        />
      )}
      {((!isEdit && step === 3) || (isEdit && step === 2)) && ratesStep}
      {!isEdit && step === 4 && (
        <div className="space-y-4">
          <ContractCreateReview form={form} propertyMap={propertyMap} contacts={contacts} />
          <p className="text-sm text-text-muted px-1">
            Rates are configured for both B2B and B2C. Submitting will create the contract and save the rate grid.
          </p>
        </div>
      )}
      {isEdit && step === 3 && contract && (
        <div className="space-y-4">
          <ContractOverviewStep contract={contract} propertyMap={propertyMap} contactName={contactName} />
          <p className="text-sm text-text-muted">Click save to update the rate grid on this contract.</p>
        </div>
      )}
    </FormWizardShell>
  );
}
