#!/bin/bash
# Sube el dump local más reciente a Backblaze B2 (retención remota 90 días).
# Se apoya en el backup local nocturno (backup.sh) y corre semanalmente por cron.
#
# Credenciales y destino vienen del ENTORNO DEL HOST, nunca del repo:
#   B2_BUCKET          bucket de B2, p.ej. porra-backups (obligatorio)
#   RCLONE_B2_REMOTE   nombre del remote rclone tipo b2 (default: b2)
#
# Requisito: rclone instalado y configurado en el host con un remote B2
#   (rclone config → type=b2, account=<keyId>, key=<applicationKey>).
set -euo pipefail

SRC_DIR="${VPS_BACKUPS_DIR:-/opt/porra/world-cup-2026-prediction-contest/infra/scripts/backups}"
BUCKET="${B2_BUCKET:?Falta B2_BUCKET en el entorno del host}"
REMOTE="${RCLONE_B2_REMOTE:-b2}"

LATEST=$(ls -1t "$SRC_DIR"/porra-*.sql.gz 2>/dev/null | head -n1)
if [ -z "$LATEST" ]; then
  echo "No hay dumps en $SRC_DIR; ¿corrió backup.sh primero?" >&2
  exit 1
fi

echo "==> Subiendo $(basename "$LATEST") a ${REMOTE}:${BUCKET}/weekly/"
rclone copy "$LATEST" "${REMOTE}:${BUCKET}/weekly/"

# Retención remota: borra dumps de más de 90 días.
echo "==> Limpiando backups remotos > 90 días"
rclone delete "${REMOTE}:${BUCKET}/weekly/" --min-age 90d

echo "==> Backup remoto OK."
