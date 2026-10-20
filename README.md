# DocuMind AI Backend

## Overview
DocuMind AI is a production-oriented AI document assistant backend API. This repository contains the backend API and its internal modules, designed to be minimal, understandable, and testable.

## Prerequisites
- Node.js 20.19+, 22.12+, or 24+
- npm (Node package manager)

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/documind-ai-backend.git
   cd documind-ai-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` and fill in values required for your environment. Database URLs are optional for the health endpoint and ordinary tests.

## Environment Setup
The application requires the following environment variables:
- `PORT`: The port on which the server will run (default: 3000).
- `NODE_ENV`: The environment in which the application is running (default: development).
- `CORS_ORIGIN`: The allowed origin for CORS requests.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`: Configure all four backend-only values to enable private Cloudflare R2 storage. Use an R2 API token scoped to the upload bucket with Object Read & Write permissions. Never expose the secret access key to the frontend.
- `MAX_UPLOAD_SIZE_BYTES`: Optional maximum PDF size in bytes (default `10485760`, or 10 MiB; maximum allowed configuration is 50 MiB).
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: Configure both in the backend environment to enable Clerk session-token verification. The secret key is backend-only and must never be placed in frontend code. The frontend sends a Clerk-issued session token as a Bearer token; the backend verifies it with Clerk's Express SDK and restricts authorized parties to `CORS_ORIGIN`.
- `DATABASE_URL`: PostgreSQL connection URL for authenticated user and document operations. It is not required by the health endpoint or ordinary unit/API tests.
- `DIRECT_URL`: Optional direct PostgreSQL URL for Prisma migration tooling, especially when `DATABASE_URL` uses a pooler. Prisma CLI falls back to `DATABASE_URL` if this is unset.

Do not put credentials in source control. `.env.example` contains no connection string; provide real values through a local `.env` file or secret manager only when a database is available. Configuration errors identify the variable and validation problem without printing its value.

## Development
To start the development server, run:
```
npm run dev
```

## Testing
To run the tests, use:
```
npm test
```

## Type Checking
To check for TypeScript errors, run:
```
npm run typecheck
```

## Production Build
To build the application for production, run:
```
npm run build
```

To start the compiled production server, use:
```
npm start
```

## Health Endpoint
To check if the API is responding, you can call the health endpoint:
```
GET /api/health
```
This will return a JSON response indicating that the API is healthy.

## Document API

All document endpoints require a valid Clerk session token in the `Authorization: Bearer <session-token>` header. The backend obtains the Clerk user ID only from verified Clerk token data, resolves it to an internal UUID `User`, and scopes all document access to that UUID. Request bodies cannot set `ownerId`; document responses omit the internal owner UUID.

Upload a PDF and create its metadata:

```http
POST /api/documents/upload
Authorization: Bearer <session-token>
Content-Type: multipart/form-data
```

Send one multipart file field named `file`. The backend checks the declared PDF media type, `%PDF-` signature, and `%%EOF` marker, uploads to private storage using an unpredictable server-generated key, then creates the document record. No storage key, owner ID, object URL, or provider information is accepted from or returned to the client.

```sh
curl -X POST 'https://api.example.com/api/documents/upload' \
  -H 'Authorization: Bearer <clerk-session-token>' \
  -F 'file=@example.pdf;type=application/pdf'
```

Returns `201` with public document metadata. `fileSizeBytes` is serialized as a decimal string to preserve PostgreSQL `BIGINT` precision.

```json
{
  "id": "f4218aad-2cc7-47e7-90b3-0d18bd0eb2f0",
  "filename": "example.pdf",
  "fileSizeBytes": "128",
  "mimeType": "application/pdf",
  "pageCount": null,
  "status": "PENDING",
  "createdAt": "2026-10-20T12:00:00.000Z",
  "updatedAt": "2026-10-20T12:00:00.000Z",
  "deletedAt": null
}
```

For `GET /api/documents`, the response is an array using the same public metadata shape, for example:

```json
[
  {
    "id": "f4218aad-2cc7-47e7-90b3-0d18bd0eb2f0",
    "filename": "example.pdf",
    "fileSizeBytes": "128",
    "mimeType": "application/pdf",
    "pageCount": null,
    "status": "PENDING",
    "createdAt": "2026-10-20T12:00:00.000Z",
    "updatedAt": "2026-10-20T12:00:00.000Z",
    "deletedAt": null
  }
]
```

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/documents/upload` | `201 Created` and document metadata |
| `GET` | `/api/documents` | `200 OK` and the authenticated user's active documents |
| `GET` | `/api/documents/:id` | `200 OK` and the owned active document |
| `DELETE` | `/api/documents/:id` | `204 No Content` after soft deletion |

Missing files return `400`, invalid PDF data returns `415`, oversized uploads return `413`, and missing, invalid, or expired credentials return `401`. A document that is missing, deleted, or belongs to another user returns the same `404` response. Storage and persistence failures return safe errors without provider or database details. If metadata creation fails after upload, the backend attempts to remove the uploaded object.

Cloudflare R2 setup: create a private bucket and an R2 API token scoped to that bucket with Object Read & Write permission. Set the four R2 backend variables in your development environment. Do not configure a public bucket domain or expose the credentials to the frontend. No live upload is available until development credentials and a private bucket have been configured.

## Database Foundation

The persistence layer uses Prisma ORM 7.10.0 with the PostgreSQL driver adapter. The generated client uses Prisma's `prisma-client` generator in CommonJS mode to match the existing TypeScript/Express module setup. `npm run prisma:generate` generates ignored client code under `src/generated/prisma`; it does not connect to PostgreSQL. `npm run prisma:validate` validates the schema without a database.

The initial schema is in `prisma/schema.prisma`, and its reviewed SQL is in `prisma/migrations/20261015000000_init/migration.sql`. To reproduce that initial SQL from the schema without a database, run `npm run prisma:migration:baseline`. This command supplies only a credential-free loopback descriptor to Prisma's schema engine; it does not connect. It appends PostgreSQL `CHECK` constraints through `scripts/append-document-metadata-checks.mjs`, because Prisma Schema Language does not currently represent those constraints. Review generated SQL before adding future migrations. Apply reviewed migrations only against the intended database with Prisma Migrate; this repository setup does not apply migrations automatically at startup.

The schema contains:
- `Document`: UUID `ownerId`, nullable storage key, filename, byte size, PDF MIME type, optional page count, persistent processing status, timestamps, and optional soft-deletion time.
- `Conversation`: owner UUID and timestamps.
- `Message`: conversation owner, validated `USER`/`ASSISTANT` role, content, and chronological index.
- `ConversationDocument`: a many-to-many link for selected documents.

Clerk IDs are stored in `User.clerkUserId`, which is unique; `User.id` is an internal UUID referenced by all ownership fields. User resolution uses a unique-key Prisma upsert, so concurrent first authenticated requests converge on the same internal record. Composite foreign keys include `ownerId` on message and conversation-document relations, preventing a relation from crossing owners; application queries must still scope reads and writes by the resolved internal owner UUID.

### Batch 5 identity migration

The migration `prisma/migrations/20261021000000_add_clerk_user_mapping/migration.sql` creates the User table and adds owner foreign keys as `NOT VALID`. Existing owner UUIDs may have no known Clerk identity, so validating those constraints immediately could fail or require inventing an unsafe identity mapping. PostgreSQL enforces these constraints for new and updated rows while preserving existing rows; historical ownership records remain unvalidated until a verified backfill is completed. Do not mark the migration validated or delete legacy rows without an explicit mapping/retention decision.

After reviewing the migration, apply it only to the Neon **development** branch with `DATABASE_URL` configured for that branch:

```sh
npx prisma migrate deploy
```

Do not run this command with production credentials. This implementation does not connect to any database or apply the migration.

Deleting a conversation cascades to its messages and document links. Document removal is represented by setting `deletedAt`; the document row and conversation-document links remain, and future reads/retrieval must exclude rows with `deletedAt` set. A future cleanup can clear `storageKey` after removing the private object. The restrictive document foreign key prevents a physical delete from silently removing historical conversation references. A future soft-delete workflow must explicitly delete or invalidate document-derived searchable content while retaining conversation links; `deletedAt` filtering must exclude the document from new retrieval and AI processing. No document content, chunks, or embeddings are modeled in this batch.

The requirements specify configurable PDF size and page-count limits but do not specify numeric values. `fileSizeBytes` uses PostgreSQL `BIGINT`; `pageCount` is nullable and positive when known. The later upload/processing configuration must define and enforce the chosen maximums. Database checks reject non-positive sizes, non-positive known page counts, non-PDF MIME types, empty filenames/keys, and a cleared key on a document that is not soft-deleted.

pgvector is not enabled by this migration. A later, deliberate migration must enable the PostgreSQL extension and add a vector representation compatible with the chosen embedding dimensions (for example, a Prisma `Unsupported("vector(N)")` field plus reviewed SQL). No extension is enabled against any database by this setup.

### Database Testing

The ordinary `npm test` suite uses no database credentials and does not connect to PostgreSQL; user and document access are tested with mocked Prisma calls. For a local integration test, use a disposable development database and apply migrations explicitly. Never point a test workflow at a production database.

## Directory Structure
```
documind-ai-backend
├── src
│   ├── app.ts                # Initializes the Express application and middleware
│   ├── server.ts             # Starts the HTTP server
│   ├── config
│   │   └── env.ts            # Validates environment variables
│   ├── database
│   │   └── client.ts         # Reusable Prisma client and adapter
│   ├── middleware
│   │   ├── error-handler.ts   # Centralized error handling
│   │   └── not-found.ts       # Handles 404 errors
│   └── features
│       └── health
│           ├── health.controller.ts # Health check logic
│           └── health.routes.ts      # Defines health endpoint route
├── tests
│   ├── config.test.ts         # Environment configuration tests
│   └── health.test.ts         # Integration tests for health endpoint
├── prisma
│   ├── migrations             # Reviewed PostgreSQL migrations
│   └── schema.prisma          # Prisma data model
├── prisma.config.ts           # Prisma CLI datasource and migration config
├── .env.example                # Example environment variables
├── .gitignore                  # Files to ignore in Git
├── package.json                # Lists dependencies and scripts
├── package-lock.json           # Locks dependency versions
├── tsconfig.json               # TypeScript configuration
├── vitest.config.ts            # Testing configuration
└── README.md                   # Project documentation
```

## Conclusion
This README provides an overview of the DocuMind AI backend project, including setup instructions, environment variables, and how to run the application and tests. For further development, please refer to the code structure and comments within the codebase.