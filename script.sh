  ssh root@82.223.121.149 'bash -s' <<'REMOTE'
  set -euo pipefail
  cd /opt/porra

  # 1. Confirma que el git pull trajo el fix:
  echo "==> Última línea del Containerfile (debe mencionar tsconfig.json):"
  tail -1 infra/Containerfile

  # 2. Confirma qué image-id usa el contenedor ahora y cuándo se creó:
  echo ""
  echo "==> Contenedor porra-app:"
  podman inspect porra-app --format \
    'Image: {{.ImageName}}{{"\n"}}Started: {{.State.StartedAt}}{{"\n"}}ImageID: {{.Image}}'

  # 3. Build forzado (sin caché) + recreate del contenedor:
  echo ""
  echo "==> Build sin caché..."
  podman-compose -f infra/compose.yaml build --no-cache app

  echo ""
  echo "==> Recreando contenedor..."
  IMAGE_TAG=latest podman-compose -f infra/compose.yaml up -d --force-recreate app

  # 4. Verifica el nuevo image-id y que ya trae el archivo:
  echo ""
  echo "==> Después del recreate:"
  podman inspect porra-app --format \
    'Image: {{.ImageName}}{{"\n"}}Started: {{.State.StartedAt}}{{"\n"}}ImageID: {{.Image}}'

  echo ""
  echo "==> ¿recalc-all.ts está en la imagen nueva?"
  podman exec porra-app ls lib/db/seed/recalc-all.ts
  REMOTE