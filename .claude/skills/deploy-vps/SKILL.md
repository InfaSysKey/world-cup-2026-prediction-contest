---
name: deploy-vps
description: Use this skill for anything touching deployment or production infrastructure — changes to infra/Containerfile, infra/compose.yml, infra/Caddyfile, GitHub Actions workflows, the deploy script, health checks, backups, or the VPS setup. Triggers on mentions of deploy, CI/CD, production, podman in prod, registry, or going live.
---

# deploy-vps

Rutina y reglas para desplegar la porra en el VPS de producción de forma segura y reproducible. El objetivo: que un deploy nunca tumbe la app durante el Mundial, y que un deploy roto se revierta en segundos.

## Cuándo usar

- Cambios en `infra/Containerfile`, `infra/compose.yml`, `infra/Caddyfile`.
- Crear o modificar el workflow de GitHub Actions.
- El script `infra/scripts/deploy.sh`.
- Health checks, backups, headers de seguridad.
- Cualquier mención a deploy, CI/CD, producción, registry, "subir a producción".

## Arquitectura de producción (recordatorio)

3 contenedores en el VPS via podman-compose: `db` (postgres:16), `app` (Next.js), `proxy` (Caddy con TLS automático). Postgres NO expuesto fuera de localhost. Caddy es el único con puertos 80/443 al exterior.

## Pipeline de deploy (CI/CD)

El flujo objetivo, automatizado:

1. Push/merge a `main` → GitHub Actions arranca.
2. CI: `lint` + `tsc --noEmit` + `vitest run` + `playwright test`. Si algo falla, NO se construye imagen.
3. Si CI verde: build de la imagen `app` y push a `ghcr.io/<owner>/porra-app:<sha>` y `:latest`.
4. Deploy: GitHub Actions hace SSH al VPS y ejecuta `infra/scripts/deploy.sh <sha>`.
5. `deploy.sh` hace pull de la imagen, `podman-compose up -d`, espera health check, y si falla hace rollback a la imagen anterior.

### Reglas del workflow de GitHub Actions

- Secrets en GitHub Secrets, NUNCA en el YAML: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_TOKEN`.
- El job de deploy solo corre si el de tests pasó (`needs: test`).
- Nunca deployar desde una rama que no sea `main`.
- Concurrency: cancela deploys en cola si llega uno nuevo (`concurrency: group: deploy, cancel-in-progress: false` — NO cancelar deploys en curso, sí encolar).

## El script `infra/scripts/deploy.sh`

Estructura obligatoria:

```bash
#!/bin/bash
set -euo pipefail

SHA="${1:?Falta el SHA de la imagen}"
cd /opt/porra

# Guardar la imagen actual para rollback
PREV=$(podman inspect porra-app --format '{{.ImageName}}' 2>/dev/null || echo "none")

# Pull de la nueva
podman pull "ghcr.io/<owner>/porra-app:${SHA}"

# Aplicar migraciones ANTES de cambiar la app (las migraciones deben ser
# backward-compatible con la versión anterior por si hay rollback)
podman-compose run --rm app npm run db:migrate

# Levantar la nueva versión
IMAGE_TAG="${SHA}" podman-compose up -d app

# Health check con reintentos
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health | grep -q '"db":"ok"'; then
    echo "Deploy OK (sha ${SHA})"
    exit 0
  fi
  sleep 2
done

# Falló el health check → rollback
echo "Health check falló. Rollback a ${PREV}"
if [ "$PREV" != "none" ]; then
  IMAGE_TAG_PREV="$PREV" podman-compose up -d app
fi
exit 1
```

Reglas:
- **Migraciones backward-compatible**: una migración nueva no debe romper la versión anterior de la app (por si hay rollback). Nada de DROP COLUMN en la misma release que deja de usarla; se hace en dos releases (deja de usar → release → drop → release).
- El health check es la condición de éxito, no "el contenedor arrancó".
- Rollback automático si el health check falla en 60s.

## Health endpoint

`app/api/health/route.ts`:

```typescript
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: 'ok', db: 'ok', ts: new Date().toISOString() });
  } catch {
    return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
  }
}
```

- Está en la lista blanca de rutas públicas (no requiere auth).
- Verifica la BD, no solo que el proceso vive.

## Headers de seguridad

En `next.config.js` o en el Caddyfile. Mínimo:

- `Content-Security-Policy` (restrictiva; ajusta según lo que cargue la app)
- `X-Frame-Options: DENY` (la porra no se embebe en iframes)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (lo añade Caddy con TLS, confirmar)

## robots.txt

La porra es privada. NO debe indexarse:

```
# app/robots.txt o public/robots.txt
User-agent: *
Disallow: /
```

## Backups

- **Local nocturno**: ya configurado en getting-started.md Fase 5 (`pg_dump` por cron, retención 30 días).
- **Remoto semanal**: añadir subida a Backblaze B2 (10GB gratis). Cron semanal que sube el último `.sql.gz` con `rclone` o el CLI de B2. Credenciales en variables de entorno del host, no en el repo.
- **Verificar restore**: un backup que no se ha probado restaurar no es un backup. Al menos una vez, restaura un dump en una BD limpia local y comprueba que la app arranca contra ella.

## Rutina de deploy manual (si CI/CD falla y hay que deployar a mano)

```bash
ssh porra@<VPS>
cd /opt/porra
git pull origin main
./infra/scripts/deploy.sh $(git rev-parse HEAD)
```

## Smoke test post-deploy

Tras cada deploy, manual o automático, verificar:
1. `curl https://porra.tudominio.com/api/health` → 200, `db: ok`.
2. Login con una cuenta de prueba funciona.
3. La página /porra carga.

## Anti-patterns (rechazar)

- ❌ Secrets en el YAML de Actions, en el Containerfile, o commiteados.
- ❌ Deploy sin health check (asumir que "el contenedor arrancó" = "funciona").
- ❌ Deploy sin estrategia de rollback.
- ❌ Migración destructiva (DROP) en la misma release que deja de usar la columna.
- ❌ Postgres expuesto a internet (puerto 5432 fuera de localhost).
- ❌ Deployar desde una rama distinta de main.
- ❌ Backup que nunca se ha probado restaurar.
- ❌ Editar el Caddyfile sin verificar que el cert sigue emitiéndose tras el reload.
- ❌ `latest` como única etiqueta de imagen (siempre etiquetar también con el SHA para poder hacer rollback a uno concreto).
