# Postcard CRM — Design System

Milky white workspace with navy sidebar navigation. Clean dropdowns, navy primary actions.

## Typography

| Role | Font | Usage |
|------|------|--------|
| UI | DM Sans | Body, labels, tables, buttons |
| Display | Fraunces | Page titles, login headline only |

## Color tokens (CSS variables)

| Token | Light | Purpose |
|-------|-------|---------|
| `--bg` | `#fafaf8` | App background (milky white) |
| `--surface` | `#ffffff` | Cards, panels, dropdowns |
| `--primary` | `#1e3a5f` | Brand / buttons / focus ring (navy) |
| `--primary-light` | `#eef2f7` | Active chips, subtle fills |
| `--text` | `#1e293b` | Primary text |
| `--text-muted` | `#64748b` | Secondary text |
| `--border` | `#e5e7eb` | Dividers |
| `--dropdown-hover` | `#f1f5f9` | Select/menu row hover |
| `--dropdown-selected` | `#e8eef5` | Selected option background |

### Sidebar (navy)

| Token | Value | Purpose |
|-------|-------|---------|
| `--sidebar-background` | `#1e3a5f` | Menu rail |
| `--sidebar-foreground` | `#e8eef5` | Nav text |
| `--sidebar-primary` | `#ffffff` | Active border + icon |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | Hover background |
| `--sidebar-menu-elevated` | `#254a73` | User menu popup |

Semantic: `--hot-*`, `--warm-*`, `--cold-*`, `--src-*`, `--stage-*` unchanged in meaning.

## Elevation

- `--shadow-1`: cards
- `--shadow-2`: dropdowns, modals

## Radius

- `--radius-sm`: 4px through `--radius-lg`: 10px

## Motion

- 120–180ms ease; no transform on button hover

## Patterns

- **Form wizard shell** (`FormWizardShell`): Shared dialog layout — header (title + subtitle + optional `WizardStepIndicator`), scrollable body, sticky footer. Use `rounded-lg border border-border bg-surface p-4` for step sections.
- **Add Lead wizard** (`AddLeadWizard`): 4-step dialog — Guest → Stay → Booking → Review. Step indicator in header; per-step validation before Continue; `createLead` payload unchanged.
- **Contact wizard** (`ContactWizard`): 5 steps — Identity → Reach → Role → Loyalty & dates → Review. Loyalty membership number when registered in program.
- **Contract wizard** (`ContractWizard`): Create (Basics → Parties → Rates → Review) saves contract + rate grid in one flow; Edit (Details → Rates → Save). Parties use canonical Postcard property list. Rates use `RateGrid` with CAT A/B/C sections, separate inclusion and remarks blocks, `embedded` in wizard.
- **View contract** (`ContractViewDialog`): Read-only dialog from contracts list; optional Edit shortcut.
- **Activities calendar** (`AccountTimeline`): Month date click selects day only (no refetch flicker); double-click opens `ActivityWizard` with pre-filled date; week grid slot click opens wizard.
- **Contract rate template**: `downloadContractRateTemplate()` CSV next to Upload Excel; backend import maps full rate grid columns into `contract.rateGrid`.
- **Account documents**: Local disk fallback when S3 is unavailable; clearer upload error messages.
- **Market potential**: `PotentialWizard` (4-step); tab uses `ProfileSection` and neutral stat tiles.
- **Activity wizard** (`ActivityWizard`): 3 steps — Who & when → Details → Review.
- **Accounts hub** (`AccountManagement`): Directory / Hierarchy / Week planner tabs; KPI strip; `FilterBar` for search and filters.
- **New account wizard** (`AccountCreationWizard`): 5 steps — Organization → Classification → Hierarchy → Location → Review & compliance. Post-create prompts for view profile or add contact.
- **Account detail** (`AccountDetail`): Getting-started checklist, quick actions (add contact, set follow-up), Profile tab with sectioned enterprise layout.

## Sidebar

- Width: 248px (collapsible to 64px)
- Background: navy (`--sidebar-background`)
- Active item: white left border + light white wash

## Anti-patterns

- Gradient KPI cards
- Glassmorphism
- Inline `onMouseEnter` style mutation on nav items
