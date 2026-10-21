import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const movementTypeEnum = pgEnum("movement_type", [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "SALE",
  "RETURN",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "CARD",
  "TRANSFER",
  "OTHER",
]);

/* --------------------------------- Usuarios -------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------- Categorias ------------------------------- */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  color: varchar("color", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------- Productos ------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    brand: varchar("brand", { length: 80 }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    basePrice: money("base_price").notNull().default("0"),
    baseCost: money("base_cost").notNull().default("0"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("products_name_idx").on(table.name)],
);

/* --------------------------------- Variantes ------------------------------- */

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    barcode: varchar("barcode", { length: 64 }).unique(),
    size: varchar("size", { length: 20 }).notNull(),
    color: varchar("color", { length: 40 }).notNull(),
    price: money("price").notNull(),
    cost: money("cost").notNull().default("0"),
    stock: integer("stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("variants_product_idx").on(table.productId)],
);

/* ---------------------------------- Ventas --------------------------------- */

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull().generatedAlwaysAsIdentity({ startWith: 1 }),
    subtotal: money("subtotal").notNull(),
    discount: money("discount").notNull().default("0"),
    total: money("total").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    note: text("note"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sales_created_idx").on(table.createdAt)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    unitCost: money("unit_cost").notNull().default("0"),
    subtotal: money("subtotal").notNull(),
  },
  (table) => [index("sale_items_sale_idx").on(table.saleId)],
);

/* ------------------------------- Movimientos ------------------------------- */

export const movements = pgTable(
  "movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    type: movementTypeEnum("type").notNull(),
    /** Delta aplicado al stock: positivo ingresa, negativo egresa. */
    quantity: integer("quantity").notNull(),
    resultingStock: integer("resulting_stock").notNull(),
    reason: text("reason"),
    reference: varchar("reference", { length: 120 }),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("movements_variant_idx").on(table.variantId),
    index("movements_created_idx").on(table.createdAt),
  ],
);

/* -------------------------------- Relaciones ------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  movements: many(movements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  movements: many(movements),
  saleItems: many(saleItems),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  user: one(users, { fields: [sales.userId], references: [users.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  variant: one(variants, { fields: [saleItems.variantId], references: [variants.id] }),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  variant: one(variants, { fields: [movements.variantId], references: [variants.id] }),
  user: one(users, { fields: [movements.userId], references: [users.id] }),
  sale: one(sales, { fields: [movements.saleId], references: [sales.id] }),
}));

/* ---------------------------------- Tipos ---------------------------------- */

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Movement = typeof movements.$inferSelect;
