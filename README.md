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
- `DATABASE_URL`: Optional PostgreSQL connection URL used at runtime when database access is introduced. It is not required by the health endpoint or ordinary tests.
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

## Database Foundation

The persistence layer uses Prisma ORM 7.10.0 with the PostgreSQL driver adapter. The generated client uses Prisma's `prisma-client` generator in CommonJS mode to match the existing TypeScript/Express module setup. `npm run prisma:generate` generates ignored client code under `src/generated/prisma`; it does not connect to PostgreSQL. `npm run prisma:validate` validates the schema without a database.

The initial schema is in `prisma/schema.prisma`, and its reviewed SQL is in `prisma/migrations/20261015000000_init/migration.sql`. To reproduce that initial SQL from the schema without a database, run `npm run prisma:migration:baseline`. This command supplies only a credential-free loopback descriptor to Prisma's schema engine; it does not connect. Review generated SQL before adding future migrations. Apply reviewed migrations only against the intended database with Prisma Migrate; this repository setup does not apply migrations automatically at startup.

The schema contains:
- `Document`: owner UUID from Supabase Auth, storage key, filename, persistent processing status, and timestamps.
- `Conversation`: owner UUID and timestamps.
- `Message`: conversation owner, validated `USER`/`ASSISTANT` role, content, and chronological index.
- `ConversationDocument`: a many-to-many link for selected documents.

There is deliberately no local `User` model or Supabase auth table. Composite foreign keys include `ownerId` on message and conversation-document relations, preventing a relation from crossing owners; application queries must still scope reads and writes by the authenticated Supabase user ID. These foreign keys do not verify an owner against Supabase Auth. Account deletion and any resulting orphaned rows require an explicit future cleanup policy.

Deleting a conversation cascades to its messages and document links. Deleting a document cascades only to its conversation links, preserving conversation and message history. Future document-derived searchable content should have a foreign key to its source document with `ON DELETE CASCADE`, so deleting the document removes that content without deleting conversations. No document content, chunks, or embeddings are modeled in this batch.

pgvector is not enabled by this migration. A later, deliberate migration must enable the PostgreSQL extension and add a vector representation compatible with the chosen embedding dimensions (for example, a Prisma `Unsupported("vector(N)")` field plus reviewed SQL). No extension is enabled against any database by this setup.

### Database Testing

The ordinary `npm test` suite uses no database credentials and does not connect to PostgreSQL. Future database integration tests should use a disposable PostgreSQL instance, set its `DATABASE_URL` and (if needed) `DIRECT_URL` only in the test environment, apply the checked-in migrations with `npx prisma migrate deploy`, then run the integration tests. Never point this workflow at a shared or production database. Database connectivity and migration application have not been verified against a live database.

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