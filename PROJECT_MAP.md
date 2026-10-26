# PROJECT_MAP — TaskQuest
_Última actualización: 2026-10-26_

## Qué es
Gestor de tareas personal con gamificación (XP, niveles, misiones diarias, logros, rachas). Proyecto de portafolio.

## Stack
Next.js 16.2.9 full-stack (App Router, React Compiler activo) · React 19.2.4 · TypeScript `strict` ·
Tailwind v4 (config CSS-first en `globals.css`) · shadcn/ui estilo `base-lyra` (Base UI, iconos Phosphor) + Lucide en componentes propios ·
Prisma 7.8 + `@prisma/adapter-pg` · NextAuth v4 · PostgreSQL (local).
No instalados aún: Motion, Sonner, zod, framework de tests.

> Excepción al stack base global: NO hay `frontend/` + `backend/` Laravel. Todo vive en Next.js (decisión del usuario, 2026-10-23).

## Comandos
| Comando | Para qué |
|---|---|
| `pnpm install` | Instala y ejecuta `prisma generate` (postinstall) |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Regenera el cliente Prisma en `src/generated/prisma` |
| `pnpm db:migrate` | `prisma migrate dev` (requiere `.env` con `DATABASE_URL`) |
| `pnpm db:studio` | Prisma Studio |

Gestor único: **pnpm** (`pnpm-lock.yaml`). `pnpm-workspace.yaml` → `allowBuilds` aprueba scripts de `@prisma/engines`, `prisma`, `sharp`, `unrs-resolver`.

## Estructura
```
src/app/layout.tsx          layout raíz (fuentes, metadata aún por defecto)
src/app/page.tsx            dashboard "/" con datos hardcodeados
src/app/globals.css         Tailwind v4 + tokens shadcn (tema claro; .dark no se aplica)
src/app/auth/login.tsx      VACÍO (0 bytes) — no es ruta; debe ser auth/login/page.tsx
src/app/auth/register.tsx   VACÍO (0 bytes) — idem
src/app/constants/taskDifficulty.tsx  tipo Difficulty + DifficultyStyles (color, badge, icono Lucide)
src/components/ui/          shadcn: avatar, badge, button, card, checkbox, dropdown-menu, input, progress, sheet
src/components/layout/      DashboardLayout, AppSidebar (menú sin navegación), AppNavbar
src/components/dashboard/   StatsCard, xpHeroCard (XP/nivel fijos)
src/components/task/        TaskList (array estático), TaskCard
src/lib/utils.ts            cn()
src/lib/prisma.ts           PrismaClient singleton con adapter pg
src/generated/prisma/       cliente Prisma generado (gitignored, no editar)
prisma/schema.prisma        User, Task, enums Difficulty/TaskStatus
prisma/migrations/          20261026154201_init (User, Task, enums)
prisma/seed.ts              VACÍO
prisma.config.ts            config Prisma 7 (schema, migrations, datasource url)
.env.example                variables requeridas (sin valores reales)
```

## Dónde está cada cosa
| Necesito... | Archivo |
|---|---|
| Tokens de color / tipografía | `src/app/globals.css`, fuentes en `src/app/layout.tsx` |
| Componentes shadcn | `src/components/ui/` (config en `components.json`) |
| Estilos por dificultad | `src/app/constants/taskDifficulty.tsx` |
| Lógica de XP / nivel | `src/components/dashboard/xpHeroCard.tsx` (solo visual) |
| Autenticación | — (pendiente, NextAuth v4) |
| Esquema de BD | `prisma/schema.prisma` |
| Cliente de BD | `import { prisma } from "@/lib/prisma"` |
| Server Actions / Route Handlers | — (no existen) |

## Rutas
| Ruta | Archivo | Estado |
|---|---|---|
| `/` | `src/app/page.tsx` | UI estática |

Menú lateral (sin página): Misiones, Logros, Calendario, Estadísticas, Historial.

## API / Server Actions
Ninguna todavía.

## Base de datos
PostgreSQL 16 local (servicio Windows `postgresql-x64-16`, puerto 5432), base `taskquest`.
Migraciones aplicadas: `20261026154201_init`.
| Modelo | Campos clave | Notas |
|---|---|---|
| User | id (cuid), name, email (unique), passwordHash, xp (0), level (1) | Para NextAuth Credentials + JWT |
| Task | id, title, description?, difficulty, xpReward, status, dueDate?, completedAt?, userId | FK a User con cascade; índice (userId, status) |

Enums: `Difficulty` EASY/MEDIUM/HARD/EPIC (UI: Fácil/Media/Difícil/Épica) · `TaskStatus` PENDING/COMPLETED.
Previstas: Achievement, UserAchievement, DailyMission.

## Variables de entorno
Plantilla en `.env.example` (copiar a `.env`):
- `DATABASE_URL` — conexión PostgreSQL
- `NEXTAUTH_URL` — URL base de la app
- `NEXTAUTH_SECRET` — secreto de sesión

## Convenciones
- Componentes con `export default`, props tipadas con `interface`.
- UI en español; código en inglés. Dificultades: `Fácil | Media | Difícil | Épica`.
- Estilos con clases `slate-*` directas (pendiente migrar a tokens).

## Decisiones y por qué
- 2026-10-23: Mantener Next.js full-stack + Prisma (lo existente) en vez del monorepo Laravel; el backend estaba vacío y es coherente para portafolio.
- 2026-10-23: Auth con NextAuth v4 (ya instalado).
- 2026-10-23: PostgreSQL local.
- 2026-10-23: pnpm como único gestor; eliminado `package-lock.json`.
- 2026-10-23: Cliente Prisma con generator `prisma-client` en `src/generated/prisma` (no en node_modules). `prisma.config.ts` usa `process.env.DATABASE_URL` en vez de `env()` para que `prisma generate` funcione sin `.env`.
- 2026-10-23: Sin tablas de adapter de NextAuth: se usará Credentials + estrategia JWT. Si luego se añade OAuth, agregar Account/Session/VerificationToken.
- 2026-10-23: Enums de BD en inglés; mapeo a etiquetas en español en la UI.

## Pendientes / deuda técnica
Prioridad 1 — entorno
- [x] Build roto en `TaskCard.tsx` (import inexistente) y lógica de dificultad duplicada.
- [x] Gestor único pnpm.
- [x] `.env.example`, `prisma.config.ts`, esquema Prisma, `src/lib/prisma.ts`.
- [x] `.env` local creado y primera migración `init` aplicada.
- [ ] Mapeo Difficulty enum (EASY…) ↔ etiqueta UI (Fácil…) cuando se conecten datos reales.
- [x] Git: remoto `origin` = github.com/AldairGarciaM/TaskQuest. Trabajo en ramas; el usuario revisa y fusiona (no abrir/fusionar PRs ni hacer `git pull` sin su visto bueno).

Prioridad 2 — funcionalidad
- [ ] Auth (NextAuth v4): páginas `auth/login/page.tsx`, `auth/register/page.tsx`, protección de rutas.
- [ ] CRUD de tareas con Server Actions + validación en servidor.
- [ ] XP y nivel calculados en servidor al completar tareas.
- [ ] Dashboard con datos reales + estados de carga/vacío/error.
- [ ] Misiones diarias, racha, logros, calendario, estadísticas, historial.

Prioridad 3 — UX
- [ ] Sidebar responsive (usar `Sheet`), navegación con `<Link>`.
- [ ] Tema oscuro coherente con tokens; una sola librería de iconos.
- [ ] `aria-label` en botones de icono; metadata y `lang="es"`; quitar fuentes sin uso.
- [ ] Motion (con `useReducedMotion`) y Sonner.

Prioridad 4 — estabilidad
- [ ] Tests (lógica de XP/nivel, actions, e2e del flujo principal).

## Historial
- 2026-10-23: Auditoría inicial del proyecto retomado y creación de este mapa.
- 2026-10-26: Remoto GitHub configurado; Fase 1 subida en rama `chore/phase-1-setup`. Rama `feat/database`: `.env` local + migración `init` aplicada (tablas User, Task).
- 2026-10-23: Fase 1 — build arreglado (TaskCard usa DifficultyStyles), pnpm único, Prisma 7 configurado (schema User/Task, config, cliente singleton), `.env.example`, scripts db:*.
