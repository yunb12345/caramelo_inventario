#!/usr/bin/env node
/**
 * Chequeo de conexion a PostgreSQL, pensado para correr ANTES de migrar,
 * sembrar o hacer un backup.
 *
 * Existe porque `drizzle-kit migrate` no imprime el error real cuando corre
 * sin TTY (GitHub Actions): el spinner borra la linea y solo se ve
 * "Exit status 1". Este script imprime el codigo y el mensaje del error,
 * mas una pista de que revisar.
 *
 * Uso local:
 *   pnpm db:check                      (lee apps/api/.env)
 *   DATABASE_URL="postgresql://..." node scripts/check-db.mjs
 *
 * En CI lo llaman los workflows con DATABASE_URL en el entorno.
 */

import { createRequire } from "node:module";

// pg vive en apps/api/node_modules: resolvemos desde ahi para que el script
// funcione tanto en la raiz del repo como en CI.
const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { Client } = require("pg");

const CONNECT_TIMEOUT_MS = 15_000;

const CODE_HINTS = {
  ENOTFOUND:
    "el host no resuelve. Revisa el nombre del pooler (aws-0-<region>.pooler.supabase.com). Si estas usando la conexion directa db.<ref>.supabase.co, ten en cuenta que es IPv6-only.",
  ENETUNREACH:
    "sin ruta de red. Casi siempre es la conexion directa (IPv6-only) desde una red sin IPv6, como los runners de GitHub Actions o Render.",
  EAI_AGAIN: "fallo temporal de DNS, reintenta en unos segundos.",
  ECONNREFUSED: "el host rechazo la conexion: puerto incorrecto o restricciones de red.",
  ETIMEDOUT:
    "timeout. Suele ser Network Restrictions activadas en Supabase, o un host IPv6 inalcanzable.",
  ECONNRESET: "la conexion se corto. Suele ser un pooler en modo transaction o un firewall.",
  SELF_SIGNED_CERT_IN_CHAIN:
    "el certificado no valida. Con pg 8.x, sslmode=require equivale a verify-full y el pooler de Supabase no pasa esa validacion: usa sslmode=no-verify.",
  "28P01": "password incorrecto. Si tiene caracteres especiales (@ # % : / ?), hay que codificarlos en la URL.",
  "28000":
    "usuario o tenant invalido. Con el pooler el usuario tiene la forma postgres.<project-ref>.",
  "3D000": "la base indicada en la URL no existe.",
};

function fail(title, details = []) {
  console.error(`\nERROR: ${title}\n`);
  for (const line of details) console.error(`  · ${line}`);
  console.error("");
  process.exit(1);
}

const raw = process.env.DATABASE_URL;

if (!raw) {
  fail("DATABASE_URL no esta definida.", [
    "Local: definila en apps/api/.env (o pasala en el entorno).",
    "CI: cargala en Settings -> Secrets and variables -> Actions.",
  ]);
}

let url;

try {
  url = new URL(raw);
} catch {
  fail("DATABASE_URL no es una URL valida.", [
    "Formato esperado: postgresql://usuario:password@host:5432/base",
  ]);
}

const host = url.hostname;
const port = url.port || "5432";
const user = decodeURIComponent(url.username || "(sin usuario)");
const database = decodeURIComponent(url.pathname.replace(/^\//, "")) || "(sin nombre)";
const sslmode = url.searchParams.get("sslmode");
const target = `${user}@${host}:${port}/${database}`;

const warnings = [];

if (/^db\..+\.supabase\.co$/i.test(host)) {
  warnings.push(
    "estas usando la conexion directa de Supabase (IPv6-only). GitHub Actions y Render no tienen IPv6 saliente: usa la Session pooler (aws-0-<region>.pooler.supabase.com:5432).",
  );
}

if (/pooler\.supabase\.com$/i.test(host) && port === "6543") {
  warnings.push(
    "el puerto 6543 es el Transaction pooler y rompe las transacciones de venta. Usa 5432 (Session pooler).",
  );
}

if (!sslmode) {
  warnings.push(
    "sin sslmode, pg conecta en texto plano (el password viaja sin cifrar). Agrega ?sslmode=no-verify.",
  );
} else if (sslmode === "require" || sslmode === "prefer") {
  warnings.push(
    `sslmode=${sslmode} se comporta como verify-full en pg 8.x y el certificado del pooler de Supabase no valida. Usa sslmode=no-verify.`,
  );
}

console.log(`\nConectando a ${target} (sslmode=${sslmode ?? "sin definir"}) ...`);

for (const warning of warnings) console.warn(`  AVISO: ${warning}`);

const client = new Client({
  connectionString: raw,
  connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
});

try {
  await client.connect();

  const info = await client.query(
    "select current_user as usr, current_database() as db, version() as version",
  );
  const row = info.rows[0];

  const tables = await client.query(
    "select count(*)::int as total from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
  );
  const totalTables = tables.rows[0]?.total ?? 0;

  console.log(`  OK: ${row.usr} en ${row.db}`);
  console.log(`  Servidor: ${String(row.version).split(" on ")[0]}`);
  console.log(`  Tablas en public: ${totalTables}`);

  if (totalTables === 0) {
    console.warn("\n  AVISO: la base esta vacia. Corre `pnpm db:migrate` para crear el esquema.");
  } else if (totalTables < 7) {
    console.warn(
      `\n  AVISO: hay ${totalTables} tablas y la app espera 7. Puede faltar alguna migracion.`,
    );
  }

  if (warnings.length > 0) {
    console.log("\n  Conexion establecida, pero revisa los avisos de arriba.\n");
  } else {
    console.log("\n  Todo en orden.\n");
  }
} catch (error) {
  const code = error?.code ? String(error.code) : "sin codigo";
  const hint = CODE_HINTS[code];
  const details = [String(error?.message ?? error).trim()];

  if (hint) details.push(hint);
  details.push(`Destino: ${target}`);

  await client.end().catch(() => {});
  fail(`no se pudo conectar a la base (${code}).`, details);
}

await client.end().catch(() => {});
