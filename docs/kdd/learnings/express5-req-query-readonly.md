---
topic: Express 5 migration
issue: req.query is read-only — direct assignment throws
created: 2026-02-26
story_reference: Wave 4 / WU-12 + WU-13
category: backend
severity: medium
status: resolved
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# Express 5 — req.query is Read-Only

## Problem Signature

**Symptoms**: Runtime `TypeError` when validation middleware assigns to `req.query`:
```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

**Environment**: Server (Express 5). Surfaced in the `validate.ts` middleware.

**Triggering Conditions**: Express 5 made `req.query` a getter-only property on `IncomingMessage`
(breaking change from Express 4, where it was writable).

## Root Cause

The WU-3 `validate.ts` middleware assigned the parsed result straight back onto `req.query`:
```typescript
if (schema.query) req.query = schema.query.parse(req.query); // THROWS in Express 5
```

## Solution

Mutate the existing object in place with `Object.assign` instead of replacing it:
```typescript
if (schema.query) Object.assign(req.query, schema.query.parse(req.query));
```

## Prevention

- **For Dev**: any query-validation middleware in Express 5 must mutate `req.query`, never reassign it.
- **For Review**: flag any `req.query = ...` on sight.
- **For Stories**: work that touches `validate.ts` should note the Express-5 read-only constraint.

## Related

- Story: Wave 4, WU-13
- Related learnings: []
- Related patterns: []
