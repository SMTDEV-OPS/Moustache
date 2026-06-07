import type { IntegrationConfig } from "@/services/adminIntegrations";
import type { GoogleWorkspaceConfigPublic } from "@/services/email";
import type { Property } from "@/services/properties";

export type IntegrationProviderId =
  | "WATI"
  | "Exotel"
  | "Ezee"
  | "Gmail"
  | "Outlook"
  | "Airpay";

export type ConnectionType = "api_key" | "oauth" | "per_property" | "coming_soon";

export interface IntegrationProviderDef {
  id: IntegrationProviderId;
  name: string;
  desc: string;
  connectionType: ConnectionType;
  /** IntegrationConfig.provider value for api_key types */
  configProvider?: string;
  emailProvider?: "GMAIL" | "OUTLOOK" | "SMTP_IMAP";
}

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  {
    id: "WATI",
    name: "WATI",
    desc: "WhatsApp Business API — inbound lead capture via webhooks",
    connectionType: "api_key",
    configProvider: "WATI",
  },
  {
    id: "Exotel",
    name: "Exotel",
    desc: "IVR and phone — capture leads from incoming calls",
    connectionType: "api_key",
    configProvider: "Exotel",
  },
  {
    id: "Ezee",
    name: "Ezee",
    desc: "Property management — rates, availability, and bookings per hotel",
    connectionType: "per_property",
  },
  {
    id: "Gmail",
    name: "Gmail",
    desc: "Google Workspace auto-inbox (admin) or per-user OAuth fallback",
    connectionType: "oauth",
    emailProvider: "GMAIL",
  },
  {
    id: "Outlook",
    name: "Outlook",
    desc: "Send and receive email via Microsoft 365 OAuth",
    connectionType: "oauth",
    emailProvider: "OUTLOOK",
  },
  {
    id: "Airpay",
    name: "Airpay",
    desc: "Payment processing for booking payments",
    connectionType: "coming_soon",
  },
];

export type CardDisplayStatus =
  | { kind: "coming_soon" }
  | { kind: "disconnected" }
  | { kind: "connected"; detail?: string }
  | { kind: "partial"; detail: string }
  | { kind: "error" };

export interface ProviderCardState {
  provider: IntegrationProviderDef;
  status: CardDisplayStatus;
  integration?: IntegrationConfig;
  emailAccounts?: EmailAccount[];
  ezeeConnectedCount?: number;
  ezeeTotalCount?: number;
}

export function isEzeePropertyConfigured(p: Property): boolean {
  return (
    p.pmsProvider === "EZEE" &&
    Boolean(p.pmsConfig?.hotelCode?.trim()) &&
    Boolean(p.pmsConfig?.authCode?.trim())
  );
}

export function buildProviderCardStates(
  integrations: IntegrationConfig[],
  emailAccounts: EmailAccount[],
  properties: Property[],
  workspaceGmail?: GoogleWorkspaceConfigPublic | null
): ProviderCardState[] {
  const ezeeTotal = properties.length;
  const ezeeConnected = properties.filter(isEzeePropertyConfigured).length;

  return INTEGRATION_PROVIDERS.map((provider) => {
    if (provider.connectionType === "coming_soon") {
      return { provider, status: { kind: "coming_soon" } };
    }

    if (provider.connectionType === "oauth" && provider.emailProvider) {
      if (provider.id === "Gmail" && workspaceGmail?.isVerified) {
        return {
          provider,
          status: {
            kind: "connected",
            detail: `Workspace: ${workspaceGmail.domain}`,
          },
          emailAccounts: emailAccounts.filter((a) => a.provider === provider.emailProvider),
        };
      }

      const accounts = emailAccounts.filter((a) => a.provider === provider.emailProvider);
      if (accounts.length === 0) {
        return { provider, status: { kind: "disconnected" }, emailAccounts: [] };
      }
      const detail =
        accounts.length === 1
          ? accounts[0].email
          : `${accounts.length} accounts connected`;
      return {
        provider,
        status: { kind: "connected", detail },
        emailAccounts: accounts,
      };
    }

    if (provider.connectionType === "per_property") {
      if (ezeeTotal === 0) {
        return {
          provider,
          status: { kind: "disconnected" },
          ezeeConnectedCount: 0,
          ezeeTotalCount: 0,
        };
      }
      if (ezeeConnected === 0) {
        return {
          provider,
          status: { kind: "partial", detail: `0 of ${ezeeTotal} properties configured` },
          ezeeConnectedCount: 0,
          ezeeTotalCount: ezeeTotal,
        };
      }
      if (ezeeConnected < ezeeTotal) {
        return {
          provider,
          status: {
            kind: "partial",
            detail: `${ezeeConnected} of ${ezeeTotal} properties configured`,
          },
          ezeeConnectedCount: ezeeConnected,
          ezeeTotalCount: ezeeTotal,
        };
      }
      return {
        provider,
        status: {
          kind: "connected",
          detail: `${ezeeConnected} propert${ezeeConnected === 1 ? "y" : "ies"} configured`,
        },
        ezeeConnectedCount: ezeeConnected,
        ezeeTotalCount: ezeeTotal,
      };
    }

    const integration = integrations.find((i) => i.provider === provider.configProvider);
    if (!integration) {
      return { provider, status: { kind: "disconnected" } };
    }
    if (integration.status === "error") {
      return { provider, status: { kind: "error" }, integration };
    }
    if (integration.status === "connected" && integration.is_configured) {
      return { provider, status: { kind: "connected" }, integration };
    }
    if (integration.is_configured || integration.status === "pending") {
      return {
        provider,
        status: { kind: "partial", detail: "Configured — verify connection" },
        integration,
      };
    }
    return { provider, status: { kind: "disconnected" }, integration };
  });
}

export const EMAIL_SETUP_PROVIDER_KEY = "emailSetupProvider";

export function emailProviderSessionKey(providerId: "Gmail" | "Outlook"): "gmail" | "outlook" {
  return providerId === "Gmail" ? "gmail" : "outlook";
}
