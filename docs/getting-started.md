# Getting Started — Porra Mundial 2026

Esta guía te lleva desde **cero** hasta tener el proyecto:

- Corriendo en local con `podman-compose up`.
- Desplegado en un VPS con HTTPS automático.
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

Vamos a usar el subdominio `porra.tudominio.com`. El dominio raíz se queda libre para tu CV.

### 1.2 VPS

Tres opciones razonables, ordenadas por relación calidad/precio:

| Proveedor | Plan | Specs | Precio | Notas |
|---|---|---|---|---|
| **Hetzner** | CX22 | 2 vCPU, 4 GB RAM, 40 GB SSD | ~€4,5/mes | Datacenter en Falkenstein o Helsinki. Mejor latencia desde España |
| **Contabo** | VPS S | 4 vCPU, 8 GB RAM, 100 GB SSD | ~€5/mes | Más RAM por el mismo precio, pero IO más lenta |
| **OVH** | VLE-2 | 2 vCPU, 2 GB RAM, 40 GB SSD | ~€4/mes | Datacenter en Madrid (mejor latencia local) |

Recomendación: **Hetzner CX22 en Helsinki o Falkenstein**. Buen equilibrio para este proyecto.

Pide imagen **Debian 12** o **Ubuntu 24.04 LTS** al provisionar.

### 1.3 DNS

En Cloudflare (o donde tengas el DNS), crear:

```
Type: A
Name: porra
Value: <IP del VPS>
Proxy: DNS only (sin nube naranja al principio, para que Caddy pueda emitir el cert)
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
# - DATABASE_URL: postgres://porra:porra@localhost:5432/porra
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

Vamos a tener 3 contenedores: `db` (Postgres), `app` (Next.js), `proxy` (Caddy). En local solo necesitas `db` corriendo; la app va con `npm run dev`. En producción los tres viven juntos.

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

### 3.2 `infra/compose.yml`

```yaml
# infra/compose.yml
version: "3.9"

services:
  db:
    image: docker.io/postgres:16-alpine
    container_name: porra-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: porra
      POSTGRES_PASSWORD: porra
      POSTGRES_DB: porra
    volumes:
      - porra-db-data:/var/lib/postgresql/data
      - ./scripts/backups:/backups
    ports:
      - "127.0.0.1:5432:5432"   # solo localhost; en VPS no expuesto fuera
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U porra"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: ..
      dockerfile: infra/Containerfile
    container_name: porra-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://porra:porra@db:5432/porra
      APP_URL: https://porra.tudominio.com
      COOKIE_SECRET: ${COOKIE_SECRET}
      TOURNAMENT_START_AT: 2026-06-11T17:00:00Z
    expose:
      - "3000"

  proxy:
    image: docker.io/caddy:2-alpine
    container_name: porra-proxy
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - porra-caddy-data:/data
      - porra-caddy-config:/config

volumes:
  porra-db-data:
  porra-caddy-data:
  porra-caddy-config:
```

### 3.3 `infra/Caddyfile`

```
porra.tudominio.com {
    encode gzip
    reverse_proxy app:3000
    log {
        output stdout
        format console
    }
}
```

Caddy se encarga sólito de pedir el cert a Let's Encrypt en el primer arranque.

### 3.4 Probar la base de datos en local

```bash
cd infra
podman-compose up -d db
podman-compose logs -f db   # Ctrl+C cuando veas "ready to accept connections"

# Verificar conexión desde la máquina
psql postgres://porra:porra@localhost:5432/porra -c "SELECT version();"
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

### 5.1 Conectar y endurecer

Desde tu máquina:

```bash
ssh root@<IP_VPS>
```

Una vez dentro:

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Crear usuario no-root con sudo
adduser porra
usermod -aG sudo porra

# Copiar tu clave SSH al nuevo usuario
mkdir -p /home/porra/.ssh
cp ~/.ssh/authorized_keys /home/porra/.ssh/
chown -R porra:porra /home/porra/.ssh
chmod 700 /home/porra/.ssh
chmod 600 /home/porra/.ssh/authorized_keys

# Desactivar login root y password auth
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall mínimo
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

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
# - COOKIE_SECRET: nuevo, distinto del de local
# - DATABASE_URL: postgres://porra:porra@db:5432/porra  (db es el nombre del contenedor)
# - APP_URL: https://porra.tudominio.com
# - ADMIN_BOOTSTRAP_*: lo que sea, para el primer admin
nano .env
```

### 5.4 Primer despliegue manual (luego automatizamos con CI)

```bash
cd /opt/porra/infra
podman-compose build app
podman-compose up -d
podman-compose ps
podman-compose logs -f app
```

Si todo va bien, en menos de un minuto Caddy obtiene el cert, y `https://porra.tudominio.com` responde (devolverá un 404 de Next porque aún no hay rutas, pero responder con HTTPS válido es lo importante).

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

Backup remoto a B2 (gratis hasta 10 GB) lo añadimos en el slice 8.

---

## Fase 6 — Checklist final del día 1

Antes de pasar al slice 1, comprueba:

- [ ] `npm run dev` arranca la app en `http://localhost:3000`.
- [ ] `podman-compose up -d db` en local levanta Postgres y `psql` conecta.
- [ ] `https://porra.tudominio.com` responde con HTTPS válido (aunque sea 404).
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
