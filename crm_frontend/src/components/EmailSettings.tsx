import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  listEmailAccounts,
  connectGmailWithPopup,
  disconnectEmailAccount,
  syncEmailAccount,
  setPrimaryEmailAccount,
  updateEmailAccount,
  type EmailAccount,
} from "@/services/email";
import { Mail, Loader2, RefreshCw, Star, AlertCircle } from "lucide-react";

function getRelativeTime(input?: string) {
  if (!input) return "Never";
  const ts = new Date(input).getTime();
  if (Number.isNaN(ts)) return "Never";
  const mins = Math.floor((Date.now() - ts) / (1000 * 60));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export const EmailSettings = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [inlineConnectError, setInlineConnectError] = useState<string | null>(null);

  const gmailAccounts = useMemo(
    () => accounts.filter((account) => account.provider === "GMAIL"),
    [accounts]
  );

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const list = await listEmailAccounts();
      setAccounts(list);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const connectGmail = async () => {
    try {
      setConnecting(true);
      setInlineConnectError(null);
      await connectGmailWithPopup();
      toast({
        title: "Success",
        description: "Gmail connected successfully. Your emails will start syncing shortly.",
      });
      await loadAccounts();
    } catch (err) {
      setInlineConnectError(err instanceof Error ? err.message : "Failed to connect Gmail");
    } finally {
      setConnecting(false);
    }
  };

  const syncAccount = async (id: string) => {
    try {
      setSyncingId(id);
      await syncEmailAccount(id);
      await loadAccounts();
    } catch (err) {
      toast({
        title: "Sync error",
        description: err instanceof Error ? err.message : "Unable to sync account",
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const setPrimary = async (id: string) => {
    try {
      await setPrimaryEmailAccount(id);
      await loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to set primary account",
        variant: "destructive",
      });
    }
  };

  const toggleLeadCapture = async (id: string, value: boolean) => {
    try {
      await updateEmailAccount(id, { isLeadCaptureEnabled: value });
      await loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to update lead capture",
        variant: "destructive",
      });
    }
  };

  const disconnect = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure? This will stop syncing emails from this account."
    );
    if (!confirmed) return;
    try {
      await disconnectEmailAccount(id);
      await loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to disconnect account",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage the Gmail accounts connected to your CRM
          </p>
        </div>
        <div className="space-y-2">
          <Button onClick={() => void connectGmail()} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect Gmail
          </Button>
          {inlineConnectError ? (
            <Alert variant="destructive" className="max-w-sm">
              <AlertDescription>{inlineConnectError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            Loading accounts...
          </CardContent>
        </Card>
      ) : gmailAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 text-base font-medium">No email account connected</p>
            <p className="mb-5 text-sm text-muted-foreground">
              Connect your Gmail to start sending and receiving emails directly from the CRM
            </p>
            <Button onClick={() => void connectGmail()} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect Gmail
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gmailAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-red-500" />
                      <span className="truncate font-medium">{account.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Gmail</Badge>
                      {account.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last synced: {getRelativeTime(account.lastSyncAt)}
                    </div>
                    <div className="text-sm">
                      {account.syncStatus === "SYNCING" ? (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                        </span>
                      ) : account.syncStatus === "ERROR" ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3" /> Sync Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600">● Active</span>
                      )}
                    </div>
                    {account.syncError ? (
                      <div className="text-xs text-destructive">{account.syncError}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.isPrimary ? (
                      <Button variant="outline" size="sm" onClick={() => void setPrimary(account.id)}>
                        <Star className="mr-1 h-4 w-4" />
                        Set Primary
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void syncAccount(account.id)}
                      disabled={syncingId === account.id}
                    >
                      {syncingId === account.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-4 w-4" />
                      )}
                      Sync
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void disconnect(account.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">Automatic Lead Capture</div>
                    <div className="text-xs text-muted-foreground">
                      Extract leads automatically from unknown senders in this inbox.
                    </div>
                  </div>
                  <Switch
                    checked={account.isLeadCaptureEnabled}
                    onCheckedChange={(value) => void toggleLeadCapture(account.id, value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

