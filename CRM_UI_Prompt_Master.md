# Postcard CRM — Frontend Rebuild Master Context

## MANDATORY READING BEFORE ANY CODE
Read and strictly follow: /Users/adarsh/MyRepo/Postcard/.agents/skills/uncodixfy/Uncodixfy.md

and use /Users/adarsh/MyRepo/Postcard/.agents/skills/uncodixfy/SKILL.md

This defines what NOT to do. Every violation will require a redo.

## Tech Stack (do not change)
- Framework: whatever the current frontend uses (React / Next.js — check package.json)
- Icons: Lucide React (lucide-react) — install if not present
- Styling: check existing setup (Tailwind or CSS modules) — extend, don't replace
- HTTP: use existing API client/axios instance — do not create new ones
- Auth: use existing auth context/hooks — do not touch auth logic

## Design Tokens — apply globally first
```css:root {
/* Palette: Porcelain Clean */
--bg:          #f9fafb;
--surface:     #ffffff;
--primary:     #4f46e5;
--primary-light: #f0f0ff;
--secondary:   #8b5cf6;
--accent:      #ec4899;
--text:        #111827;
--text-muted:  #6b7280;
--text-faint:  #9ca3af;
--border:      #e5e7eb;
--border-light:#f3f4f6;
--hover:       #f9fafb;/* Heat colours */
--hot-bg:      #fef2f2;   --hot-text:   #ef4444;
--warm-bg:     #fffbeb;   --warm-text:  #f59e0b;
--cold-bg:     #eff6ff;   --cold-text:  #3b82f6;/* Source badge colours */
--src-ivr-bg:      #fef3c7; --src-ivr-text:    #92400e;
--src-wa-bg:       #d1fae5; --src-wa-text:     #065f46;
--src-web-bg:      #ede9fe; --src-web-text:    #5b21b6;
--src-call-bg:     #dbeafe; --src-call-text:   #1e40af;
--src-email-bg:    #fce7f3; --src-email-text:  #9d174d;/* Spacing scale */
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
--sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;/* Typography */
--font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--radius-sm: 4px;
--radius:    6px;
--radius-md: 8px;
--shadow:    0 1px 3px rgba(0,0,0,0.08);
}

## HARD RULES (from Uncodixfy — violations = redo)
- NO gradients anywhere
- NO border-radius above 8px (avatars are full circles — exception)
- NO box-shadow above `0 1px 3px rgba(0,0,0,0.08)`
- NO glassmorphism, blur, frosted panels
- NO hover transforms (no translateX/Y/scale)
- NO hero sections or decorative copy inside any page
- NO uppercase text except table column headers + nav section labels
- NO pill buttons (max radius 8px)
- NO colored glows
- NO KPI card grids as default dashboard layout
- NO eyebrow labels
- NO serif fonts
- NO transition > 150ms
- NO decorative icon backgrounds (no circles/squares behind icons)
- NO gradient on logo/brand area

## Sidebar Spec (applies to every page)
- Width: 240px, fixed, background #ffffff, border-right 1px solid var(--border)
- Logo area: 56px height, 20px left padding, no gradient behind logo
- Nav section labels: 10px, var(--text-faint), uppercase, letter-spacing 0.08em,
  padding 16px 20px 6px
- Nav items: height 36px, 14px, padding 0 12px 0 20px, flex + gap 10px
- Icons: 16px Lucide, strokeWidth 1.5, color var(--text-muted) default
- Active item: bg var(--primary-light), left border 2px solid var(--primary),
  text + icon color var(--primary), font-weight 500
- Hover: bg var(--hover) only — no movement
- Bottom user row: 56px, border-top 1px solid var(--border),
  32px avatar circle (initials), name 13px + role 11px, chevron

## Sidebar Nav Items + Icons (Lucide)
Navigation:
  Dashboard       → LayoutDashboard
  Call Center     → Phone
  Leads           → Users
  Follow Ups      → Clock
  My Calendar     → Calendar
  Reports         → BarChart2
  Buddy           → UserCheck
  Tickets         → Ticket
Resources:
  Knowledge Base  → BookOpen
Email:
  Email Client    → Mail
  Email Settings  → Settings2
  Email Health    → Activity

## Page Header Spec (applies to every page)
- Height max 60px, flush top of content area
- Title: 22px, font-weight 600, var(--text), no gradient
- Subtitle: 14px, var(--text-muted), margin-top 2px
- Right side: action buttons only
- Primary button: bg var(--primary), white text, 14px,
  radius var(--radius-md), padding 8px 16px, no shadow, no gradient

## Backend API Reference (all engines now live)
Base URL: /api

### E1 Field Builder
GET    /api/admin/fields?entity=lead
POST   /api/admin/fields
PUT    /api/admin/fields/:id
DELETE /api/admin/fields/:id
PUT    /api/admin/fields/reorder

### E2 Pipeline Builder
GET    /api/admin/pipelines
POST   /api/admin/pipelines
GET    /api/admin/pipelines/:id/stages
POST   /api/admin/pipelines/:id/stages
PUT    /api/admin/pipelines/:id/stages/:sid
DELETE /api/admin/pipelines/:id/stages/:sid
PUT    /api/admin/pipelines/:id/stages/reorder

### E3 Scoring & Call Quality
GET/POST/PUT/DELETE /api/admin/scoring/thresholds
GET/POST/PUT/DELETE /api/admin/call-quality/dimensions
PUT                 /api/admin/call-quality/dimensions/reorder
POST /api/leads/:id/call-quality
GET  /api/leads/:id/call-quality

### E4 Follow-up Rules
GET/POST/PUT/DELETE /api/admin/followup-rules
PUT                 /api/admin/followup-rules/reorder

### E5 Workflow Engine
GET/POST/PUT/DELETE /api/admin/workflows
POST /api/admin/workflows/:id/test
GET  /api/admin/workflows/:id/logs
GET  /api/admin/workflows/logs/lead/:leadId

### E6 Allocation Rules
GET/PUT  /api/admin/allocation/config
GET      /api/admin/allocation/workload
PUT      /api/admin/allocation/workload/:agentId/availability

### E7 Infrastructure
GET/POST/PUT/DELETE /api/filters
POST /api/filters/:id/apply
GET  /api/admin/audit-log
GET/POST/PUT/DELETE /api/admin/integrations
GET/POST/PUT/DELETE /api/admin/integrations/:id/mappings
POST /api/admin/integrations/:id/verify
GET  /api/dashboard/widgets/library
GET  /api/dashboard/config
PUT  /api/dashboard/config
GET  /api/dashboard/widgets/:widget_type/data

## Page Build Order
Build EXACTLY in this order. One page per Cursor session.
1. Design tokens + global styles
2. Sidebar component
3. Shared layout shell
4. Leads list page
5. Lead detail page
6. Setup hub page
7. Field Builder settings page
8. Pipeline Builder settings page
9. Scoring Engine settings page
10. Follow-up Rules settings page
11. Workflow Builder settings page
12. Allocation Rules settings page
13. Saved Filters settings page
14. Integration Hub settings page
15. Audit Log page
16. Dashboard page
17. Follow Ups page
18. Reports page
19. Call Quality scoring UI (on lead detail)
20. Dashboard widget config