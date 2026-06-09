# 0004 — Mejores terceros: tabla, no derivación algorítmica

**Fecha**: 2026-06-09
**Estado**: aceptada

## Contexto

En el Mundial 2026 (48 equipos, 12 grupos), los 8 mejores terceros pasan a 1/16 de final. Qué tercero juega contra qué primero de grupo depende de **qué 8 de los 12 grupos** aportan tercero clasificado. Hay C(12,8) = 495 combinaciones posibles.

Cada slot de 1/16 tiene un conjunto de elegibilidad (los `away_slot_ref` tipo `3ABCDF` del seed): "el tercero de uno de los grupos A, B, C, D o F". Al implementar el resolver (`resolveBestThirds`), surgió la pregunta de si el reparto se podía **derivar algorítmicamente** desde esas reglas de elegibilidad, en lugar de depender de una tabla hardcodeada (`BEST_THIRDS_MAPPING`, generada en slice 1 desde el Excel oficial de referencia).

## Hallazgo determinante

El reparto está **subdeterminado** por las reglas de elegibilidad. Verificado empíricamente sobre las 495 combinaciones:

- Cada combinación admite entre **3 y 214 emparejamientos legales**.
- **Cero** combinaciones tienen solución única.

FIFA elige UN emparejamiento específico por combinación, publicado de antemano, por criterios que NO están contenidos en las reglas de elegibilidad. Ese conjunto de elecciones es lo que encoda el Excel oficial → `BEST_THIRDS_MAPPING`.

## Decisión

`resolveBestThirds` usa **lookup de la tabla `BEST_THIRDS_MAPPING`** como única fuente de verdad. No se deriva algorítmicamente.

Se mantiene un **test de validación de restricciones** permanente (`resolve-best-thirds.test.ts`) que verifica que cada fila de la tabla es un emparejamiento **legal** según los conjuntos de elegibilidad del seed (cada tercero asignado a un slot cuyo conjunto incluye su grupo, sin permutaciones inválidas). Verificado: 0 violaciones de elegibilidad, 0 fallos de permutación sobre las 495.

## Consecuencias

**Ganamos**:
- Corrección por construcción: reproduce el reparto oficial de FIFA, que ningún algoritmo puede derivar.
- O(1) lookup + O(8) asignación. Trivial y rápido.
- Código legible.
- El validador de restricciones protege contra ediciones futuras que introduzcan un emparejamiento ilegal en la tabla.

**Perdemos / límites**:
- El validador de restricciones comprueba **legalidad**, no **identidad con el reparto oficial de FIFA**. Si el Excel encodeó un emparejamiento legal-pero-distinto-del-oficial en alguna fila, el test lo da por bueno.
- Mitigación (operacional, no de código): en la realidad solo se ejecuta UNA de las 495 filas. Tras la fase de grupos (~27 jun 2026), cuando FIFA fije qué 8 terceros clasifican y publique el cuadro de 1/16, el admin compara el reparto resuelto contra el cuadro oficial ANTES de puntuar los 1/16. Esa es la garantía de corrección real, dirigida al único caso que importa. Registrado como tarea con fecha en `TODO.md`.

## Alternativas consideradas

- **B — Derivación posicional algorítmica**: reconstruir el reparto desde las reglas de elegibilidad sin tabla. Rechazado como generador: produce un emparejamiento legal pero arbitrario; coincide con FIFA solo por azar. Depende del criterio de desempate elegido (no determinista respecto al oficial). Sirve solo como **validador**, no como fuente.
- **C — Búsqueda exhaustiva / constraint solver**: enumera todos los emparejamientos válidos (3–214 por combinación). No puede señalar cuál es el oficial. Rechazado como generador por la misma razón; útil solo para verificar legalidad.
- **Lanzar workflow ultracode de 3 enfoques en paralelo**: descartado. El reparto es un hecho combinatorio determinista; el análisis estático zanja la cuestión con más autoridad y a coste cero frente a 3 agentes LLM. Aplicación directa del principio de coste del playbook (§6).

## Nota de implementación

`TeamCode` no existe como tipo en el repo; los códigos de equipo son `string` en todo el código. `resolveBestThirds` usa `string` por consistencia con la convención existente. Si en el futuro se introduce un alias `type TeamCode = string` (o un branded type), actualizar la firma entonces.
