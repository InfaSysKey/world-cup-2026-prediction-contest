# Importer de resultados desde openfootball

Guía operativa del importer (ver ADR `docs/decisions/0011-importer-openfootball.md` para el porqué de las decisiones).

## ¿Qué hace?

Importa los resultados oficiales del Mundial 2026 desde
[openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) y los
escribe en BD:

1. **Marcadores** (`matches.real_goles_local/visitante`, `real_winner_team_code`, `status`).
2. **Clasificación de cada grupo** (`actual_group_standings`) cuando los 6 partidos del grupo están finalizados.
3. **Mejores terceros** (`actual_best_thirds`) cuando los 12 grupos están cerrados.
4. **Avance del bracket** (`matches.home_team_code`, `away_team_code`) para los cruces eliminatorios conforme se resuelven los `home_slot_ref`/`away_slot_ref` (1A, 2B, 3ABCDF, W74, L101…).

Cada corrida que aplique cambios dispara `recalculateAll` (recálculo total e
idempotente; fila de auditoría en `score_recalculations`).

## Uso manual

```bash
# Dry-run (por defecto, NO escribe nada; solo muestra el reporte)
npm run results:import

# Aplicar de verdad
npm run results:import -- --apply

# Con motivo personalizado (queda en score_recalculations.reason)
npm run results:import -- --apply --reason "Carga manual tras jornada 2"
```

En el VPS, el comando equivalente dentro del contenedor:

```bash
podman exec porra-app npm run results:import -- --apply --reason "..."
```

## Reporte estructurado

La salida lista:

- Marcadores aplicados / sin cambios / skipeados (con motivo y partido).
- Standings de grupo cerrados esta corrida y los pendientes por desempate sin tarjetas.
- Mejores terceros: cerrados o motivo de bloqueo.
- Bracket: cruces resueltos y slots pendientes (origen no disponible aún).
- Recálculo: si se ejecutó, e iteraciones consumidas del bucle interno.

## Casos pendientes admin

El importer es **conservador**: si llega a un desempate FIFA que requiere tarjetas (paso 5 del reglamento) o sorteo (paso 6), NO inventa nada y deja el grupo o los mejores terceros como "pendientes". El admin cierra esos casos a mano en `/admin/clasificaciones`. Estos casos aparecen en el reporte como:

```
Pendientes admin (sin desempate por tarjetas):
  - Grupo F: bloques empatados TUN/SWE
```

## Cron diario

El script `infra/scripts/cron-import-results.sh` orquesta el comando dentro del contenedor con redirección de logs. Programación recomendada: 03:30 UTC (05:30 hora España en verano) — tras un buffer de seguridad para que openfootball haya absorbido los partidos jugados el día anterior. Ver `infra/cron/porra-importer.cron` con la entrada lista para `crontab -e`.

## Idempotencia y reversibilidad

- Idempotente: lanzar dos veces sin cambios externos en openfootball NO produce escrituras adicionales.
- Reversible: tras un recálculo, la fila previa en `score_recalculations` queda como histórico. Si un import salió mal, se puede revertir manualmente reescribiendo `matches.real_*` a `null` y `status` a `scheduled` para los partidos afectados, luego re-lanzando el importer.

## Limitaciones conocidas

- **Sin tarjetas**: openfootball no expone disciplina. Desempates por paso 5 FIFA son manuales.
- **Latencia ~1 día**: openfootball se actualiza por contribuciones humanas, no en tiempo real.
- **Sin retry network**: si la URL no responde, el script termina con exit code 1 y el cron registra el fallo. El siguiente día reintenta.
