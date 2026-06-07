import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/PageHelp";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  listEmailAccounts,
  disconnectEmailAccount,
  syncEmailAccount,
  setPrimaryEmailAccount,
  updateEmailAccount,
  getEmailSettings,
  updateAllowedProviders,
  getWorkspaceStatus,
  type EmailAccount,
  type EmailProvider,
  type GoogleWorkspaceConfigPublic,
} from "@/services/email";
import { useAuth } from "@/context/AuthContext";
import { EmailSetupWizard, sessionKeyToEmailProvider } from "@/components/EmailSetupWizard";
import { EMAIL_SETUP_PROVIDER_KEY } from "@/lib/integrationRegistry";
import {
  Mail,
  Loader2,
  RefreshCw,
  Star,
  AlertCircle,
  ChevronDown,
  Inbox,
  Send,
  UserPlus,
} from "lucide-react";

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

const PROVIDER_LABELS: Record<string, string> = {
  GMAIL: "Gmail",
  OUTLOOK: "Outlook",
  SMTP_IMAP: "SMTP/IMAP",
};

const SETUP_STEPS = [
  {
    title: "Admin prerequisites",
    body: "Configure OAuth apps and environment variables before users connect accounts.",
  },
  {
    title: "Choose a provider",
    body: "Gmail (recommended), Outlook, or SMTP/IMAP for custom mail servers.",
  },
  {
    title: "Connect an account",
    body: "Use OAuth popup for Google/Microsoft, or enter SMTP/IMAP credentials with a connection test.",
  },
  {
    title: "Set primary account",
    body: "The primary account is used when sending email from lead detail pages.",
  },
  {
    title: "Enable lead capture",
    body: "Turn on automatic lead capture to create leads from unknown inbound senders.",
  },
  {
    title: "Use the inbox",
    body: "Open Email Inbox from the sidebar. Sync runs automatically; use Sync for a manual refresh.",
  },
  {
    title: "Send from leads",
    body: "Use the email composer on any lead — it sends from your primary connected account.",
  },
];

export const EmailSettings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceConfigPublic | null>(null);
  const [allowedProviders, setAllowedProviders] = useState<EmailProvider[]>([
    "GMAIL",
    "OUTLOOK",
    "SMTP_IMAP",
  ]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialProvider, setWizardInitialProvider] = useState<EmailProvider | undefined>();
  const [guideOpen, setGuideOpen] = useState(true);
  const [prereqOpen, setPrereqOpen] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const [list, settings, workspace] = await Promise.all([
        listEmailAccounts(),
        getEmailSettings().catch(() => ({ allowedProviders: ["GMAIL", "OUTLOOK", "SMTP_IMAP"] as EmailProvider[] })),
        getWorkspaceStatus().catch(() => null),
      ]);
      setAccounts(list);
      setAllowedProviders(settings.allowedProviders);
      setWorkspaceStatus(workspace);
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

  useEffect(() => {
    const key = sessionStorage.getItem(EMAIL_SETUP_PROVIDER_KEY);
    if (!key) return;
    sessionStorage.removeItem(EMAIL_SETUP_PROVIDER_KEY);
    const provider = sessionKeyToEmailProvider(key);
    if (provider) {
      setWizardInitialProvider(provider);
      setWizardOpen(true);
    }
  }, []);

  const openWizard = (provider?: EmailProvider) => {
    setWizardInitialProvider(provider);
    setWizardOpen(true);
  };

  const toggleAllowedProvider = async (provider: EmailProvider, enabled: boolean) => {
    const next = enabled
      ? [...new Set([...allowedProviders, provider])]
      : allowedProviders.filter((p) => p !== provider);
    if (next.length === 0) {
      toast({ title: "At least one provider must remain enabled", variant: "destructive" });
      return;
    }
    try {
      const updated = await updateAllowedProviders(next);
      setAllowedProviders(updated.allowedProviders);
      toast({ title: "Provider settings updated" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update providers",
        variant: "destructive",
      });
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

  const providerCards = useMemo(
    () =>
      (["GMAIL", "OUTLOOK", "SMTP_IMAP"] as EmailProvider[]).filter((p) =>
        allowedProviders.includes(p)
      ),
    [allowedProviders]
  );

  const workspaceGmailManaged =
    workspaceStatus?.isVerified &&
    workspaceStatus.userInDomain &&
    accounts.some((a) => a.authMode === "WORKSPACE_DWD" || a.provider === "GMAIL");

  const hideGmailOAuthConnect =
    workspaceStatus?.isVerified && Boolean(workspaceStatus.userInDomain);

  const renderAccountRow = (account: EmailAccount) => (
    <Card key={account.id}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">{account.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{PROVIDER_LABELS[account.provider] ?? account.provider}</Badge>
              {account.authMode === "WORKSPACE_DWD" ? (
                <Badge variant="secondary">Managed by Google Workspace</Badge>
              ) : null}
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
                <span className="inline-flex items-center gap-1 text-green-600">● Connected</span>
              )}
            </div>
            {account.syncError ? (
              <div className="text-xs text-destructive">{account.syncError}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button variant="destructive" size="sm" onClick={() => void disconnect(account.id)}>
              Disconnect
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="text-sm">
            <div className="font-medium">Automatic Lead Capture</div>
            <div className="text-xs text-muted-foreground">
              Create leads automatically from unknown senders in this inbox.
            </div>
          </div>
          <Switch
            checked={account.isLeadCaptureEnabled}
            onCheckedChange={(value) => void toggleLeadCapture(account.id, value)}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Email Provider</h1>
          <PageHelp title="Email setup" articleId="email-setup" />
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Gmail, Outlook, or SMTP/IMAP to send and receive email from the CRM
        </p>
      </div>

      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-base">Email setup guide</CardTitle>
                  <CardDescription>Step-by-step instructions for administrators and agents</CardDescription>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`}
                />
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <ol className="space-y-3 list-decimal list-inside text-sm">
                {SETUP_STEPS.map((step, i) => (
                  <li key={step.title} className="leading-relaxed">
                    <span className="font-medium">{step.title}</span>
                    {" — "}
                    {step.body}
                    {i === 0 ? (
                      <Collapsible open={prereqOpen} onOpenChange={setPrereqOpen} className="mt-2 ml-6 list-none">
                        <CollapsibleTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-xs">
                            Show environment variables
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto">
{`GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI
EMAIL_ENCRYPTION_KEY (required for SMTP/IMAP)
GMAIL_PUBSUB_TOPIC, GMAIL_WEBHOOK_SECRET (optional real-time Gmail push)`}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Inbox className="h-3.5 w-3.5" /> Inbox: sidebar → Email Inbox
                </span>
                <span className="inline-flex items-center gap-1">
                  <Send className="h-3.5 w-3.5" /> Send: lead detail → Email
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> Lead capture: toggle per account below
                </span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allowed providers (admin)</CardTitle>
          <CardDescription>Control which email providers users can connect</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          {(["GMAIL", "OUTLOOK", "SMTP_IMAP"] as EmailProvider[]).map((p) => (
            <div key={p} className="flex items-center gap-2">
              <Switch
                checked={allowedProviders.includes(p)}
                onCheckedChange={(v) => void toggleAllowedProvider(p, v)}
              />
              <span className="text-sm">{PROVIDER_LABELS[p]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-3">Connect a provider</h2>
        {workspaceGmailManaged ? (
          <Card className="mb-3">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Your Gmail inbox ({user?.email}) is managed by Google Workspace and syncs automatically on login.
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {providerCards.map((p) => {
            const connected = accounts.some((a) => a.provider === p);
            const isGmailDwdHidden = p === "GMAIL" && hideGmailOAuthConnect;
            if (isGmailDwdHidden) {
              return (
                <Card key={p}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{PROVIDER_LABELS[p]}</span>
                      <Badge variant="default">Workspace</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configured via Integration Hub — no OAuth needed for @{workspaceStatus?.domain} users.
                    </p>
                  </CardContent>
                </Card>
              );
            }
            return (
              <Card key={p}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{PROVIDER_LABELS[p]}</span>
                    <Badge variant={connected ? "default" : "outline"}>
                      {connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={connected ? "outline" : "default"}
                    onClick={() => openWizard(p)}
                  >
                    {connected ? "Add another account" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Connected accounts</h2>
        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Loading accounts...
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-base font-medium">No email account connected</p>
              <p className="mb-5 text-sm text-muted-foreground">
                Connect Gmail, Outlook, or SMTP/IMAP to start sending and receiving email
              </p>
              <Button onClick={() => openWizard()}>Connect email account</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">{accounts.map(renderAccountRow)}</div>
        )}
      </div>

      <EmailSetupWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) setWizardInitialProvider(undefined);
        }}
        initialProvider={wizardInitialProvider}
        onComplete={() => {
          setWizardOpen(false);
          setWizardInitialProvider(undefined);
          void loadAccounts();
        }}
      />
    </div>
  );
};
