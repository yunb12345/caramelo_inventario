import type { FastifyInstance } from "fastify";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
  variantCreateSchema,
  variantUpdateSchema,
} from "@caramelo/shared";
import { db } from "../db";
import { movements, products, saleItems, variants } from "../db/schema";
import type { Product } from "../db/schema";
import { conflict, notFound, badRequest } from "../lib/errors";
import { toMoney, toNumber, toProductDTO, toVariantDTO } from "../lib/mappers";
import { requireAuth } from "../plugins/auth";

async function loadProduct(id: string) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: true,
      variants: { orderBy: [asc(variants.size), asc(variants.color)] },
    },
  });

  if (!product) throw notFound("Producto");
  return toProductDTO(product);
}

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    const query = productListQuerySchema.parse(request.query);
    const conditions: SQL[] = [];

    if (!query.includeInactive) conditions.push(eq(products.active, true));
    if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));

    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(products.name, term),
        ilike(products.brand, term),
        ilike(products.description, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (query.lowStock) {
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(variants)
            .where(
              and(
                eq(variants.productId, products.id),
                eq(variants.active, true),
                lte(variants.stock, variants.minStock),
              ),
            ),
        ),
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRow] = await Promise.all([
      db.query.products.findMany({
        where,
        with: {
          category: true,
          variants: { orderBy: [asc(variants.size), asc(variants.color)] },
        },
        orderBy: [desc(products.createdAt)],
        limit: query.pageSize,
        offset,
      }),
      db.select({ total: count() }).from(products).where(where),
    ]);

    const total = Number(totalRow[0]?.total ?? 0);

    return {
      data: rows.map(toProductDTO),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  });

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return loadProduct(id);
  });

  app.post("/", async (request, reply) => {
    const body = productCreateSchema.parse(request.body);
    const skus = body.variants.map((variant) => variant.sku.toLowerCase());
    const duplicated = skus.find((sku, index) => skus.indexOf(sku) !== index);
    if (duplicated) throw conflict(`El SKU "${duplicated}" esta repetido en el formulario`);

    const barcodes = body.variants
      .map((variant) => variant.barcode)
      .filter((barcode): barcode is string => Boolean(barcode));
    const duplicatedBarcode = barcodes.find(
      (barcode, index) => barcodes.indexOf(barcode) !== index,
    );
    if (duplicatedBarcode) {
      throw conflict(`El codigo de barras "${duplicatedBarcode}" esta repetido en el formulario`);
    }

    const created = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: body.name,
          description: body.description ?? null,
          brand: body.brand ?? null,
          categoryId: body.categoryId ?? null,
          basePrice: toMoney(body.basePrice),
          baseCost: toMoney(body.baseCost ?? 0),
          active: body.active ?? true,
        })
        .returning();

      for (const variant of body.variants) {
        const stock = variant.stock ?? 0;
        const [inserted] = await tx
          .insert(variants)
          .values({
            productId: product!.id,
            sku: variant.sku,
            barcode: variant.barcode?.trim() || null,
            size: variant.size,
            color: variant.color,
            price: toMoney(variant.price ?? body.basePrice),
            cost: toMoney(variant.cost ?? body.baseCost ?? 0),
            stock,
            minStock: variant.minStock ?? 0,
          })
          .returning();

        if (stock > 0) {
          await tx.insert(movements).values({
            variantId: inserted!.id,
            type: "IN",
            quantity: stock,
            resultingStock: stock,
            reason: "Stock inicial",
            userId: request.user.id,
          });
        }
      }

      return product!;
    });

    return reply.code(201).send(await loadProduct(created.id));
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = productUpdateSchema.parse(request.body);

    const updates: Partial<Product> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (body.brand !== undefined) updates.brand = body.brand ?? null;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId ?? null;
    if (body.basePrice !== undefined) updates.basePrice = toMoney(body.basePrice);
    if (body.baseCost !== undefined) updates.baseCost = toMoney(body.baseCost);
    if (body.active !== undefined) updates.active = body.active;

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();

    if (!updated) throw notFound("Producto");
    return loadProduct(updated.id);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };

    const [updated] = await db
      .update(products)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!updated) throw notFound("Producto");

    await db.update(variants).set({ active: false }).where(eq(variants.productId, id));

    return { ok: true };
  });

  app.post("/:id/variants", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = variantCreateSchema.parse(request.body);

    const product = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!product) throw notFound("Producto");

    const stock = body.stock ?? 0;

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(variants)
        .values({
          productId: product.id,
          sku: body.sku,
          barcode: body.barcode?.trim() || null,
          size: body.size,
          color: body.color,
          price: toMoney(body.price ?? toNumber(product.basePrice)),
          cost: toMoney(body.cost ?? toNumber(product.baseCost)),
          stock,
          minStock: body.minStock ?? 0,
        })
        .returning();

      if (stock > 0) {
        await tx.insert(movements).values({
          variantId: inserted!.id,
          type: "IN",
          quantity: stock,
          resultingStock: stock,
          reason: "Stock inicial",
          userId: request.user.id,
        });
      }

      return inserted!;
    });

    return reply.code(201).send(toVariantDTO(created));
  });

  app.patch("/:id/variants/:variantId", async (request) => {
    const { id, variantId } = request.params as { id: string; variantId: string };
    const body = variantUpdateSchema.parse(request.body);

    const updates: Partial<typeof variants.$inferInsert> = {};
    if (body.size !== undefined) updates.size = body.size;
    if (body.color !== undefined) updates.color = body.color;
    if (body.sku !== undefined) updates.sku = body.sku;
    if (body.barcode !== undefined) updates.barcode = body.barcode?.trim() || null;
    if (body.price !== undefined) updates.price = toMoney(body.price ?? 0);
    if (body.cost !== undefined) updates.cost = toMoney(body.cost ?? 0);
    if (body.minStock !== undefined) updates.minStock = body.minStock;
    if (body.active !== undefined) updates.active = body.active;

    const [updated] = await db
      .update(variants)
      .set(updates)
      .where(and(eq(variants.id, variantId), eq(variants.productId, id)))
      .returning();

    if (!updated) throw notFound("Variante");
    return toVariantDTO(updated);
  });

  app.delete("/:id/variants/:variantId", async (request) => {
    const { variantId } = request.params as { id: string; variantId: string };

    const salesCount = await db
      .select({ total: count() })
      .from(saleItems)
      .where(eq(saleItems.variantId, variantId));

    if (Number(salesCount[0]?.total ?? 0) > 0) {
      throw conflict("No se puede eliminar: la variante tiene ventas registradas. Desactivala.");
    }

    const [updated] = await db
      .update(variants)
      .set({ active: false })
      .where(eq(variants.id, variantId))
      .returning();

    if (!updated) throw notFound("Variante");
    return { ok: true, deactivated: true };
  });

  app.get("/:id/variants/:variantId/movements", async (request) => {
    const { variantId } = request.params as { id: string; variantId: string };

    const rows = await db.query.movements.findMany({
      where: eq(movements.variantId, variantId),
      with: { variant: { with: { product: true } }, user: true },
      orderBy: [desc(movements.createdAt)],
      limit: 50,
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: row.quantity,
      resultingStock: row.resultingStock,
      reason: row.reason,
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
      user: row.user ? { id: row.user.id, name: row.user.name } : null,
    }));
  });
}

export async function variantRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/search", async (request) => {
    const { q } = request.query as { q?: string };
    const term = q?.trim();
    if (!term) return [];

    const like = `%${term}%`;

    const rows = await db
      .select({ variant: variants, product: products })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(
        and(
          eq(variants.active, true),
          eq(products.active, true),
          or(
            ilike(products.name, like),
            ilike(variants.sku, like),
            ilike(variants.color, like),
            eq(variants.barcode, term),
          ),
        ),
      )
      .orderBy(asc(products.name), asc(variants.size))
      .limit(40);

    return rows.map(({ variant, product }) => ({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      price: toNumber(variant.price),
      stock: variant.stock,
    }));
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = variantUpdateSchema.parse(request.body);

    if (body.price === undefined && body.cost === undefined) {
      throw badRequest("Nada para actualizar");
    }

    const updates: Partial<typeof variants.$inferInsert> = {};
    if (body.price !== undefined) updates.price = toMoney(body.price ?? 0);
    if (body.cost !== undefined) updates.cost = toMoney(body.cost ?? 0);

    const [updated] = await db
      .update(variants)
      .set(updates)
      .where(eq(variants.id, id))
      .returning();

    if (!updated) throw notFound("Variante");
    return toVariantDTO(updated);
  });
}
