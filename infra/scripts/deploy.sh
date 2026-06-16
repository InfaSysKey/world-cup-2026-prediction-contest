#!/bin/bash
# Deploy de la porra en el VPS. Se invoca con el SHA de la imagen ya publicada
# en GHCR. Estrategia: pull → migrar (backward-compatible) → up → health check
# con reintentos → rollback automático a la imagen anterior si el health check
# no pasa en 60s.
#
# TLS y dominio los maneja Plesk en el host (fuera de este script y del compose).
# Este script solo se ocupa del contenedor `app` escuchando en 127.0.0.1:3000;
# Plesk hace reverse-proxy desde porra.carlosdelcura.es hacia ahí.
#
#   ./infra/scripts/deploy.sh <sha>
set -euo pipefail

SHA="${1:?Falta el SHA de la imagen}"
IMAGE_REPO="ghcr.io/infasyskey/porra-app"
COMPOSE="podman-compose -f infra/compose.yaml"
HEALTH_URL="http://localhost:3000/api/health"

cd "${VPS_REPO_DIR:-/opt/porra/world-cup-2026-prediction-contest}"

# Tag de la imagen actualmente desplegada, para poder revertir. Formato del
# ImageName: ghcr.io/infasyskey/porra-app:<tag>; nos quedamos con el <tag>.
PREV_IMAGE=$(podman inspect porra-app --format '{{.ImageName}}' 2>/dev/null || echo "")
PREV_TAG="${PREV_IMAGE##*:}"

echo "==> Pull de ${IMAGE_REPO}:${SHA}"
podman pull "${IMAGE_REPO}:${SHA}"

# Migraciones ANTES de cambiar la app. Deben ser backward-compatible: la versión
# anterior tiene que seguir funcionando con el esquema nuevo por si hay rollback.
echo "==> Aplicando migraciones"
IMAGE_TAG="${SHA}" $COMPOSE run --rm app npm run db:migrate

echo "==> Levantando app en ${SHA}"
IMAGE_TAG="${SHA}" $COMPOSE up -d app

# Health check: 30 intentos x 2s = 60s. El éxito es la BD respondiendo, no que
# el contenedor haya arrancado.
echo "==> Health check"
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"db":"ok"'; then
    echo "==> Deploy OK (sha ${SHA})"
    exit 0
  fi
  sleep 2
done

echo "==> Health check FALLÓ tras 60s."
if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$SHA" ]; then
  echo "==> Rollback a ${PREV_TAG}"
  IMAGE_TAG="${PREV_TAG}" $COMPOSE up -d app
else
  echo "==> Sin imagen previa conocida; no se puede hacer rollback automático."
fi
exit 1
