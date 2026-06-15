#!/bin/bash
# Aplica el slice 11 (reglas v2.0, ADR 0009) sobre la BD del VPS:
#
#   1. Verifica que hay un backup reciente en infra/scripts/backups/.
#   2. Verifica que existe el mapping de emails (porra-emails.local).
#   3. TRUNCATE de predicciones + scores + score_recalculations (preserva
#      users, sessions, invitations, teams, matches y actual_* / matches.real_*).
#   4. Aplica la migración 0002 (añade goles_local/visitante a predictions_knockout).
#   5. Re-importa cada porra del directorio porras-excel/.
#   6. Lanza scores:recalc-all y muestra un check final.
#
# Es interactivo: pide confirmación antes de tocar nada. Idempotente en cuanto a
# las predicciones (re-ejecutar deja el mismo estado).
#
# Uso desde el repo en el VPS:
#   ./infra/scripts/v2-apply.sh
#
# Variables opcionales del entorno:
#   PORRA_DB_CONTAINER   nombre del contenedor de la BD (default: porra-db)
#   PORRA_APP_CONTAINER  nombre del contenedor de la app (default: porra-app)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
EMAIL_FILE="${SCRIPT_DIR}/porra-emails.local"
EXCEL_DIR="${REPO_DIR}/porras-excel"

CONTAINER_DB="${PORRA_DB_CONTAINER:-porra-db}"
CONTAINER_APP="${PORRA_APP_CONTAINER:-porra-app}"

# --- Pre-flight ----------------------------------------------------------------

if ! command -v podman >/dev/null 2>&1; then
  echo "Falta podman en PATH." >&2
  exit 1
fi

for c in "$CONTAINER_DB" "$CONTAINER_APP"; do
  if ! podman ps --format '{{.Names}}' | grep -qx "$c"; then
    echo "El contenedor '$c' no está corriendo." >&2
    echo "Ajusta PORRA_DB_CONTAINER/PORRA_APP_CONTAINER o levanta el stack." >&2
    exit 1
  fi
done

LATEST_BACKUP="$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n1 || true)"
if [ -z "$LATEST_BACKUP" ]; then
  echo "Sin backups en ${BACKUP_DIR}. Ejecuta ./infra/scripts/backup-manual.sh primero." >&2
  exit 1
fi
BACKUP_AGE_MIN=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP")) / 60 ))
echo "Backup más reciente: $(basename "$LATEST_BACKUP") (hace ${BACKUP_AGE_MIN} min)"

if [ ! -f "$EMAIL_FILE" ]; then
  echo "Falta ${EMAIL_FILE}." >&2
  echo "Copia porra-emails.local.example a porra-emails.local y rellena los emails." >&2
  exit 1
fi

if [ ! -d "$EXCEL_DIR" ]; then
  echo "Sin directorio porras-excel/ en ${REPO_DIR}." >&2
  exit 1
fi

# Valida que cada Excel del mapping existe y resuelve el email (sin tocar BD aún).
declare -a IMPORTS=()
while IFS='=' read -r file email; do
  file="${file%% *}"  # tolera espacios al final (no permite ' ' en filename)
  [[ -z "$file" || "$file" =~ ^# ]] && continue
  excel_path="${EXCEL_DIR}/${file}"
  if [ ! -f "$excel_path" ]; then
    echo "Mapping apunta a ${excel_path} pero el archivo no existe." >&2
    exit 1
  fi
  if [ -z "$email" ]; then
    echo "Mapping sin email para ${file}." >&2
    exit 1
  fi
  IMPORTS+=("${excel_path}=${email}")
done < "$EMAIL_FILE"

if [ "${#IMPORTS[@]}" -eq 0 ]; then
  echo "El mapping ${EMAIL_FILE} no resolvió ningún import." >&2
  exit 1
fi

echo ""
echo "Se van a re-importar ${#IMPORTS[@]} porras:"
for item in "${IMPORTS[@]}"; do
  echo "  - $(basename "${item%%=*}") → ${item##*=}"
done

echo ""
read -r -p "¿Continuar? Esto vacía predicciones+scores y re-aplica. [y/N] " ans
case "${ans:-N}" in
  y|Y|yes|YES|s|S|si|SI|sí|SÍ) ;;
  *) echo "Cancelado."; exit 1 ;;
esac

# --- TRUNCATE ------------------------------------------------------------------

echo "==> TRUNCATE predicciones + scores + auditoría"
podman exec -i "$CONTAINER_DB" psql -U porra -d porra <<'SQL'
BEGIN;
TRUNCATE TABLE
  predictions_group_matches,
  predictions_group_standings,
  predictions_best_thirds,
  predictions_knockout,
  predictions_awards,
  scores,
  score_recalculations
RESTART IDENTITY CASCADE;
COMMIT;
SQL

# --- Migración -----------------------------------------------------------------

echo "==> Aplicando migración 0002 (idempotente)"
podman exec "$CONTAINER_APP" npm run db:migrate

# --- Re-importación ------------------------------------------------------------

echo "==> Re-importando porras"
for item in "${IMPORTS[@]}"; do
  excel_path="${item%%=*}"
  email="${item##*=}"
  echo "  → $(basename "$excel_path") → ${email}"
  /usr/bin/python3 "${REPO_DIR}/lib/db/seed/import-porra-from-excel.py" \
    "$excel_path" --email "$email" |
    podman exec -i "$CONTAINER_DB" psql -U porra -d porra >/dev/null
done

# --- Recálculo -----------------------------------------------------------------

echo "==> Recálculo total de scores"
podman exec "$CONTAINER_APP" npm run scores:recalc-all

# --- Verificación final --------------------------------------------------------

echo "==> Verificación"
podman exec "$CONTAINER_DB" psql -U porra -d porra -c "
SELECT
  (SELECT COUNT(*) FROM predictions_group_matches)    AS gm,
  (SELECT COUNT(*) FROM predictions_group_standings)  AS gs,
  (SELECT COUNT(*) FROM predictions_best_thirds)      AS bt,
  (SELECT COUNT(*) FROM predictions_knockout)         AS ko,
  (SELECT COUNT(*) FROM predictions_knockout WHERE goles_local IS NOT NULL) AS ko_con_goles,
  (SELECT COUNT(*) FROM predictions_awards)           AS aw,
  (SELECT COUNT(*) FROM scores)                       AS scores,
  (SELECT COUNT(*) FROM score_recalculations)         AS recalcs;
"

echo ""
echo "✔ Listo. Si algo huele raro, restaura el dump:"
echo "  podman exec porra-db psql -U porra -d postgres -c 'DROP DATABASE porra;'"
echo "  podman exec porra-db psql -U porra -d postgres -c 'CREATE DATABASE porra OWNER porra;'"
echo "  podman exec -i porra-db pg_restore -U porra -d porra < ${LATEST_BACKUP}"
