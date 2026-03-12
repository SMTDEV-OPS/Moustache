# Email Integration – What the Client Needs to Provide

This document is for **non-technical clients**. It explains what they need to share or do to connect their email to the CRM.

---

## Option 1: Gmail or Outlook (Easiest)

### What the client does
**Nothing to send in advance.**  
They connect their email **directly in the CRM** by clicking a button and signing in to their Google or Microsoft account in the popup. No passwords or settings need to be sent to anyone.

### What the client needs
- A **Gmail** (e.g. `abc@gmail.com`) **or** a **Microsoft 365 / Outlook** account (e.g. `abc@outlook.com` or company email on Microsoft 365)
- Access to the CRM’s Email Settings page (their login credentials)
- They must complete the “Connect Gmail” or “Connect Outlook” flow and approve access when prompted

### What you (admin) need to do
- Ensure Google / Microsoft OAuth is configured for the CRM (Google Cloud Console / Azure App Registration)
- Enable Gmail and/or Outlook in the CRM’s email settings

---

## Option 2: Company Email (e.g. info@company.com, sales@company.com)

If the client uses **their own domain email** (not Gmail or Outlook), they need to collect and send the **mail server details**. These are typically found in their hosting or email provider’s help pages or control panel.

### What to ask the client

> “Please provide the **mail server settings** for your email. Your email provider (GoDaddy, Zoho, Bluehost, etc.) usually has a page called ‘Mail Settings’, ‘Mail Setup’ or ‘IMAP/SMTP’ where you can find these.”

---

### Details the client must provide

| # | Item | Example | Where to find it |
|---|-----|---------|------------------|
| 1 | **Email address** | `info@company.com` | Their email ID |
| 2 | **Email password** | (use App Password if available) | Their password, or an “App Password” if 2FA is enabled |
| 3 | **Outgoing (SMTP) server** | `smtp.company.com` or `mail.company.com` | “Outgoing server” or “SMTP server” |
| 4 | **Outgoing port** | `465` or `587` | Next to “Outgoing” or “SMTP” |
| 5 | **Use SSL/TLS for outgoing** | Yes / No | Usually Yes for port 465, sometimes for 587 |
| 6 | **Incoming (IMAP) server** | `imap.company.com` or `mail.company.com` | “Incoming server” or “IMAP server” |
| 7 | **Incoming port** | `993` or `143` | Next to “Incoming” or “IMAP” |
| 8 | **Use SSL/TLS for incoming** | Yes / No | Usually Yes for port 993 |

---

### Simple request template for the client

You can send them something like:

---

**Subject: Email settings for CRM setup**

Hi [Client Name],

To connect your email (e.g. info@company.com) to the CRM, we need the **mail server settings**.

1. **Log in to your email provider** (e.g. GoDaddy, Zoho, Bluehost, Hostinger, etc.).
2. Open **Mail Settings**, **Mail Setup**, or **IMAP/SMTP**.
3. Fill out this form with the values shown there:

| Setting | Value (please fill) |
|--------|----------------------|
| Your email address | |
| Email password (or App Password if 2FA is on) | |
| Outgoing server (SMTP) | |
| Outgoing port (usually 465 or 587) | |
| Use SSL for outgoing? (Yes/No) | |
| Incoming server (IMAP) | |
| Incoming port (usually 993 or 143) | |
| Use SSL for incoming? (Yes/No) | |

4. Send this back in a secure way (encrypted email or secure link).  
   **Do not share this over regular unsecured channels.**

If your provider gives both IMAP and POP3, use **IMAP** settings.

If you can’t find these, contact your email provider’s support and ask for:  
**“IMAP and SMTP server settings for my email account.”**

---

### Common providers – quick reference for the client

| Provider | Where to find settings | Typical SMTP | Typical IMAP |
|----------|------------------------|--------------|--------------|
| **Zoho Mail** | Zoho Mail → Settings → Mail Accounts → IMAP access | `smtp.zoho.com` (465) | `imap.zoho.com` (993) |
| **GoDaddy** | Workspace Email → Settings → Forwarding & IMAP | `smtpout.secureserver.net` (465) | `imap.secureserver.net` (993) |
| **Bluehost** | cPanel → Email Accounts → Connect Devices | `mail.yourdomain.com` (465) | `mail.yourdomain.com` (993) |
| **Hostinger** | hPanel → Email → Accounts → Connect | `smtp.hostinger.com` (465) | `imap.hostinger.com` (993) |
| **Namecheap** | Product List → Email → Manage → Connect | `mail.privateemail.com` (465) | `mail.privateemail.com` (993) |
| **Yahoo** | Account → Security → Generate app password, then use IMAP | `smtp.mail.yahoo.com` (465) | `imap.mail.yahoo.com` (993) |
| **Proton Mail** | Bridge required for IMAP/SMTP | Via Proton Bridge | Via Proton Bridge |

---

### App password (when 2-step verification is on)

If the client has **2-step verification (2FA)** on their account, they should use an **App Password**, not their normal login password.

- **Gmail:** Google Account → Security → 2-Step Verification → App passwords → generate one.
- **Outlook / Microsoft 365:** Microsoft Account → Security → Advanced security → App passwords.
- **Yahoo:** Account settings → Security → Generate app password.
- **Zoho:** Zoho Account → Security → App Passwords.

Tell them to use this App Password in the “Email password” field and keep it secret.

---

### Security notes for the client

- Do **not** share these details over WhatsApp, regular email, or public channels.
- Prefer a secure/encrypted channel or a secure link for sharing.
- They can change the password after setup if they want (but they’ll need to update it in the CRM).

---

## Checklist – what the client actually needs to do

**Gmail or Outlook:**
- [ ] Have a Gmail or Microsoft account
- [ ] Go to CRM → Email Settings
- [ ] Click “Connect Gmail” or “Connect Outlook”
- [ ] Sign in and approve access when asked

**Company / other email:**
- [ ] Find mail settings in their email provider’s control panel
- [ ] Fill the table above with: email, password, SMTP & IMAP server, ports, and SSL options
- [ ] Send this securely to you
- [ ] You or your team will enter these in the CRM
