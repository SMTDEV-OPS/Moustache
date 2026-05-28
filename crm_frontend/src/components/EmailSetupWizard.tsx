import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  connectGmailWithPopup,
  connectOutlookWithPopup,
  connectSMTP,
  testSMTPConnection,
  listEmailAccounts,
  getAllowedProviders,
  EmailProvider,
  SMTPConfig,
  TestSMTPResult,
} from "@/services/email";
import {
  Mail,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type WizardStep = "provider" | "connect" | "test" | "success";

export const EmailSetupWizard = ({
  open,
  onOpenChange,
  onComplete,
}: EmailSetupWizardProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>("provider");
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [allowedProviders, setAllowedProviders] = useState<EmailProvider[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

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
  const [testResult, setTestResult] = useState<TestSMTPResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadAllowedProviders();
      setCurrentStep("provider");
      setSelectedProvider(null);
      setConnectionError(null);
      setConnectedEmail(null);
      setTestResult(null);
    }
  }, [open]);

  const loadAllowedProviders = async () => {
    try {
      const { allowedProviders } = await getAllowedProviders();
      setAllowedProviders(allowedProviders);
    } catch (err) {
      // Default to all providers if failed
      setAllowedProviders(["GMAIL", "OUTLOOK", "SMTP_IMAP"]);
    }
  };

  const getStepNumber = (step: WizardStep): number => {
    const steps: WizardStep[] = ["provider", "connect", "test", "success"];
    return steps.indexOf(step) + 1;
  };

  const getProgress = (): number => {
    return (getStepNumber(currentStep) / 4) * 100;
  };

  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider);
    setConnectionError(null);
    if (provider === "SMTP_IMAP") {
      setCurrentStep("connect");
    } else {
      setCurrentStep("connect");
    }
  };

  const handleConnectOAuth = async (provider: "GMAIL" | "OUTLOOK") => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      const connectFn = provider === "GMAIL" ? connectGmailWithPopup : connectOutlookWithPopup;
      const result = await connectFn();

      setConnectedEmail(result.email);
      setCurrentStep("success");
      toast({
        title: "Success",
        description: `${provider} account connected successfully`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      setConnectionError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestSMTP = async () => {
    try {
      setIsTesting(true);
      setConnectionError(null);

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
        setConnectionError(errors.join(", "));
        toast({
          title: "Connection Test Failed",
          description: errors.join(", "),
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Test failed";
      setConnectionError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
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
      setConnectionError(null);

      await connectSMTP(smtpForm);
      setConnectedEmail(smtpForm.email);
      setCurrentStep("success");
      toast({
        title: "Success",
        description: "SMTP/IMAP account connected successfully",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      setConnectionError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
    // Reset state
    setCurrentStep("provider");
    setSelectedProvider(null);
    setConnectionError(null);
    setConnectedEmail(null);
    setTestResult(null);
  };

  const handleSkip = () => {
    onOpenChange(false);
    setCurrentStep("provider");
    setSelectedProvider(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Email Account Setup
          </DialogTitle>
          <DialogDescription className="text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Connect your email account to send and receive emails directly from the CRM
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 py-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {getStepNumber(currentStep)} of 4</span>
            <span>{Math.round(getProgress())}%</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="py-4 min-h-[400px]">
          {currentStep === "provider" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Choose Email Provider</h3>
              <div className="grid gap-4">
                {allowedProviders.includes("GMAIL") && (
                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleProviderSelect("GMAIL")}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-sm bg-red-50 flex items-center justify-center">
                            <Mail className="h-6 w-6 text-red-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Gmail</h4>
                            <p className="text-sm text-muted-foreground">
                              Connect using Google OAuth
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {allowedProviders.includes("OUTLOOK") && (
                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleProviderSelect("OUTLOOK")}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-sm bg-blue-50 flex items-center justify-center">
                            <Mail className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Microsoft Outlook</h4>
                            <p className="text-sm text-muted-foreground">
                              Connect using Microsoft OAuth
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {allowedProviders.includes("SMTP_IMAP") && (
                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleProviderSelect("SMTP_IMAP")}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-sm bg-slate-50 flex items-center justify-center">
                            <Mail className="h-6 w-6 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">SMTP/IMAP</h4>
                            <p className="text-sm text-muted-foreground">
                              Connect using email server settings
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {currentStep === "connect" && selectedProvider && (
            <div className="space-y-4">
              {selectedProvider !== "SMTP_IMAP" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep("provider")}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                  <h3 className="text-lg font-semibold">
                    Connect {selectedProvider === "GMAIL" ? "Gmail" : "Outlook"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Click the button below to open a secure popup window and authorize the connection.
                  </p>
                  {connectionError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{connectionError}</span>
                    </div>
                  )}
                  <Button
                    onClick={() => handleConnectOAuth(selectedProvider)}
                    disabled={isConnecting}
                    className="w-full h-12 bg-[#0F172A] hover:bg-[#1e293b] text-white"
                    size="lg"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Connect {selectedProvider === "GMAIL" ? "Gmail" : "Outlook"}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep("provider")}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                  <h3 className="text-lg font-semibold">Configure SMTP/IMAP</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter your email server settings. We'll test the connection before saving.
                  </p>

                  <Tabs defaultValue="smtp" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="smtp">SMTP (Sending)</TabsTrigger>
                      <TabsTrigger value="imap">IMAP (Receiving)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="smtp" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={smtpForm.email}
                          onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value })}
                          placeholder="your.email@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">SMTP Host *</Label>
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
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-port">SMTP Port *</Label>
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
                          <Label htmlFor="smtp-secure" className="cursor-pointer">
                            Use SSL/TLS
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-username">SMTP Username *</Label>
                        <Input
                          id="smtp-username"
                          value={smtpForm.smtp.username}
                          onChange={(e) =>
                            setSmtpForm({
                              ...smtpForm,
                              smtp: { ...smtpForm.smtp, username: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password">SMTP Password *</Label>
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
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="imap" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="imap-host">IMAP Host *</Label>
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
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="imap-port">IMAP Port *</Label>
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
                          <Label htmlFor="imap-secure" className="cursor-pointer">
                            Use SSL/TLS
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imap-username">IMAP Username *</Label>
                        <Input
                          id="imap-username"
                          value={smtpForm.imap.username}
                          onChange={(e) =>
                            setSmtpForm({
                              ...smtpForm,
                              imap: { ...smtpForm.imap, username: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imap-password">IMAP Password *</Label>
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
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  {testResult && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {testResult.smtp.success ? (
                          <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm">
                          SMTP: {testResult.smtp.success ? "Connected" : testResult.smtp.error}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {testResult.imap.success ? (
                          <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm">
                          IMAP: {testResult.imap.success ? "Connected" : testResult.imap.error}
                        </span>
                      </div>
                    </div>
                  )}

                  {connectionError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{connectionError}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleTestSMTP}
                      disabled={isTesting}
                      variant="outline"
                      className="flex-1"
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
                      className="flex-1 bg-[#0F172A] hover:bg-[#1e293b] text-white"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === "success" && (
            <div className="space-y-4 text-center py-8">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-[#059669]/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-[#059669]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Email Account Connected!</h3>
              <p className="text-muted-foreground">
                Your email account <strong>{connectedEmail}</strong> has been successfully connected.
              </p>
              <p className="text-sm text-muted-foreground">
                You can now send and receive emails directly from the CRM.
              </p>
              <Button
                onClick={handleComplete}
                className="bg-[#0F172A] hover:bg-[#1e293b] text-white"
                size="lg"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          {currentStep !== "provider" && currentStep !== "success" && (
            <Button variant="outline" onClick={() => setCurrentStep("provider")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Provider
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

