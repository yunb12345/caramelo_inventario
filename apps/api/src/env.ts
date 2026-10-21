import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  PORT: z.coerce.number().int().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_NAME: z.string().default("Administrador"),
  ADMIN_EMAIL: z.email().default("admin@caramelo.local"),
  ADMIN_PASSWORD: z.string().min(6).default("caramelo123"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\nConfiguracion invalida en apps/api/.env:\n");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nCopia apps/api/.env.example a apps/api/.env y completa los valores.\n");
  process.exit(1);
}

export const env = parsed.data;
