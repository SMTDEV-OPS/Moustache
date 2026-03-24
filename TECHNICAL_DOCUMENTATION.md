# Postcard CRM — Complete Technical Documentation

This document explains how the Postcard CRM system works for developers who need to maintain, debug, and extend it. It is based on a full codebase read and uses actual file paths, function names, and code references.

---

## PART 1: SYSTEM OVERVIEW

### 1. What is this system?

**Postcard CRM** is a hotel-focused Customer Relationship Management system built with Express + TypeScript + MongoDB. It manages leads (potential bookings), guests, accounts, reservations, and integrates with a Property Management System (PMS, Ezee). The system includes configurable engines for lead scoring, follow-ups, workflows, pipeline stages, allocation rules, and field definitions. It supports multi-tenant (org-based) access with profiles, roles, and data-sharing rules.

---

### 2. Folder Structure (2 levels deep)

```
Postcard/
├── backend/                    # Express + TypeScript API server
│   ├── src/
│   │   ├── config/             # Environment config, logger
│   │   ├── controllers/        # Business logic controllers (allocation, profile)
│   │   ├── cron/               # Cron jobs (inactive lead monitor)
│   │   ├── jobs/               # Job scheduler, Ezee sync
│   │   ├── middleware/         # Auth, error handler, request logger
│   │   ├── models/             # Mongoose schemas (Lead, User, Guest, etc.)
│   │   ├── routes/             # Express route handlers
│   │   ├── scripts/            # Seed scripts, migrations
│   │   ├── services/           # Core business logic (leadService, scoringService, etc.)
│   │   └── utils/              # Helpers (leadAccess, auditLog, httpError)
│   └── scripts/                # One-off scripts (seedAdmin, seedEzeeProperties, etc.)
├── crm_frontend/               # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # AuthContext for auth state
│   │   ├── hooks/              # Custom hooks (useToast)
│   │   ├── pages/              # Top-level pages (Index, setup pages)
│   │   └── services/           # API clients (api.ts, auth.ts, leads, etc.)
│   └── public/                 # Static assets
└── .claude/, .agents/          # Claude/agent skills and rules
```

---

### 3. Request Flow: Browser → Database → Back

**Example: GET /leads (authenticated)**

1. **Browser** → `fetch(API_BASE_URL + "/leads", { headers: { Authorization: "Bearer <token>" } })`
2. **HTTP Server** (`http.createServer(app)` in `server.ts`) receives request
3. **Express app** (`app.ts`):
   - `cors()` — allows cross-origin
   - `express.json()` — parses JSON body
   - `requestLogger` — assigns `requestId`, logs start
   - Router: `/leads` → `leadsRouter` (from `routes/leads.ts`)
4. **Auth** — `leadsRouter.use(requireAuth)` in `middleware/auth.ts`:
   - Extracts Bearer token from `Authorization` header (or `?token=` for GET)
   - `jwt.verify(token, config.jwtSecret)` → decoded `{ sub, email, roleId }`
   - Loads `UserModel.findById(decoded.sub)`; rejects if inactive
   - Calls `AccessControlService.getUserPermissions(user.id)` and `getDescendants(user.id)`
   - Attaches `req.user = { id, email, roleId, isAdmin, permissions, descendants }`
5. **Route handler** — `leadsRouter.get("/", ...)`:
   - Checks `hasPermission(req.user, PERMISSIONS.LEADS.READ)` (or MANAGE)
   - Resolves scope: `own` / `team` / `all` based on query and permissions
   - Builds filter (e.g. `assignedToUserId: req.user.id` for own)
   - `LeadModel.find(filter).populate(...).sort(...).limit(100).lean()`
6. **Response** — `res.json(leads)`
7. **errorHandler** — If any middleware/route throws, `errorHandler` catches and returns JSON error
8. **requestLogger** — `res.on("finish")` logs completion

---

### 4. Entry Points

| Entry Point | File | What Runs |
|-------------|------|-----------|
| **Backend server** | `backend/src/server.ts` | Starts HTTP server and MongoDB |
| **Frontend** | `crm_frontend/src/main.tsx` | Mounts React app; `createRoot(...).render(<App />)` |
| **Frontend routing** | `crm_frontend/src/App.tsx` | Wraps in QueryClient, ThemeProvider, AuthProvider; routes: `/`, `/properties`, `/settings/module-builder`, `/setup/fields`, `*` (NotFound) |
| **Main CRM UI** | `crm_frontend/src/pages/Index.tsx` | Renders `ProfessionalCRM` (all views: dashboard, leads, calls, etc.) |

**Server boot sequence (server.ts):**

1. `import "dotenv/config"`
2. Set mongoose connection event listeners (error, disconnected, reconnected)
3. `mongoose.connect(config.mongoUri)`
4. `ensureDefaultPipeline()` — ensures default pipeline exists
5. `ensureDefaultProfiles()` — ensures default profiles exist
6. `seedAllocationConfig(orgId)` — seeds allocation config for default org
7. `createServer(app)` — creates HTTP server
8. `initializeWebSocket(httpServer)` — attaches Socket.IO
9. `httpServer.listen(config.port)` — starts listening
10. `initializeImapListeners()` — starts IMAP push listeners for email
11. Side-effect: `import "./jobs/scheduler"` — registers all cron jobs when module loads

**App.ts boot (app.ts):**

- Registers all routers (auth, users, leads, etc.)
- At end: `FollowupService.initialize()` and `initializeWorkflowEngine()` — bind event listeners

---

## PART 2: DATABASE ARCHITECTURE

### 1. Mongoose Models (Collection Names)

Mongoose uses pluralized lowercase for collection names (e.g. `Lead` → `leads`).

| Model | File | Collection | Description | Key Fields |
|-------|------|------------|-------------|------------|
| Account | `models/account.ts` | accounts | Business partners (agents, corporates) | name, type, parentAccountId, conglomerateId |
| AccountPotential | `models/accountPotential.ts` | accountpotentials | Revenue potential per account | accountId, city, year, segment |
| ActivityLog | `models/activityLog.ts` | activitylogs | User activity audit | userId, type, createdAt |
| AgentDailyWorkload | `models/agentDailyWorkload.ts` | agentdailyworkloads | Daily lead counts per agent | orgId, agentId, date |
| AllocationConfig | `models/allocationConfig.ts` | allocationconfigs | Org-level allocation settings | orgId, key, value |
| AllocationRoutingRule | `models/allocationRoutingRule.ts` | allocationroutingrules | V2 allocation routing | orgId, priority, conditions |
| AuditLog | `models/auditLog.ts` | auditlogs | Entity change audit | orgId, entity_type, entity_id |
| CallQualityDimension | `models/callQualityDimension.ts` | callqualitydimensions | Call quality scoring dimensions | name, weight |
| CallQualityScore | `models/callQualityScore.ts` | callqualityscores | Call quality scores per lead | leadId, scored_by |
| Communication | `models/communication.ts` | communications | Unified comm log (calls, email, SMS) | leadId, channel, direction |
| Conglomerate | `models/conglomerate.ts` | conglomerates | Group of accounts | name, country, region |
| Contact | `models/contact.ts` | contacts | Account contacts | accountId, name, email |
| CustomField | `models/customField.ts` | customfields | Dynamic field definitions | entity_type, slug, dataType |
| DashboardWidget | `models/dashboardWidget.ts` | dashboardwidgets | Dashboard widget configs | orgId, widgetKey |
| DataSharingRule | `models/dataSharingRule.ts` | datasharingrules | Role/group sharing rules | module, fromType, toType, accessLevel |
| EmailAccount | `models/emailAccount.ts` | emailaccounts | User email accounts (Gmail, Outlook) | userId, email, provider |
| EmailMessage | `models/emailMessage.ts` | emailmessages | Synced email messages | emailAccountId, threadId |
| EmailSettings | `models/emailSettings.ts` | emailsettings | Org email settings | orgId |
| EmployeeGroup | `models/employeeGroup.ts` | employeegroups | Teams (e.g. Sales, Reservations) | memberUserIds, memberRoleIds |
| FollowupRule | `models/followupRule.ts` | followuprules | Follow-up task schedules per bucket | bucket, offset_hours/days |
| Guest | `models/guest.ts` | guests | Individual customers | name, phone, email |
| HotelBrand | `models/hotelBrand.ts` | hotelbrands | Hotel brand definitions | name |
| IntegrationConfig | `models/integrationConfig.ts` | integrationconfigs | Org integration configs | orgId, provider |
| KnowledgeBase | `models/knowledgeBase.ts` | knowledgebases | Knowledge articles | propertyId, type |
| Lead | `models/lead.ts` | leads | Sales opportunities | guestId, propertyId, stageId, score |
| LeadActivity | `models/leadActivity.ts` | leadactivities | Lead audit trail | leadId, type, performedAt |
| LeadAssignmentRule | `models/leadAssignmentRule.ts` | leadassignmentrules | Legacy lead-type → group rules | leadType, employeeGroupId |
| LeadItinerary | `models/leadItinerary.ts` | leaditineraries | Multi-hotel line items per lead | leadId, hotelName, checkInDate |
| LeadWorkflowState | `models/leadWorkflowState.ts` | leadworkflowstates | Legacy workflow state per lead | leadId, workflowId |
| ModuleDefaultAccess | `models/moduleDefaultAccess.ts` | moduledefaultaccesses | Default access (private/public) | module, defaultAccess |
| Notification | `models/notification.ts` | notifications | User notifications | userId, type |
| PendingWorkflowAction | `models/pendingWorkflowAction.ts` | pendingworkflowactions | Delayed workflow actions | execute_at, status |
| PaymentLink | `models/paymentLink.ts` | paymentlinks | Payment links per lead | leadId, amount |
| Pipeline | `models/pipeline.ts` | pipelines | Pipeline definitions (leads) | module, isDefault |
| PipelineStage | `models/pipelineStage.ts` | pipelinestages | Stages within pipeline | pipelineId, order, mandatory_fields |
| Profile | `models/profile.ts` | profiles | Permission profiles (Zoho-style) | modulePermissions, setupPermissions |
| Property | `models/property.ts` | properties | Hotels/properties | name, pmsProvider, pmsConfig |
| Quotation | `models/quotation.ts` | quotations | Price quotes per lead | leadId, version |
| Region | `models/region.ts` | regions | Geographic regions | name |
| Reservation | `models/reservation.ts` | reservations | Confirmed bookings | guestId, propertyId, pmsReservationId |
| Role | `models/role.ts` | roles | Org hierarchy (reportsTo) | name, parentRoleId |
| SavedFilter | `models/savedFilter.ts` | savedfilters | User saved filters | orgId, entity_type |
| ScoringRule | `models/scoringRule.ts` | scoringrules | Lead scoring rules | module, conditions, points |
| ScoringThreshold | `models/scoringThreshold.ts` | scoringthresholds | Hot/Warm/Cold buckets | orgId, min_score, max_score |
| Task | `models/task.ts` | tasks | Tasks/follow-ups | leadId, ownerUserId, dueAt |
| Template | `models/template.ts` | templates | Message templates | medium, body |
| Ticket | `models/ticket.ts` | tickets | Support tickets | assignedToUserId, status |
| TicketActivity | `models/ticketActivity.ts` | ticketactivities | Ticket activity log | ticketId |
| User | `models/user.ts` | users | Staff/employees | email, profileId, roleId, reportsTo |
| UserBuddyAssignment | `models/userBuddyAssignment.ts` | userbuddyassignments | Buddy coverage | userId, buddyUserId |
| UserDashboardConfig | `models/userDashboardConfig.ts` | userdashboardconfigs | User dashboard config | orgId, userId |
| UserRole | `models/userRole.ts` | userroles | Additional role assignments | userId, roleId |
| WebhookFieldMapping | `models/webhookFieldMapping.ts` | webhookfieldmappings | Webhook → lead field mapping | integrationConfigId |
| Workflow | `models/workflow.ts` | workflows | Legacy workflows | (legacy) |
| WorkflowV2 | `models/workflowV2.ts` | workflowv2s | Event-driven workflows | orgId, trigger_event |
| WorkflowCondition | `models/workflowV2.ts` | workflowconditions | Workflow conditions | workflowId, field_slug |
| WorkflowAction | `models/workflowV2.ts` | workflowactions | Workflow actions | workflowId, action_type |
| WorkflowExecutionLog | `models/workflowExecutionLog.ts` | workflowexecutionlogs | Workflow run logs | workflowId, leadId |

---

### 2. Model Relationships

| From | To | Field | Type |
|------|----|-------|------|
| Lead | Guest | guestId | many-to-one |
| Lead | Account | accountId | many-to-one |
| Lead | Property | propertyId | many-to-one |
| Lead | User | assignedToUserId | many-to-one |
| Lead | PipelineStage | stageId | many-to-one |
| Lead | Property/Account | orgId | many-to-one (org) |
| LeadItinerary | Lead | leadId | many-to-one |
| LeadActivity | Lead | leadId | many-to-one |
| LeadActivity | User | performedByUserId, toUserId, fromUserId | many-to-one |
| Communication | Lead | leadId | many-to-one |
| Communication | Guest | guestId | many-to-one |
| Task | Lead | leadId | many-to-one |
| Task | User | ownerUserId | many-to-one |
| Quotation | Lead | leadId | many-to-one |
| PaymentLink | Lead | leadId | many-to-one |
| Reservation | Lead | (via pmsReservationId) | — |
| Reservation | Guest | guestId | many-to-one |
| Reservation | Property | propertyId | many-to-one |
| User | Role | roleId | many-to-one |
| User | Profile | profileId | many-to-one |
| User | User | reportsTo | many-to-one |
| User | EmployeeGroup | groupIds | many-to-many |
| EmployeeGroup | User | memberUserIds | many-to-many |
| WorkflowV2 | (org) | orgId | many-to-one |
| WorkflowCondition | WorkflowV2 | workflowId | many-to-one |
| WorkflowAction | WorkflowV2 | workflowId | many-to-one |
| CustomField | PipelineStage | mandatory_at_stage_id | many-to-one |
| DataSharingRule | Role/EmployeeGroup | fromId, toId | references |

---

### 3. Indexes (Key Ones)

| Model | Indexed Fields | Purpose |
|-------|----------------|---------|
| Lead | status, assignedToUserId+status, createdAt, tags | List/filter leads |
| LeadItinerary | leadId+checkInDate | Auto-closure, SMS follow-up |
| Task | ownerUserId+status+dueAt | Follow-up lists |
| Communication | leadId+createdAt | Timeline |
| Notification | userId+isRead+createdAt | Unread count |
| WorkflowV2 | orgId+trigger_event+is_active | Event triggers |
| PendingWorkflowAction | status+execute_at | Cron execution |
| CustomField | entity_type+slug (unique) | Field lookup |
| PipelineStage | pipelineId+order | Stage order |
| User | reportsTo, hierarchyPath, isOnline | Hierarchy, availability |
| Guest | phone, email | Duplicate detection |

---

### 4. Model Categories

| Category | Models |
|----------|--------|
| **Core** (everything depends on them) | User, Guest, Property, Account, Lead |
| **Engine** (configurable behavior) | CustomField, Pipeline, PipelineStage, ScoringRule, ScoringThreshold, FollowupRule, WorkflowV2, WorkflowCondition, WorkflowAction, LeadAssignmentRule, AllocationRoutingRule, AllocationConfig, DataSharingRule |
| **Log/Audit** | LeadActivity, ActivityLog, AuditLog, Communication, WorkflowExecutionLog |

---

## PART 3: AUTHENTICATION & AUTHORIZATION

### 1. Authentication End-to-End

**Login**

- **Endpoint:** `POST /auth/login`
- **File:** `backend/src/routes/auth.ts`
- **Flow:** Validates `email`, `password` (zod); finds `UserModel`; `bcrypt.compare(password, user.passwordHash)`; updates `lastLoginAt`, `isOnline`, `lastHeartbeatAt`; calls `signJwt({ id, email, roleId })`; returns `{ token, user }` with permissions from `AccessControlService.getUserPermissions(user.id)`.

**JWT Token Fields** (`middleware/auth.ts` — `signJwt`):

- `sub` — user ID
- `email`
- `roleId`
- `exp` — 12h expiry (from `expiresIn: "12h"`)

**Token Validation**

- **File:** `backend/src/middleware/auth.ts` — `requireAuth`
- **Flow:** Extracts token from `Authorization: Bearer <token>` or `?token=`; `jwt.verify(token, config.jwtSecret)`; loads user; checks `status === "ACTIVE"`; fetches permissions and descendants; sets `req.user`.

**Token Storage (Frontend)**

- **File:** `crm_frontend/src/services/api.ts`
- **Storage:** `window.localStorage.getItem("authToken")`; also in-memory `authToken`.

---

### 2. Authorization

**Role vs Profile vs Permissions**

- **Role** (`models/role.ts`): Represents hierarchy (`parentRoleId`, `reportsTo`). Used for org structure, not permissions.
- **Profile** (`models/profile.ts`): Defines what a user can do. Contains `modulePermissions` (view, create, edit, delete per module) and `setupPermissions` (e.g. `users.manage`).
- **Permissions**: Flat strings like `leads.read`, `leads.manage`. Computed from Profile by `AccessControlService.getUserPermissions()`.

**Permission Check Flow**

1. `hasPermission(user, "leads.read")` — true if `user.isAdmin` or `user.permissions.includes("leads.read")`.
2. For resource-level checks: `AccessControlService.hasPermission(user, "leads", "read", { ownerId })` — evaluates scope (own, region, global) and ownership / descendants.

**GET /leads Permission Trace**

1. `leadsRouter.use(requireAuth)` — ensures `req.user` is set.
2. Handler checks `hasPermission(req.user, PERMISSIONS.LEADS.READ)` or MANAGE; otherwise `forbidden()`.
3. Scope logic: `own` → filter `assignedToUserId = req.user.id`; `team` → `getTeamMemberIdsForRoleOwner(req.user.id)` and filter `$in`; `all` → no assignee filter (admin/manage only).
4. For single lead (`GET /leads/:id`): `assertLeadAccess(req.user, lead)` — calls `AccessControlService.hasPermission(user, "leads", "read", { ownerId: lead.assignedToUserId })`.

**AccessControlService** (`services/auth/AccessControlService.ts`)

- `getUserPermissions(userId)` — loads Profile, builds flat permissions from modulePermissions and setupPermissions.
- `getDescendants(userId)` — recursively finds users who report to this user.
- `hasPermission(user, resource, action, dataContext)` — checks ownership, region, descendants.

**DataSharingRule** (`models/dataSharingRule.ts`, `DataSharingService`)

- Rules: "from" role/group shares with "to" role/group at `read` | `read_write` | `full`.
- `DataSharingService.getEffectiveAccess()` — determines if user A can access user B’s record in a module.

---

### 3. No Role / No Profile

- **No Profile:** `getUserPermissions` returns `{ permissions: [], isAdmin: false }`. User effectively has no feature access.
- **No Role:** Hierarchy/reportsTo may be empty; `getDescendants` returns `[]`. "Team" scope yields empty lead list.

---

## PART 4: THE 7 CONFIGURABLE ENGINES

### E1: Field Builder

- **Problem:** Dynamic custom fields per entity (lead, contact, account).
- **Models:** `CustomField` (`customFields` collection).
- **Service:** `routes/customFields.ts`, `routes/adminFields.ts`; field values stored in `Lead.customData` (Map).
- **Trigger:** Admin configures in Field Builder UI.
- **Flow:** CustomField defines `slug`, `dataType`, `options`; PipelineStage can require fields via `mandatory_fields_json`.
- **Config vs Auto:** Admin defines fields; system validates and stores in `customData`.

---

### E2: Pipeline Builder

- **Problem:** Configurable stages (e.g. New → Contacted → Quoted → Won/Lost).
- **Models:** `Pipeline`, `PipelineStage`.
- **Service:** `validateStageMove()` in `leadService.ts`; routes: `pipelines.ts`, `leadWorkflow.ts`.
- **Trigger:** User moves lead via PATCH /leads/:id with `stageId`; or workflows.
- **Flow:** `validateStageMove()` checks terminal stage (cannot leave), mandatory fields for target stage. On success, `lead.stageId` updated; `lead.stage_moved` emitted.
- **Config vs Auto:** Admin configures stages and mandatory fields; system enforces gates.

---

### E3: Lead Scoring Engine

- **Problem:** Score leads 0–10 and bucket (Hot/Warm/Cold).
- **Models:** `ScoringRule`, `ScoringThreshold`.
- **Service:** `scoringService.ts` — `calculateScoreForLead()`, `evaluateThreshold()`.
- **Trigger:** On lead create; on PATCH when recalculating; explicit rescore; `lead.rescored` emitted for follow-up engine.
- **Flow:** Load active ScoringRules; evaluate conditions (AND/OR); sum points; clamp 0–10; lookup ScoringThreshold for bucket and color.
- **Config vs Auto:** Admin defines rules and thresholds; system calculates automatically.

---

### E4: Follow-up Rule Engine

- **Problem:** Schedule follow-up tasks based on bucket (Hot/Warm/Cold).
- **Models:** `FollowupRule`, `Task`.
- **Service:** `followupService.ts` — `generateFollowupTasks()`.
- **Trigger:** On lead creation (async after create); on `lead.rescored`.
- **Flow:** Cancels existing OPEN follow-up tasks; loads FollowupRules for bucket; creates Tasks with `dueAt = baseTime + offset_hours/days`.
- **Config vs Auto:** Admin configures offset per bucket; system creates tasks. Cron (`runFollowupMissedJob`) emits `lead.followup_missed` when overdue.

---

### E5: Workflow / Automation Engine

- **Problem:** Event-driven automation (send email, move stage, assign, etc.).
- **Models:** `WorkflowV2`, `WorkflowCondition`, `WorkflowAction`, `PendingWorkflowAction`, `WorkflowExecutionLog`.
- **Service:** `workflowEngine.ts` — `registerTrigger()`, `executeAction()`, `processPendingWorkflowActions()`.
- **Trigger:** Events: `lead.created`, `lead.stage_moved`, `lead.rescored`, `lead.field_changed`, `lead.unattended`, `lead.followup_missed`, `lead.followup_missed_count`, `agent.capacity_warning`, `lead.overflow_queued`, `lead.inactive_warning`, `lead.inactive_critical`, `scheduled`.
- **Flow:** `leadEventBus.on(event, registerTrigger)`; `registerTrigger` finds workflows by trigger_event, evaluates conditions, creates PendingWorkflowAction for delayed steps or executes immediately.
- **Config vs Auto:** Admin builds workflows in WorkflowBuilder; system runs on events. Cron every 2 min processes pending actions.
- **Limitation:** `generate_report` action is not implemented.

---

### E6: Allocation Rule Engine

- **Problem:** Assign leads to agents (round-robin, capacity, rules).
- **Models:** `LeadAssignmentRule`, `AllocationRoutingRule`, `AllocationConfig`, `EmployeeGroup`.
- **Service:** `assignmentService.ts` — `tryV2Assignment()`, `autoAssignLead()`; `allocationService.ts` — workload, capacity alerts.
- **Trigger:** On lead create when `assignmentMode === "auto"`; manual override available.
- **Flow:** Tries V2 routing rules first; falls back to legacy LeadAssignmentRule (leadType → group → least-loaded user); buddy resolution if assignee on leave.
- **Config vs Auto:** Admin configures rules; system assigns. Capacity alerts emit `agent.capacity_warning`.

---

### E7: Infrastructure (Filters, Audit, Integrations, Dashboard)

- **Filters:** `SavedFilter`; routes `api/filters`.
- **Audit:** `AuditLog`; `logAudit()` in `utils/auditLog.ts`; routes `api/admin/audit-log`.
- **Integrations:** `IntegrationConfig`, `WebhookFieldMapping`; routes `api/admin/integrations`, `webhook/intake`.
- **Dashboard:** `DashboardWidget`, `UserDashboardConfig`; routes `api/dashboard`.

---

## PART 5: LEAD LIFECYCLE

### 1. Lead Creation

- **Handler:** `POST /leads` in `routes/leads.ts` → `createLead()` in `leadService.ts`.
- **Validation:** `leadCreateSchema` (zod): guestId/guestContact, propertyId, source, leadType, etc.
- **Immediate after save (first ~5 seconds):**
  1. Resolve/create Guest (phone/email dedupe).
  2. Duplicate check: reject if active lead exists for same guest.
  3. Resolve propertyId, accountId.
  4. `performAssignment()` — V2 or legacy rules.
  5. `calculateLeadScore()` + `evaluateThreshold()`.
  6. `generateTagsForLead()`.
  7. Default stage from default pipeline.
  8. `LeadModel.create()`.
  9. Create LeadItinerary if hotels provided.
  10. `FollowupService.generateFollowupTasks()` (async).
  11. Update guest `totalLeadsCount`, `lastSeenAt`.
  12. `LeadActivityModel.create(LEAD_CREATED)`.
  13. `leadEventBus.emit("lead.created")`.
  14. If assigned: `LeadActivityModel.create(AUTO_ASSIGNED/MANUAL_ASSIGNED)`, `notifyLeadAssigned()`, `initializeWorkflowForLead()`.
  15. If overflow: `leadEventBus.emit("lead.overflow_queued")`.
  16. `incrementAgentWorkload()`, `checkCapacityAlerts()`.
- **Assignment trace:** `performAssignment` → manual path or `tryV2Assignment` or `autoAssignFromRules` → `getUserWithLeastLeads` → `resolveAssigneeWithBuddy`.
- **New lead score:** From `ScoringService.calculateScoreForLead(initialLeadState)` using active ScoringRules; bucket from `evaluateThreshold()`.

---

### 2. Lead Update

- **Handler:** `PATCH /leads/:id` in `routes/leads.ts`.
- **Updatable fields:** status, heatLevel, callStatus, notes, assignedToUserId, stageId, contactDetails, customData, hotels.
- **Stage change:** `validateStageMove()`; if allowed, update `stageId`, log audit, `leadEventBus.emit('lead.stage_moved')`.
- **Custom field change:** `customData` merged; `lead.field_changed` emitted for each changed key.
- **Events on update:** `lead.stage_moved` (if stage changed); `lead.field_changed` (for changed fields including customData).

---

### 3. Lead Scoring

- **Trigger:** Lead create; PATCH recalc; explicit rescore.
- **Flow:** `ScoringService.calculateScoreForLead(leadData)` — load rules, evaluate conditions, sum points, clamp 0–10. `evaluateThreshold(orgId, score)` → bucket, color. If changed, save and emit `lead.rescored`.
- **Bucket:** From ScoringThreshold or defaults (≥7 Hot, ≥4 Warm, else Cold).
- **After scoring:** `lead.rescored` triggers FollowupService to regenerate follow-up tasks.

---

### 4. Follow-up Scheduling

- **Trigger:** `lead.rescored`; also on lead creation (async).
- **Flow:** `FollowupService.generateFollowupTasks(leadId, bucket, orgId)` — cancel OPEN follow-up tasks; load FollowupRules; create Tasks with dueAt.
- **Due time:** `baseTime + offset_hours` or `baseTime + offset_days`.
- **Missed:** Cron `runFollowupMissedJob` finds overdue tasks, increments `missed_followup_count`, emits `lead.followup_missed` and `lead.followup_missed_count` (if ≥2).

---

### 5. Stage Movement

- **Trigger:** User PATCH or workflow `move_stage` action.
- **validateStageMove:** Checks terminal (cannot leave), mandatory fields for target stage.
- **Rejected:** 422 with reason (`already_terminal`, `missingFields`).
- **Success:** Update stageId; emit `lead.stage_moved`.

---

### 6. Lead Closure

- **How:** PATCH status to `CONFIRMED`, `LOST`, or `CLOSED_AUTO`; `closedAt` set.
- **Required:** No explicit validation; business rules may require fields.
- **Tasks/follow-ups:** No automatic cancellation on closure. Workflows can use `cancel_pending_tasks` action.

---

## PART 6: EVENT SYSTEM

### 1. EventEmitter

```typescript
// backend/src/services/leadService.ts
import { EventEmitter } from "events";
export const leadEventBus = new EventEmitter();
```

---

### 2. Event Map

| Event | Emitted In | Payload | Listener | Listener Action |
|-------|------------|---------|----------|-----------------|
| `lead.created` | leadService.ts:608 | leadId, leadNumber, orgId | workflowEngine | registerTrigger → run workflows |
| `lead.overflow_queued` | leadService.ts:693 | leadId, leadNumber, orgId | workflowEngine | registerTrigger |
| `lead.stage_moved` | leads.ts:422, inactiveLeadMonitor:123 | leadId, fromStageId, toStageId | workflowEngine | registerTrigger |
| `lead.field_changed` | leads.ts:514,518 | leadId, field_slug, old_value, new_value, orgId | workflowEngine | registerTrigger |
| `lead.rescored` | scoringService.ts:66 | leadId, score, bucket, orgId | followupService, workflowEngine | generateFollowupTasks, registerTrigger |
| `lead.followup_missed` | scheduler.ts:127 | leadId, taskId, orgId, missed_count | workflowEngine | registerTrigger |
| `lead.followup_missed_count` | scheduler.ts:135 | leadId, orgId, count | workflowEngine | registerTrigger |
| `lead.unattended` | scheduler.ts:165 | leadId, orgId, minutes_idle | workflowEngine | registerTrigger |
| `lead.inactive_warning` | inactiveLeadMonitor:89 | leadId, leadNumber, orgId | workflowEngine | registerTrigger |
| `lead.inactive_critical` | inactiveLeadMonitor:97 | leadId, leadNumber, orgId | workflowEngine | registerTrigger |
| `agent.capacity_warning` | allocationService.ts:200 | (capacity warning) | workflowEngine | registerTrigger |
| `scheduled` | scheduler.ts:236 | workflowId, leadId, orgId | workflowEngine | registerTrigger |

---

### 3. Error Handling in Listeners

- WorkflowEngine: `registerTrigger(...).catch((err) => logger.error(...))` — errors logged, not rethrown.
- FollowupService: `try/catch` with `logger.error` in `lead.rescored` handler.
- Node EventEmitter: If a listener throws, it can break the emit chain unless wrapped; WorkflowEngine wraps in `.catch()`.

---

### 4. Orphan Events / Listeners

- All listed events have listeners (workflowEngine and/or followupService).
- `scheduled` is emitted by cron, not by lead events; workflows with trigger `scheduled` listen for it.

---

## PART 7: CRON JOBS & BACKGROUND PROCESSING

### 1. Registration

- **File:** `backend/src/jobs/scheduler.ts` — `setupJobs()` called at import (line 436).
- **Import:** `server.ts` imports `"./jobs/scheduler"` (side-effect).

---

### 2. Cron Jobs

| Job | Schedule | Function | What It Does |
|-----|----------|----------|--------------|
| Auto-closure | `0 * * * *` (hourly) | runAutoClosureJob | Leads with check-in tomorrow and no response → CLOSED_AUTO |
| Reminder | `*/5 * * * *` | runReminderJob | Overdue OPEN tasks → update popupState, log REMINDER_TRIGGERED |
| Workflow (legacy) | `*/15 * * * *` | runWorkflowJob | processPendingWorkflowSteps (legacy) |
| Pending workflow actions | `*/2 * * * *` | processPendingWorkflowActions | Executes due PendingWorkflowActions |
| Followup missed | `*/5 * * * *` | runFollowupMissedJob | Overdue follow-up tasks → emit lead.followup_missed |
| Lead unattended | `*/15 * * * *` | runLeadUnattendedJob | Emit lead.unattended for idle leads (30m, 12h) |
| Scheduled workflows | `* * * * *` | runScheduledWorkflowsJob | Cron-based workflows on leads in Payment stage |
| Email sync | `*/5 * * * *` | runEmailSyncJob | syncEmails for non-IMAP accounts |
| SMS follow-up | `0 10 * * *` | runSMSFollowUpJob | Send SMS to QUOTATION_SHARED/PAYMENT_PENDING leads |
| Ezee sync | `*/30 * * * *` | syncEzeeReservations | Pull reservations from Ezee PMS |
| Inactive lead monitor | `*/30 * * * *` | checkInactiveLeads | Threshold-based inactive warnings/critical; optional auto_lost |

---

### 3. Pending Workflow Actions

- **Model:** `PendingWorkflowAction` — `execute_at`, `status`, `lead_context_snapshot`.
- **Create:** When workflow action has `delay_minutes > 0` — `registerTrigger` creates PendingWorkflowAction.
- **Execute:** Cron every 2 min calls `processPendingWorkflowActions()` — finds `status: "pending"`, `execute_at <= now`, runs `executeAction`, updates status to completed/failed.
- **Retry:** No retry on failure; status set to `failed`, error stored.

---

## PART 8: COMMUNICATION LAYER

### 1. Channels

| Channel | Status | Service | External API | Current Behavior |
|---------|--------|---------|--------------|------------------|
| Email | Implemented | emailService (Gmail/Outlook), communicationService | Google/Microsoft APIs | Sends via user's connected account; IMAP IDLE for inbound |
| SMS | Placeholder | smsService (PlaceholderSMSProvider) | — | Logs only; no real send |
| WhatsApp | Placeholder | communicationService.sendWhatsApp | — | Creates Communication record only |
| In-App | Implemented | NotificationModel, notificationService | Socket.IO | Real-time to user rooms |

---

### 2. Unified Timeline

- **Model:** `Communication` (leadId, channel, direction, summary, messageContent).
- **Service:** `getCommunicationTimeline(leadId)` in `communicationService.ts` — merges Communications and EmailMessages (linked to lead), sorts by date.
- **Frontend:** Lead detail page fetches `/leads/:id/communication-timeline` and displays merged timeline.

---

### 3. Template System

- **Model:** `Template` — body with `{{field_slug}}` placeholders.
- **Resolution:** `workflowEngine.resolveTemplateVariables(templateBody, leadContext)` — regex `/\{\{([a-zA-Z0-9_]+)\}\}/g`, replaces with `leadContext[slug]`.
- **Example:** `Hello {{lead_name}}, your stay at {{property_name}}` → context built from lead, guest, property.

---

## PART 9: PMS INTEGRATION (EZEE)

### 1. Files

- `backend/src/services/pms/IPMSService.ts` — interface
- `backend/src/services/pms/adapters/EzeePMSService.ts` — Ezee implementation
- `backend/src/services/pms/PMSFactory.ts` — factory
- `backend/src/jobs/ezeeSync.ts` — sync job
- `backend/scripts/seedEzeeProperties.ts` — seed script
- `backend/src/routes/pms.ts` — API routes
- `backend/src/models/property.ts` — pmsConfig (hotelCode, authCode)

---

### 2. EzeePMSService

- **Base URL:** `https://live.ipms247.com/pmsinterface`
- **Methods:**
  - `getInventory(startDate, endDate)` — XML to getdataAPI.php, Request_Type: Inventory
  - `getRates(startDate, endDate)` — XML to getdataAPI.php, Request_Type: Rate
  - `createBooking(bookingDetails)` — JSON to pms_connectivity.php, BookingRecdNotification
  - `cancelBooking(pmsBookingId)` — JSON, Status: Cancel
  - `getReservations(hotelCode, authCode, fromDate, toDate)` — JSON to pms_connectivity.php, Request_Type: Bookings (date filter client-side)

---

### 3. Property ↔ Ezee

- `Property.pmsProvider = "EZEE"`
- `Property.pmsConfig = { hotelCode, authCode, username }`

---

### 4. Sync Mechanism

- **Direction:** Pull only (Ezee → CRM).
- **Trigger:** Cron every 30 min; or "Sync Now" calls sync endpoint.
- **Flow:** `syncEzeeReservations()` — finds properties with pmsConfig; fetches reservations; creates/updates Reservation and Guest as needed.

---

### 5. Missing for Full Bidirectional

- Push CRM → Ezee for new bookings (createBooking exists but not wired to lead→reservation flow).
- Real-time webhooks from Ezee.
- Conflict resolution (Ezee vs CRM as source of truth).
- Rate/inventory push to Ezee.

---

## PART 10: FRONTEND ARCHITECTURE

### 1. Structure

- **Routing (App.tsx):** `/` (Index), `/properties`, `/settings/module-builder`, `/setup/fields`, `*` (NotFound).
- **Index** renders `ProfessionalCRM` — view state in `activeView` (dashboard, leads, followups, settings, etc.), not URL-based.
- **Pages vs components:** `pages/` = route-level; `components/` = reusable; ProfessionalCRM switches content by `activeView`.

---

### 2. API Communication

- **Client:** Native `fetch`; `API_BASE_URL` from `VITE_API_BASE_URL` or `http://localhost:4000` (`services/api.ts`).
- **Auth:** `withAuthHeaders()` adds `Authorization: Bearer <token>`.
- **401:** Global fetch interceptor checks for `TOKEN_EXPIRED`/`INVALID_TOKEN`; clears token, redirects to `/login?message=session_expired`.

**Note:** AuthContext uses `VITE_API_URL` for `/auth/me`; api.ts uses `VITE_API_BASE_URL` — potential env mismatch.

---

### 3. State Management

- **React Query:** Used for server state (leads, tasks, etc.) via `useQuery`/`useMutation` in components.
- **useState:** Local UI state (tabs, modals, form values).
- **Context:** `AuthContext` (user, login, logout, can).
- **No Redux/global store.**

---

### 4. Permissions on Frontend

- `useAuth().can(permission)` — checks `user.permissions` and `user.isAdmin`; `*.manage` implies sub-permissions.
- Routes are not protected by permission; ProfessionalCRM shows/hides views with `canManageLeads`, `canManageUsers`, etc. A user could hit an API directly; backend enforces permissions.

---

### 5. Major Pages / Components

| View | Data | Actions |
|------|------|---------|
| Dashboard | Reports, widgets | Navigate to leads, view lead |
| ProfessionalLeadManagement | Leads (scope-based) | Create, filter, assign |
| LeadDetailPage | Lead, activities, timeline, tasks | Update, add note, send email |
| TodaysFollowUps | Tasks (due today) | Complete, view lead |
| WorkflowBuilder | Workflows, pipelines | Create/edit workflows |
| ScoringEngine | Scoring rules | Create, reorder |
| FollowupRules | Follow-up rules | CRUD |
| PipelineBuilder | Pipelines, stages | CRUD |
| FieldBuilder | Custom fields | CRUD |
| Settings (Profiles, Roles, Groups, DataSharing) | Profiles, roles, etc. | CRUD |

---

## PART 11: KNOWN ISSUES & TECHNICAL DEBT

### 1. TODO / FIXME / Placeholder

| File | Context | What's Missing |
|------|---------|----------------|
| backend/services/smsService.ts | PlaceholderSMSProvider | Actual SMS provider (Twilio, Msg91) |
| backend/services/communicationService.ts | sendSMS, sendWhatsApp | Real SMS/WhatsApp integration |
| backend/services/guestSearchService.ts | searchExternalGuest | External DB search |
| backend/services/workflowEngine.ts | generate_report action | Implementation |
| backend/controllers/profileController.ts | Delete profile | Check if users assigned before delete |
| backend/routes/quotations.ts | sentVia WHATSAPP | WhatsApp sending |
| backend/routes/paymentLinks.ts | Payment confirmation | Trigger confirmation letter |
| backend/routes/dashboard.ts | Some widget | Returns `{ data: [], message: "TODO" }` |

---

### 2. Hardcoded Values

| File | Value | Should Be |
|------|-------|-----------|
| backend/routes/leads.ts:703 | orgId `"69ae144fae23030b62f901f5"` | From lead/org context |
| crm_frontend AuthContext | `VITE_API_URL` | Align with `VITE_API_BASE_URL` |
| backend/config/env | Various | From env vars |

---

### 3. Silent / Swallowed Errors

| File | Pattern | What's Hidden |
|------|---------|---------------|
| crm_frontend/services/properties.ts:108 | `response.json().catch(() => null)` | JSON parse errors |
| crm_frontend multiple | `response.json().catch(() => ({}))` | Parse errors, masks HTTP errors |
| crm_frontend/pages/setup/ScoringEngine.tsx | `updateRule(...).catch(() => {})` | Reorder failures |
| crm_frontend/fix.js | `catch (e) {}` | All errors |
| backend/utils/auditLog.ts | `catch` with logger | Audit write failures (non-fatal) |

---

### 4. Backend Endpoints Without Frontend

- Some admin/experimental routes may not have dedicated UI (e.g. raw webhook intake, some allocation APIs). Full audit not done.

---

### 5. Frontend Calling Non-Existent APIs

- No systematic mismatch found; paymentLinks placeholder noted.

---

### 6. Top 5 Production Risks

1. **SMS/WhatsApp placeholders** — "Send SMS" creates record but does not send; users may assume messages were delivered.
2. **orgId hardcode in call quality** — Single-tenant assumption can break multi-tenant.
3. **Silent JSON catch** — `response.json().catch(() => ({}))` can hide API errors and produce empty UIs.
4. **Event listener errors** — Uncaught throws in EventEmitter listeners can break event propagation.
5. **Env var mismatch** — `VITE_API_URL` vs `VITE_API_BASE_URL` can cause auth/API URL mismatches.

---

## PART 12: HOW TO ADD A NEW FEATURE

**Example: "Leads with budget over 1 lakh get VIP tag"**

1. **Model change:** None; use `Lead.tags` (array) or `customData`.
2. **Service:** `leadTaggingService.ts` — `generateTagsForLead()` already adds tags; add condition for `budget >= 100000` → push `"VIP"`. Or add a ScoringRule with high points and a tag action (if such action exists). **Better:** Add logic in `generateTagsForLead()`.
3. **Event:** Fires on lead create and could fire on update if budget changes. Tag generation runs in `createLead`; for updates, either call tagging on PATCH or use `lead.field_changed` workflow to `update_field` tag.
4. **Scoring vs workflow vs hardcode:** Scoring affects points and bucket, not tags. Workflow could `update_field` with slug `tags` if supported. **Best:** Extend `generateTagsForLead()` — simple, runs at create, and could be called from a "re-tag" flow.
5. **Frontend:** Lead list/detail already shows `lead.tags`; ensure "VIP" is rendered (e.g. badge).

---

## CHEAT SHEET

### 10 Most Important Files

1. `backend/src/server.ts` — Server entry, boot sequence
2. `backend/src/app.ts` — Express app, all routes
3. `backend/src/services/leadService.ts` — Lead CRUD, events, assignment
4. `backend/src/middleware/auth.ts` — Auth and permissions
5. `backend/src/services/workflowEngine.ts` — Event-driven automation
6. `backend/src/services/scoringService.ts` — Lead scoring
7. `backend/src/services/followupService.ts` — Follow-up tasks
8. `backend/src/jobs/scheduler.ts` — All cron jobs
9. `backend/src/routes/leads.ts` — Lead HTTP API
10. `crm_frontend/src/components/ProfessionalCRM.tsx` — Main CRM shell

### 5 Most Important Models

1. **Lead** — Central entity
2. **User** — Auth and assignment
3. **Guest** — Customer identity
4. **PipelineStage** — Stage and gates
5. **WorkflowV2** — Automation config

### Event Map (Compact)

| Event | Listeners |
|-------|-----------|
| lead.created | workflowEngine |
| lead.stage_moved | workflowEngine |
| lead.field_changed | workflowEngine |
| lead.rescored | followupService, workflowEngine |
| lead.followup_missed | workflowEngine |
| lead.followup_missed_count | workflowEngine |
| lead.unattended | workflowEngine |
| lead.inactive_warning | workflowEngine |
| lead.inactive_critical | workflowEngine |
| lead.overflow_queued | workflowEngine |
| agent.capacity_warning | workflowEngine |
| scheduled | workflowEngine |

### Lead Creation Sequence

1. Validate input (zod)
2. Resolve/create Guest (dedupe phone/email)
3. Duplicate lead check
4. Resolve propertyId, accountId
5. Perform assignment (V2 → legacy → manual)
6. Calculate score + bucket
7. Generate tags
8. Get default stage
9. Create Lead
10. Create LeadItinerary (if hotels)
11. FollowupService.generateFollowupTasks (async)
12. Update guest counts
13. LeadActivity (LEAD_CREATED)
14. Emit lead.created
15. If assigned: activity, notify, initializeWorkflow
16. If overflow: emit lead.overflow_queued
17. incrementAgentWorkload, checkCapacityAlerts

### When Something Breaks

| Symptom | Look At |
|---------|---------|
| Auth failing | auth.ts requireAuth, JWT secret, User.status |
| Lead not assigned | assignmentService, AllocationRoutingRule, EmployeeGroup |
| Score wrong | scoringService, ScoringRule conditions |
| Follow-ups not created | followupService, FollowupRule (bucket, org_id) |
| Workflow not firing | workflowEngine EVENT_MAP, trigger_event, conditions |
| Stage move rejected | validateStageMove, PipelineStage.mandatory_fields |
| 401 on frontend | api.ts token, VITE_API_BASE_URL, AuthContext |
| Cron not running | scheduler.ts import in server.ts, node-cron |

---

*Document generated from full codebase read. Last updated: 2025-03-22.*
