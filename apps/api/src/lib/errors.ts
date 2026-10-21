export type Issue = { path: string; message: string };

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly issues?: Issue[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, issues?: Issue[]) => new AppError(400, message, issues);

export const notFound = (resource: string) => new AppError(404, `${resource} no encontrado`);

export const conflict = (message: string) => new AppError(409, message);

/** Codigos de error de PostgreSQL que conviene traducir a respuestas HTTP utiles. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_CHECK_VIOLATION = "23514";
