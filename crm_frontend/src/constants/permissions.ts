export const PERMISSIONS = {
  LEADS: {
    READ: "leads.read",
    WRITE: "leads.write",
    UPDATE: "leads.update",
    DELETE: "leads.delete",
    MANAGE: "leads.manage",
    ASSIGN: "leads.assign",
    REASSIGN: "leads.reassign",
    CREATE: "leads.create",
  },
  USERS: {
    READ: "users.read",
    WRITE: "users.write",
    DELETE: "users.delete",
    MANAGE: "users.manage",
  },
  ROLES: {
    READ: "roles.read",
    WRITE: "roles.write",
    DELETE: "roles.delete",
    MANAGE: "roles.manage",
  },
  REPORTS: {
    READ: "reports.read",
    MANAGE: "reports.manage",
  },
  ACCOUNTS: {
    READ: "accounts.read",
    WRITE: "accounts.write",
    DELETE: "accounts.delete",
    MANAGE: "accounts.manage",
  },
  CONTACTS: {
    READ: "contacts.read",
    WRITE: "contacts.write",
    DELETE: "contacts.delete",
    MANAGE: "contacts.manage",
  },
  PROPERTIES: {
    READ: "properties.read",
    WRITE: "properties.write",
    DELETE: "properties.delete",
    MANAGE: "properties.manage",
  },
  TASKS: {
    READ: "tasks.read",
    WRITE: "tasks.write",
    DELETE: "tasks.delete",
    MANAGE: "tasks.manage",
  },
  TICKETS: {
    READ: "tickets.read",
    WRITE: "tickets.write",
    DELETE: "tickets.delete",
    MANAGE: "tickets.manage",
  },
  GUESTS: {
    READ: "guests.read",
    WRITE: "guests.write",
    DELETE: "guests.delete",
    MANAGE: "guests.manage",
  },
  RESERVATIONS: {
    READ: "reservations.read",
    WRITE: "reservations.write",
    DELETE: "reservations.delete",
    MANAGE: "reservations.manage",
  },
  COMMUNICATIONS: {
    READ: "communications.read",
    WRITE: "communications.write",
    MANAGE: "communications.manage",
  },
  QUOTATIONS: {
    READ: "quotations.read",
    WRITE: "quotations.write",
    DELETE: "quotations.delete",
    MANAGE: "quotations.manage",
  },
  PAYMENT_LINKS: {
    READ: "payment-links.read",
    WRITE: "payment-links.write",
    MANAGE: "payment-links.manage",
  },
  WORKFLOWS: {
    READ: "workflows.read",
    WRITE: "workflows.write",
    DELETE: "workflows.delete",
    MANAGE: "workflows.manage",
  },
  TEMPLATES: {
    READ: "templates.read",
    WRITE: "templates.write",
    DELETE: "templates.delete",
    MANAGE: "templates.manage",
  },
  KNOWLEDGE_BASE: {
    READ: "knowledge-base.read",
    WRITE: "knowledge-base.write",
    DELETE: "knowledge-base.delete",
    MANAGE: "knowledge-base.manage",
  },
  PMS: {
    READ: "pms.read",
    WRITE: "pms.write",
    MANAGE: "pms.manage",
  },
  SETTINGS: {
    MANAGE: "settings.manage",
  },
  REGIONS: {
    READ: "regions.read",
    MANAGE: "regions.manage",
  },
  GROUPS: {
    READ: "groups.read",
    MANAGE: "groups.manage",
  },
  ASSIGNMENT_RULES: {
    READ: "assignment-rules.read",
    MANAGE: "assignment-rules.manage",
  },
  NOTIFICATIONS: {
    MANAGE: "notifications.manage",
  },
  EMAIL: {
    READ: "email.read",
    WRITE: "email.write",
  },
  BUDDIES: {
    READ: "buddies.read",
    MANAGE: "buddies.manage",
  },
} as const;

