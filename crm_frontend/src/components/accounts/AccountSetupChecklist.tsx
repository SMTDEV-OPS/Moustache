import { useEffect, useState } from "react";
import { Check, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Account } from "@/services/accounts";
import { getAccountContacts } from "@/services/contacts";
import { listLeads } from "@/services/leads";

const DISMISS_KEY = "account-setup-checklist-dismissed";

interface AccountSetupChecklistProps {
  account: Account;
  onAddContact?: () => void;
  onSetFollowUp?: () => void;
  onGoToContacts?: () => void;
  onGoToLeads?: () => void;
}

export function AccountSetupChecklist({
  account,
  onAddContact,
  onSetFollowUp,
  onGoToContacts,
  onGoToLeads,
}: AccountSetupChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setDismissed(ids.includes(account.id));
    } catch {
      setDismissed(false);
    }
  }, [account.id]);

  useEffect(() => {
    void (async () => {
      try {
        const contacts = await getAccountContacts(account.id);
        setContactCount(contacts?.length ?? 0);
        const allLeads = await listLeads();
        setLeadCount(allLeads.filter((l) => l.accountId === account.id).length);
      } catch {
        setContactCount(0);
        setLeadCount(0);
      }
    })();
  }, [account.id]);

  const dismiss = () => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(account.id)) {
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids, account.id]));
      }
      setDismissed(true);
    } catch {
      setDismissed(true);
    }
  };

  const hasFollowUp = !!account.followUpDate;
  const items = [
    { id: "contact", label: "Add at least one contact", done: contactCount > 0, action: onAddContact },
    { id: "followup", label: "Set a follow-up date", done: hasFollowUp, action: onSetFollowUp },
    { id: "lead", label: "Create a lead from a contact", done: leadCount > 0, action: onGoToLeads },
  ];
  const allDone = items.every((i) => i.done);

  if (dismissed || allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary-light/30 shadow-sm mb-6">
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base text-text">Getting started</CardTitle>
          <CardDescription className="text-sm">
            Complete these steps to activate this account in your pipeline.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 min-w-0">
              {item.done ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-text-muted shrink-0" />
              )}
              <span className={cn("text-sm", item.done ? "text-text-muted line-through" : "text-text")}>
                {item.label}
              </span>
            </div>
            {!item.done && item.action && (
              <Button variant="outline" size="sm" className="shrink-0 h-8" onClick={item.action}>
                Do this
              </Button>
            )}
          </div>
        ))}
        {contactCount > 0 && onGoToContacts && (
          <Button variant="link" className="h-auto p-0 text-primary" onClick={onGoToContacts}>
            View {contactCount} contact{contactCount !== 1 ? "s" : ""}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
