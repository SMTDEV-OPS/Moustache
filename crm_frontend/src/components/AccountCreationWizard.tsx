import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { listConglomerates, Conglomerate } from "@/services/conglomerates";
import { Account, createAccount, updateAccount, listAccounts } from "@/services/accounts";
import { listProperties, Property } from "@/services/properties";
import { AddAccountStepIndicator, ADD_ACCOUNT_STEP_SUBTITLES } from "@/components/accounts/AddAccountStepIndicator";
import { emptyAccountForm, AccountFormData, defaultContractingPeriod } from "@/components/accounts/accountFormTypes";
import {
  AccountStepOrganization,
  AccountStepClassification,
  AccountStepHierarchy,
  AccountStepLocation,
  AccountStepCompliance,
  AccountReviewSummary,
  StepContext,
} from "@/components/accounts/AccountCreationSteps";

export interface AccountWizardSuccessPayload {
  account: Account;
  isNew: boolean;
  openContacts?: boolean;
}

interface AccountCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
  onSuccess: () => void;
  /** Called after create (not edit) with the new account for navigation */
  onCreated?: (payload: AccountWizardSuccessPayload) => void;
}

const TOTAL_STEPS = 5;

export const AccountCreationWizard = ({
  isOpen,
  onClose,
  editingAccount,
  onSuccess,
  onCreated,
}: AccountCreationWizardProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [conglomerates, setConglomerates] = useState<Conglomerate[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AccountFormData>({ ...emptyAccountForm });
  const [showPostCreate, setShowPostCreate] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

  const set = (patch: Partial<AccountFormData>) => setFormData((prev) => ({ ...prev, ...patch }));
  const isEdit = !!editingAccount;

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setShowPostCreate(false);
      setCreatedAccount(null);
      return;
    }
    if (editingAccount) {
      setFormData({
        ...emptyAccountForm,
        ...(editingAccount as AccountFormData),
        conglomerateId: (editingAccount as Account & { conglomerateId?: string }).conglomerateId || null,
        parentAccountId: editingAccount.parentAccountId || null,
        primaryAccountManager: editingAccount.primaryAccountManager || { userId: "", name: "", city: "" },
        secondaryAccountManagers: editingAccount.secondaryAccountManagers || [],
        propertyIds: editingAccount.propertyIds || [],
      });
    } else {
      setFormData({ ...emptyAccountForm });
    }
  }, [editingAccount, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([listConglomerates(), listAccounts(), listProperties()])
      .then(([congs, accs, props]) => {
        setConglomerates(congs);
        setAvailableAccounts(accs);
        setProperties(props);
      })
      .catch((err) => console.error("Failed to fetch reference data:", err));
  }, [isOpen]);

  const addSam = () =>
    set({ secondaryAccountManagers: [...formData.secondaryAccountManagers, { userId: "", name: "", city: "" }] });

  const removeSam = (i: number) =>
    set({ secondaryAccountManagers: formData.secondaryAccountManagers.filter((_, idx) => idx !== i) });

  const updateSam = (i: number, patch: Record<string, string>) =>
    set({
      secondaryAccountManagers: formData.secondaryAccountManagers.map((m, idx) =>
        idx === i ? { ...m, ...patch } : m
      ),
    });

  const toggleContractingType = (type: string, checked: boolean) => {
    let types = [...formData.contractingTypes];
    if (checked) {
      types.push({ type, ...defaultContractingPeriod() });
    } else {
      types = types.filter((t) => t.type !== type);
    }
    set({ contractingTypes: types });
  };

  const updateContractingType = (type: string, patch: Record<string, number>) =>
    set({
      contractingTypes: formData.contractingTypes.map((t) => (t.type === type ? { ...t, ...patch } : t)),
    });

  const stepCtx: StepContext = {
    formData,
    set,
    conglomerates,
    availableAccounts,
    properties,
    editingAccount,
    addSam,
    removeSam,
    updateSam,
    toggleContractingType,
    updateContractingType,
  };

  const validateStep = (s: number): boolean => {
    if (s === 1 && !formData.name.trim()) {
      toast({ title: "Required", description: "Account name is required", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const buildPayload = () => {
    const sanitized: Record<string, unknown> = { ...formData };
    const legacyMap: Record<string, string> = {
      CORPORATE: "CORPORATE",
      TRAVEL_AGENT: "TRAVEL_AGENT",
      EVENT_PLANNER: "EVENT_PLANNER",
      PCO: "EVENT_PLANNER",
      AIRLINE: "AIRLINES",
      GOVERNMENT: "GOVERNMENT",
      EMBASSY_CONSULATE: "GOVERNMENT",
      PSU: "GOVERNMENT",
      CUSTOM: "OTHER",
    };
    sanitized.type = legacyMap[formData.organizationType] || "OTHER";
    if (!sanitized.conglomerateId) delete sanitized.conglomerateId;
    if (!sanitized.parentAccountId) delete sanitized.parentAccountId;
    const pam = formData.primaryAccountManager;
    if (!pam?.name && !pam?.userId) {
      delete sanitized.primaryAccountManager;
    } else if (pam.userId === "") {
      sanitized.primaryAccountManager = { name: pam.name, city: pam.city };
    }
    if (formData.secondaryAccountManagers?.length) {
      sanitized.secondaryAccountManagers = formData.secondaryAccountManagers
        .filter((m) => m.name?.trim() || m.userId?.trim())
        .map((m) => {
          const s = { ...m };
          if (s.userId === "") delete (s as { userId?: string }).userId;
          return s;
        });
    }
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] === "") delete sanitized[key];
    }
    return sanitized;
  };

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    try {
      setIsSubmitting(true);
      const sanitized = buildPayload();
      if (editingAccount) {
        await updateAccount(editingAccount.id, sanitized);
        toast({ title: "Success", description: "Account updated" });
        onSuccess();
        onClose();
      } else {
        const created = await createAccount(sanitized as Parameters<typeof createAccount>[0]);
        toast({ title: "Success", description: "Account created" });
        onSuccess();
        setCreatedAccount(created);
        setShowPostCreate(true);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save account",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostCreateView = () => {
    if (createdAccount) {
      onCreated?.({ account: createdAccount, isNew: true, openContacts: false });
    }
    onClose();
  };

  const handlePostCreateAddContact = () => {
    if (createdAccount) {
      onCreated?.({ account: createdAccount, isNew: true, openContacts: true });
    }
    onClose();
  };

  if (showPostCreate && createdAccount) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>
              {createdAccount.name} is ready. What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handlePostCreateAddContact}>Add contact</Button>
            <Button variant="outline" onClick={handlePostCreateView}>
              View account profile
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Back to directory
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[min(90vh,720px)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? "Edit account" : "New account"}
          </DialogTitle>
          <DialogDescription className="text-sm">{ADD_ACCOUNT_STEP_SUBTITLES[step]}</DialogDescription>
          {!isEdit && (
            <div className="pt-3">
              <AddAccountStepIndicator currentStep={step} />
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isEdit ? (
            <div className="space-y-4">
              <AccountStepOrganization {...stepCtx} />
              <AccountStepClassification {...stepCtx} />
              <AccountStepHierarchy {...stepCtx} />
              <AccountStepLocation {...stepCtx} />
              <AccountStepCompliance ctx={stepCtx} />
            </div>
          ) : (
            <>
              {step === 1 && <AccountStepOrganization {...stepCtx} />}
              {step === 2 && <AccountStepClassification {...stepCtx} />}
              {step === 3 && <AccountStepHierarchy {...stepCtx} />}
              {step === 4 && <AccountStepLocation {...stepCtx} />}
              {step === 5 && (
                <div className="space-y-4">
                  <AccountReviewSummary formData={formData} availableAccounts={availableAccounts} />
                  <AccountStepCompliance ctx={stepCtx} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 flex justify-between gap-2 px-6 py-4 border-t border-border bg-surface">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {!isEdit && step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                Back
              </Button>
            )}
            {isEdit ? (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            ) : step < TOTAL_STEPS ? (
              <Button type="button" onClick={handleContinue} disabled={isSubmitting}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create account"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
