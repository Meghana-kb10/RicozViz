# AGENTS.md - Database Package Agentic Playbook

## Agent Role & Scope
You are working on `@repo/database`. Your role is to ensure robust MongoDB connection handling, prevent connection leaks or duplicated client pools, and maintain uniform document serialization schemas across services.

---

## Key Workflows

### 1. Connecting from a Service
```typescript
import { connectDatabase, disconnectDatabase } from '@repo/database';

// In server bootstrap
await connectDatabase({
  uri: process.env.MONGODB_URI!,
  dbName: process.env.MONGODB_DB_NAME || 'core-mono-dev',
});

// In graceful shutdown
await disconnectDatabase();
```

### 2. Applying Base Plugin to Mongoose Schemas
```typescript
import { Schema, model } from 'mongoose';
import { baseSchemaPlugin } from '@repo/database';

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }
});

// Apply base schema plugin for timestamps and toJSON transforms
UserSchema.plugin(baseSchemaPlugin);

export const UserModel = model('User', UserSchema);
```

---

## Constraints & Gotchas
- Always pass explicit `dbName` if the MongoDB connection URI specifies a cluster or replica set without an embedded default database path.
- Never import `@repo/database` in frontend clients (`apps/next` or `apps/vite`); it is strictly a server-side dependency.
- Run `pnpm --filter @repo/database check-types` whenever modifying options or plugin typings.
