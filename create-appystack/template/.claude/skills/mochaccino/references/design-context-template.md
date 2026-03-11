# [App Name] Design Context

Reference for Mochaccino mockup generation. When this file exists, Mochaccino
reads it first instead of running full discovery. Fill it in after your first
Mochaccino run, or whenever your design system is settled.

---

## Brand Colours

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#______` | Primary brand colour, CTAs, active states |
| `--color-primary-hover` | `#______` | Hover on primary elements |
| `--color-background` | `#______` | Page background |
| `--color-foreground` | `#______` | Primary text, headings |
| `--color-muted-foreground` | `#______` | Secondary text, labels |
| `--color-border` | `#______` | Borders, dividers |
| `--color-card` | `#______` | Card/panel backgrounds |
| `--color-success` | `#______` | Success states |
| `--color-warning` | `#______` | Warnings |
| `--color-destructive` | `#______` | Errors, destructive actions |

_Add or remove rows to match your actual design system._

---

## Dark Mode Colours (if supported)

| Token | Value |
|-------|-------|
| `--color-background` | `#______` |
| `--color-card` | `#______` |
| `--color-foreground` | `#______` |
| `--color-muted-foreground` | `#______` |
| `--color-border` | `#______` |
| `--color-primary` | `#______` |

---

## Visual Conventions

- **Font**: [e.g. System sans-serif / Inter / custom]
- **Border radius**: [e.g. 4px inputs, 6px buttons, 8px cards]
- **Shadows**: [e.g. light — `0 1px 3px rgba(0,0,0,0.08)` for cards]
- **Tables**: [e.g. striped rows / hover highlight / navy headings]
- **Badges / status chips**: [describe colour conventions for statuses]

---

## Shell Layout (if using nav-shell recipe)

| Variable | Value |
|----------|-------|
| Header height | `______` |
| Sidebar expanded | `______` |
| Sidebar collapsed | `______` |
| Sidebar position | left / right |

---

## Entity Data Location

Where does real data live in this project?

- [ ] `data/[entity]/[id].json` — JSON file persistence (file-crud recipe)
- [ ] `shared/src/types.ts` — TypeScript interfaces only (no file data)
- [ ] Database — describe location of seed/fixture data: `__________`
- [ ] Other: `__________`

---

## Mockup Conventions (project-specific)

_Override Mochaccino defaults here if needed._

- Default viewport: [1280px desktop / 375px mobile / other]
- Banner style: [default / custom colours]
- Dark mode toggle: [include by default / only when relevant / never]
