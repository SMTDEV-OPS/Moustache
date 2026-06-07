import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plug, Trash2, Eye, EyeOff, Copy, Check, ChevronDown } from "lucide-react";
import {
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  verifyIntegration,
  listMappings,
  createMapping,
  deleteMapping,
  type IntegrationConfig,
} from "@/services/adminIntegrations";
import { listAdminFields } from "@/services/adminFields";
import { listEmailAccounts, disconnectEmailAccount, getWorkspaceConfig, getWorkspaceStatus, saveWorkspaceConfig, verifyWorkspaceConfig, disconnectWorkspaceConfig, type EmailAccount, type GoogleWorkspaceConfigPublic } from "@/services/email";
import { listProperties, type Property } from "@/services/properties";
import { useAuth } from "@/context/AuthContext";
import {
  buildProviderCardStates,
  EMAIL_SETUP_PROVIDER_KEY,
  emailProviderSessionKey,
  type CardDisplayStatus,
  type ProviderCardState,
} from "@/lib/integrationRegistry";
import { PageHeader, Button, Input, Select } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

const STATUS_STYLES: Record<CardDisplayStatus["kind"], { bg: string; text: string; label: string }> = {
  connected: { bg: "#d1fae5", text: "#065f46", label: "Connected" },
  error: { bg: "#fef2f2", text: "#ef4444", label: "Error" },
  partial: { bg: "#fffbeb", text: "#f59e0b", label: "Partial" },
  disconnected: { bg: "var(--border-light)", text: "var(--text-muted)", label: "Not connected" },
  coming_soon: { bg: "var(--border-light)", text: "var(--text-muted)", label: "Coming soon" },
};

function statusLabel(status: CardDisplayStatus): string {
  if (status.kind === "partial" && status.detail) return status.detail;
  if (status.kind === "connected" && status.detail) return status.detail;
  return STATUS_STYLES[status.kind].label;
}

interface IntegrationHubProps {
  onNavigate?: (view: string) => void;
}

export function IntegrationHub({ onNavigate }: IntegrationHubProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const canManageEmail = can("email.manage");
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [workspaceGmail, setWorkspaceGmail] = useState<GoogleWorkspaceConfigPublic | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [configModal, setConfigModal] = useState<IntegrationConfig | null>(null);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [gmailSaving, setGmailSaving] = useState(false);
  const [gmailVerifying, setGmailVerifying] = useState(false);
  const [gmailGuideOpen, setGmailGuideOpen] = useState(false);
  const [gmailDomain, setGmailDomain] = useState("");
  const [gmailSaEmail, setGmailSaEmail] = useState("");
  const [gmailPrivateKey, setGmailPrivateKey] = useState("");
  const [gmailTestEmail, setGmailTestEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);
  const [newMapping, setNewMapping] = useState({ source: "", target: "" });

  const activeCrmFields = useMemo(
    () => fields.filter((f) => f.is_active),
    [fields]
  );

  const cardStates = useMemo(
    () => buildProviderCardStates(integrations, emailAccounts, properties, workspaceGmail),
    [integrations, emailAccounts, properties, workspaceGmail]
  );

  const loadWorkspaceConfig = useCallback(async () => {
    try {
      const config = canManageEmail ? await getWorkspaceConfig() : await getWorkspaceStatus();
      setWorkspaceGmail(config);
    } catch {
      setWorkspaceGmail(null);
    }
  }, [canManageEmail]);

  const openGmailConfig = () => {
    setGmailDomain(workspaceGmail?.domain || "");
    setGmailSaEmail(workspaceGmail?.serviceAccountClientEmail || "");
    setGmailPrivateKey("");
    setGmailTestEmail(workspaceGmail?.delegatedAdminEmail || "");
    setGmailGuideOpen(false);
    setGmailModalOpen(true);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [list, accounts, props, fList] = await Promise.all([
        listIntegrations(),
        listEmailAccounts().catch(() => []),
        listProperties().catch(() => []),
        listAdminFields("lead").catch(() => []),
      ]);
      setIntegrations(list);
      setEmailAccounts(accounts);
      setProperties(props);
      setFields(fList);
      await loadWorkspaceConfig();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, loadWorkspaceConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConfig = async (int: IntegrationConfig) => {
    setConfigModal(int);
    setApiKey("");
    setWebhookCopied(false);
    const maps = await listMappings(int._id).catch(() => []);
    setMappings(maps);
    setNewMapping({ source: "", target: "" });
  };

  const handleConnectApiKey = async (configProvider: string) => {
    try {
      const created = await createIntegration({
        provider: configProvider,
        config_json: {},
      });
      setIntegrations((prev) => [
        ...prev.filter((i) => i.provider !== configProvider),
        created,
      ]);
      await openConfig(created);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    if (!configModal) return;
    try {
      if (apiKey) {
        await updateIntegration(configModal._id, {
          config_json: { api_key: apiKey, apiKey },
        });
      }
      const { verified } = await verifyIntegration(configModal._id);
      toast({
        title: verified ? "Connected" : "Saved — verification failed",
        description: verified
          ? `${configModal.provider} is connected.`
          : "Check your API key and try again.",
        variant: verified ? "default" : "destructive",
      });
      setConfigModal(null);
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDisconnectIntegration = async (int: IntegrationConfig) => {
    if (!confirm(`Disconnect ${int.provider}?`)) return;
    try {
      await deleteIntegration(int._id);
      toast({ title: "Disconnected" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDisconnectEmail = async (accountId: string, email: string) => {
    if (!confirm(`Disconnect ${email}?`)) return;
    try {
      await disconnectEmailAccount(accountId);
      toast({ title: "Email disconnected" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSaveGmailWorkspace = async () => {
    try {
      setGmailSaving(true);
      const saved = await saveWorkspaceConfig({
        enabled: true,
        domain: gmailDomain,
        serviceAccountClientEmail: gmailSaEmail,
        serviceAccountPrivateKey: gmailPrivateKey || undefined,
        delegatedAdminEmail: gmailTestEmail || undefined,
      });
      setWorkspaceGmail(saved);
      toast({ title: "Gmail Workspace settings saved" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGmailSaving(false);
    }
  };

  const handleVerifyGmailWorkspace = async () => {
    try {
      setGmailVerifying(true);
      const saved = await saveWorkspaceConfig({
        enabled: true,
        domain: gmailDomain,
        serviceAccountClientEmail: gmailSaEmail,
        serviceAccountPrivateKey: gmailPrivateKey || undefined,
        delegatedAdminEmail: gmailTestEmail || undefined,
      });
      setWorkspaceGmail(saved);
      const { config } = await verifyWorkspaceConfig(gmailTestEmail || undefined);
      setWorkspaceGmail(config);
      toast({ title: "Gmail Workspace connected", description: `Verified for ${config.domain}` });
      setGmailModalOpen(false);
      void load();
    } catch (e) {
      toast({ title: "Verification failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGmailVerifying(false);
    }
  };

  const handleDisconnectGmailWorkspace = async () => {
    if (!confirm("Disconnect Google Workspace Gmail integration? Users will no longer get auto-inbox on login.")) return;
    try {
      await disconnectWorkspaceConfig();
      setWorkspaceGmail(null);
      toast({ title: "Gmail Workspace disconnected" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const goToEmailSetup = (providerId: "Gmail" | "Outlook") => {
    sessionStorage.setItem(EMAIL_SETUP_PROVIDER_KEY, emailProviderSessionKey(providerId));
    if (onNavigate) onNavigate("setup/email-provider");
    else navigate("/");
  };

  const goToPropertyManagement = () => {
    navigate("/properties");
  };

  const copyWebhookUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    setWebhookCopied(true);
    toast({ title: "Webhook URL copied" });
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleAddMapping = async () => {
    if (!configModal || !newMapping.source || !newMapping.target) return;
    try {
      await createMapping(configModal._id, {
        source_field: newMapping.source,
        target_field_slug: newMapping.target,
      });
      const maps = await listMappings(configModal._id);
      setMappings(maps);
      setNewMapping({ source: "", target: "" });
      toast({ title: "Mapping added" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!configModal) return;
    try {
      await deleteMapping(configModal._id, mappingId);
      setMappings((prev) => prev.filter((m) => m._id !== mappingId));
      toast({ title: "Mapping removed" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const renderCardActions = (card: ProviderCardState) => {
    const { provider, status, integration, emailAccounts: accounts } = card;

    if (provider.connectionType === "coming_soon") {
      return (
        <Button variant="secondary" size="sm" disabled title="Airpay integration is not available yet">
          Connect
        </Button>
      );
    }

    if (provider.connectionType === "oauth") {
      if (provider.id === "Gmail") {
        const workspaceConnected = workspaceGmail?.isVerified;
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canManageEmail ? (
                workspaceConnected ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={openGmailConfig}>
                      Manage
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void handleDisconnectGmailWorkspace()}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={openGmailConfig}>
                    Configure Workspace
                  </Button>
                )
              ) : (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {workspaceConnected
                    ? "Managed by Google Workspace — inbox syncs automatically on login"
                    : "Ask an admin to configure Gmail in Integration Hub"}
                </span>
              )}
            </div>
            {workspaceConnected && workspaceGmail ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Domain: {workspaceGmail.domain} · SA: {workspaceGmail.serviceAccountClientEmail}
              </div>
            ) : null}
          </div>
        );
      }

      const connected = status.kind === "connected";
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!connected ? (
              <Button variant="primary" size="sm" onClick={() => goToEmailSetup(provider.id as "Gmail" | "Outlook")}>
                Connect
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={() => goToEmailSetup(provider.id as "Gmail" | "Outlook")}>
                  Manage
                </Button>
                <Button variant="ghost" size="sm" onClick={() => goToEmailSetup(provider.id as "Gmail" | "Outlook")}>
                  Email Provider
                </Button>
              </>
            )}
          </div>
          {connected && accounts && accounts.length > 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", width: "100%" }}>
              {accounts.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span>{a.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => void handleDisconnectEmail(a.id, a.email)}>
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    if (provider.connectionType === "per_property") {
      return (
        <Button variant="secondary" size="sm" onClick={goToPropertyManagement}>
          Manage properties
        </Button>
      );
    }

    const connected = status.kind === "connected";
    const hasIntegration = Boolean(integration);

    if (!hasIntegration) {
      return (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleConnectApiKey(provider.configProvider!)}
        >
          Connect
        </Button>
      );
    }

    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" onClick={() => openConfig(integration!)}>
          {connected ? "Configure" : "Complete setup"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void handleDisconnectIntegration(integration!)}>
          Disconnect
        </Button>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Integration Hub"
        subtitle="Connect external services to your CRM"
        helpArticleId="integrations-overview"
      />

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 24,
          }}
        >
          {cardStates.map((card) => {
            const style = STATUS_STYLES[card.status.kind];
            return (
              <div
                key={card.provider.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius)",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Plug size={18} style={{ color: "var(--text-muted)" }} />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{card.provider.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: style.bg,
                      color: style.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      maxWidth: "50%",
                      textAlign: "right",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                    {statusLabel(card.status)}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                  {card.provider.desc}
                </p>
                {renderCardActions(card)}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!configModal} onOpenChange={() => setConfigModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{configModal?.provider ?? ""} Configuration</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            {configModal?.webhook_url ? (
              <div>
                <Label>Webhook URL</Label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Input readOnly value={configModal.webhook_url} style={{ fontFamily: "monospace", fontSize: 12 }} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyWebhookUrl(configModal.webhook_url!)}
                  >
                    {webhookCopied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {configModal.provider === "WATI"
                    ? "Paste this URL in WATI → Webhooks → Incoming Message trigger."
                    : "Paste this URL in your provider's webhook / HTTP POST settings."}
                </p>
              </div>
            ) : null}

            <div>
              <Label>API Key</Label>
              <div style={{ position: "relative" }}>
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configModal?.is_configured ? "•••••••• (leave blank to keep)" : "Enter API key"}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Never pre-filled for security. Saving will verify the connection automatically.
              </p>
            </div>

            {configModal && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Webhook Field Mappings</h3>
                <div
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--border-light)" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>SOURCE FIELD</th>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>CRM FIELD</th>
                        <th style={{ padding: "8px 12px", width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => (
                        <tr key={m._id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{m.source_field}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{m.target_field_slug}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteMapping(m._id)}
                              style={{ color: "var(--text-muted)" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input
                    placeholder="Source field"
                    value={newMapping.source}
                    onChange={(e) => setNewMapping((p) => ({ ...p, source: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <Select
                    value={newMapping.target}
                    onChange={(e) => setNewMapping((p) => ({ ...p, target: e.target.value }))}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select CRM field</option>
                    {activeCrmFields.map((f) => (
                      <option key={f._id} value={f.slug}>{f.label || f.name}</option>
                    ))}
                  </Select>
                  <Button variant="secondary" size="sm" onClick={handleAddMapping}>
                    Add
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfigModal(null)}>Close</Button>
            <Button variant="primary" onClick={() => void handleSaveConfig()}>Save & verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gmailModalOpen} onOpenChange={setGmailModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gmail — Google Workspace</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Configure domain-wide delegation once. Users with a matching Workspace email get their inbox automatically on login.
            </p>
            <div>
              <Label>Workspace domain</Label>
              <Input
                value={gmailDomain}
                onChange={(e) => setGmailDomain(e.target.value)}
                placeholder="moustache.com"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Label>Service account client email</Label>
              <Input
                value={gmailSaEmail}
                onChange={(e) => setGmailSaEmail(e.target.value)}
                placeholder="crm-gmail@project.iam.gserviceaccount.com"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Label>Service account private key</Label>
              <textarea
                value={gmailPrivateKey}
                onChange={(e) => setGmailPrivateKey(e.target.value)}
                placeholder={workspaceGmail?.hasPrivateKey ? "•••••••• (leave blank to keep existing key)" : "Paste PEM private key from JSON key file"}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  fontFamily: "monospace",
                  fontSize: 12,
                  resize: "vertical",
                }}
              />
            </div>
            <div>
              <Label>Admin test email (optional)</Label>
              <Input
                value={gmailTestEmail}
                onChange={(e) => setGmailTestEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                style={{ marginTop: 4 }}
              />
            </div>

            <Collapsible open={gmailGuideOpen} onOpenChange={setGmailGuideOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm">
                  Setup guide
                  <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${gmailGuideOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="mt-2 space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                  <li>Google Cloud: create a service account and download the JSON key.</li>
                  <li>Enable <strong>Domain-wide delegation</strong> on the service account.</li>
                  <li>
                    Google Admin Console → Security → API controls → Domain-wide delegation → Add client ID with scopes:
                    <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto text-[10px]">
{`https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify`}
                    </pre>
                  </li>
                  <li>CRM users must log in with the same email as their Workspace account.</li>
                  <li>Paste the service account email and private key here, then Verify &amp; connect.</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGmailModalOpen(false)}>Close</Button>
            <Button variant="secondary" onClick={() => void handleSaveGmailWorkspace()} disabled={gmailSaving}>
              Save
            </Button>
            <Button variant="primary" onClick={() => void handleVerifyGmailWorkspace()} disabled={gmailVerifying}>
              {gmailVerifying ? "Verifying..." : "Verify & connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
