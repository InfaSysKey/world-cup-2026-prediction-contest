#!/bin/bash
# Wrapper del cron diario que importa resultados oficiales desde openfootball.
# Pensado para invocarse desde un cron del host del VPS (o de root); ejecuta
# el importer dentro del contenedor `porra-app`, redirige logs a fichero con
# rotación por fecha y deja exit code útil.
#
# Programación recomendada (crontab -e): 03:30 UTC.
#   30 3 * * * /opt/porra/world-cup-2026-prediction-contest/infra/scripts/cron-import-results.sh

set -euo pipefail

LOG_DIR="${IMPORTER_LOG_DIR:-/opt/porra/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/importer-$(date -u +%Y-%m-%d).log"

{
  echo "==========================================="
  echo "Cron importer @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==========================================="
  podman exec porra-app npm run results:import -- \
    --apply \
    --reason "Cron diario openfootball $(date -u +%Y-%m-%d)"
} >> "$LOG_FILE" 2>&1

# Si el comando anterior falló, exit code != 0 y el cron lo recoge.
