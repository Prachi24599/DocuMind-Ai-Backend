import { z } from 'zod';

const postgresUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'postgres:' || protocol === 'postgresql:';
}, 'Must be a PostgreSQL connection URL.').optional();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema,
}).superRefine((environment, context) => {
  if (Boolean(environment.CLERK_PUBLISHABLE_KEY) !== Boolean(environment.CLERK_SECRET_KEY)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be configured together.',
      path: [environment.CLERK_SECRET_KEY ? 'CLERK_PUBLISHABLE_KEY' : 'CLERK_SECRET_KEY'],
    });
  }
});

export const parseEnvironment = (environment: Record<string, string | undefined>) =>
  envSchema.safeParse(environment);

const env = parseEnvironment(process.env);

if (!env.success) {
  const details = env.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  console.error(`Invalid environment configuration: ${details}`);
  process.exit(1);
}

export const config = env.data;