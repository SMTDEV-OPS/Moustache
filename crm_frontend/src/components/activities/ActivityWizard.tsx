import { useEffect, useState } from "react";
import { addMinutes, format, setHours, setMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormWizardShell } from "@/components/forms/FormWizardShell";
import { WizardStepIndicator } from "@/components/forms/WizardStepIndicator";
import { DatePicker } from "@/components/ui/date-picker";
import { getAccountContacts, type Contact } from "@/services/contacts";
import {
  createContactActivity,
  type ContactActivityType,
} from "@/services/contactActivities";

const STEPS = [
  { num: 1, label: "When" },
  { num: 2, label: "Details" },
  { num: 3, label: "Review" },
] as const;

const STEP_SUBTITLES: Record<number, string> = {
  1: "Who is this activity with, and when?",
  2: "Purpose, discussion, and follow-up",
  3: "Review and save",
};

const ACTIVITY_TYPES: { value: ContactActivityType; label: string }[] = [
  { value: "SALES_CALL", label: "Sales call" },
  { value: "TELECALL", label: "Tele call" },
  { value: "EMAIL", label: "Email" },
  { value: "CLIENT_SITE_INSPECTION", label: "Client site inspection" },
];

export interface ActivityFormState {
  contactId: string;
  activityType: ContactActivityType;
  category: string;
  startsAtDate: string;
  startsAtTime: string;
  endsAtTime: string;
  reminderMinutesBefore: number;
  attendeeEmails: string;
  purpose: string;
  discussion: string;
  output: string;
  followUp: string;
}

const emptyForm: ActivityFormState = {
  contactId: "",
  activityType: "SALES_CALL",
  category: "Follow-up",
  startsAtDate: format(new Date(), "yyyy-MM-dd"),
  startsAtTime: "10:00",
  endsAtTime: "10:30",
  reminderMinutesBefore: 15,
  attendeeEmails: "",
  purpose: "",
  discussion: "",
  output: "",
  followUp: "",
};

function formFromInitialDate(initialDate?: Date): ActivityFormState {
  const base = initialDate ?? new Date();
  const start = setMinutes(setHours(base, base.getHours() || 10), base.getMinutes() || 0);
  const end = addMinutes(start, 30);
  return {
    ...emptyForm,
    startsAtDate: format(start, "yyyy-MM-dd"),
    startsAtTime: format(start, "HH:mm"),
    endsAtTime: format(end, "HH:mm"),
  };
}

interface ActivityWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onSuccess: () => void;
  /** Pre-fill schedule when opened from calendar */
  initialDate?: Date;
}

export function ActivityWizard({
  open,
  onOpenChange,
  accountId,
  onSuccess,
  initialDate,
}: ActivityWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ActivityFormState>({ ...emptyForm });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (patch: Partial<ActivityFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm(formFromInitialDate());
      return;
    }
    setForm(formFromInitialDate(initialDate));
    getAccountContacts(accountId).then(setContacts).catch(() => setContacts([]));
  }, [open, accountId, initialDate?.getTime()]);

  const validateStep = (s: number): boolean => {
    if (s === 1 && !form.contactId) {
      toast({ title: "Required", description: "Select a contact", variant: "destructive" });
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
      const startsAtIso = form.startsAtDate
        ? new Date(`${form.startsAtDate}T${form.startsAtTime}`).toISOString()
        : undefined;
      const endsAtIso = form.startsAtDate
        ? new Date(`${form.startsAtDate}T${form.endsAtTime}`).toISOString()
        : undefined;
      const attendeeEmails = form.attendeeEmails
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      await createContactActivity({
        accountId,
        contactId: form.contactId,
        activityType: form.activityType,
        category: form.category || undefined,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        reminderMinutesBefore: form.reminderMinutesBefore || undefined,
        attendees: attendeeEmails.map((email) => ({
          kind: "EXTERNAL",
          name: email.split("@")[0],
          email,
          responseStatus: "NEEDS_ACTION",
        })),
        purpose: form.purpose || undefined,
        discussion: form.discussion || undefined,
        output: form.output || undefined,
        followUp: form.followUp || undefined,
      });
      toast({ title: "Activity added" });
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add activity",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactName = contacts.find((c) => c.id === form.contactId)?.name;
  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === form.activityType)?.label;

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
        {step < 3 ? (
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
              "Save activity"
            )}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <FormWizardShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add activity"
      subtitle={STEP_SUBTITLES[step]}
      stepIndicator={<WizardStepIndicator steps={STEPS} currentStep={step} />}
      footer={footer}
      maxWidth="2xl"
    >
      {step === 1 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>
              Contact <span className="text-destructive">*</span>
            </Label>
            <Select value={form.contactId} onValueChange={(v) => set({ contactId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.isKeyPersonnel ? " (Key)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Activity type</Label>
              <Select
                value={form.activityType}
                onValueChange={(v) => set({ activityType: v as ContactActivityType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
                placeholder="Follow-up, Meeting…"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker
                value={form.startsAtDate ? new Date(form.startsAtDate) : undefined}
                onChange={(d) => set({ startsAtDate: d ? format(d, "yyyy-MM-dd") : "" })}
                placeholder="Pick date"
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={form.startsAtTime} onChange={(e) => set({ startsAtTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={form.endsAtTime} onChange={(e) => set({ endsAtTime: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reminder (minutes before)</Label>
            <Input
              type="number"
              min={0}
              max={10080}
              value={form.reminderMinutesBefore}
              onChange={(e) => set({ reminderMinutesBefore: Number(e.target.value || 0) })}
            />
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Invite attendees</Label>
            <Textarea
              value={form.attendeeEmails}
              onChange={(e) => set({ attendeeEmails: e.target.value })}
              placeholder={"example@company.com\nother@company.com"}
              rows={3}
            />
            <p className="text-xs text-text-muted">
              Comma or new line separated. Invites use your connected email account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <Input value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Discussion</Label>
            <Textarea value={form.discussion} onChange={(e) => set({ discussion: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Output</Label>
            <Input value={form.output} onChange={(e) => set({ output: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Follow-up</Label>
            <Input value={form.followUp} onChange={(e) => set({ followUp: e.target.value })} />
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="rounded-lg border border-border bg-hover/40 p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="text-text-muted">Contact</span>
              <p className="font-medium text-text">{contactName || "—"}</p>
            </div>
            <div>
              <span className="text-text-muted">Type</span>
              <p className="font-medium text-text">{typeLabel}</p>
            </div>
            <div>
              <span className="text-text-muted">When</span>
              <p className="font-medium text-text">
                {form.startsAtDate} {form.startsAtTime} – {form.endsAtTime}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Category</span>
              <p className="font-medium text-text">{form.category || "—"}</p>
            </div>
          </div>
          {form.purpose && (
            <div>
              <span className="text-text-muted">Purpose</span>
              <p className="font-medium text-text">{form.purpose}</p>
            </div>
          )}
        </div>
      )}
    </FormWizardShell>
  );
}
