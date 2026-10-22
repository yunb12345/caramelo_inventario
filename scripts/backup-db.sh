#!/usr/bin/env bash
#
# Backup de PostgreSQL en formato custom (comprimido, restaurable con pg_restore).
#
# Uso:
#   DATABASE_URL="postgresql://..." ./scripts/backup-db.sh [directorio] [dias-de-retencion]
#
# Requiere pg_dump 17 o superior en el PATH. Si no lo tenes instalado, se puede
# correr con Docker:
#   docker run --rm -e DATABASE_URL -v "$PWD/backups:/backups" postgres:17-alpine \
#     sh -c 'pg_dump --format=custom --no-owner --no-privileges --file /backups/manual.dump "$DATABASE_URL"'
#
# Nota: los proyectos gratuitos de Supabase no tienen backups automaticos.

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${2:-14}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: falta DATABASE_URL." >&2
  echo "Ejemplo: DATABASE_URL=\"postgresql://user:pass@host:5432/db?sslmode=require\" $0" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump no esta en el PATH (instala postgresql-client-17)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/caramelo-$TIMESTAMP.dump"

echo "Generando backup en $FILE ..."
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$FILE" \
  "$DATABASE_URL"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "OK: $FILE ($SIZE)"

if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "Borrando backups de mas de $RETENTION_DAYS dias en $BACKUP_DIR ..."
  find "$BACKUP_DIR" -maxdepth 1 -name 'caramelo-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete
fi
