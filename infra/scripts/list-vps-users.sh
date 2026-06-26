#!/bin/bash
# Lista los usuarios no-admin del VPS para rellenar porra-emails.local. Solo
# lectura; útil antes de v2-apply.sh para confirmar id/email/nickname.
#
# Uso:
#   VPS_SSH=root@TU_VPS ./infra/scripts/list-vps-users.sh
set -euo pipefail

VPS_SSH="${VPS_SSH:-}"
CONTAINER_DB="${PORRA_DB_CONTAINER:-porra-db}"

if [ -z "$VPS_SSH" ]; then
  echo "Define VPS_SSH (p.ej. root@TU_VPS)" >&2
  exit 1
fi

ssh "$VPS_SSH" \
  "podman exec $CONTAINER_DB psql -U porra -d porra -c \
    \"SELECT id, email, nickname FROM users WHERE is_admin = false ORDER BY id;\""
