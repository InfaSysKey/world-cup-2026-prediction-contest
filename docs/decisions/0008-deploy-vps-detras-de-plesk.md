# 0008 — Deploy en VPS detrás de Plesk

**Fecha**: 2026-06-11
**Estado**: aceptada

## Contexto

El [ADR 0001](./0001-stack-tecnico.md) decidió 3 contenedores (db, app, caddy) en un VPS Hetzner pelado. Caddy se ocupaba de TLS automático y reverse-proxy hacia el contenedor `app`.

Al provisionar el VPS real surgieron dos cambios respecto a esa hipótesis:

1. El VPS elegido ya viene con **Plesk** preinstalado (panel del proveedor). Plesk monta nginx delante de cualquier site, gestiona dominios, y emite/renueva Let's Encrypt automáticamente para los hostnames que registras en su UI.
2. Es probable que en el mismo VPS convivan otros sites (CV, side projects). Mantener Caddy dentro del compose obligaría a desactivar el frente HTTP de Plesk, o a moverlo de puerto, perdiendo la integración con su gestor de dominios y certificados.

## Decisión

Eliminar Caddy del stack. Plesk hace TLS y reverse-proxy. Podman queda solo con `db` y `app`, ambos bindeando a `127.0.0.1`.

Cambios concretos:

- `infra/compose.yaml`: borrado el servicio `proxy` y los volúmenes `porra-caddy-data` / `porra-caddy-config`. El servicio `app` publica el puerto en `127.0.0.1:3000:3000` para que Plesk (en el host) llegue. `APP_URL` y `POSTGRES_PASSWORD` se leen de `.env`.
- `infra/Caddyfile`: borrado.
- `next.config.ts`: HSTS pasa a emitirse desde la app (era el único header que dependía de Caddy). El resto ya estaban en la app.
- `.claude/skills/deploy-vps/SKILL.md`: arquitectura actualizada + sección "Configuración Plesk" + sección "Migración del stack Caddy".

## Consecuencias

**Ganamos**:

- Un único punto de TLS (Plesk) → renovaciones de certificado y gestión de dominios reutilizable para futuros sites en el mismo VPS.
- Menos contenedores que mantener (2 vs 3).
- Cero conflicto por puertos 80/443 con lo que Plesk ya hace.
- Defensa en profundidad: con `app` bindeado a `127.0.0.1`, ningún cambio accidental en Plesk expone el backend directamente a internet.

**Perdemos**:

- La configuración del reverse-proxy de Plesk no está versionada. La dejamos documentada en la skill `deploy-vps`, pero un re-provisionado del VPS requiere replicar esos pasos manualmente.
- Un fallo de Plesk (renovación de cert que se queda colgada, actualización que rompe la config nginx) tumba el frente y no se detecta desde el `deploy.sh`.
- Plesk ha tenido CVEs históricamente. Disclosure "uso Plesk" en el repo público es info marginal para un atacante, pero existe.

## Alternativas consideradas

- **Mantener Caddy y mover Plesk a otro puerto**: descartado. Complica la coexistencia con futuros sites del VPS y duplica la gestión de certificados.
- **Quitar Plesk del VPS y dejar solo Caddy**: descartado. Plesk ofrece UI, antispam, mail y demás para otros usos del VPS que el autor quiere conservar.
- **Nginx Proxy Manager en lugar de Plesk**: descartado. Duplica funcionalmente lo que Plesk ya hace, sin aportar nada que se vaya a usar.
- **Traefik con label discovery sobre podman**: descartado. Aumenta complejidad de despliegue para un único site detrás del proxy.
