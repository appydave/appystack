# File CRUD Recipe

Multiple entities stored as JSON files on the server filesystem. Socket.IO bridges client changes directly to the file system and pushes updates back. No database required — the `data/` folder IS the database.

## Folder Structure

```
project-root/
├── data/                         ← lives at repo root, NOT inside client or server
│   ├── {entity}/
│   │   ├── index.json            ← list of all records (lightweight summary)
│   │   └── {name-slug}-{id}.json ← individual record files
│   └── ...
├── client/
├── server/
└── shared/
```

## File Naming Convention

Individual record files are named from the record's `name` field:

```
{kebab-slug-of-name}-{5-char-alphanumeric-id}.json
```

Examples:
- "NERO Banana" → `nero-banana-a7k3p.json`
- "Acme Corp" → `acme-corp-x9q2m.json`

The 5-char ID is the record's primary key, embedded in the filename. This means:
- Records are human-readable on the filesystem
- Renaming a record = renaming the file (use the ID to find it when name changes)
- No separate ID field needed — ID is extracted from the filename

```typescript
// shared/src/types.ts
export function recordId(filename: string): string {
  return filename.replace(/\.json$/, '').split('-').pop() ?? ''
}
```

## index.json Format

Each entity folder has an `index.json` for fast listing without reading every file:

```json
[
  { "id": "a7k3p", "name": "NERO Banana", "filename": "nero-banana-a7k3p.json" },
  { "id": "x9q2m", "name": "Acme Corp", "filename": "acme-corp-x9q2m.json" }
]
```

Update `index.json` on every create, rename, and delete operation.

## Server File Operations

```
server/src/
├── data/
│   ├── fileStore.ts      ← read/write/delete individual record files
│   ├── indexStore.ts     ← read/update index.json per entity
│   └── idgen.ts          ← generate 5-char alphanumeric IDs
└── routes/
    └── {entity}.ts       ← REST endpoints for each entity (list, get, create, update, delete)
```

### ID Generation

```typescript
// server/src/data/idgen.ts
export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
```

## Socket.IO Integration

File changes flow both ways:

**Client → Server → File:**
```typescript
// Client emits
socket.emit('entity:save', { entity: 'company', record: { name: 'NERO Banana', ... } })

// Server writes file, updates index, then broadcasts
io.emit('entity:updated', { entity: 'company', record, index })
```

**File → Server → Client (file watcher):**
Use `chokidar` to watch `data/` directory. On change, read the updated file and broadcast to all clients.

```typescript
chokidar.watch('./data').on('change', (filePath) => {
  // parse entity + id from path, read file, emit update
})
```

## Shared Types

```typescript
// shared/src/types.ts
export interface EntityRecord {
  id: string        // extracted from filename, not stored in file body
  name: string      // used to derive filename
  [key: string]: unknown
}

export interface EntityIndex {
  id: string
  name: string
  filename: string
}
```

Define entity-specific interfaces extending `EntityRecord` in shared types.

## Client Structure

```
client/src/
├── views/
│   └── {Entity}View.tsx     ← list + inline edit/delete for one entity
├── components/
│   ├── RecordList.tsx        ← generic list with edit/delete actions
│   └── RecordForm.tsx        ← generic create/edit form
└── hooks/
    └── useEntity.ts          ← socket-backed hook: list, save, delete for an entity
```

## CRUD Operations Summary

| Operation | Client emits | Server does | Server broadcasts |
|-----------|-------------|-------------|-------------------|
| List | (on mount) | reads index.json | sends index |
| Create | `entity:save` (no id) | generates id, writes file, updates index | `entity:updated` |
| Update | `entity:save` (with id) | renames file if name changed, writes, updates index | `entity:updated` |
| Delete | `entity:delete` | deletes file, updates index | `entity:deleted` |

## What to Generate in the Build Prompt

When generating the prompt for this recipe, include:
- List of entity names (ask developer if not provided)
- Key fields for each entity (at minimum: `name`, plus domain-specific fields)
- Whether entities relate to each other (this recipe handles simple flat entities — flag if relationships are needed)
- Which entities get their own nav item (in combination with nav-shell recipe)
- The `data/` path relative to project root
