---
name: deploy-vps
description: Use this skill for anything touching deployment or production infrastructure — changes to infra/Containerfile, infra/compose.yaml, GitHub Actions workflows, the deploy script, health checks, backups, or the VPS setup. Triggers on mentions of deploy, CI/CD, production, podman in prod, registry, Plesk, o going live.
---

# deploy-vps

Rutina y reglas para desplegar la porra en el VPS de producción de forma segura y reproducible. El objetivo: que un deploy nunca tumbe la app durante el Mundial, y que un deploy roto se revierta en segundos.

## Cuándo usar

- Cambios en `infra/Containerfile`, `infra/compose.yaml`.
- Crear o modificar el workflow de GitHub Actions.
- El script `infra/scripts/deploy.sh`.
- Health checks, backups, headers de seguridad.
- Configuración del dominio o reverse-proxy en Plesk.
- Cualquier mención a deploy, CI/CD, producción, registry, "subir a producción".

## Arquitectura de producción

2 contenedores en el VPS via podman-compose: `db` (postgres:16) y `app` (Next.js). Ambos bindean SOLO a `127.0.0.1`. **Plesk** (en el host del VPS) hace TLS y reverse-proxy desde `https://porra.carlosdelcura.es` hacia `http://127.0.0.1:3000`.

```
Internet  →  Plesk (TLS, dominio, LE auto)  →  127.0.0.1:3000  →  podman: app  →  podman: db (127.0.0.1:5432)
```

Reglas duras:
- **Nada bindeado a `0.0.0.0`**. Ni `app` ni `db`. Si lo ves, es bug.
- **Plesk no se versiona**: su configuración vive en el VPS. Documentamos los pasos abajo pero no exportamos su config al repo.
- **El cert lo gestiona Plesk** (Let's Encrypt automático). El podman no toca TLS.

## Pipeline de deploy (CI/CD)

El flujo objetivo, automatizado (ver `.github/workflows/ci-cd.yml`):

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

Estructura real (resumida):

```bash
#!/bin/bash
set -euo pipefail

SHA="${1:?Falta el SHA de la imagen}"
IMAGE_REPO="ghcr.io/infasyskey/porra-app"
COMPOSE="podman-compose -f infra/compose.yaml"
HEALTH_URL="http://localhost:3000/api/health"

cd /opt/porra

PREV_IMAGE=$(podman inspect porra-app --format '{{.ImageName}}' 2>/dev/null || echo "")
PREV_TAG="${PREV_IMAGE##*:}"

podman pull "${IMAGE_REPO}:${SHA}"
IMAGE_TAG="${SHA}" $COMPOSE run --rm app npm run db:migrate
IMAGE_TAG="${SHA}" $COMPOSE up -d app

for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"db":"ok"'; then
    exit 0
  fi
  sleep 2
done

# Rollback automático si el health check falla.
[ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$SHA" ] && \
  IMAGE_TAG="${PREV_TAG}" $COMPOSE up -d app
exit 1
```

Reglas:
- **Migraciones backward-compatible**: una migración nueva no debe romper la versión anterior de la app (por si hay rollback). Nada de DROP COLUMN en la misma release que deja de usarla; se hace en dos releases (deja de usar → release → drop → release).
- El health check es la condición de éxito, no "el contenedor arrancó".
- Rollback automático si el health check falla en 60s.
- El script no toca Plesk: si Plesk está caído o mal configurado, el deploy del contenedor sigue siendo correcto; el problema es de capa diferente.

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

Todos en `next.config.ts`. **No dependen de Plesk** (defensa en profundidad: si la config de Plesk se cae a un default, los headers siguen viajando con la respuesta de Next).

- `Content-Security-Policy` (restrictiva; `'unsafe-eval'` solo en dev).
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

Plesk puede añadir los suyos también; no es problema (los browsers honran el primero/válido).

## robots.txt

La porra es privada. `app/robots.ts` ya devuelve `Disallow: /` para todo user-agent. No tocar salvo que cambie la política.

## Backups

- **Local nocturno**: `pg_dump` por cron, retención 30 días (`infra/scripts/backup.sh`, configurado en getting-started.md Fase 5).
- **Remoto semanal**: `infra/scripts/backup-b2.sh` sube el último dump a Backblaze B2. Credenciales en variables de entorno del host, no en el repo.
- **Verificar restore**: un backup que no se ha probado restaurar no es un backup. Al menos una vez, restaura un dump en una BD limpia local y comprueba que la app arranca contra ella.

## Configuración Plesk (one-time)

Una sola vez, al provisionar el dominio. Esto vive en el VPS, no en el repo:

1. **Dominio**: en Plesk → Websites & Domains → Add Domain → `porra.carlosdelcura.es`. Sin hosting de archivos (no se sirve nada estático desde Plesk).
2. **TLS**: SSL/TLS Certificates → Get it free (Let's Encrypt). Marca renovación automática. Activar "Redirect from http to https" y "HSTS" (no le hace daño aunque Next ya lo emita).
3. **Reverse proxy**: Apache & nginx Settings → "Additional nginx directives":
   ```
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
       proxy_set_header X-Forwarded-Host $host;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_read_timeout 60s;
   }
   ```
4. **Firewall (Plesk Firewall o ufw)**: solo 80, 443 y SSH desde fuera. Puertos `3000` y `5432` jamás abiertos a internet.

## Migración del stack antiguo con Caddy (one-time)

Si el VPS tenía la versión anterior con un contenedor `porra-proxy` (Caddy), límpialo después del primer deploy con el compose nuevo:

```bash
# Para y elimina el contenedor Caddy huérfano
podman rm -f porra-proxy 2>/dev/null || true

# Borra los volúmenes que ya no usa nadie
podman volume rm porra-caddy-data porra-caddy-config 2>/dev/null || true

# Si Caddy tenía los 80/443 ocupados, libera puertos y deja que Plesk los tome
ss -ltn | grep -E ':80 |:443 '
```

## Rotación de credenciales de Postgres

El compose lee `POSTGRES_PASSWORD` del entorno (`.env` del VPS). En el primer deploy:

```bash
# 1. Genera y guarda el secreto en /opt/porra/.env
NEW_PW=$(openssl rand -base64 24)
echo "POSTGRES_PASSWORD=${NEW_PW}" >> /opt/porra/.env

# 2. Si la BD ya existe con el password antiguo ("porra"), rota dentro del contenedor
podman exec -i porra-db psql -U porra -d porra -c \
  "ALTER USER porra WITH PASSWORD '${NEW_PW}';"

# 3. Reinicia app y db para que cojan el nuevo entorno
cd /opt/porra && IMAGE_TAG=$(podman inspect porra-app --format '{{.ImageName}}' | awk -F: '{print $NF}') \
  podman-compose -f infra/compose.yaml up -d
```

El `.env` del VPS también tiene que tener `APP_URL=https://porra.carlosdelcura.es` y `COOKIE_SECRET=...`. Si falta `APP_URL`, las URLs absolutas (links de invitación, redirects) salen rotas.

## Rutina de deploy manual (si CI/CD falla)

```bash
ssh porra@<VPS>
cd /opt/porra
git pull origin main
./infra/scripts/deploy.sh $(git rev-parse HEAD)
```

## Smoke test post-deploy

Tras cada deploy, manual o automático, verificar:
1. `curl https://porra.carlosdelcura.es/api/health` → 200, `db: ok`, headers de seguridad presentes.
2. `ss -ltn` en el VPS: `:3000` solo en `127.0.0.1`, `:5432` solo en `127.0.0.1`.
3. Login con una cuenta de prueba funciona.
4. La página `/porra` carga.

## Anti-patterns (rechazar)

- ❌ Secrets en el YAML de Actions, en el Containerfile, o commiteados.
- ❌ Deploy sin health check (asumir que "el contenedor arrancó" = "funciona").
- ❌ Deploy sin estrategia de rollback.
- ❌ Migración destructiva (DROP) en la misma release que deja de usar la columna.
- ❌ Postgres expuesto a internet (puerto 5432 fuera de localhost).
- ❌ App expuesta a internet saltándose Plesk (puerto 3000 en `0.0.0.0`).
- ❌ Deployar desde una rama distinta de main.
- ❌ Backup que nunca se ha probado restaurar.
- ❌ Tocar la configuración TLS de Plesk desde el repo (vive fuera del versionado).
- ❌ Hardcodear `POSTGRES_PASSWORD` o `APP_URL` en el compose en lugar de leerlos de `.env`.
- ❌ `latest` como única etiqueta de imagen (siempre etiquetar también con el SHA para poder hacer rollback a uno concreto).
