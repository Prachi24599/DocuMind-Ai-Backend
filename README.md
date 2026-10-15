# DocuMind AI Backend

## Overview
DocuMind AI is a production-oriented AI document assistant backend API. This repository contains the backend API and its internal modules, designed to be minimal, understandable, and testable.

## Prerequisites
- Node.js (version 20 or higher)
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
   - Copy `.env.example` to `.env` and fill in the required values.

## Environment Setup
The application requires the following environment variables:
- `PORT`: The port on which the server will run (default: 3000).
- `NODE_ENV`: The environment in which the application is running (default: development).
- `CORS_ORIGIN`: The allowed origin for CORS requests.

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

## Directory Structure
```
documind-ai-backend
├── src
│   ├── app.ts                # Initializes the Express application and middleware
│   ├── server.ts             # Starts the HTTP server
│   ├── config
│   │   └── env.ts            # Validates environment variables
│   ├── middleware
│   │   ├── error-handler.ts   # Centralized error handling
│   │   └── not-found.ts       # Handles 404 errors
│   └── features
│       └── health
│           ├── health.controller.ts # Health check logic
│           └── health.routes.ts      # Defines health endpoint route
├── tests
│   └── health.test.ts         # Integration tests for health endpoint
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