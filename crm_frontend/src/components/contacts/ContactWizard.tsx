import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FormWizardShell } from "@/components/forms/FormWizardShell";
import { WizardStepIndicator } from "@/components/forms/WizardStepIndicator";
import type { Contact } from "@/services/contacts";
import { createContact, updateContact } from "@/services/contacts";
import { cleanContactPayload, emptyContactForm } from "./contactFormTypes";
import {
  ContactStepIdentity,
  ContactStepReach,
  ContactStepRole,
  ContactStepLoyalty,
  ContactReviewSummary,
} from "./ContactWizardSteps";

const STEPS = [
  { num: 1, label: "Identity" },
  { num: 2, label: "Reach" },
  { num: 3, label: "Role" },
  { num: 4, label: "Loyalty" },
  { num: 5, label: "Review" },
] as const;

const STEP_SUBTITLES: Record<number, string> = {
  1: "Who is this contact?",
  2: "How can you reach them?",
  3: "Their role and relationship",
  4: "Loyalty program and important dates",
  5: "Review and save",
};

const TOTAL_STEPS = 5;

interface ContactWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  editingContact?: Contact | null;
  onSuccess: () => void;
}

export function ContactWizard({
  open,
  onOpenChange,
  accountId,
  editingContact,
  onSuccess,
}: ContactWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Contact>>({ ...emptyContactForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (patch: Partial<Contact>) => setFormData((prev) => ({ ...prev, ...patch }));
  const clearError = (key: string) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  useEffect(() => {
    if (!open) {
      setStep(1);
      setErrors({});
      return;
    }
    if (editingContact) {
      setFormData(editingContact);
    } else {
      setFormData({ ...emptyContactForm });
    }
  }, [open, editingContact]);

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 1) {
      if (!formData.name?.trim()) newErrors.name = "Full name is required";
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email address";
      }
    }
    if (s === 3) {
      if (formData.isKeyPersonnel && !formData.keyPersonnelRole) {
        newErrors.keyPersonnelRole = "Role is required for key personnel";
      }
    }
    if (s === 4) {
      if (formData.isLoyaltyMember && !formData.loyaltyNumber?.trim()) {
        newErrors.loyaltyNumber = "Membership number is required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep(step)) {
      toast({ title: "Required", description: "Please complete required fields", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(3) || !validateStep(4)) {
      setStep(1);
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = cleanContactPayload(formData);
      if (editingContact) {
        await updateContact(editingContact.id, payload);
        toast({ title: "Success", description: "Contact updated" });
      } else {
        await createContact(accountId, payload as Omit<Contact, "id">);
        toast({ title: "Success", description: "Contact created" });
      }
      onOpenChange(false);
      onSuccess();
    } catch {
      toast({ title: "Error", description: "Failed to save contact", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepCtx = { formData, set, errors, clearError };

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
        Cancel
      </Button>
      <div className="flex gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
            Back
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={handleContinue} disabled={isSubmitting}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editingContact ? "Save changes" : "Create contact"}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <FormWizardShell
      open={open}
      onOpenChange={onOpenChange}
      title={editingContact ? "Edit contact" : "Add new contact"}
      subtitle={STEP_SUBTITLES[step]}
      stepIndicator={<WizardStepIndicator steps={STEPS} currentStep={step} />}
      footer={footer}
    >
      {step === 1 && <ContactStepIdentity {...stepCtx} />}
      {step === 2 && <ContactStepReach {...stepCtx} />}
      {step === 3 && <ContactStepRole {...stepCtx} />}
      {step === 4 && <ContactStepLoyalty {...stepCtx} />}
      {step === 5 && <ContactReviewSummary formData={formData} />}
    </FormWizardShell>
  );
}
