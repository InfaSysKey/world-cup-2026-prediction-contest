# Porra Mundial 2026

App web privada para gestionar la porra del Mundial 2026 entre un grupo cerrado de amigos. Acceso por invitación, predicciones bloqueadas al pitido inicial, puntos automáticos.

## Stack

- **Next.js 14** (App Router) + **TypeScript** estricto
- **PostgreSQL 16** + **Drizzle ORM**
- **Tailwind CSS** + **shadcn/ui**
- **Podman** + **Caddy** (TLS automático)
- Autenticación propia con cookie httpOnly + bcrypt

## Documentación

| Archivo | Para qué sirve |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Constitución del proyecto: convenciones, estructura, qué hacer y qué no |
| [`docs/scoring-rules.md`](./docs/scoring-rules.md) | Reglas de la porra y sistema de puntos |
| [`docs/data-model.md`](./docs/data-model.md) | Esquema de la base de datos |
| [`docs/claude-code-playbook.md`](./docs/claude-code-playbook.md) | Cómo se usa Claude Code, Ultracode y workflows en este proyecto |
| [`docs/slice-roadmap.md`](./docs/slice-roadmap.md) | Plan detallado por slice |
| [`docs/getting-started.md`](./docs/getting-started.md) | Cómo levantar el proyecto desde cero |
| [`docs/decisions/`](./docs/decisions/) | ADRs (decisiones arquitectónicas) |

## Desarrollo local

```bash
# Levantar Postgres
cd infra && podman-compose up -d db

# Aplicar migraciones y seed
npm run db:migrate
npm run db:seed

# Crear admin inicial (una sola vez)
npm run admin:bootstrap

# Arrancar la app
npm run dev
```

Detalle completo en [`docs/getting-started.md`](./docs/getting-started.md).

## Estado

Proyecto privado. No acepta colaboradores externos. Las invitaciones las genera el admin desde `/admin/invitaciones`.

## Licencia

Sin licencia pública — uso interno del autor y su grupo de amigos.
