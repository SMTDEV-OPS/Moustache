import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { getAccountContacts, updateContact, type Contact } from "@/services/contacts";
import { updateAccount } from "@/services/accounts";

export interface SetFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName?: string;
  /** When set, skip contact picker (e.g. from contact card) */
  preselectedContactId?: string;
  canEdit?: boolean;
  /** Also sync account follow-up for list column display */
  syncAccountFollowUp?: boolean;
  onSaved?: () => void;
  onAddContact?: () => void;
}

export function SetFollowUpDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  preselectedContactId,
  canEdit = true,
  syncAccountFollowUp = false,
  onSaved,
  onAddContact,
}: SetFollowUpDialogProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactId, setContactId] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | null | undefined>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingContacts(true);
    getAccountContacts(accountId)
      .then((list) => {
        const active = list.filter((c) => (c as Contact & { status?: string }).status !== "NA");
        setContacts(active);
        if (preselectedContactId && active.some((c) => c.id === preselectedContactId)) {
          setContactId(preselectedContactId);
          const c = active.find((x) => x.id === preselectedContactId);
          if (c?.followUpDate) setFollowUpDate(new Date(c.followUpDate));
          else setFollowUpDate(null);
          setFollowUpNote(c?.followUpNote ?? "");
        } else if (active.length === 1) {
          setContactId(active[0].id);
          if (active[0].followUpDate) setFollowUpDate(new Date(active[0].followUpDate));
          else setFollowUpDate(null);
          setFollowUpNote(active[0].followUpNote ?? "");
        } else {
          setContactId("");
          setFollowUpDate(null);
          setFollowUpNote("");
        }
      })
      .catch(() => {
        setContacts([]);
        toast({
          title: "Error",
          description: "Failed to load contacts",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingContacts(false));
  }, [open, accountId, preselectedContactId]);

  useEffect(() => {
    if (!contactId || !open) return;
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setFollowUpDate(c.followUpDate ? new Date(c.followUpDate) : null);
    setFollowUpNote(c.followUpNote ?? "");
  }, [contactId, contacts, open]);

  const selectedContact = contacts.find((c) => c.id === contactId);
  const showContactPicker = contacts.length > 1 && !preselectedContactId;

  const handleSave = async () => {
    if (!canEdit) return;
    if (contacts.length === 0) {
      toast({ title: "No contacts", description: "Add a contact to this account first.", variant: "destructive" });
      return;
    }
    if (!contactId) {
      toast({ title: "Required", description: "Select a contact for this follow-up.", variant: "destructive" });
      return;
    }
    const name = selectedContact?.name ?? "Contact";
    try {
      setIsSaving(true);
      const dateStr = followUpDate ? format(followUpDate, "yyyy-MM-dd") : null;
      await updateContact(contactId, {
        followUpDate: dateStr,
        followUpNote: followUpNote.trim(),
      });
      if (syncAccountFollowUp) {
        const accountNote = followUpNote.trim()
          ? `Contact: ${name} — ${followUpNote.trim()}`
          : `Contact: ${name}`;
        await updateAccount(accountId, {
          followUpDate: dateStr,
          followUpNote: accountNote,
        });
      }
      toast({ title: "Saved", description: `Follow-up set for ${name}` });
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save follow-up",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Set follow-up</DialogTitle>
          <DialogDescription>
            {accountName ? `${accountName} — ` : ""}
            Schedule a follow-up for a contact on this account.
          </DialogDescription>
        </DialogHeader>

        {loadingContacts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-muted">No contacts on this account yet. Add a contact before setting a follow-up.</p>
            {onAddContact && (
              <Button type="button" variant="outline" size="sm" onClick={() => { onOpenChange(false); onAddContact(); }}>
                Add contact
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {showContactPicker ? (
              <div className="space-y-1.5">
                <Label>
                  Follow-up for <span className="text-destructive">*</span>
                </Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.designation ? ` · ${c.designation}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selectedContact ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Contact</p>
                <p className="text-sm font-medium mt-0.5">{selectedContact.name}</p>
                {selectedContact.designation && (
                  <p className="text-xs text-text-muted">{selectedContact.designation}</p>
                )}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Follow-up date</Label>
              <DatePicker
                value={followUpDate}
                onChange={(d) => setFollowUpDate(d ?? null)}
                placeholder="Pick a date"
                className="w-full"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Note</Label>
              <Input
                placeholder="Note…"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          {contacts.length > 0 && canEdit && (
            <Button type="button" onClick={handleSave} disabled={isSaving || !contactId}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
