import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import healthRoutes from './features/health/health.routes';
import notFoundHandler from './middleware/not-found';
import errorHandler from './middleware/error-handler';
import { config } from './config/env';

const app = express();

// Middleware setup
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

// Health routes
app.use('/api/health', healthRoutes);

// Not found handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export default app;