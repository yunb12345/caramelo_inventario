import type {
  CategoryDTO,
  LowStockItem,
  MovementDTO,
  ProductDTO,
  SaleDTO,
  SaleSummaryDTO,
  VariantDTO,
} from "@caramelo/shared";
import type { Category, Movement, Product, Sale, SaleItem, User, Variant } from "../db/schema";

export const toNumber = (value: string | number | null | undefined): number => {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
};

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const toMoney = (value: number): string => round2(value).toFixed(2);

export function toCategoryDTO(category: Category, productCount?: number): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    ...(productCount === undefined ? {} : { productCount }),
  };
}

export function toVariantDTO(variant: Variant): VariantDTO {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    barcode: variant.barcode,
    size: variant.size,
    color: variant.color,
    price: toNumber(variant.price),
    cost: toNumber(variant.cost),
    stock: variant.stock,
    minStock: variant.minStock,
    active: variant.active,
  };
}

type ProductWithRelations = Product & {
  category?: Category | null;
  variants: Variant[];
};

export function toProductDTO(product: ProductWithRelations): ProductDTO {
  const variants = product.variants.map(toVariantDTO);
  const totalStock = variants.reduce((acc, variant) => acc + variant.stock, 0);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand,
    categoryId: product.categoryId,
    category: product.category ? toCategoryDTO(product.category) : null,
    basePrice: toNumber(product.basePrice),
    baseCost: toNumber(product.baseCost),
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants,
    totalStock,
    lowStock: variants.some((variant) => variant.active && variant.stock <= variant.minStock),
  };
}

type SaleItemWithRelations = SaleItem & {
  variant: Variant & { product: Product };
};

type SaleWithRelations = Sale & {
  user?: User | null;
  items: SaleItemWithRelations[];
};

export function toSaleDTO(sale: SaleWithRelations): SaleDTO {
  return {
    id: sale.id,
    number: sale.number,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    paymentMethod: sale.paymentMethod,
    note: sale.note,
    createdAt: sale.createdAt.toISOString(),
    user: sale.user ? { id: sale.user.id, name: sale.user.name } : null,
    items: sale.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      subtotal: toNumber(item.subtotal),
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        size: item.variant.size,
        color: item.variant.color,
        product: { id: item.variant.product.id, name: item.variant.product.name },
      },
    })),
  };
}

export function toSaleSummaryDTO(
  sale: Sale & { user?: User | null; items: { id: string }[] },
): SaleSummaryDTO {
  return {
    id: sale.id,
    number: sale.number,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    paymentMethod: sale.paymentMethod,
    note: sale.note,
    createdAt: sale.createdAt.toISOString(),
    user: sale.user ? { id: sale.user.id, name: sale.user.name } : null,
    itemCount: sale.items.length,
  };
}

type MovementWithRelations = Movement & {
  variant: Variant & { product: Product };
  user?: User | null;
};

export function toMovementDTO(movement: MovementWithRelations): MovementDTO {
  return {
    id: movement.id,
    variantId: movement.variantId,
    type: movement.type,
    quantity: movement.quantity,
    resultingStock: movement.resultingStock,
    reason: movement.reason,
    reference: movement.reference,
    createdAt: movement.createdAt.toISOString(),
    variant: {
      id: movement.variant.id,
      sku: movement.variant.sku,
      size: movement.variant.size,
      color: movement.variant.color,
      product: { id: movement.variant.product.id, name: movement.variant.product.name },
    },
    user: movement.user ? { id: movement.user.id, name: movement.user.name } : null,
  };
}

export function toLowStockItem(
  variant: Variant & { product: Product },
): LowStockItem {
  return {
    variantId: variant.id,
    productId: variant.product.id,
    productName: variant.product.name,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
    minStock: variant.minStock,
  };
}
