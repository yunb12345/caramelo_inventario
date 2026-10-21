export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(): Date {
  const date = startOfToday();
  date.setDate(1);
  return date;
}

/** Devuelve el inicio del dia `days` dias atras (incluyendo hoy). */
export function daysAgo(days: number): Date {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateRange(from?: string, to?: string): { from?: Date; to?: Date } {
  const result: { from?: Date; to?: Date } = {};

  if (from) {
    const parsed = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) result.from = parsed;
  }

  if (to) {
    const parsed = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(parsed.getTime())) result.to = parsed;
  }

  return result;
}
