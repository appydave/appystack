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
| `zod-schema` | Runtime schema validation for file-CRUD entities — Zod schemas as source of truth, integrity checker, client-side form validation | [See below](#zod-schema-validation) |

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

## Zod Schema Validation

**Extends**: [file-crud recipe](../template/.claude/skills/recipe/references/file-crud.md). Apply file-crud first (or have an existing file-based CRUD project), then layer this recipe on top.

The file-CRUD recipe stores records as JSON on disk and types them with TypeScript interfaces. Those interfaces provide compile-time safety only — the TypeScript compiler cannot inspect a JSON file at runtime. Any JSON file written externally (by a seed script, a manual edit, a git pull, or a publish pipeline) can arrive with missing fields, wrong types, or stale enum values, and the app will silently accept it.

This recipe introduces Zod as the **single source of truth** for entity shape: Zod schemas live in `shared/src/schemas/`, TypeScript types are derived from them (not maintained separately), and the same schemas are reused on the server for integrity checking and on the client for form validation.

---

### When You Need This

Add Zod schemas when one or more of the following is true:

- JSON files can be edited outside the app (Git, scripts, manual edits)
- You want an integrity checker: "scan all files for schema violations"
- Your forms need validation logic beyond HTML required/maxLength
- You want the schema in one place rather than TypeScript interfaces + separate validation rules

Skip it when: the data only ever comes from your own app, the entity has two or three fields, and you have no form validation needs. TypeScript interfaces are sufficient then.

---

### 1. Install Zod

Zod belongs in the `shared` package so both the server and client can import it from one place.

```bash
# from the repo root
npm install zod --workspace=shared
```

Verify `shared/package.json` now lists `zod` in `dependencies` (not `devDependencies` — it runs at runtime).

---

### 2. Folder Structure

```
shared/src/
├── schemas/
│   ├── entity.ts          ← base schemas (id, timestamps)
│   ├── company.ts         ← entity-specific schema
│   └── index.ts           ← barrel export
├── types/
│   └── entity.ts          ← keep existing interfaces during migration (see §8)
└── index.ts               ← re-exports schemas alongside types
```

---

### 3. Define Schemas as the Source of Truth

Define the Zod schema first, then derive the TypeScript type from it. Do not maintain both a `z.object(...)` and a separate `interface` — they will drift.

```typescript
// shared/src/schemas/entity.ts

import { z } from 'zod'

// Timestamps are always ISO 8601 strings — added by fileStore on create/update
export const TimestampsSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

// id and filename are injected from the filename at read time, never stored in the file body
export const FileRecordMetaSchema = z.object({
  id:       z.string().length(5),
  filename: z.string().regex(/^.+-[a-z0-9]{5}\.json$/),
})
```

```typescript
// shared/src/schemas/company.ts

import { z } from 'zod'
import { TimestampsSchema, FileRecordMetaSchema } from './entity.js'

export const CompanySchema = z
  .object({
    name:   z.string().min(1),
    abn:    z.string().regex(/^\d{11}$/).optional(),
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .merge(TimestampsSchema)
  .merge(FileRecordMetaSchema)

// Derive the TypeScript type — no separate interface needed
export type Company = z.infer<typeof CompanySchema>

// Partial schema used for form validation (id/filename/timestamps not present on the form)
export const CompanyFormSchema = CompanySchema.omit({
  id: true, filename: true, createdAt: true, updatedAt: true,
})
export type CompanyFormData = z.infer<typeof CompanyFormSchema>
```

```typescript
// shared/src/schemas/index.ts

export * from './entity.js'
export * from './company.js'
// export * from './site.js'   ← add as you go
```

```typescript
// shared/src/index.ts — add alongside existing type exports

export * from './schemas/index.js'
// existing: export * from './types/index.js'
```

---

### 4. Validate Records on Load in fileStore

The existing `fileStore.ts` trusts whatever JSON.parse returns. Add a validated wrapper that runs the schema at the point of reading a record.

This does **not** replace `fileStore.ts` — it wraps it so you can adopt validation incrementally per entity.

```typescript
// server/src/data/validatedStore.ts

import { ZodSchema, ZodError } from 'zod'
import { getRecord, listRecords } from './fileStore.js'

export interface ValidationError {
  id:       string
  filename: string
  issues:   { path: string; message: string }[]
}

export interface ValidatedRecord<T> {
  data:   T | null
  errors: ValidationError | null
}

/**
 * Load a single record and validate it against a Zod schema.
 * Returns { data, errors } — never throws.
 */
export async function getValidatedRecord<T>(
  entity:   string,
  id:       string,
  schema:   ZodSchema<T>,
): Promise<ValidatedRecord<T>> {
  const raw = await getRecord(entity, id)
  if (!raw) return { data: null, errors: null }

  const result = schema.safeParse(raw)
  if (result.success) {
    return { data: result.data, errors: null }
  }

  return {
    data:   null,
    errors: {
      id,
      filename: String(raw.filename ?? ''),
      issues:   result.error.issues.map((i) => ({
        path:    i.path.join('.'),
        message: i.message,
      })),
    },
  }
}
```

Usage in a Socket.io handler or REST route:

```typescript
import { getValidatedRecord } from '../data/validatedStore.js'
import { CompanySchema } from '@your-app/shared'

const { data, errors } = await getValidatedRecord('companies', id, CompanySchema)
if (errors) {
  console.warn('Schema violation in', errors.filename, errors.issues)
  // decide: surface the error, return partial data, or skip the record
}
```

---

### 5. Integrity Checker: Scan All Files for an Entity

An integrity check loads every file for an entity, runs each through the schema, and reports all violations. This is the runtime equivalent of `tsc --noEmit` — run it on startup, on demand via an admin route, or as a CI check.

```typescript
// server/src/data/integrityCheck.ts

import { ZodSchema } from 'zod'
import { listRecords, getRecord } from './fileStore.js'
import { ValidationError } from './validatedStore.js'

export interface IntegrityReport {
  entity:     string
  totalFiles: number
  passed:     number
  failed:     number
  errors:     ValidationError[]
}

export async function checkEntityIntegrity<T>(
  entity: string,
  schema: ZodSchema<T>,
): Promise<IntegrityReport> {
  const index  = await listRecords(entity)
  const errors: ValidationError[] = []

  for (const entry of index) {
    const raw    = await getRecord(entity, entry.id)
    const result = schema.safeParse(raw)

    if (!result.success) {
      errors.push({
        id:       entry.id,
        filename: entry.filename,
        issues:   result.error.issues.map((i) => ({
          path:    i.path.join('.'),
          message: i.message,
        })),
      })
    }
  }

  return {
    entity,
    totalFiles: index.length,
    passed:     index.length - errors.length,
    failed:     errors.length,
    errors,
  }
}
```

Wire it to an admin REST endpoint:

```typescript
// server/src/routes/integrity.ts

import { Router } from 'express'
import { checkEntityIntegrity } from '../data/integrityCheck.js'
import { CompanySchema } from '@your-app/shared'

const router = Router()

router.get('/api/integrity', async (_req, res) => {
  const companies = await checkEntityIntegrity('companies', CompanySchema)
  // add more entities as you add schemas
  res.json({ reports: [companies] })
})

export default router
```

Example response for a project with one invalid file:

```json
{
  "reports": [
    {
      "entity": "companies",
      "totalFiles": 12,
      "passed": 11,
      "failed": 1,
      "errors": [
        {
          "id": "x9q2m",
          "filename": "acme-corp-x9q2m.json",
          "issues": [
            { "path": "status",  "message": "Invalid enum value. Expected 'active' | 'inactive', received 'enabled'" },
            { "path": "updatedAt", "message": "Invalid datetime string" }
          ]
        }
      ]
    }
  ]
}
```

---

### 6. Referential Integrity

The file-CRUD pattern has no foreign-key constraints. `company.id` stored inside a `site.companyId` field is just a string — nothing prevents the company from being deleted while sites still reference it. Check cross-entity references manually in the integrity runner.

```typescript
// server/src/data/integrityCheck.ts  (add to existing file)

import { listRecords } from './fileStore.js'

export interface ReferentialError {
  entity:    string
  id:        string
  filename:  string
  field:     string
  missingId: string
}

/**
 * Check that every value in `foreignKeyField` exists as an id in `targetEntity`.
 * Pass `{ nullable: true }` if the FK can be null/undefined (skip nulls).
 */
export async function checkForeignKeys(
  sourceEntity:    string,
  foreignKeyField: string,
  targetEntity:    string,
  options:         { nullable?: boolean } = {},
): Promise<ReferentialError[]> {
  const sources = await listRecords(sourceEntity)
  const targets = await listRecords(targetEntity)
  const targetIds = new Set(targets.map((t) => t.id))
  const errors: ReferentialError[] = []

  for (const src of sources) {
    const fkValue = src[foreignKeyField]
    if (options.nullable && (fkValue == null || fkValue === '')) continue
    if (typeof fkValue === 'string' && !targetIds.has(fkValue)) {
      errors.push({
        entity:    sourceEntity,
        id:        src.id,
        filename:  src.filename,
        field:     foreignKeyField,
        missingId: fkValue,
      })
    }
  }

  return errors
}
```

Usage — check that every site's `companyId` points to a real company:

```typescript
const orphanedSites = await checkForeignKeys('sites', 'companyId', 'companies', { nullable: true })
```

---

### 7. Client-Side Form Validation

The same Zod schema (specifically the `FormSchema` variant) plugs into React forms. The example below uses plain React state — swap in react-hook-form + @hookform/resolvers/zod if you prefer that pattern.

```typescript
// client/src/components/CompanyForm.tsx

import { useState } from 'react'
import { CompanyFormSchema, type CompanyFormData } from '@your-app/shared'
import { ZodError } from 'zod'

export function CompanyForm({ onSave }: { onSave: (data: CompanyFormData) => void }) {
  const [formData, setFormData] = useState<Partial<CompanyFormData>>({ status: 'active' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = CompanyFormSchema.safeParse(formData)
    if (!result.success) {
      const mapped: Record<string, string> = {}
      for (const issue of result.error.issues) {
        mapped[issue.path[0] as string] = issue.message
      }
      setFieldErrors(mapped)
      return
    }
    setFieldErrors({})
    onSave(result.data)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name ?? ''}
        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
        placeholder="Company name"
      />
      {fieldErrors.name && <p className="text-red-500">{fieldErrors.name}</p>}

      <select
        value={formData.status ?? 'active'}
        onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as 'active' | 'inactive' }))}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <button type="submit">Save</button>
    </form>
  )
}
```

The `CompanyFormSchema` is defined once in `shared/` and imported by both the server (integrity check) and the client (form validation). No duplication.

---

### 8. Migration Path: Adding Zod to an Existing Project

If you already have TypeScript interfaces in `shared/src/types/`, do not delete them immediately — other code may import them by name. Introduce Zod incrementally:

**Step 1 — Install and scaffold** (§1–2 above). No existing code changes yet.

**Step 2 — Add one schema per entity.** Start with the entity that has the most validation pain (enum fields, optional FK references, required fields that arrive empty).

**Step 3 — Export the Zod-derived type under the same name as the existing interface**, then delete the hand-written interface. Because `z.infer<>` produces a structural equivalent, most consumers will not notice.

```typescript
// Before (shared/src/types/company.ts)
export interface Company {
  id: string
  name: string
  status: 'active' | 'inactive'
  // ...
}

// After (shared/src/schemas/company.ts) — same exported name, derived from schema
export const CompanySchema = z.object({ ... })
export type Company = z.infer<typeof CompanySchema>
//   ^^^^ same name — importers need no change
```

**Step 4 — Add validation at the read boundary** (§4). Start with `safeParse` + a console.warn for now; surface errors to the UI later.

**Step 5 — Wire the integrity checker** (§5–6) as an admin-only route. Run it manually until you're confident the data is clean; then add it to the startup log.

**Step 6 — Add client form validation** (§7) per form, one at a time.

At no point do you need a "big bang" migration. Each step is independently deployable.

---

### Summary

| What | Where | Used by |
|------|-------|---------|
| Base schemas (timestamps, meta) | `shared/src/schemas/entity.ts` | All entities |
| Entity schemas + derived types | `shared/src/schemas/{entity}.ts` | Server + client |
| Form schemas (omit server fields) | Same file, exported as `{Entity}FormSchema` | Client forms |
| Validated record loader | `server/src/data/validatedStore.ts` | Socket handlers, REST routes |
| Integrity checker | `server/src/data/integrityCheck.ts` | Admin route, CI |
| Referential integrity checker | `server/src/data/integrityCheck.ts` | Admin route |

---

*Last updated: 2026-03-11*
