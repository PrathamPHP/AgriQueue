import { app } from './app';
import { config } from './config';
import { prisma } from './prisma';

async function startServer() {
  try {
    // Verify database connection on startup
    await prisma.$connect();
    console.log('[PostgreSQL] Connected successfully to agriqueue database.');

    const server = app.listen(config.port, () => {
      console.log(`[AgriQueue Server] REST API running at http://localhost:${config.port}/api/v1`);
      console.log(`[AgriQueue Server] Health check available at http://localhost:${config.port}/api/v1/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n[AgriQueue Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('[PostgreSQL] Disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[AgriQueue Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
