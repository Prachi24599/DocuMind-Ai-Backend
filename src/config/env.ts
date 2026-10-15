import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error('Invalid environment configuration:', env.error.format());
  process.exit(1);
}

export const { PORT, NODE_ENV, CORS_ORIGIN } = env.data;