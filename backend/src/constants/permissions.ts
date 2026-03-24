export const ACTIONS = {
    READ: "read",
    WRITE: "write",
    DELETE: "delete",
    MANAGE: "manage", // Implies all other actions
} as const;

export const MODULES = {
    LEADS: "leads",
    USERS: "users",
    ROLES: "roles",
    REPORTS: "reports",
    ACCOUNTS: "accounts",
    CONTACTS: "contacts",
    PROPERTIES: "properties",
    TASKS: "tasks",
    TICKETS: "tickets",
    GUESTS: "guests",
    RESERVATIONS: "reservations",
    COMMUNICATIONS: "communications",
    QUOTATIONS: "quotations",
    PAYMENT_LINKS: "payment-links",
    WORKFLOWS: "workflows",
    TEMPLATES: "templates",
    KNOWLEDGE_BASE: "knowledge-base",
    SETTINGS: "settings",
    PMS: "pms",
    REGIONS: "regions",
    GROUPS: "groups",
    ASSIGNMENT_RULES: "assignment-rules",
    NOTIFICATIONS: "notifications",
    EMAIL: "email",
    BUDDIES: "buddies",
    AVAILABILITY: "availability",
    CONGLOMERATES: "conglomerates",
    ACCOUNT_POTENTIALS: "account-potentials",
    HOTEL_BRANDS: "hotel-brands",
} as const;

export type ModuleType = (typeof MODULES)[keyof typeof MODULES];
export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];

export const PERMISSIONS = {
    LEADS: {
        READ: "leads.read",
        WRITE: "leads.write",
        UPDATE: "leads.update",
        DELETE: "leads.delete",
        MANAGE: "leads.manage",
        ASSIGN: "leads.assign",
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
        CREATE: "accounts.create",
        UPDATE: "accounts.update",
        DELETE: "accounts.delete",
        MANAGE: "accounts.manage",
        ACCESS: "accounts.access",
        ASSIGN_MANAGERS: "accounts.assign_managers",
        VIEW_HIERARCHY: "accounts.view_hierarchy",
        MANAGE_ACTIVITIES: "accounts.manage_activities",
        MANAGE_NOTES: "accounts.manage_notes",
        MANAGE_DOCUMENTS: "accounts.manage_documents",
        EDIT_CREDIT: "accounts.edit.credit",
    },
    CONTACTS: {
        READ: "contacts.read",
        WRITE: "contacts.write",
        CREATE: "contacts.create",
        UPDATE: "contacts.update",
        DELETE: "contacts.delete",
        MANAGE: "contacts.manage",
        UPDATE_ALL: "contacts.update_all",
        UPDATE_OWN: "contacts.update_own",
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
    AVAILABILITY: {
        READ: "availability.read",
    },
    CONGLOMERATES: {
        READ: "conglomerates.read",
        MANAGE: "conglomerates.manage",
    },
    ACCOUNT_POTENTIALS: {
        READ: "account-potentials.read",
        MANAGE: "account-potentials.manage",
    },
    HOTEL_BRANDS: {
        READ: "hotel-brands.read",
        MANAGE: "hotel-brands.manage",
    },
} as const;


// Helper to get all permissions as a flat list
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap((actionMap) =>
    Object.values(actionMap)
);

export const DEFAULT_ROLES_CONFIG = {
    ADMIN: {
        name: "Admin",
        permissions: ALL_PERMISSIONS,
        description: "Full access to all modules and settings",
        isSystemRole: true,
    },
    SALES_REP: {
        name: "Sales Representative",
        permissions: [
            PERMISSIONS.LEADS.READ,
            PERMISSIONS.LEADS.CREATE,
            PERMISSIONS.TASKS.READ,
            PERMISSIONS.TASKS.WRITE,
            PERMISSIONS.COMMUNICATIONS.READ,
            PERMISSIONS.COMMUNICATIONS.WRITE,
            PERMISSIONS.QUOTATIONS.READ,
            PERMISSIONS.QUOTATIONS.WRITE,
            PERMISSIONS.PAYMENT_LINKS.READ,
            PERMISSIONS.PAYMENT_LINKS.WRITE,
            PERMISSIONS.CONTACTS.READ,
            PERMISSIONS.CONTACTS.CREATE,
            PERMISSIONS.CONTACTS.UPDATE_OWN,
            PERMISSIONS.ACCOUNTS.READ,
            PERMISSIONS.ACCOUNTS.ACCESS,
            PERMISSIONS.ACCOUNTS.MANAGE_ACTIVITIES,
            PERMISSIONS.ACCOUNTS.MANAGE_NOTES,
            PERMISSIONS.NOTIFICATIONS.MANAGE
        ],
        description: "Standard access for sales activities",
        isSystemRole: false,
    },
    MANAGER: {
        name: "Manager",
        permissions: [
            PERMISSIONS.LEADS.MANAGE,
            PERMISSIONS.TASKS.MANAGE,
            PERMISSIONS.REPORTS.READ,
            PERMISSIONS.USERS.READ,
            PERMISSIONS.CONTACTS.MANAGE,
            PERMISSIONS.ACCOUNTS.MANAGE,
            PERMISSIONS.QUOTATIONS.MANAGE,
        ],
        description: "Management access for leads and team oversight",
        isSystemRole: false,
    },
};
