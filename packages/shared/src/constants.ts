export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

/** Tipos de movimiento que puede registrar un usuario manualmente. */
export const MANUAL_MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;

/** Todos los tipos que puede tener un movimiento en la base. */
export const MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT", "SALE", "RETURN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: "Ingreso",
  OUT: "Egreso",
  ADJUSTMENT: "Ajuste",
  SALE: "Venta",
  RETURN: "Devolucion",
};

export const MOVEMENT_TYPE_STYLES: Record<MovementType, string> = {
  IN: "bg-emerald-100 text-emerald-700",
  OUT: "bg-rose-100 text-rose-700",
  ADJUSTMENT: "bg-amber-100 text-amber-700",
  SALE: "bg-sky-100 text-sky-700",
  RETURN: "bg-violet-100 text-violet-700",
};

/** Tallas sugeridas en el formulario (el campo acepta cualquier texto). */
export const SIZE_SUGGESTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "UNICO",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
];

export const CURRENCY = "ARS";

export const APP_NAME = "Caramelo";
