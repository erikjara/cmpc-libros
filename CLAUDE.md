# CMPC-libros — convenciones del proyecto

Guía para quien trabaje en este repositorio, persona o asistente de IA. El detalle funcional y las
decisiones están en `README.md` y `docs/` (`design.md`, `architecture.md`, `database.md`).

## Estructura

- `backend/`: API NestJS 12 (ESM, Express 5) + Prisma 7.10 + PostgreSQL 18. Módulos por dominio en
  `src/` (`books`, `catalog`, `audit`, `auth`, `users`, `storage`, `health`), transversales en
  `src/common/` (interceptores, filtro de errores, validaciones, transformaciones).
- `frontend/`: SPA Vite + React 19, organizada por features en `src/features/` (`books`, `trash`,
  `audit`, `auth`, `catalog`); componentes de shadcn/ui en `src/components/ui/` (generados por su CLI).
- `docs/`: diseño, arquitectura, modelo de datos (Mermaid y DBML) y capturas.
- `docker-compose.yml`: stack completo (PostgreSQL, API, nginx con la SPA y proxy de `/api`).

## Comandos

| Dónde | Comando | Para qué |
|---|---|---|
| raíz | `cp .env.example .env && docker compose up --build` | Stack completo en http://localhost:8080 |
| `backend/` | `npm run start:dev` | API en modo desarrollo (requiere PostgreSQL en `localhost:5432`) |
| `backend/` | `npm run lint` · `npm run typecheck` · `npm run test:cov` | Calidad y tests unitarios (umbral 80 %) |
| `backend/` | `npm run test:e2e` | Integración contra PostgreSQL real (base `cmpc_libros_test`) |
| `frontend/` | `npm run dev` · `npm run lint` · `npm run typecheck` · `npm run test:cov` · `npm run build` | Desarrollo, calidad, tests y build |

Antes de cada commit: lint, typecheck y tests de la app tocada en verde.

## Reglas de código

- **Idioma:** identificadores en inglés; textos de la interfaz, mensajes de error de la API,
  documentación y mensajes de commit en español, con tildes.
- **Commits:** Conventional Commits en español (`feat(books): …`, `fix(auth): …`), pequeños y con
  su test.
- **Dependencias:** versiones exactas (sin `^`) e instalación con `npm ci`.
- **TDD:** primero el test que falla, luego la implementación mínima. Los tests prueban
  comportamiento, no detalles internos. Cobertura mínima de 80 % en las cuatro métricas.
- **Alcance:** implementar lo pedido. Las mejoras que nadie pidió se proponen (Roadmap), no se
  agregan.

## Reglas del backend

- Capas `controller → service → repository`. El controller valida y extrae el usuario; el service
  tiene la lógica y abre la transacción; el repository contiene las consultas Prisma.
- Toda escritura de un libro y su registro de auditoría van en la **misma transacción**: el service
  pasa el cliente `tx` al repositorio y a `AuditService.record(tx, …)`.
- **Soft delete:** toda lectura de libros activos filtra `deletedAt: null` de forma explícita.
- **Concurrencia optimista:** las respuestas de un libro llevan `ETag: "<updatedAt>"`; las
  escrituras con `If-Match` verifican la versión dentro de la transacción (412 si cambió).
- **Errores:** siempre con el formato `{ statusCode, error, message, path, timestamp, requestId }`
  (lo produce el filtro global); nunca exponer mensajes internos en un 500.
- **Entradas de texto:** normalizadas con las transformaciones de `src/common/transforms/`.

## Base de datos y migraciones

- El esquema vive en `backend/prisma/schema.prisma`; los cambios se hacen con
  `npx prisma migrate dev` y se revisa el SQL generado.
- Los índices que Prisma puede representar (incluidos GIN trigram e índices parciales) se
  **declaran en el schema**: un índice creado solo con SQL crudo genera *drift* y Prisma lo
  eliminaría en la siguiente migración.
- Los índices de expresión (p. ej. `lower(name)`) solo pueden ir en SQL; Prisma no los elimina.
  Verificar siempre: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  debe dar una migración vacía.
- Nunca `prisma migrate reset` sobre una base con datos.

## Reglas del frontend

- El estado del listado (página, filtros, búsqueda, orden) vive en la URL y es la clave de caché
  de TanStack Query.
- La sesión es una cookie `httpOnly`: el frontend nunca maneja tokens.
- La CSP no permite `eval`: zod se configura sin JIT en `src/lib/zod-config.ts`, importado antes que
  cualquier schema.
- Al editar, el formulario usa la versión del servidor que muestra (`baseline`) como `If-Match` y
  envía solo los campos modificados.
