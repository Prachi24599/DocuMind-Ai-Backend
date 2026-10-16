import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const migrationUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
