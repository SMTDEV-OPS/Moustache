# New Hotel CRM – Full Separation from Postcard

This guide explains how to run a **completely separate** CRM for your new hotel, with no shared data or dependencies on Postcard Hotels.

---

## 1. Database Separation

### Why a New Database?

MongoDB databases are separate namespaces. Each database has its own collections (`users`, `leads`, `properties`, etc.). Using a **different database name** gives you:

- No shared data with Postcard
- Clean state for your hotel
- Ability to run both CRMs on the same MongoDB server without conflict

| System           | Database Name     | Connection String                          |
|------------------|-------------------|--------------------------------------------|
| Postcard CRM     | `postcardcrm`     | `mongodb://localhost:27017/postcardcrm`    |
| **Your New Hotel** | `newhotelcrm`   | `mongodb://localhost:27017/newhotelcrm`    |

You can use any database name (e.g. `yourhotelcrm`, `acmehotelscrm`).

### Backend Setup

1. **Create backend `.env`** (copy from the new hotel example):
   ```bash
   cp backend/.env.newhotel.example backend/.env
   ```

2. **Set your database URL** in `backend/.env`:
   ```
   MONGO_URI=mongodb://localhost:27017/newhotelcrm
   ```
   Replace `newhotelcrm` with your chosen database name.

3. **Seed the new database**:
   ```bash
   cd backend
   npx ts-node scripts/seedNewHotel.ts
   ```

4. **Optional env vars for seeding**:
   - `ADMIN_EMAIL` – default: `admin@newhotelcrm.local`
   - `ADMIN_PASSWORD` – default: `Admin@123`
   - `ADMIN_NAME` – default: `System Admin`

   Example:  
   `ADMIN_EMAIL=admin@yourhotel.com ADMIN_PASSWORD=YourSecurePass npx ts-node scripts/seedNewHotel.ts`

---

## 2. What Uses Postcard Data?

### Backend (API)

- **Database**: Only what you point `MONGO_URI` at. With a new database name, all data (users, leads, properties, etc.) is separate.
- **Seed scripts**: `seedAdmin.ts` and `seedAccountData.ts` use `postcardcrm` by default. For the new hotel, use `seedNewHotel.ts` only, with `MONGO_URI` set to your new DB.

### Frontend (UI)

Several components have hardcoded “Postcard” names and property lists. These are for demo/UI only and do not affect backend data. The backend is generic; it stores whatever you create via the CRM (e.g. properties from Property Management).

**Components with Postcard references:**

| File                             | Usage                                                        |
|----------------------------------|--------------------------------------------------------------|
| `AgentDashboard.tsx`             | Property names in mock/demo data                             |
| `CCManagerDashboard.tsx`         | Property names in mock data                                  |
| `DetailedDashboard.tsx`          | Property names in mock data                                  |
| `EnhancedCallInterface.tsx`      | Property dropdown options                                    |
| `GuestProfile.tsx`               | Message text, property dropdowns                             |
| `Landing.tsx`                    | Branding, testimonials                                       |
| `LeadManagement.tsx`             | Property dropdowns, mock leads                               |
| `ProfessionalLeadManagement.tsx` | Property dropdown options                                    |
| `ProfessionalTicketManagement.tsx` | Property dropdown options, staff names                     |
| `PropertyManagerDashboard.tsx`   | Property names in mock data                                  |
| `SalesExecutiveDashboard.tsx`    | Property names in mock data                                  |
| `SalesHeadDashboard.tsx`         | Property names in mock data                                  |
| `SalesRevenueDashboard.tsx`      | Property names in mock data                                  |
| `TicketingSystem.tsx`            | Property names in mock data                                  |
| `Index.tsx`                      | Mock guest property                                          |
| `KnowledgeBase.tsx`              | Property names, URLs                                         |
| `PropertyManagement.tsx`         | Placeholder text                                             |
| `Reports.tsx`                    | Property names in mock data                                  |
| `MessageTemplates.tsx`           | Placeholder sample property                                  |
| `WhatsAppDialog.tsx`             | Template text “The Postcard Hotels”                          |
| `SMSDialog.tsx`                  | Template text “The Postcard Hotels”                          |
| `CallInterface.tsx`              | Message text                                                 |
| `ProfessionalCRM.tsx`            | Alt text                                                     |
| `Login.tsx`                      | Placeholder email                                            |
| `ManagementDashboard.tsx`        | Property dropdown options                                    |
| `AdminLeads.tsx`                 | Property dropdown options                                    |

### Recommended approach for UI

1. **Property dropdowns**  
   Replace hardcoded property lists with data from `listProperties()` (from `/properties` API). When you add properties via Property Management, those will appear.

2. **Branding**  
   Replace “Postcard” / “Postcard Hotels” with your hotel brand via:
   - `VITE_HOTEL_BRAND` in `.env` (see next section), or
   - Direct edits in the listed components.

3. **Placeholders**  
   Update placeholder text (e.g. in Login, PropertyManagement, etc.) to your hotel’s examples.

---

## 3. Frontend Config for Your Hotel

1. **Create `.env`** in `postcard-guest-compass-main/`:
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   VITE_HOTEL_BRAND=Your Hotel Name
   ```

2. **Use the brand in code** (example):
   ```ts
   const hotelBrand = import.meta.env.VITE_HOTEL_BRAND || "Hotel";
   ```

3. **Point API URL**  
   Use your backend URL (local or production) in `VITE_API_BASE_URL`.

---

## 4. Quick Start Checklist

- [ ] Create `backend/.env` with `MONGO_URI=mongodb://localhost:27017/YOUR_NEW_DB`
- [ ] Run `npx ts-node scripts/seedNewHotel.ts` in `backend/`
- [ ] Create `postcard-guest-compass-main/.env` with `VITE_API_BASE_URL` and optional `VITE_HOTEL_BRAND`
- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `cd postcard-guest-compass-main && npm run dev`
- [ ] Log in with the admin email/password from the seed script
- [ ] Add properties via Property Management
- [ ] (Optional) Update components listed above to use API properties and your brand

---

## 5. Verifying Separation

1. **Backend**  
   Ensure `MONGO_URI` points to your new database, not `postcardcrm`.

2. **Data**  
   - Users, leads, properties should be empty initially (except the seeded admin).
   - Adding a property/lead in the UI should appear only in your new database.

3. **No shared tables**  
   Because each MongoDB database has its own collections, there is no table/collection sharing between Postcard and your hotel.

---

## Summary

| Concern                  | Solution                                                          |
|--------------------------|-------------------------------------------------------------------|
| Shared database          | Use different `MONGO_URI` (different DB name)                     |
| Postcard seed data       | Use only `seedNewHotel.ts` for the new hotel                      |
| Postcard branding in UI  | Add `VITE_HOTEL_BRAND` and/or update listed components            |
| Property dropdowns       | Fetch from `/properties` API instead of hardcoded Postcard lists  |

Your new hotel CRM is fully separated from Postcard when you use a different database and seed it only with `seedNewHotel.ts`. UI changes are for branding and UX, not data isolation.
