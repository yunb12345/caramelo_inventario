#!/usr/bin/env bash
#
# Restaura un backup generado por scripts/backup-db.sh.
#
# ATENCION: borra y recrea los objetos de la base destino (--clean --if-exists).
#
# Uso:
#   DATABASE_URL="postgresql://..." ./scripts/restore-db.sh backups/caramelo-XXXX.dump
#
# Requiere pg_restore 17 o superior.

set -euo pipefail

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Uso: DATABASE_URL=... $0 <archivo.dump>" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: no existe el archivo $FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: falta DATABASE_URL." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore no esta en el PATH (instala postgresql-client-17)." >&2
  exit 1
fi

read -r -p "Esto sobrescribe la base destino. Escribi 'confirmar' para continuar: " ANSWER
if [[ "$ANSWER" != "confirmar" ]]; then
  echo "Cancelado."
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$DATABASE_URL" \
  --verbose \
  "$FILE"

echo "Restore completado desde $FILE"
