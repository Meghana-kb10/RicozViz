import { userRepository } from '@repo/database';
import type { CreateUserRequestInput, UpdateUserRequestInput, UserQueryInput } from '@repo/validation';
import type { User } from '@repo/types';

export class UserService {
  async getAllUsers(query?: UserQueryInput): Promise<User[]> {
    const filter: Record<string, unknown> = {};
    if (query?.role) {
      filter.role = query.role;
    }
    if (query?.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const options = {
      limit: query?.limit,
      skip: query?.page && query?.limit ? (query.page - 1) * query.limit : undefined,
      sort: query?.sort ? { [query.sort]: query.order === 'asc' ? (1 as const) : (-1 as const) } : undefined
    };

    return userRepository.getAllUsers(options);
  }

  async getUserById(id: string): Promise<User | null> {
    return userRepository.getUserById(id);
  }

  async createUser(input: CreateUserRequestInput): Promise<User> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new Error(`User with email "${input.email}" already exists`);
    }
    return userRepository.createUser(input);
  }

  async updateUser(id: string, input: UpdateUserRequestInput): Promise<User> {
    const user = await userRepository.updateUser(id, input);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await userRepository.deleteUser(id);
    if (!deleted) {
      throw new Error('User not found or already deleted');
    }
    return true;
  }
}

export const userService = new UserService();
