# 🔧 INSTRUCCIONES PARA COMPLETAR LA MODULARIZACIÓN DE AXON MIND

## Contexto
Axon Mind es una app de productividad personal (Vanilla JS + Vite + Supabase). El archivo `main.js` tiene ~5,645 líneas y ya se extrajeron 10 módulos en `src/modules/`. **La app sigue corriendo con el main.js original — los módulos son copias listas para activar.**

## Estado Actual
- ✅ `src/modules/config.js` — Supabase client, helpers, toast, confetti, audio
- ✅ `src/modules/timer.js` — Pomodoro, background execution, wake lock
- ✅ `src/modules/tasks.js` — CRUD tareas, filtros, categorías, interrogatorio
- ✅ `src/modules/cards.js` — Flashcards SRS, carpetas, gamificación XP
- ✅ `src/modules/finance.js` — Transacciones, presupuestos, metas de ahorro
- ✅ `src/modules/polyglot.js` — Hub de idiomas, TTS, quiz
- ✅ `src/modules/planner.js` — Rutinas, semana, Google Calendar, plantillas
- ✅ `src/modules/vault.js` — Cerebro/Vault, Inbox, navegación, templates
- ✅ `src/modules/journal.js` — Diario de pareja, check-ins
- ✅ `src/modules/water.js` — Tracker de agua
- ⬜ `main.js` — AÚN NO SE HA TOCADO. Sigue siendo el monolito original.

## Lo Que Falta Hacer

### Paso 1: Resolver dependencias circulares
Hay ~50 llamadas cruzadas entre módulos. La solución es:
- Cada módulo registra sus funciones públicas en `window.*` dentro de su `init()`
- Las llamadas cruzadas entre módulos deben usar `window.fetchTasks()` en vez de `fetchTasks()` directamente
- Esto rompe el ciclo de dependencias

**Módulos con dependencias cruzadas principales:**
- `tasks.js` llama a `fetchInbox()`, `fetchVaultDocs()`, `renderVault()`, `renderInbox()` (de vault.js)
- `vault.js` llama a `fetchTasks()` (de tasks.js)
- `planner.js` llama a `renderRoutines()`, `renderPlanner()` internamente
- `journal.js` llama a `showMultipotentialSummary()` (de tasks.js)

### Paso 2: Crear el nuevo main.js orquestador
El nuevo `main.js` debe:
1. Importar `config.js` (ejecuta supabase init, theme, helpers)
2. Importar e inicializar cada módulo en orden
3. Configurar el tab routing (viewBtns)
4. Configurar DOMContentLoaded

Ejemplo de estructura:
```javascript
// main.js (orquestador ~300 líneas)
import { supabase, $, initIcons, showToast } from './src/modules/config.js';
import { initTimer } from './src/modules/timer.js';
import { initTasks } from './src/modules/tasks.js';
import { initCards } from './src/modules/cards.js';
import { initFinance } from './src/modules/finance.js';
import { initPolyglot } from './src/modules/polyglot.js';
import { initPlanner } from './src/modules/planner.js';
import { initVault } from './src/modules/vault.js';
import { initJournal } from './src/modules/journal.js';
import { initWater } from './src/modules/water.js';

// Init modules (order matters — config is already executed by import)
const timer = initTimer();
const vault = initVault({ fetchTasks: () => window.fetchTasks?.() });
const tasks = initTasks({ fetchInbox: () => window.fetchInbox?.() });
const cards = initCards();
const finance = initFinance();
const polyglot = initPolyglot();
const planner = initPlanner();
const journal = initJournal({ showMultipotentialSummary: () => window.showMultipotentialSummary?.() });
const water = initWater();

// Tab routing
const viewBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');
viewBtns.forEach(btn => { ... }); // copiar lógica de routing actual

// DOMContentLoaded — copiar el bloque actual
```

### Paso 3: Verificación
Después de cada cambio, verificar:
- [ ] `npm run dev` arranca sin errores
- [ ] Abrir en navegador, verificar consola sin errores
- [ ] Crear tarea → aparece en Supabase
- [ ] Completar tarea → confetti, categoría abierta
- [ ] Crear transacción financiera
- [ ] Asistente IA financiero responde
- [ ] Flashcards carpetas funcionan
- [ ] Timer Pomodoro corre
- [ ] `npm run build` produce bundle limpio

### Paso 4: Si algo falla
El `main.js` original está en el historial de git. Para restaurar:
```bash
git checkout HEAD~1 -- main.js
```

## Tablas de Supabase (NO TOCAR)
- `tasks` — Proyectos/tareas (tiene columna `category`)
- `finance_transactions` — Gastos e ingresos
- `finance_categories` — Categorías financieras
- `finance_budgets` — Presupuestos mensuales
- `finance_savings_goals` — Metas de ahorro
- `finance_savings_movements` — Movimientos de ahorro
- `flashcards` — Tarjetas SRS
- `vault_docs` — Documentos del Cerebro
- `inbox` — Bandeja de entrada rápida
- `pomodoro_sessions` — Sesiones de trabajo
- `journal_entries` — Diario de pareja
- `weekly_templates` — Plantillas semanales
- `polyglot_phrases` — Frases de idiomas
- `polyglot_alphabets` — Alfabetos
- `polyglot_config` — Configuración de idiomas

## URLs de Webhooks n8n (NO CAMBIAR)
- Pomodoro Sync: `https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/pomodoro-sync`
- Axon Architect: `https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-architect`
- Axon Slicer: `https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-slicer`
- Polyglot Translate: `https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/polyglot-translate`
- Finance Assistant: `https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-finance`

## Supabase Project
- Project ID: `blwaxxacneipoaufpiag`
- URL: `https://blwaxxacneipoaufpiag.supabase.co`

## Reglas de Oro
1. **NUNCA romper lo que funciona.** Si algo falla, revertir inmediatamente.
2. **Probar después de CADA módulo.** No hacer todos de golpe.
3. **Las funciones en `window.*` son sagradas.** El `index.html` las usa directamente.
4. **El encoding UTF-8 es crítico.** Los emojis en el código deben preservarse.
5. **Hacer commit después de cada módulo exitoso.**
