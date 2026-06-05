# 0004 — Middleware sin BD en el runtime Edge

**Fecha**: 2026-06-06
**Estado**: aceptada

## Contexto

Next 15 ejecuta `middleware.ts` en el runtime **Edge**, donde no están
disponibles ni el cliente de Postgres (`pg` usa APIs de Node) ni `bcrypt`. A la
vez, CLAUDE.md §6 exige:

- Proteger todas las rutas salvo una lista blanca (login, registro con token).
- Que `/admin/**` exija `is_admin = true`.
- Sesiones revocables: cerrar sesión invalida la fila en `sessions`, no solo
  borra la cookie.

Si la validación de sesión (consultar `sessions`, cargar el `user`, comprobar
`is_admin`) viviera en el middleware, necesitaríamos tocar la BD en Edge. Las
opciones para ello (driver HTTP tipo Neon, replicar la sesión en un JWT
firmado, etc.) añaden dependencias o duplican el estado de sesión fuera de la
tabla `sessions`, rompiendo la revocabilidad.

## Decisión

Partir la responsabilidad en dos capas:

- **Middleware (Edge)**: solo comprueba la **presencia** de la cookie
  `porra_session`. Si falta y la ruta no es pública, redirige a `/login`. No
  consulta la BD.
- **`getCurrentUser()` / `requireAdmin()` (Node, en Server Components y Server
  Actions)**: hacen la validación real contra `sessions` (sesión viva, usuario
  existente) y aplican el 403 de admin vía `forbidden()` de Next 15
  (`experimental.authInterrupts`). Las Server Actions usan además
  `requireAdminAction()`, que devuelve el error como dato en lugar de
  interrumpir el render.

El middleware es un filtro barato de primera línea; la autorización que importa
se impone donde sí hay BD.

## Consecuencias

**Ganamos**:
- El middleware se mantiene compatible con Edge sin drivers HTTP ni JWT.
- Una única fuente de verdad de la sesión: la tabla `sessions`. El logout sigue
  siendo revocable de inmediato.
- La comprobación cara (BD) ocurre una sola vez por request, en la capa Node que
  ya carga el usuario para renderizar.

**Perdemos**:
- Una cookie presente pero inválida (sesión caducada/revocada) **supera** el
  middleware y solo se rechaza en la capa Node. Aceptable: el contenido
  protegido nunca se sirve, porque `getCurrentUser()` devuelve `null` y la
  página redirige o `forbidden()`. El coste es un render de servidor extra, no
  una fuga de datos.
- Hay que recordar que el middleware **no** es la frontera de seguridad: toda
  página/acción protegida debe llamar a `getCurrentUser`/`requireAdmin(Action)`
  por su cuenta. No basta con confiar en el matcher.

## Alternativas consideradas

- **Validar la sesión en el middleware con un driver HTTP** (p. ej. Neon
  serverless): añade dependencia e infra solo para adelantar una comprobación
  que igualmente repetimos en Node. Descartada.
- **Sesión en JWT firmado leído en Edge**: rápido de validar sin BD, pero rompe
  la revocabilidad inmediata (un JWT válido sigue sirviendo hasta caducar
  aunque borres la sesión). Choca con el requisito de logout revocable de
  CLAUDE.md §6. Descartada.
