# Importar porras desde Excel a la base de datos

Este directorio contiene los Excel personales que cada amigo ha rellenado con su porra del Mundial 2026. El script `lib/db/seed/import-porra-from-excel.py` los convierte en `INSERT`s para las tablas `predictions_*`.

## Para cargar tu porra cuando crees el usuario destino

```bash
# 1. Crea el usuario en BD (con bcrypt cost 12):
podman exec porra-db psql -U porra -d porra -c "INSERT INTO users (email, password_hash, nombre, apellidos, nickname, is_admin) VALUES ('carlos@porra.local', '<bcrypt-hash>', 'Carlos', 'Apellido', 'carlos', false);"

# 2. Genera y aplica:
/usr/bin/python3 lib/db/seed/import-porra-from-excel.py \
  porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \
  --email carlos@porra.local \
  | podman exec -i porra-db psql -U porra -d porra
```

## Generar el bcrypt-hash

```bash
node -e "console.log(require('bcrypt').hashSync('una-pass', 12))"
```

## Cargar las porras del resto de amigos

Mismo script, solo cambias `--email` y la ruta al `.xlsx`. Idempotente: aplicar dos veces deja la BD igual (DELETE + INSERT del usuario en una transacción).

## Inspeccionar antes de aplicar

```bash
/usr/bin/python3 lib/db/seed/import-porra-from-excel.py \
  porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \
  --email carlos@porra.local \
  -o /tmp/porra-carlos.sql

# Revisa el .sql; debe tener 169 filas VALUES (72+48+8+32+9).
grep -c "^    (target_user_id" /tmp/porra-carlos.sql
```

## Comprobar después de aplicar

```bash
podman exec porra-db psql -U porra -d porra -c "
  WITH u AS (SELECT id FROM users WHERE email='carlos@porra.local')
  SELECT 'grp_matches', COUNT(*) FROM predictions_group_matches WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'standings', COUNT(*) FROM predictions_group_standings WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'thirds', COUNT(*) FROM predictions_best_thirds WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'knockout', COUNT(*) FROM predictions_knockout WHERE user_id = (SELECT id FROM u)
  UNION ALL SELECT 'awards', COUNT(*) FROM predictions_awards WHERE user_id = (SELECT id FROM u);"
```

Esperado: 72 / 48 / 8 / 32 / 9.

## Qué hace el script (resumen)

- Lee marcadores (72 grupos + 32 knockouts) y premios (6 botas/balones) del Excel.
- **Deriva** standings, mejores terceros y podio aplicando la misma lógica que `lib/scoring/` (PTS → GD → GF → alfabético).
- Emite SQL envuelto en `BEGIN; DO $$ … END $$; COMMIT;`. Si el email no existe, hace `RAISE EXCEPTION` y `ROLLBACK` sin tocar nada.
- Aborta con `RuntimeError` si faltan marcadores, hay knockouts con empate (`AC == AD`) o la combinación de mejores terceros no está en `BEST_THIRDS_MAPPING`.
