import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  listEmailAccounts,
  connectGmailWithPopup,
  connectOutlookWithPopup,
  connectSMTP,
  testSMTPConnection,
  disconnectEmailAccount,
  syncEmailAccount,
  setPrimaryEmailAccount,
  getAllowedProviders,
  EmailAccount,
  EmailProvider,
  SMTPConfig,
  TestSMTPResult,
} from "@/services/email";
import {
  Mail,
  MailCheck,
  RefreshCw,
  Trash2,
  Star,
  StarOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { EmailSetupWizard } from "./EmailSetupWizard";
import { updateEmailAccount } from "@/services/email";

export const EmailSettings = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSMTPDialogOpen, setIsSMTPDialogOpen] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [allowedProviders, setAllowedProviders] = useState<EmailProvider[]>([]);
  const [syncStatus, setSyncStatus] = useState<Record<string, { status: "idle" | "syncing" | "error"; lastSync?: Date }>>({});
  const [testResult, setTestResult] = useState<TestSMTPResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  // SMTP form state
  const [smtpForm, setSmtpForm] = useState<SMTPConfig>({
    email: "",
    smtp: {
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
    },
    imap: {
      host: "",
      port: 993,
      secure: true,
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    void loadAccounts();
    void loadAllowedProviders();

    // Poll for sync status updates
    const interval = setInterval(() => {
      void loadAccounts();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const list = await listEmailAccounts();
      setAccounts(list);

      // Update sync status
      const statusMap: Record<string, { status: "idle" | "syncing" | "error"; lastSync?: Date }> = {};
      list.forEach((acc) => {
        statusMap[acc.id] = {
          status: acc.syncStatus === "SYNCING" ? "syncing" : acc.syncStatus === "ERROR" ? "error" : "idle",
          lastSync: acc.lastSyncAt ? new Date(acc.lastSyncAt) : undefined,
        };
      });
      setSyncStatus(statusMap);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load email accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllowedProviders = async () => {
    try {
      const { allowedProviders } = await getAllowedProviders();
      setAllowedProviders(allowedProviders);
    } catch (err) {
      // If failed to load, default to all providers
      setAllowedProviders(["GMAIL", "OUTLOOK", "SMTP_IMAP"]);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsConnecting(true);
      const result = await connectGmailWithPopup();

      toast({
        title: "Success",
        description: `Gmail account ${result.email} connected successfully`,
      });
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to connect Gmail account",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectOutlook = async () => {
    try {
      setIsConnecting(true);
      const result = await connectOutlookWithPopup();

      toast({
        title: "Success",
        description: `Outlook account ${result.email} connected successfully`,
      });
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to connect Outlook account",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestSMTP = async () => {
    try {
      setIsTesting(true);
      const result = await testSMTPConnection({
        smtp: smtpForm.smtp,
        imap: smtpForm.imap,
      });
      setTestResult(result);

      if (result.smtp.success && result.imap.success) {
        toast({
          title: "Connection Test Successful",
          description: "Both SMTP and IMAP connections are working",
        });
      } else {
        const errors: string[] = [];
        if (!result.smtp.success) {
          errors.push(`SMTP: ${result.smtp.error || "Connection failed"}`);
        }
        if (!result.imap.success) {
          errors.push(`IMAP: ${result.imap.error || "Connection failed"}`);
        }
        toast({
          title: "Connection Test Failed",
          description: errors.join(", "),
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectSMTP = async () => {
    if (!testResult || !testResult.smtp.success || !testResult.imap.success) {
      toast({
        title: "Error",
        description: "Please test the connection first and ensure it's successful",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      await connectSMTP(smtpForm);
      toast({
        title: "Success",
        description: "SMTP/IMAP account connected successfully",
      });
      setIsSMTPDialogOpen(false);
      setSmtpForm({
        email: "",
        smtp: {
          host: "",
          port: 587,
          secure: false,
          username: "",
          password: "",
        },
        imap: {
          host: "",
          port: 993,
          secure: true,
          username: "",
          password: "",
        },
      });
      setTestResult(null);
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to connect SMTP account",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this email account?")) return;

    try {
      await disconnectEmailAccount(accountId);
      toast({
        title: "Success",
        description: "Email account disconnected",
      });
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect account",
        variant: "destructive",
      });
    }
  };

  const handleSync = async (accountId: string) => {
    try {
      setSyncingAccountId(accountId);
      const result = await syncEmailAccount(accountId);

      if (result.errorCode) {
        const errorMessages: Record<string, string> = {
          TOKEN_EXPIRED: "Your email account token has expired. Please reconnect your account.",
          INVALID_CREDENTIALS: "Invalid email credentials. Please check your account settings.",
          CONNECTION_FAILED: "Could not connect to email server. Please check your internet connection.",
          RATE_LIMIT_EXCEEDED: "Email sync rate limit exceeded. Please try again later.",
          INSUFFICIENT_PERMISSIONS: "Insufficient permissions. Please reconnect your account with proper permissions.",
          ACCOUNT_NOT_FOUND: "Email account not found or inactive.",
        };

        toast({
          title: "Sync Error",
          description: errorMessages[result.errorCode] || `Failed to sync: ${result.errorCode}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Synced ${result.syncedCount} emails`,
        });
      }
      void loadAccounts();
    } catch (err) {
      const error = err as any;
      const errorCode = error?.errorCode;
      const errorMessages: Record<string, string> = {
        TOKEN_EXPIRED: "Your email account token has expired. Please reconnect your account.",
        INVALID_CREDENTIALS: "Invalid email credentials. Please check your account settings.",
        CONNECTION_FAILED: "Could not connect to email server. Please check your internet connection.",
        RATE_LIMIT_EXCEEDED: "Email sync rate limit exceeded. Please try again later.",
        INSUFFICIENT_PERMISSIONS: "Insufficient permissions. Please reconnect your account with proper permissions.",
        ACCOUNT_NOT_FOUND: "Email account not found or inactive.",
      };

      toast({
        title: "Error",
        description: errorCode && errorMessages[errorCode]
          ? errorMessages[errorCode]
          : err instanceof Error ? err.message : "Failed to sync emails",
        variant: "destructive",
      });
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      await setPrimaryEmailAccount(accountId);
      toast({
        title: "Success",
        description: "Primary account updated",
      });
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set primary account",
        variant: "destructive",
      });
    }
  };

  const handleToggleLeadCapture = async (accountId: string, isLeadCaptureEnabled: boolean) => {
    try {
      await updateEmailAccount(accountId, { isLeadCaptureEnabled });
      toast({
        title: "Success",
        description: `Lead capture ${isLeadCaptureEnabled ? 'enabled' : 'disabled'} for this account`,
      });
      void loadAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update lead capture settings",
        variant: "destructive",
      });
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "GMAIL":
        return <Mail className="h-5 w-5 text-red-500" />;
      case "OUTLOOK":
        return <Mail className="h-5 w-5 text-blue-500" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (account: EmailAccount) => {
    if (!account.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (account.syncStatus === "SYNCING") {
      return <Badge variant="default" className="bg-blue-500">Syncing...</Badge>;
    }
    if (account.syncStatus === "ERROR") {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Email Settings</h1>
        <p className="text-muted-foreground">
          Connect and manage your email accounts for sending and receiving emails
        </p>
      </div>

      {/* Connect New Account */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Email Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Connect an inbox to sync emails directly into the CRM. You can configure shared company inboxes to automatically capture new leads.
          </p>
          <Button
            onClick={() => setIsSetupWizardOpen(true)}
            className="h-10 px-4 font-medium bg-[#0F172A] hover:bg-[#1e293b] text-white"
          >
            <Mail className="h-4 w-4 mr-2" />
            Connect New Inbox
          </Button>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Connected Accounts</h2>
          {accounts.length > 0 && (
            <span className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading accounts...</p>
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-base font-medium text-foreground mb-2">No email accounts connected</p>
              <p className="text-sm text-muted-foreground">
                Connect an email account to start sending and receiving emails
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <Card key={account.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 flex-shrink-0">{getProviderIcon(account.provider)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-foreground">{account.email}</span>
                          {account.isPrimary && (
                            <Badge variant="outline" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                              Primary
                            </Badge>
                          )}
                          {getStatusBadge(account)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Provider:</span> {account.provider}
                          </span>
                          {account.lastSyncAt && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span>
                                Last sync: {new Date(account.lastSyncAt).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Lead Capture Toggle */}
                        <div className="mt-4 flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md ${account.isLeadCaptureEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              <MailCheck className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <Label htmlFor={`capture-${account.id}`} className="text-sm font-medium">Automatic Lead Capture</Label>
                              <p className="text-xs text-muted-foreground">
                                Extract leads automatically from unknown senders in this inbox.
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={`capture-${account.id}`}
                            checked={account.isLeadCaptureEnabled}
                            onCheckedChange={(checked) => handleToggleLeadCapture(account.id, checked)}
                          />
                        </div>

                        {account.syncError && (
                          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{account.syncError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!account.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(account.id)}
                          title="Set as primary"
                          className="h-9 w-9 p-0"
                        >
                          <StarOff className="h-4 w-4" />
                        </Button>
                      )}
                      {account.isPrimary && (
                        <Button variant="ghost" size="sm" disabled title="Primary account" className="h-9 w-9 p-0">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(account.id)}
                        disabled={syncingAccountId === account.id}
                        title="Sync account"
                        className="h-9 w-9 p-0"
                      >
                        {syncingAccountId === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        className="text-destructive hover:text-destructive h-9 w-9 p-0"
                        title="Disconnect account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* SMTP/IMAP Connection Dialog */}
      <Dialog open={isSMTPDialogOpen} onOpenChange={setIsSMTPDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Connect SMTP/IMAP Account</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your email server settings to connect a generic email account
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="smtp" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="smtp">SMTP (Sending)</TabsTrigger>
              <TabsTrigger value="imap">IMAP (Receiving)</TabsTrigger>
            </TabsList>

            <TabsContent value="smtp" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={smtpForm.email}
                  onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value })}
                  placeholder="your.email@example.com"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-host" className="text-sm font-medium">SMTP Host *</Label>
                <Input
                  id="smtp-host"
                  value={smtpForm.smtp.host}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      smtp: { ...smtpForm.smtp, host: e.target.value },
                    })
                  }
                  placeholder="smtp.example.com"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-port" className="text-sm font-medium">SMTP Port *</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={smtpForm.smtp.port}
                    onChange={(e) =>
                      setSmtpForm({
                        ...smtpForm,
                        smtp: { ...smtpForm.smtp, port: parseInt(e.target.value) || 587 },
                      })
                    }
                    className="h-10"
                  />
                </div>
                <div className="flex items-end space-x-2 pb-2">
                  <Switch
                    id="smtp-secure"
                    checked={smtpForm.smtp.secure}
                    onCheckedChange={(checked) =>
                      setSmtpForm({
                        ...smtpForm,
                        smtp: { ...smtpForm.smtp, secure: checked },
                      })
                    }
                  />
                  <Label htmlFor="smtp-secure" className="text-sm font-medium cursor-pointer">Use SSL/TLS</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-username" className="text-sm font-medium">SMTP Username *</Label>
                <Input
                  id="smtp-username"
                  value={smtpForm.smtp.username}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      smtp: { ...smtpForm.smtp, username: e.target.value },
                    })
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password" className="text-sm font-medium">SMTP Password *</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={smtpForm.smtp.password}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      smtp: { ...smtpForm.smtp, password: e.target.value },
                    })
                  }
                  className="h-10"
                />
              </div>
            </TabsContent>

            <TabsContent value="imap" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="imap-host" className="text-sm font-medium">IMAP Host *</Label>
                <Input
                  id="imap-host"
                  value={smtpForm.imap.host}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      imap: { ...smtpForm.imap, host: e.target.value },
                    })
                  }
                  placeholder="imap.example.com"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imap-port" className="text-sm font-medium">IMAP Port *</Label>
                  <Input
                    id="imap-port"
                    type="number"
                    value={smtpForm.imap.port}
                    onChange={(e) =>
                      setSmtpForm({
                        ...smtpForm,
                        imap: { ...smtpForm.imap, port: parseInt(e.target.value) || 993 },
                      })
                    }
                    className="h-10"
                  />
                </div>
                <div className="flex items-end space-x-2 pb-2">
                  <Switch
                    id="imap-secure"
                    checked={smtpForm.imap.secure}
                    onCheckedChange={(checked) =>
                      setSmtpForm({
                        ...smtpForm,
                        imap: { ...smtpForm.imap, secure: checked },
                      })
                    }
                  />
                  <Label htmlFor="imap-secure" className="text-sm font-medium cursor-pointer">Use SSL/TLS</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-username" className="text-sm font-medium">IMAP Username *</Label>
                <Input
                  id="imap-username"
                  value={smtpForm.imap.username}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      imap: { ...smtpForm.imap, username: e.target.value },
                    })
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-password" className="text-sm font-medium">IMAP Password *</Label>
                <Input
                  id="imap-password"
                  type="password"
                  value={smtpForm.imap.password}
                  onChange={(e) =>
                    setSmtpForm({
                      ...smtpForm,
                      imap: { ...smtpForm.imap, password: e.target.value },
                    })
                  }
                  className="h-10"
                />
              </div>
            </TabsContent>
          </Tabs>

          {testResult && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-sm mt-4">
              <div className="flex items-center gap-2 text-sm">
                {testResult.smtp.success ? (
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span>
                  SMTP: {testResult.smtp.success ? "Connected" : testResult.smtp.error || "Failed"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {testResult.imap.success ? (
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span>
                  IMAP: {testResult.imap.success ? "Connected" : testResult.imap.error || "Failed"}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Button variant="outline" onClick={() => {
              setIsSMTPDialogOpen(false);
              setTestResult(null);
            }} className="h-10">
              Cancel
            </Button>
            <Button
              onClick={handleTestSMTP}
              disabled={isTesting}
              variant="outline"
              className="h-10"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              onClick={handleConnectSMTP}
              disabled={isConnecting || !testResult || !testResult.smtp.success || !testResult.imap.success}
              className="h-10 font-medium bg-[#0F172A] hover:bg-[#1e293b] text-white"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Account"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmailSetupWizard
        open={isSetupWizardOpen}
        onOpenChange={setIsSetupWizardOpen}
        onComplete={() => {
          setIsSetupWizardOpen(false);
          void loadAccounts();
        }}
      />
    </div>
  );
};

