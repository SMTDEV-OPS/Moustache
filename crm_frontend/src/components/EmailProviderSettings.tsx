import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getEmailSettings,
  updateAllowedProviders,
  EmailProvider,
} from "@/services/email";
import { Loader2, Save, Mail } from "lucide-react";

export const EmailProviderSettings = () => {
  const { toast } = useToast();
  const [allowedProviders, setAllowedProviders] = useState<EmailProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await getEmailSettings();
      setAllowedProviders(settings.allowedProviders);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load email provider settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProvider = (provider: EmailProvider) => {
    setAllowedProviders((prev) => {
      if (prev.includes(provider)) {
        return prev.filter((p) => p !== provider);
      } else {
        return [...prev, provider];
      }
    });
  };

  const handleSave = async () => {
    if (allowedProviders.length === 0) {
      toast({
        title: "Error",
        description: "At least one email provider must be enabled",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await updateAllowedProviders(allowedProviders);
      toast({
        title: "Success",
        description: "Email provider settings updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update email provider settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const providers: Array<{ value: EmailProvider; label: string; description: string }> = [
    {
      value: "GMAIL",
      label: "Gmail",
      description: "Allow users to connect Gmail accounts via OAuth",
    },
    {
      value: "OUTLOOK",
      label: "Microsoft Outlook",
      description: "Allow users to connect Outlook/Office 365 accounts via OAuth",
    },
    {
      value: "SMTP_IMAP",
      label: "SMTP/IMAP",
      description: "Allow users to connect generic email accounts via SMTP/IMAP",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Email Provider Settings</h2>
        <p className="text-muted-foreground">
          Configure which email providers users can connect to their accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Email Providers</CardTitle>
          <CardDescription>
            Select which email providers should be available for users to connect. Users will only
            see options for enabled providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading settings...
            </div>
          ) : (
            <div className="space-y-4">
              {providers.map((provider) => (
                <div
                  key={provider.value}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={provider.value}
                    checked={allowedProviders.includes(provider.value)}
                    onCheckedChange={() => handleToggleProvider(provider.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={provider.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {provider.label}
                      </div>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                  </div>
                </div>
              ))}

              {allowedProviders.length === 0 && (
                <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    Warning: No providers are enabled. Users will not be able to connect any email accounts.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving || allowedProviders.length === 0}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

