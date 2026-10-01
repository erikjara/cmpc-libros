# CMPC-libros — Documento de diseño

> Fecha: 2026-09-30 · Estado: aprobado

## 1. Objetivo y principios

Aplicación web para que la tienda CMPC-libros digitalice su inventario: gestión de libros (título,
autor, editorial, precio, disponibilidad y género) con listado avanzado, alta/edición con imagen,
detalle, exportación CSV y auditoría de operaciones.

Principios que guían el diseño:

- **Decisiones explícitas:** todo supuesto sobre el dominio queda explicado y fundamentado en el
  README (sección "Supuestos y decisiones").
- **Roadmap transparente:** lo que no forma parte de esta versión queda descrito con su diseño
  propuesto (sección "Roadmap").
- **Despliegue simple:** el stack completo se levanta con un único `docker compose up --build`.
- **Calidad verificable:** cobertura de tests ≥ 80 % en backend y frontend, **forzada** por
  configuración y validada en CI.

## 2. Estructura del repositorio (monorepo simple)

```
/
├── backend/            NestJS + Prisma (package.json, Dockerfile, tests propios)
├── frontend/           Vite + React (package.json, Dockerfile + nginx, tests propios)
├── docs/               design.md, architecture.md, database.md, schema.dbml
├── .github/workflows/  CI: lint + tests + cobertura de ambas apps
├── docker-compose.yml
├── .env.example
└── README.md
```

**Decisión:** apps independientes, sin workspaces ni Nx. Minimiza configuración y facilita el
onboarding de nuevos desarrolladores. **Trade-off:** los tipos de la API se duplican entre front y back; mejora
documentada: generar el cliente desde OpenAPI (`openapi-typescript`).

### Stack y versiones

Versiones verificadas contra el registry de npm y las guías oficiales de migración. Se fijan con
versión exacta y lockfile (`npm ci`), en particular por el incidente de supply chain de axios de
marzo de 2026.

| Capa | Tecnología |
|---|---|
| Runtime | Node 24 LTS (`node:24-alpine`), TypeScript 6.0 (TS 7 aún no es soportado por `@nestjs/swagger`) |
| Backend | NestJS 12 (ESM, Express 5), class-validator, `@nestjs/swagger`, Passport JWT, argon2, nestjs-pino |
| Datos | PostgreSQL 18, Prisma 7.10 (`prisma.config.ts`, generator `prisma-client`, `@prisma/adapter-pg`) |
| Frontend | Vite 8, React 19, Tailwind 4, shadcn/ui (Base UI), TanStack Table 9, TanStack Query 5, React Router 8 (data mode), react-hook-form 7 + zod 4, axios, Sonner |
| Tests | Vitest 5 en ambas apps (+ Testing Library, MSW 2, jsdom en el frontend) |
| Infra | Docker Compose, nginx 1.30 |

**Prisma 7 y no 8:** Prisma 8 es una reescritura aún en release candidate; se fija 7.10 (con
soporte extendido) y la migración queda en el Roadmap.

## 3. Modelo de datos (PostgreSQL + Prisma)

### Tablas

| Tabla | Columnas |
|---|---|
| `users` | `id uuid PK`, `email UNIQUE`, `password_hash`, `name`, `created_at`, `updated_at` |
| `authors` | `id uuid PK`, `name UNIQUE`, `created_at` |
| `publishers` | `id uuid PK`, `name UNIQUE`, `created_at` |
| `genres` | `id uuid PK`, `name UNIQUE`, `created_at` |
| `books` | `id uuid PK`, `title`, `author_id FK`, `publisher_id FK`, `genre_id FK`, `price Decimal(10,2)`, `stock Int (CHECK ≥ 0)`, `image_key String?`, `created_at`, `updated_at`, `deleted_at timestamp?` |
| `audit_logs` | `id uuid PK`, `user_id FK → users (nullable)`, `action enum`, `entity`, `entity_id`, `changes jsonb ({before, after})`, `ip`, `user_agent`, `created_at` |

`action` ∈ `CREATE | UPDATE | DELETE | RESTORE | EXPORT | LOGIN`.

### Supuestos

- **Disponibilidad = stock.** Se modela `stock` (entero ≥ 0) y se deriva `available = stock > 0`.
  Una tienda que digitaliza inventario necesita cantidades; un booleano pierde información.
  El filtro "disponible / agotado" se traduce a `stock > 0` / `stock = 0`.
- **Un autor por libro (1:N).** Simplificación consciente; evolución a N:M documentada
  (tabla puente `book_authors` con `position`).
- **Precio en `Decimal`**, nunca `Float`, para evitar errores de redondeo. Moneda asumida: CLP.
- **Autor, editorial y género normalizados** en tablas propias: filtros exactos por ID y sin
  duplicados por tipeo. Los nombres se normalizan con `trim` y se crean vía `connectOrCreate`.

### Índices

- FKs `books.author_id`, `books.publisher_id`, `books.genre_id` (filtros frecuentes).
- Índices **parciales** `WHERE deleted_at IS NULL` sobre `books.created_at`, `books.title` y
  `books.price` (ordenamiento del listado, que siempre excluye eliminados), declarados en el
  schema con la preview feature `partialIndexes` de Prisma 7.
- **GIN `pg_trgm`** sobre `books.title` y `authors.name`: la búsqueda en tiempo real usa
  `ILIKE '%texto%'`, que no puede usar B-tree. La extensión se habilita con SQL crudo en una
  migración (`CREATE EXTENSION IF NOT EXISTS pg_trgm`) y los índices se **declaran en
  `schema.prisma`** (`@@index([title(ops: raw("gin_trgm_ops"))], type: Gin)`). Un índice creado
  solo con SQL crudo genera *drift* y Prisma lo eliminaría en la siguiente migración.
- `audit_logs (entity, entity_id)`, `audit_logs (user_id)`, `audit_logs (created_at)`.

### Transacciones

Crear, editar, eliminar (soft) y restaurar un libro se ejecutan en `prisma.$transaction`, que incluye
el `connectOrCreate` de autor/editorial/género, el cambio del libro y el registro en `audit_logs`.
No puede existir un cambio sin su auditoría ni viceversa.

### Soft delete

`deleted_at` (timestamp) en lugar de booleano: registra cuándo se eliminó y permite purgas por
antigüedad. Los repositorios filtran `deletedAt: null` explícitamente (sin "magia" de middleware),
lo que hace el comportamiento visible y testeable.

## 4. Backend (NestJS)

### Módulos

| Módulo | Responsabilidad |
|---|---|
| `config` | Carga y valida variables de entorno al arrancar (falla rápido) |
| `prisma` | `PrismaService` global, conexión y shutdown hooks |
| `auth` | Login/logout, `JwtStrategy` (cookie o Bearer), `JwtAuthGuard` **global** + decorador `@Public()`, throttling en login |
| `users` | `UsersRepository` (búsqueda por email). Usuarios creados por seed |
| `books` | `BooksController` → `BooksService` → `BooksRepository`; `BooksExportService`; DTOs |
| `catalog` | Listados de `authors`, `publishers`, `genres` con `?search=` |
| `audit` | `AuditService.record(tx, entry)` y `GET /audit-logs` paginado |
| `storage` | Interfaz `StorageService` (token de inyección) + `LocalDiskStorageService` |
| `health` | `GET /health` para el healthcheck de Docker |
| `common` | Interceptores, filtro de excepciones, decoradores, utilidades de paginación |

### Capas y SOLID

- **SRP:** controller (entrada/validación/usuario actual) · service (reglas y transacción) ·
  repository (queries Prisma).
- **DIP / OCP:** `StorageService` es una interfaz inyectada por token; cambiar a S3 es agregar
  una implementación sin tocar `BooksService`.
- Los repositorios reciben el cliente transaccional `tx`, lo que permite componer libro + auditoría
  en una transacción sin acoplar `BooksRepository` a `AuditService`.
- El usuario actual y la IP se pasan **explícitamente** del controller al service (sin contexto
  implícito), para facilitar los tests.
- Lógica pura extraída: `parseSort(string)` y `buildBookQuery(filters) → { where, orderBy }`.

### Endpoints (prefijo `/api`, Swagger en `/api/docs`)

| Método | Ruta | Notas |
|---|---|---|
| POST | `/auth/login` | Público, rate limit. Emite la cookie de sesión y responde `{ user }` |
| POST | `/auth/logout` | Elimina la cookie de sesión |
| GET | `/auth/me` | Usuario autenticado |
| GET | `/books` | `page`, `limit` (máx. 100), `search`, `genreId`, `publisherId`, `authorId`, `available`, `sort` |
| GET | `/books/export` | Mismos filtros; CSV en streaming. Declarada antes de `/books/:id` |
| GET | `/books/trash` | Libros eliminados, paginados y con búsqueda (papelera) |
| GET | `/books/:id` | Detalle |
| POST | `/books` | JSON; autor/editorial/género por `id` o por `name` (connectOrCreate) |
| PATCH | `/books/:id` | Edición parcial; `If-Match` opcional (concurrencia optimista, 412) |
| DELETE | `/books/:id` | Soft delete, 204 |
| POST | `/books/:id/restore` | Revierte el soft delete |
| POST | `/books/:id/image` | Multipart; jpeg/png/webp, ≤ 2 MB, nombre UUID |
| GET | `/authors`, `/publishers`, `/genres` | `?search=` para autocomplete |
| GET | `/audit-logs` | Paginado, filtrable por entidad |
| GET | `/health` | Público |

**Ordenamiento:** `sort=price:desc,title:asc`; lista blanca de campos (`title`, `price`, `stock`,
`createdAt`, `author`, `publisher`, `genre`). Campo no permitido → 400.

**Búsqueda:** `search` hace `ILIKE` sobre título y nombre de autor (apoyado en índices trigram).

**Exportación CSV:** lectura por lotes con cursor, escrita a un stream (sin cargar todo en memoria),
BOM UTF-8, separador `;` y coma decimal (formato que espera Excel con configuración regional
es-CL), registra `EXPORT` en auditoría.

**Concurrencia optimista:** las respuestas de un libro llevan `ETag: "<updatedAt>"`. `PATCH` con
`If-Match` compara dentro de la transacción (update condicional por `id` + `updatedAt`) y responde
412 si el libro cambió. Un `PATCH` sin cambios efectivos no actualiza ni audita.

### Transversales

- `TransformInterceptor`: respuestas `{ data, meta }`; no envuelve `StreamableFile`.
- `ETagInterceptor`: agrega `ETag` a las respuestas de un libro.
- Logging HTTP con `nestjs-pino` (pino-http): logs JSON por request con `requestId`, método, ruta,
  status y duración. Se usa el logger automático de pino-http y no un interceptor, porque un
  interceptor no registra las respuestas que se resuelven antes de llegar al controller (401 del
  guard, 404 de rutas inexistentes).
- `AllExceptionsFilter`: error uniforme `{ statusCode, error, message, path, timestamp, requestId }`;
  mapea Prisma `P2025` → 404 y `P2002` → 409.
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), `helmet`, CORS
  restringido al origen del frontend.
- Contraseñas con **Argon2id** (primera recomendación de OWASP; bcrypt se considera legado y
  trunca a 72 bytes). `JWT_SECRET` y expiración desde variables de entorno validadas.

### Sesión

- El JWT viaja en una **cookie `httpOnly`, `SameSite=Strict`** (`Secure` en producción). El
  frontend nunca accede al token, por lo que un XSS no puede robarlo (OWASP desaconseja
  `localStorage` para tokens).
- CSRF mitigado por `SameSite=Strict` y porque frontend y API comparten origen (nginx hace de
  reverse proxy de `/api`; en desarrollo, el proxy de Vite).
- `JwtStrategy` extrae el token de la cookie **o** del header `Authorization: Bearer`, para que
  Swagger y clientes de API sigan funcionando.

### Supuestos

- Sin registro público: herramienta interna; usuarios creados por seed (`admin@cmpc.cl`).
- La imagen se sube en un endpoint separado del JSON del libro: CRUD limpio y contrato Swagger
  simple. Trade-off: 2 requests; si falla la imagen, el libro queda guardado y la UI lo informa.
- Imágenes en disco local (volumen Docker) servidas como estáticos bajo `/api/uploads`.

## 5. Frontend (Vite + React + TypeScript)

### Stack

shadcn/ui (primitivas **Base UI**, el default actual de shadcn, + Tailwind v4), **TanStack Table 9**
(headless), TanStack Query, React Router 8 en *data mode* (`createBrowserRouter`),
react-hook-form + zod, axios, Sonner (toasts).

**Decisión documentada:** se descartó MUI X DataGrid porque el ordenamiento multi-columna es una
funcionalidad Pro. TanStack Table soporta `manualSorting`, `manualPagination` y `enableMultiSort`
de forma nativa y gratuita.

### Estructura por features

```
src/
├── app/          providers (QueryClient, Auth, Toaster), router, layout
├── components/ui componentes shadcn (generados por CLI; excluidos de cobertura)
├── lib/          httpClient (axios + interceptor de errores), ApiError, formatters es-CL
├── features/
│   ├── auth/     useSession (query /auth/me), loader requireAuth, LoginPage, logout
│   ├── books/    books.api.ts, hooks, BooksListPage, BooksTable, BooksFilters,
│   │             BookFormPage, BookForm (+ schema zod), ImagePicker, BookDetailPage
│   ├── trash/    TrashPage (libros eliminados, restaurar)
│   ├── audit/    AuditPage, summarizeChanges (resumen legible de cada operación)
│   └── catalog/  hooks de autores/editoriales/géneros, CatalogCombobox
└── shared/       useDebounce, ConfirmDialog, ErrorBoundary, EmptyState, NotFoundPage
```

Rutas: `/login`, `/books`, `/books/new`, `/books/:id`, `/books/:id/edit`, `/trash`, `/audit`.
Todas salvo login cuelgan de una ruta de layout protegida cuyo `loader` (`requireAuth`) valida la
sesión con `/auth/me` antes de renderizar. Las páginas secundarias se cargan de forma diferida
(`lazy` de React Router) y el layout es responsive desde 360 px.

### Papelera y auditoría

- `/trash`: libros eliminados (`GET /api/books/trash`) con búsqueda, paginación y "Restaurar". El
  aviso de eliminación ofrece además "Deshacer".
- `/audit`: registro de `GET /api/audit-logs`, paginado y filtrable por entidad, con un resumen
  legible de cada operación (campos modificados con su valor anterior y nuevo).

### Listado

- Estado (página, filtros, búsqueda, orden) **en la URL** vía `useSearchParams`: compartible,
  sobrevive a recargas y es el `queryKey` de TanStack Query.
- Búsqueda con debounce de 400 ms; cambiar búsqueda o filtros vuelve a página 1.
- Filtros: género, editorial y autor (combobox con búsqueda en servidor), disponibilidad
  (todos / disponible / agotado), botón "Limpiar filtros".
- Orden: clic en encabezado ordena solo por esa columna (asc → desc → sin orden); Mayús + clic la
  agrega al orden múltiple; badge de prioridad por columna y pista visible.
- Paginación del servidor; `placeholderData: keepPreviousData` para evitar parpadeo.
- Skeleton de carga, estado vacío, botón "Exportar CSV": un enlace a `/api/books/export` con los
  filtros activos (la cookie de sesión viaja sola; no hace falta descargar un blob).

### Formulario (alta y edición)

- react-hook-form + zod en `mode: 'onChange'` (validación reactiva, errores por campo, submit
  deshabilitado si inválido o enviando), con los componentes `Field` de shadcn y `Controller`.
- Autor/editorial/género con el `Combobox` de shadcn en modo "elegir o crear".
- `ImagePicker` con preview y validación cliente (tipo, ≤ 2 MB), igual regla que el backend.
- Guardar: mutación → subida de imagen si corresponde → invalidación de queries → toast → detalle.

### Detalle

Imagen o placeholder, todos los datos, chip "Disponible (n)" / "Agotado", precio en CLP,
acciones Editar y Eliminar (con confirmación).

### Autenticación y errores

- Sesión por cookie httpOnly (ver sección 4): el frontend no almacena tokens. `useSession`
  consulta `/auth/me` y se invalida en login/logout.
- Interceptor axios (`withCredentials`): ante 401 limpia la sesión y redirige a `/login`
  recordando la ruta de origen; normaliza errores a `ApiError { status, message }`.
- Errores de mutaciones → toast; errores de queries → inline con "Reintentar";
  `ErrorBoundary` global para errores de render.

## 6. Testing

**Vitest en ambas apps** (default de NestJS 12 y de Vite): un solo runner y una sola forma de
configurar cobertura. Umbral de 80 % (líneas, ramas, funciones, sentencias) en
`coverage.thresholds`, con `coverage.include` explícito para medir también archivos sin tests; el
comando de cobertura falla si no se alcanza.

**Backend (Vitest + `vitest-mock-extended` para el cliente Prisma):** services con repositorios mockeados (incluye verificar que la auditoría usa el
mismo `tx`), controllers con services mockeados, `parseSort` y `buildBookQuery`,
`TransformInterceptor`, `AllExceptionsFilter`, `JwtAuthGuard`/`@Public()`, extracción del token
(cookie/Bearer), `BooksExportService`
(escapado CSV, BOM) y `LocalDiskStorageService` (directorio temporal).
Excluidos de cobertura: `main.ts`, `*.module.ts`, DTOs, cliente generado de Prisma.
Integración (`npm run test:e2e`): suite contra PostgreSQL real en una base dedicada
`cmpc_libros_test` (guard global, soft delete en todas las lecturas, rollback real, escape de la
búsqueda, paginación estable, concurrencia optimista, imágenes, CSV y papelera). También corre
en CI con un servicio PostgreSQL.

**Frontend (Vitest + Testing Library + MSW):** `useDebounce` (fake timers), `useBookSearchParams`,
hooks de queries/mutaciones, `httpClient` (401, `ApiError`), `requireAuth`, `LoginPage`, `BooksTable`
(clic en encabezados → `sort` en URL), `BooksFilters`, `BookForm` (validación), `ImagePicker`,
`BookDetailPage`. Setup con polyfills para jsdom que requieren las primitivas de UI
(`ResizeObserver`, `matchMedia`, `IntersectionObserver`, pointer capture, `scrollIntoView`,
`getAnimations`).
Excluidos: `src/components/ui/**`, `main.tsx`.

## 7. DevOps

- `docker-compose.yml`:
  - `db`: `postgres:18-alpine`, healthcheck, volumen persistente montado en `/var/lib/postgresql`
    (ruta que cambió en la imagen 18).
  - `backend`: Dockerfile multi-stage, usuario no root; al iniciar `prisma migrate deploy` →
    seed idempotente (admin siempre; ~60 libros de demostración solo con `SEED_DEMO_DATA=true` y
    tabla vacía) → `node dist/main`. Volumen `uploads`.
    `depends_on` con `condition: service_healthy`.
  - `frontend`: build de Vite servido por nginx, que también hace reverse proxy de `/api` al
    backend (mismo origen, sin CORS en el despliegue).
  - App en `http://localhost:8080`; Swagger en `http://localhost:8080/api/docs`.
- `.env.example` en raíz y por app; sin secretos en el código.
- GitHub Actions: lint + tests + cobertura de backend y frontend en cada push.
- Commits pequeños y descriptivos (Conventional Commits) para un historial trazable.

## 8. Documentación

- `README.md`: requisitos, instalación (Docker y local), variables de entorno, credenciales demo,
  guía de uso, arquitectura, **Supuestos y decisiones**, **Roadmap**, tests y cobertura.
- `docs/architecture.md`: diagrama de arquitectura (Mermaid) y ciclo de una request
  (guard → pipe → controller → service → transacción → interceptor).
- `docs/database.md` + `docs/schema.dbml`: modelo relacional en Mermaid `erDiagram` y DBML para
  dbdiagram.io.
- Swagger: DTOs con `@ApiProperty` y ejemplos, `@ApiBearerAuth`, respuestas de error documentadas.

## 9. Roadmap

Evoluciones previstas para próximas versiones, con su diseño propuesto:

| Evolución | Diseño propuesto |
|---|---|
| Refresh tokens | Access token de vida corta en cookie + refresh token rotativo en cookie httpOnly restringida a `/api/auth/refresh`, almacenado hasheado en BD con detección de reutilización |
| Roles (RBAC) | Columna `role` en `users`, decorador `@Roles()` + `RolesGuard` |
| Almacenamiento S3/MinIO | Nueva clase `S3StorageService implements StorageService`, seleccionada por variable de entorno |
| Export masivo asíncrono | Cola BullMQ + Redis, job que genera el archivo y notifica/descarga por URL firmada |
| Varios autores por libro | Tabla puente `book_authors (book_id, author_id, position)` |
| Cliente tipado | `openapi-typescript` generado desde el Swagger del backend |
| Tests e2e de interfaz | Playwright contra el stack de Docker Compose en CI |
| Base de integración aislada | Testcontainers: PostgreSQL efímero por suite |
| Revocación de sesiones | `token_version` en `users`, incluido en el JWT y verificado por la estrategia; el logout lo incrementa |
| Gestión de catálogos | Renombrar o fusionar autores, editoriales y géneros; ocultar los que no tienen libros activos |
| Prisma 8 | Migrar cuando alcance GA; el acceso a datos está aislado en repositorios, lo que acota el cambio |
