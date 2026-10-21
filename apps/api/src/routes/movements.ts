import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import {
  MOVEMENT_TYPES,
  movementCreateSchema,
  movementListQuerySchema,
  type MovementType,
} from "@caramelo/shared";
import { db } from "../db";
import { movements, products, variants } from "../db/schema";
import { badRequest, notFound } from "../lib/errors";
import { toMovementDTO } from "../lib/mappers";
import { requireAuth } from "../plugins/auth";

export async function movementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    const query = movementListQuerySchema.parse(request.query);
    const conditions: SQL[] = [];

    if (query.variantId) conditions.push(eq(movements.variantId, query.variantId));
    if (query.type && (MOVEMENT_TYPES as readonly string[]).includes(query.type)) {
      conditions.push(eq(movements.type, query.type as MovementType));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRow] = await Promise.all([
      db.query.movements.findMany({
        where,
        with: { variant: { with: { product: true } }, user: true },
        orderBy: [desc(movements.createdAt)],
        limit: query.pageSize,
        offset,
      }),
      db.select({ total: count() }).from(movements).where(where),
    ]);

    const total = Number(totalRow[0]?.total ?? 0);

    return {
      data: rows.map(toMovementDTO),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  });

  app.post("/", async (request, reply) => {
    const body = movementCreateSchema.parse(request.body);

    const result = await db.transaction(async (tx) => {
      const [variant] = await tx
        .select()
        .from(variants)
        .where(eq(variants.id, body.variantId))
        .for("update");

      if (!variant) throw notFound("Variante");

      let delta: number;
      if (body.type === "ADJUSTMENT") {
        delta = body.quantity - variant.stock;
      } else if (body.type === "IN") {
        delta = body.quantity;
      } else {
        delta = -body.quantity;
      }

      const newStock = variant.stock + delta;
      if (newStock < 0) {
        throw badRequest(`Stock insuficiente. Disponible actualmente: ${variant.stock}`);
      }

      if (delta === 0) {
        throw badRequest("El ajuste no modifica el stock actual");
      }

      await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, variant.id));

      const [movement] = await tx
        .insert(movements)
        .values({
          variantId: variant.id,
          type: body.type,
          quantity: delta,
          resultingStock: newStock,
          reason: body.reason ?? null,
          reference: body.reference ?? null,
          userId: request.user.id,
        })
        .returning();

      return movement!;
    });

    const full = await db.query.movements.findFirst({
      where: eq(movements.id, result.id),
      with: { variant: { with: { product: true } }, user: true },
    });

    return reply.code(201).send(toMovementDTO(full!));
  });

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };

    const movement = await db.query.movements.findFirst({
      where: eq(movements.id, id),
      with: { variant: { with: { product: true } }, user: true },
    });

    if (!movement) throw notFound("Movimiento");
    return toMovementDTO(movement);
  });
}

/** Variantes con stock bajo o agotado, ordenadas por gravedad. */
export async function lowStockRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => {
    const rows = await db
      .select({ variant: variants, product: products })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(
        and(
          eq(variants.active, true),
          eq(products.active, true),
          lte(variants.stock, variants.minStock),
        ),
      )
      .orderBy(asc(variants.stock), asc(products.name))
      .limit(100);

    return rows.map(({ variant, product }) => ({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      minStock: variant.minStock,
    }));
  });
}
