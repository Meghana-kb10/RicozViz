import mongoose from 'mongoose';

/**
 * Recursive document -> plain-JSON transformer.
 *
 * The legacy API returned Prisma records: camelCase fields, `id` instead of
 * `_id`, ISO date strings and foreign keys as plain strings. This helper
 * reproduces that exact shape from Mongoose documents so the web client cannot
 * tell the difference.
 *
 * Rules:
 *  - `_id` is dropped and republished as `id`.
 *  - `__v` (the version key) is always dropped.
 *  - `ObjectId` -> string. As a root/embedded document id it also yields `id`.
 *  - `Date`   -> ISO-8601 string.
 *  - Populated references become `{ id, ...fields }`.
 *  - Everything else (Mixed payloads such as `layoutConfig`) is deep-copied
 *    untouched so chart configuration survives verbatim.
 */

interface SerializeOptions {
  virtuals?: boolean;
}

function isMongooseDocument(
  value: unknown
): value is { toObject: (options?: SerializeOptions) => Record<string, unknown> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toObject?: unknown }).toObject === 'function'
  );
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.source;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value === 'object') {
    const raw = isMongooseDocument(value) ? value.toObject() : (value as Record<string, unknown>);
    return normalizeObject(raw);
  }

  return value;
}

function normalizeObject(raw: Record<string, unknown>): Record<string, unknown> {
  const source = raw as Record<string, unknown> & { _id?: unknown };
  const hasOwnId = Object.prototype.hasOwnProperty.call(source, '_id') && source._id != null;

  const result: Record<string, unknown> = {};

  if (hasOwnId) {
    result.id = source._id instanceof mongoose.Types.ObjectId ? source._id.toString() : String(source._id);
  }

  for (const [key, rawValue] of Object.entries(source)) {
    if (key === '_id' || key === '__v') {
      continue;
    }
    result[key] = normalize(rawValue);
  }

  return result;
}

/** Serialise a single document (or any value) into the API representation. */
export function serialize<T = unknown>(value: T): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item));
  }

  if (isMongooseDocument(value)) {
    return normalizeObject(value.toObject());
  }

  if (value instanceof mongoose.Types.ObjectId || value instanceof Date) {
    return normalize(value);
  }

  if (typeof value === 'object') {
    return normalizeObject(value as Record<string, unknown>);
  }

  return value;
}

/** Serialise a document and assert the caller's expected output type. */
export function serializeDoc<T>(doc: unknown, options?: SerializeOptions): T {
  if (isMongooseDocument(doc)) {
    return normalizeObject(doc.toObject(options)) as T;
  }
  return serialize(doc) as T;
}

/** Serialise a list of documents. */
export function serializeDocs<T>(
  docs: unknown[] | null | undefined,
  options?: SerializeOptions
): T[] {
  if (!docs || docs.length === 0) {
    return [];
  }
  return docs.map((doc) => serializeDoc<T>(doc, options));
}

/**
 * Paginate a Mongoose query and return the legacy `{ items, total }` pair.
 */
export async function serializePaginated<T>(
  query: {
    skip: (value: number) => unknown;
    limit: (value: number) => unknown;
    exec: () => Promise<unknown[]>;
  },
  totalPromise: Promise<number>
): Promise<{ items: T[]; total: number }> {
  const [docs, total] = await Promise.all([query.exec(), totalPromise]);
  return { items: serializeDocs<T>(docs), total };
}