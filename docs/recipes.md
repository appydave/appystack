# AppyStack Recipes

Recipes are app architecture patterns that sit on top of the AppyStack RVETS template. Each recipe defines a specific structural shape — layout, data strategy, API exposure — that Claude scaffolds into the project.

Recipes are:
- **Stack-aware** — they know AppyStack's folder structure, installed libraries, and conventions
- **Composable** — multiple recipes can run together
- **Idempotent** — each recipe checks whether it's already been applied

---

## Available Recipes

| Recipe | What it builds | Reference |
|--------|----------------|-----------|
| `nav-shell` | Left-sidebar navigation shell — collapsible sidebar, header, content area, context-aware menus | [nav-shell.md](../template/.claude/skills/recipe/references/nav-shell.md) |
| `file-crud` | JSON file-based persistence for one or more entities — real-time Socket.io sync, chokidar watcher, no database required | [file-crud.md](../template/.claude/skills/recipe/references/file-crud.md) |
| `api-endpoints` | REST API layer with OpenAPI/Swagger documentation — exposes entities as external-facing endpoints with auth and CORS | [api-endpoints.md](../template/.claude/skills/recipe/references/api-endpoints.md) |

---

## Common Combinations

| Combination | What you get |
|------------|-------------|
| `nav-shell` + `file-crud` | Complete CRUD app — sidebar nav + file persistence |
| `nav-shell` alone | Visual shell to fill with any data layer later |
| `file-crud` + `api-endpoints` | Local file data + externally accessible API |
| All three | Full-stack app with UI, persistence, and public API |

---

## Domain DSLs

Domain DSLs are structured markdown files that define application entities — fields, types, relationships, and nav mapping. They are the **input** to `file-crud` (and optionally `nav-shell`).

| Domain | Entities | File |
|--------|----------|------|
| `care-provider-operations` | Company, Site, User, Participant, Incident, Moment | [care-provider-operations.md](../template/.claude/skills/recipe/domains/care-provider-operations.md) |
| `youtube-launch-optimizer` | Channel, Video, Script, ThumbnailVariant, LaunchTask | [youtube-launch-optimizer.md](../template/.claude/skills/recipe/domains/youtube-launch-optimizer.md) |

---

## Using Recipes

The `recipe` skill in `.claude/skills/recipe/SKILL.md` handles the full flow:
1. Presents available recipes
2. Loads the relevant reference file(s) and domain DSL if applicable
3. Generates a concrete, project-specific build prompt
4. Asks for confirmation before building

Trigger it by asking Claude: *"What recipes are available?"*, *"I want to build a CRUD app"*, *"scaffold a nav-shell app for me"*, etc.

---

*Last updated: 2026-03-04*
