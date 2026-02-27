# Nav Shell Recipe

A header + left sidebar nav + main content panel layout. Clicking a nav item switches the content area. No page routing required — this is a single-page app shell with view state.

## Layout Structure

```
┌─────────────────────────────────────────────┐
│  Header (app name, right-side cog/actions)  │
├────────────┬────────────────────────────────┤
│            │                                │
│  Sidebar   │       Content Panel            │
│  Nav       │       (active view renders     │
│            │        here based on nav       │
│  - Group   │        selection)              │
│    - Item  │                                │
│    - Item  │                                │
│  - Group   │                                │
│    - Item  │                                │
│            │                                │
└────────────┴────────────────────────────────┘
```

## Component Structure

```
client/src/
├── components/
│   ├── AppShell.tsx          ← outer layout, composes header + sidebar + content
│   ├── Header.tsx            ← app title, right-side actions (settings cog, etc.)
│   ├── Sidebar.tsx           ← nav groups and items, highlights active item
│   └── ContentPanel.tsx      ← renders the active view
├── views/                    ← one file per nav item destination
│   ├── [ViewName]View.tsx
│   └── ...
└── config/
    └── nav.ts                ← nav structure definition (groups, items, view keys)
```

## Nav Config Shape

Define nav structure as data, not hardcoded JSX:

```typescript
// client/src/config/nav.ts
export interface NavItem {
  key: string        // unique identifier, used to switch views
  label: string      // display text
  icon?: string      // optional icon name
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navConfig: NavGroup[] = [
  {
    label: 'Group Name',
    items: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'settings', label: 'Settings' },
    ],
  },
]
```

## State Management

Single piece of state: `activeView` (string key). Lives in `App.tsx` or a context if views need to trigger nav changes.

```typescript
const [activeView, setActiveView] = useState<string>('dashboard')
```

`Sidebar` receives `activeView` + `onNavigate`. `ContentPanel` receives `activeView` and renders the matching view component.

## Content Panel Switching

```typescript
// ContentPanel.tsx
const viewMap: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  settings: SettingsView,
  // ...
}

const View = viewMap[activeView] ?? viewMap['dashboard']
return <View />
```

## Header

- Left: app name/logo
- Right: settings cog (opens a settings modal or navigates to settings view), optional user avatar

## Styling Notes

- Sidebar width: fixed (e.g. `w-56` or `w-64`)
- Header height: fixed (e.g. `h-14`)
- Content panel: fills remaining space, scrollable independently
- Active nav item: distinct background highlight
- Use TailwindCSS v4 CSS variables for sidebar/header colours so they're themeable

## What to Generate in the Build Prompt

When generating the prompt for this recipe, include:
- Specific view names based on the developer's domain (ask if not provided)
- Nav group names and which items go in which group
- Which view is active by default
- Any right-side header actions beyond the settings cog
