---
name: recipe
description: "App architecture recipes for AppyStack projects. Use when a developer wants to build a specific type of application on top of the RVETS template — e.g. 'What recipes are available?', 'I want to build a CRUD app', 'I want a sidebar navigation layout', 'help me set up a nav-shell app', 'build me a file-based entity system', 'what can I build with AppyStack?', 'scaffold an app for me', 'I want a nav + data app'. Presents available recipes, generates a concrete build prompt for the chosen recipe, and asks for confirmation before building. Recipes can be used alone or combined."
---

# Recipe

## What Are Recipes?

Recipes are app architecture patterns that sit on top of the AppyStack RVETS template. Each recipe defines a specific structural shape — layout, data strategy, Socket.IO usage — that Claude scaffolds into the project.

Recipes are:
- **Stack-aware**: They know AppyStack's folder structure, installed libraries, and conventions
- **Composable**: Multiple recipes can run together (e.g. nav-shell + file-crud = a complete CRUD app)
- **Idempotent**: Each recipe checks whether it's already been applied before making changes

---

## Available Recipes

| Recipe | What it builds |
|--------|----------------|
| `nav-shell` | Left-sidebar navigation shell with header, collapsible sidebar, main content area, and optional footer. Menus can switch dynamically when sub-tools are active. Domain-agnostic layout scaffold. |
| `file-crud` | JSON file-based persistence for one or more entities. Each record is a file named `{slug}-{id}.json`. Real-time Socket.io sync. No database required. Includes chokidar file watcher. |

**Combinations:**
- `nav-shell` + `file-crud` = complete CRUD app with sidebar nav and file persistence
- `nav-shell` alone = visual shell, fill in data later
- `file-crud` alone = data layer only, wire up your own UI

**Reference files:**
- `references/nav-shell.md` — full nav-shell recipe spec
- `references/file-crud.md` — full file-crud recipe spec

**Sample data patterns** (for file-crud — real domain examples):
- `samples/support-signal.md` — NDIS/disability support app (5 entities)
- `samples/youtube-launch-optimizer.md` — YouTube content production (5 entities)

---

## Flow

1. **Identify** which recipe(s) fit. If intent is unclear, ask: "What kind of app are you building?" and present the table above.
2. **For file-crud**: ask if a sample data pattern applies, or collect entity details directly.
3. **Load** the relevant reference file(s). Load both if combining.
4. **Generate** a concrete build prompt — specific file structure, component names, data shapes, event names — tailored to this project. Not generic, not boilerplate descriptions.
5. **Present** the prompt: "Here's what I'll build: ..." Show the specifics.
6. **Ask**: "Shall I go ahead?"
7. **Build** on confirmation, following the patterns in the reference file(s).

---

## Combining Recipes

When running `nav-shell` + `file-crud` together, collect domain context before generating either build prompt:

1. Ask: what entities does the app need? (names, namish fields, key fields, relationships)
2. Ask: what views/tools does the app need? (these become nav items)
3. Ask: which entity maps to which view?
4. Then generate: shell build prompt (with real view names from step 2) + persistence build prompt (with real entities from step 1)

The shell recipe generates view stubs. The persistence recipe generates server handlers and the `useEntity` hook. The developer (or a follow-up step) wires the `useEntity` hook into the view stubs.

---

## Notes

- Keep the generated prompt grounded in what's already in the template. Don't introduce new dependencies unless the recipe explicitly calls for them.
- The generated prompt is a useful artifact — if the developer says "not quite", refine it before building rather than starting over.
- For file-crud, always clarify the "namish field" — what field is used to name the file? Usually `name`, but not always.
- For nav-shell, always clarify which items are primary vs secondary, and whether any view needs a context-aware menu.
