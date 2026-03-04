# Recipe: REST API Endpoints with OpenAPI/Swagger

Exposes one or more domain entities as external-facing REST API endpoints with auto-generated OpenAPI/Swagger documentation, API key authentication, and CORS configuration. Designed to layer on top of the `file-crud` recipe — the file layer stays local, this recipe makes it externally callable.

---

## Recipe Anatomy

**Intent**
Scaffold a public-facing API layer over existing entity routes. Adds OpenAPI spec generation, Swagger UI, API key middleware, and CORS headers. External consumers (other apps, automation agents, third-party integrations) can read and write entities via REST. REST mutations emit Socket.io events so connected UI clients stay in sync.

**Type**: Additive — applies on top of an existing `file-crud` implementation. Can run independently if entity routes already exist.

**Stack Assumptions**
- Express 5, TypeScript
- `swagger-jsdoc` + `swagger-ui-express` (installed by this recipe)
- `@types/swagger-jsdoc` + `@types/swagger-ui-express` (dev deps, installed by this recipe)
- Entity fileStore already generated (file-crud recipe: `listRecords`, `readRecord`, `writeRecord`, `deleteRecord`)
- `data/` folder at repo root

**Idempotency Check**
Does `server/src/middleware/apiKey.ts` exist? If yes → API layer already installed. Only add route files and JSDoc annotations for new entities.

**Does Not Touch**
- Existing Socket.io handlers — REST mutations broadcast the same events, they do not replace handlers
- `client/` — this is server-only
- Entity type definitions in `shared/` — reads them, does not modify
- Data files in `data/` — read/write via existing fileStore

**Composes With**
- `file-crud` recipe — REST routes use the same fileStore (shared persistence, no duplication)
- `nav-shell` recipe — internal UI uses Socket.io; external consumers use the REST API; both stay in sync

---

## Folder Structure

```
project-root/
├── server/src/
│   ├── middleware/
│   │   └── apiKey.ts              ← API key validation middleware (shared, generated once)
│   ├── routes/
│   │   └── {entity}.ts            ← one route file per entity (factory function, all 5 operations + JSDoc)
│   ├── schemas.ts                 ← shared OpenAPI schema definitions (EntityIndex, Error, common responses)
│   └── swagger.ts                 ← OpenAPI spec config + Swagger UI mount (generated once)
└── .env                           ← API_KEY=... CORS_ORIGIN=... (never committed)
```

---

## Package Installation

Run from the `server/` workspace:

```bash
cd server
npm install swagger-jsdoc swagger-ui-express cors
npm install -D @types/swagger-jsdoc @types/swagger-ui-express @types/cors
```

---

## Environment Variables

Add to the Zod schema in `server/src/config/env.ts`:

```typescript
// Add inside the z.object({}) schema:
API_KEY: z.string().min(16, 'API_KEY must be at least 16 characters'),
CORS_ORIGIN: z.string().default('*'),
```

Add to `.env` (and `.env.example` with placeholder values):

```bash
# .env
API_KEY=change-me-to-something-secret-min-16
CORS_ORIGIN=*

# Production: lock CORS_ORIGIN to your consumer's domain
# CORS_ORIGIN=https://your-consumer-app.com
```

---

## API Key Middleware

Simple static API key via `Authorization: Bearer <key>`. Suitable for server-to-server integrations and personal automation tools. Not for multi-tenant public APIs.

```typescript
// server/src/middleware/apiKey.ts
import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' })
  }
  const key = auth.slice('Bearer '.length)
  if (key !== env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' })
  }
  next()
}
```

---

## CORS Configuration

Add to `server/src/index.ts` before routes are mounted:

```typescript
import cors from 'cors'
import { env } from './config/env'

// Scoped to /api — does not affect Socket.io or other routes
app.use('/api', cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}))
```

---

## OpenAPI Spec Setup

```typescript
// server/src/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Express } from 'express'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AppyStack API',
      version: '1.0.0',
      description: 'REST API — use the Authorize button to enter your Bearer token',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{ bearerAuth: [] }],   // apply auth globally; override per-endpoint if needed
  },
  apis: ['./src/routes/*.ts', './src/schemas.ts'],  // scanned for JSDoc @swagger annotations
}

export function mountSwagger(app: Express) {
  const spec = swaggerJsdoc(options)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec))
  app.get('/api-spec.json', (_req, res) => res.json(spec))
}
```

Mount in `server/src/index.ts` (before route mounting):

```typescript
import { mountSwagger } from './swagger'

mountSwagger(app)
// Swagger UI:  http://localhost:5X01/api-docs
// Raw spec:    http://localhost:5X01/api-spec.json
```

---

## Common Schemas

Define shared OpenAPI schemas once. swagger-jsdoc scans this file automatically.

```typescript
// server/src/schemas.ts
// This file contains only JSDoc — no runtime code.

/**
 * @swagger
 * components:
 *   schemas:
 *     EntityIndex:
 *       type: object
 *       required: [id, name, filename]
 *       properties:
 *         id:
 *           type: string
 *           example: a7k3p
 *         name:
 *           type: string
 *           example: NERO Banana
 *         filename:
 *           type: string
 *           example: nero-banana-a7k3p.json
 *
 *     Error:
 *       type: object
 *       required: [error]
 *       properties:
 *         error:
 *           type: string
 *           example: Not found
 *
 *   responses:
 *     Unauthorized:
 *       description: Missing or malformed Authorization header
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error: Missing or malformed Authorization header
 *     Forbidden:
 *       description: Invalid API key
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error: Invalid API key
 *     NotFound:
 *       description: Record not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error: Not found
 */

export {}  // required — TypeScript treats files with no imports/exports as global scripts, not modules; this makes the JSDoc annotations visible to swagger-jsdoc at the correct module scope
```

---

## Complete Route File Pattern

Each entity gets one route file. The factory function receives `io` so REST mutations can broadcast Socket.io events to connected UI clients — keeping the internal UI and external REST consumers in sync.

Below is the complete pattern using `Company` as the example. Generate equivalent files for every other entity.

```typescript
// server/src/routes/company.ts
import { Router } from 'express'
import { Server } from 'socket.io'
import { requireApiKey } from '../middleware/apiKey'
import { listRecords, readRecord, writeRecord, deleteRecord } from '../data/fileStore'

// fileStore signatures (provided by file-crud recipe):
//   listRecords(entity): Promise<EntityIndex[]>
//   readRecord(entity, id): Promise<EntityRecord | null>
//   writeRecord(entity, id | null, data): Promise<EntityRecord & { filename: string }>
//     id=null → create (generates ID + slug); id=string → update (rename file if name changed)
//   deleteRecord(entity, id): Promise<void>

/**
 * @swagger
 * components:
 *   schemas:
 *     CompanyInput:
 *       type: object
 *       required: [name]
 *       properties:
 *         name:
 *           type: string
 *           example: NERO Banana
 *         # TODO: add domain-specific fields here
 *
 *     Company:
 *       allOf:
 *         - $ref: '#/components/schemas/EntityIndex'
 *         - $ref: '#/components/schemas/CompanyInput'
 */

export function createCompanyRouter(io: Server) {
  const router = Router()

  /**
   * @swagger
   * /api/companies:
   *   get:
   *     summary: List all companies
   *     tags: [Company]
   *     responses:
   *       200:
   *         description: Array of company index entries
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/EntityIndex'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  router.get('/', requireApiKey, async (_req, res) => {
    const records = await listRecords('companies')
    res.json(records)
  })

  /**
   * @swagger
   * /api/companies/{id}:
   *   get:
   *     summary: Get a company by ID
   *     tags: [Company]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           example: a7k3p
   *     responses:
   *       200:
   *         description: Full company record
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Company'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.get('/:id', requireApiKey, async (req, res) => {
    const record = await readRecord('companies', req.params.id)
    if (!record) return res.status(404).json({ error: 'Not found' })
    res.json(record)
  })

  /**
   * @swagger
   * /api/companies:
   *   post:
   *     summary: Create a new company
   *     tags: [Company]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompanyInput'
   *     responses:
   *       201:
   *         description: Created company record (includes generated id and filename)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Company'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  router.post('/', requireApiKey, async (req, res) => {
    const record = await writeRecord('companies', null, req.body)
    io.emit('entity:created', {
      entity: 'company',
      record,
      index: { id: record.id, name: record.name, filename: record.filename },
    })
    res.status(201).json(record)
  })

  /**
   * @swagger
   * /api/companies/{id}:
   *   patch:
   *     summary: Update a company (partial — only send fields to change)
   *     tags: [Company]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           example: a7k3p
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompanyInput'
   *     responses:
   *       200:
   *         description: Updated company record
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Company'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.patch('/:id', requireApiKey, async (req, res) => {
    const existing = await readRecord('companies', req.params.id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const record = await writeRecord('companies', req.params.id, { ...existing, ...req.body })
    io.emit('entity:updated', {
      entity: 'company',
      record,
      index: { id: record.id, name: record.name, filename: record.filename },
    })
    res.json(record)
  })

  /**
   * @swagger
   * /api/companies/{id}:
   *   delete:
   *     summary: Delete a company
   *     tags: [Company]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           example: a7k3p
   *     responses:
   *       204:
   *         description: Deleted successfully (no body)
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.delete('/:id', requireApiKey, async (req, res) => {
    const existing = await readRecord('companies', req.params.id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    await deleteRecord('companies', req.params.id)
    io.emit('entity:deleted', { entity: 'company', id: req.params.id })
    res.status(204).send()
  })

  return router
}
```

---

## Mounting Multiple Entities

Add to `server/src/index.ts` after the `io` server is created, before `app.listen`:

```typescript
import { mountSwagger } from './swagger'
import { createCompanyRouter } from './routes/company'
import { createSiteRouter } from './routes/site'
import { createUserRouter } from './routes/user'
import { createParticipantRouter } from './routes/participant'

// Mount Swagger UI (before routes — serves /api-docs and /api-spec.json)
mountSwagger(app)

// Mount entity routers — each receives io for Socket.io broadcast on mutation
app.use('/api/companies',    createCompanyRouter(io))
app.use('/api/sites',        createSiteRouter(io))
app.use('/api/users',        createUserRouter(io))
app.use('/api/participants',  createParticipantRouter(io))
```

One `mountSwagger` call regardless of entity count. One `app.use` line per entity.

---

## Input Validation

The route handlers pass `req.body` directly to `writeRecord` with no validation. The recipe scaffolds without it to stay minimal — but for any externally-facing API, validation should be added immediately after the scaffold runs.

**Pattern:** Add a Zod schema per entity (named `{Entity}InputSchema`) in the route file. Use it in POST to validate the full input, and `.partial()` in PATCH so all fields are optional. Return `400` with field errors on failure. Add a `400` response entry to the OpenAPI JSDoc annotations for POST and PATCH.

AppyStack already has Zod installed on the server — no additional dependency needed.

---

## Read-Only Entities

If an entity should only be readable externally (not creatable/updatable/deletable via REST), omit the write routes from the factory:

```typescript
export function createReportRouter(io: Server) {
  const router = Router()

  // Only GET routes — no POST, PATCH, DELETE
  router.get('/', requireApiKey, async (_req, res) => { ... })
  router.get('/:id', requireApiKey, async (req, res) => { ... })

  return router
}
```

Note this in the entity's JSDoc `@swagger` description: `"Read-only — external consumers may not create or modify records."`

---

## What Swagger UI Gives You

Navigate to `http://localhost:5X01/api-docs` after starting the server.

**What you see:**
- Every endpoint listed by tag (one tag per entity)
- Each endpoint shows method, path, summary, parameters, request body schema, and all response codes
- Expand any endpoint to see the full spec

**Authorize button (top right):**
- Click → enter your API key as `Bearer your-api-key-here` → Authorize
- All "Try it out" calls from that point forward include the Authorization header automatically
- You only enter the key once per browser session

**Try it out:**
- Click "Try it out" on any endpoint → fields become editable
- GET list: click Execute → see the JSON array response with status 200
- GET single: fill in the `id` path parameter → Execute → see the full record or 404
- POST: the request body editor pre-fills with the schema shape (field names from your `CompanyInput` schema) → edit the JSON → Execute → see the created record with its generated `id`
- PATCH: fill in `id` + the fields to change → Execute → see the updated record
- DELETE: fill in `id` → Execute → 204 (no body) on success, 404 if not found
- Every response shows: HTTP status code, response headers, response body

**Raw spec at `/api-spec.json`:**
- Machine-readable OpenAPI 3.0 JSON
- Import directly into Postman: New Collection → Import → Link → paste the URL
- Import into Insomnia: Create → Import → From URL
- Use with any OpenAPI-compatible tooling (code generators, mock servers, validators)

---

## Testing Your API

### Swagger UI Walkthrough

1. Start the server: `npm run dev` (from project root)
2. Open `http://localhost:5X01/api-docs`
3. Click **Authorize** → enter `Bearer your-api-key` → click Authorize → Close
4. Expand **GET /api/companies** → Try it out → Execute → should return `[]` (empty array on fresh data)
5. Expand **POST /api/companies** → Try it out → edit body to `{"name": "Test Company"}` → Execute → should return `201` with `id` and `filename`
6. Copy the `id` from step 5
7. Expand **GET /api/companies/{id}** → Try it out → paste the `id` → Execute → should return the full record
8. Expand **PATCH /api/companies/{id}** → Try it out → paste `id`, change name → Execute → should return updated record
9. Expand **DELETE /api/companies/{id}** → Try it out → paste `id` → Execute → should return `204`
10. Re-run GET list → should return `[]` again

### curl Reference

Replace `5501` with your server port, `your-api-key` with your `API_KEY` value, and `a7k3p` with a real ID.

```bash
# List all
curl -s -H "Authorization: Bearer your-api-key" \
  http://localhost:5501/api/companies | jq

# Get single
curl -s -H "Authorization: Bearer your-api-key" \
  http://localhost:5501/api/companies/a7k3p | jq

# Create
curl -s -X POST \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "NERO Banana"}' \
  http://localhost:5501/api/companies | jq

# Update (partial — only send changed fields)
curl -s -X PATCH \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "NERO Banana Updated"}' \
  http://localhost:5501/api/companies/a7k3p | jq

# Delete (returns no body — use -v to see 204 status)
curl -s -X DELETE \
  -H "Authorization: Bearer your-api-key" \
  -v http://localhost:5501/api/companies/a7k3p

# Test missing key (should return 401)
curl -s http://localhost:5501/api/companies | jq

# Test wrong key (should return 403)
curl -s -H "Authorization: Bearer wrong-key" \
  http://localhost:5501/api/companies | jq
```

### Verifying Socket.io Sync

Open the app's UI in a browser (a connected Socket.io client). Make a REST mutation via curl or Swagger UI. The UI should update in real time — no browser refresh. This confirms the `io.emit` calls in the route handlers are broadcasting correctly.

---

## Standard API Endpoints per Entity

| Method | Path | Description | Body | Response |
|--------|------|-------------|------|----------|
| GET | `/api/{entities}` | List all (id + name + filename) | — | `EntityIndex[]` |
| GET | `/api/{entities}/:id` | Get full record | — | full entity record |
| POST | `/api/{entities}` | Create new record | entity fields (no id) | created record with id |
| PATCH | `/api/{entities}/:id` | Partial update | fields to change | updated record |
| DELETE | `/api/{entities}/:id` | Delete | — | 204 (no body) |

All responses use JSON. Errors return `{ "error": "message" }` with the appropriate status code.

---

## Multi-Entity Generation

**Generated once (shared infrastructure):**
- `server/src/middleware/apiKey.ts` — middleware, identical for all entities
- `server/src/swagger.ts` — spec config, single `mountSwagger` call
- `server/src/schemas.ts` — `EntityIndex`, `Error`, `Unauthorized`, `Forbidden`, `NotFound`
- `.env` additions: `API_KEY`, `CORS_ORIGIN`
- `server/src/config/env.ts` additions: two new Zod fields

**Generated per entity:**
- `server/src/routes/{entity}.ts` — factory function with all 5 routes + JSDoc schemas + annotations

**Developer mounts in `server/src/index.ts`:**
- One `mountSwagger(app)` call
- One `app.use('/api/{entities}', create{Entity}Router(io))` line per entity

---

## What to Generate in the Build Prompt

Collect before generating:

1. **Entity names** — which entities need external API access? (may be a subset of all entities)
2. **Read-only vs read-write** — for each entity: all 5 operations, or GET-only?
3. **Key fields per entity** — what domain fields exist? (fills in `CompanyInput` schema properties with real field names and types)
4. **Namish field** — which field is the `name` for slug/filename purposes? (usually `name`; affects the `required` list in the input schema)
5. **CORS origin** — `*` for dev default, or a specific domain?
6. **Swagger UI route** — default `/api-docs`, change if needed
7. **Rate limiting needed?** — flag as TODO if yes (not in this recipe; use `express-rate-limit` as follow-up)

---

## Notes

- **REST and Socket.io share the same fileStore** — no data duplication. A REST POST and a Socket.io `entity:save` both call `writeRecord` and both broadcast the same `entity:created` event.
- **API key rotation** — update `API_KEY` in `.env` and restart the server. No code changes needed.
- **Rate limiting** — not included. Add `express-rate-limit` as a follow-up: `app.use('/api', rateLimit({ windowMs: 60_000, max: 100 }))`.
- **Production Swagger** — consider disabling the Swagger UI in production (`if (!env.isProduction) mountSwagger(app)`) while keeping `/api-spec.json` available for clients that need the spec.
- **Production `apis` path** — `swagger.ts` scans `./src/routes/*.ts` (dev). If the server runs from compiled JS in production, change to `./dist/routes/*.js` or use the `ts-node`/`tsx` path at runtime.
- **Schema completeness** — the `CompanyInput` schema stub has a `# TODO` comment. Fill in actual field names and types to get accurate Swagger UI request body hints and schema validation in API clients.

---

**Status**: Complete — 2026-03-04
**Pattern source**: AppyStack RVETS template + file-crud recipe
