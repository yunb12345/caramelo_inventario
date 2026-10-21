import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { saleCreateSchema, saleListQuerySchema } from "@caramelo/shared";
import { db } from "../db";
import { movements, saleItems, sales, variants } from "../db/schema";
import { badRequest, notFound } from "../lib/errors";
import { parseDateRange } from "../lib/dates";
import { round2, toMoney, toNumber, toSaleDTO, toSaleSummaryDTO } from "../lib/mappers";
import { requireAuth } from "../plugins/auth";

type MergedItem = { variantId: string; quantity: number; unitPrice?: number | null };

function mergeItems(items: { variantId: string; quantity: number; unitPrice?: number | null }[]) {
  const merged = new Map<string, MergedItem>();

  for (const item of items) {
    const existing = merged.get(item.variantId);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.unitPrice != null) existing.unitPrice = item.unitPrice;
    } else {
      merged.set(item.variantId, { ...item });
    }
  }

  return [...merged.values()];
}

export async function saleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    const query = saleListQuerySchema.parse(request.query);
    const conditions: SQL[] = [];
    const range = parseDateRange(query.from, query.to);

    if (range.from) conditions.push(gte(sales.createdAt, range.from));
    if (range.to) conditions.push(lte(sales.createdAt, range.to));

    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRow] = await Promise.all([
      db.query.sales.findMany({
        where,
        with: { user: true, items: { columns: { id: true } } },
        orderBy: [desc(sales.createdAt)],
        limit: query.pageSize,
        offset,
      }),
      db.select({ total: count() }).from(sales).where(where),
    ]);

    const total = Number(totalRow[0]?.total ?? 0);

    return {
      data: rows.map(toSaleSummaryDTO),
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

    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: {
        user: true,
        items: { with: { variant: { with: { product: true } } } },
      },
    });

    if (!sale) throw notFound("Venta");
    return toSaleDTO(sale);
  });

  app.post("/", async (request, reply) => {
    const body = saleCreateSchema.parse(request.body);
    const items = mergeItems(body.items);

    const saleId = await db.transaction(async (tx) => {
      const variantsRows = await tx
        .select()
        .from(variants)
        .where(
          inArray(
            variants.id,
            items.map((item) => item.variantId),
          ),
        )
        .for("update");

      const byId = new Map(variantsRows.map((variant) => [variant.id, variant]));

      let subtotal = 0;
      const prepared: {
        variantId: string;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        lineSubtotal: number;
      }[] = [];

      for (const item of items) {
        const variant = byId.get(item.variantId);

        if (!variant) throw badRequest("Uno de los productos ya no existe");
        if (!variant.active) throw badRequest(`La variante ${variant.sku} esta desactivada`);
        if (variant.stock < item.quantity) {
          throw badRequest(
            `Stock insuficiente para ${variant.sku}. Disponible: ${variant.stock}`,
          );
        }

        const unitPrice = round2(item.unitPrice ?? toNumber(variant.price));
        const lineSubtotal = round2(unitPrice * item.quantity);

        subtotal = round2(subtotal + lineSubtotal);
        prepared.push({
          variantId: variant.id,
          quantity: item.quantity,
          unitPrice,
          unitCost: toNumber(variant.cost),
          lineSubtotal,
        });
      }

      const discount = round2(Math.min(body.discount ?? 0, subtotal));
      const total = round2(subtotal - discount);

      const [sale] = await tx
        .insert(sales)
        .values({
          subtotal: toMoney(subtotal),
          discount: toMoney(discount),
          total: toMoney(total),
          paymentMethod: body.paymentMethod,
          note: body.note ?? null,
          userId: request.user.id,
        })
        .returning();

      for (const line of prepared) {
        await tx.insert(saleItems).values({
          saleId: sale!.id,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: toMoney(line.unitPrice),
          unitCost: toMoney(line.unitCost),
          subtotal: toMoney(line.lineSubtotal),
        });

        const newStock = (byId.get(line.variantId)!.stock ?? 0) - line.quantity;

        await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, line.variantId));

        await tx.insert(movements).values({
          variantId: line.variantId,
          type: "SALE",
          quantity: -line.quantity,
          resultingStock: newStock,
          reason: "Venta",
          reference: `Venta #${sale!.number}`,
          saleId: sale!.id,
          userId: request.user.id,
        });
      }

      return sale!.id;
    });

    const full = await db.query.sales.findFirst({
      where: eq(sales.id, saleId),
      with: {
        user: true,
        items: { with: { variant: { with: { product: true } } } },
      },
    });

    return reply.code(201).send(toSaleDTO(full!));
  });
}
