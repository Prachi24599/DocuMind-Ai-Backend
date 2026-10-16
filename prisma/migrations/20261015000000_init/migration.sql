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
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

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
ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_documentId_ownerId_fkey" FOREIGN KEY ("documentId", "ownerId") REFERENCES "Document"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
