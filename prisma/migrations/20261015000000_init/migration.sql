-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" TEXT,
    "filename" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "mimeType" VARCHAR(127) NOT NULL,
    "pageCount" INTEGER,
    "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationDocument" (
    "conversationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationDocument_pkey" PRIMARY KEY ("conversationId","documentId")
);

-- CreateIndex
CREATE INDEX "Document_ownerId_status_createdAt_idx" ON "Document"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Document_ownerId_deletedAt_createdAt_idx" ON "Document"("ownerId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_ownerId_storageKey_key" ON "Document"("ownerId", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_ownerId_key" ON "Document"("id", "ownerId");

-- CreateIndex
CREATE INDEX "Conversation_ownerId_updatedAt_idx" ON "Conversation"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_id_ownerId_key" ON "Conversation"("id", "ownerId");

-- CreateIndex
CREATE INDEX "Message_ownerId_conversationId_createdAt_id_idx" ON "Message"("ownerId", "conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ConversationDocument_ownerId_documentId_idx" ON "ConversationDocument"("ownerId", "documentId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_ownerId_fkey" FOREIGN KEY ("conversationId", "ownerId") REFERENCES "Conversation"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_conversationId_ownerId_fkey" FOREIGN KEY ("conversationId", "ownerId") REFERENCES "Conversation"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_documentId_ownerId_fkey" FOREIGN KEY ("documentId", "ownerId") REFERENCES "Document"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

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
