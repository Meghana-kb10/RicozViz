import type { FastifyInstance } from 'fastify';
import { userController } from './user.controller.js';
import { authenticate } from '../../plugins/authenticate.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', userController.getUsers.bind(userController));
  app.get('/:id', userController.getUserById.bind(userController));
  app.post('/', userController.createUser.bind(userController));
  app.put('/:id', { preHandler: [authenticate] }, userController.updateUser.bind(userController));
  app.delete('/:id', { preHandler: [authenticate] }, userController.deleteUser.bind(userController));
}
