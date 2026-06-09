# design-system.md — Porra Mundial 2026

**Dirección**: "Álbum de cromos" — la nostalgia del álbum del Mundial, coleccionable y divertida, para un grupo de amigos. Modo claro y oscuro con toggle.

**Tesis**: la pantalla-héroe es la **clasificación**, presentada como una página de álbum donde cada jugador es un cromo. El elemento firma es el **cromo foil (holográfico)**, reservado para el #1 y para las predicciones de campeón. Toda la audacia se gasta ahí; el resto, disciplinado.

**Mapeo con la lógica ya construida**:
- Predicción rellenada = cromo colocado (carta a color).
- Predicción vacía = hueco del álbum (slot con borde discontinuo y un "?" tenue).
- Porra incompleta = álbum con huecos; el indicador del slice 4.8 dice "te faltan N cromos".
- Porra completa = "¡álbum lleno!".
- #1 de la clasificación y predicción de campeón = cromo foil (el shiny raro).

---

## 1. Color

Acentos de marca (mismo hue en ambos modos, ajustando luminancia):

| Token | Hex | Uso |
|---|---|---|
| `--cromo-cobalt` | `#2347E8` | Color de marca primario (CTAs, enlaces, acento del cromo) |
| `--cromo-coral` | `#FF5A47` | Pop de energía (destacados, badges "nuevo", estados de atención) |
| `--cromo-gold` | `#E8B445` | Base del foil dorado (shinies) |
| `--cromo-mint` | `#27C29A` | Éxito / "cromo conseguido" / completitud |

**Foil holográfico** (el elemento firma, es un gradiente, no un color plano):

```css
--foil: conic-gradient(from 210deg at 50% 50%,
  #E8B445, #FF5A47, #2347E8, #27C29A, #E8B445);
/* aplicado con background-clip + opacidad baja sobre la carta, o como borde 
   animado que se desplaza en hover/tilt */
```

### Modo claro ("álbum a la luz del día")

| Token | Hex | Nota |
|---|---|---|
| `--bg` | `#EEF0E9` | Página del álbum: papel cálido-frío con un punto verde-grisáceo (guiño al césped). **Deliberadamente NO `#F4F1EA`** (el cream cliché). |
| `--surface` | `#FFFFFF` | Cara del cromo: más brillante que la página |
| `--slot` | `#D8DAD0` | Borde del hueco vacío |
| `--ink` | `#1A1C2B` | Texto principal (casi negro con tinte azul) |
| `--muted` | `#6B6E7D` | Texto secundario |

Contraste `--ink` sobre `--surface`: ~15:1 (AAA). Sobre `--bg`: ~13:1 (AAA).

### Modo oscuro ("álbum bajo la lámpara de noche")

| Token | Hex | Nota |
|---|---|---|
| `--bg` | `#14151C` | Tinta profunda con tinte azul |
| `--surface` | `#1E2029` | Cromo elevado |
| `--slot` | `#2A2C38` | Hueco vacío |
| `--ink` | `#F2F2EC` | Texto papel-blanco |
| `--muted` | `#9A9DAB` | Secundario |

En oscuro, subir los acentos un punto de luminancia para contraste: cobalt `#4D6BFF`, coral `#FF6E5C`, gold `#F0C25E`, mint `#3DD6AC`. Contraste de acentos sobre `--surface` ≥ 4.5:1 para texto, ≥ 3:1 para elementos gráficos.

---

## 2. Tipografía

Tres roles. Solo una fuente nueva que cargar (las otras dos vienen de create-next-app).

| Rol | Fuente | Uso |
|---|---|---|
| **Display** | **Clash Display** (Fontshare, gratis, self-host) | Titulares, el #1 del ranking, número del cromo. Bold/Semibold. Carácter pero con restricción. |
| **Body** | **Geist Sans** (ya cargada) | Todo el texto corrido, labels, botones |
| **Datos** | **Geist Mono** (ya cargada) | Puntos, marcadores, números tabulares del leaderboard (tabular-nums) |

Alternativa si no quieres self-hostar: **Bricolage Grotesque** (Google Fonts, trivial con `next/font/google`) como display. Tiene carácter parecido. Clash Display da más "wow"; Bricolage es 0 fricción.

**Escala de tipo** (móvil → desktop):
- Display XL (el #1, hero): 40 / 56 px, Clash Display Bold
- Display L (títulos de sección): 28 / 36 px, Clash Display Semibold
- Body: 16 px, Geist Sans
- Caption / eyebrow: 13 px, Geist Sans, tracking +0.04em, uppercase
- Dato grande (puntos): 24–32 px, Geist Mono, tabular-nums
- Número de cromo (esquina de la carta): Clash Display Bold

---

## 3. Layout y wireframes

### Clasificación (hero) — móvil

```
┌─────────────────────────────────────┐
│ CLASIFICACIÓN          [☀/🌙]  [≡]  │  Clash Display L
│ Jornada 3 · 21 cromos colocados     │  eyebrow, muted
├─────────────────────────────────────┤
│ ╔═══════════════════════════════╗   │
│ ║ ✦1   [···foil holográfico···] ║   │  #1 = cromo FOIL, ancho completo
│ ║      CARLOS "elcura"     287   ║   │  nick Clash, puntos Mono
│ ╚═══════════════════════════════╝   │
│ ┌──────────────┐ ┌──────────────┐   │  resto = cuadrícula de cromos 2-col
│ │ 2  [avatar]  │ │ 3  [avatar]  │   │
│ │ nick     241 │ │ nick     230 │   │
│ └──────────────┘ └──────────────┘   │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ 4            │ │ 5            │   │
│ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────┘
```

El #1 ocupa todo el ancho y lleva el foil. Del 2 en adelante, cuadrícula de cromos normales. Es jerarquía real (la posición importa), no decoración.

### Tu porra (incompleta) — la metáfora del álbum con huecos

```
┌─────────────────────────────────────┐
│ TU PORRA                te faltan 5  │
│ ▓▓▓▓▓▓▓▓▓░  82% del álbum            │  barra = álbum lleno, mint
├─────────────────────────────────────┤
│ Grupo A                              │  Clash Display
│ ┌────┐ ┌────┐ ┌────┐ ┌╌╌╌╌┐          │  cromo puesto vs slot vacío
│ │2-1 │ │0-0 │ │3-1 │ ╎ ?  ╎          │  slot: borde discontinuo --slot
│ └────┘ └────┘ └────┘ └╌╌╌╌┘          │
└─────────────────────────────────────┘
```

---

## 4. Elemento firma: el cromo foil

El **foil holográfico** es lo único memorable; todo lo demás calla.

- Se reserva para: el **#1 del ranking** y la predicción de **campeón** en el podio. Nada más. Si todo brilla, nada brilla.
- Implementación: borde o capa con el gradiente `--foil` que se **desplaza suavemente en hover** (desktop) o con **device-tilt / al entrar en viewport** (móvil), imitando cómo un cromo foil refleja la luz al moverlo.
- En `prefers-reduced-motion`: el foil se queda estático (gradiente fijo, sin animación). Nunca se elimina del todo — sigue siendo el shiny — pero no se mueve.

**El riesgo estético deliberado**: un holográfico puede quedar hortera si se abusa. Se justifica porque el foil ES el cromo icónico del álbum, y reservarlo al #1 hace la clasificación aspiracional ("quiero ser el cromo brillante"). Disciplina = exclusividad.

---

## 5. Componentes (cómo se tematiza shadcn)

shadcn sigue las variables CSS. Mapea los tokens a `globals.css` (`:root` y `.dark`) y deja que los componentes hereden.

- **Card → Cromo**: `--surface`, radio 14px, sombra suave + un borde de 1px `--slot`. En hover, micro-elevación. El cromo del #1 es la variante foil.
- **Empty slot**: card con borde discontinuo `--slot`, fondo `--bg`, un "?" en `--muted`. Es el estado vacío de cualquier predicción.
- **Button primary**: `--cromo-cobalt`, texto blanco, radio 10px, peso medio. Hover: oscurece 8%.
- **Input (marcadores)**: fondo `--surface`, borde `--slot`, focus ring `--cromo-cobalt` 2px (visible siempre — quality floor).
- **Badge "te faltan N" / sticky footer**: `--cromo-coral` si faltan cromos, `--cromo-mint` si álbum completo, ámbar si REVISAR (reusa la lógica de estados de 4.8).
- **Progress (% álbum)**: relleno `--cromo-mint`.
- **Toggle claro/oscuro**: en el header, icono sol/luna. Persiste preferencia (sin localStorage en artifacts, pero en su app Next sí: cookie o `next-themes`).

---

## 6. Motion (con restricción)

- **Colocar cromo** (al guardar una predicción): la carta hace un "settle" rápido (scale 0.96 → 1 + leve sombra) en ~180ms. Es el feedback de "pegado".
- **Foil del #1**: desplazamiento lento del gradiente, loop suave.
- **Cambio de posición en el ranking** (tras recálculo): transición de orden con FLIP, las cartas se reordenan deslizándose, no saltando.
- Todo lo demás: quieto. Nada de fades porque sí.
- `prefers-reduced-motion`: desactiva settle y FLIP, foil estático.

---

## 7. Voz y copy (vernáculo de álbum)

El copy es material de diseño. Usa el mundo del álbum sin forzarlo:

- "Te faltan 5 cromos" en lugar de "5 predicciones incompletas".
- "¡Álbum completo!" cuando la porra está lista.
- "Coloca tu predicción" / "Cromo colocado" (la acción mantiene el nombre: el botón dice "Colocar", el toast dice "Colocado").
- Estados vacíos como invitación: "Aún no has abierto ningún sobre. Empieza por el Grupo A."
- Errores en la voz de la interfaz, sin disculpas: "Ese cromo ya está en tu álbum" (equipo duplicado).
- Sentence case en todo, verbos en activa.

---

## 8. Quality floor (no negociable)

- Responsive hasta 320px sin scroll horizontal roto.
- Focus de teclado visible en todo (ring `--cromo-cobalt` 2px).
- Contraste AA mínimo en ambos modos (los pares de §1 ya lo cumplen).
- `prefers-reduced-motion` respetado.
- Áreas táctiles ≥44px (cierra de paso el MENOR-4 del informe de ultracode 4.9).
- El toggle de tema no provoca flash (FOUC): resolver el tema antes del paint (`next-themes` con `suppressHydrationWarning` en `<html>` — y ojo, ese es el uso legítimo del `suppressHydrationWarning`, no para tapar bugs).

---

## 9. Crítica contra defaults (la segunda pasada)

Revisado contra los 3 clichés de diseño IA:

- ❌ Cream + serif + terracota: evitado. El claro es `#EEF0E9` (papel verde-grisáceo, no cream), la display es una grotesque redondeada (no serif), no hay terracota.
- ❌ Negro + verde-ácido único: el oscuro tiene 4 acentos atados al tema (cobalto, coral, oro foil, mint), no un único acid-green decorativo.
- ❌ Broadsheet con líneas finas: nada de eso; es card-based y táctil.

Los números de posición del ranking SÍ se usan, pero porque la clasificación **es** una secuencia ordenada real (la regla del skill lo permite cuando el orden codifica información), no como decoración 01/02/03.

**Riesgo asumido**: el foil holográfico. Justificado y contenido al #1 y al campeón.

---

## 10. Versionado

Este documento es **v1.0**. Cambios de paleta o tipografía bumpean versión. Si algún token no funciona al construir (contraste real, render de Clash Display), se ajusta aquí primero y se anota.
