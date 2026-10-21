import { buildApp } from "./app";
import { pool } from "./db";
import { env } from "./env";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info(`Recibido ${signal}. Cerrando servidor...`);
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`API disponible en http://localhost:${env.PORT}/api`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
