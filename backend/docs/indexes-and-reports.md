## Key MongoDB Indexes

- **`guests`**
  - `{ phone: 1 }`, `{ email: 1 }`, `{ phone: 1, email: 1 }` for fast caller lookup.
- **`users`**
  - `{ email: 1 }` unique to ensure one account per team member.
  - `{ regions: 1, teamType: 1 }` (implicit via queries) to support auto-assignment by geography.
- **`properties`**
  - `{ code: 1 }` unique for PMS/website mapping.
- **`regions`**
  - `{ name: 1 }` unique for region lookup.
- **`accounts`**
  - `{ name: 1, type: 1 }` for quick TA/Corporate filtering.
- **`leads`**
  - `{ assignedToUserId: 1, status: 1, checkInDate: 1 }` for agent queues and stay-date planning.
  - `{ guestId: 1 }` to show caller history across leads.
  - `{ createdAt: -1 }` for recent-leads views and daily reports.
- **`leadActivities`**
  - `{ leadId: 1, performedAt: -1 }` to render the lead timeline efficiently.
  - `{ type: 1, performedAt: -1 }` for activity-based reports.
- **`communications`**
  - `{ leadId: 1, createdAt: -1 }` to show latest communication per lead.
  - `{ performedByUserId: 1, createdAt: -1 }` for per-user call/email reports.
- **`quotations`**
  - `{ leadId: 1, createdAt: -1 }` to fetch all quotes for a lead.
- **`paymentLinks`**
  - `{ leadId: 1, createdAt: -1 }` for payment tracking per lead.
  - `{ status: 1 }` to find pending vs paid links.
- **`reservations`**
  - `{ propertyId: 1, checkInDate: 1 }` for hotel-wise arrival and occupancy views.
  - `{ guestId: 1, checkInDate: -1 }` for guest stay history.
  - `{ pmsReservationId: 1 }` for PMS sync.
- **`tasks`**
  - `{ ownerUserId: 1, status: 1, dueAt: 1 }` for personal calendars and follow-up queues.
- **`availabilityReports`**
  - `{ propertyId: 1, date: -1 }` to fetch the latest report for each hotel.
- **`userBuddyAssignments`**
  - `{ userId: 1, effectiveFrom: -1 }` and `{ buddyUserId: 1, effectiveFrom: -1 }` for buddy history reports.
- **`activityLogs`**
  - `{ userId: 1, createdAt: -1 }` and `{ type: 1, createdAt: -1 }` for generic audits.

---

## Report & Analytics Aggregations

### 1. Daily Activity Report (per user)

- **Collections used**: `leads`, `leadActivities`, `communications`, `reservations`, `tasks`.
- **Approach**:
  - Aggregate each collection separately for the target date range and `performedByUserId` / `assignedToUserId` / `ownerUserId`, then combine at the application layer.
  - Example metrics per user and day:
    - New leads: `leads` where `createdAt` in range.
    - Calls made: `communications` where `channel = CALL` and `direction = OUTBOUND`.
    - Quotations shared: `leadActivities` where `type = QUOTE_SENT`.
    - Follow-ups completed: `leadActivities` where `type = FOLLOW_UP`.
    - Leads closed: `leads` where `closedAt` in range.
    - Leads pending: `leads` where `status` not in `["CONFIRMED", "LOST", "CLOSED_AUTO"]`.

### 2. Response Time Report

- **Collections used**: `leads`, `leadActivities`, `communications`.
- **Approach**:
  - For each `lead`:
    - `leadAssignedAt` comes from `leads`.
    - First response time:
      - Find first `leadActivity` of type `FOLLOW_UP` OR first outbound `communication` where `direction = OUTBOUND` after `leadAssignedAt`.
    - Time to close: `closedAt - leadAssignedAt`.
  - Aggregate by:
    - `assignedToUserId`
    - Date bucket (day/week)
  - Metrics:
    - `avgFirstResponseMinutes`
    - `avgTimeToCloseHours`
    - `leadsHandledCount`
    - `%OnTimeResponses` based on SLA thresholds (e.g. <= 10 minutes).

### 3. Conversion & Lead Source Effectiveness

- **Collections used**: `leads`, `reservations`.
- **Approach**:
  - Aggregate `leads` grouped by `source`, `propertyId`, and time bucket:
    - `totalLeads`
    - `convertedLeads` where `status = CONFIRMED` or with matching `reservations`.
  - Join (via `lookup` or application layer) with `reservations` on `leadId` for revenue:
    - `totalRevenue` per source/property.

### 4. Lost Business Reasons

- **Collections used**: `leads`.
- **Approach**:
  - Filter leads where `status = LOST` or `status = CLOSED_AUTO`.
  - Group by `closedReason` and `propertyId` and time bucket.
  - Metrics:
    - `lostCount`
    - `lostSharePercent` per reason.

### 5. Lead Aging / TAT

- **Collections used**: `leads`, `leadActivities`.
- **Approach**:
  - For each open lead:
    - `ageDays = (now - createdAt)`.
  - For closed leads:
    - `tatDays = (closedAt - createdAt)`.
  - Group by `assignedToUserId`, `propertyId`, `source`.
  - Use buckets (0–1 days, 2–3, 4–7, 8+).

### 6. Daily Lead Report

- **Collections used**: `leads`.
- **Approach**:
  - Aggregate by `createdAt` (date), `assignedToUserId`, `source`, `propertyId`.
  - Metrics:
    - `newLeadsCount`
    - `assignedLeadsCount`
    - Optional: split by `leadType` and `heatLevel`.

### 7. Buddy System Report

- **Collections used**: `userBuddyAssignments`, `leads`, `leadActivities`.
- **Approach**:
  - For a given user:
    - Leads assigned to buddies:
      - Leads where `assignedToUserId` is the buddy during a period when that buddy assignment was active.
      - Or events in `leadActivities` that record transfer from user → buddy.
    - Leads received as buddy:
      - Reverse of above, where user is the buddy.
  - Aggregate counts by date or month.

### 8. Availability & Quotation Alignment

- **Collections used**: `availabilityReports`, `quotations`.
- **Approach**:
  - For each `quotation` (by `propertyId`, `sentAt`), check the nearest `availabilityReport` with `propertyId` and `date <= sentAt`.
  - This enables audits to ensure quotes matched available inventory/blackout rules.

### 9. Team-wise Performance & Hotel-wise Metrics

- **Collections used**: `leads`, `reservations`, `communications`, `tasks`.
- **Approach**:
  - Group by:
    - `assignedToUserId` for team-wise.
    - `propertyId` for hotel-wise.
  - Metrics:
    - `totalLeads`, `convertedLeads`, `conversionRate`.
    - `totalCalls`, `totalFollowUps`, `avgFollowUpsPerLead`.
    - `reservationsCount`, `totalRevenue`.



