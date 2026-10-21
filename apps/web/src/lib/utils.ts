import clsx, { type ClassValue } from "clsx";

export function cn(...values: ClassValue[]): string {
  return clsx(values);
}

/** Genera un SKU a partir de nombre de producto, talle y color. */
export function suggestSku(name: string, size: string, color: string): string {
  const clean = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const parts = [
    clean(name).slice(0, 12),
    clean(size).slice(0, 6),
    clean(color).slice(0, 6),
  ].filter(Boolean);

  return parts.join("-");
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado";
}
