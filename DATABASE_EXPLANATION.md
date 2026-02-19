# Database Structure & Relationships - First Principles Explanation

## What is a Database?

At its core, a database is a structured collection of data organized into **tables** (in MongoDB, these are called **collections**). Each table stores information about a specific type of entity (like "users", "guests", "leads"). Think of it like a filing cabinet where each drawer contains files about one type of thing.

---

## Core Entities (The "Things" in Your System)

Let's start with the fundamental building blocks:

### 1. **Geographic & Organizational Structure**

#### **Region** → **Property**
- **Region**: A geographic area (e.g., "Goa", "Himachal Pradesh")
- **Property**: A specific hotel/property within a region (e.g., "Postcard Goa Beach Resort")
- **Relationship**: One Region contains many Properties (One-to-Many)
  - A Region has an array of Property IDs
  - Example: Region "Goa" → [Property1, Property2, Property3]

**Why this exists**: Hotels are organized by geographic regions for operational management.

---

### 2. **People & Organizations**

#### **User** (Employees/Staff)
- Represents employees who work in the CRM system
- Has: name, email, phone, team type (RESERVATIONS/SALES/OPERATIONS)
- Belongs to: one or more Regions, one Role, multiple Employee Groups
- Can have: a Buddy (another user who covers for them)

#### **Guest** (Customers)
- Represents customers who interact with the hotels
- Has: name, phone, email, Sunshine membership tier (GOLD/PLATINUM/BLACK)
- Tracks: first seen date, last seen date, total leads count, total reservations count

#### **Account** (Business Partners)
- Represents business entities: Travel Agents, Corporate clients, Event Planners
- Has: name, type, primary contact info, city, notes
- **Why separate from Guest**: Accounts represent organizations, Guests represent individuals

**Key Insight**: The system distinguishes between:
- **Individual customers** (Guests)
- **Business partners** (Accounts)
- **Staff members** (Users)

---

### 3. **Authorization & Access Control**

#### **Role**
- Defines what permissions a user has (e.g., "Manager", "Sales Agent")
- Has: name, list of permissions, owner(s), system flag
- **Relationship**: Many Users can have one Role (Many-to-One via `roleId`)

#### **EmployeeGroup**
- A team or department (e.g., "Goa Sales Team", "Reservations Team")
- Has: name, team type, list of member users, list of roles
- **Relationship**: 
  - Many Users belong to many Groups (Many-to-Many via `groupIds` array)
  - Groups can have multiple Roles assigned

#### **UserRole** (Historical/Additional Role Assignment)
- Tracks additional role assignments beyond the primary `roleId`
- **Relationship**: Many Users can have many Roles (Many-to-Many junction table)

**Why both Role and EmployeeGroup?**
- **Role** = What you CAN do (permissions)
- **EmployeeGroup** = Which team you're on (organizational structure)

---

### 4. **The Lead Lifecycle (Core Business Process)**

#### **Lead** (The Heart of the CRM)
A Lead represents a potential booking or inquiry. Think of it as a "sales opportunity."

**What a Lead contains:**
- **Who**: Links to Guest (individual) OR Account (business)
- **Where**: Links to Property (which hotel)
- **What**: Lead type (STAY/DINING/WEDDING/MICE/INFORMATION)
- **How**: Source (DIRECT_CALL/EMAIL/WALK_IN/etc.)
- **When**: Check-in/check-out dates, rooms requested
- **Status**: Current state (NEW → CONTACTED → QUOTATION_SHARED → CONFIRMED → etc.)
- **Heat Level**: HOT/WARM/COLD/NOT_INTERESTED
- **Assignment**: Assigned to a User, Team Type, and Region

**Key Relationships:**
- Lead → Guest (Many-to-One): Many leads can come from one guest
- Lead → Account (Many-to-One): Many leads can come from one account
- Lead → Property (Many-to-One): Many leads for one property
- Lead → User (Many-to-One): Many leads assigned to one user

**The Lead Journey:**
```
NEW → CONTACTED → QUOTATION_SHARED → PAYMENT_PENDING → CONFIRMED
                                    ↓
                                 ON_HOLD
                                    ↓
                                  LOST/CLOSED_AUTO
```

---

### 5. **Supporting Entities Around Leads**

#### **LeadActivity** (Audit Trail)
- Records every action taken on a Lead
- Types: STATUS_CHANGE, FOLLOW_UP, NOTE, QUOTE_SENT, ASSIGNMENT, etc.
- **Relationship**: Many Activities belong to one Lead (One-to-Many)
- **Why**: Complete history of what happened and when

#### **Communication** (Interaction Log)
- Records all communications (calls, emails, WhatsApp, SMS)
- Tracks: channel, direction (inbound/outbound), disposition, summary
- **Relationship**: Many Communications belong to one Lead and/or one Guest
- **Why**: Track all touchpoints with customers

#### **Quotation** (Price Quotes)
- A price quote sent to a potential customer
- Has: version number, rooms, rate, taxes, inclusions, status
- **Relationship**: Many Quotations belong to one Lead (One-to-Many)
- **Why**: Customers may request multiple quotes before booking

#### **PaymentLink** (Payment Processing)
- Payment links sent to customers
- Tracks: amount, gateway (Razorpay/PayU/etc.), status, payment breakup
- **Relationship**: Many PaymentLinks belong to one Lead (One-to-Many)
- **Why**: Track payment collection for bookings

#### **Reservation** (Confirmed Booking)
- The final confirmed booking
- Has: check-in/out dates, rooms, rate plan, total amount, status
- **Relationship**: 
  - One Reservation belongs to one Lead (One-to-One)
  - One Reservation belongs to one Guest (Many-to-One)
  - One Reservation belongs to one Property (Many-to-One)
- **Why**: Once a Lead is CONFIRMED, it becomes a Reservation

**Key Insight**: 
- **Lead** = Potential booking (sales process)
- **Reservation** = Confirmed booking (operational process)

---

### 6. **Task Management**

#### **Task**
- Action items for users (e.g., "Follow up with guest", "Send quotation")
- Has: title, description, owner (who should do it), creator, due date, status
- **Relationship**: 
  - Many Tasks belong to one User (owner) - Many-to-One
  - Many Tasks can be linked to one Lead (optional) - Many-to-One
- **Why**: Track to-dos and ensure follow-ups happen

---

### 7. **Automation & Workflows**

#### **Workflow**
- Defines automated sequences of actions for leads
- Has: name, conditions (which leads it applies to), steps
- Each step: offset days/hours, mediums (CALL/EMAIL/WHATSAPP), execution mode (AUTO/MANUAL/BOTH)
- **Relationship**: Workflows are independent but executed on Leads
- **Why**: Automate follow-ups and standardize processes

#### **Template**
- Reusable message templates for emails and WhatsApp
- Has: name, medium (EMAIL/WHATSAPP), subject (for email), body with placeholders
- **Relationship**: Used by Workflows and manually by users
- **Why**: Standardize communications and save time

#### **LeadAssignmentRule**
- Rules for automatically assigning leads to employee groups
- Has: lead type, employee group, priority, active flag
- **Relationship**: One Rule per Lead Type → One Employee Group
- **Why**: Automatically route leads to the right team

---

### 8. **Notifications & Alerts**

#### **Notification**
- Alerts sent to users about important events
- Types: LEAD_ASSIGNED, LEAD_REASSIGNED, TASK_ASSIGNED, WORKFLOW_REMINDER, etc.
- **Relationship**: Many Notifications belong to one User (Many-to-One)
- **Why**: Keep users informed of important events

---

### 9. **Special Relationships**

#### **UserBuddyAssignment** (Coverage/Backup)
- Tracks when one user covers for another (e.g., during leave)
- Has: userId, buddyUserId, effective dates
- **Relationship**: Many-to-Many between Users (with time constraints)
- **Why**: Ensure leads are covered when someone is unavailable

---

## Relationship Summary (Visual Map)

```
┌─────────┐
│ Region  │
└────┬────┘
     │ 1:N
     │
┌────▼────┐
│Property │
└────┬────┘
     │ 1:N
     │
┌────▼────┐
│  Lead   │───N:1───┐
└────┬────┘          │
     │              │
     │ 1:N          │
     │              │
┌────▼────┐    ┌────▼────┐
│Reservation│   │  Guest  │
└──────────┘    └─────────┘

┌─────────┐
│  User   │───N:1───┐
└────┬────┘         │
     │              │
     │ N:M          │
     │              │
┌────▼────┐    ┌────▼────┐
│Employee │    │  Role  │
│ Group   │    └─────────┘
└─────────┘

┌─────────┐
│  Lead   │───1:N───┐
└─────────┘         │
                    │
         ┌──────────┼──────────┐
         │          │          │
    ┌────▼────┐ ┌──▼──┐ ┌────▼────┐
    │Quotation│ │Task │ │Activity │
    └─────────┘ └─────┘ └─────────┘
```

---

## Key Design Principles

### 1. **Separation of Concerns**
- **Guests** = Individual customers
- **Accounts** = Business partners
- **Users** = Staff members
- Each serves a distinct purpose

### 2. **Audit Trail**
- **LeadActivity** tracks what happened
- **Communication** tracks interactions
- Timestamps on everything for accountability

### 3. **Flexibility**
- Leads can come from Guests OR Accounts
- Users can belong to multiple Groups
- Workflows can be customized per lead type

### 4. **Scalability**
- Indexes on frequently queried fields (assignedToUserId, status, dates)
- Compound indexes for complex queries
- References (ObjectIds) instead of embedding for large data

### 5. **Business Logic**
- **Lead** = Sales opportunity (before confirmation)
- **Reservation** = Confirmed booking (after payment)
- **Status** fields track state transitions
- **Heat Level** indicates probability of conversion

---

## Common Query Patterns

### "Show me all leads assigned to a user"
```
Lead.find({ assignedToUserId: userId })
```

### "Show me all reservations for a guest"
```
Reservation.find({ guestId: guestId })
```

### "Show me all activities for a lead"
```
LeadActivity.find({ leadId: leadId }).sort({ performedAt: -1 })
```

### "Show me all users in a region"
```
User.find({ regions: { $in: [regionId] } })
```

### "Show me all leads for a property"
```
Lead.find({ propertyId: propertyId })
```

---

## Database Technology: MongoDB

This system uses **MongoDB**, which is a **NoSQL document database**. Key differences from SQL:

- **Collections** instead of tables
- **Documents** instead of rows
- **ObjectIds** for relationships (like foreign keys)
- **Schema** defined in code (Mongoose) rather than database
- **Flexible structure** - documents can have different fields

**Why MongoDB?**
- Flexible schema (easy to add fields)
- Good for nested data (like `guests: { adults, children }`)
- Scales horizontally
- JSON-like structure matches JavaScript/TypeScript

---

## Summary

The database is organized around **Leads** as the central entity. Everything else supports the lead lifecycle:

1. **People**: Users (staff), Guests (customers), Accounts (partners)
2. **Places**: Regions, Properties
3. **Process**: Leads → Quotations → Payments → Reservations
4. **Tracking**: Activities, Communications, Tasks
5. **Automation**: Workflows, Templates, Assignment Rules
6. **Organization**: Roles, Groups, Regions

The relationships follow business logic: a Guest creates a Lead, which gets assigned to a User, goes through Quotations and Payments, and becomes a Reservation at a Property.

