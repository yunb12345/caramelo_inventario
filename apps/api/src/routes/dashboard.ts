import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { products, saleItems, sales, variants } from "../db/schema";
import { daysAgo, startOfMonth, startOfToday, toDateKey } from "../lib/dates";
import { toLowStockItem, toNumber, toSaleSummaryDTO } from "../lib/mappers";
import { requireAuth } from "../plugins/auth";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async () => {
    const todayStart = startOfToday();
    const monthStart = startOfMonth();
    const weekStart = daysAgo(6);

    const activeProduct = and(eq(products.active, true), eq(variants.active, true));

    const [
      todaySalesRow,
      todayUnitsRow,
      monthRow,
      productCountRow,
      variantCountRow,
      lowStockRow,
      outOfStockRow,
      stockValueRow,
      dailyRows,
      lowStockRows,
      recentSales,
    ] = await Promise.all([
      db
        .select({ sales: count(), revenue: sql<string>`coalesce(sum(${sales.total}), 0)` })
        .from(sales)
        .where(gte(sales.createdAt, todayStart)),
      db
        .select({ units: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int` })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(gte(sales.createdAt, todayStart)),
      db
        .select({ sales: count(), revenue: sql<string>`coalesce(sum(${sales.total}), 0)` })
        .from(sales)
        .where(gte(sales.createdAt, monthStart)),
      db.select({ total: count() }).from(products).where(eq(products.active, true)),
      db.select({ total: count() }).from(variants).where(eq(variants.active, true)),
      db
        .select({ total: count() })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(and(activeProduct, lte(variants.stock, variants.minStock))),
      db
        .select({ total: count() })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(and(activeProduct, eq(variants.stock, 0))),
      db
        .select({ value: sql<string>`coalesce(sum(${variants.stock} * ${variants.cost}), 0)` })
        .from(variants)
        .where(eq(variants.active, true)),
      db
        .select({
          date: sql<string>`to_char(${sales.createdAt}::date, 'YYYY-MM-DD')`,
          revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
          sales: count(),
        })
        .from(sales)
        .where(gte(sales.createdAt, weekStart))
        .groupBy(sql`${sales.createdAt}::date`)
        .orderBy(sql`${sales.createdAt}::date`),
      db
        .select({ variant: variants, product: products })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(and(activeProduct, lte(variants.stock, variants.minStock)))
        .orderBy(asc(variants.stock), asc(products.name))
        .limit(8),
      db.query.sales.findMany({
        with: { user: true, items: { columns: { id: true } } },
        orderBy: [desc(sales.createdAt)],
        limit: 5,
      }),
    ]);

    const byDate = new Map(dailyRows.map((row) => [row.date, row]));

    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const date = daysAgo(6 - index);
      const key = toDateKey(date);
      const row = byDate.get(key);

      return {
        date: key,
        revenue: toNumber(row?.revenue),
        sales: Number(row?.sales ?? 0),
      };
    });

    return {
      today: {
        sales: Number(todaySalesRow[0]?.sales ?? 0),
        revenue: toNumber(todaySalesRow[0]?.revenue),
        units: Number(todayUnitsRow[0]?.units ?? 0),
      },
      month: {
        sales: Number(monthRow[0]?.sales ?? 0),
        revenue: toNumber(monthRow[0]?.revenue),
      },
      products: Number(productCountRow[0]?.total ?? 0),
      variants: Number(variantCountRow[0]?.total ?? 0),
      lowStock: Number(lowStockRow[0]?.total ?? 0),
      outOfStock: Number(outOfStockRow[0]?.total ?? 0),
      stockValue: toNumber(stockValueRow[0]?.value),
      last7Days,
      lowStockVariants: lowStockRows.map((row) =>
        toLowStockItem({ ...row.variant, product: row.product }),
      ),
      recentSales: recentSales.map(toSaleSummaryDTO),
    };
  });
}
