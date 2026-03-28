# Recipe: CSV Bulk Import

Adds a CSV bulk import modal to any entity in an AppyStack app. Discovered in Signal Studio's participant import feature. The pattern handles column validation, partial success reporting, and optional scope restriction for non-admin users.

---

## Recipe Anatomy

**Intent**
Allow users to create multiple records from a CSV file without entering them one-by-one. The import is modal-driven, validates columns before attempting any writes, and reports per-row results clearly.

**Type**: Additive — adds an import endpoint and modal to one entity. Can be applied to multiple entities separately.

**Stack Assumptions**
- AppyStack RVETS template (Express 5, Socket.io, TypeScript, React 19, TailwindCSS v4)
- Entity already exists with `file-crud` or ORM persistence (`fileStore.ts` or Prisma/Drizzle)
- Optionally: `add-auth` applied (required if scope restriction is needed)

**Idempotency Check**
Does `server/src/routes/{entity}/import.ts` exist? If yes → import endpoint already installed. Only generate new code for additional entities.

**Does Not Touch**
- `entitySocket.ts` singleton — import uses HTTP POST, not Socket.io (bulk writes are HTTP operations, not real-time events)
- `fileStore.ts` or ORM schema — calls existing persistence functions; does not change data model
- Auth middleware — if already installed, import route is protected the same as other entity routes

**Composes With**
- `file-crud` — calls `saveRecord()` per row after validation
- `add-auth` — scope restriction requires the authenticated user's scope assignment (e.g. company, team, org)
- `entity-socket-crud` — after import completes, emit `entity:external-change` so open views refresh automatically
- `domain-expert-uat` — import UAT test cases are generated as a dedicated test file (e.g. `docs/uat/12-csv-import.md`)

---

## Why HTTP, Not Socket.io

Bulk import is a request/response operation:
- Client uploads a file → Server validates, writes records → Server responds with results
- The full result (success count + failure rows) must arrive as one coherent response
- Socket.io's event-based pattern is better for streaming incremental updates, not bulk write results

After the import completes, the server emits `entity:external-change` over Socket.io so any open views automatically reload — getting both reliability (HTTP for the write) and real-time refresh (Socket.io for the notification).

---

## What Gets Added

```
server/src/
├── routes/
│   └── {entity}/
│       └── import.ts          ← POST /api/{entity}/import
│           Multer file upload, CSV parse, validation, write, result

client/src/
├── components/
│   └── {Entity}ImportModal.tsx  ← file picker, optional scope selector, progress, results
└── hooks/
    └── use{Entity}Import.ts     ← encapsulates fetch + result state
```

**Server dependencies added:**
```bash
npm install multer csv-parse
npm install -D @types/multer
```

---

## Server: Import Endpoint

```typescript
// server/src/routes/{entity}/import.ts
import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { saveRecord } from '../../data/fileStore.js'
import { io } from '../../index.js'          // Socket.io instance for post-import notification
import { authenticate } from '../../middleware/authenticate.js'  // if auth is installed

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Derive from entity type — see "Required Columns Configuration" below
const REQUIRED_COLUMNS = ['field1', 'field2', 'field3']
const ENTITY = '{entity}'

export const {entity}ImportRouter = Router()

{entity}ImportRouter.post(
  '/api/{entity}/import',
  authenticate,               // remove if no auth
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // If scope restriction is needed (e.g. companyId, teamId, orgId)
    const scopeId = req.body.scopeId as string | undefined
    if (!scopeId) {
      return res.status(400).json({ error: 'scopeId is required' })
    }

    // Parse CSV
    let rows: Record<string, string>[]
    try {
      rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true })
    } catch {
      return res.status(400).json({ error: 'Could not parse CSV — check file format' })
    }

    // Column validation (all-or-nothing: fail before any writes)
    const headers = rows[0] ? Object.keys(rows[0]) : []
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missing.join(', ')}`,
        requiredColumns: REQUIRED_COLUMNS,
      })
    }

    // Per-row processing (partial success: write valid rows, report failures)
    const results: { row: number; status: 'created' | 'failed'; reason?: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2  // 1-indexed + header row

      // Row-level validation — apply entity-specific validation rules per field
      // Examples: regex patterns, date parsing, enum membership, numeric ranges
      // See "The Recipe Intelligence Prompts" step 2 for how to gather these
      for (const col of REQUIRED_COLUMNS) {
        if (!row[col]?.trim()) {
          results.push({ row: rowNum, status: 'failed', reason: `Missing required field: ${col}` })
          continue
        }
      }
      // Add field-specific format validation here (dates, identifiers, enums, etc.)

      // Write
      try {
        await saveRecord(ENTITY, {
          ...row,
          scopeId,
          status: 'active',
        })
        results.push({ row: rowNum, status: 'created' })
      } catch (err) {
        results.push({ row: rowNum, status: 'failed', reason: String(err) })
      }
    }

    // Notify open views to refresh
    const created = results.filter(r => r.status === 'created').length
    if (created > 0) {
      io.emit('entity:external-change', { entity: ENTITY })
    }

    const failed = results.filter(r => r.status === 'failed')
    return res.json({
      total: rows.length,
      created,
      failed: failed.length,
      failures: failed,
    })
  }
)
```

**Mount in `server/src/index.ts`:**
```typescript
import { {entity}ImportRouter } from './routes/{entity}/import.js'
app.use({entity}ImportRouter)
```

---

## Validation Strategy: All-or-Nothing vs Partial Success

The recipe supports both. Ask the developer which they prefer:

| Strategy | Behaviour | Best when |
|----------|-----------|-----------|
| **All-or-nothing** | Any invalid row → entire import rejected, nothing written | Data integrity is critical; operator must fix CSV before any records are created |
| **Partial success** | Valid rows are written; failed rows reported with row number and reason | Large imports where some rows may have typos; operator fixes failures after the fact |

The template above implements **partial success**. This is the recommended default because large real-world CSV files almost always contain a few bad rows, and forcing operators to fix every row before any are imported creates frustration. To switch to all-or-nothing: validate all rows first, return early if any fail, then do the writes in a second pass.

---

## Client: Import Modal

The import modal component manages a multi-state flow. Build it with these capabilities:

**States and transitions:**

1. **Ready** (initial) — the modal is open, no import has started
2. **Importing** — upload in progress, the import button is disabled
3. **Complete** — results are displayed, the import button is replaced with a close action

**Contents:**

- **File picker** — accepts `.csv` files only. Visible in Ready state, hidden once results arrive.
- **Scope selector** (optional, only when auth is installed) — if the user is an admin, show a dropdown of available scopes (e.g. companies, teams) so they can choose which scope to import into. If the user is not an admin, display their assigned scope as read-only text. This prevents non-admin users from importing into scopes they do not belong to.
- **Import button** — triggers the upload. Disabled while importing. Hidden after results arrive.
- **Cancel / Close button** — labelled "Cancel" before import, "Close" after results arrive.
- **Error display** — shows server-returned error messages (missing columns, network failure, etc.).
- **Result summary** — after import completes, show: how many records were created out of the total, and a per-row failure list with row number and reason.

**Hook:** Extract the fetch call and result state into a `use{Entity}Import` hook. The hook accepts a `File` and scope ID, calls `POST /api/{entity}/import` with `FormData`, and returns `{ result, error, importing, doImport }`.

---

## Scope Restriction Pattern

Scope restriction is the most important non-obvious requirement. If the app has roles:

| User role | Scope selector | Behaviour |
|-----------|----------------|-----------|
| Admin | Visible, all scopes listed | Can import into any scope |
| Non-admin | Hidden or read-only | Import automatically scoped to their assigned scope |

The server enforces this regardless of what the client sends:

```typescript
// In the import endpoint — enforce scoping server-side even if client misbehaves
const effectiveScopeId = req.user?.role === 'admin'
  ? (req.body.scopeId as string)
  : req.user?.scopeId   // non-admin always uses their own scope

if (!effectiveScopeId) {
  return res.status(400).json({ error: 'scopeId could not be determined' })
}
```

---

## Required Columns Configuration

Define required columns as a constant that the recipe reads from the entity type. Claude should:

1. Read `shared/src/types.ts`
2. Find the entity type
3. Identify required fields (non-optional, non-generated — exclude `id`, `createdAt`, FKs added by the modal)
4. Present the list: "Your {Entity} type requires these fields. I suggest these as the CSV required columns: [list]. Confirm or adjust?"

---

## The Recipe Intelligence Prompts

**Step 1 — Read entity type:**
> "I found the {Entity} type with fields: [list all fields]. Which fields should be required in the CSV? (id, createdAt, and FK fields are usually excluded — they're set by the import process itself.)"

**Step 2 — Validation rules:**
> "Are there format rules for any fields? (e.g. an identifier must match a specific pattern, dates must be YYYY-MM-DD, a field must be one of a fixed set of values)"

**Step 3 — Partial success or all-or-nothing?**
> "If some rows have invalid data, should the import: (a) write the valid rows and report failures, or (b) reject the entire file until all rows are fixed?"

**Step 4 — Scope restriction:**
> "Is auth installed? If yes, should non-admin users be restricted to importing into their own scope only?"

**Step 5 — Post-import notification:**
> "Should a Socket.io `entity:external-change` event be emitted after import so open list views refresh automatically?"

---

## Sample CSV for Testing

Include a sample CSV in `docs/` so domain experts can test without building their own file. Generate column headers from the required columns identified in step 1, and include 3-5 rows of realistic sample data for the entity being imported.

---

## Anti-Patterns

**Don't write rows before validating all columns.**
If a required column is missing, fail immediately before any rows are parsed — don't write the first few rows then discover the schema is wrong on row 4.

**Don't silently drop rows.**
If a row fails, report it. The domain expert needs to know which rows failed and why so they can fix the source data.

**Don't trust the client for scope restriction.**
A non-admin can modify form data in the browser. Always enforce scoping on the server using the authenticated user's scope assignment.

**Don't use Socket.io for the import write operation.**
Bulk write is request/response, not event-driven. Use HTTP POST + multer. Socket.io is for the post-import refresh notification only.

**Don't import without checking for duplicates.**
Define the duplicate key for the entity (e.g. a unique identifier field, an email address). Either reject duplicates with a clear message or upsert — but never silently create a second record with the same unique field value.

---

## When to Use This Recipe

- An entity has many records and manual one-by-one data entry is impractical
- A domain expert or administrator is responsible for onboarding data in bulk
- The data exists in spreadsheets that can be exported as CSV
- You need to migrate data from a legacy system

---

## What to Collect Before Generating

1. **Entity name** — which entity is being imported? (e.g. `participants`, `sites`)
2. **Required CSV columns** — which fields must be present? (derived from entity type)
3. **Validation rules** — format constraints per field
4. **Partial success or all-or-nothing?** — how to handle mixed valid/invalid rows
5. **Scope restriction?** — is auth installed? Do non-admins have a scope restriction?
6. **Duplicate key?** — what field identifies a duplicate? (used to reject or upsert)
7. **Post-import notification?** — emit `entity:external-change` after writes?
