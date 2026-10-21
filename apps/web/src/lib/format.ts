import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CURRENCY } from "@caramelo/shared";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-AR");

export const formatMoney = (value: number): string => moneyFormatter.format(value);

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const formatDate = (iso: string): string =>
  format(new Date(iso), "dd/MM/yyyy", { locale: es });

export const formatDateTime = (iso: string): string =>
  format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: es });

export const formatDayShort = (isoDate: string): string =>
  format(new Date(`${isoDate}T12:00:00`), "EEE d", { locale: es });
