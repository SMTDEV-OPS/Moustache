import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  listEmailAccounts,
  syncEmailAccount,
  disconnectEmailAccount,
  setPrimaryEmailAccount,
  EmailAccount,
} from "@/services/email";
import {
  Mail,
  RefreshCw,
  Trash2,
  Star,
  StarOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Activity,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const EmailHealthDashboard = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  useEffect(() => {
    void loadAccounts();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      void loadAccounts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const list = await listEmailAccounts();
      setAccounts(list);
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

  const handleSync = async (accountId: string) => {
    try {
      setSyncingAccountId(accountId);
      const result = await syncEmailAccount(accountId);
      
      if (result.errorCode) {
        const errorMessages: Record<string, string> = {
          TOKEN_EXPIRED: "Token expired. Please reconnect.",
          INVALID_CREDENTIALS: "Invalid credentials.",
          CONNECTION_FAILED: "Connection failed.",
          RATE_LIMIT_EXCEEDED: "Rate limit exceeded.",
          INSUFFICIENT_PERMISSIONS: "Insufficient permissions.",
          ACCOUNT_NOT_FOUND: "Account not found.",
        };
        
        toast({
          title: "Sync Error",
          description: errorMessages[result.errorCode] || result.errorCode,
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
      toast({
        title: "Error",
        description: error?.errorCode || (err instanceof Error ? err.message : "Failed to sync"),
        variant: "destructive",
      });
    } finally {
      setSyncingAccountId(null);
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
        description: err instanceof Error ? err.message : "Failed to disconnect",
        variant: "destructive",
      });
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
        description: err instanceof Error ? err.message : "Failed to set primary",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (account: EmailAccount) => {
    if (!account.isActive) {
      return <Badge variant="secondary" className="rounded-sm">Inactive</Badge>;
    }
    if (account.syncStatus === "SYNCING") {
      return (
        <Badge variant="default" className="bg-blue-500 rounded-sm flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing
        </Badge>
      );
    }
    if (account.syncStatus === "ERROR") {
      return <Badge variant="destructive" className="rounded-sm">Error</Badge>;
    }
    return <Badge variant="default" className="bg-[#059669] rounded-sm">Active</Badge>;
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

  const getHealthScore = (account: EmailAccount): number => {
    if (!account.isActive) return 0;
    if (account.syncStatus === "ERROR") return 30;
    if (account.syncStatus === "SYNCING") return 70;
    if (!account.lastSyncAt) return 50;
    
    const lastSync = new Date(account.lastSyncAt);
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync < 1) return 100;
    if (hoursSinceSync < 6) return 90;
    if (hoursSinceSync < 24) return 80;
    if (hoursSinceSync < 48) return 60;
    return 40;
  };

  const overallHealth = accounts.length > 0
    ? Math.round(accounts.reduce((sum, acc) => sum + getHealthScore(acc), 0) / accounts.length)
    : 0;

  if (isLoading && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading email health dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Email Health Dashboard
        </h1>
        <p className="text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
          Monitor and manage your email account connections
        </p>
      </div>

      {/* Overall Health Score */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#059669]" />
            Overall Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{overallHealth}%</span>
              <Badge
                variant={overallHealth >= 80 ? "default" : overallHealth >= 60 ? "secondary" : "destructive"}
                className={overallHealth >= 80 ? "bg-[#059669]" : ""}
              >
                {overallHealth >= 80 ? "Healthy" : overallHealth >= 60 ? "Fair" : "Poor"}
              </Badge>
            </div>
            <Progress value={overallHealth} className="h-3" />
            <p className="text-sm text-muted-foreground">
              Based on {accounts.length} connected account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
          <CardDescription>Detailed status for each connected email account</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-base font-medium text-foreground mb-2">No email accounts connected</p>
              <p className="text-sm text-muted-foreground">
                Connect an email account to see health metrics
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const healthScore = getHealthScore(account);
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getProviderIcon(account.provider)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{account.email}</span>
                              {account.isPrimary && (
                                <Badge variant="outline" className="text-xs bg-[#059669]/10 text-[#059669] border-[#059669]/20 rounded-sm">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{account.provider}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(account)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={healthScore} className="h-2 w-20" />
                          <span className="text-sm font-medium">{healthScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {account.lastSyncAt ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(account.lastSyncAt).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!account.isPrimary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(account.id)}
                              title="Set as primary"
                              className="h-8 w-8 p-0"
                            >
                              <StarOff className="h-4 w-4" />
                            </Button>
                          )}
                          {account.isPrimary && (
                            <Button variant="ghost" size="sm" disabled title="Primary account" className="h-8 w-8 p-0">
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(account.id)}
                            disabled={syncingAccountId === account.id}
                            title="Sync account"
                            className="h-8 w-8 p-0"
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
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            title="Disconnect account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {accounts.some((acc) => acc.syncStatus === "ERROR" || acc.syncError) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts
                .filter((acc) => acc.syncStatus === "ERROR" || acc.syncError)
                .map((account) => (
                  <div key={account.id} className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{account.email}</div>
                        {account.syncError && (
                          <div className="text-sm text-muted-foreground mt-1">{account.syncError}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(account.id)}
                        disabled={syncingAccountId === account.id}
                        className="h-8"
                      >
                        {syncingAccountId === account.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

