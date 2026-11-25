import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts', 'src/scripts/create-platform-admin.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node22',
  noExternal: [/^@repo\/.*/],
  external: ['mongoose', 'fastify', '@fastify/cors', 'dotenv']
});
