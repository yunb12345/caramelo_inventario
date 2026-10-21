import type { MovementType, PaymentMethod } from "./constants";

export type UserDTO = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: UserDTO;
};

export type CategoryDTO = {
  id: string;
  name: string;
  color: string | null;
  productCount?: number;
};

export type VariantDTO = {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  size: string;
  color: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
};

export type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  category: CategoryDTO | null;
  basePrice: number;
  baseCost: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  variants: VariantDTO[];
  totalStock: number;
  lowStock: boolean;
};

export type MovementVariantInfo = {
  id: string;
  sku: string;
  size: string;
  color: string;
  product: { id: string; name: string };
};

export type MovementDTO = {
  id: string;
  variantId: string;
  type: MovementType;
  quantity: number;
  resultingStock: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  variant: MovementVariantInfo;
  user: { id: string; name: string } | null;
};

export type SaleItemDTO = {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  variant: MovementVariantInfo;
};

export type SaleDTO = {
  id: string;
  number: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  items: SaleItemDTO[];
};

export type SaleSummaryDTO = Omit<SaleDTO, "items"> & {
  itemCount: number;
};

export type LowStockItem = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  minStock: number;
};

export type DashboardDTO = {
  today: { sales: number; revenue: number; units: number };
  month: { sales: number; revenue: number };
  products: number;
  variants: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
  last7Days: { date: string; revenue: number; sales: number }[];
  lowStockVariants: LowStockItem[];
  recentSales: SaleSummaryDTO[];
};

export type SaleSearchResult = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  size: string;
  color: string;
  price: number;
  stock: number;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ApiErrorBody = {
  error: string;
  issues?: { path: string; message: string }[];
};
