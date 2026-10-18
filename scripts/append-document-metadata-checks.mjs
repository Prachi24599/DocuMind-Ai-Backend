import { readFile, writeFile } from 'node:fs/promises';

const migrationPath = new URL('../prisma/migrations/20261015000000_init/migration.sql', import.meta.url);
const migration = await readFile(migrationPath, 'utf8');
const documentTable = migration.match(/CREATE TABLE "Document" \(([\s\S]*?)\n\);/)?.[1];
const conversationDocumentTable = migration.match(/CREATE TABLE "ConversationDocument" \(([\s\S]*?)\n\);/)?.[1];
const expectedDocumentColumns = [
  /"id" UUID NOT NULL,/,
  /"ownerId" UUID NOT NULL,/,
  /"storageKey" TEXT,/,
  /"filename" TEXT NOT NULL,/,
  /"fileSizeBytes" BIGINT NOT NULL,/,
  /"mimeType" VARCHAR\(127\) NOT NULL,/,
  /"pageCount" INTEGER,/,
  /"deletedAt" TIMESTAMPTZ\(6\),/,
  /CONSTRAINT "Document_pkey" PRIMARY KEY \("id"\)/,
];

if (!documentTable || !conversationDocumentTable) {
  throw new Error('Generated Prisma migration is missing the Document or ConversationDocument table.');
}

for (const pattern of expectedDocumentColumns) {
  if (!pattern.test(documentTable)) {
    throw new Error(`Generated Document table is missing expected structure: ${pattern}`);
  }
}

const expectedConversationDocumentColumns = [
  /"conversationId" UUID NOT NULL,/,
  /"documentId" UUID NOT NULL,/,
  /"ownerId" UUID NOT NULL,/,
  /CONSTRAINT "ConversationDocument_pkey" PRIMARY KEY \("conversationId","documentId"\)/,
];

for (const pattern of expectedConversationDocumentColumns) {
  if (!pattern.test(conversationDocumentTable)) {
    throw new Error(`Generated ConversationDocument table is missing expected structure: ${pattern}`);
  }
}

if (!/ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_documentId_ownerId_fkey" FOREIGN KEY \("documentId", "ownerId"\) REFERENCES "Document"\("id", "ownerId"\) ON DELETE RESTRICT ON UPDATE CASCADE;/.test(migration)) {
  throw new Error('Generated migration is missing the owner-scoped restrictive document foreign key.');
}

const documentConstraintStatements = [...migration.matchAll(/ALTER TABLE "Document"\s+[\s\S]*?;/g)]
  .map(([statement]) => statement)
  .join('\n');

const expectedConstraints = new Map([
  ['Document_fileSizeBytes_positive_check', '"fileSizeBytes" > 0'],
  ['Document_mimeType_pdf_check', '"mimeType" = \'application/pdf\''],
  ['Document_pageCount_positive_check', '"pageCount" IS NULL OR "pageCount" > 0'],
  ['Document_filename_nonempty_check', 'length(btrim("filename")) > 0'],
  ['Document_storageKey_nonempty_check', '"storageKey" IS NULL OR length(btrim("storageKey")) > 0'],
  ['Document_storageKey_requires_deletedAt_check', '"storageKey" IS NOT NULL OR "deletedAt" IS NOT NULL'],
]);
const constraintNames = [...expectedConstraints.keys()];
const constraintCounts = new Map(constraintNames.map((name) => [
  name,
  [...migration.matchAll(new RegExp(`ADD CONSTRAINT "${name}"`, 'g'))].length,
]));
const presentCount = [...constraintCounts.values()].filter((count) => count > 0).length;
const duplicatedNames = [...constraintCounts]
  .filter(([, count]) => count > 1)
  .map(([name]) => name);

if (duplicatedNames.length > 0) {
  throw new Error(`Generated migration contains duplicate metadata constraints: ${duplicatedNames.join(', ')}.`);
}

if (presentCount === constraintNames.length) {
  for (const [name, expression] of expectedConstraints) {
    if (!documentConstraintStatements.includes(`ADD CONSTRAINT "${name}"`)) {
      throw new Error(`Metadata constraint "${name}" is not attached to the Document table.`);
    }

    const escapedExpression = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expectedDefinition = new RegExp(
      `ADD CONSTRAINT "${name}"\\s+CHECK\\s*\\(\\s*${escapedExpression}\\s*\\)`,
    );

    if (!expectedDefinition.test(documentConstraintStatements)) {
      throw new Error(`Metadata constraint "${name}" is present with a missing or incorrect CHECK expression; expected CHECK (${expression}).`);
    }
  }

  process.exit(0);
}

if (presentCount > 0) {
  const missingNames = [...constraintCounts]
    .filter(([, count]) => count === 0)
    .map(([name]) => name);
  throw new Error(`Generated migration contains only some metadata constraints; missing: ${missingNames.join(', ')}.`);
}

const checkConstraints = `
-- Prisma schema does not currently express PostgreSQL CHECK constraints.
ALTER TABLE "Document"
    ADD CONSTRAINT "Document_fileSizeBytes_positive_check"
        CHECK ("fileSizeBytes" > 0),
    ADD CONSTRAINT "Document_mimeType_pdf_check"
        CHECK ("mimeType" = 'application/pdf'),
    ADD CONSTRAINT "Document_pageCount_positive_check"
        CHECK ("pageCount" IS NULL OR "pageCount" > 0),
    ADD CONSTRAINT "Document_filename_nonempty_check"
        CHECK (length(btrim("filename")) > 0),
    ADD CONSTRAINT "Document_storageKey_nonempty_check"
        CHECK ("storageKey" IS NULL OR length(btrim("storageKey")) > 0),
    ADD CONSTRAINT "Document_storageKey_requires_deletedAt_check"
        CHECK ("storageKey" IS NOT NULL OR "deletedAt" IS NOT NULL);
`;

await writeFile(migrationPath, `${migration.trimEnd()}\n${checkConstraints}`);
