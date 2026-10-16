import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { config } from './config/env';
import app from './app';
import { disconnectDatabase } from './database/client';

const server = createServer(app);
let isShuttingDown = false;

server.listen(config.PORT, () => {
  console.log(`Server is running on http://localhost:${config.PORT}`);
});

const shutdown = (): void => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  server.close((error) => {
    if (error) {
      console.error('HTTP server shutdown encountered an error.');
      process.exitCode = 1;
    }

    void disconnectDatabase().catch(() => {
      console.error('Database disconnection failed during shutdown.');
      process.exitCode = 1;
    });
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);