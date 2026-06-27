# DESIGN_SYSTEM.md — Barber Booking Admin Panel

> Sistema visual unificado para `admin.js`. Documento generado tras audit + 5 fases de pulido.
> Fecha: 2026-06-26 | Archivo: `admin.js` (~4545 líneas)

---

## Paleta de colores (no modificada)

| Token | Hex | Uso |
|---|---|---|
| `propio-500` | `#20B29C` | Acciones primarias, links, acentos |
| `propio-600` | `#1a9a86` | Hover de acciones primarias |
| `propio-50` | `#e8f8f4` | Fondos suaves, badges |
| `dark-500` | `#2F3542` | Fondos oscuros, bottom nav activa |
| `stone-200` | `#e7e5e4` | Bordes de cards e inputs |
| `stone-500` | `#78716c` | Labels, texto secondary |
| `stone-800` | `#292524` | Títulos, texto principal |
| `ivory` | `#F6F3EE` | Fondo de la app |
| `emerald-600` | `#059669` | Acciones positivas (completar) |
| `red-600` | `#dc2626` | Acciones destructivas (cancelar) |

---

## Tipografía

### Escala de texto

| Rol | Clases canónicas | Uso |
|---|---|---|
| **Título de página h2** | `font-semibold text-lg text-stone-800` | Dashboard, Upcoming, Clients, DashboardDetail |
| **Título de modal h3** | `font-bold text-base text-stone-800` | DetailModal, CreateBooking, Seasons, Blocks |
| **Header de panel h3** | `font-bold text-sm text-stone-700` | Settings (horarios, festivos, bloques) |
| **Section header uppercase** | `text-[10px] font-bold uppercase tracking-wider text-stone-500` | Labels de sección, categorías |
| **Body text** | `text-sm text-stone-800` | Texto principal en cards |
| **Label de input** | `text-sm font-semibold text-stone-600 mb-2.5` o `text-xs font-semibold text-stone-500 ml-1` | Form labels |
| **Caption/metadata** | `text-xs text-stone-500` | Info secundaria, timestamps |
| **Micro-label** | `text-[10px] text-stone-400` | Unidades, counters |
| **Badge "NUEVO"** | `text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0` | Primera visita |

### Pesos de fuente

| Peso | Uso |
|---|---|
| `font-semibold` | Títulos de página, labels |
| `font-bold` | Títulos de modal, section headers, botones, badges |
| `font-extrabold` | Números grandes en KPIs, stats |

---

## Cards y contenedores

### Radius

| Elemento | Radius | Uso |
|---|---|---|
| **Cards principales** | `rounded-2xl` | KpiCard, StatCard, Dashboard cards, modales centrados |
| **Inputs y buttons pequeños** | `rounded-xl` | Inputs, buttons normales, error boxes |
| **Modales bottom-sheet** | `rounded-t-3xl sm:rounded-3xl` | CreateBooking, Seasons, Blocks |
| **Pills y badges** | `rounded-full` | Filter pills, badges, FAB, toggles |
| **Inner buttons** | `rounded-lg` | Action buttons dentro de cards, time labels |

### Bordes

| Patrón | Uso |
|---|---|
| `border border-stone-200` | Bordes estándar de cards e inputs (sin opacidad) |
| `border border-stone-200/50` | DayView container (única excepción) |
| `border border-dark-600` | Cards oscuras (Dashboard next-appt) |

### Sombras

| Nivel | Clase | Uso |
|---|---|---|
| Sutil | `shadow-sm` | Cards estándar, KpiCard |
| Medio | `shadow-md` | Header, Dashboard dark card, Toast |
| Fuerte | `shadow-lg` | Botones primarios grandes, FAB |
| Modal | `shadow-xl` | Diálogos centrados |
| Slide-over | `shadow-2xl` | DashboardDetail panel |

---

## Espaciado

### Inputs

| Prop | Valor estándar |
|---|---|
| Padding | `px-3 py-2.5` |
| Radius | `rounded-xl` |
| Background | `bg-white` |
| Border | `border border-stone-200` |
| Focus | `focus:border-propio-500 focus:ring-1 focus:ring-propio-500/20` |
| Excepción | Search input mantiene `pl-9` por icono |

### Labels

| Contexto | Clase |
|---|---|
| CreateBooking / Settings | `text-xs font-semibold text-stone-500 ml-1` |
| LoginForm | `text-sm font-semibold text-stone-600 mb-2.5` |

---

## Botones

### Variantes

| Tipo | Padding | Radius | Ejemplos |
|---|---|---|---|
| **Primario grande** | `py-3` | `rounded-2xl` | CreateBooking continue/submit, Seasons/Blocks save |
| **Primario normal** | `py-2.5` | `rounded-xl` | ClientCRM save, Delete confirm |
| **Primario compacto** | `py-2.5 px-3` | `rounded-xl` | Holidays add, Blocks add |
| **Login submit** | `py-3` | `rounded-xl` | LoginForm submit |

### Estados interactivos (estándar)

Todo botón debe tener:
- `cursor-pointer`
- `transition` o `transition-colors`
- `hover:` state (ej: `hover:bg-propio-600`)
- `active:scale-[0.98]` (única escala unificada)

### Hover por color

| BG color | Hover |
|---|---|
| `bg-propio-500` | `hover:bg-propio-600` |
| `bg-emerald-600` | `hover:bg-emerald-700` |
| `bg-red-600` | `hover:bg-red-700` |
| `bg-red-500` | `hover:bg-red-600` |

---

## Iconos

### Componentes SVG reutilizables

| Componente | Default size | Acepta prop |
|---|---|---|
| `SvgCalendar` | `w-5 h-5` | No |
| `SvgList` | `w-5 h-5` | No |
| `SvgUsers` | `w-5 h-5` | No |
| `SvgDashboard` | `w-5 h-5` | No |
| `SvgSettings` | `w-5 h-5` | No |
| `SvgLogout` | `w-4 h-4` | No |
| `SvgBell` | `w-5 h-5` | No |
| `SvgCheck` | `w-4 h-4` | No |
| `SvgPlus` | `w-6 h-6` | `className` (override size) |
| `SvgArrowLeft` | `w-5 h-5` | No |
| `SvgArrowRight` | `w-5 h-5` | No |
| `SvgWhatsApp` | `w-5 h-5` | `className` (override size) |
| `SvgClose` | `w-4 h-4` | No |
| `SvgRefresh` | `w-4 h-4` | No |
| `SvgSoundOn` | `w-4 h-4` | No |
| `SvgSoundOff` | `w-4 h-4` | No |
| `EyeSvg` | `size: 24` | `size` (numeric) |
| `EyeOffSvg` | `size: 24` | `size` (numeric) |

### Reglas
- Todos SVGs usan `viewBox: '0 0 24 24'`
- Stroke width estándar: `2` (utility icons) o `2.5` (action icons: Check, Plus, Arrow)
- `SvgWhatsApp` usa `fill: 'currentColor'` (hereda color del padre)
- NO usar emojis como iconos en producción

---

## Empty states

### Patrón estándar

Usar componente `EmptyState` con:
- `title`: `font-bold text-stone-700`
- `sub`: `text-sm text-stone-400 mt-1`
- Container: `text-center py-12 px-4`

### Inline alternativo

Para espacios reducidos dentro de cards:
- `text-sm text-stone-400 text-center py-4`

### Reglas
- NO usar emojis en empty states
- Toda lista debe tener un estado vacío visible
- Los empty states deben incluir `t()` para i18n cuando sea posible

---

## Error states

### Error box estándar

```
bg-red-50 border border-red-200 text-red-700 rounded-xl p-3
```

### Warning box (ámbar)

```
text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2
```

### Validation chip (inline)

```
text-xs text-red-600 font-semibold mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2
```

---

## Resumen de cambios aplicados

| Fase | Descripción | Cambios | QA |
|---|---|---|---|
| A | Quick wins (badge, cursor, transition, SVG dedup) | 22 | PASS |
| B | Tokens tipográficos (h2, h3, section headers, chart labels) | 18 | PASS |
| C | Componentes base (inputs, labels, buttons, hover, active:scale) | 73 | PASS |
| D | Cards y contenedores (radius, border opacity, shadows) | 16 | PASS |
| E | Empty states y errores (emoji removal, error boxes, breakdown) | 9 | PASS |
| **Total** | | **138** | **5/5 PASS** |

### Decisiones que se apartaron del plan

1. **SvgWhatsApp fill**: Cambiado de `fill: '#25D366'` (brand green fijo) a `fill: 'currentColor'` (hereda del padre). Permite reutilización en contextos con diferentes colores de texto. Impacto visual mínimo (verde brand ≈ emerald-500).

2. **CRM stat labels (text-[9px])**: Las etiquetas de stats en ClientCRM (`text-[9px] font-bold text-stone-500 uppercase tracking-wider`) se mantuvieron en `text-[9px]` por ser un tier visual distinto (labels compactos inline, no section headers).

3. **Holidays inline add button (py-2)**: Se mantuvo en `py-2` (no `py-2.5`) porque está emparejado con un input `py-2` en la misma fila flex. Subir a `py-2.5` desalinearía el botón con su input.

4. **Login inputs bg**: Cambiado de `bg-stone-50` a `bg-white` para uniformidad con el resto de inputs del sistema.

---

## Mantenimiento

Al añadir nuevos componentes a `admin.js`, seguir estos patrones:
- Usar las clases canónicas de esta guía
- NO introducir nuevos `text-[Npx]` arbitrarios — usar la escala Tailwind o los valores documentados
- TODO botón debe tener: `cursor-pointer` + `transition` + `hover:` + `active:scale-[0.98]`
- Reutilizar componentes SVG existentes en vez de inlinear nuevos
- Empty states SIEMPRE con texto, nunca con emojis
