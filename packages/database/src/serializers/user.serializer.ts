import type { User } from '@repo/types';
import type { IUserDocument } from '../models/user.model';

export function serializeUser(doc: IUserDocument | Record<string, unknown>): User {
  const raw = typeof (doc as IUserDocument).toObject === 'function' 
    ? (doc as IUserDocument).toObject() 
    : doc;

  const id = raw._id ? String(raw._id) : String(raw.id || '');
  const createdAt = raw.createdAt instanceof Date 
    ? raw.createdAt.toISOString() 
    : String(raw.createdAt || new Date().toISOString());

  return {
    id,
    name: String(raw.name || ''),
    email: String(raw.email || ''),
    role: (raw.role as User['role']) || 'user',
    createdAt
  };
}

export function serializeUsers(docs: (IUserDocument | Record<string, unknown>)[]): User[] {
  return docs.map(serializeUser);
}
