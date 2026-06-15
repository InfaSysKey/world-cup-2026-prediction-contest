# Importar porras desde Excel a la base de datos

Este directorio contiene los Excel personales que cada amigo ha rellenado con su porra del Mundial 2026. El script `lib/db/seed/import-porra-from-excel.py` los convierte en `INSERT`s para las tablas `predictions_*`.

## Aplicar en local (`podman` de dev)

```bash
/usr/bin/python3 lib/db/seed/import-porra-from-excel.py \
  porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \
  --email <email-del-usuario> \
  | podman exec -i porra-db psql -U porra -d porra
```

## Aplicar en el VPS de producción

Mismo comando, pero el destino es el contenedor `porra-db` que corre en el VPS. El Python se ejecuta en local; solo viaja el SQL por SSH:

```bash
/usr/bin/python3 lib/db/seed/import-porra-from-excel.py \
  porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \
  --email <email-del-usuario> \
  | ssh <usuario>@<host-vps> "podman exec -i porra-db psql -U porra -d porra"
```

El `.xlsx` NO necesita estar en el VPS — el Python lo lee en local y solo se manda el SQL (~200 líneas) por SSH.

## Crear el usuario destino (solo si no está registrado)

```bash
# 1. Genera el hash bcrypt en local:
HASH=$(node -e "console.log(require('bcrypt').hashSync('una-pass', 12))")

# 2. Insértalo:
podman exec porra-db psql -U porra -d porra -c \
  "INSERT INTO users (email, password_hash, nombre, apellidos, nickname, is_admin) \
   VALUES ('<email>', '$HASH', '<Nombre>', '<Apellidos>', '<nickname>', false);"
```

(Si tu amigo ya se ha registrado por el flujo normal de invitación, salta este paso.)

## Inspeccionar el SQL antes de aplicar

```bash
/usr/bin/python3 lib/db/seed/import-porra-from-excel.py \
  porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \
  --email <email-del-usuario> \
  -o /tmp/porra.sql

# Debe tener 169 filas VALUES (72+48+8+32+9):
grep -c "^    (target_user_id" /tmp/porra.sql
```

## Comprobar después de aplicar (debe dar 72 / 48 / 8 / 32 / 9)

```bash
podman exec porra-db psql -U porra -d porra -c "
  WITH u AS (SELECT id FROM users WHERE email='<email>')
  SELECT 'grp_matches', COUNT(*) FROM predictions_group_matches WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'standings', COUNT(*) FROM predictions_group_standings WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'thirds', COUNT(*) FROM predictions_best_thirds WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'knockout', COUNT(*) FROM predictions_knockout WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'awards', COUNT(*) FROM predictions_awards WHERE user_id = (SELECT id FROM u);"
```

## Qué hace el script (resumen)

- Lee marcadores (72 grupos + 32 knockouts) y premios (6 botas/balones) del Excel.
- **Deriva** standings, mejores terceros y podio aplicando la misma lógica que `lib/scoring/` (PTS → GD → GF → alfabético).
- Emite SQL envuelto en `BEGIN; DO $$ … END $$; COMMIT;`. Si el email no existe, hace `RAISE EXCEPTION` y `ROLLBACK` sin tocar nada.
- Aborta con `RuntimeError` si faltan marcadores, hay knockouts con empate (`AC == AD`) o la combinación de mejores terceros no está en `BEST_THIRDS_MAPPING`.
