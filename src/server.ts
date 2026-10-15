import express from 'express';
import { createServer } from 'http';
import { config } from './config/env';
import app from './app';

const server = createServer(app);

server.listen(config.PORT, () => {
  console.log(`Server is running on http://localhost:${config.PORT}`);
});