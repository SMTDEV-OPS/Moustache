import type { TrainingArticle } from "./types";

export const TRAINING_ARTICLES: TrainingArticle[] = [
  {
    id: "getting-started",
    title: "Getting started with Moustache CRM",
    summary: "Overview of the CRM layout, navigation, and your daily workflow as an agent or admin.",
    track: "getting-started",
    audience: ["all"],
    sections: [
      {
        body: "Moustache CRM helps you capture leads, follow up on time, send quotations, and book rooms across all properties. Use the left sidebar to move between modules.",
        steps: [
          "Log in with your assigned email and password.",
          "Check Dashboard for today's priorities and overdue follow-ups.",
          "Open Leads to work your queue or create a new lead.",
          "Use Training whenever you need a refresher.",
        ],
      },
      {
        heading: "Key areas",
        body: "Dashboard shows metrics and recent activity. Leads is your main workspace. Follow Ups lists tasks due today. Knowledge Base holds property facts and training PDFs.",
      },
    ],
  },
  {
    id: "dashboard-overview",
    title: "Dashboard",
    summary: "View lead overview, statistics, and recent activity. Track hot leads, bookings, and pending actions.",
    track: "getting-started",
    audience: ["all"],
    relatedView: "dashboard",
    sections: [
      {
        body: "The dashboard gives a snapshot of your pipeline. Filter by your leads, team leads, or all leads depending on your permissions.",
        tips: ["Click a lead row to open the full lead detail page.", "Use View all leads to jump to the Leads module."],
      },
    ],
  },
  {
    id: "leads-overview",
    title: "Managing leads",
    summary: "View, create, edit, and assign leads. Filter by status, heat level, and follow-up activity.",
    track: "leads",
    audience: ["all"],
    relatedView: "admin-leads",
    sections: [
      {
        body: "The Leads module is where you spend most of your time. Search and filter to find the right lead quickly.",
        steps: [
          "Use filters for stage, owner, source, or date range.",
          "Click a lead to open Lead Detail for full history and actions.",
          "Use Add Lead to create manual entries or import via Setup.",
        ],
      },
    ],
  },
  {
    id: "leads-create",
    title: "Creating and editing leads",
    summary: "Add guest details, travel plan, hotels, and custom fields when creating or updating a lead.",
    track: "leads",
    audience: ["all"],
    relatedView: "admin-leads",
    sections: [
      {
        body: "A complete lead includes contact info, source, customer type (B2C/B2B), and travel details (check-in, check-out, hotels).",
        steps: [
          "Open Add Lead or Edit on an existing lead.",
          "Fill mandatory fields marked with *.",
          "Add one or more hotels in the travel itinerary for quotations and booking.",
          "Save — the lead enters the pipeline at the configured stage.",
        ],
        tips: ["Without travel dates and a hotel on the itinerary, Send Quotation and Book Room stay disabled."],
      },
    ],
  },
  {
    id: "leads-detail-actions",
    title: "Lead detail — actions",
    summary: "From lead detail you can call, email, send quotations, book rooms, and log activities.",
    track: "leads",
    audience: ["all"],
    relatedView: "lead-detail",
    sections: [
      {
        body: "Lead Detail is the command center for one guest. The timeline shows calls, emails, notes, and stage changes.",
        steps: [
          "Review itinerary and guest preferences in the left column.",
          "Log a call or note from the activity section.",
          "Send Quotation when travel plan and hotel are set.",
          "Book Room when the guest is ready to confirm (requires eZee PMS hotel).",
        ],
      },
    ],
  },
  {
    id: "followups-today",
    title: "Today's follow-ups",
    summary: "View and complete follow-up tasks scheduled for today. Overdue tasks are highlighted.",
    track: "followups",
    audience: ["all"],
    relatedView: "todays-followups",
    sections: [
      {
        body: "Follow-ups are auto-scheduled based on lead score buckets and follow-up rules configured in Setup.",
        steps: [
          "Open Follow Ups from the sidebar — the badge shows due + overdue count.",
          "Complete each task or reschedule from the lead detail page.",
          "Use My Calendar for a week view of upcoming tasks.",
        ],
      },
    ],
  },
  {
    id: "sales-quotation",
    title: "Sending a quotation",
    summary: "Build and email a rate quotation using live eZee rates when a hotel with PMS is on the lead.",
    track: "sales",
    audience: ["all"],
    relatedView: "admin-leads",
    sections: [
      {
        body: "Quotations pull room rates from eZee for properties with PMS configured. The guest receives a branded email.",
        steps: [
          "Ensure the lead has check-in, check-out, and at least one hotel in the itinerary.",
          "Click Send Quotation on lead detail.",
          "Select rooms, meal plans, and rates — use Fetch Rates for live PMS pricing.",
          "Preview and send the email.",
        ],
      },
    ],
  },
  {
    id: "sales-book-room",
    title: "Booking a room (PMS)",
    summary: "Create a reservation in eZee directly from a lead when travel details and PMS credentials are set.",
    track: "sales",
    audience: ["all"],
    relatedView: "lead-detail",
    sections: [
      {
        body: "Book Room connects to eZee PMS. The property must have hotelCode and authCode configured in Property Management.",
        steps: [
          "Open a lead with itinerary: hotel, check-in, check-out.",
          "Click Book Room — only eZee-configured hotels appear.",
          "Select room type, rate plan, and guest details.",
          "Confirm booking — reference is saved on the lead.",
        ],
        callout: "If no hotels appear, ask an admin to verify PMS setup under Setup → Property Management.",
      },
    ],
  },
  {
    id: "email-inbox",
    title: "Email inbox",
    summary: "Read, reply, and manage lead email communication in one place.",
    track: "email",
    audience: ["all"],
    relatedView: "email-inbox",
    sections: [
      {
        body: "The inbox syncs connected Gmail or Workspace accounts. Threads can be linked to leads for a unified timeline.",
        steps: ["Connect accounts under Email Accounts first.", "Open Inbox to read and reply.", "Link messages to leads from the composer."],
      },
    ],
  },
  {
    id: "email-setup",
    title: "Email setup",
    summary: "Connect Gmail, Outlook, or SMTP. Enable lead capture from inbound messages.",
    track: "email",
    audience: ["admin", "supervisor"],
    relatedView: "email-accounts",
    sections: [
      {
        body: "Go to Setup → Email Provider or Email Accounts in the sidebar. Gmail Workspace uses domain-wide delegation configured in Integration Hub.",
        steps: [
          "Add an email account (Gmail OAuth or SMTP).",
          "Set a primary account for outbound lead email.",
          "Optional: enable inbound lead capture from new senders.",
        ],
      },
    ],
  },
  {
    id: "kb-overview",
    title: "Knowledge Base",
    summary: "Property facts, fact sheets, templates, and training resources for calls and sales.",
    track: "knowledge",
    audience: ["all"],
    relatedView: "knowledge-properties",
    sections: [
      {
        body: "Knowledge Base is for hotel operational content — not CRM how-to. Use Training for system guides.",
        steps: [
          "Properties — basic property cards.",
          "Fact Sheets — policies, rooms, charges.",
          "Templates — downloadable files.",
          "Resources — training PDFs and videos uploaded by admins.",
        ],
      },
    ],
    kbLinks: [{ label: "Open Knowledge Base Resources", view: "knowledge-resources" }],
  },
  {
    id: "reports-overview",
    title: "Reports",
    summary: "Conversion rates, response times, lead sources, and team performance metrics.",
    track: "reports",
    audience: ["supervisor", "admin"],
    relatedView: "reports",
    sections: [{ body: "Reports help managers track team performance. Export to Excel where available." }],
  },
  {
    id: "buddy-overview",
    title: "Buddy management",
    summary: "Assign backup coverage when agents are away. View buddy history and reports.",
    track: "reports",
    audience: ["supervisor", "admin"],
    relatedView: "buddy-management",
    sections: [{ body: "Buddy assignments ensure leads are covered during leave or overflow. Assign a buddy from the Buddy module." }],
  },
  {
    id: "integrations-overview",
    title: "Integration Hub",
    summary: "Connect WATI, Exotel, Gmail Workspace, and eZee PMS. Configure webhooks and API keys.",
    track: "integrations",
    audience: ["admin"],
    relatedView: "setup/integrations",
    sections: [
      {
        body: "Integration Hub centralizes external connections. eZee PMS credentials are set per property in Property Management.",
        steps: [
          "Open Setup → Integration Hub.",
          "Connect each provider with API keys or OAuth.",
          "Copy webhook URLs into WATI/Exotel as instructed.",
          "For eZee: configure hotelCode and authCode on each property.",
        ],
      },
    ],
  },
  {
    id: "admin-properties",
    title: "Property management",
    summary: "Add hotels, set tiers, and configure eZee PMS credentials per property.",
    track: "admin",
    audience: ["admin"],
    relatedView: "settings",
    sections: [
      {
        body: "Every bookable hotel needs a property record. PMS-enabled properties require EZEE provider with hotelCode and authCode.",
        steps: [
          "Setup → Property Mgmt (or /properties).",
          "Add or edit a property — set status to ACTIVE.",
          "Under PMS, choose EZEE and enter credentials from eZee.",
          "Sync room catalogue when prompted.",
        ],
      },
    ],
  },
  {
    id: "setup-roles",
    title: "Roles and profiles",
    summary: "Roles define hierarchy; profiles define what users can see and do in each module.",
    track: "admin",
    audience: ["admin"],
    relatedView: "settings",
    sections: [
      {
        body: "Create roles to match your org chart. Attach profiles that grant module permissions (view/create/edit/delete).",
        steps: [
          "Setup → Profiles — define permissions per module.",
          "Setup → Roles — create roles and link profiles.",
          "Setup → Users — assign each user a role.",
        ],
      },
    ],
  },
  {
    id: "setup-pipelines",
    title: "Pipelines and stages",
    summary: "Configure sales stages and required fields at each stage.",
    track: "admin",
    audience: ["admin"],
    relatedView: "setup/pipelines",
    sections: [{ body: "Pipelines control how leads move from New to Won/Lost. Mark fields mandatory at specific stages to enforce data quality." }],
  },
  {
    id: "setup-allocation",
    title: "Lead allocation",
    summary: "Round-robin or workload-based auto-assignment of new leads to agents.",
    track: "admin",
    audience: ["admin"],
    relatedView: "setup/allocation",
    sections: [
      {
        body: "Assignment rules route inbound leads by tags (B2B/B2C), capacity limits, and team membership.",
        tips: ["Default capacity is often 30 leads per agent per day — adjust in allocation settings."],
      },
    ],
  },
  {
    id: "setup-workflows",
    title: "Workflows",
    summary: "Automate follow-ups and actions when leads are created or stages change.",
    track: "admin",
    audience: ["admin"],
    relatedView: "setup/workflows",
    sections: [{ body: "Workflows use triggers, conditions, and actions. Test with dry run before activating in production." }],
  },
];
