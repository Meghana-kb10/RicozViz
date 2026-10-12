# RicozViz module layout & Prisma → Mongoose mapping

Everything under `apps/backend/src/modules/ricozviz/` is the migrated RicozViz
domain. It sits alongside the untouched template demo modules (`auth`, `user`,
`product`, `health`) so the two never collide.

Every module follows the template's three-file convention:

```
modules/ricozviz/<feature>/
  ├── <feature>.service.ts    business logic, returns plain objects
  ├── <feature>.controller.ts Fastify handlers: validate -> call service -> sendSuccess
  ├── <feature>.routes.ts     route table
  └── index.ts                explicit re-exports only
```

## Non-negotiable rules

1. **No `export *`.** Every barrel lists symbols explicitly.
2. **Backend ESM needs `.js` extensions** on every relative import.
3. **Never** return raw Mongoose documents from a controller — run them through
   `serializeDoc` / `serializeDocs` from `@repo/database` first.
4. **Contract preservation is mandatory.** The web app is unchanged, so route
   paths (`/api/v1/...`), response envelopes and field names must stay identical.
5. **Never** silently drop a Prisma feature. `include` becomes `populate`,
   `select` becomes `.select()`, `upsert` becomes `updateOne(..., { upsert: true })`.

## Response envelope

```ts
import { sendSuccess } from '../../../utils/response.js';

sendSuccess(reply, data);          // 200  { success: true, data }
sendSuccess(reply, data, 201);     // 201
sendSuccess(reply, data, 200, { total, page, limit, totalPages });
sendError(reply, 400, 'BAD_REQUEST', 'msg');
```

Throw `AppError` for failures — the global handler renders the error envelope:

```ts
throw AppError.badRequest('...');
throw AppError.unauthorized('...');
throw AppError.forbidden(`Permission required: ${key}`);
throw AppError.notFound('Dataset');
throw AppError.conflict('...');
throw AppError.internal('...');
```

## Query translation table

| Prisma                                   | Mongoose                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| `prisma.model.findUnique({ where: { id } })` | `Model.findOne({ _id: toObjectId(id) })`                    |
| `prisma.model.findFirst({ where })`      | `Model.findOne(filter)`                                          |
| `prisma.model.findMany({ where })`       | `Model.find(filter)`                                             |
| `prisma.model.findMany({ where, orderBy })` | `Model.find(filter).sort({ createdAt: -1 })`                 |
| `take` / `skip`                          | `.limit(n)` / `.skip(n)`                                         |
| `include: { rel: true }`                 | `.populate('rel')`                                               |
| `include: { rel: { select: { a, b } } }` | `.populate('rel', 'a b')`                                       |
| `select: { a: true }`                    | `.select('a')`                                                   |
| `create({ data })`                       | `Model.create({ ... })`                                          |
| `update({ where, data })`                | `Model.findByIdAndUpdate(id, { $set: data }, { new: true })`     |
| `delete({ where })`                      | `Model.deleteOne({ ... })`                                       |
| `count({ where })`                       | `Model.countDocuments(filter)`                                   |
| `upsert({ where, update, create })`      | `Model.updateOne(where, { $set: update, $setOnInsert: create }, { upsert: true })` |
| `groupBy` / `aggregate`                  | `Model.aggregate([...])`                                         |
| `contains` + `mode: 'insensitive'`       | `new RegExp(escapeRegExp(s), 'i')`                               |
| `String` field / `uuid()` id             | `Schema.Types.ObjectId` + `toObjectId()` on input               |
| `Json` field                             | `Schema.Types.Mixed` (always a **function** default)            |
| `$transaction(async tx => ...)`          | Sequential writes with manual rollback (see `auth.service.ts`)  |
| `prisma.report` (aliased)                | `ReportModel` — already renamed, no alias shim needed           |
| `prisma.visualization` (aliased)         | `ChartModel`                                                     |
| `P2002` unique violation                 | `MongoServerError` `code === 11000` (handled globally)           |
| `P2025` record not found                 | `null` from `findOne` — check explicitly                         |

## Populating related documents

Mongoose cannot infer populated paths on the document type, so always parametrise:

```ts
const doc = await DatasetModel.findOne(filter)
  .populate<{ dataSource: { _id: mongoose.Types.ObjectId; name: string; type: string } }>(
    'dataSource',
    'name type'
  )
  .exec();
```

## Auth guards

```ts
import { requireAuth, requirePermission, getPrincipal } from '../../../plugins/ricozviz-auth.js';

app.get('/', { preHandler: [requireAuth, requirePermission('DATASET_VIEW')] }, handler);

const principal = getPrincipal(request);   // { userId, email, organizationId, roleId, roleName, permissions[] }
```

Always scope tenant reads with `organizationId: toObjectId(principal.organizationId)`.