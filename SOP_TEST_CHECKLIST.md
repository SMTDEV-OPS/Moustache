# SOP Test Checklist — Postcard Lead Management

Step-by-step checklist to validate the system against the SOP document. For each item, test the behavior and note any **gaps**, **differences**, or **not configurable** findings. Fixes can be addressed afterward.

---

## Pre-requisites

- Backend running (`npm run dev` in `backend/`)
- Frontend running (`npm run dev` in `crm_frontend/`)
- MongoDB connected
- Seed data applied: `npm run seed:everything` (or `npx ts-node scripts/seedEverything.ts`)
- At least 2–3 users, 2 Employee Groups (B2B, B2C), Assignment Rules configured

---

## 1. Lead Management (LM) Module

### 1.1 Lead Capture Sources


| #     | SOP Requirement                                                    | Test Action                                                          | Status     | Notes                                                                                      |
| ----- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| 1.1.1 | **IVR/CTI** – Only leads where customer pressed 1 (Sales) captured | POST to `/api/public/ivr-webhooks` with `Digits=1`                   | ✅ Exists   | `ivrWebhooks.ts` – creates lead when `Digits === "1"`                                      |
| 1.1.2 | IVR – Recordings mapped to lead activity timeline                  | Create lead via IVR webhook with `RecordingUrl`; check lead activity | ⚠️ Partial | Recording URL saved in activity `metadata`; no UI to “pick calls” / play recordings        |
| 1.1.3 | **WhatsApp** – New leads from new customer outreach                | —                                                                    | ❌ Gap      | No WATI/WhatsApp inbound webhook; `sendWhatsApp` is placeholder only                       |
| 1.1.4 | **Website** – Form submissions create leads                        | POST to `/api/public/website-leads`                                  | ✅ Exists   | `websiteLeads.ts` – creates lead with source `BRAND_WEBSITE`                               |
| 1.1.5 | **Email** – Inbound email creates/links leads                      | Configure Gmail/Outlook; send test email                             | ⚠️ Partial | `processInboundEmailForLeads` exists; LLM-based extraction; integration method TBD per SOP |
| 1.1.6 | **Social Media**                                                   | —                                                                    | ❌ Gap      | No integration                                                                             |
| 1.1.7 | **Manual Entry**                                                   | Add Lead from CRM UI                                                 | ✅ Exists   | Lead create form with source dropdown                                                      |
| 1.1.8 | **CSV Upload**                                                     | Settings → Bulk CSV; upload CSV                                      | ✅ Exists   | `POST /leads/bulk-upload`; source `CSV_UPLOAD`                                             |


---

### 1.2 Lead Tagging


| #     | SOP Requirement                                                      | Test Action                           | Status   | Notes                                                           |
| ----- | -------------------------------------------------------------------- | ------------------------------------- | -------- | --------------------------------------------------------------- |
| 1.2.1 | City Name                                                            | Create lead with property; check tags | ✅ Exists | `leadTaggingService` – `City: {city}`                           |
| 1.2.2 | Property Name                                                        | Same                                  | ✅ Exists | `Property: {name}`                                              |
| 1.2.3 | Customer Type (B2C, B2B, Corporate, Influencer, NRI, HNI, Reference) | Set `customer_type` in customData     | ✅ Exists | Tagged as raw value                                             |
| 1.2.4 | Travel Dates                                                         | Set check-in date; check tags         | ✅ Exists | `Travel: < 7 Days`, `7-30 Days`, `30+ Days`, or `Yet to decide` |
| 1.2.5 | Minimum Budget                                                       | Set budget; check tags                | ✅ Exists | `Budget: < 20k`, `20k-50k`, `> 50k`                             |
| 1.2.6 | Lead Source                                                          | Create lead; check tags               | ✅ Exists | `Source: {source}`                                              |
| 1.2.7 | Booking Window                                                       | Set `booking_window`; check tags      | ✅ Exists | `Window: {value}`                                               |


---

### 1.3 Lead Allocation Algorithm


| #     | SOP Requirement                                                                        | Test Action                                                             | Status         | Notes                                                                                             |
| ----- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| 1.3.1 | Round-robin to logged-in team members                                                  | Create leads; verify assignment rotation                                | ⚠️ Different   | Uses “least open leads” (min open count), not strict round-robin                                  |
| 1.3.2 | Allocation window 8 hrs from login; last 1 hr for follow-ups                           | Check `allocation_window_hours` in AllocationConfig                     | ✅ Configurable | Default 8; `daily_lead_cap` = 30                                                                  |
| 1.3.3 | B2B → B2B team; B2C → B2C team; Corporate → B2B; Influencer/NRI/HNI/Reference → B2C    | Create Assignment Rules in Setup; create leads with customer_type       | ✅ Exists       | V2 Assignment Rules with `customerType` conditions                                                |
| 1.3.4 | Daily limit 30 leads per person; skip when at cap                                      | Assign 30+ leads to one user; next lead should go elsewhere or overflow | ✅ Exists       | `daily_lead_cap` in AllocationConfig; `getAvailableAgents` filters by cap                         |
| 1.3.5 | Excess: unassigned initially; auto req-gathering message; scoring; HOT to working team | Create lead when all agents at cap; check overflow workflow             | ⚠️ Partial     | Overflow queue exists; `lead.overflow_queued` workflow sends WA (placeholder); assign after delay |
| 1.3.6 | Allocation criteria: max to who has minimum open leads                                 | Create leads; check assignment                                          | ✅ Exists       | `getUserWithLeastLeads`                                                                           |
| 1.3.7 | TL alert at 90% workload                                                               | Cross daily cap; check `agent.capacity_warning`                         | ✅ Exists       | `checkCapacityAlerts`; `alert_threshold_percent` = 90                                             |
| 1.3.8 | Optional: By City, By Segment                                                          | —                                                                       | ⚠️ Partial     | V2 rules can use custom fields; no pre-built City/Segment rules                                   |


---

### 1.4 Duplicate Handling


| #     | SOP Requirement                                                   | Test Action                                      | Status   | Notes                                       |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------ | -------- | ------------------------------------------- |
| 1.4.1 | Auto-detect via mobile + email                                    | Create lead with same phone/email as active lead | ✅ Exists | `createLead` rejects with duplicate message |
| 1.4.2 | Multiple property inquiries → merge under single master lead      | Create 2 leads same guest, different properties  | ❌ Gap    | No merge; duplicate blocked entirely        |
| 1.4.3 | Same product, different sources → add lead count, no product info | —                                                | ❌ Gap    | Not implemented                             |


---

### 1.5 Lead Bucketing (Smart Filters)


| #     | SOP Requirement                                                 | Test Action                                        | Status          | Notes                                                     |
| ----- | --------------------------------------------------------------- | -------------------------------------------------- | --------------- | --------------------------------------------------------- |
| 1.5.1 | Hot: Travel 7 days OR Revenue 50k+ OR Book within 5 hrs         | Configure ScoringRules; create leads; check bucket | ⚠️ Configurable | Need to add rules; defaults in seed may not match exactly |
| 1.5.2 | Warm: Travel 7–30 days OR Revenue 20k–50k OR Book within 24 hrs | Same                                               | ⚠️ Configurable | Same                                                      |
| 1.5.3 | Cold: Travel 30+ days OR Revenue <20k OR Yet to decide          | Same                                               | ⚠️ Configurable | Same                                                      |
| 1.5.4 | Pending Follow-ups                                              | Use lead list filter “pending followups”           | ✅ Exists        | Task-based filters                                        |
| 1.5.5 | Booked leads (upcoming check-ins 7 days, quarter, month)        | Filter by stage + date                             | ⚠️ Partial      | Stage filter exists; date filters may need SavedFilter    |
| 1.5.6 | Not Contacted – First contact pending                           | Filter by stage / first contact                    | ⚠️ Partial      | Depends on stage + `firstResponseAt`                      |
| 1.5.7 | By source, By deal size                                         | Use filters                                        | ✅ Exists        | Source filter; budget/deal size via custom fields         |


---

### 1.6 Source Attribution (Marketing)


| #     | SOP Requirement           | Test Action                          | Status | Notes                  |
| ----- | ------------------------- | ------------------------------------ | ------ | ---------------------- |
| 1.6.1 | UTM Parameters            | Pass UTMs in website/API; check lead | ❌ Gap  | No UTM storage on Lead |
| 1.6.2 | Ad IDs                    | Same                                 | ❌ Gap  | No ad ID fields        |
| 1.6.3 | Marketing channel mapping | —                                    | ❌ Gap  | Not implemented        |


---

### 1.7 Customer Journey Tracking


| #     | SOP Requirement                                                  | Test Action                                    | Status   | Notes                                                          |
| ----- | ---------------------------------------------------------------- | ---------------------------------------------- | -------- | -------------------------------------------------------------- |
| 1.7.1 | Unified timeline: Calls, WhatsApp, Emails, Notes, Follow-up Logs | Open lead detail; check communication/timeline | ✅ Exists | `getCommunicationTimeline`; activities; IVR stores in metadata |


---

### 1.8 Follow-up Scheduler


| #     | SOP Requirement                            | Test Action                        | Status       | Notes                                                            |
| ----- | ------------------------------------------ | ---------------------------------- | ------------ | ---------------------------------------------------------------- |
| 1.8.1 | Suggestions: Hot 3h, Warm 24h, Cold 3 days | Check UI / Followup Rules          | ⚠️ Different | Defaults: Hot 2h+5h, Warm 24h+48h, Cold 5 days                   |
| 1.8.2 | Auto-create follow-ups by bucket           | Create lead; verify tasks          | ✅ Exists     | `FollowupService.generateFollowupTasks`; FollowupRule per bucket |
| 1.8.3 | Hot: 2 FUs – 2h, 5h                        | Check FollowupRule                 | ✅ Exists     | Seeded                                                           |
| 1.8.4 | Warm: 2 FUs – 24h, 48h                     | Same                               | ✅ Exists     | Seeded                                                           |
| 1.8.5 | Cold: 1 FU – 5 days                        | Same                               | ✅ Exists     | Seeded                                                           |
| 1.8.6 | Follow-up reminders                        | Overdue task → check notifications | ✅ Exists     | `runReminderJob` every 5 min                                     |


---

### 1.9 Mandatory Data Control


| #     | SOP Requirement                                                                             | Test Action                         | Status          | Notes                                                      |
| ----- | ------------------------------------------------------------------------------------------- | ----------------------------------- | --------------- | ---------------------------------------------------------- |
| 1.9.1 | Customer Name, Mobile (+91 default), Property, Budget                                       | Move to stage with mandatory fields | ⚠️ Configurable | `PipelineStage.mandatory_fields_json`; seed may have empty |
| 1.9.2 | Follow-up setup, 1st Call, Call Update, Notes                                               | Same                                | ⚠️ Configurable | Add to mandatory_fields per stage                          |
| 1.9.3 | Lead closure reason – Won                                                                   | Move to Booked                      | ✅ Exists        | Terminal stage                                             |
| 1.9.4 | Lost – Sold out, Budget, Booked elsewhere (OTA, Website, Other), No Response, Policy issues | Move to Lost; select reason         | ✅ Exists        | `closure_reason` custom field; ClosedReason enum           |
| 1.9.5 | No Response only after 2 follow-ups                                                         | —                                   | ⚠️ Partial      | Can enforce via workflow or validation; not hardcoded      |


---

### 1.10 Lead Call Quality


| #      | SOP Requirement                                                    | Test Action                 | Status   | Notes                                     |
| ------ | ------------------------------------------------------------------ | --------------------------- | -------- | ----------------------------------------- |
| 1.10.1 | 8 parameters with weights (15%, 15%, 15%, 15%, 10%, 10%, 10%, 10%) | Check Call Quality setup    | ✅ Exists | `CallQualityDimension`; seed has 8 params |
| 1.10.2 | Editable weightage                                                 | Update dimension weight     | ✅ Exists | `weight_percent` configurable             |
| 1.10.3 | TL or above can score                                              | Use call quality scoring UI | ✅ Exists | Permission-based                          |


---

### 1.11 Lead Scoring


| #      | SOP Requirement                              | Test Action                                                   | Status          | Notes                                       |
| ------ | -------------------------------------------- | ------------------------------------------------------------- | --------------- | ------------------------------------------- |
| 1.11.1 | 0–10 model; Hot 7–10, Warm 4–6, Cold 0–3     | Create lead; check score & bucket                             | ✅ Exists        | ScoringThreshold; defaults match            |
| 1.11.2 | Inactive: 48h → Orange, 72h → Red, notify TL | Set threshold `inactive_hours_warning/critical`; wait or mock | ✅ Exists        | `inactiveLeadMonitor`; ScoringThreshold     |
| 1.11.3 | Travel Date urgency (0–3 pts)                | Add ScoringRule                                               | ⚠️ Configurable | Need rules for 0–10, 10–30, 30–60, 60+ days |
| 1.11.4 | Budget Fit (0–2)                             | Same                                                          | ⚠️ Configurable | Need rules                                  |
| 1.11.5 | Engagement (0–2)                             | Same                                                          | ⚠️ Configurable | Response rate logic may not exist           |
| 1.11.6 | Callback requested (0–1)                     | Same                                                          | ⚠️ Configurable | Need field + rule                           |
| 1.11.7 | Deal Size (0–2)                              | Same                                                          | ⚠️ Configurable | Need rules                                  |
| 1.11.8 | Cold: Auto Lost after 2× no response         | Set `auto_action: auto_lost` on Cold threshold                | ✅ Exists        | `inactiveLeadMonitor`                       |


---

## 2. Communication & Engagement Module


| #     | SOP Requirement                                | Test Action                         | Status     | Notes                                      |
| ----- | ---------------------------------------------- | ----------------------------------- | ---------- | ------------------------------------------ |
| 2.1.1 | WhatsApp two-way                               | Send WhatsApp from lead             | ❌ Gap      | Placeholder; no real WATI/API              |
| 2.1.2 | Req-gathering 30 min if unattended             | Workflow `lead_unattended` 30 min   | ⚠️ Partial | Workflow exists; WA not sent (placeholder) |
| 2.1.3 | Booking window choice (5h, 24h, Yet to decide) | Set in lead form                    | ✅ Exists   | Custom field                               |
| 2.1.4 | Auto follow-up WA if FU missed 3h (9–22)       | Workflow `followup_missed`          | ⚠️ Partial | Workflow exists; WA placeholder            |
| 2.1.5 | Payment links, booking confirmations on WA     | —                                   | ❌ Gap      | WA placeholder                             |
| 2.2   | WhatsApp Chat Bot (Sales/Post-Sales flow)      | —                                   | ❌ Gap      | Not implemented                            |
| 2.3   | Email two-way sync                             | Connect Gmail/Outlook; send/receive | ✅ Exists   | Email service + IMAP                       |
| 2.4   | Unified Inbox (Calls, WA, Email)               | Lead timeline                       | ⚠️ Partial | Calls/Email; WA only if sent (placeholder) |
| 2.5   | Template Library                               | Templates in Setup                  | ✅ Exists   | Template model                             |
| 2.6   | Marketing Broadcasts                           | —                                   | ❌ Gap      | No bulk broadcast                          |
| 2.7   | Mobile App                                     | —                                   | ❌ Gap      | Web only                                   |
| 2.8   | Post-Stay Feedback                             | —                                   | ❌ Gap      | Not implemented                            |


---

## 3. Booking & PMS Integration


| #     | SOP Requirement             | Test Action                       | Status     | Notes                                                |
| ----- | --------------------------- | --------------------------------- | ---------- | ---------------------------------------------------- |
| 3.1.1 | Ezee real-time booking sync | Run Ezee sync; check reservations | ✅ Exists   | `ezeeSync.ts`; cron 30 min                           |
| 3.1.2 | Map PMS bookings to leads   | Sync; check lead ↔ reservation    | ⚠️ Partial | Via guest/property; no explicit mapping UI           |
| 3.1.3 | Real-time price fetching    | Use PMS rate API                  | ✅ Exists   | EzeePMSService.getRates                              |
| 3.2   | Booking Data API two-way    | —                                 | ⚠️ Partial | Pull from Ezee; push exists but not wired end-to-end |


---

## 4. Automation & Workflow Module


| #     | SOP Requirement                                                           | Test Action                        | Status        | Notes                                                     |
| ----- | ------------------------------------------------------------------------- | ---------------------------------- | ------------- | --------------------------------------------------------- |
| 4.1.1 | New Lead (Live Call) – Auto update mobile, mandate                        | IVR webhook / workflow             | ✅ Exists      | IVR creates lead; workflow on mandate fill                |
| 4.1.2 | Missed Call – WA req-gathering                                            | Workflow                           | ⚠️ Partial    | Workflow exists; WA placeholder                           |
| 4.1.3 | Follow-ups by lead quality                                                | FollowupService                    | ✅ Exists      |                                                           |
| 4.1.4 | Notify sales for new assignment                                           | `lead.created` → assign → notify   | ✅ Exists      | `notifyLeadAssigned`                                      |
| 4.1.5 | Notify TL after 2 missed FUs                                              | Workflow `followup_missed_count`   | ✅ Exists      | `seedPostcardWorkflows`                                  |
| 4.1.6 | Notify TL+Manager if 12h unattended after 2 FUs                           | Workflow `lead_unattended` 720 min | ✅ Exists      |                                                           |
| 4.1.7 | Lead movement automation (New→1st Connect→Discussion→Payment→Booked/Lost) | Move stages; check workflows       | ✅ Exists      | Auto-move on mandate; hourly reminder for Payment Request |
| 4.1.8 | Reminder hourly if in Payment Request not closed                          | Scheduled workflow                 | ✅ Exists      | `scheduled` trigger                                       |
| 4.2   | Task allocation by TL                                                     | Assign task to user from lead      | ✅ Exists      | Task model; ownerUserId                                   |
| 4.3   | Escalation (1 FU→agent, 2 FU→TL, 12h→TL+Manager)                          | Trigger scenarios                  | ✅ Exists      | Workflows                                                 |
| 4.4   | Automated Follow-ups                                                      | —                                  | ⚠️ Next phase |                                                           |
| 4.5   | Not-Booked Data Extraction                                                | —                                  | ❌ Gap         | No periodic export                                        |


---

## 5. Dashboard & Monitoring


| #     | SOP Requirement                                                    | Test Action     | Status     | Notes                                           |
| ----- | ------------------------------------------------------------------ | --------------- | ---------- | ----------------------------------------------- |
| 5.1.1 | Leads, Won, Lost, Unallocated, Pipeline; timeline dropdown         | Dashboard       | ⚠️ Partial | Widgets exist; timeline/filters may need config |
| 5.1.2 | Open leads, Pending followups, Conversion, Revenue                 | Same            | ⚠️ Partial | Reports/dashboard endpoints                     |
| 5.1.3 | Discipline (late login, <9h worktime)                              | —               | ⚠️ Partial | Work hours tracking may be partial              |
| 5.1.4 | Property-wise, Individual performance                              | Reports         | ⚠️ Partial |                                                 |
| 5.2   | Conversion Funnel (New→1st Connect→Discussion→Payment→Booked/Lost) | Pipeline report | ✅ Exists   | Pipeline stages                                 |
| 5.3   | Revenue Forecasting                                                | —               | ❌ Gap      | No pipeline-based projection                    |
| 5.4   | Agent metrics (FRT, FU adherence, conversion, calls, hours)        | —               | ⚠️ Partial | Some metrics; not all                           |
| 5.5   | Report Builder                                                     | —               | ❌ Gap      | No custom report builder                        |
| 5.6   | Auto Report Sharing (WA/Email)                                     | —               | ❌ Gap      | `generate_report` action not implemented        |
| 5.7   | Work Hours (Login, 9h, idle, multi-login, logout gate)             | —               | ⚠️ Partial | `lastLoginAt`; full SOP not implemented         |
| 5.8   | Performance Benchmarking                                           | —               | ❌ Gap      | No city/property/team comparison                |


---

## 6. Knowledge & Content Management


| #   | SOP Requirement                                   | Test Action          | Status     | Notes                                     |
| --- | ------------------------------------------------- | -------------------- | ---------- | ----------------------------------------- |
| 6.1 | Knowledge Base (Google Sheet, Property/City info) | —                    | ⚠️ Partial | KnowledgeBase model; no Google Sheet sync |
| 6.2 | Creative Repository                               | Knowledge base items | ✅ Exists   | Factsheets, resources                     |
| 6.3 | Smart Search                                      | —                    | ⚠️ Partial | Keyword/tag search may exist              |


---

## 7. Infrastructure, Access & Security


| #     | SOP Requirement                                              | Test Action                | Status     | Notes                                |
| ----- | ------------------------------------------------------------ | -------------------------- | ---------- | ------------------------------------ |
| 7.1.1 | Roles: Sales Executive, Team Lead, Manager, Dept Head, Admin | Create users with profiles | ✅ Exists   | Profile + Role; permissions          |
| 7.1.2 | Data visibility by role (own, team, all)                     | Scope leads by permission  | ✅ Exists   | AccessControlService                 |
| 7.2   | Audit Trail                                                  | Check activity/audit log   | ✅ Exists   | LeadActivity, AuditLog               |
| 7.3   | Daily backup, Admin export                                   | —                          | ⚠️ Partial | No built-in backup; export may exist |
| 7.4   | API auth, rate limits                                        | —                          | ⚠️ Partial | JWT; rate limits unclear             |
| 7.5   | API Library / Documentation                                  | —                          | ⚠️ Partial | docs/api.md                          |


---

## 8. Template Automation & Sharing


| #   | SOP Requirement                       | Test Action          | Status     | Notes                             |
| --- | ------------------------------------- | -------------------- | ---------- | --------------------------------- |
| 8.1 | Auto “Send Proposal” on lead creation | —                    | ❌ Gap      | No auto-send                      |
| 8.2 | Auto-fetch decks by property          | —                    | ⚠️ Partial | Knowledge base linked to property |
| 8.3 | Manual + automated (Email/WA)         | Send email from lead | ✅ Exists   | Email; WA placeholder             |
| 8.4 | Pre-defined, customizable templates   | Template CRUD        | ✅ Exists   |                                   |


---

## Summary: Priority Gaps to Address


| Priority | Area       | Gap                                                                         |
| -------- | ---------- | --------------------------------------------------------------------------- |
| **P0**   | 1.1.3, 2.1 | WhatsApp integration (WATI) – inbound + outbound                            |
| **P0**   | 1.4.2      | Merge multi-property inquiries into master lead                             |
| **P1**   | 1.6        | UTM / Ad ID / marketing attribution fields                                  |
| **P1**   | 1.8.1      | Follow-up suggestions (Hot 3h, Warm 24h, Cold 3d) if SOP must match exactly |
| **P1**   | 2.2        | WhatsApp Chat Bot (Sales/Post-Sales)                                        |
| **P2**   | 1.3.1      | Strict round-robin vs least-open-leads (confirm with business)              |
| **P2**   | 5.3, 5.6   | Revenue forecasting; auto report sharing                                    |
| **P2**   | 5.7        | Full work hours monitoring (9h, idle, logout gate)                          |


---

## How to Run Tests

1. **IVR**: `curl -X POST "http://localhost:4000/api/public/ivr-webhooks" -d "Digits=1&From=+919876543210&CallSid=test123&RecordingUrl=https://example.com/rec.wav"`
2. **Website lead**: `curl -X POST "http://localhost:4000/api/public/website-leads" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@example.com","phone":"+919876543210","leadType":"STAY"}'`
3. **Manual lead**: Use CRM UI → Leads → Add Lead
4. **CSV**: Settings → Integrations → Bulk CSV tab
5. **Workflows**: Setup → Workflow Builder; verify triggers and actions
6. **Allocation**: Create Assignment Rules; create leads and verify assignment
7. **Scoring**: Setup → Scoring Engine; add rules; create lead and check score/bucket

