import type { User, CreateUserInput } from '@repo/types';
import { BaseRepository, type QueryPaginationOptions } from './base.repository';
import { UserModel, type IUserDocument } from '../models/user.model';
import { serializeUser, serializeUsers } from '../serializers/user.serializer';

export class UserRepository extends BaseRepository<IUserDocument> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  async getAllUsers(options?: QueryPaginationOptions): Promise<User[]> {
    const docs = await this.find({}, options);
    return serializeUsers(docs);
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.findById(id);
    return doc ? serializeUser(doc) : null;
  }

  async createUser(input: CreateUserInput & { password?: string }): Promise<User> {
    const doc = await this.create({
      name: input.name,
      email: input.email.toLowerCase().trim(),
      role: input.role || 'user',
      password: input.password
    } as any);
    return serializeUser(doc);
  }

  async updateUser(
    id: string,
    data: Partial<{ name: string; email: string; role: 'admin' | 'user' | 'guest' }>
  ): Promise<User | null> {
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.email) {
      updatePayload.email = data.email.toLowerCase().trim();
    }
    const updated = await this.update(id, updatePayload as any);
    return updated ? serializeUser(updated) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.delete(id);
  }
}

export const userRepository = new UserRepository();
