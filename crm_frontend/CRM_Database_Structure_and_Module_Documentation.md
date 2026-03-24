# CRM Database Structure and Module Documentation

## Overview
This document provides a comprehensive overview of the Postcard Hotels CRM system database structure and module-wise details, identifying all data fields used across different modules.

---

## Database Structure

### 1. Users & Roles
```sql
Table: users
- id: VARCHAR (Primary Key)
- name: VARCHAR
- email: VARCHAR (Unique)
- phone: VARCHAR
- role: ENUM ('callcenter', 'ccmanager', 'salesexecutive', 'saleshead', 'management', 'propertymanager1', 'propertymanager2', 'propertymanager3')
- property: VARCHAR (For property managers)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- is_active: BOOLEAN
```

### 2. Guests/Customers
```sql
Table: guests
- id: VARCHAR (Primary Key)
- name: VARCHAR
- phone: VARCHAR
- email: VARCHAR
- loyalty_status: ENUM ('Bronze', 'Silver', 'Gold', 'Platinum')
- total_stays: INTEGER
- last_stay: DATE
- preferences: JSON (Array of preferences)
- property: VARCHAR
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 3. Leads Management
```sql
Table: leads
- id: VARCHAR (Primary Key)
- first_name: VARCHAR
- middle_name: VARCHAR
- last_name: VARCHAR
- full_name: VARCHAR (Computed)
- phone: VARCHAR
- email: VARCHAR
- alternate_contact: VARCHAR
- occupation: VARCHAR
-
-- Booking Details
- hotel_name: VARCHAR
- property: VARCHAR
- check_in_date: DATE
- check_out_date: DATE
- room_category: VARCHAR
- room_preference: VARCHAR
- guest_count: INTEGER
- room_type: VARCHAR
- 
-- Lead Classification
- status: ENUM ('New', 'Follow Up', 'Quoted', 'Converted', 'Lost')
- temperature: ENUM ('Hot', 'Warm', 'Cold')
- priority: ENUM ('High', 'Medium', 'Low')
- booking_type: ENUM ('Direct Customer', 'Corporate Booking', 'Tentative Booking', 'Confirmed Booking', 'Amendment')
- booking_source: VARCHAR
- source: VARCHAR
- value: DECIMAL
- 
-- Assignment & Tracking
- assigned_to: VARCHAR (Foreign Key to users.id)
- assigned_date: TIMESTAMP
- last_contact: DATE
- next_follow_up: DATE
- working_days: INTEGER
- working_hours: INTEGER
- score: INTEGER (0-100)
- 
-- Corporate Booking Fields
- corporate_booking: ENUM ('yes', 'no')
- company_name: VARCHAR
- gstin: VARCHAR
- 
-- Financial
- budget: VARCHAR
- price_per_night: DECIMAL
- total_budget: DECIMAL
- 
-- Additional Info
- special_requests: TEXT
- notes: TEXT
- 
-- Metadata
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- created_by: VARCHAR (Foreign Key to users.id)
```

### 4. Follow-ups
```sql
Table: follow_ups
- id: VARCHAR (Primary Key)
- lead_id: VARCHAR (Foreign Key to leads.id)
- lead_name: VARCHAR
- phone: VARCHAR
- property: VARCHAR
- scheduled_time: TIME
- scheduled_date: DATE
- status: ENUM ('pending', 'completed', 'missed')
- priority: ENUM ('high', 'medium', 'low')
- temperature: VARCHAR
- booking_type: VARCHAR
- notes: TEXT
- assigned_to: VARCHAR (Foreign Key to users.id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 5. Conversation History/Interactions
```sql
Table: interactions
- id: VARCHAR (Primary Key)
- lead_id: VARCHAR (Foreign Key to leads.id)
- guest_id: VARCHAR (Foreign Key to guests.id)
- agent_id: VARCHAR (Foreign Key to users.id)
- agent_name: VARCHAR
- date: DATE
- time: TIME
- type: ENUM ('Call', 'Email', 'WhatsApp', 'SMS')
- channel: VARCHAR
- summary: TEXT
- notes: TEXT
- disposition: ENUM ('New Query', 'Call back', 'Property Request', 'Property Escalations', 'Refund Query', 'Amendment Query', 'Cancellation Query', 'Converted', 'Follow up', 'Quoted', 'Closing')
- query_type: ENUM ('Direct Customer', 'Referral', 'Corporate', 'Others')
- created_at: TIMESTAMP
```

### 6. Tickets/Support System
```sql
Table: tickets
- id: VARCHAR (Primary Key)
- title: VARCHAR
- description: TEXT
- status: ENUM ('open', 'in-progress', 'resolved', 'closed')
- priority: ENUM ('urgent', 'high', 'medium', 'low')
- category: ENUM ('booking', 'maintenance', 'billing', 'dining', 'guest-relations', 'housekeeping', 'concierge', 'payment', 'amenities', 'technical', 'complaint', 'reservation', 'service')
- 
-- Guest Information
- guest_name: VARCHAR
- guest_phone: VARCHAR
- guest_email: VARCHAR
- room_number: VARCHAR
- 
-- Property & Assignment
- property: VARCHAR
- assigned_to: VARCHAR (Foreign Key to users.id)
- created_by: VARCHAR (Foreign Key to users.id)
- 
-- Dates & Timing
- created_date: TIMESTAMP
- updated_date: TIMESTAMP
- due_date: TIMESTAMP
- estimated_hours: DECIMAL
- actual_hours: DECIMAL
- 
-- Guest Stay Information
- check_in_date: DATE
- check_out_date: DATE
```

### 7. Ticket Comments/Responses
```sql
Table: ticket_responses
- id: VARCHAR (Primary Key)
- ticket_id: VARCHAR (Foreign Key to tickets.id)
- author: VARCHAR
- user_id: VARCHAR (Foreign Key to users.id)
- message: TEXT
- timestamp: TIMESTAMP
- type: ENUM ('create', 'response', 'close')
```

### 8. Properties
```sql
Table: properties
- id: VARCHAR (Primary Key)
- name: VARCHAR
- location: VARCHAR
- region: VARCHAR
- manager_id: VARCHAR (Foreign Key to users.id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 9. Sales Performance
```sql
Table: sales_performance
- id: VARCHAR (Primary Key)
- user_id: VARCHAR (Foreign Key to users.id)
- period: DATE
- period_type: ENUM ('daily', 'monthly', 'yearly')
- 
-- Targets & Achievements
- target_leads: INTEGER
- achieved_leads: INTEGER
- target_conversions: INTEGER
- achieved_conversions: INTEGER
- target_revenue: DECIMAL
- achieved_revenue: DECIMAL
- 
-- Metrics
- conversion_rate: DECIMAL
- avg_deal_size: DECIMAL
- sales_cycle_days: INTEGER
- room_nights: INTEGER
- arr: DECIMAL
- 
-- Property/Region specific
- property: VARCHAR
- region: VARCHAR
- 
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 10. Call Center Metrics
```sql
Table: call_metrics
- id: VARCHAR (Primary Key)
- agent_id: VARCHAR (Foreign Key to users.id)
- date: DATE
- 
-- Call Statistics
- total_calls: INTEGER
- calls_answered: INTEGER
- fcr_rate: DECIMAL (First Call Resolution)
- avg_aht: TIME (Average Handle Time)
- reservations: INTEGER
- cancellations: INTEGER
- 
-- Performance Score
- performance_score: DECIMAL
- 
- created_at: TIMESTAMP
```

---

## Module-wise Details

### 1. Agent Dashboard Module
**Purpose**: Individual call center agent's workspace
**Data Fields Used**:
- User Information: `userName`, `userRole`
- Follow-ups: `id`, `leadName`, `phone`, `property`, `scheduledTime`, `status`, `temperature`, `bookingType`, `notes`
- Leads: `id`, `name`, `phone`, `email`, `property`, `status`, `lastInteraction`, `workingDays`, `workingHours`, `conversationHistory`
- Tickets: `id`, `title`, `status`, `priority`, `property`, `guestName`, `createdDate`, `createdBy`, `assignedTo`, `description`
- Stats: Follow-ups count, Active leads count, Calls today, Conversions

### 2. Enhanced Call Interface Module
**Purpose**: Handle incoming/outgoing calls with guest information
**Data Fields Used**:
- Guest Profile: `id`, `name`, `phone`, `email`, `loyaltyStatus`, `totalStays`, `lastStay`, `preferences`, `property`, `interactionHistory`
- Call Management: `callActive`, `callDuration`, `incomingCall`, `agentName`
- Notes & Disposition: `notes`, `selectedDisposition`, `selectedQueryType`, `followUpDate`, `followUpTime`
- Lead Creation: `name`, `phone`, `email`, `property`, `checkIn`, `checkOut`, `guests`, `roomType`, `budget`, `source`, `priority`

### 3. Professional Lead Management Module
**Purpose**: Comprehensive lead management system
**Data Fields Used**:
- Lead Form: `firstName`, `middleName`, `lastName`, `hotelName`, `checkInDate`, `checkOutDate`, `roomCategory`, `roomPreference`, `guestCount`, `bookingSource`, `guestContactNumber`, `guestEmail`, `alternateContact`, `occupation`, `specialRequests`, `corporateBooking`, `companyName`, `gstin`, `source`, `value`, `notes`
- Lead Display: `id`, `name`, `phone`, `email`, `property`, `checkIn`, `checkOut`, `budget`, `pricePerNight`, `status`, `temperature`, `bookingType`, `assignedTo`, `lastContact`, `nextFollowUp`, `workingDays`, `workingHours`, `score`, `conversationHistory`
- Filtering: `status`, `property`, `temperature`, `bookingType`, `assignedTo`

### 4. Professional Ticket Management Module
**Purpose**: Support ticket system for guest issues
**Data Fields Used**:
- Ticket Creation: `title`, `category`, `priority`, `property`, `assignedAgent`, `guestName`, `guestPhone`, `guestEmail`, `description`
- Ticket Display: `id`, `title`, `description`, `status`, `priority`, `category`, `assignedTo`, `createdBy`, `guestName`, `roomNumber`, `property`, `createdDate`, `updatedDate`, `dueDate`, `estimatedHours`, `actualHours`, `comments`
- Property Agents Mapping: Property-specific agent assignments

### 5. CC Manager Dashboard Module
**Purpose**: Call center management and analytics
**Data Fields Used**:
- Call Metrics: `totalCalls`, `callsAnswered`, `fcr`, `avgAHT`, `reservations`, `cancellations`
- Agent Performance: `name`, `calls`, `fcr`, `aht`, `reservations`, `cancellations`, `score`
- Property Analysis: `property`, `calls`, `tickets`, `avgTAT`, `fcr`
- Ticket Analysis: `type`, `count`, `avgTAT`, `status`
- Hourly Data: `hour`, `calls`, `reservations`

### 6. Sales Executive Dashboard Module
**Purpose**: Individual sales executive workspace
**Data Fields Used**:
- Performance Metrics: YTD and current month statistics
- Lead Management: Personal lead portfolio with detailed tracking
- Ticket Management: Open tickets assigned to the executive
- Follow-up Management: Scheduled callbacks and meetings

### 7. Sales Head Dashboard Module
**Purpose**: Sales team oversight and performance management
**Data Fields Used**:
- Team Performance: Individual and team metrics
- Target vs Achievement: Conversion rates, revenue tracking
- Regional Analysis: Property-wise and region-wise performance
- Sales Pipeline: Lead progression and forecasting

### 8. Management Dashboard Module
**Purpose**: Executive-level reporting and analytics
**Data Fields Used**:
- Revenue Analytics: `leads`, `roomNights`, `arr`, `roomRevenue`, `totalRevenue`
- Sales Cycle Analysis: `team`, `leads`, `converted`, `conversionRate`, `salesCycle`, `arr`, `revenue`, `roomNights`
- Target Achievement: `category`, `type`, `target`, `delivered`, `roomNights`, `arr`, `salesCycleDays`
- Pipeline Analysis: Month-wise booking pipeline

### 9. Property Manager Dashboard Module
**Purpose**: Property-specific operations and guest services
**Data Fields Used**:
- Ticket Management: Property-specific support tickets
- Guest Services: Room maintenance, billing, service requests
- Response Tracking: Communication with call center and guests
- Performance Metrics: Response times, resolution rates

### 10. Knowledge Base Module
**Purpose**: Information repository for agents
**Sub-modules**:
- Properties View: Hotel information, amenities, pricing
- Fact Sheets: Property details, policies, procedures
- Templates: Email templates, response templates
- Resources: Training materials, contact information

### 11. Communication Modules
**Purpose**: Multi-channel guest communication
**Modules**:
- Email Dialog: Guest email communication
- SMS Dialog: Text message functionality  
- WhatsApp Dialog: WhatsApp messaging

---

## Key Data Relationships

### 1. User-Lead Assignment
- Each lead is assigned to a specific user (agent/executive)
- Assignment tracking with dates and performance metrics

### 2. Guest-Interaction History
- All guest touchpoints are tracked chronologically
- Includes calls, emails, and other communications

### 3. Property-User Mapping
- Property managers are assigned to specific properties
- Call center agents can handle multiple properties

### 4. Ticket-Resolution Flow
- Tickets flow from call center to property managers
- Response tracking and escalation management

### 5. Performance Hierarchy
- Individual agent performance rolls up to team metrics
- Team performance contributes to overall company metrics

---

## Data Validation Rules

### 1. Lead Management
- Phone number: Must be valid Indian mobile format (+91 XXXXX XXXXX)
- Email: Must be valid email format
- Check-in date: Must be future date
- Check-out date: Must be after check-in date
- Guest count: Must be positive integer

### 2. Ticket Management
- Priority levels: Urgent (immediate), High (<4hrs), Medium (<24hrs), Low (<72hrs)
- Status progression: Open → In Progress → Resolved → Closed
- Assignment: Must be to active property manager for the property

### 3. Performance Metrics
- Conversion rate: Percentage (0-100%)
- FCR rate: Percentage (0-100%)
- Score: Integer (0-100)
- Revenue: Positive decimal values

---

## Integration Points

### 1. External Systems
- Hotel PMS (Property Management System)
- Email service providers
- SMS gateways
- WhatsApp Business API
- Payment gateways

### 2. Reporting Systems
- Excel export functionality
- Dashboard analytics
- Performance reporting
- Revenue tracking

---

This document provides a comprehensive overview of the CRM system's database structure and module specifications. Each module has been designed to handle specific aspects of the customer relationship management process, from initial lead capture to post-stay follow-up and support.