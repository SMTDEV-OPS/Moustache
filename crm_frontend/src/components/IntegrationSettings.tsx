import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Info } from "lucide-react";
import { API_BASE_URL, getAuthToken } from "@/services/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface IntegrationSettingsProps {
  onNavigate?: (view: string) => void;
}

export function IntegrationSettings({ onNavigate }: IntegrationSettingsProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/leads/bulk-upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload CSV");
      }

      toast.success(`Successfully added ${data.successCount} leads!`);
      if (data.failureCount > 0) {
        toast.warning(`Failed to process ${data.failureCount} rows. Likely duplicates.`);
      }

      setCsvFile(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Lead Import</h2>
        <p className="text-muted-foreground">
          Bulk upload leads from a CSV file. For webhooks and API integrations, use Integration Hub.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          WATI, Exotel, and other webhook URLs are configured in{" "}
          {onNavigate ? (
            <button
              type="button"
              className="underline font-medium"
              onClick={() => onNavigate("setup/integrations")}
            >
              Integration Hub
            </button>
          ) : (
            "Integration Hub"
          )}
          . Connect a provider there to get your webhook URL and field mappings.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Leads (CSV)
          </CardTitle>
          <CardDescription>
            Manually upload a list of leads. Duplicate records are skipped based on contact details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv">Upload CSV Data</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setCsvFile(e.target.files[0]);
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Headers should contain at least: <code>Name</code> and (<code>Phone</code> or{" "}
              <code>Email</code>).
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => void handleCsvUpload()} disabled={isUploading || !csvFile}>
            {isUploading ? "Uploading..." : "Process Upload"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
