import type { FastifyReply, FastifyRequest } from 'fastify';
import { createApiResponse, createApiError } from '@repo/api';
import { logger } from '@repo/utils';
import {
  validate,
  createUserRequestSchema,
  updateUserRequestSchema,
  userParamsSchema,
  userQuerySchema
} from '@repo/validation';
import { userService } from './user.service.js';

export class UserController {
  async getUsers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = validate(userQuerySchema, request.query);
      const users = await userService.getAllUsers(query);
      reply.status(200).send(createApiResponse(users));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch users';
      logger.error(`[User] Failed to fetch users: ${message}`, error);
      reply.status(500).send(createApiError(message));
    }
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = validate(userParamsSchema, request.params);
      const user = await userService.getUserById(id);
      if (!user) {
        logger.warn(`[User] User with ID ${id} not found`);
        reply.status(404).send(createApiError(`User with ID ${id} not found`));
        return;
      }
      reply.status(200).send(createApiResponse(user));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';
      logger.error(`[User] Failed to fetch user: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async createUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(createUserRequestSchema, request.body);
      const user = await userService.createUser(input);
      reply.status(201).send(createApiResponse(user, 'User created successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      logger.error(`[User] Failed to create user: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = validate(userParamsSchema, request.params);
      const input = validate(updateUserRequestSchema, request.body);
      const user = await userService.updateUser(id, input);
      reply.status(200).send(createApiResponse(user, 'User updated successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      logger.error(`[User] Failed to update user: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = validate(userParamsSchema, request.params);
      await userService.deleteUser(id);
      reply.status(200).send(createApiResponse({ id, deleted: true }, 'User deleted successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      logger.error(`[User] Failed to delete user: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }
}

export const userController = new UserController();
