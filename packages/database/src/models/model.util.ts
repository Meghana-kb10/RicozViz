import mongoose, { Schema, type Model, type SchemaDefinitionProperty } from 'mongoose';

/**
 * Register a model while remaining safe under `tsx watch` reloads.
 * Mongoose throws `OverwriteModelError` when the same model name is compiled
 * twice, which happens on every hot reload in development.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  return existing ?? mongoose.model<T>(name, schema);
}

/** Shorthand for an indexed, referenced foreign key column. */
export function objectIdRef(ref: string, required = false): SchemaDefinitionProperty {
  return {
    type: Schema.Types.ObjectId,
    ref,
    required,
    index: true
  };
}

/** Shorthand for an optional, referenced foreign key column. */
export function objectIdRefOptional(ref: string, indexed = true): SchemaDefinitionProperty {
  return {
    type: Schema.Types.ObjectId,
    ref,
    default: null,
    ...(indexed ? { index: true } : {})
  };
}

/**
 * Normalise a value into an ObjectId, returning `null` for anything invalid.
 * Route params arrive as strings, so every lookup funnels through this helper.
 */
export function toObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

/** Serialise an ObjectId (or string) to its string form, tolerating nullish input. */
export function idToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }
  if (typeof value === 'object' && value !== null && '_id' in (value as Record<string, unknown>)) {
    return idToString((value as Record<string, unknown>)._id);
  }
  return String(value);
}