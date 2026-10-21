import { z } from "zod";
import { MANUAL_MOVEMENT_TYPES, PAYMENT_METHODS } from "./constants";

export const uuidSchema = z.uuid("Identificador invalido");

export const moneySchema = z
  .number("Ingresa un numero")
  .min(0, "No puede ser negativo")
  .max(99_999_999, "Monto demasiado alto");

const optionalMoneySchema = z.number().min(0, "No puede ser negativo").max(99_999_999).nullish();
const optionalText = (max: number) => z.string().trim().max(max).nullish();

/* ---------------------------------- Auth ---------------------------------- */

export const loginSchema = z.object({
  email: z.email("Email invalido"),
  password: z.string().min(1, "Ingresa tu contrasena"),
});

/* -------------------------------- Categorias ------------------------------- */

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hex como #f59e0b")
    .nullish(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

/* -------------------------------- Productos -------------------------------- */

export const variantCreateSchema = z.object({
  size: z.string().trim().min(1, "Indica el talle").max(20),
  color: z.string().trim().min(1, "Indica el color").max(40),
  sku: z.string().trim().min(1, "El SKU es obligatorio").max(64),
  barcode: optionalText(64),
  price: optionalMoneySchema,
  cost: optionalMoneySchema,
  stock: z.number().int("Debe ser entero").min(0, "No puede ser negativo").default(0),
  minStock: z.number().int("Debe ser entero").min(0, "No puede ser negativo").default(0),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(120),
  description: optionalText(1000),
  brand: optionalText(80),
  categoryId: uuidSchema.nullish(),
  basePrice: moneySchema,
  baseCost: moneySchema.default(0),
  active: z.boolean().default(true),
  variants: z.array(variantCreateSchema).min(1, "Agrega al menos una variante"),
});

export const productUpdateSchema = productCreateSchema.omit({ variants: true }).partial();

export const variantUpdateSchema = z
  .object({
    size: z.string().trim().min(1, "Indica el talle").max(20),
    color: z.string().trim().min(1, "Indica el color").max(40),
    sku: z.string().trim().min(1, "El SKU es obligatorio").max(64),
    barcode: optionalText(64),
    price: optionalMoneySchema,
    cost: optionalMoneySchema,
    minStock: z.number().int().min(0),
    active: z.boolean(),
  })
  .partial();

/* ------------------------------- Movimientos ------------------------------- */

export const movementCreateSchema = z
  .object({
    variantId: uuidSchema,
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    quantity: z.number().int("Debe ser entero").min(0, "No puede ser negativo"),
    reason: optionalText(200),
    reference: optionalText(120),
  })
  .refine((data) => data.type === "ADJUSTMENT" || data.quantity > 0, {
    message: "La cantidad debe ser mayor a cero",
    path: ["quantity"],
  });

/* ---------------------------------- Ventas --------------------------------- */

export const saleItemInputSchema = z.object({
  variantId: uuidSchema,
  quantity: z.number().int("Debe ser entero").min(1, "Minimo 1"),
  unitPrice: optionalMoneySchema,
});

export const saleCreateSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, "Agrega al menos un producto"),
  paymentMethod: z.enum(PAYMENT_METHODS, "Metodo de pago invalido"),
  discount: z.number().min(0, "No puede ser negativo").max(99_999_999).default(0),
  note: optionalText(500),
});

/* ---------------------------------- Query ---------------------------------- */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const productListQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  categoryId: uuidSchema.optional(),
  lowStock: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const saleListQuerySchema = paginationSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const movementListQuerySchema = paginationSchema.extend({
  variantId: uuidSchema.optional(),
  type: z.string().optional(),
});
