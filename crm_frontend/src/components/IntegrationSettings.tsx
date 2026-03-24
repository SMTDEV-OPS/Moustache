import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Phone, MessageCircle, Share2, Upload, Link, Key, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api"; // Or extract the base hostname programmatically

export function IntegrationSettings() {
    const { user } = useAuth();
    const [copied, setCopied] = useState<string | null>(null);

    // Derive URLs for display
    const origin = window.location.origin; // e.g. https://crm.postcard.com 
    // Map this to your actual backend domain in production, for now we will assume the API_BASE_URL is relative or has the domain.
    const backendBase = (API_BASE_URL.startsWith('http') ? API_BASE_URL : origin + '/api');

    const webhooks = {
        ivr: `${backendBase}/public/ivr-webhook`,
        whatsapp: `${backendBase}/public/whatsapp-webhook`,
        social: `${backendBase}/public/social-webhook`,
        website: `${backendBase}/public/website-leads`,
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(null), 2000);
    };

    const [ivrEnabled, setIvrEnabled] = useState(true);
    const [waEnabled, setWaEnabled] = useState(true);
    const [socialEnabled, setSocialEnabled] = useState(true);

    // CSV Upload State
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
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`${API_BASE_URL}/leads/bulk-upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
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
        } catch (err: any) {
            toast.error(err.message || "An error occurred during upload");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Integration & Capture Settings</h2>
                <p className="text-muted-foreground">
                    Configure Webhooks and External APIs for capturing leads into the CRM.
                </p>
            </div>

            <Tabs defaultValue="ivr" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto py-1">
                    <TabsTrigger value="ivr" className="py-2.5">
                        <Phone className="w-4 h-4 mr-2" />
                        IVR / CTI
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="py-2.5">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="social" className="py-2.5">
                        <Share2 className="w-4 h-4 mr-2" />
                        Social Media
                    </TabsTrigger>
                    <TabsTrigger value="website" className="py-2.5">
                        <Link className="w-4 h-4 mr-2" />
                        Website
                    </TabsTrigger>
                    <TabsTrigger value="csv" className="py-2.5">
                        <Upload className="w-4 h-4 mr-2" />
                        Bulk CSV
                    </TabsTrigger>
                </TabsList>

                {/* IVR Panel */}
                <TabsContent value="ivr" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        CloudConnect / Exotel Integration
                                        <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">Active</span>
                                    </CardTitle>
                                    <CardDescription>
                                        Automatically capture leads from incoming calls when the caller presses "1" for sales.
                                    </CardDescription>
                                </div>
                                <Switch checked={ivrEnabled} onCheckedChange={setIvrEnabled} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>IVR Webhook URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={webhooks.ivr}
                                        className="font-mono text-sm bg-muted/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(webhooks.ivr, 'ivr')}
                                    >
                                        {copied === 'ivr' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                                    <AlertCircle className="w-3 h-3" />
                                    Paste this URL into the App / Flow builder in your IVR provider as a standard HTTP POST event.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* WhatsApp Panel */}
                <TabsContent value="whatsapp" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        WATI Webhooks
                                    </CardTitle>
                                    <CardDescription>
                                        Capture new inbound contacts from WhatsApp campaigns or general inquiries automatically.
                                    </CardDescription>
                                </div>
                                <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>WATI Webhook URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={webhooks.whatsapp}
                                        className="font-mono text-sm bg-muted/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(webhooks.whatsapp, 'wa')}
                                    >
                                        {copied === 'wa' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Select 'Incoming Message' as the trigger event in WATI Webhook rules.</p>
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label>WATI API Key (Optional)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        placeholder="Enter API Key to enable outbound messaging"
                                        className="max-w-md"
                                    />
                                    <Button variant="secondary">Save Key</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Only required if you want to send template messages directly from the CRM in the future.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Social Media */}
                <TabsContent value="social" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Facebook / Instagram Lead Ads</CardTitle>
                                    <CardDescription>
                                        Direct integration for Meta Lead Generation forms.
                                    </CardDescription>
                                </div>
                                <Switch checked={socialEnabled} onCheckedChange={setSocialEnabled} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Social Lead Webhook URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={webhooks.social}
                                        className="font-mono text-sm bg-muted/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(webhooks.social, 'social')}
                                    >
                                        {copied === 'social' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Can be used natively via Meta Webhooks or through a Zapier intermediary.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Website Form */}
                <TabsContent value="website" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Brand Website Form Endpoint</CardTitle>
                                    <CardDescription>
                                        The endpoint URL for your custom website forms to push data.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Website Form POST URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={webhooks.website}
                                        className="font-mono text-sm bg-muted/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(webhooks.website, 'web')}
                                    >
                                        {copied === 'web' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Requires a JSON payload. Example payload fields: <code className="bg-muted px-1 py-0.5 rounded text-xs select-all">name, email, phone, checkInDate, checkOutDate, roomsRequested, propertyId</code>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CSV Upload */}
                <TabsContent value="csv" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Bulk Upload Leads (CSV)</CardTitle>
                                <CardDescription>
                                    Manually upload a list of leads. Duplicate records will be automatically skipped based on contact details.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="csv">Upload CSV Data</Label>
                                <Input id="csv" type="file" accept=".csv" onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        setCsvFile(e.target.files[0]);
                                    }
                                }} />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Headers should contain at least: <code>Name</code> and (<code>Phone</code> or <code>Email</code>).
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleCsvUpload} disabled={isUploading || !csvFile}>
                                {isUploading ? "Uploading..." : "Process Upload"}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
