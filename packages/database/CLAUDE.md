# CLAUDE.md - Database Package Guidelines

## Overview
`@repo/database` encapsulates the **Mongoose 8** MongoDB database connection lifecycle manager, schema plugins, and database utility functions for backend services and background workers.

```
packages/database/src/
├── connection.ts        # connectDatabase, disconnectDatabase, connection state helpers
├── plugins/             # Shared Mongoose schema plugins
│   └── base.plugin.ts   # Automatic timestamps & toJSON ID transformations
└── index.ts             # Public package exports
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/database check-types`
- **Build**: `pnpm --filter @repo/database build`

---

## Architecture & Code Conventions

1. **Connection Management**:
   - `connectDatabase(options: DatabaseConfig)`:
     - Handles cached connections in development and serverless runtimes.
     - Supports explicit database name selection via `options.dbName`.
     - Logs connection status via `@repo/utils` logger.
   - `disconnectDatabase()`: Cleanly disconnects and releases connections on server shutdown.
   - `isDatabaseConnected()`: Returns boolean status check (`readyState === 1`).
   - `getDatabaseConnectionState()`: Returns readable state (`disconnected`, `connected`, `connecting`, `disconnecting`).

2. **Base Schema Plugin (`baseSchemaPlugin`)**:
   - Automatically enables `{ timestamps: true }` (`createdAt`, `updatedAt`).
   - Standardizes `toJSON` serialization by mapping `_id` to virtual `id` and removing `__v` and internal `_id`.

3. **Mongoose Version**:
   - Uses Mongoose `^8.x`. All models defined in consuming apps should import `Schema` and `model` from `mongoose`.
