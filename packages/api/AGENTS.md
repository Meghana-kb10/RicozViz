# AGENTS.md - API Package Agentic Playbook

## Agent Role & Scope
You are working on `@repo/api`. Your role is to maintain the isomorphic API client, guarantee type-safe request/response handling, handle seamless token refresh cycles, and prevent serialization issues.

---

## Key Workflows

### 1. Adding an Endpoint to ApiClient
1. Import domain types from `@repo/types` and input schemas from `@repo/validation`.
2. Add the method in the respective module under `src/modules/<feature>.ts`:
   ```typescript
   async getDetails(id: string): Promise<ApiResponse<MyEntity>> {
     return this.http.get<ApiResponse<MyEntity>>(`/api/my-feature/${id}`);
   }
   ```
3. If creating a new domain module, instantiate it in `src/client.ts`:
   ```typescript
   export class ApiClient {
     public readonly myFeature: MyFeatureApi;
     constructor(config?: ApiClientConfig) {
       ...
       this.myFeature = new MyFeatureApi(this.http);
     }
   }
   ```
4. Re-export in `src/index.ts` and run `pnpm --filter @repo/api check-types`.

### 2. Safeguarding Empty Body POST Requests
Fastify rejects empty JSON bodies:
```typescript
// When sending empty body, ensure valid JSON object is passed
async logout(): Promise<ApiResponse<{ loggedOut: boolean }>> {
  return this.http.post<ApiResponse<{ loggedOut: boolean }>>('/api/auth/logout', {});
}
```

---

## Quality Checklist
- Never hardcode `localhost` URLs in methods; all requests must route through `this.http` using relative API paths.
- Ensure all public API methods return `Promise<ApiResponse<T>>`.
- Always verify with `pnpm --filter @repo/api check-types`.
