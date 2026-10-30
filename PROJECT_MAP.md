# PROJECT_MAP — TaskQuest
_Última actualización: 2026-10-29_

## Qué es
Gestor de tareas personal con gamificación (XP, niveles, misiones diarias, logros, rachas). Proyecto de portafolio.

## Stack
Next.js 16.2.9 full-stack (App Router, React Compiler activo) · React 19.2.4 · TypeScript `strict` ·
Tailwind v4 (config CSS-first en `globals.css`) · shadcn/ui estilo `base-lyra` (Base UI, iconos Phosphor) + Lucide en componentes propios ·
Prisma 7.8 + `@prisma/adapter-pg` · NextAuth v4 (Credentials + JWT) · bcryptjs · zod 4 · nodemailer 10 · Motion (`motion/react`) · Sonner · PostgreSQL (local).
Tests: Vitest 3 (Vitest 5 exige Node 22; aquí se usa Node 20.19).

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
| `pnpm db:migrate` | `prisma migrate dev` (requiere `.env` con `DATABASE_URL`). Prisma 7 NO regenera el cliente: correr `pnpm db:generate` después |
| `pnpm db:studio` | Prisma Studio |
| `pnpm test` | Todas las pruebas (unit + integration) |
| `pnpm test:unit` / `pnpm test:integration` | Solo un proyecto de Vitest |
| `pnpm test:watch` | Vitest en modo watch |

Si `pnpm dev` se queda en "Compiling …" sin terminar (pasa tras mover/crear rutas o migraciones con el servidor encendido): detener el servidor, borrar `.next/dev` (caché persistente de Turbopack) y volver a arrancar. En esta máquina la primera compilación de una ruta tarda ~1,5 min.

Gestor único: **pnpm** (`pnpm-lock.yaml`). `pnpm-workspace.yaml` → `allowBuilds` aprueba scripts de `esbuild`, `@prisma/engines`, `prisma`, `sharp`, `unrs-resolver`.

## Estructura
```
src/app/layout.tsx          layout raíz (fuentes, metadata TaskQuest, lang="es")
src/app/(dashboard)/layout.tsx   shell (sidebar + navbar) con requireUser() y getNotificationFeed()
src/app/(dashboard)/page.tsx     dashboard "/": ProgressHero (nivel + estadísticas), misiones diarias, "Próximas fechas" (UpcomingDeadlines) y un resumen de "Misiones personales" (TaskList preview=5, enlace "Ver N misiones más" a /misiones)
src/app/(dashboard)/misiones/page.tsx  /misiones: lista completa de misiones personales (TaskList con búsqueda y filtro por dificultad) + "Tareas de organizaciones" (OrgTasksSection)
src/app/(dashboard)/loading.tsx  skeleton del contenido
src/app/(dashboard)/error.tsx    error boundary con Reintentar (unstable_retry)
src/app/(dashboard)/calendario/page.tsx  /calendario?mes=YYYY-MM&dia=YYYY-MM-DD (dia solo abre su mes y lo selecciona): cabecera con mes anterior/siguiente/Hoy + CalendarView (key = mes)
src/app/(dashboard)/estadisticas/page.tsx  /estadisticas?rango=7|30|90: XP del periodo vs anterior, completadas, % a tiempo, racha actual/mejor, XP por día/semana (apilada), por dificultad, por día de la semana
src/app/(dashboard)/historial/page.tsx  /historial?filtro=all|missions|team|achievements&antes=ISO: actividad agrupada por día (Hoy/Ayer/…) con XP del día, "Ver más antiguas"
src/app/(dashboard)/configuracion/page.tsx  /configuracion: editar datos de la cuenta + cambiar contraseña
src/app/(dashboard)/logros/page.tsx  /logros: catálogo de logros con progreso y fecha de desbloqueo
src/app/(dashboard)/organizaciones/page.tsx         /organizaciones: crear + lista de mis organizaciones
src/app/(dashboard)/organizaciones/[slug]/layout.tsx      cabecera (nombre, rol) + pestañas Tablero/Miembros
src/app/(dashboard)/organizaciones/[slug]/organization.ts loadOrganization(slug) con cache(); no miembro → redirect a la lista
src/app/(dashboard)/organizaciones/[slug]/page.tsx        tablero: tareas del equipo + ranking
src/app/(dashboard)/organizaciones/[slug]/miembros/page.tsx  miembros, invitar, pendientes, salir/eliminar
src/app/actions/account.ts  changePassword, updateProfile
src/components/account/     ChangePasswordForm (tras cambiarla vuelve a iniciar sesión con la nueva vía signIn; si falla → login), EditProfileForm (nombre, apellidos, usuario, correo; valida en cliente, avisa si no hay cambios y pide confirmación con ConfirmDialog tone="primary")
src/app/actions/notifications.ts  fetchNotifications (sondeo de la campana), markNotificationsRead
src/app/actions/org-tasks.ts  createOrgTask, updateOrgTask, deleteOrgTask, claimOrgTask, releaseOrgTask, submitOrgTask, approveOrgTask, rejectOrgTask, reopenOrgTask
src/app/invitaciones/[token]/page.tsx  aceptar invitación (pública; con o sin sesión; noindex + no-referrer)
src/app/actions/organizations.ts  createOrganization, inviteMember, revokeInvitation, changeMemberRole, removeMember, leaveOrganization, deleteOrganization
src/app/actions/invitations.ts    acceptInvitation (con sesión), acceptInvitationWithSignup (crea cuenta + membresía)
src/app/actions/tasks.ts    Server Actions de misiones: createTask, updateTask, rescheduleTask, setTaskCompleted, deleteTask
src/app/globals.css         Tailwind v4 + tokens shadcn (tema claro; .dark no se aplica)
src/app/auth/layout.tsx     layout de login/registro → usa AuthShell
src/app/auth/login/page.tsx     /auth/login (sanea ?callbackUrl; avisos ?registered=1, ?restablecida=1, ?expirada=1)
src/app/auth/recuperar/page.tsx /auth/recuperar: pedir enlace (ForgotPasswordForm; misma respuesta exista o no la cuenta)
src/app/auth/restablecer/[token]/page.tsx  nueva contraseña (valida el token en servidor; inválido → "Este enlace ya no funciona"; noindex + no-referrer)
src/app/api/session/expired/route.ts  borra la cookie de NextAuth y lleva a /auth/login?expirada=1 (requireUser redirige aquí si la sesión fue revocada)
src/app/auth/register/page.tsx  /auth/register
src/app/auth/actions.ts     Server Actions registerUser (zod + bcrypt cost 12, P2002 → email duplicado), requestPasswordReset, resetPassword
src/app/api/auth/[...nextauth]/route.ts  handler NextAuth
src/proxy.ts                Proxy (ex-middleware, Next 16): sin token → /auth/login?callbackUrl; con token en /auth/* → /
src/components/auth/        RotatingTagline (frase del panel de marca tecleada letra por letra con cursor, se borra y pasa a la siguiente; fija con reduced motion; sr-only estable), ForgotPasswordForm, ResetPasswordForm, AuthShell (panel de marca + columna; auth e invitaciones), LoginForm, RegisterForm, ProfileFields (nombre, apellidos, usuario, contraseña; reutilizable), PasswordField, SubmitButton, FormAlert
src/app/constants/taskDifficulty.tsx  DIFFICULTIES + DifficultyStyles por enum (label ES, color, badge, icono)
src/components/ui/          shadcn: avatar, badge, button, card, checkbox, dropdown-menu, input, progress, sheet
src/components/layout/      DashboardLayout (props userName, userId, notifications; h-dvh, padding p-4/sm:p-6/lg:p-8), SidebarNav (lista de navegación compartida, onNavigate), AppSidebar (solo lg+), MobileNav (botón de menú lg:hidden + Sheet izquierdo con SidebarNav; se cierra al tocar un enlace), NotificationBell (campana: contador, panel Base UI Popover, sondeo cada 30 s, toasts de lo nuevo, router.refresh al llegar una), AppNavbar (h-16/lg:h-20; saludo truncado, subtítulo solo sm+), SignOutButton
src/components/organization/ RoleBadge, ConfirmDialog (destructivo genérico), CreateOrganizationForm, InviteMemberForm (muestra/copia enlace),
                            MemberList (cambiar rol, quitar), PendingInvitations (cancelar), OrganizationDangerZone (salir/eliminar)
src/components/org-board/   OrgBoard (filtros Pendientes/En revisión/Libres/Mías/Completadas, Motion, toasts, confirmaciones), OrgTaskCard (Tomar/Soltar/Enviar a revisión, Aprobar/Pedir cambios, nota de cambios + menú),
                            OrgTaskFormSheet (responsable: libre o un miembro), OrgRanking, RejectTaskDialog (nota opcional), useOrgTaskActions (tomar/soltar/entregar/aprobar/devolver + toasts; tablero y dashboard)
src/components/organization/OrganizationTabs.tsx  pestañas Tablero/Miembros
src/components/invitation/  AcceptInvitationButton, InvitationSignupForm (correo fijo), SwitchAccountButton
src/components/gamification/ DailyMissionsCard, AchievementIcon (nombre → icono Lucide)
src/components/calendar/    CalendarView (cuadrícula lunes-primero, flechas/Home/End con roving tabindex, chips por día, puntos en móvil, panel del día con completar misión, crear misión con la fecha elegida, tareas de equipo enlazan al tablero y dicen "Asignada a …" / "Realizada por …" / "Libre"; arrastrar misiones pendientes y tareas de equipo con `canReschedule` (chips de la celda o filas del panel, HTML5 DnD, sm+) a otro día con UI optimista y toast con Deshacer; botón lápiz por fila abre TaskFormSheet para editar o cambiar fecha (alternativa en móvil/teclado). La celda es un div (drop target) con el botón de selección absoluto debajo y los chips encima; Motion)
src/components/stats/       ColumnChart (columnas simples o apiladas: leyenda, tooltip por hover/foco, etiqueta solo en el pico, "Ver como tabla"), chart-utils (niceMax, compact, SERIES_COLORS validados)
src/components/dashboard/   UpcomingDeadlines (server: franja de 7 días con conteo → /calendario?dia=, aviso de vencidas, agenda por día máx. 8 filas)
src/components/calendar/ownership.ts  ownership()/personName(): "Asignada a …", "Realizada por …", "Libre" (calendario y dashboard)
src/components/dashboard/   ProgressHero (anillo de nivel con avatar, barra de XP, próximo título, franja Racha/Completadas/Pendientes/Logros→/logros; Motion), OrgTasksSection (tareas de equipo: filtros Mías/Libres, agrupadas por organización, enlace al tablero)
src/components/task/        TaskList (filtros Pendientes/Completadas; sin `preview`: búsqueda sin acentos y filtro por dificultad; con `preview`: solo N + enlace a /misiones; optimistic UI, toasts, animación Motion), TaskCard (checkbox, menú editar/eliminar), completion.tsx (toggleTaskWithToasts: completar + toasts de XP/misiones/logros/nivel; dashboard y calendario),
                            TaskFormSheet (crear/editar en Sheet; prop defaultDueDate), DifficultyPicker, DeleteTaskDialog (AlertDialog Base UI)
src/components/form/        FormField (input con label/error accesible; usado en auth y misiones)
src/components/ui/sonner.tsx  <Toaster /> oscuro (montado en el layout raíz)
src/lib/utils.ts            cn()
src/lib/prisma.ts           PrismaClient singleton con adapter pg
src/lib/auth.ts             authOptions de NextAuth (Credentials, JWT, session.user.id)
src/lib/session.ts          requireUser(): usuario de la sesión o redirect a /auth/login; si sessionVersion del JWT ≠ BD (o la cuenta ya no existe) → /api/session/expired
src/lib/session-version.ts  isSessionCurrent(userId, version), EXPIRED_SESSION_PATH
src/lib/password-reset.ts   token de restablecimiento (32 bytes, solo hash SHA-256), vence en 60 min, passwordResetUrl, findValidResetToken
src/lib/safe-redirect.ts    safeCallbackUrl(): solo rutas relativas (evita open redirect)
src/lib/validations/auth.ts loginSchema (identifier = correo o usuario), profileSchema, registerSchema, usernameSchema, updateProfileSchema
src/lib/user.ts             fullName, takenProfileFields (email/usuario ya usados; `exceptUserId` ignora la propia cuenta), hashPassword (bcrypt 12)
src/lib/validations/task.ts taskInputSchema, taskIdSchema, orgTaskInputSchema (+ assigneeId opcional)
src/lib/xp.ts               XP_BY_DIFFICULTY, xpForLevel, levelFromXp, levelProgress, levelTitle, nextLevelTitle (tabla LEVEL_TITLES)
src/lib/calendar.ts         parseMonthParam (?mes, cae al mes actual en APP_TIME_ZONE), parseDayParam, addDays, weekdayLabel, relativeDayLabel (Hoy/Mañana/"vie 30 oct"), monthParam, shiftMonth, monthGrid (4–6 semanas), gridRange, monthLabel, dayLabel (puro)
src/lib/data/calendar.ts    getCalendarMonth(userId, mes): misiones con fecha en la cuadrícula, tareas de equipo (mías, o todas las de orgs donde soy OWNER/ADMIN) con assignee y completedBy, pendientes sin fecha; getUpcomingDeadlines(userId, hoy, 7): pendientes (y de equipo en revisión) de hoy a +6 días + vencidas; visibleOrgTasks() = filtro compartido mías/gerente
src/lib/stats.ts            STAT_RANGES, parseRangeParam, summarize(eventos, rango, hoy) → buckets diarios (≤30) o semanales (90), longestStreak, percentChange (puro)
src/lib/data/stats.ts       getStats(userId, rango, hoy): eventos de XP (misiones, tareas de equipo que completé, bonos diarios) del doble del rango + rachas
src/lib/data/history.ts     getHistory(userId, {filter, before, limit=30}): misiones completadas, tareas de equipo que completé (aprobada por …), bonos diarios y logros, más reciente primero; cursor por instante sin partir empates; parseHistoryFilter, parseCursor
src/lib/dates.ts            APP_TIME_ZONE, dayKey, dueDate ↔ input, currentStreak
src/lib/data/dashboard.ts   getPersonalTasks(userId) (usada por /misiones), getDashboardData(userId) + tipo TaskDTO (incluye dailyMissions y conteo de logros)
src/lib/data/achievements.ts getAchievements(userId): logros con progreso para /logros
src/lib/data/org-board.ts   getOrgBoard(orgId, members): tareas (OrgTaskDTO) + ranking por XP ganada en la org; getMyOrgTasks(userId): pendientes mías o libres de mis orgs, agrupadas (máx. 100)
src/lib/data/organizations.ts getMyOrganizations, getOrganizationForMember(slug, userId), findInvitationByToken
src/lib/organizations/permissions.ts ROLE_LABELS, ASSIGNABLE_ROLES, MAX_OWNED_ORGANIZATIONS, canInvite/canRemoveMember/canChangeRole/canLeave/... (puro)
src/lib/organizations/tokens.ts      token de invitación (32 bytes base64url) + hash SHA-256, vencimiento 7 días, invitationUrl, slugify/organizationSlug
src/lib/validations/organization.ts  createOrganizationSchema, inviteMemberSchema, invitationTokenSchema, idSchema
src/lib/notifications/server.ts  notifyReview(tx, …) (crea y conserva las 50 más recientes), getNotificationFeed(userId) (20 + no leídas), NotificationDTO
src/lib/notifications/messages.ts notificationText (título/descripción en español), timeAgo (puro)
src/lib/rate-limit.ts       hit(key, regla) (ventana fija, un upsert atómico), isLimited, clearHits, retryAfterLabel, clientIp(headers); reglas LOGIN_ACCOUNT/LOGIN_IP/REGISTER_IP/INVITE_USER
src/lib/rate-limit-messages.ts LOGIN_RATE_LIMITED (importable en cliente)
src/lib/mail.ts             nodemailer: sendInvitationEmail, sendPasswordResetEmail; sin SMTP_HOST solo hace console.info del enlace
src/lib/gamification/daily.ts        DAILY_CATALOG, pickDailyTypes (determinista por usuario+día), dailyProgress (puro)
src/lib/gamification/achievements.ts ACHIEVEMENTS (catálogo en código), newlyUnlocked (puro)
src/lib/gamification/server.ts       ensureDailyMissions, getDailyMissions, syncDailyMissions, unlockAchievements, addUserXp (Prisma)
src/types/next-auth.d.ts    agrega id, username y firstName a Session.user / JWT
src/generated/prisma/       cliente Prisma generado (gitignored, no editar)
prisma/schema.prisma        User, Task, enums Difficulty/TaskStatus
prisma/migrations/          20261026154201_init (User, Task, enums)
prisma/seed.ts              VACÍO
prisma.config.ts            config Prisma 7 (schema, migrations, datasource url)
.env.example                variables requeridas (sin valores reales)
vitest.config.mts           proyectos "unit" e "integration" (integration en un solo fork)
tests/unit/                 xp, dates, validations, safe-redirect, gamification, organizations (lógica pura)
tests/integration/          Server Actions y login contra la BD `<db>_test`
  global-setup.ts           crea la BD de prueba y aplica `prisma migrate deploy`
  setup.ts                  apunta DATABASE_URL a la BD de prueba, mockea next/cache y @/lib/session, TRUNCATE antes de cada test
  helpers.ts                createUser / createSignedInUser / signInAs / signOut
```

## Dónde está cada cosa
| Necesito... | Archivo |
|---|---|
| Tokens de color / tipografía | `src/app/globals.css`, fuentes en `src/app/layout.tsx` |
| Componentes shadcn | `src/components/ui/` (config en `components.json`) |
| Estilos por dificultad | `src/app/constants/taskDifficulty.tsx` |
| Lógica de XP / nivel | `src/lib/xp.ts` (se aplica en `setTaskCompleted`) |
| Racha / zona horaria | `src/lib/dates.ts` |
| Datos del dashboard | `src/lib/data/dashboard.ts` |
| Autenticación | `src/lib/auth.ts`, `src/lib/session.ts`, `src/proxy.ts`, `src/app/auth/` |
| Usuario actual en servidor | `const user = await requireUser()` de `@/lib/session` |
| Esquema de BD | `prisma/schema.prisma` |
| Cliente de BD | `import { prisma } from "@/lib/prisma"` |
| Permisos de organización | `src/lib/organizations/permissions.ts` (UI y Server Actions usan las mismas funciones) |
| Server Actions / Route Handlers | `src/app/actions/tasks.ts`, `src/app/actions/organizations.ts`, `src/app/actions/invitations.ts`, `src/app/auth/actions.ts`, `src/app/api/auth/[...nextauth]/route.ts` |

## Rutas
| Ruta | Archivo | Estado |
|---|---|---|
| `/` | `src/app/(dashboard)/page.tsx` | Protegida; datos reales, misiones diarias, loading y error |
| `/misiones` | `src/app/(dashboard)/misiones/page.tsx` | Protegida; misiones personales + de equipo |
| `/calendario` | `src/app/(dashboard)/calendario/page.tsx` | Protegida; `?mes=YYYY-MM` |
| `/estadisticas` | `src/app/(dashboard)/estadisticas/page.tsx` | Protegida; `?rango=7|30|90` (30 por defecto) |
| `/historial` | `src/app/(dashboard)/historial/page.tsx` | Protegida; `?filtro=` y `?antes=` |
| `/configuracion` | `src/app/(dashboard)/configuracion/page.tsx` | Protegida; botón de engrane del navbar |
| `/logros` | `src/app/(dashboard)/logros/page.tsx` | Protegida; logros del usuario |
| `/organizaciones` | `src/app/(dashboard)/organizaciones/page.tsx` | Protegida |
| `/organizaciones/[slug]` | `src/app/(dashboard)/organizaciones/[slug]/page.tsx` | Protegida; solo miembros. Tablero + ranking |
| `/organizaciones/[slug]/miembros` | `src/app/(dashboard)/organizaciones/[slug]/miembros/page.tsx` | Protegida; solo miembros |
| `/invitaciones/[token]` | `src/app/invitaciones/[token]/page.tsx` | Pública (el proxy la deja pasar sin sesión) |
| `/auth/login` | `src/app/auth/login/page.tsx` | Funcional |
| `/auth/register` | `src/app/auth/register/page.tsx` | Funcional |
| `/auth/recuperar` | `src/app/auth/recuperar/page.tsx` | Pública (sin sesión) |
| `/auth/restablecer/[token]` | `src/app/auth/restablecer/[token]/page.tsx` | Pública (sin sesión) |
| `/api/session/expired` | `src/app/api/session/expired/route.ts` | GET: limpia cookie de sesión revocada |
| `/api/auth/*` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth |

Menú lateral: Dashboard, Misiones, Logros, Organizaciones, Calendario, Estadísticas, Historial (ya no queda nada en "Pronto"; AppSidebar conserva el estilo para futuros). Las subrutas resaltan su sección.

## API / Server Actions
| Nombre | Archivo | Qué hace |
|---|---|---|
| `registerUser(input)` | `src/app/auth/actions.ts` | Valida con registerSchema, límite 5/hora por IP (antes de revisar ocupados), revisa correo/usuario ocupados (error en el campo correcto), hashea y crea User |
| `requestPasswordReset({email})` | `src/app/auth/actions.ts` | Siempre `{ok:true}` exista o no la cuenta. Límite 3/hora por correo y 10/hora por IP. Borra los enlaces anteriores y crea uno (60 min); lo envía por correo (sin SMTP → consola, nunca en la UI) |
| `resetPassword(token, {password})` | idem | Transacción: valida token vigente, lo marca usado con update condicional (un solo uso en paralelo), cambia el hash, incrementa `sessionVersion` (cierra todas las sesiones) y borra los demás enlaces; limpia el bloqueo de login de la cuenta. Inválido/vencido → `{expired: true}` |
| `updateProfile({firstName, lastName, username, email})` | `src/app/actions/account.ts` | Requiere sesión. Valida con updateProfileSchema, rechaza correo/usuario de otra cuenta (también P2002 en carrera), no toca sessionVersion. `revalidatePath("/", "layout")` |
| `changePassword({currentPassword, newPassword})` | `src/app/actions/account.ts` | Requiere sesión. Verifica la actual (5 fallos/15 min por usuario, luego bloquea); la nueva debe ser distinta. Cambia el hash, incrementa sessionVersion (cierra todas las sesiones) y borra enlaces de restablecimiento pendientes |
| `createTask(input)` | `src/app/actions/tasks.ts` | Crea misión; xpReward lo fija el servidor según dificultad |
| `updateTask(id, input)` | idem | Edita; si está completada no permite cambiar la dificultad |
| `rescheduleTask(id, dueDate)` | idem | Solo cambia dueDate ("YYYY-MM-DD", dueDateSchema); misiones propias y pendientes (completadas → error). Revalida /, /misiones y /calendario |
| `setTaskCompleted(id, bool)` | idem | Transacción: cambia estado con update condicional (sin XP doble), sincroniza misiones diarias (otorga o retira bono), suma/resta XP, recalcula nivel y desbloquea logros. Devuelve `{ xpDelta, bonusXp, dailyRewards, achievements, level, leveledUp }` |
| `deleteTask(id)` | idem | Borra; conserva la XP ya ganada |
| `createOrganization(input)` | `src/app/actions/organizations.ts` | Crea org + membresía OWNER; slug con sufijo aleatorio (reintenta en P2002); máx. 10 como dueño |
| `inviteMember(orgId, {email, role})` | idem | OWNER invita ADMIN/MEMBER, ADMIN solo MEMBER. Rechaza si ya es miembro. Reemplaza la pendiente del mismo correo. Límite 20/hora por quien invita (solo cuenta las que pasan validación y permisos). Devuelve `{ url, emailed }` |
| `revokeInvitation(id)` | idem | Borra la invitación pendiente (puede revocar quien podría haberla enviado) |
| `changeMemberRole(orgId, userId, role)` | idem | Solo OWNER; entre ADMIN y MEMBER |
| `removeMember(orgId, userId)` | idem | OWNER quita ADMIN/MEMBER; ADMIN quita MEMBER; nadie quita al dueño ni a sí mismo |
| `leaveOrganization(orgId)` / `deleteOrganization(orgId)` | idem | Salir (no el dueño) / eliminar (solo dueño, cascada) |
| `createOrgTask(orgId, input)` | `src/app/actions/org-tasks.ts` | OWNER/ADMIN. `assigneeId` vacío = libre; si viene, debe ser miembro. XP según dificultad (servidor) |
| `updateOrgTask(id, input)` | idem | OWNER/ADMIN; solo pendientes (completada → reabrir primero). Puede reasignar o liberar |
| `rescheduleOrgTask(id, dueDate)` | `src/app/actions/org-tasks.ts` | Solo OWNER/ADMIN (canManageTasks) y tareas PENDING. En transacción cambia dueDate y notifica al asignado (ORG_TASK_RESCHEDULED con dueDate) si no es quien la movió |
| `deleteOrgTask(id)` | idem | OWNER/ADMIN; la XP ya pagada se conserva |
| `claimOrgTask(id)` | idem | Cualquier miembro toma una libre (update condicional: solo uno gana) → selfAssigned |
| `releaseOrgTask(id)` | idem | Solo quien la tomó por su cuenta; las asignadas por un jefe no se sueltan |
| `submitOrgTask(id)` | idem | Solo el responsable. MEMBER → IN_REVIEW (sin XP). OWNER/ADMIN con tarea propia → COMPLETED y cobra al instante |
| `approveOrgTask(id)` | idem | OWNER/ADMIN. IN_REVIEW → COMPLETED; paga xpReward una vez (update condicional) al responsable (completedById), reviewedById = quien aprueba, desbloquea logros del responsable y le crea una notificación (XP y nivel nuevo) en la misma transacción |
| `rejectOrgTask(id, note?)` | idem | OWNER/ADMIN. IN_REVIEW → PENDING con el mismo responsable y `reviewNote` (≤300, opcional). Sin XP. Notifica al responsable con la nota |
| `reopenOrgTask(id)` | idem | OWNER/ADMIN. Vuelve a pendiente con el mismo responsable, limpia revisión y descuenta awardedXp a quien la completó |
| `fetchNotifications()` / `markNotificationsRead()` | `src/app/actions/notifications.ts` | Feed del usuario de la sesión / marca todas como leídas (solo las suyas) |
| `acceptInvitation(token)` | `src/app/actions/invitations.ts` | Requiere sesión; el correo de la BD debe ser el invitado. Marca usada con update condicional (un solo uso aunque haya peticiones en paralelo) |
| `acceptInvitationWithSignup(token, profile)` | idem | Sin sesión: crea cuenta con el correo invitado + membresía en una transacción; el cliente hace signIn después |
| NextAuth `/api/auth/*` | `src/app/api/auth/[...nextauth]/route.ts` | Login con Credentials (`identifier` = correo si contiene "@", si no usuario; minúsculas), sesión JWT 30 días con username y firstName. Límite: 30 intentos/15 min por IP y 5 fallos/15 min por cuenta (clave = id del usuario o el identificador si no existe; un acierto limpia). Bloqueado → lanza `RateLimited` y el formulario muestra "Demasiados intentos" |

Toda Server Action / página protegida debe llamar `requireUser()`; el proxy solo es una comprobación optimista. Todas las consultas de Task filtran por `userId` del usuario de la sesión. Las acciones devuelven `{ ok: true, ... } | { ok: false, error?, fieldErrors? }`.

## Base de datos
PostgreSQL 16 local (servicio Windows `postgresql-x64-16`, puerto 5432), base `taskquest`.
Migraciones aplicadas: `20261026154201_init`, `20261026184433_daily_missions_achievements`, `20261026200000_user_profile` (escrita a mano: renombra name→firstName y genera username desde el email), `20261027153646_organizations`, `20261027181121_org_tasks`, `20261027210000_org_task_review` (escrita a mano: convierte `status` a OrgTaskStatus con USING en vez de borrar la columna), `20261028153400_org_task_notifications`, `20261029155355_rate_limit`, `20261029163230_password_reset`, `20261030173649_org_task_rescheduled`.
| Modelo | Campos clave | Notas |
|---|---|---|
| User | id (cuid), firstName, lastName, username (unique, minúsculas), email (unique), passwordHash, sessionVersion (0), xp (0), level (1) | Login con correo o usuario. sessionVersion va en el JWT; cambiarla revoca sesiones |
| PasswordResetToken | id, tokenHash (unique), expiresAt, usedAt?, createdAt, userId | Cascade con User; uno vigente por usuario |
| Task | id, title, description?, difficulty, xpReward, status, dueDate?, completedAt?, userId | FK a User con cascade; índice (userId, status) |
| DailyMission | id, day ("YYYY-MM-DD" en APP_TIME_ZONE), type, target, xpReward, rewardedAt?, userId | Único (userId, day, type). El progreso NO se guarda: se calcula de las tareas completadas ese día |
| UserAchievement | id, key, unlockedAt, userId | Único (userId, key). Definiciones en código |

| Organization | id, name, slug (unique) | |
| Membership | id, role (OrgRole), organizationId, userId | Único (organizationId, userId); un solo OWNER (el creador) |
| OrgTask | id, title, description?, difficulty, xpReward, status (OrgTaskStatus: PENDING/IN_REVIEW/COMPLETED), dueDate?, selfAssigned, submittedAt?, reviewNote?, completedAt?, awardedXp, reviewedById?, organizationId, assigneeId?, createdById?, completedById? | assigneeId null = libre. Índices (organizationId, status), (assigneeId) |
| Notification | id, type (NotificationType), taskTitle, xp, level?, note?, actorName?, dueDate? (nueva fecha si se movió), readAt?, createdAt, userId, organizationId | Copia los datos de la tarea (sobrevive a editarla o borrarla); cascade con User y Organization; índice (userId, createdAt); máx. 50 por usuario |
| RateLimit | key (PK, p. ej. "login:account:<userId>"), count, resetAt (timestamptz) | Contadores de ventana fija; las vencidas se borran al azar (2 % de los hits). Las pruebas la truncan |
| Invitation | id, email (minúsculas), role, tokenHash (unique, SHA-256), expiresAt, acceptedAt?, organizationId, invitedById? | Revocar = borrar; invitar de nuevo reemplaza la pendiente |

Enums: `NotificationType` ORG_TASK_APPROVED/ORG_TASK_CHANGES_REQUESTED/ORG_TASK_RESCHEDULED · `OrgRole` OWNER/ADMIN/MEMBER (UI: Dueño/Admin/Miembro) · `Difficulty` EASY/MEDIUM/HARD/EPIC (UI: Fácil/Media/Difícil/Épica) · `TaskStatus` PENDING/COMPLETED · `DailyMissionType` COMPLETE_TASKS/COMPLETE_HARD/COMPLETE_ON_TIME/COMPLETE_VARIETY.

Reglas de XP: Fácil 10 · Media 25 · Difícil 50 · Épica 100. XP acumulada para nivel n = 50·n·(n−1) → 0, 100, 300, 600, 1000…
Títulos: Novato (1–2), Aprendiz (3–4), Aventurero (5–9), Veterano (10–14), Héroe (15–19), Leyenda (20+).
Misiones diarias (3 de 4 por día): Ritmo constante (3 misiones, +30) · Reto mayor (1 Difícil/Épica, +40) · Puntualidad (2 a tiempo, +30) · Versatilidad (2 dificultades, +25).
Logros (10): first-quest, quests-10/50/100, first-epic, streak-3/7, level-5/10, daily-sweep. Sin XP; nunca se retiran.
`dueDate` es fecha de calendario guardada a las 00:00 UTC (columna `timestamp` sin zona; se formatea con timeZone UTC).
- 2026-10-29: Rate limiting en PostgreSQL (tabla RateLimit) y no en memoria: sobrevive reinicios y funciona con varias instancias sin Redis. Ventana fija con un solo `INSERT … ON CONFLICT` (sin carreras). El bloqueo por cuenta aplica también a cuentas inexistentes (no revela cuáles existen) y comparte clave entre correo y usuario. Sin IP en las cabeceras no se aplica el límite por IP (para no meter a todos en el mismo cubo).
- 2026-10-29: Recuperar contraseña solo por correo (no por usuario) y con la misma respuesta exista o no la cuenta. Sin SMTP el enlace va a la consola del servidor, NUNCA a la UI (cualquiera podría restablecer cuentas ajenas). Enlace de 60 min y un solo uso.
- 2026-10-29: Revocar sesiones JWT con `User.sessionVersion`: requireUser hace una consulta por petición (cacheada) para compararla. La sesión revocada pasa por `/api/session/expired` (fuera de /auth para que el proxy no la rebote a "/") que borra la cookie.
- 2026-10-29: "Misiones" deja de ser un ancla del dashboard (`/#missions-heading`) y pasa a ser la página /misiones con la lista completa, búsqueda, filtro por dificultad y las tareas de equipo. El dashboard queda como resumen del día (nivel, diarias, próximas fechas y 5 misiones). Las acciones de tareas, tareas de equipo, organizaciones e invitaciones revalidan también "/misiones".
- 2026-10-30: En el calendario se arrastran las misiones personales pendientes y, solo para dueños y admins, las tareas de equipo pendientes de sus organizaciones (los miembros no, ni siquiera las suyas). Lo que está en revisión o completado no se mueve. Se usa DnD nativo de HTML5, sin librería; en touch no funciona, así que el lápiz de cada fila abre el formulario de edición.
- 2026-10-30: `requireUser` toma nombre, usuario y correo de la base (`currentAccount` en session-version.ts, la misma consulta que ya validaba sessionVersion), no del JWT: así los cambios de perfil se ven sin volver a iniciar sesión. El JWT conserva los valores del login, pero nada del servidor los lee.
- 2026-10-30: El cambio de correo se aplica sin confirmación por correo (pedido del usuario); solo hay un diálogo "¿Guardar los cambios?".
- 2026-10-29: Cambiar contraseña revoca también la sesión actual (sessionVersion es una sola por usuario); el cliente vuelve a iniciar sesión al instante con la nueva para no sacar a la persona. Desde /configuracion no se enlaza a /auth/recuperar porque el proxy redirige /auth/* a "/" con sesión.

## Variables de entorno
Plantilla en `.env.example` (copiar a `.env`):
- `DATABASE_URL` — conexión PostgreSQL
- `NEXTAUTH_URL` — URL base de la app
- `NEXTAUTH_SECRET` — secreto de sesión
- `SMTP_HOST`, `SMTP_PORT` (587; 465 = TLS), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — opcionales; sin `SMTP_HOST` el enlace de invitación va a consola y se muestra en la UI para copiarlo.
- `NEXTAUTH_URL` también arma los enlaces de invitación.
- `TEST_DATABASE_URL` — opcional; si falta, las pruebas usan `DATABASE_URL` con sufijo `_test`. El nombre debe terminar en `_test` o las pruebas se niegan a correr.

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
- 2026-10-26: Login vía `signIn("credentials", { redirect: false })` en cliente; registro vía Server Action y luego auto-login. Comparación bcrypt contra hash ficticio si el email no existe (mismo tiempo de respuesta).
- 2026-10-26: Validación con zod compartida cliente/servidor (`src/lib/validations/`). Contraseña 8–72 caracteres (límite de bcrypt).
- 2026-10-26: XP y nivel se calculan solo en el servidor; descompletar resta la XP (evita farmear). Eliminar una completada conserva su XP.
- 2026-10-26: Racha calculada en `America/Mexico_City` (APP_TIME_ZONE) para no depender de la zona del servidor; cuenta hasta ayer para no perderla antes de la primera tarea del día.
- 2026-10-26: Tarjeta "Logros" reemplazada por "Pendientes" hasta que existan logros reales (sin datos ficticios).
- 2026-10-26: Perfil con nombre, apellidos y username para todos; login con correo o usuario (decisión por defecto, el usuario pidió no preguntar en proyecto personal).
- 2026-10-26: ensureDailyMissions solo crea misiones si el día no tiene ninguna (evitaba una 4ª misión si el catálogo/selección cambiaba).
- 2026-10-26: Misiones diarias: solo se guarda el estado de recompensa; el progreso se recalcula de las tareas del día. Si el progreso baja (tarea desmarcada) se retira el bono → no se puede farmear. Se crean de forma perezosa al cargar el dashboard o al completar una tarea.
- 2026-10-26: Logros definidos en código (sin tabla de catálogo) para evolucionarlos sin migraciones; no dan XP y no se revocan.
- 2026-10-26: Tarjeta "Logros" vuelve al dashboard con datos reales (reemplaza "Pendientes").
- 2026-10-26: Dashboard en route group `(dashboard)` para que loading/error cubran solo el contenido y el shell quede fijo. `requireUser` envuelto en `cache()` de React.
- 2026-10-26: Pruebas de integración contra PostgreSQL real (no mocks de Prisma) en una BD aparte; se mockean solo `requireUser` y `revalidatePath`.
- 2026-10-26: Formularios de auth con estilos propios slate/violeta (los shadcn base-lyra son h-8 text-xs, demasiado pequeños). Entrada con `starting:` de Tailwind (sin Motion aún).

- 2026-10-27: `main` fusionado (fast-forward) hasta `feat/user-profile` con permiso del usuario.
- 2026-10-27: Organizaciones: un solo dueño (el creador), sin transferencia por ahora. Permisos en funciones puras compartidas por UI y servidor.
- 2026-10-27: Invitaciones: solo se guarda el hash del token; aceptar exige que el correo de la cuenta (leído de la BD) sea el invitado. Sin SMTP el admin copia el enlace. La invitación a una cuenta nueva crea usuario + membresía en la misma transacción.
- 2026-10-27: `/organizaciones/[slug]` de la que no eres miembro redirige a la lista (no revela si existe).

- 2026-10-27: Tablero: OWNER y ADMIN crean/asignan/editan/reabren/eliminan tareas (el usuario pidió "el dueño"; se incluyó admin como delegado). Tarea con responsable = específica; sin responsable = cualquiera la toma.
- 2026-10-27: Tareas de organización en modelo aparte (OrgTask): suman XP y nivel personal y desbloquean logros de nivel, pero NO cuentan para misiones diarias, racha ni logros de cantidad de tareas personales.
- 2026-10-27: Reabrir descuenta la XP pagada (igual que descompletar una personal). Quitar a alguien o que salga libera sus tareas pendientes.
- 2026-10-27: Ranking = XP ganada en tareas de esa organización (histórico), solo miembros actuales.

- 2026-10-27: Dashboard separa "Misiones personales" y "Tareas de organizaciones". La sección de equipo solo muestra pendientes mías o libres (no las de otros ni completadas) y solo permite Tomar/Soltar/Completar; gestionar (crear, editar, reabrir, eliminar) se hace en el tablero. Las acciones de organizaciones, tareas de equipo e invitaciones también revalidan "/".

- 2026-10-27: Cabecera del dashboard unificada (ProgressHero): nivel y estadísticas en un solo panel. "XP total" pasó al panel de nivel y su lugar en la franja lo ocupa "Pendientes". Las estadísticas cuentan solo misiones personales.

- 2026-10-27: Revisión de tareas de equipo: el miembro entrega (IN_REVIEW) y un OWNER/ADMIN aprueba (paga XP al miembro) o pide cambios con nota opcional. Las tareas propias de OWNER/ADMIN no pasan por revisión (ellos son los revisores). En revisión no se puede soltar ni editar. Quitar/salir devuelve también las tareas en revisión al pool. Dashboard: filtro "Por revisar" solo para quien puede revisar.

- 2026-10-28: Notificaciones guardadas en BD y creadas en la transacción de la revisión (no se pierden ni se duplican). Entrega por sondeo cada 30 s con la pestaña visible (sin WebSockets/SSE por ahora). Abrir la campana marca todo como leído. El último aviso mostrado como toast se recuerda en localStorage por usuario para no repetirlo al recargar.
- 2026-10-28: Calendario por fecha límite (no por fecha de completado). El mes va en la URL (`?mes=`) para poder compartir/volver; el día seleccionado es estado del cliente. Muestra las tareas de equipo asignadas a mí, solo lectura (se gestionan en el tablero). Dueños y admins ven además todas las tareas con fecha de sus organizaciones (decisión del usuario 2026-10-28); los miembros solo las suyas. `TASK_MANAGER_ROLES` en permissions.ts. "Vencida" = pendiente con fecha pasada; las que están en revisión no cuentan. Las acciones de tareas y de equipo revalidan `/calendario`.
- 2026-10-28: "Próximas fechas" en el dashboard usa la misma regla de visibilidad que el calendario (gerentes: todo el equipo; miembros: lo suyo). Solo lo que sigue abierto; las de equipo en revisión aparecen si vencen esta semana pero nunca como vencidas.
- 2026-10-28: Estadísticas sin librería de gráficas (HTML + Tailwind) para no sumar dependencias. Colores de series validados con el checker de dataviz sobre slate-900: personal #8b5cf6, bonos #d97706, equipo #0284c7 (en ese orden de apilado). La XP cuenta lo que sigue cobrado hoy (descompletar resta). Racha = solo misiones personales (igual que el dashboard). "A tiempo" = completada el día límite o antes (APP_TIME_ZONE).
- 2026-10-28: Historial derivado de las tablas existentes (sin tabla de eventos): muestra solo lo que sigue en pie, igual que la XP; descompletar o reabrir lo quita. Paginación por cursor de instante (`antes`), extendiendo la página cuando hay empates (misión + bono comparten `now`).

## Pendientes / deuda técnica
En curso — organizaciones (idea del usuario 2026-10-26)
- [x] Perfil: nombre, apellidos, usuario; login con correo o usuario.
- [x] Organizaciones, roles (Dueño/Admin/Miembro), invitaciones por correo (nodemailer; sin SMTP → consola + copiar enlace), página para aceptar invitación.
- [ ] Transferir la propiedad de una organización.
- [x] Límite de invitaciones: 20 por hora por persona (todas sus organizaciones).
- [x] Tablero de la organización: asignar o dejar libre, tomar/soltar tareas, XP al instante al nivel personal, ranking, el jefe puede reabrir.
- [ ] Ranking semanal/mensual (hoy es histórico).
- [x] Avisar al miembro cuando su tarea se aprueba o se devuelve (campana + toast).
- [ ] Notificaciones en tiempo real (hoy sondeo cada 30 s) y otros tipos (asignación, invitación).
- [ ] Decidir si las tareas de organización cuentan para misiones diarias y racha.

Prioridad 1 — entorno
- [x] Build roto en `TaskCard.tsx` (import inexistente) y lógica de dificultad duplicada.
- [x] Gestor único pnpm.
- [x] `.env.example`, `prisma.config.ts`, esquema Prisma, `src/lib/prisma.ts`.
- [x] `.env` local creado y primera migración `init` aplicada.
- [x] Mapeo Difficulty enum ↔ etiqueta UI (`DifficultyStyles[difficulty].label`).
- [x] Git: remoto `origin` = github.com/AldairGarciaM/TaskQuest. Trabajo en ramas; el usuario revisa y fusiona (no abrir/fusionar PRs ni hacer `git pull` sin su visto bueno).

Prioridad 2 — funcionalidad
- [x] Auth (NextAuth v4): login, registro, logout, proxy y `requireUser()`.
- [x] Límite de intentos: login 5 fallos/15 min por cuenta y 30 intentos/15 min por IP; registro 5 cuentas/hora por IP.
- [ ] Límite por IP depende de `x-real-ip`/`x-forwarded-for`: en producción confiar solo en los que pone el proxy (falsificables si no).
- [x] Recuperar contraseña por correo; al cambiarla se cierran todas las sesiones.
- [x] Cambiar contraseña desde /configuracion (cierra las demás sesiones; la actual se renueva).
- [x] Editar nombre, usuario y correo desde /configuracion, con diálogo de confirmación.
- [ ] Confirmar por correo el cambio de correo (por ahora se aplica directo, decisión del usuario).
- [x] CRUD de tareas con Server Actions + validación en servidor.
- [x] XP y nivel calculados en servidor al completar tareas.
- [x] Dashboard con datos reales, estado vacío, `loading.tsx` y `error.tsx`.
- [x] Misiones diarias, racha y logros.
- [x] Calendario mensual.
- [x] Estadísticas personales.
- [x] Historial de actividad.
- [ ] Historial: subidas de nivel y tareas reabiertas (hoy no se registran como eventos).
- [ ] Estadísticas de equipo para dueños/admins.
- [x] Calendario: arrastrar misiones personales para cambiar la fecha.
- [x] Calendario: dueños/admins arrastran tareas de equipo pendientes; el asignado recibe aviso.
- [ ] Calendario: vista semanal; arrastre táctil (hoy en móvil se usa el lápiz → formulario).
- [ ] Pruebas de integración dependen de la hora real: si cruzan la medianoche de Ciudad de México podrían fallar (bajo riesgo).

Prioridad 3 — UX
- [x] Navegación del sidebar con `<Link>`.
- [x] Responsive en móvil: menú lateral en Sheet bajo lg, navbar compacto, márgenes menores, filtros y barras de herramientas que se envuelven.
- [ ] Tema oscuro coherente con tokens; una sola librería de iconos.
- [x] `aria-label` en botones de icono del navbar; metadata y `lang="es"`.
- [ ] Quitar fuentes sin uso en `layout.tsx`.
- [x] Motion (con `useReducedMotion`) y Sonner en misiones.
- [ ] Los componentes shadcn usan tokens de tema claro; se sobreescriben con clases slate en cada uso.

Prioridad 4 — estabilidad
- [x] Tests unitarios y de integración en el repo (Vitest).
- [ ] Tests e2e de navegador (Playwright) para el flujo de UI.

## Historial
- 2026-10-30: Rama `feat/calendar-drag-org` (sobre `feat/calendar-drag`): dueños/admins arrastran tareas de equipo en el calendario, notificación ORG_TASK_RESCHEDULED al asignado, migración `org_task_rescheduled`. 255 pruebas pasan, build OK.
- 2026-10-30: Rama `feat/calendar-drag` (sobre `feat/edit-profile`): arrastrar misiones a otro día en el calendario, Deshacer, editar desde el panel del día. 248 pruebas pasan, build OK.
- 2026-10-30: Rama `feat/edit-profile` (sobre `feat/missions-page`): editar nombre, apellidos, usuario y correo en /configuracion con confirmación; requireUser lee el perfil de la base. 243 pruebas pasan, build OK.
- 2026-10-29: Rama `feat/missions-page` (sobre `feat/mobile-layout`): página /misiones, dashboard con resumen de 5 misiones, búsqueda y filtro por dificultad.
- 2026-10-29: Rama `feat/mobile-layout` (sobre `feat/change-password`): navegación móvil con Sheet, navbar y márgenes adaptados, ajustes de tarjetas y filtros. Build OK (sin revisión visual en navegador).
- 2026-10-29: Rama `feat/change-password` (sobre `main`): página /configuracion, cambiar contraseña, engrane del navbar enlazado. 238 pruebas pasan, build OK.
- 2026-10-29: Rama `feat/auth-taglines` (sobre `feat/password-reset`): la frase del panel de login/registro rota entre 6 mensajes con efecto de máquina de escribir. Build OK. `feat/rate-limit`, `feat/password-reset` y `feat/auth-taglines` fusionadas a `main` (fast-forward) con permiso del usuario.
- 2026-10-29: Rama `feat/password-reset` (sobre `feat/rate-limit`): recuperar contraseña por correo, sessionVersion para revocar sesiones, avisos en el login. 232 pruebas pasan, build OK.
- 2026-10-29: Rama `feat/rate-limit` (sobre `main`): tabla RateLimit, límites de login, registro e invitaciones. 220 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/history` (sobre `feat/stats`): página /historial con filtros y paginación. 205 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/stats` (sobre `main`): página /estadisticas con indicadores y gráficas. 201 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/dashboard-upcoming` (sobre `feat/calendar-team`): sección "Próximas fechas" en el dashboard y `?dia=` en el calendario. 190 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/calendar-team` (sobre `feat/calendar`): dueños/admins ven las tareas de todo su equipo en el calendario; texto "Asignada a X" / "Realizada por X". 181 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/calendar` (sobre `main`): página /calendario, helpers puros de mes, completar/crear misiones desde el calendario, toasts de completar extraídos a `completion.tsx`. 180 pruebas pasan, build OK.
- 2026-10-28: Rama `feat/org-task-notifications` (sobre `feat/org-task-review`): modelo Notification, aviso al aprobar ("¡Tarea aprobada! +X XP") o pedir cambios, campana en el navbar con contador y toasts. 163 pruebas pasan, build OK. Fusionada a `main` (fast-forward) con permiso del usuario.
- 2026-10-27: Rama `feat/org-task-review` (sobre `feat/dashboard-hero`): flujo de revisión de tareas de equipo (entregar → aprobar / pedir cambios), enum OrgTaskStatus.
- 2026-10-27: Rama `feat/dashboard-hero` (sobre `feat/dashboard-org-tasks`): rediseño de nivel + estadísticas en ProgressHero; se eliminaron StatsCard y xpHeroCard.
- 2026-10-27: Rama `feat/dashboard-org-tasks` (sobre `feat/org-board`): sección "Tareas de organizaciones" en el dashboard, hook useOrgTaskActions compartido.
- 2026-10-27: Rama `feat/org-board` (sobre `feat/organizations`): modelo OrgTask, tablero con tareas asignadas o libres, tomar/soltar/completar/reabrir, ranking, pestañas Tablero/Miembros. 137 pruebas pasan, build OK.
- 2026-10-27: Rama `feat/organizations`: modelos Organization/Membership/Invitation, roles, invitaciones con enlace de un solo uso, páginas /organizaciones, /organizaciones/[slug] e /invitaciones/[token], AuthShell extraído. 118 pruebas pasan, build OK.
- 2026-10-23: Auditoría inicial del proyecto retomado y creación de este mapa.
- 2026-10-26: Rama `feat/user-profile`: firstName/lastName/username, login con correo o usuario, migración con backfill. 86 pruebas pasan. Usuario demo: `demo` / `demo@taskquest.local`.
- 2026-10-26: Rama `feat/daily-missions-achievements`: migración, misiones diarias, logros, página /logros, sidebar con navegación. 81 pruebas pasan; smoke test con usuario demo.
- 2026-10-26: Rama `feat/dashboard-states`: loading skeleton y error boundary del dashboard.
- 2026-10-26: Rama `test/vitest`: Vitest con 61 pruebas (unit + integración de Server Actions y login).
- 2026-10-26: Rama `feat/tasks`: CRUD de misiones, XP/nivel/racha reales, dashboard conectado, Sonner + Motion. Verificado: typecheck, lint, build, checks de xp/racha y 32 pruebas e2e de Server Actions contra `next start` (validación, XP sin duplicar en paralelo, aislamiento entre usuarios, sin sesión).
- 2026-10-26: Rama `feat/auth`: login/registro/logout con NextAuth Credentials + JWT, proxy de rutas, dashboard protegido. Probado con curl contra `next start` (redirects, login correcto/incorrecto, sesión, callbackUrl externo ignorado).
- 2026-10-26: Remoto GitHub configurado; Fase 1 subida en rama `chore/phase-1-setup`. Rama `feat/database`: `.env` local + migración `init` aplicada (tablas User, Task).
- 2026-10-23: Fase 1 — build arreglado (TaskCard usa DifficultyStyles), pnpm único, Prisma 7 configurado (schema User/Task, config, cliente singleton), `.env.example`, scripts db:*.
