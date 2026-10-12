# AGENTS.md - Backend Agentic Playbook

## Agent Role & Scope
You are working on the Fastify 5 REST API service. Your responsibilities include maintaining data integrity, reliable authentication guards, accurate input validation, and informative error logging.

---

## Key Workflows

### 1. Adding a Protected Route
```typescript
// in my-feature.routes.ts
export async function myFeatureRoutes(app: FastifyInstance): Promise<void> {
  // Requires valid bearer token
  app.get('/protected', { preHandler: [app.authenticate] }, myFeatureController.getProtectedData);

  // Requires admin role
  app.post('/admin-only', { preHandler: [app.authenticate, authorize('admin')] }, myFeatureController.adminAction);
}
```

### 2. Controller Error Pattern
Always preserve stack traces and context:
```typescript
async myAction(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const input = validate(myInputSchema, request.body);
    const result = await myService.execute(input);
    reply.status(200).send(createApiResponse(result));
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Action failed';
    logger.error(`[MyFeature] Action failed on ${request.method} ${request.url}: ${message}`, error);
    reply.status(400).send(createApiError(message));
  }
}
```

### 3. Database Updates
- Always use `connectDatabase` from `@repo/database`.
- Ensure schema fields have proper validation and indexes (e.g. `unique: true` on emails).
- Apply `baseSchemaPlugin` to ensure `createdAt`, `updatedAt`, and clean `toJSON` id serialization.

---

## Constraints & Gotchas
- Fastify route registration is asynchronous: `await app.register(...)`.
- `request.user` is populated only after `authenticate` preHandler runs successfully.
- When sending responses, always use `createApiResponse(data, message)` or `createApiError(error, message)` from `@repo/api`.
- Never disable `logger: false` in Fastify config without maintaining the custom hooks in `src/plugins/logger.ts`.
