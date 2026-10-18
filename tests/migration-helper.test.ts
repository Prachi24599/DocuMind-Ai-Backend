import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const helperPath = fileURLToPath(new URL('../scripts/append-document-metadata-checks.mjs', import.meta.url));
const migrationPath = fileURLToPath(new URL('../prisma/migrations/20261015000000_init/migration.sql', import.meta.url));

describe('initial migration metadata checks', () => {
  it('rejects all six constraints on another table without modifying the migration', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'documind-migration-helper-'));
    const tempHelper = join(tempDirectory, 'scripts/append-document-metadata-checks.mjs');
    const tempMigration = join(tempDirectory, 'prisma/migrations/20261015000000_init/migration.sql');
    const original = readFileSync(migrationPath, 'utf8');
    const wrongTable = original.replace(
      'ALTER TABLE "Document"\n    ADD CONSTRAINT "Document_fileSizeBytes_positive_check"',
      'ALTER TABLE "Conversation"\n    ADD CONSTRAINT "Document_fileSizeBytes_positive_check"',
    );

    expect(wrongTable).not.toBe(original);
    mkdirSync(join(tempDirectory, 'scripts'), { recursive: true });
    mkdirSync(join(tempDirectory, 'prisma/migrations/20261015000000_init'), { recursive: true });
    copyFileSync(helperPath, tempHelper);
    writeFileSync(tempMigration, wrongTable);

    try {
      const result = spawnSync(process.execPath, [tempHelper], { encoding: 'utf8' });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('is not attached to the Document table');
      expect(readFileSync(tempMigration, 'utf8')).toBe(wrongTable);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
