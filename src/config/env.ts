import { z } from 'zod';

const postgresUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'postgres:' || protocol === 'postgresql:';
}, 'Must be a PostgreSQL connection URL.').optional();

const optionalNonEmpty = z.string().min(1).optional();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  R2_ACCOUNT_ID: optionalNonEmpty,
  R2_ACCESS_KEY_ID: optionalNonEmpty,
  R2_SECRET_ACCESS_KEY: optionalNonEmpty,
  R2_BUCKET_NAME: optionalNonEmpty,
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().max(50 * 1024 * 1024).default(10 * 1024 * 1024),
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

  const r2Keys = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ] as const;
  const configuredR2Keys = r2Keys.filter((key) => environment[key]);
  if (configuredR2Keys.length > 0 && configuredR2Keys.length !== r2Keys.length) {
    for (const key of r2Keys) {
      if (!environment[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All R2 storage settings must be configured together.',
          path: [key],
        });
      }
    }
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