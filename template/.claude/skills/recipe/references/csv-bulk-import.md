# Recipe: CSV Bulk Import

Adds a CSV bulk import modal to any entity in an AppyStack app. Validated by Signal Studio's participant import feature. The pattern handles column validation, partial success reporting, and company scoping for non-admin users.

---

## Recipe Anatomy

**Intent**
Allow users to create multiple records from a CSV file without entering them one-by-one. The import is modal-driven, validates columns before attempting any writes, and reports per-row results clearly.

**Type**: Additive — adds an import endpoint and modal to one entity. Can be applied to multiple entities separately.

**Stack Assumptions**
- AppyStack RVETS template (Express 5, Socket.io, TypeScript, React 19, TailwindCSS v4)
- Entity already exists with `file-crud` or ORM persistence (`fileStore.ts` or Prisma/Drizzle)
- Optionally: `add-auth` applied (required if company scoping is needed)

**Idempotency Check**
Does `server/src/routes/{entity}/import.ts` exist? If yes → import endpoint already installed. Only generate new code for additional entities.

**Does Not Touch**
- `entitySocket.ts` singleton — import uses HTTP POST, not Socket.io (bulk writes are HTTP operations, not real-time events)
- `fileStore.ts` or ORM schema — calls existing persistence functions; does not change data model
- Auth middleware — if already installed, import route is protected the same as other entity routes

**Composes With**
- `file-crud` — calls `saveRecord()` per row after validation
- `add-auth` — company scoping requires the authenticated user's company assignment
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
│   └── {Entity}ImportModal.tsx  ← file picker, company dropdown, progress, results
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
// server/src/routes/participants/import.ts
import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { saveRecord } from '../../data/fileStore.js'
import { io } from '../../index.js'          // Socket.io instance for post-import notification
import { authenticate } from '../../middleware/authenticate.js'  // if auth is installed

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const REQUIRED_COLUMNS = ['firstName', 'lastName', 'ndisNumber', 'dateOfBirth']
const ENTITY = 'participants'

export const participantImportRouter = Router()

participantImportRouter.post(
  '/api/participants/import',
  authenticate,               // remove if no auth
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const companyId = req.body.companyId as string | undefined
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' })
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

      // Row-level validation
      if (!row.ndisNumber || !/^\d{9}$/.test(row.ndisNumber)) {
        results.push({ row: rowNum, status: 'failed', reason: `Invalid NDIS number: "${row.ndisNumber}"` })
        continue
      }
      if (!row.dateOfBirth || isNaN(Date.parse(row.dateOfBirth))) {
        results.push({ row: rowNum, status: 'failed', reason: `Invalid date of birth: "${row.dateOfBirth}"` })
        continue
      }

      // Write
      try {
        await saveRecord(ENTITY, {
          firstName: row.firstName,
          lastName: row.lastName,
          ndisNumber: row.ndisNumber,
          dateOfBirth: row.dateOfBirth,
          companyId,
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
import { participantImportRouter } from './routes/participants/import.js'
app.use(participantImportRouter)
```

---

## Validation Strategy: All-or-Nothing vs Partial Success

The recipe supports both. Ask the developer which they prefer:

| Strategy | Behaviour | Best when |
|----------|-----------|-----------|
| **All-or-nothing** | Any invalid row → entire import rejected, nothing written | Data integrity is critical; operator must fix CSV before any records are created |
| **Partial success** | Valid rows are written; failed rows reported with row number and reason | Large imports where some rows may have typos; operator fixes failures after the fact |

The template above implements **partial success** (Signal Studio's choice). To switch to all-or-nothing: validate all rows first, return early if any fail, then do the writes in a second pass.

---

## Client: Import Modal

```typescript
// client/src/components/ParticipantImportModal.tsx
import { useState } from 'react'
import type { Company } from '@appystack-template/shared'

interface ImportResult {
  total: number
  created: number
  failed: number
  failures: { row: number; status: string; reason?: string }[]
}

interface Props {
  companies: Company[]
  currentUserCompanyId?: string   // non-admin: pre-fill and lock
  isAdmin: boolean
  onClose: () => void
}

export function ParticipantImportModal({ companies, currentUserCompanyId, isAdmin, onClose }: Props) {
  const [companyId, setCompanyId] = useState(currentUserCompanyId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!companyId) { setError('Please select a company before importing'); return }
    if (!file) { setError('Please select a CSV file'); return }

    const form = new FormData()
    form.append('file', file)
    form.append('companyId', companyId)

    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/participants/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed'); return }
      setResult(data)
    } catch {
      setError('Network error — check the server is running')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Import Participants</h2>

        {/* Company selector */}
        {isAdmin ? (
          <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">Assign imported participants to...</option>
            {companies.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}
          </select>
        ) : (
          <p>Importing to: <strong>{companies.find(c => c.id === currentUserCompanyId)?.name as string}</strong></p>
        )}

        {/* File picker */}
        {!result && (
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        )}

        {/* Error */}
        {error && <p className="text-red-500">{error}</p>}

        {/* Results */}
        {result && (
          <div>
            <p>{result.created} of {result.total} participants imported successfully.</p>
            {result.failures.length > 0 && (
              <ul>
                {result.failures.map(f => (
                  <li key={f.row}>Row {f.row}: {f.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="modal-actions">
          {!result && (
            <button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import'}
            </button>
          )}
          <button onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  )
}
```

---

## Company Scoping Pattern

Company scoping is the most important non-obvious requirement. If the app has roles:

| User role | Company dropdown | Behaviour |
|-----------|-----------------|-----------|
| Admin | Visible, all companies | Can import into any company |
| Non-admin | Hidden or read-only | Import automatically scoped to their company |

The server enforces this regardless of what the client sends:

```typescript
// In the import endpoint — enforce scoping server-side even if client misbehaves
const effectiveCompanyId = req.user?.role === 'admin'
  ? (req.body.companyId as string)
  : req.user?.companyId   // non-admin always uses their own company

if (!effectiveCompanyId) {
  return res.status(400).json({ error: 'companyId could not be determined' })
}
```

---

## Required Columns Configuration

Define required columns as a constant that the recipe reads from the entity type. Claude should:

1. Read `shared/src/types.ts`
2. Find the entity type
3. Identify required fields (non-optional, non-generated — exclude `id`, `createdAt`, FKs added by the modal)
4. Present the list: "Your Participant type requires these fields. I suggest these as the CSV required columns: firstName, lastName, ndisNumber, dateOfBirth. Confirm or adjust?"

---

## The Recipe Intelligence Prompts

**Step 1 — Read entity type:**
> "I found the Participant type with fields: id, firstName, lastName, ndisNumber, dateOfBirth, status, companyId, defaultSiteId, createdAt. Which fields should be required in the CSV? (id, createdAt, and FK fields are usually excluded — they're set by the import process itself.)"

**Step 2 — Validation rules:**
> "Are there format rules for any fields? (e.g. NDIS number must be 9 digits, dateOfBirth must be YYYY-MM-DD)"

**Step 3 — Partial success or all-or-nothing?**
> "If some rows have invalid data, should the import: (a) write the valid rows and report failures, or (b) reject the entire file until all rows are fixed?"

**Step 4 — Company scoping:**
> "Is auth installed? If yes, should non-admin users be restricted to importing into their own company only?"

**Step 5 — Post-import notification:**
> "Should a Socket.io `entity:external-change` event be emitted after import so open list views refresh automatically?"

---

## Sample CSV for Testing

Include a sample CSV in `docs/` so domain experts can test without building their own file:

```csv
# docs/sample-import-participants.csv
firstName,lastName,ndisNumber,dateOfBirth
Maria,Rossi,430456789,1985-03-20
James,Patel,430987654,1992-11-07
Amara,Okafor,430111222,1978-06-15
```

---

## Anti-Patterns

**Don't write rows before validating all columns.**
If `ndisNumber` column is missing, fail immediately before any rows are parsed — don't write the first few rows then discover the schema is wrong on row 4.

**Don't silently drop rows.**
If a row fails, report it. The domain expert needs to know which rows failed and why so they can fix the source data.

**Don't trust the client for company scoping.**
A non-admin can modify form data in the browser. Always enforce company scoping on the server using the authenticated user's company assignment.

**Don't use Socket.io for the import write operation.**
Bulk write is request/response, not event-driven. Use HTTP POST + multer. Socket.io is for the post-import refresh notification only.

**Don't import into the entity without checking for duplicates.**
Define the duplicate key (e.g. `ndisNumber` for participants). Either reject duplicates with a clear message or upsert — but never silently create a second record with the same unique field value.

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
5. **Company scoping?** — is auth installed? Do non-admins have a company restriction?
6. **Duplicate key?** — what field identifies a duplicate? (used to reject or upsert)
7. **Post-import notification?** — emit `entity:external-change` after writes?
