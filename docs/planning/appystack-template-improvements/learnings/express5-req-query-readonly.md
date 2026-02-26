# Learning: Express 5 — req.query is Read-Only

**Discovered**: WU-12 + WU-13, Wave 4
**Fixed in**: WU-13 (validate.ts)

## The Issue

In Express 5, `req.query` is a getter-only property on `IncomingMessage`. Direct assignment throws:

```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

The WU-3 `validate.ts` middleware had:
```typescript
if (schema.query) req.query = schema.query.parse(req.query); // THROWS in Express 5
```

## The Fix

Use `Object.assign` to mutate the existing object in place:
```typescript
if (schema.query) Object.assign(req.query, schema.query.parse(req.query));
```

## Implication

Any future work that touches `validate.ts` or writes query validation middleware should use `Object.assign` not direct assignment. This is an Express 5 breaking change from Express 4.
