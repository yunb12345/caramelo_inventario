import type { FastifyInstance } from "fastify";
import { asc, count, eq } from "drizzle-orm";
import { categoryCreateSchema, categoryUpdateSchema } from "@caramelo/shared";
import { db } from "../db";
import { categories, products } from "../db/schema";
import type { Category } from "../db/schema";
import { notFound } from "../lib/errors";
import { toCategoryDTO } from "../lib/mappers";
import { requireAuth } from "../plugins/auth";

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => {
    const rows = await db
      .select({ category: categories, productCount: count(products.id) })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));

    return rows.map((row) => toCategoryDTO(row.category, Number(row.productCount)));
  });

  app.post("/", async (request, reply) => {
    const body = categoryCreateSchema.parse(request.body);

    const [created] = await db
      .insert(categories)
      .values({ name: body.name, color: body.color ?? null })
      .returning();

    return reply.code(201).send(toCategoryDTO(created!));
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = categoryUpdateSchema.parse(request.body);

    const updates: Partial<Category> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color ?? null;

    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();

    if (!updated) throw notFound("Categoria");
    return toCategoryDTO(updated);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };

    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
    if (!deleted) throw notFound("Categoria");

    return { ok: true };
  });
}
