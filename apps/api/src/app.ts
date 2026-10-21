import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { ZodError } from "zod";
import { env } from "./env";
import {
  AppError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { categoryRoutes } from "./routes/categories";
import { productRoutes, variantRoutes } from "./routes/products";
import { lowStockRoutes, movementRoutes } from "./routes/movements";
import { saleRoutes } from "./routes/sales";
import { dashboardRoutes } from "./routes/dashboard";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? {
            level: "info",
            transport: {
              target: "pino-pretty",
              options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
            },
          }
        : { level: "info" },
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Revisa los datos del formulario",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        issues: error.issues,
      });
    }

    const code = (error as { code?: string }).code;

    if (code === PG_UNIQUE_VIOLATION) {
      return reply.code(409).send({
        error: "Ya existe un registro con ese SKU, codigo de barras o nombre",
      });
    }

    if (code === PG_FOREIGN_KEY_VIOLATION) {
      return reply.code(409).send({
        error: "El registro esta en uso y no se puede modificar",
      });
    }

    if ((error as { statusCode?: number }).statusCode === 401) {
      return reply.code(401).send({ error: "No autorizado" });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Ocurrio un error inesperado" });
  });

  app.get("/api/health", async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(categoryRoutes, { prefix: "/api/categories" });
  await app.register(productRoutes, { prefix: "/api/products" });
  await app.register(variantRoutes, { prefix: "/api/variants" });
  await app.register(movementRoutes, { prefix: "/api/movements" });
  await app.register(lowStockRoutes, { prefix: "/api/low-stock" });
  await app.register(saleRoutes, { prefix: "/api/sales" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboard" });

  return app;
}
