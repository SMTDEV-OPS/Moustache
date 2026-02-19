# Frontend Actions Checklist - Lead Call (Direct Guest) Feature

## ✅ Available Actions

### Call Page (CallPage.tsx)
1. ✅ **Search guest by phone number** - Available via search input
2. ✅ **View guest history** - Shows previous leads, reservations, communications
3. ✅ **Create lead form** - All required fields:
   - Name, contact (phone/email)
   - Travel dates (check-in/check-out)
   - Hotel (property selection)
   - Occasion
   - Occupancy (adults/children)
   - First-time/repeat guest
   - Call status dropdown (Quotation Shared, Payment Pending, Not Interested)
   - Heat level selector (Hot, Warm, Cold)
   - Auto-tagged as Direct Guest source

### Lead Detail Page (LeadDetailPage.tsx)
4. ✅ **Update call status** - Available in Basic Information section (dropdown)
5. ✅ **View payment links** - Payment section shows all payment links
6. ✅ **View pending amount** - Displayed prominently if partial payment
7. ✅ **Create payment link manually** - Button added in Payment section
8. ✅ **Share quotation** - Available via "Send Quotation" button (opens SendQuotationDialog)
   - Can send via Email or WhatsApp
9. ✅ **Send email** - Available via "Compose Email" button
10. ✅ **Send SMS** - Available via CommunicationPanel component
11. ✅ **Send WhatsApp** - Available via CommunicationPanel component
12. ✅ **View communication timeline** - Unified timeline showing:
    - All communications (calls, emails, SMS, WhatsApp)
    - Email threads with replies
    - Quotation shares
    - Payment link sends
    - Client responses (inbound emails)
13. ✅ **Send confirmation letter** - Available when lead status is CONFIRMED

### Communication Panel (CommunicationPanel.tsx)
14. ✅ **Quick communication actions** - Standalone component for:
    - Send Email
    - Send SMS
    - Send WhatsApp

## ⚠️ Backend Automated Actions (Not Manual)

These actions are automated by the backend and don't require frontend UI:

1. ✅ **Auto-send 50% advance payment link** - Triggered when quotation is shared
2. ✅ **Auto-update lead status to ON_HOLD** - When partial payment received
3. ✅ **Auto-update lead status to CONFIRMED** - When full payment received
4. ✅ **Auto-create reservation** - When full payment received
5. ✅ **Auto-send confirmation letter** - When reservation is created
6. ✅ **Automated SMS follow-ups** - Daily until day before arrival (scheduled job)

## 📋 Summary

**All required manual actions are available in the frontend:**
- ✅ Guest search and lead creation
- ✅ Call status management
- ✅ Quotation sharing (Email/WhatsApp)
- ✅ Payment link creation and viewing
- ✅ Communication sending (Email/SMS/WhatsApp)
- ✅ Communication timeline viewing
- ✅ Confirmation letter sending

**All automated actions are handled by backend:**
- ✅ Payment link auto-creation
- ✅ Status updates on payment
- ✅ Reservation creation
- ✅ Confirmation letter auto-send
- ✅ SMS follow-up automation

## 🎯 Integration Points Ready

All placeholder interfaces are ready for future integration:
- External guest database search
- SMS provider (Twilio/Msg91)
- WhatsApp provider (Twilio/Meta)
- Payment gateway (Razorpay/PayU/HDFC)

