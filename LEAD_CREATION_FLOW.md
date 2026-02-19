# Lead Creation Flow - First Principles Explanation

## Overview
When you create a lead via "Add Lead", here's exactly what happens from frontend to database storage.

---

## Step-by-Step Flow

### 1. **Frontend Form Submission**
```
User fills form → Frontend collects data → POST /api/leads
```

**Data sent includes:**
- Guest contact info (name, phone, email) OR existing guestId
- Property information
- Lead details (source, type, dates, rooms, etc.)
- Additional fields (occupation, special requests, notes, etc.)
- Assignment mode (auto/manual)

---

### 2. **Backend Route Handler** (`backend/src/routes/leads.ts`)

**Line 177-236: POST `/leads` endpoint**

```typescript
leadsRouter.post("/", async (req, res, next) => {
  // 1. Check permissions (leads.create or leads.manage)
  // 2. Validate request body using Zod schema (leadCreateSchema)
  // 3. Call createLead() service function
  // 4. Return created lead as JSON
})
```

**What happens:**
- ✅ Authentication check (JWT token validation)
- ✅ Permission check (`leads.create` or `leads.manage`)
- ✅ Data validation (Zod schema validates all fields)
- ✅ Calls `createLead()` service function

---

### 3. **Service Layer** (`backend/src/services/leadService.ts`)

**Line 167-353: `createLead()` function**

This is where the **real logic** happens:

#### 3.1 **Guest Resolution** (Lines 168-202)
```typescript
if (input.guestId) {
  // Use existing guest
  guestId = new Types.ObjectId(input.guestId);
} else if (input.guestContact) {
  // Search for existing guest by email OR phone
  let existingGuest = null;
  if (email) existingGuest = await GuestModel.findOne({ email });
  if (!existingGuest && phone) {
    existingGuest = await GuestModel.findOne({ phone });
  }
  
  if (existingGuest) {
    // Link to existing guest, update lastSeenAt
    guestId = existingGuest._id;
    existingGuest.lastSeenAt = new Date();
    await existingGuest.save();
  } else {
    // Create NEW guest record
    const guest = await GuestModel.create({
      name, phone, email,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });
    guestId = guest._id;
  }
}
```

**Key Point:** Guest data is stored in the **Guest collection**, NOT in the Lead model. The Lead only stores a **reference** (`guestId`).

#### 3.2 **Property Resolution** (Lines 204-229)
```typescript
if (input.propertyId) {
  // Can be ObjectId string OR property name
  if (Types.ObjectId.isValid(input.propertyId)) {
    propertyId = new Types.ObjectId(input.propertyId);
  } else {
    // Find by name (case-insensitive)
    const property = await PropertyModel.findOne({
      name: { $regex: new RegExp(`^${input.propertyId}$`, "i") }
    });
    propertyId = property?._id;
  }
}
```

**Key Point:** Property is also stored separately, Lead only has a **reference** (`propertyId`).

#### 3.3 **Lead Assignment** (Lines 237-243)
```typescript
const assignment = await performAssignment(
  input.leadType,
  input.source,
  input.assignmentMode ?? "auto",
  input.assignedToUserId
);
```

**Assignment Logic:**
- **Manual mode:** Assigns to specified user
- **Auto mode:** Uses assignment rules → falls back to legacy logic
- **Legacy:** Assigns based on team type (SALES vs RESERVATIONS)
- **Special case:** Wedding leads → tries to assign to "Nancy"

#### 3.4 **Lead Number Generation** (Lines 156-165)
```typescript
function generateLeadNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `L-${y}${m}${d}-${rand}`;
  // Example: L-20251223-0427
}
```

#### 3.5 **Lead Document Creation** (Lines 247-276)
```typescript
const lead = await LeadModel.create({
  leadNumber,                    // Generated unique ID
  guestId,                       // Reference to Guest document
  propertyId,                    // Reference to Property document
  source: input.source,          // LeadSource enum
  leadType: input.leadType,      // LeadType enum
  status: LeadStatus.NEW,        // Default status
  heatLevel: input.heatLevel ?? HeatLevel.WARM,
  checkInDate: input.checkInDate,
  checkOutDate: input.checkOutDate,
  roomsRequested: input.roomsRequested,
  guests: input.guests,          // { adults, children }
  occasion: input.occasion,
  isFirstTimeGuest,              // Calculated from guest history
  assignedToUserId: assignment.assignedToUserId,
  assignedTeamType: assignment.assignedTeamType,
  leadAssignedAt: assignment.assignedToUserId ? new Date() : undefined,
  // All additional form fields stored directly:
  alternateContact: input.alternateContact,
  occupation: input.occupation,
  bookingSource: input.bookingSource,
  specialRequests: input.specialRequests,
  isCorporateBooking: input.isCorporateBooking ?? false,
  companyName: input.companyName,
  gstin: input.gstin,
  estimatedValue: input.estimatedValue,
  notes: input.notes,
  roomCategory: input.roomCategory,
  roomPreference: input.roomPreference,
});
```

**This is where ALL the lead data gets saved to MongoDB!**

---

### 4. **Database Storage**

#### 4.1 **Lead Document** (MongoDB Collection: `leads`)
```javascript
{
  _id: ObjectId("..."),
  leadNumber: "L-20251223-0427",
  guestId: ObjectId("..."),           // Reference to Guest
  propertyId: ObjectId("..."),        // Reference to Property
  source: "DIRECT_CALL",
  leadType: "STAY",
  status: "NEW",
  heatLevel: "WARM",
  checkInDate: ISODate("2025-12-25"),
  checkOutDate: ISODate("2025-12-28"),
  roomsRequested: 2,
  guests: { adults: 2, children: 1 },
  occasion: "Anniversary",
  isFirstTimeGuest: true,
  assignedToUserId: ObjectId("..."),  // Reference to User
  assignedTeamType: "RESERVATIONS",
  leadAssignedAt: ISODate("2025-12-23T06:00:00Z"),
  alternateContact: "+91-9876543210",
  occupation: "Engineer",
  bookingSource: "Website",
  specialRequests: "Room with sea view",
  isCorporateBooking: false,
  companyName: null,
  gstin: null,
  estimatedValue: "50000",
  notes: "Guest prefers early check-in",
  roomCategory: "Deluxe",
  roomPreference: "High floor",
  createdAt: ISODate("2025-12-23T06:00:00Z"),
  updatedAt: ISODate("2025-12-23T06:00:00Z")
}
```

#### 4.2 **Guest Document** (MongoDB Collection: `guests`)
```javascript
{
  _id: ObjectId("..."),              // Referenced by lead.guestId
  name: "John Doe",
  phone: "+91-9876543210",
  email: "john@example.com",
  isSunshineMember: false,
  sunshineTier: null,
  tags: [],
  firstSeenAt: ISODate("2025-12-23T06:00:00Z"),
  lastSeenAt: ISODate("2025-12-23T06:00:00Z"),
  totalLeadsCount: 1,                 // Incremented when lead created
  totalReservationsCount: 0,
  createdAt: ISODate("2025-12-23T06:00:00Z"),
  updatedAt: ISODate("2025-12-23T06:00:00Z")
}
```

#### 4.3 **Lead Activity Document** (MongoDB Collection: `leadactivities`)
```javascript
{
  _id: ObjectId("..."),
  leadId: ObjectId("..."),            // Reference to Lead
  type: "LEAD_CREATED",
  note: "Lead created",
  performedByUserId: ObjectId("..."), // User who created
  performedAt: ISODate("2025-12-23T06:00:00Z")
}
```

---

## Key Concepts (First Principles)

### 1. **Data Normalization**
- **Guest data** is stored separately in `guests` collection
- **Lead data** only stores a **reference** (`guestId`) to the guest
- This prevents data duplication and allows one guest to have multiple leads

### 2. **Mongoose Schema Definition**
The Lead model (`backend/src/models/lead.ts`) defines:
- **Schema structure** (what fields exist, their types)
- **Validation rules** (required fields, enums, defaults)
- **Indexes** (for fast queries)

```typescript
const leadSchema = new Schema<ILead>({
  leadNumber: { type: String, required: true, unique: true },
  guestId: GuestRef,  // Reference type
  source: { type: String, enum: Object.values(LeadSource), required: true },
  // ... all other fields
}, { timestamps: { createdAt: true, updatedAt: true } });
```

### 3. **Mongoose Model.create()**
```typescript
const lead = await LeadModel.create({ ...data });
```

This:
- ✅ Validates data against schema
- ✅ Applies defaults (status: NEW, heatLevel: WARM)
- ✅ Generates `_id` (MongoDB ObjectId)
- ✅ Saves to MongoDB `leads` collection
- ✅ Returns the created document

### 4. **References vs Embedded Data**
- **References:** `guestId`, `propertyId`, `assignedToUserId` → Stored as ObjectId, populated when needed
- **Embedded:** `guests: { adults, children }`, `notes`, `specialRequests` → Stored directly in lead document

### 5. **Automatic Timestamps**
```typescript
{ timestamps: { createdAt: true, updatedAt: true } }
```
Mongoose automatically adds `createdAt` and `updatedAt` fields.

---

## What Gets Stored Where?

| Data | Stored In | Type |
|------|-----------|------|
| Guest name, phone, email | `guests` collection | Separate document |
| Lead number, dates, rooms | `leads` collection | Direct fields |
| Guest reference | `leads.guestId` | ObjectId reference |
| Property reference | `leads.propertyId` | ObjectId reference |
| User assignment | `leads.assignedToUserId` | ObjectId reference |
| Notes, special requests | `leads` collection | Direct fields |
| Activity log | `leadactivities` collection | Separate document |

---

## Summary

**When you create a lead:**
1. ✅ Guest is created/found → saved to `guests` collection
2. ✅ Lead document is created → saved to `leads` collection
3. ✅ Lead references guest via `guestId` (ObjectId)
4. ✅ All form fields are stored directly in the lead document
5. ✅ Activity log entry is created → saved to `leadactivities` collection
6. ✅ Guest's `totalLeadsCount` is incremented
7. ✅ Lead is assigned to a user (auto or manual)
8. ✅ Notification is sent to assigned user
9. ✅ Workflow is initialized for the lead

**The Lead model DOES store all the data** - it's just that some data (like guest name/email) is stored in a separate collection and referenced, while lead-specific data (dates, rooms, notes, etc.) is stored directly in the lead document.

