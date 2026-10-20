import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import healthRoutes from './features/health/health.routes';
import notFoundHandler from './middleware/not-found';
import errorHandler from './middleware/error-handler';
import { config } from './config/env';
import { clerkSessionMiddleware } from './middleware/clerk-auth';
import documentRoutes from './features/documents/document.routes';

const app = express();

// Clerk must run before other middleware so it can verify session tokens.
app.use(clerkSessionMiddleware);

// Middleware setup
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

// Health routes
app.use('/api/health', healthRoutes);
app.use('/api/documents', documentRoutes);

// Not found handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export default app;