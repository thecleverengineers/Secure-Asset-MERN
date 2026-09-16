import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { attachSocket } from './services/socket.js';
import { scheduleSurveyorLifecycleMaintenance } from './services/surveyorLifecycle.js';
import { ensureStorageDirectories } from './services/storage.js';
import { ensureBackupDirectories } from './services/backupRecovery.js';
import { ensureServerSessionIndexes } from './services/serverSession.js';

let server;
let stopSurveyorMaintenance = () => {};
let shuttingDown = false;

async function start() {
  await ensureStorageDirectories();
  await ensureBackupDirectories();
  await connectDatabase();
  await ensureServerSessionIndexes();

  const app = createApp();
  server = http.createServer(app);
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 60_000;
  attachSocket(server);
  stopSurveyorMaintenance = scheduleSurveyorLifecycleMaintenance();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  console.log(`SecureAsset listening on http://127.0.0.1:${env.PORT}`);
  if (typeof process.send === 'function') process.send('ready');
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down gracefully`);

  const forceTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out; forcing process exit');
    server?.closeAllConnections?.();
    process.exit(1);
  }, 15_000);
  forceTimer.unref();

  try {
    stopSurveyorMaintenance();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    clearTimeout(forceTimer);
    process.exit(exitCode);
  } catch (error) {
    console.error('Shutdown failed:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  void shutdown('uncaughtException', 1);
});

start().catch(async (error) => {
  console.error('SecureAsset failed to start:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
