#!/bin/bash
# Aplica el slice 11 (reglas v2.0, ADR 0009) contra el VPS desde la máquina LOCAL.
# La fuente de los Excel está aquí (porras-excel/), el importer es Python local,
# y el SQL viaja por SSH hasta el contenedor porra-db del VPS. El operador no
# tiene que copiar nada al VPS antes.
#
# Flujo:
#   1. Pre-flight: VPS_SSH definido, ssh accesible, contenedores corriendo,
#      mapping de emails presente, Excels resueltos, backup reciente en el VPS.
#   2. Confirmación interactiva con el resumen de qué porras se re-importarán.
#   3. TRUNCATE remoto de predictions_* + scores + score_recalculations.
#   4. Migración 0002 (idempotente) ejecutada en el contenedor de la app.
#   5. Re-importa cada porra: importer local → pipe SSH → psql remoto.
#   6. Recálculo total con npm run scores:recalc-all en el contenedor de la app.
#   7. Verificación con un SELECT que cuenta filas.
#
# Uso:
#   VPS_SSH=root@82.223.121.149 ./infra/scripts/v2-apply.sh
#
# Variables del entorno:
#   VPS_SSH              (obligatoria) destino SSH del VPS.
#   PORRA_DB_CONTAINER   nombre del contenedor de la BD en el VPS (default: porra-db)
#   PORRA_APP_CONTAINER  nombre del contenedor de la app  en el VPS (default: porra-app)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EMAIL_FILE="${SCRIPT_DIR}/porra-emails.local"
EXCEL_DIR="${REPO_DIR}/porras-excel"

VPS_SSH="${VPS_SSH:-}"
CONTAINER_DB="${PORRA_DB_CONTAINER:-porra-db}"
CONTAINER_APP="${PORRA_APP_CONTAINER:-porra-app}"

# --- Pre-flight ----------------------------------------------------------------

if [ -z "$VPS_SSH" ]; then
  echo "Define VPS_SSH antes de ejecutar, p.ej.:" >&2
  echo "  VPS_SSH=root@82.223.121.149 ./infra/scripts/v2-apply.sh" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "Falta ssh en PATH." >&2
  exit 1
fi

if ! command -v /usr/bin/python3 >/dev/null 2>&1; then
  echo "Falta /usr/bin/python3 (lo usa el importer)." >&2
  exit 1
fi

echo "==> Probando SSH a ${VPS_SSH}"
if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "$VPS_SSH" true 2>/dev/null; then
  echo "No puedo conectar por SSH a ${VPS_SSH} (¿clave en ssh-agent? ¿host alcanzable?)." >&2
  exit 1
fi

echo "==> Verificando contenedores en el VPS"
RUNNING="$(ssh "$VPS_SSH" "podman ps --format '{{.Names}}'")"
for c in "$CONTAINER_DB" "$CONTAINER_APP"; do
  if ! echo "$RUNNING" | grep -qx "$c"; then
    echo "El contenedor '$c' no está corriendo en ${VPS_SSH}." >&2
    echo "Contenedores arriba: $(echo "$RUNNING" | tr '\n' ' ')" >&2
    exit 1
  fi
done

echo "==> Buscando backup reciente en el VPS"
LATEST_BACKUP="$(ssh "$VPS_SSH" \
  "ls -1t /opt/porra/infra/scripts/backups/*.dump 2>/dev/null | head -n1" \
  || true)"
if [ -z "$LATEST_BACKUP" ]; then
  echo "Sin backups en /opt/porra/infra/scripts/backups del VPS." >&2
  echo "Ejecuta primero: ssh ${VPS_SSH} 'cd /opt/porra && ./infra/scripts/backup-manual.sh'" >&2
  exit 1
fi
echo "    Último backup: $(basename "$LATEST_BACKUP")"

if [ ! -f "$EMAIL_FILE" ]; then
  echo "Falta ${EMAIL_FILE}." >&2
  echo "Copia porra-emails.local.example a porra-emails.local y rellena los emails." >&2
  exit 1
fi

if [ ! -d "$EXCEL_DIR" ]; then
  echo "Sin directorio porras-excel/ en ${REPO_DIR}." >&2
  exit 1
fi

# Valida que cada Excel del mapping existe localmente y resuelve el email.
declare -a IMPORTS=()
while IFS='=' read -r file email; do
  [[ -z "$file" || "$file" =~ ^# ]] && continue
  excel_path="${EXCEL_DIR}/${file}"
  if [ ! -f "$excel_path" ]; then
    echo "El mapping apunta a ${excel_path} pero el archivo no existe." >&2
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
echo "Destino:           ${VPS_SSH}"
echo "Contenedor BD:     ${CONTAINER_DB}"
echo "Contenedor app:    ${CONTAINER_APP}"
echo "Backup respaldo:   $(basename "$LATEST_BACKUP")"
echo ""
echo "Se van a re-importar ${#IMPORTS[@]} porras:"
for item in "${IMPORTS[@]}"; do
  echo "  - $(basename "${item%%=*}") → ${item##*=}"
done

echo ""
read -r -p "¿Continuar? Esto vacía predicciones+scores en el VPS y re-aplica. [y/N] " ans
case "${ans:-N}" in
  y|Y|yes|YES|s|S|si|SI|sí|SÍ) ;;
  *) echo "Cancelado."; exit 1 ;;
esac

# --- TRUNCATE remoto -----------------------------------------------------------

echo "==> TRUNCATE remoto"
ssh "$VPS_SSH" "podman exec -i $CONTAINER_DB psql -U porra -d porra" <<'SQL'
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

# --- Migración 0002 ------------------------------------------------------------

echo "==> Aplicando migración 0002"
ssh "$VPS_SSH" "podman exec $CONTAINER_APP npm run db:migrate"

# --- Re-importación: importer local → SSH → psql remoto ------------------------

echo "==> Re-importando porras"
for item in "${IMPORTS[@]}"; do
  excel_path="${item%%=*}"
  email="${item##*=}"
  echo "  → $(basename "$excel_path") → ${email}"
  /usr/bin/python3 "${REPO_DIR}/lib/db/seed/import-porra-from-excel.py" \
    "$excel_path" --email "$email" |
    ssh "$VPS_SSH" "podman exec -i $CONTAINER_DB psql -U porra -d porra" >/dev/null
done

# --- Recálculo -----------------------------------------------------------------

echo "==> Recálculo total"
ssh "$VPS_SSH" "podman exec $CONTAINER_APP npm run scores:recalc-all"

# --- Verificación --------------------------------------------------------------

echo "==> Verificación"
ssh "$VPS_SSH" "podman exec $CONTAINER_DB psql -U porra -d porra -c \"
SELECT
  (SELECT COUNT(*) FROM predictions_group_matches)    AS gm,
  (SELECT COUNT(*) FROM predictions_group_standings)  AS gs,
  (SELECT COUNT(*) FROM predictions_best_thirds)      AS bt,
  (SELECT COUNT(*) FROM predictions_knockout)         AS ko,
  (SELECT COUNT(*) FROM predictions_knockout WHERE goles_local IS NOT NULL) AS ko_con_goles,
  (SELECT COUNT(*) FROM predictions_awards)           AS aw,
  (SELECT COUNT(*) FROM scores)                       AS scores,
  (SELECT COUNT(*) FROM score_recalculations)         AS recalcs;
\""

echo ""
echo "✔ Listo. Si algo huele raro, restaura desde el dump del VPS:"
echo "  ssh ${VPS_SSH} 'podman exec porra-db psql -U porra -d postgres -c \"DROP DATABASE porra;\"'"
echo "  ssh ${VPS_SSH} 'podman exec porra-db psql -U porra -d postgres -c \"CREATE DATABASE porra OWNER porra;\"'"
echo "  ssh ${VPS_SSH} 'podman exec -i porra-db pg_restore -U porra -d porra < ${LATEST_BACKUP}'"
