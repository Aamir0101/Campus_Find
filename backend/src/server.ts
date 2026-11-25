import { createApp } from './app.js';
import { disconnectDatabase, loadEnv } from './config/index.js';
import { logger } from './utils/logger.js';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('CampusFind backend server listening', {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

async function shutdown(signal: string) {
  logger.info('Shutting down backend server', { signal });
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
