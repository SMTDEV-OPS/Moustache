import { API_BASE_URL, withAuthHeaders } from "./api";

export type EmailProvider = "GMAIL" | "OUTLOOK" | "SMTP_IMAP";
export type SyncStatus = "IDLE" | "SYNCING" | "ERROR";

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  email: string;
  isActive: boolean;
  isPrimary: boolean;
  isLeadCaptureEnabled: boolean;
  lastSyncAt?: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

export interface EmailMessage {
  id: string;
  emailAccountId: string;
  threadId: string;
  messageId: string;
  inReplyTo?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet: string;
  folder: string;
  labels?: string[];
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isArchived: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    contentId?: string;
  }>;
  linkedLeadId?: string;
  linkedGuestId?: string;
  sentAt?: string;
  receivedAt?: string;
  createdAt?: string;
}

export interface EmailThread {
  threadId: string;
  messages: EmailMessage[];
}

export interface EmailFolder {
  id: string;
  name: string;
  unreadCount: number;
}

export interface SendEmailPayload {
  accountId?: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  replyTo?: string;
}

const mapEmailAccount = (raw: any): EmailAccount => {
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  };
};

const mapEmailMessage = (raw: any): EmailMessage => {
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  };
};

// ============================================
// Email Accounts
// ============================================

export const listEmailAccounts = async (): Promise<EmailAccount[]> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch email accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map(mapEmailAccount);
};

export const connectGmail = async (): Promise<{ authUrl: string }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/connect/gmail`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ popup: false }),
  });

  if (!response.ok) {
    let message = "Unable to start Gmail connection";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const connectGmailWithPopup = async (): Promise<Promise<{ email: string; accountId: string }>> => {
  return new Promise((resolve, reject) => {
    // Request auth URL with popup flag
    fetch(`${API_BASE_URL}/email/accounts/connect/gmail`, {
      method: "POST",
      headers: withAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ popup: true }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data?.message || "Unable to start Gmail connection");
          });
        }
        return response.json();
      })
      .then((data) => {
        const { authUrl } = data;

        // Open popup window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          "gmail_oauth",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        if (!popup) {
          reject(new Error("Popup blocked. Please allow popups for this site."));
          return;
        }

        // Listen for message from popup
        const messageHandler = (event: MessageEvent) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data.type === "OAUTH_SUCCESS") {
            window.removeEventListener("message", messageHandler);
            popup.close();
            resolve({
              email: event.data.email,
              accountId: event.data.accountId,
            });
          } else if (event.data.type === "OAUTH_ERROR") {
            window.removeEventListener("message", messageHandler);
            popup.close();
            reject(new Error(event.data.error || "OAuth connection failed"));
          }
        };

        window.addEventListener("message", messageHandler);

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", messageHandler);
            reject(new Error("OAuth popup was closed"));
          }
        }, 1000);
      })
      .catch(reject);
  });
};

export const completeGmailConnection = async (code: string, userId: string): Promise<{ account: EmailAccount }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/connect/gmail/callback`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ code, state: userId }),
  });

  if (!response.ok) {
    let message = "Unable to complete Gmail connection";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    account: mapEmailAccount(data.account),
  };
};

export const connectOutlook = async (): Promise<{ authUrl: string }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/connect/outlook`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ popup: false }),
  });

  if (!response.ok) {
    let message = "Unable to start Outlook connection";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const connectOutlookWithPopup = async (): Promise<Promise<{ email: string; accountId: string }>> => {
  return new Promise((resolve, reject) => {
    // Request auth URL with popup flag
    fetch(`${API_BASE_URL}/email/accounts/connect/outlook`, {
      method: "POST",
      headers: withAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ popup: true }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data?.message || "Unable to start Outlook connection");
          });
        }
        return response.json();
      })
      .then((data) => {
        const { authUrl } = data;

        // Open popup window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          "outlook_oauth",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        if (!popup) {
          reject(new Error("Popup blocked. Please allow popups for this site."));
          return;
        }

        // Listen for message from popup
        const messageHandler = (event: MessageEvent) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data.type === "OAUTH_SUCCESS") {
            window.removeEventListener("message", messageHandler);
            popup.close();
            resolve({
              email: event.data.email,
              accountId: event.data.accountId,
            });
          } else if (event.data.type === "OAUTH_ERROR") {
            window.removeEventListener("message", messageHandler);
            popup.close();
            reject(new Error(event.data.error || "OAuth connection failed"));
          }
        };

        window.addEventListener("message", messageHandler);

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", messageHandler);
            reject(new Error("OAuth popup was closed"));
          }
        }, 1000);
      })
      .catch(reject);
  });
};

export const completeOutlookConnection = async (code: string, userId: string): Promise<{ account: EmailAccount }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/connect/outlook/callback`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ code, state: userId }),
  });

  if (!response.ok) {
    let message = "Unable to complete Outlook connection";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    account: mapEmailAccount(data.account),
  };
};

export interface SMTPConfig {
  email: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
}

export interface TestSMTPResult {
  smtp: { success: boolean; error?: string };
  imap: { success: boolean; error?: string };
}

export const testSMTPConnection = async (config: Omit<SMTPConfig, "email">): Promise<TestSMTPResult> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/test-smtp`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    let message = "Unable to test SMTP connection";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const connectSMTP = async (config: SMTPConfig): Promise<{ account: EmailAccount }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/connect/smtp`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    let message = "Unable to connect SMTP account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    account: mapEmailAccount(data.account),
  };
};

export const disconnectEmailAccount = async (accountId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/${accountId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to disconnect email account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

export const updateEmailAccount = async (accountId: string, updates: { isLeadCaptureEnabled?: boolean }): Promise<{ account: EmailAccount }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/${accountId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    let message = "Unable to update email account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return { account: mapEmailAccount(data.account) };
};

export const syncEmailAccount = async (accountId: string): Promise<{ syncedCount: number; errorCode?: string }> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/${accountId}/sync`, {
    method: "POST",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to sync email account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const setPrimaryEmailAccount = async (accountId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/email/accounts/${accountId}/primary`, {
    method: "PATCH",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to set primary account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

// ============================================
// Email Messages
// ============================================

export interface ListEmailsQuery {
  folder?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export const listEmails = async (query?: ListEmailsQuery): Promise<{ messages: EmailMessage[]; total: number; limit: number; offset: number }> => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
  }

  const url = `${API_BASE_URL}/email/messages${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch emails";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    ...data,
    messages: data.messages.map(mapEmailMessage),
  };
};

export const getEmail = async (emailId: string): Promise<EmailMessage> => {
  const response = await fetch(`${API_BASE_URL}/email/messages/${emailId}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapEmailMessage(await response.json());
};

export const getEmailThread = async (threadId: string): Promise<EmailThread> => {
  const response = await fetch(`${API_BASE_URL}/email/threads/${threadId}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch email thread";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    ...data,
    messages: data.messages.map(mapEmailMessage),
  };
};

export const sendEmail = async (payload: SendEmailPayload): Promise<EmailMessage> => {
  const response = await fetch(`${API_BASE_URL}/email/send`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to send email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapEmailMessage(await response.json());
};

export const replyToEmail = async (messageId: string, bodyText?: string, bodyHtml?: string, accountId?: string): Promise<EmailMessage> => {
  const response = await fetch(`${API_BASE_URL}/email/reply/${messageId}`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ bodyText, bodyHtml, accountId }),
  });

  if (!response.ok) {
    let message = "Unable to reply to email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapEmailMessage(await response.json());
};

export const forwardEmail = async (
  messageId: string,
  to: EmailAddress[],
  bodyText?: string,
  bodyHtml?: string,
  accountId?: string
): Promise<EmailMessage> => {
  const response = await fetch(`${API_BASE_URL}/email/forward/${messageId}`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ to, bodyText, bodyHtml, accountId }),
  });

  if (!response.ok) {
    let message = "Unable to forward email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapEmailMessage(await response.json());
};

export const updateEmail = async (
  emailId: string,
  updates: { isRead?: boolean; isStarred?: boolean; folder?: string }
): Promise<EmailMessage> => {
  const response = await fetch(`${API_BASE_URL}/email/messages/${emailId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    let message = "Unable to update email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapEmailMessage(await response.json());
};

export const deleteEmail = async (emailId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/email/messages/${emailId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

export const listEmailFolders = async (): Promise<EmailFolder[]> => {
  const response = await fetch(`${API_BASE_URL}/email/folders`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch email folders";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

// ============================================
// Email Settings (Provider Management)
// ============================================

export const getAllowedProviders = async (): Promise<{ allowedProviders: EmailProvider[] }> => {
  const response = await fetch(`${API_BASE_URL}/email/settings/allowed-providers`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch allowed providers";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const getEmailSettings = async (): Promise<{
  allowedProviders: EmailProvider[];
  updatedBy?: string;
  updatedAt?: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/email/settings`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch email settings";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const updateAllowedProviders = async (
  allowedProviders: EmailProvider[]
): Promise<{
  allowedProviders: EmailProvider[];
  updatedBy?: string;
  updatedAt?: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/email/settings/allowed-providers`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ allowedProviders }),
  });

  if (!response.ok) {
    let message = "Unable to update allowed providers";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

