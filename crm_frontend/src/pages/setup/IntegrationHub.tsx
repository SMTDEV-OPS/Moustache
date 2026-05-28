import { useEffect, useState, useCallback } from "react";
import { Plug, Trash2, Eye, EyeOff } from "lucide-react";
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
  type IntegrationStatus,
} from "@/services/adminIntegrations";
import { listAdminFields } from "@/services/adminFields";
import { PageHeader, Button, Input, Select } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const PROVIDERS = [
  { id: "WATI", name: "WATI", desc: "WhatsApp Business API" },
  { id: "Exotel", name: "Exotel", desc: "IVR and phone" },
  { id: "Ezee", name: "Ezee", desc: "Property management" },
  { id: "Gmail", name: "Gmail", desc: "Email integration" },
  { id: "Outlook", name: "Outlook", desc: "Microsoft 365 email" },
  { id: "Airpay", name: "Airpay", desc: "Payment processing" },
];

// orgId is not passed — backend returns all integrations for the single org

const STATUS_STYLES: Record<IntegrationStatus, { bg: string; text: string }> = {
  connected: { bg: "#d1fae5", text: "#065f46" },
  error: { bg: "#fef2f2", text: "#ef4444" },
  pending: { bg: "#fffbeb", text: "#f59e0b" },
  disconnected: { bg: "var(--border-light)", text: "var(--text-muted)" },
};

export function IntegrationHub() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [configModal, setConfigModal] = useState<IntegrationConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);
  const [newMapping, setNewMapping] = useState({ source: "", target: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [list, fList] = await Promise.all([
        listIntegrations(),
        listAdminFields("lead").catch(() => []),
      ]);
      setIntegrations(list);
      setFields(fList);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConfig = async (int?: IntegrationConfig) => {
    if (int) {
      setConfigModal(int);
      setApiKey("");
      const maps = await listMappings(int._id).catch(() => []);
      setMappings(maps);
    } else {
      setConfigModal(null);
    }
    setNewMapping({ source: "", target: "" });
  };

  const handleConnect = async (providerId: string) => {
    try {
      const created = await createIntegration({
        provider: providerId,
        config_json: {},
      });
      setIntegrations((prev) => [...prev.filter((i) => i.provider !== providerId), created]);
      openConfig(created);
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
      toast({ title: "Configuration saved" });
      setConfigModal(null);
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleVerify = async (int: IntegrationConfig) => {
    try {
      const { verified } = await verifyIntegration(int._id);
      toast({ title: verified ? "Verified" : "Verification failed" });
      void load();
    } catch (e) {
      toast({ title: "Verification failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDisconnect = async (int: IntegrationConfig) => {
    if (!confirm(`Disconnect ${int.provider}?`)) return;
    try {
      await deleteIntegration(int._id);
      toast({ title: "Disconnected" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
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

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Integration Hub"
        subtitle="Connect external services to your CRM"
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
          {PROVIDERS.map((p) => {
            const int = integrations.find((i) => i.provider === p.id);
            const status = int?.status ?? "disconnected";
            const style = STATUS_STYLES[status];
            return (
              <div
                key={p.id}
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
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
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
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                    {status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{p.desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!int ? (
                    <Button variant="primary" size="sm" onClick={() => handleConnect(p.id)}>
                      Connect
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openConfig(int)}
                      >
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleVerify(int)}>
                        Verify
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDisconnect(int)}>
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!configModal} onOpenChange={() => setConfigModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{configModal?.provider ?? ""} Configuration</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
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
                Never pre-filled for security
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
                    {fields.map((f) => (
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
            <Button variant="primary" onClick={handleSaveConfig}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
