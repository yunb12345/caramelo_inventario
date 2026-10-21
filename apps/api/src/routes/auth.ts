import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema } from "@caramelo/shared";
import { db } from "../db";
import { users } from "../db/schema";
import { AppError } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { requireAuth } from "../plugins/auth";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request) => {
    const body = loginSchema.parse(request.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email.trim().toLowerCase()),
    });

    if (!user) {
      throw new AppError(401, "Email o contrasena incorrectos");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Email o contrasena incorrectos");
    }

    const token = app.jwt.sign({ id: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  });

  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, request.user.id),
      columns: { id: true, name: true, email: true },
    });

    if (!user) throw new AppError(401, "Usuario no encontrado");
    return user;
  });
}
