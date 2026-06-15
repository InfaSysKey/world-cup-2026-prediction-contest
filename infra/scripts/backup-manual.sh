#!/bin/bash
# Backup manual ad-hoc de la BD `porra` en el VPS. Útil antes de aplicar una
# migración o un cambio destructivo (re-importación de porras, recálculo masivo,
# etc.). Pensado para ejecutarse a mano cuando el cron nocturno no está
# disponible o no se confía en su última corrida.
#
# Uso:
#   ./infra/scripts/backup-manual.sh              # dump a infra/scripts/backups/
#   ./infra/scripts/backup-manual.sh --upload     # dump y, si OK, sube a B2
#
# Salida: un fichero porra-YYYYMMDD-HHMM.dump en formato custom (-Fc), que se
# restaura con `pg_restore --clean --if-exists`. Más rápido y compacto que
# .sql.gz; el directorio coincide con el que ya usa backup-b2.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="${SCRIPT_DIR}/backups"
TS="$(date -u +%Y%m%d-%H%M)"
DUMP="${DEST_DIR}/porra-${TS}.dump"
CONTAINER="${PORRA_DB_CONTAINER:-porra-db}"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman no está disponible en PATH." >&2
  exit 1
fi

if ! podman ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "El contenedor '$CONTAINER' no está corriendo." >&2
  echo "Ajusta PORRA_DB_CONTAINER o levanta el stack antes de hacer backup." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "==> Volcando porra → ${DUMP}"
podman exec "$CONTAINER" pg_dump -U porra -Fc -d porra > "$DUMP"

if [ ! -s "$DUMP" ]; then
  echo "El dump quedó vacío (0 bytes). No subo nada; revisa el contenedor." >&2
  rm -f "$DUMP"
  exit 1
fi

SIZE="$(du -h "$DUMP" | cut -f1)"
echo "==> OK: ${DUMP} (${SIZE})"
echo ""
echo "Para restaurar (cuidado, destruye y recrea la BD):"
echo "  podman exec porra-db psql -U porra -d postgres -c \"DROP DATABASE porra;\""
echo "  podman exec porra-db psql -U porra -d postgres -c \"CREATE DATABASE porra OWNER porra;\""
echo "  podman exec -i porra-db pg_restore -U porra -d porra < \"${DUMP}\""

if [ "${1:-}" = "--upload" ]; then
  echo ""
  echo "==> Delegando subida a B2 en backup-b2.sh"
  "${SCRIPT_DIR}/backup-b2.sh"
fi
