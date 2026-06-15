# Getting Started — Porra Mundial 2026

Esta guía te lleva desde **cero** hasta tener el proyecto:

- Corriendo en local con `podman-compose up`.
- Desplegado en un VPS con Plesk (TLS y reverse-proxy gestionados por Plesk).
- Con Claude Code configurado y los 3 documentos base en el repo.

Calcula 4–6 horas en total para completar todo. **Hazlo en una sesión seguida** la primera vez para no perder el contexto.

---

## Fase 0 — Prerrequisitos en tu máquina (30 min)

Verificar y/o instalar lo siguiente. Comandos en macOS / Linux; en Windows lo más cómodo es WSL2.

```bash
# Node.js 20 LTS o superior
node --version          # debe ser >= 20.0.0
# Si no: instalar con nvm → https://github.com/nvm-sh/nvm

# Git
git --version

# Podman + podman-compose
podman --version        # >= 4.0
podman-compose --version

# Claude Code (>= 2.1.154 para workflows)
claude --version
# Si no: npm install -g @anthropic-ai/claude-code  (o el método oficial actual)
```

Cuenta GitHub lista.  
Cuenta Cloudflare lista (gratis, para DNS y opcionalmente proxy/CDN).  
Tarjeta para el VPS (€5–6/mes).

---

## Fase 1 — Decisiones de hosting (15 min)

### 1.1 Dominio

Si ya tienes el dominio donde irá tu futuro CV, perfecto. Si no, cómpralo en **Namecheap**, **Cloudflare Registrar** o similar. Coste anual €10–15.

Vamos a usar el subdominio `porra.carlosdelcura.es`. El dominio raíz se queda libre para tu CV.

### 1.2 VPS

Setup actual: VPS con **Plesk** preinstalado. Plesk gestiona dominio, TLS (Let's Encrypt automático) y reverse-proxy hacia los backends locales del host. Eso nos quita Caddy del stack: los contenedores solo exponen puertos en `127.0.0.1` y Plesk hace de frente.

Si vas a montar uno desde cero, Hetzner CX22 / OVH con plantilla de Plesk es la opción más cómoda. Si prefieres VPS pelado, usa el `slice-roadmap` original con Caddy (ver ADR [0001](../docs/decisions/0001-stack-tecnico.md)).

### 1.3 DNS

Plesk pide que el dominio resuelva al IP del VPS antes de poder emitir el cert de Let's Encrypt. En tu proveedor de DNS:

```
Type: A
Name: porra
Value: <IP del VPS>
Proxy: DNS only (si usas Cloudflare, sin nube naranja para que Plesk pueda validar el dominio)
TTL: Auto
```

---

## Fase 2 — Repositorio y scaffolding (45 min)

### 2.1 Crear el repo en GitHub

Crear repo nuevo `porra-mundial-2026`, **privado**, sin README ni .gitignore inicial (los pondrás tú).

### 2.2 Bootstrap del proyecto Next.js

```bash
cd ~/code     # o donde tengas tus proyectos
npx create-next-app@latest porra-mundial-2026 \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --use-npm

cd porra-mundial-2026
```

Cuando pregunte ESLint, di **yes**.  
Cuando pregunte Turbopack, di **yes**.

### 2.3 Instalar dependencias del stack

```bash
# Core
npm install drizzle-orm pg bcrypt zod
npm install -D drizzle-kit @types/pg @types/bcrypt

# Testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react
npm install -D @playwright/test
npx playwright install

# Utilidades
npm install date-fns clsx tailwind-merge
```

### 2.4 Inicializar shadcn/ui

```bash
npx shadcn@latest init
```

Acepta los defaults. Cuando pregunte estilo, **New York**. Color base **slate**.

Instala los componentes que vas a usar en seguida:

```bash
npx shadcn@latest add button input label card form table tabs dialog
```

### 2.5 Crear estructura de carpetas

```bash
mkdir -p .claude/{skills,agents,workflows}
mkdir -p docs/decisions
mkdir -p app/{"(auth)","(porra)",admin,api}
mkdir -p components/porra
mkdir -p lib/{db/{migrations,seed},auth,scoring,validators}
mkdir -p tests/e2e
mkdir -p infra/scripts
```

### 2.6 Drop in de la documentación completa

Copia los archivos que ya tienes generados:

```bash
# Raíz del repo
cp <ruta>/CLAUDE.md ./CLAUDE.md
cp <ruta>/README.md ./README.md

# Documentación
cp <ruta>/scoring-rules.md ./docs/scoring-rules.md
cp <ruta>/data-model.md ./docs/data-model.md
cp <ruta>/claude-code-playbook.md ./docs/claude-code-playbook.md
cp <ruta>/slice-roadmap.md ./docs/slice-roadmap.md
cp <ruta>/getting-started.md ./docs/getting-started.md

# ADRs
cp <ruta>/0001-stack-tecnico.md ./docs/decisions/0001-stack-tecnico.md
cp <ruta>/0002-auth-propia-sin-libreria.md ./docs/decisions/0002-auth-propia-sin-libreria.md
cp <ruta>/0003-bracket-rigido-sin-rebracket.md ./docs/decisions/0003-bracket-rigido-sin-rebracket.md
```

Verificación rápida:

```bash
ls -1 CLAUDE.md README.md
ls -1 docs/
ls -1 docs/decisions/
```

Deberías ver los 7 documentos en `docs/` + los 3 ADRs en `docs/decisions/`.

### 2.7 `.env.example` y `.env`

Crea `.env.example` en la raíz con el contenido que define `CLAUDE.md §13`. Después:

```bash
cp .env.example .env
# Editar .env con valores locales:
# - COOKIE_SECRET: openssl rand -base64 32
# - POSTGRES_PASSWORD: openssl rand -base64 24
# - DATABASE_URL: postgres://porra:<POSTGRES_PASSWORD>@localhost:5432/porra
# - ADMIN_BOOTSTRAP_EMAIL/PASSWORD: lo que tú quieras (uso único)
```

Asegúrate de que `.env` está en `.gitignore`. `.env.example` sí se commitea.

### 2.8 Primer commit

```bash
git init
git add .
git commit -m "chore: bootstrap inicial del proyecto

- Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Estructura de carpetas y .claude/
- Documentación completa: CLAUDE.md, README, scoring-rules,
  data-model, playbook, slice-roadmap, getting-started, 3 ADRs"

git branch -M main
git remote add origin git@github.com:<tu-user>/porra-mundial-2026.git
git push -u origin main
```

---

## Fase 3 — Containerización local (60 min)

Vamos a tener 2 contenedores: `db` (Postgres) y `app` (Next.js). En local solo necesitas `db` corriendo; la app va con `npm run dev`. En producción los dos corren juntos detrás de Plesk (que hace TLS y reverse-proxy).

### 3.1 `infra/Containerfile`

```dockerfile
# infra/Containerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

### 3.2 `infra/compose.yaml`

Ver `infra/compose.yaml` en el repo. Resumen:

- `db`: postgres:16-alpine, bindeado a `127.0.0.1:5432`. `POSTGRES_PASSWORD` lo lee del `.env` (obligatorio, sin default — el compose falla si no está definido).
- `app`: imagen `ghcr.io/infasyskey/porra-app:${IMAGE_TAG:-latest}`, bindeado a `127.0.0.1:3000`. Lee `APP_URL`, `COOKIE_SECRET` y `POSTGRES_PASSWORD` del entorno.
- **No hay servicio proxy.** En producción el reverse-proxy lo hace Plesk en el host; en local ni siquiera arrancas el contenedor `app` (vas con `npm run dev`).

### 3.3 Probar la base de datos en local

```bash
cd infra
podman-compose up -d db
podman-compose logs -f db   # Ctrl+C cuando veas "ready to accept connections"

# Verificar conexión desde la máquina (sustituye <POSTGRES_PASSWORD> por el de tu .env)
psql "postgres://porra:<POSTGRES_PASSWORD>@localhost:5432/porra" -c "SELECT version();"
```

Si responde con la versión, el primer hito está hecho.

---

## Fase 4 — Configurar Claude Code (20 min)

### 4.1 Activar dynamic workflows (solo si estás en Pro)

```bash
cd ~/code/porra-mundial-2026
claude
```

Dentro de Claude Code:

```
> /config
```

Buscar **Dynamic workflows** y marcar **on**. Si estás en Max/Team ya van por defecto.

### 4.2 Verificar modelo

```
> /model
```

Debe estar en `claude-opus-4-8`. Si no, cambiar.

### 4.3 Verificar effort level

```
> /effort high
```

Effort `high` para todo el desarrollo normal. Ultracode solo en momentos puntuales (ver `docs/claude-code-playbook.md §6`).

### 4.4 Salir y reabrir para que cargue `CLAUDE.md`

```
> /quit
claude     # reabrir
```

Verificar que ha leído el `CLAUDE.md` preguntándole algo como "qué stack usa este proyecto". Si responde correctamente, ya está cargado.

---

## Fase 5 — Provisionar el VPS (90 min)

Esta fase la haces una sola vez por proyecto.

### 5.1 Usuario y SSH (Plesk delante)

El VPS viene con Plesk preinstalado: dominios, TLS y firewall los gestiona Plesk. Lo único que necesitas a nivel SO es un usuario para correr podman y SSH con clave para CI.

Desde tu máquina, conecta con el usuario root o admin que te dio el proveedor:

```bash
ssh <admin>@<IP_VPS>
```

Una vez dentro:

```bash
# Crear usuario no-root con sudo
sudo adduser porra
sudo usermod -aG sudo porra

# Copiar tu clave SSH al nuevo usuario
sudo mkdir -p /home/porra/.ssh
sudo cp ~/.ssh/authorized_keys /home/porra/.ssh/
sudo chown -R porra:porra /home/porra/.ssh
sudo chmod 700 /home/porra/.ssh
sudo chmod 600 /home/porra/.ssh/authorized_keys
```

Firewall: gestionado por Plesk (Tools & Settings → Firewall). Asegúrate de que están abiertos 22 (SSH), 80, 443 y los puertos del panel de Plesk (8443/8447 por defecto). **Nada más debe estar expuesto al exterior**. Los puertos 3000 (app) y 5432 (postgres) los bindeamos a `127.0.0.1` desde compose, así que no hace falta tocarlos en el firewall.

Salir y volver a entrar como `porra`:

```bash
ssh porra@<IP_VPS>
```

### 5.2 Instalar Podman y podman-compose

```bash
sudo apt install -y podman podman-compose git curl

# Verificar
podman --version
podman-compose --version
```

### 5.3 Clonar el repo y preparar `.env`

```bash
cd /opt
sudo mkdir porra && sudo chown porra:porra porra
cd porra
git clone git@github.com:<tu-user>/porra-mundial-2026.git .

cp .env.example .env
# Editar .env con valores de PRODUCCIÓN:
# - COOKIE_SECRET: openssl rand -base64 32  (nuevo, distinto del de local)
# - POSTGRES_PASSWORD: openssl rand -base64 24  (genera uno fuerte; nunca un valor débil en prod)
# - APP_URL: https://porra.carlosdelcura.es
# - ADMIN_BOOTSTRAP_*: lo que sea, para el primer admin
nano .env
```

`DATABASE_URL` no hace falta en el `.env` del VPS: el compose lo construye con `POSTGRES_PASSWORD` para que `app` se conecte a `db` por la red interna del compose.

### 5.4 Primer despliegue manual (luego automatizamos con CI)

```bash
cd /opt/porra
podman-compose -f infra/compose.yaml build app
podman-compose -f infra/compose.yaml up -d
podman-compose -f infra/compose.yaml ps

# Health check directo contra el contenedor (sin pasar por Plesk todavía)
curl -fsS http://127.0.0.1:3000/api/health
```

Si el health responde `db: "ok"`, el contenedor está sano. Antes de que `https://porra.carlosdelcura.es` responda, hay que dar de alta el dominio en Plesk.

### 5.4.bis Configurar Plesk (one-time)

En el panel de Plesk:

1. **Add Domain** → `porra.carlosdelcura.es`. Sin hosting de archivos (la app la sirve podman, no Plesk).
2. **SSL/TLS Certificates** → "Get it free" (Let's Encrypt). Marca renovación automática. Activar "Redirect from http to https" y "HSTS".
3. **Apache & nginx Settings** → "Additional nginx directives":
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
4. Aplica y prueba:
   ```bash
   curl -I https://porra.carlosdelcura.es/api/health
   ```
   Debe devolver 200 y los headers de seguridad (CSP, HSTS, X-Frame-Options, etc.).

### 5.5 Backups

Crear `/opt/porra/infra/scripts/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
DEST=/opt/porra/infra/scripts/backups
mkdir -p "$DEST"
podman exec porra-db pg_dump -U porra porra | gzip > "$DEST/porra-$TS.sql.gz"
# Mantener solo los últimos 30
ls -1t "$DEST"/porra-*.sql.gz | tail -n +31 | xargs -r rm
```

```bash
chmod +x /opt/porra/infra/scripts/backup.sh
# Cron: todas las noches a las 4:00
( crontab -l 2>/dev/null; echo "0 4 * * * /opt/porra/infra/scripts/backup.sh" ) | crontab -
```

#### Backup remoto semanal a Backblaze B2

Gratis hasta 10 GB. Sube el dump local más reciente; retención remota 90 días.

1. Instala y configura `rclone` en el host con un remote B2 (no se commitea nada):

   ```bash
   rclone config   # type=b2, account=<keyId>, key=<applicationKey>, nombre del remote: b2
   ```

2. Exporta el bucket en el entorno del cron (las credenciales ya las guarda rclone):

   ```bash
   # /opt/porra/infra/scripts/backup-b2.sh lee B2_BUCKET (y opcional RCLONE_B2_REMOTE).
   chmod +x /opt/porra/infra/scripts/backup-b2.sh
   # Cron: domingos a las 5:00 (tras el nocturno de las 4:00).
   ( crontab -l 2>/dev/null; \
     echo "0 5 * * 0 B2_BUCKET=porra-backups /opt/porra/infra/scripts/backup-b2.sh" ) | crontab -
   ```

3. **Verifica el restore al menos una vez**: descarga un dump de B2, restáuralo en una BD limpia local y arranca la app contra ella. Un backup sin probar no es un backup.

---

## Fase 6 — Checklist final del día 1

Antes de pasar al slice 1, comprueba:

- [ ] `npm run dev` arranca la app en `http://localhost:3000`.
- [ ] `podman-compose up -d db` en local levanta Postgres y `psql` conecta.
- [ ] `https://porra.carlosdelcura.es/api/health` devuelve 200 con `db:"ok"` y headers de seguridad.
- [ ] `ss -ltn` en el VPS confirma que `:3000` y `:5432` solo escuchan en `127.0.0.1`.
- [ ] El repo está pusheado a GitHub con los 4 docs base + estructura de carpetas.
- [ ] Claude Code arranca, ve `CLAUDE.md`, y `/effort` ofrece `ultracode`.
- [ ] Backup nocturno configurado en el VPS.

Si todos los checks están verdes, **estás listo para el slice 1**.

---

## Siguiente paso

Con todos los checks verdes, ya tienes la base. El plan detallado del slice 1 y los 7 siguientes está en `docs/slice-roadmap.md`.

Abrir rama `slice-1-db-schema`, crear la skill `add-migration` en `.claude/skills/`, y empezar a tirar de Claude Code con `/effort high`.

Atajo mental:
1. Abre Claude Code en la raíz del repo.
2. `/model claude-opus-4-8` (si no está).
3. `/effort high`.
4. Léele el slice-roadmap y empezad por el slice 1.
