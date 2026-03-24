## PostcardCRM Backend API (Overview)

### Auth
- **POST `/auth/login`**: email + password → JWT and basic user info.
- **GET `/auth/me`**: returns current user (from JWT).

### Users & Roles
- **GET `/users`** _(perm: `users.manage`)_:
  - List users (filters: `teamType`, `regionId`, `status`).
- **GET `/users/:id`** _(perm: `users.manage`)_:
  - User details.
- **POST `/users`** _(perm: `users.manage`)_:
  - Body: `name`, `email`, `password`, `teamType`, optional `regions`, `roleId`.
- **PATCH `/users/:id`** _(perm: `users.manage`)_:
  - Update name, phone, status, teamType, regions, role, password.
-
- **GET `/users/:id/roles`**:
  - Returns all roles for the given user.
  - Accessible by the user themselves or anyone with `users.manage`.
-
- **GET `/roles`** _(perm: `users.manage`)_:
  - List all roles.
- **GET `/roles/:id`** _(perm: `users.manage`)_:
  - Role details.
- **POST `/roles`** _(perm: `users.manage`)_:
  - Body: `name`, optional `description`, `permissions[]`, optional `ownerUserId`.
- **PUT `/roles/:id`** _(perm: `users.manage`)_:
  - Update name, description, permissions, or owner.
- **DELETE `/roles/:id`** _(perm: `users.manage`)_:
  - Delete role (fails for system roles or roles assigned to users).
- **POST `/roles/:id/users`** _(perm: `users.manage`)_:
  - Body: `userIds[]` → assign users to role.
- **DELETE `/roles/:id/users/:userId`** _(perm: `users.manage`)_:
  - Remove a user from a role.

### Guests
- **GET `/guests/search`**: query by `phone`, `email`, or `name`.
- **GET `/guests/:id`**: full guest profile.
- **PATCH `/guests/:id`**: update name, Sunshine membership, tier, tags.

### Accounts (Travel Agents / Corporates)
- **GET `/accounts`**: filter by `type`, `city`.
- **POST `/accounts`** _(perm: `accounts.manage`)_:
  - Body: `name`, `type`, optional `city`, `primaryContact`, `notes`.
- **PATCH `/accounts/:id`** _(perm: `accounts.manage`)_:
  - Update account fields.

### Properties & Regions
- **GET `/properties`**: list hotels.
- **POST `/properties`** _(perm: `properties.manage`)_:
  - Body: `name`, `code`, optional `location`, `timeZone`, `status`.
- **PATCH `/properties/:id`** _(perm: `properties.manage`)_.

- **GET `/regions`**: list regions.
- **POST `/regions`** _(perm: `regions.manage`)_:
  - Body: `name`, optional `properties`.
- **PATCH `/regions/:id`** _(perm: `regions.manage`)_.

### Leads
- **POST `/leads`** _(perm: `leads.manage`)_:
  - Body: `guestId` or `guestContact { name, phone?, email? }`,
    `propertyId?`, `source`, `leadType`, optional dates, rooms, guests, occasion, heat.
  - Auto-creates/links guest, applies team routing and tentative assignee, records initial activity.
- **GET `/leads`** _(perm: `leads.manage`)_: filters: `status`, `assigneeId`, `propertyId`, `fromDate`, `toDate`, `heat`.
- **GET `/leads/:id`** _(perm: `leads.manage`)_: lead details + activities + communications.
- **PATCH `/leads/:id`** _(perm: `leads.manage`)_:
  - Update status, heat, stay details, assignee; status changes logged to activities.

### Lead Activities & Communications
- **POST `/leads/:id/activities`**:
  - Body: `type` (`STATUS_CHANGE`/`FOLLOW_UP`/`NOTE`/`QUOTE_SENT`/`PAYMENT_LINK_SENT`/`PAYMENT_RECEIVED`/`REMINDER_TRIGGERED`), optional `note`, `dueAt`.
- **GET `/leads/:id/activities`**: ordered timeline.

- **POST `/leads/:leadId/communications`**:
  - Body: `channel` (CALL/EMAIL/WHATSAPP/SMS), `direction` (INBOUND/OUTBOUND),
    optional `disposition` (shopping call, info-only, dining, cancellation, amendment, etc.), `summary`.
- **GET `/leads/:leadId/communications`**: communication history.

### Quotations & Payment Links
- **POST `/leads/:leadId/quotations`**:
  - Body: quote details (rooms, rate, taxes, inclusions, specialPackages, sentVia, sentTo).
  - Auto-increments version, logs `QUOTE_SENT` activity.
- **GET `/leads/:leadId/quotations`**: quote history.

- **POST `/leads/:leadId/payment-links`**:
  - Body: `gateway`, `amount`, optional `currency`.
  - Creates payment link record and logs `PAYMENT_LINK_SENT`.
- **PATCH `/leads/payment-links/:id/status`**:
  - Body: `status` (`CREATED`/`SENT`/`PARTIALLY_PAID`/`PAID`/`EXPIRED`/`FAILED`).
  - Updates link, stamps `paidAt` when applicable, logs `PAYMENT_RECEIVED`.

### Reservations
- **POST `/reservations`**:
  - Body: `leadId`, `checkInDate`, `checkOutDate`, optional `roomsBooked`, `ratePlan`, `totalAmount`, `pmsReservationId`.
  - Creates CRM reservation record (for PMS sync stub).
- **GET `/reservations`**: filters: `propertyId`, `guestId`, `fromDate`, `toDate`.

### Tasks & Buddy
- **POST `/tasks`**:
  - Body: `title`, `description?`, `ownerUserId`, `leadId?`, `dueAt`.
  - Anyone can create a task for any owner.
- **GET `/tasks`**: filters: `ownerUserId`, `status`, `fromDue`, `toDue`.
- **PATCH `/tasks/:id`**:
  - Only owner can update; change title/description/status.

- **POST `/users/:id/buddy`** _(perm: `users.manage`)_:
  - Body: `buddyUserId`.
  - Sets buddy on user and records `UserBuddyAssignment`.
- **GET `/buddies/report`**:
  - Query: `userId`, optional `fromDate`, `toDate`.
  - Returns simplified counts of leads assigned to/received as buddy.

### Workflows
- **GET `/workflows`**: list workflows.
- **POST `/workflows`** _(perm: `workflows.manage`)_:
  - Body: `name`, optional `appliesTo { leadType, source, propertyId }`,
    `steps[] { offsetDays?, offsetHours?, actionType, templateId?, description? }`,
    `isActive?`.
- **PATCH `/workflows/:id`** _(perm: `workflows.manage`)_.

### Availability
- **POST `/availability-reports`** _(perm: `availability.upload`)_:
  - Body: `propertyId`, `date`, optional `reportDateRange`, `data` (room types, availability, blackout dates, packages).
- **GET `/availability-reports/latest?propertyId=`**:
  - Returns latest uploaded report for a property.

### Reporting
All report endpoints require `reports.view` permission.

- **GET `/reports/daily-activity?date=YYYY-MM-DD`**:
  - Aggregates new leads, activities, communications, reservations, and completed tasks per user for the given day.
- **GET `/reports/response-time`**:
  - Per-assignee averages for first-response minutes and time-to-close hours.
- **GET `/reports/conversions`**:
  - Conversion counts by `source` and `propertyId` (total and confirmed leads).
- **GET `/reports/lost-reasons`**:
  - Counts of lost/auto-closed leads grouped by `closedReason` and `propertyId`.
- **GET `/reports/lead-aging`**:
  - Buckets leads by age in days (0–1, 1–3, 3–7, 7–14, 14+).
- **GET `/reports/buddy`**:
  - Simplified buddy metrics grouped by current assignee.



