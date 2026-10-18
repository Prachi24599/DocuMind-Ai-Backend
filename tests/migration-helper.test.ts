import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const helperPath = fileURLToPath(new URL('../scripts/append-document-metadata-checks.mjs', import.meta.url));
const migrationPath = fileURLToPath(new URL('../prisma/migrations/20261015000000_init/migration.sql', import.meta.url));

const runHelperWithTemporaryMigration = (migration: string) => {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'documind-migration-helper-'));
  const tempHelper = join(tempDirectory, 'scripts/append-document-metadata-checks.mjs');
  const tempMigration = join(tempDirectory, 'prisma/migrations/20261015000000_init/migration.sql');

  try {
    mkdirSync(join(tempDirectory, 'scripts'), { recursive: true });
    mkdirSync(join(tempDirectory, 'prisma/migrations/20261015000000_init'), { recursive: true });
    copyFileSync(helperPath, tempHelper);
    writeFileSync(tempMigration, migration);

    const result = spawnSync(process.execPath, [tempHelper], { encoding: 'utf8' });

    return {
      result,
      migrationAfter: readFileSync(tempMigration, 'utf8'),
    };
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
};

describe('initial migration metadata checks', () => {
  it('rejects all six constraints on another table without modifying the migration', () => {
    const original = readFileSync(migrationPath, 'utf8');
    const wrongTable = original.replace(
      'ALTER TABLE "Document"\n    ADD CONSTRAINT "Document_fileSizeBytes_positive_check"',
      'ALTER TABLE "Conversation"\n    ADD CONSTRAINT "Document_fileSizeBytes_positive_check"',
    );

    expect(wrongTable).not.toBe(original);
    const { result, migrationAfter } = runHelperWithTemporaryMigration(wrongTable);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('is not attached to the Document table');
    expect(migrationAfter).toBe(wrongTable);
  });

  it('rejects an existing metadata constraint with an incorrect CHECK expression without modifying the migration', () => {
    const original = readFileSync(migrationPath, 'utf8');
    const incorrectExpression = original.replace(
      'CHECK ("fileSizeBytes" > 0)',
      'CHECK ("fileSizeBytes" >= 0)',
    );
    const { result, migrationAfter } = runHelperWithTemporaryMigration(incorrectExpression);

    expect(incorrectExpression).not.toBe(original);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('is present with a missing or incorrect CHECK expression');
    expect(migrationAfter).toBe(incorrectExpression);
  });

  it('rejects a partial set of metadata constraints without modifying the migration', () => {
    const original = readFileSync(migrationPath, 'utf8');
    const partialSet = original.replace(
      'ADD CONSTRAINT "Document_mimeType_pdf_check"',
      'ADD CONSTRAINT "Document_unexpected_check"',
    );
    const { result, migrationAfter } = runHelperWithTemporaryMigration(partialSet);

    expect(partialSet).not.toBe(original);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('only some metadata constraints');
    expect(result.stderr).toContain('Document_mimeType_pdf_check');
    expect(migrationAfter).toBe(partialSet);
  });

  it('rejects duplicate occurrences of a metadata constraint without modifying the migration', () => {
    const original = readFileSync(migrationPath, 'utf8');
    const duplicateDefinition = 'ALTER TABLE "Document" ADD CONSTRAINT "Document_fileSizeBytes_positive_check" CHECK ("fileSizeBytes" > 0);';
    const duplicate = original.replace(
      '-- Prisma schema does not currently express PostgreSQL CHECK constraints.',
      `${duplicateDefinition}\n\n-- Prisma schema does not currently express PostgreSQL CHECK constraints.`,
    );
    const { result, migrationAfter } = runHelperWithTemporaryMigration(duplicate);

    expect(duplicate).not.toBe(original);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('duplicate metadata constraints');
    expect(result.stderr).toContain('Document_fileSizeBytes_positive_check');
    expect(migrationAfter).toBe(duplicate);
  });
});
