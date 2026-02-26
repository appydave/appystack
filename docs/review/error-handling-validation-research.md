# Error Handling and Input Validation Patterns for Express 5 + React 19

**Date**: 2026-02-15
**Purpose**: Research findings for improving AppyStack RVETS monorepo templates
**Status**: Research complete

---

## 1. Express Global Error Handler

### Reference Implementation: edwinhern/express-typescript

This is the most popular Express 5 + TypeScript starter on GitHub. It uses **Express 5.1.0** with Zod, Pino, and Vitest. Its error handler is surprisingly minimal (13 lines):

```typescript
// src/common/middleware/errorHandler.ts
import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

const unexpectedRequest: RequestHandler = (_req, res) => {
  res.status(StatusCodes.NOT_FOUND).send("Not Found");
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
  res.locals.err = err;
  next(err);
};

export default (): [RequestHandler, ErrorRequestHandler] => [unexpectedRequest, addErrorToRequestLog];
```

**Assessment**: This is too minimal. It only attaches the error to `res.locals` for the request logger to pick up, then passes the error along. It does not return a structured JSON response. The 404 handler returns plain text, not JSON.

### Express 5 Key Improvement: Automatic Async Error Propagation

Express 5 automatically catches rejected promises and thrown errors in async route handlers. This eliminates the need for `express-async-errors` or `try/catch` in every route:

```typescript
// Express 4 - required try/catch
app.get("/books/:id", async (req, res, next) => {
  try {
    const book = await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!book) throw new Error("Book not found");
    res.json(book);
  } catch (error) {
    next(error);
  }
});

// Express 5 - automatic propagation
app.get("/books/:id", async (req, res) => {
  const book = await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]);
  if (!book) throw new Error("Book not found");
  res.json(book);
});
```

### Recommended Minimum Viable Error Middleware for AppyStack

Based on Better Stack's guide and the CodeConcisely pattern, here is a production-quality error handler (~40 lines):

```typescript
// src/middleware/errorHandler.ts
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    statusCode: 404,
  });
};

const createErrorHandler = (logger: Logger): ErrorRequestHandler => {
  return (err, req, res, _next) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const isOperational = err instanceof AppError ? err.isOperational : false;

    logger.error({
      err,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      isOperational,
    });

    res.status(statusCode).json({
      success: false,
      message: isOperational ? err.message : "Internal server error",
      statusCode,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  };
};

export { notFoundHandler, createErrorHandler };
```

**Registration in server.ts:**
```typescript
app.use(notFoundHandler);
app.use(createErrorHandler(logger));
```

**Key design decisions:**
- Accepts a Pino logger instance (matches AppyStack's existing Pino setup)
- Hides internal error details in production (`isOperational` flag)
- Returns structured JSON matching the ServiceResponse shape
- Stack trace only in development
- Express 5 handles async errors automatically, so no wrapper needed

**Verdict: YES, include in starter template.** The 404 + error handler pair is essential. About 40 lines total.

---

## 2. AppError Class Pattern

### Real Implementation (from CodeConcisely / Better Stack)

The full-featured version from the CodeConcisely guide:

```typescript
// exceptions/AppError.ts
export enum HttpCode {
  OK = 200,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

interface AppErrorArgs {
  name?: string;
  httpCode: HttpCode;
  description: string;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly name: string;
  public readonly httpCode: HttpCode;
  public readonly isOperational: boolean = true;

  constructor(args: AppErrorArgs) {
    super(args.description);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = args.name || "Error";
    this.httpCode = args.httpCode;
    if (args.isOperational !== undefined) {
      this.isOperational = args.isOperational;
    }
    Error.captureStackTrace(this);
  }
}
```

The ErrorHandler class that accompanies it:

```typescript
class ErrorHandler {
  private isTrustedError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  public handleError(error: Error | AppError, response?: Response): void {
    if (this.isTrustedError(error) && response) {
      this.handleTrustedError(error as AppError, response);
    } else {
      this.handleCriticalError(error, response);
    }
  }

  private handleTrustedError(error: AppError, response: Response): void {
    response.status(error.httpCode).json({ message: error.message });
  }

  private handleCriticalError(error: Error | AppError, response?: Response): void {
    if (response) {
      response.status(HttpCode.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
    console.log("Application encountered a critical error. Exiting");
    process.exit(1);
  }
}
```

### Assessment

**Do starter templates include this?** No. The edwinhern template has zero custom error classes. Better Stack and CodeConcisely present it as a best practice, but it is tutorial/guide content rather than starter template content.

**Recommendation for AppyStack**: Include a simplified `AppError` class (the version in section 1 above, ~10 lines) but NOT the full hierarchy of `NotFoundError`, `ValidationError`, `UnauthorizedError` subclasses. Those are application-level concerns.

**Verdict: Include a MINIMAL AppError (statusCode + isOperational). Skip subclasses.** The subclasses are easy to add when needed but clutter a starter template.

---

## 3. ServiceResponse Pattern

### Actual Implementation (from edwinhern/express-typescript)

```typescript
// src/common/models/serviceResponse.ts
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export class ServiceResponse<T = null> {
  readonly success: boolean;
  readonly message: string;
  readonly responseObject: T;
  readonly statusCode: number;

  private constructor(success: boolean, message: string, responseObject: T, statusCode: number) {
    this.success = success;
    this.message = message;
    this.responseObject = responseObject;
    this.statusCode = statusCode;
  }

  static success<T>(message: string, responseObject: T, statusCode: number = StatusCodes.OK) {
    return new ServiceResponse(true, message, responseObject, statusCode);
  }

  static failure<T>(message: string, responseObject: T, statusCode: number = StatusCodes.BAD_REQUEST) {
    return new ServiceResponse(false, message, responseObject, statusCode);
  }
}

export const ServiceResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    responseObject: dataSchema.optional(),
    statusCode: z.number(),
  });
```

### How It Is Used in Practice

**In services** (replaces throw/catch with explicit return values):
```typescript
// userService.ts
async findById(id: number): Promise<ServiceResponse<User | null>> {
  try {
    const user = await this.userRepository.findByIdAsync(id);
    if (!user) {
      return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
    }
    return ServiceResponse.success<User>("User found", user);
  } catch (ex) {
    const errorMessage = `Error finding user with id ${id}: ${(ex as Error).message}`;
    logger.error(errorMessage);
    return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
```

**In controllers:**
```typescript
// userController.ts
public getUser: RequestHandler = async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id as string, 10);
  const serviceResponse = await userService.findById(id);
  res.status(serviceResponse.statusCode).send(serviceResponse);
};
```

### Assessment

The ServiceResponse pattern enforces a consistent API response shape:
```json
{
  "success": true,
  "message": "User found",
  "responseObject": { "id": 1, "name": "Alice" },
  "statusCode": 200
}
```

**Pros:**
- Every API response has the same shape (frontend can rely on `success` field)
- The Zod schema companion (`ServiceResponseSchema`) enables OpenAPI doc generation
- Service layer never throws; controllers are one-liners

**Cons:**
- Services swallow errors with try/catch instead of letting Express 5's error handler deal with them
- `responseObject` is a verbose field name (most APIs use `data`)
- The `statusCode` in the body duplicates the HTTP status code

**Verdict: Include a SIMPLIFIED version.** Rename `responseObject` to `data`. The pattern is worth adopting for API consistency, but the field naming should be modernized:

```typescript
// Recommended simplified version for AppyStack
export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T;
}

export function apiSuccess<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function apiFailure(message: string): ApiResponse<null> {
  return { success: false, message, data: null };
}
```

This is lighter (no class, no statusCode duplication) and achieves the same goal.

---

## 4. React Error Boundaries in React 19

### What Changed from React 18

React 19 made three notable changes to error boundary behavior:

1. **Single error logging**: React 18 logged errors twice (original throw + recovery attempt). React 19 logs once with all information included.

2. **Fail-fast on siblings**: React 19 bails out on rendering sibling components immediately when an error is caught, rather than attempting to render them and aggregating errors.

3. **Actions integration**: Errors thrown inside `useTransition` / form actions automatically propagate to the nearest error boundary without manual handling.

### The Standard Pattern: react-error-boundary v6

The `react-error-boundary` package (v6.1.1, by Brian Vaughn / React team member) remains the standard. Its API from the actual source:

**FallbackComponent pattern (recommended):**
```tsx
import { ErrorBoundary, getErrorMessage, type FallbackProps } from "react-error-boundary";

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{getErrorMessage(error)}</pre>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

<ErrorBoundary
  FallbackComponent={Fallback}
  onReset={(details) => {
    // Reset app state so the error doesn't happen again
  }}
>
  <YourApplication />
</ErrorBoundary>
```

**useErrorBoundary hook (for async/event handler errors):**
```tsx
import { useErrorBoundary } from "react-error-boundary";

function Example() {
  const { error, resetBoundary, showBoundary } = useErrorBoundary();

  const handleClick = async () => {
    try {
      await riskyOperation();
    } catch (err) {
      showBoundary(err); // Triggers the nearest ErrorBoundary
    }
  };

  return <button onClick={handleClick}>Do something</button>;
}
```

**React 19 Actions with Error Boundaries:**
```tsx
function DeleteButton({ itemId }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteItem(itemId); // Errors auto-propagate to nearest ErrorBoundary
    });
  };

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
```

### Minimal Useful Error Boundary for AppyStack

```tsx
// src/components/ErrorFallback.tsx
import type { FallbackProps } from "react-error-boundary";

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
      <pre className="max-w-lg overflow-auto rounded bg-red-50 p-4 text-sm text-red-800">
        {error instanceof Error ? error.message : "Unknown error"}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
```

```tsx
// Usage in App.tsx or router layout
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./components/ErrorFallback";

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
```

**Verdict: YES, include in starter template.** Add `react-error-boundary` as a dependency, provide a styled `ErrorFallback` component, and wrap the app root. This is about 20 lines of actual code and catches a class of errors that otherwise show a blank screen.

---

## 5. Zod Request Validation Middleware for Express

### edwinhern/express-typescript's Built-in Approach (Recommended)

This template does NOT use a third-party middleware package. It implements validation in ~20 lines:

```typescript
// src/common/utils/httpHandlers.ts
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZodError, ZodSchema } from "zod";

import { ServiceResponse } from "@/common/models/serviceResponse";

export const validateRequest = (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (err) {
      const errors = (err as ZodError).errors.map((e) => {
        const fieldPath = e.path.length > 0 ? e.path.join(".") : "root";
        return `${fieldPath}: ${e.message}`;
      });

      const errorMessage =
        errors.length === 1
          ? `Invalid input: ${errors[0]}`
          : `Invalid input (${errors.length} errors): ${errors.join("; ")}`;

      const statusCode = StatusCodes.BAD_REQUEST;
      const serviceResponse = ServiceResponse.failure(errorMessage, null, statusCode);
      res.status(serviceResponse.statusCode).send(serviceResponse);
    }
  };
```

**Schema definition pattern:**
```typescript
// userModel.ts
export const GetUserSchema = z.object({
  params: z.object({ id: commonValidations.id }),
});

// commonValidation.ts
export const commonValidations = {
  id: z.string()
    .refine((data) => !Number.isNaN(Number(data)), "ID must be a numeric value")
    .transform(Number)
    .refine((num) => num > 0, "ID must be a positive number"),
};
```

**Route usage:**
```typescript
userRouter.get("/:id", validateRequest(GetUserSchema), userController.getUser);
```

### Comparison: zod-express-middleware Package

The `zod-express-middleware` package (v1.4.0) provides a more feature-rich but heavier approach with ~200 lines of source. It validates body/query/params separately with full type inference:

```typescript
import { validateRequest } from "zod-express-middleware";
import { z } from "zod";

app.get("/api/test/:id", validateRequest({
  params: z.object({ id: z.string() }),
  query: z.object({ lang: z.string(), version: z.string() }),
  body: z.object({ newName: z.string().min(6), newAge: z.number() }),
}), (req, res) => {
  // req.body, req.query, req.params are all fully typed
  return res.json({ msg: "all good" });
});
```

### Assessment

The built-in approach (edwinhern's ~20 lines) is superior for a starter template because:
- Zero additional dependencies
- Validates all three (body/query/params) with a single schema object
- Returns structured errors matching the API response format
- The code is simple enough to understand and modify

**Verdict: Include the built-in validateRequest middleware (~20 lines). Do NOT add a third-party package.**

---

## 6. Express + Zod Middleware Packages Landscape

### Package Comparison (as of February 2026)

| Package | Version | Last Updated | Weekly Downloads | Express 5 | Notes |
|---------|---------|--------------|-----------------|-----------|-------|
| **express-zod-api** | 27.0.1 | Active | ~5,500 | Yes (v5 support) | Full framework, not just middleware. Replaces Express routing entirely. |
| **express-zod-safe** | 3.2.0 | Active | Lower | Yes | Strict typesafe middleware, lightweight |
| **zod-express-middleware** | 1.4.0 | 2021 (abandoned) | Declining | No | Unmaintained. README recommends alternatives. |

### express-zod-api: Not a Middleware, It is a Framework

`express-zod-api` (v27.0.1) is NOT middleware you add to Express. It is an opinionated framework that takes over your entire server setup. It replaces Express routing, middleware composition, and response handling. This makes it incompatible with the AppyStack approach where Express is one piece of a larger architecture.

### express-zod-safe: Lightweight Alternative

`express-zod-safe` (v3.2.0) is closer to what you want - actual middleware. But at ~20 lines of custom code (see section 5), the built-in approach is just as good and has no dependency.

### Recommendation

**Do not add any of these packages to AppyStack.** The 20-line `validateRequest` function from section 5 is the right approach. It:
- Has zero dependencies beyond Zod (which AppyStack already uses)
- Is fully understood and modifiable
- Matches the project's response format
- Works with Express 5

If the project grows to need OpenAPI generation from Zod schemas, consider `@asteasolutions/zod-to-openapi` (which edwinhern uses), but that is separate from validation middleware.

---

## Summary: What to Include in AppyStack Starter Template

| Pattern | Include? | Lines of Code | Dependency |
|---------|----------|---------------|------------|
| Global error handler (404 + error middleware) | **YES** | ~40 | None |
| AppError class (minimal) | **YES** | ~12 | None |
| ApiResponse helper (simplified ServiceResponse) | **YES** | ~15 | None |
| React ErrorBoundary + ErrorFallback | **YES** | ~25 | `react-error-boundary` |
| Zod validateRequest middleware | **YES** | ~20 | None (uses Zod already in stack) |
| Custom error subclasses (NotFoundError, etc.) | **No** | - | - |
| Third-party Zod middleware package | **No** | - | - |
| Full ServiceResponse class | **No** | - | - |

**Total new code**: ~112 lines across server and client packages.
**New dependencies**: 1 (`react-error-boundary`).

### File Placement in AppyStack Template

```
packages/
  server/
    src/
      middleware/
        error-handler.ts      # notFoundHandler + createErrorHandler + AppError
        validate-request.ts   # Zod validation middleware
      utils/
        api-response.ts       # apiSuccess / apiFailure helpers
  client/
    src/
      components/
        error-fallback.tsx    # ErrorFallback component
      app.tsx                 # ErrorBoundary wrapper at root
```

---

## Sources

- [edwinhern/express-typescript](https://github.com/edwinhern/express-typescript) - Express 5 + TypeScript starter (primary reference)
- [Express 5 Error Handling docs](https://expressjs.com/en/guide/error-handling.html) - Official async error propagation
- [Better Stack: Express Error Handling Patterns](https://betterstack.com/community/guides/scaling-nodejs/error-handling-express/) - AppError class, global handler
- [CodeConcisely: Handle Errors in Express with TypeScript](https://www.codeconcisely.com/posts/how-to-handle-errors-in-express-with-typescript/) - Operational vs programmer errors
- [bvaughn/react-error-boundary](https://github.com/bvaughn/react-error-boundary) - v6.1.1 source code
- [React 19 Error Boundary Changes](https://andrei-calazans.com/posts/react-19-error-boundary-changed/) - Behavioral differences from React 18
- [Certificates.dev: Error Handling in React](https://certificates.dev/blog/error-handling-in-react-with-react-error-boundary) - react-error-boundary patterns
- [Aquila169/zod-express-middleware](https://github.com/Aquila169/zod-express-middleware) - Full source of validateRequest
- [RobinTail/express-zod-api](https://github.com/RobinTail/express-zod-api) - Framework-level Zod integration
- [AngaBlue/express-zod-safe](https://github.com/AngaBlue/express-zod-safe) - Lightweight Zod middleware
