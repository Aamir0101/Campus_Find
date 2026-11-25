import { checkDatabaseConnection, disconnectDatabase } from '../config/prisma.js';

async function run() {
  const result = await checkDatabaseConnection();
  if (!result.connected) {
    console.error(`Database connection check failed: ${result.error}`);
    process.exitCode = 1;
  } else {
    console.info(
      `Database connection verified successfully in ${result.latencyMs}ms.`,
    );
  }
  await disconnectDatabase();
}

void run();
