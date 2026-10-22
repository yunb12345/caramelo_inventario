import { count, eq } from "drizzle-orm";
import { db, pool } from "./index";
import { categories, movements, products, saleItems, sales, users, variants } from "./schema";
import { env } from "../env";
import { hashPassword } from "../lib/password";
import { round2 } from "../lib/mappers";
import type { PaymentMethod } from "@caramelo/shared";

async function seedAdmin() {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    console.log(`  · usuario admin ya existe (${email})`);
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      name: env.ADMIN_NAME,
      email,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    })
    .returning();

  console.log(`  · usuario admin creado (${email})`);
  return created!;
}

async function seedCategories() {
  const names = [
    { name: "Camisetas", color: "#f97316" },
    { name: "Pantalones", color: "#0ea5e9" },
    { name: "Vestidos", color: "#ec4899" },
    { name: "Abrigos", color: "#8b5cf6" },
    { name: "Accesorios", color: "#10b981" },
  ];

  const result = new Map<string, string>();

  for (const item of names) {
    const existing = await db.query.categories.findFirst({
      where: eq(categories.name, item.name),
    });

    if (existing) {
      result.set(item.name, existing.id);
      continue;
    }

    const [created] = await db.insert(categories).values(item).returning();
    result.set(item.name, created!.id);
  }

  return result;
}

type DemoVariant = {
  size: string;
  color: string;
  sku: string;
  stock: number;
  minStock: number;
};

type DemoProduct = {
  name: string;
  description: string;
  brand: string;
  category: string;
  basePrice: number;
  baseCost: number;
  variants: DemoVariant[];
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "Remera Oversize Basica",
    description: "Remera de algodon peinado, calce holgado.",
    brand: "Caramelo",
    category: "Camisetas",
    basePrice: 14900,
    baseCost: 6200,
    variants: [
      { size: "S", color: "Negro", sku: "REM-OVR-S-NEG", stock: 8, minStock: 3 },
      { size: "M", color: "Negro", sku: "REM-OVR-M-NEG", stock: 12, minStock: 3 },
      { size: "L", color: "Negro", sku: "REM-OVR-L-NEG", stock: 2, minStock: 3 },
      { size: "M", color: "Blanco", sku: "REM-OVR-M-BLA", stock: 6, minStock: 3 },
      { size: "L", color: "Blanco", sku: "REM-OVR-L-BLA", stock: 0, minStock: 3 },
    ],
  },
  {
    name: "Jean Recto Clasico",
    description: "Jean de denim rigido con tiro alto.",
    brand: "Caramelo",
    category: "Pantalones",
    basePrice: 32900,
    baseCost: 14500,
    variants: [
      { size: "38", color: "Azul", sku: "JEA-REC-38-AZU", stock: 4, minStock: 2 },
      { size: "40", color: "Azul", sku: "JEA-REC-40-AZU", stock: 7, minStock: 2 },
      { size: "42", color: "Azul", sku: "JEA-REC-42-AZU", stock: 5, minStock: 2 },
      { size: "44", color: "Azul", sku: "JEA-REC-44-AZU", stock: 1, minStock: 2 },
      { size: "46", color: "Azul", sku: "JEA-REC-46-AZU", stock: 3, minStock: 2 },
    ],
  },
  {
    name: "Vestido Midi de Lino",
    description: "Vestido midi con botones frontales y cinto.",
    brand: "Caramelo",
    category: "Vestidos",
    basePrice: 42000,
    baseCost: 19000,
    variants: [
      { size: "S", color: "Arena", sku: "VES-MID-S-ARE", stock: 3, minStock: 2 },
      { size: "M", color: "Arena", sku: "VES-MID-M-ARE", stock: 4, minStock: 2 },
      { size: "L", color: "Arena", sku: "VES-MID-L-ARE", stock: 2, minStock: 2 },
      { size: "M", color: "Negro", sku: "VES-MID-M-NEG", stock: 1, minStock: 2 },
    ],
  },
  {
    name: "Buzo Canguro Frisa",
    description: "Buzo de frisa con capucha y bolsillo canguro.",
    brand: "Caramelo",
    category: "Abrigos",
    basePrice: 28900,
    baseCost: 12000,
    variants: [
      { size: "M", color: "Gris", sku: "BUZ-CAN-M-GRI", stock: 9, minStock: 3 },
      { size: "L", color: "Gris", sku: "BUZ-CAN-L-GRI", stock: 6, minStock: 3 },
      { size: "XL", color: "Gris", sku: "BUZ-CAN-XL-GRI", stock: 2, minStock: 3 },
      { size: "M", color: "Negro", sku: "BUZ-CAN-M-NEG", stock: 7, minStock: 3 },
    ],
  },
  {
    name: "Gorra Bordada",
    description: "Gorra de gabardina con logo bordado.",
    brand: "Caramelo",
    category: "Accesorios",
    basePrice: 9900,
    baseCost: 3500,
    variants: [
      { size: "UNICO", color: "Negro", sku: "GOR-BOR-UNI-NEG", stock: 14, minStock: 4 },
      { size: "UNICO", color: "Beige", sku: "GOR-BOR-UNI-BEI", stock: 3, minStock: 4 },
    ],
  },
];

async function seedProducts(categoryIds: Map<string, string>) {
  const existing = await db.select({ total: count() }).from(products);
  if (Number(existing[0]?.total ?? 0) > 0) {
    console.log("  · productos ya existen, se omite la demo");
    return;
  }

  for (const demo of DEMO_PRODUCTS) {
    const [product] = await db
      .insert(products)
      .values({
        name: demo.name,
        description: demo.description,
        brand: demo.brand,
        categoryId: categoryIds.get(demo.category) ?? null,
        basePrice: demo.basePrice.toFixed(2),
        baseCost: demo.baseCost.toFixed(2),
      })
      .returning();

    for (const variant of demo.variants) {
      const [inserted] = await db
        .insert(variants)
        .values({
          productId: product!.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          price: demo.basePrice.toFixed(2),
          cost: demo.baseCost.toFixed(2),
          stock: variant.stock,
          minStock: variant.minStock,
        })
        .returning();

      if (variant.stock > 0) {
        await db.insert(movements).values({
          variantId: inserted!.id,
          type: "IN",
          quantity: variant.stock,
          resultingStock: variant.stock,
          reason: "Stock inicial (demo)",
        });
      }
    }
  }

  console.log(`  · ${DEMO_PRODUCTS.length} productos demo creados`);
}

async function seedDemoSales(adminId: string) {
  const existing = await db.select({ total: count() }).from(sales);
  if (Number(existing[0]?.total ?? 0) > 0) {
    console.log("  · ventas ya existen, se omite la demo");
    return;
  }

  const allVariants = await db.select().from(variants);
  if (allVariants.length === 0) return;

  const payments: PaymentMethod[] = ["CASH", "CARD", "TRANSFER", "CASH"];

  for (let index = 0; index < 4; index += 1) {
    const when = new Date();
    when.setDate(when.getDate() - (3 - index));
    when.setHours(11 + index * 2, 15 + index, 0, 0);

    const first = allVariants[(index * 3) % allVariants.length]!;
    const second = allVariants[(index * 3 + 5) % allVariants.length]!;
    const picks = [
      { variant: first, quantity: 1 + (index % 2) },
      { variant: second, quantity: 1 },
    ].filter((pick) => pick.variant.stock >= pick.quantity);

    if (picks.length === 0) continue;

    await db.transaction(async (tx) => {
      let subtotal = 0;
      const prepared = picks.map((pick) => {
        const unitPrice = Number(pick.variant.price);
        const lineTotal = round2(unitPrice * pick.quantity);
        subtotal = round2(subtotal + lineTotal);
        return { ...pick, unitPrice, lineTotal };
      });

      const [sale] = await tx
        .insert(sales)
        .values({
          subtotal: subtotal.toFixed(2),
          discount: "0",
          total: subtotal.toFixed(2),
          paymentMethod: payments[index]!,
          userId: adminId,
          createdAt: when,
        })
        .returning();

      for (const line of prepared) {
        await tx.insert(saleItems).values({
          saleId: sale!.id,
          variantId: line.variant.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toFixed(2),
          unitCost: Number(line.variant.cost).toFixed(2),
          subtotal: line.lineTotal.toFixed(2),
        });

        const newStock = line.variant.stock - line.quantity;
        await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, line.variant.id));

        await tx.insert(movements).values({
          variantId: line.variant.id,
          type: "SALE",
          quantity: -line.quantity,
          resultingStock: newStock,
          reason: "Venta (demo)",
          reference: `Venta #${sale!.number}`,
          saleId: sale!.id,
          userId: adminId,
          createdAt: when,
        });
      }
    });
  }

  console.log("  · ventas demo creadas");
}

async function main() {
  console.log("\nSembrando base de datos de Caramelo...\n");

  const admin = await seedAdmin();

  const seedDemo = env.SEED_DEMO === "true" || (env.SEED_DEMO === undefined && env.NODE_ENV !== "production");

  if (seedDemo) {
    const categoryIds = await seedCategories();
    await seedProducts(categoryIds);
    await seedDemoSales(admin.id);
  } else {
    console.log("  · SEED_DEMO desactivado: se omite el catalogo y las ventas de ejemplo");
  }

  console.log("\nListo.");
  console.log(`  Usuario: ${env.ADMIN_EMAIL}`);
  console.log(`  Clave:   ${env.ADMIN_PASSWORD}\n`);

  if (env.SEED_DEMO === "false") {
    console.log(`  El usuario admin existente no se modifica: el seed solo lo crea cuando no existe.`);
    console.log(`  Si cambiaste ADMIN_PASSWORD despues de crearlo, no se aplica.\n`);
  }
}

try {
  await main();
} catch (error) {
  console.error("\nError al sembrar la base de datos:\n", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
