# CMPC-libros

[![CI](https://github.com/erikjara/cmpc-libros/actions/workflows/ci.yml/badge.svg)](https://github.com/erikjara/cmpc-libros/actions/workflows/ci.yml)
![Cobertura backend](https://img.shields.io/badge/cobertura%20backend-99%25-brightgreen)
![Cobertura frontend](https://img.shields.io/badge/cobertura%20frontend-97%25-brightgreen)

Aplicación web para gestionar el inventario de la tienda CMPC-libros. Permite mantener el
catálogo de libros (título, autor, editorial, género, precio y stock), buscarlo y filtrarlo en
tiempo real, cargar portadas, exportar el inventario a CSV y consultar la auditoría de cada
operación.

## Funcionalidades

- **Inicio de sesión** con sesión segura en cookie `httpOnly`.
- **Listado de libros** con paginación del servidor, búsqueda en tiempo real por título o autor,
  filtros por género, editorial, autor y disponibilidad, y ordenamiento por varias columnas a la
  vez.
- **Alta y edición** con validación en vivo, autor, editorial y género a elegir o crear en el
  mismo formulario, y carga de imagen de portada con vista previa.
- **Detalle** del libro con su disponibilidad y precio en pesos chilenos.
- **Eliminación reversible** (soft delete): confirmación, acción "Deshacer" en el aviso y
  **papelera** para consultar y restaurar libros eliminados.
- **Exportación CSV** del listado con los filtros activos, en el formato que Excel espera con
  configuración regional chilena (`;` como separador y coma decimal).
- **Auditoría** de altas, ediciones, eliminaciones, restauraciones, exportaciones e inicios de
  sesión, registrada en la misma transacción que el cambio y consultable en su propia vista con
  un resumen legible de cada cambio.
- **Edición concurrente segura:** si otra persona modificó el libro mientras lo editabas, el
  guardado se rechaza en vez de sobrescribir sus cambios.
- **Diseño adaptable** a móvil (desde 360 px) y carga diferida de páginas.
- **API REST documentada** con Swagger.

## Capturas

Listado con búsqueda, filtros, orden por varias columnas y paginación:

![Listado de libros con filtros y orden por varias columnas](docs/images/listado.png)

| Inicio de sesión | Detalle de un libro |
|---|---|
| ![Pantalla de inicio de sesión](docs/images/login.png) | ![Detalle de un libro con portada](docs/images/detalle.png) |

| Alta con portada | Confirmación de eliminación |
|---|---|
| ![Formulario de alta con vista previa de la portada](docs/images/formulario.png) | ![Diálogo de confirmación de eliminación](docs/images/eliminar.png) |

| Papelera | Auditoría |
|---|---|
| ![Papelera con libros eliminados y acción Restaurar](docs/images/papelera.png) | ![Vista de auditoría con el resumen de cada operación](docs/images/auditoria.png) |

<img src="docs/images/movil.png" alt="Listado en un teléfono (360 px)" width="240" align="right">

Vista móvil (360 px): filtros apilados, navegación compacta y tabla con desplazamiento propio,
sin scroll horizontal de la página.

<br clear="right">

Documentación interactiva de la API:

![Swagger de la API](docs/images/swagger.png)

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript 6.0 |
| Backend | NestJS 12 (ESM, Express 5), Prisma 7.10 con `@prisma/adapter-pg`, Passport JWT, argon2, class-validator, nestjs-pino, `@nestjs/swagger` |
| Base de datos | PostgreSQL 18 (extensión `pg_trgm`) |
| Frontend | Vite 8, React 19, Tailwind CSS 4, shadcn/ui sobre Base UI, TanStack Table 9, TanStack Query 5, React Router 8, react-hook-form 7 + zod 4, axios, Sonner |
| Tests | Vitest 5 en ambas aplicaciones; Testing Library, MSW 2 y jsdom en el frontend; `vitest-mock-extended` en el backend |
| Infraestructura | Docker Compose, nginx 1.30, GitHub Actions |

Las dependencias se fijan con versión exacta y lockfile, y se instalan con `npm ci`.

## Inicio rápido con Docker

Requisitos: Docker con Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

El primer arranque construye las imágenes, aplica las migraciones y carga los datos de ejemplo.
Cuando los tres servicios estén en estado `healthy`:

| Recurso | URL |
|---|---|
| Aplicación | http://localhost:8080 |
| Documentación de la API (Swagger) | http://localhost:8080/api/docs |
| Estado de la API | http://localhost:8080/api/health |

**Credenciales de demo:** `admin@cmpc.cl` / `Admin123!` (definidas en `.env` con
`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`).

Comandos útiles:

```bash
docker compose ps                 # estado y healthchecks de los servicios
docker compose logs -f backend    # logs JSON de la API
docker compose down               # detiene el stack y conserva los datos
docker compose down -v            # detiene el stack y elimina base de datos e imágenes subidas
```

Los datos de ejemplo se cargan con un seed idempotente: reiniciar el stack no duplica registros.

## Desarrollo local

Requisitos: Node.js 24 y npm 11. Docker se usa solo para PostgreSQL.

1. **Base de datos**

   ```bash
   docker run -d --name cmpc-postgres \
     -e POSTGRES_USER=cmpc -e POSTGRES_PASSWORD=cmpc -e POSTGRES_DB=cmpc_libros \
     -p 5432:5432 -v cmpc-pgdata:/var/lib/postgresql \
     postgres:18-alpine
   ```

2. **Backend** (http://localhost:3000/api, Swagger en http://localhost:3000/api/docs)

   ```bash
   cd backend
   cp .env.example .env
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   npm run start:dev
   ```

3. **Frontend** (http://localhost:5173)

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   El servidor de Vite reenvía `/api` a `http://localhost:3000`, de modo que frontend y API
   comparten origen igual que en Docker.

## Variables de entorno

Docker Compose lee `.env` en la raíz (plantilla: `.env.example`). Para desarrollo local, el
backend usa `backend/.env` (plantilla: `backend/.env.example`). La configuración se valida al
arrancar: si falta una variable obligatoria o tiene un formato inválido, la API no inicia.

| Variable | Uso | Valor de demo (Docker) |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales y base de datos del servicio `db` | `cmpc`, `cmpc`, `cmpc_libros` |
| `NODE_ENV` | `development`, `production` o `test` | `production` |
| `PORT` | Puerto HTTP de la API (solo desarrollo local; en Docker es `3000`) | `3000` |
| `DATABASE_URL` | Conexión a PostgreSQL (solo desarrollo local; en Docker la construye `docker-compose.yml` desde `POSTGRES_*`) | `postgresql://cmpc:cmpc@localhost:5432/cmpc_libros?schema=public` |
| `JWT_SECRET` | Firma de los JWT; mínimo 32 caracteres | valor de demo; generar uno con `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Duración de la sesión | `8h` |
| `COOKIE_SECURE` | Marca la cookie de sesión como `Secure`; `true` cuando se sirve por HTTPS | `false` |
| `CORS_ORIGIN` | Origen permitido para peticiones con credenciales | `http://localhost:8080` |
| `UPLOADS_DIR` | Directorio de imágenes de portada (solo desarrollo local; en Docker es el volumen `uploads`) | `./uploads` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Usuario administrador creado por el seed | `admin@cmpc.cl`, `Admin123!` |
| `SEED_DEMO_DATA` | Carga ~60 libros de demostración si la base no tiene libros (`false` por defecto) | `true` |

En Docker, `docker-compose.yml` entrega a la API solo las variables que usa y deriva `DATABASE_URL` de
`POSTGRES_*`, así que cambiar las credenciales en un único lugar basta. En desarrollo local el host
de la base es `localhost` y `CORS_ORIGIN` es `http://localhost:5173`.

### Checklist para producción

Los valores de `.env.example` son de demostración para levantar el stack localmente. Antes de un
despliegue real:

- Generar un `JWT_SECRET` propio (p. ej. `openssl rand -base64 48`); el de ejemplo es público.
- Cambiar `SEED_ADMIN_PASSWORD` (o crear el usuario administrador por otra vía): el seed solo crea
  el usuario si no existe y nunca sobrescribe su contraseña.
- Dejar `SEED_DEMO_DATA=false` para no cargar libros de demostración.
- Si la API queda expuesta a Internet, restringir `/api/docs` (Swagger) en nginx a la red interna
  con `allow`/`deny`; está habilitado en todos los entornos porque es la documentación de la API.
- Usar credenciales de PostgreSQL propias y no exponer el puerto de la base de datos.
- Servir detrás de HTTPS y activar `COOKIE_SECURE=true` (habilita además HSTS).

## Guía de uso

### Iniciar sesión

Abre http://localhost:8080 e ingresa con las credenciales de demo. La sesión dura lo definido en
`JWT_EXPIRES_IN`; cuando expira, la aplicación vuelve a la pantalla de login y, tras ingresar,
regresa a la página en la que estabas.

### Listado de libros

- **Búsqueda:** escribe en el buscador para filtrar por título o autor. La búsqueda se aplica
  automáticamente al dejar de escribir.
- **Filtros:** género, editorial, autor y disponibilidad (todos, disponibles o agotados).
  "Limpiar filtros" vuelve al listado completo.
- **Orden:** un clic en un encabezado ordena solo por esa columna y alterna ascendente,
  descendente y sin orden. **Mayús + clic** agrega la columna al orden existente para ordenar por
  varias a la vez; un indicador muestra la prioridad de cada una (por ejemplo, primero por género
  y, dentro de cada género, por precio).
- **Paginación:** la navegación entre páginas se resuelve en el servidor.
- **URL compartible:** la página, la búsqueda, los filtros y el orden quedan en la URL, así que un
  listado se puede recargar o compartir tal cual.

### Crear y editar un libro

Desde el listado, "Nuevo libro" abre el formulario. Los errores se muestran por campo mientras
escribes y el botón de guardar se habilita cuando el formulario es válido.

- **Autor, editorial y género:** elige un valor existente o escribe uno nuevo; se crea al
  guardar el libro.
- **Precio** en pesos chilenos, escrito como se acostumbra en Chile: `15990`, `15.990` (punto
  como separador de miles) o con decimales `15.990,50`. **Stock** como cantidad entera; un libro
  con stock 0 figura como agotado.
- **Edición simultánea:** si mientras editabas otra persona guardó cambios en el mismo libro, la
  aplicación avisa y no sobrescribe esos cambios; al recargar ves la versión actual.
- **Portada:** JPEG, PNG o WebP de hasta 2 MB, con vista previa antes de guardar. La imagen se
  sube después de guardar los datos; si la subida falla, el libro queda guardado y la aplicación
  lo informa para reintentar desde la edición.

### Detalle

Muestra la portada (o una imagen genérica), todos los datos del libro, su disponibilidad
("Disponible" con la cantidad en stock, o "Agotado") y el precio en CLP, junto con las acciones
Editar y Eliminar.

### Eliminar

La eliminación pide confirmación y es reversible: el libro deja de aparecer en el listado, pero
se conserva en la base de datos. El aviso de eliminación ofrece **"Deshacer"** durante unos
segundos, y la sección **Papelera** lista los libros eliminados (con búsqueda, paginación y fecha de
eliminación) y permite **restaurarlos**. Por API: `GET /api/books/trash` y
`POST /api/books/:id/restore`.

### Exportar a CSV

"Exportar CSV" descarga el inventario con los filtros y la búsqueda activos (sin paginar). El
archivo usa UTF-8 con BOM para que Excel muestre correctamente tildes y eñes, `;` como separador
y coma decimal en el precio (lo que espera Excel con configuración regional chilena), y trae las
columnas `ID; Título; Autor; Editorial; Género; Precio; Stock; Disponible; Creado`. La exportación
se genera en streaming y queda registrada en la auditoría.

### Auditoría

Cada alta, edición, eliminación, restauración, exportación e inicio de sesión queda registrada con
el usuario, la IP, la fecha y, en los cambios, los valores anteriores y nuevos. La sección
**Auditoría** muestra el registro paginado, filtrable por entidad, con un resumen de cada operación
(por ejemplo, "precio: $29.990 → $27.990 · stock: 11 → 7"). También se consulta por API:

```bash
# Últimas operaciones
curl -b cookies.txt 'http://localhost:8080/api/audit-logs?limit=20'
# Historial de un libro
curl -b cookies.txt 'http://localhost:8080/api/audit-logs?entity=Book&entityId=<id-del-libro>'
```

### API y Swagger

La documentación interactiva está en http://localhost:8080/api/docs y está disponible en todos
los entornos, también con `NODE_ENV=production`. Swagger comparte origen con la aplicación:
después de ejecutar `POST /api/auth/login` desde Swagger (o de iniciar sesión en la aplicación en
el mismo navegador), las siguientes llamadas usan la cookie de sesión. Los clientes de API
también pueden enviar el token en `Authorization: Bearer <jwt>`.

`POST /api/auth/logout` es público y responde siempre 204: limpia la cookie aunque la sesión ya
haya expirado y, si recibe un token válido, invalida todos los tokens emitidos para ese usuario.

**Concurrencia optimista:** las respuestas de un libro incluyen `ETag: "<updatedAt>"`. Si un
`PATCH /api/books/:id` envía `If-Match` con ese valor y el libro cambió entretanto, la API
responde 412 en lugar de sobrescribir. Sin `If-Match`, la última escritura prevalece (útil para
scripts). Un `PATCH` que no cambia ningún valor no modifica el libro ni genera auditoría. Los parámetros de query no declarados se rechazan con 400, y los filtros vacíos o
con solo espacios se tratan como ausentes.

Ejemplo con `curl`:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@cmpc.cl","password":"Admin123!"}' \
  http://localhost:8080/api/auth/login

curl -b cookies.txt 'http://localhost:8080/api/books?search=neruda&sort=price:desc,title:asc&limit=5'
```

Las respuestas exitosas tienen la forma `{ data, meta? }` y los errores
`{ statusCode, error, message, path, timestamp, requestId }`.

## Arquitectura

```mermaid
flowchart LR
    user["Navegador"] -- "HTTP :8080" --> web["nginx<br/>SPA + proxy /api"]
    web -- "/api/*" --> api["NestJS 12"]
    api --> db[("PostgreSQL 18")]
    api --> uploads[("volumen uploads")]
```

- nginx sirve el frontend y reenvía `/api` al backend: un único origen, así que el navegador no
  necesita CORS. La API mantiene CORS restringido a `CORS_ORIGIN` para el desarrollo local
  (Vite en otro puerto) y para otros clientes.
- El backend se organiza en capas controller → service → repository, con transacciones que
  incluyen la auditoría.
- El frontend se organiza por features y guarda el estado del listado en la URL.

Detalle completo:

- [docs/architecture.md](docs/architecture.md): componentes, módulos, ciclo de una request y
  decisiones de diseño.
- [docs/database.md](docs/database.md): modelo relacional, índices, soft delete y transacciones.
- [docs/schema.dbml](docs/schema.dbml): el mismo modelo en DBML para
  [dbdiagram.io](https://dbdiagram.io).
- [docs/design.md](docs/design.md): documento de diseño de la solución.

## Supuestos y decisiones

### Dominio

- **Disponibilidad = stock.** Se guarda `stock` (entero ≥ 0) y la disponibilidad se deriva como
  `stock > 0`. Una tienda que digitaliza su inventario necesita cantidades; un booleano perdería
  esa información y podría contradecir al stock. El filtro "disponible / agotado" se traduce a
  `stock > 0` / `stock = 0`.
- **Un autor por libro.** Cubre la gran mayoría del catálogo y mantiene simples los filtros y el
  formulario. La evolución a varios autores está diseñada (ver Roadmap).
- **Precio en `Decimal(10,2)` y moneda CLP.** El dinero nunca se guarda como `float`, que
  acumula errores de redondeo. Se admiten dos decimales para no limitar el modelo a una moneda
  sin centavos; la interfaz solo muestra decimales cuando el precio los tiene.
- **Autor, editorial y género normalizados** en tablas propias con nombre único: los filtros son
  exactos por ID y no se duplican valores por diferencias de espacios.
- **Escritura por nombre con upsert.** El formulario envía el nombre del autor, la editorial y el
  género; el backend lo normaliza y lo busca o crea dentro de la misma transacción que guarda el
  libro. El campo "elegir o crear" no necesita distinguir entre valores existentes y nuevos.
- **Autor, editorial y género únicos sin distinguir mayúsculas, garantizado en la base.** Índices
  únicos sobre `lower(name)`: "pablo neruda" se conecta con "Pablo Neruda" y se conserva el
  nombre guardado, venga de la interfaz o de cualquier cliente de la API. Las altas simultáneas
  del mismo nombre se resuelven con el reintento de la transacción. Se descartó `citext` porque
  dejaba sin uso el índice trigram de la búsqueda.
- **Eliminación reversible (soft delete)** con `deleted_at`: conserva el historial, permite
  restaurar y mantiene íntegra la auditoría.
- **Sin registro público.** Es una herramienta interna; los usuarios se crean con el seed.

### API

- **Imagen en un endpoint separado** (`POST /api/books/:id/image`, multipart). El CRUD del libro
  sigue siendo JSON puro y su contrato en Swagger es simple. El costo son dos requests al crear
  con portada; si la imagen falla, el libro queda guardado y la interfaz lo informa.
- **Imágenes en disco local** (volumen Docker) con nombre UUID, validadas por tipo y tamaño. El
  almacenamiento está detrás de una interfaz, lo que permite pasar a S3 sin tocar la lógica de
  libros.
- **Auditoría transaccional.** Cada cambio y su registro de auditoría se confirman juntos.
- **Concurrencia optimista con `ETag`/`If-Match`** en lugar de bloqueos en la base: no retiene
  filas mientras alguien tiene el formulario abierto y usa la semántica HTTP estándar (412
  Precondition Failed). El `If-Match` es opcional para no romper a clientes simples; la interfaz
  siempre lo envía.
- **Interceptores de respuesta.** `TransformInterceptor` envuelve las respuestas en `{ data, meta }`
  y `ETagInterceptor` agrega el `ETag` de los libros, que habilita la concurrencia optimista.
- **Seed separado en datos esenciales y de demostración.** El usuario administrador se asegura en
  cada arranque; los libros de demostración solo se cargan con `SEED_DEMO_DATA=true` y si la base
  no tiene libros, de modo que un reinicio nunca recrea ni duplica datos editados.
- **Exportación en streaming** con lectura por lotes: el tamaño del inventario no afecta la
  memoria del servidor.
- **Formato del CSV para Excel en Chile.** Separador `;` y coma decimal en el precio, que es lo
  que Excel espera con configuración regional es-CL (con `,` el archivo se abriría en una sola
  columna). Las fechas van en ISO 8601 (UTC) para que no dependan de la zona horaria de quien
  abre el archivo. Las celdas que empiezan con `=`, `+`, `-`
  o `@` se prefijan con `'` para evitar la inyección de fórmulas al abrirlo en una planilla.
- **Logging HTTP con pino-http.** Cada request produce una línea JSON con `requestId`, método,
  ruta, status y duración. Se usa el middleware de pino-http y no un interceptor, porque un
  interceptor no registra las respuestas que se resuelven antes del controller (el 401 del guard
  o el 404 de una ruta inexistente).
- **IP real detrás de nginx.** El backend confía en un salto de proxy (`trust proxy`), de modo
  que la IP de la auditoría y el límite de intentos de login corresponden al cliente y no al
  contenedor de nginx.

### Seguridad

- **JWT en cookie `httpOnly` y no en `localStorage`.** El código del navegador nunca accede al
  token, por lo que un XSS no puede robarlo (OWASP desaconseja guardar tokens en
  `localStorage`). La cookie es `SameSite=Strict` y, como nginx sirve frontend y API en el mismo
  origen, el navegador no necesita CORS. La API también acepta `Authorization: Bearer`
  para Swagger y otros clientes.
- **Logout que revoca la sesión.** Cada usuario tiene un `token_version` que viaja en el JWT y se
  verifica en cada request (una lectura por clave primaria); el logout lo incrementa e invalida
  todos los tokens emitidos, por cookie o Bearer, en todos los dispositivos. Un token de un
  usuario inexistente responde 401.
- **Argon2id para contraseñas**, primera recomendación de OWASP; bcrypt se considera legado y
  trunca las contraseñas a 72 bytes.
- **Content-Security-Policy estricta en la SPA** (`script-src 'self'`, sin `unsafe-eval`). Por eso
  zod se configura sin compilación JIT de validadores (`jitless`), que necesitaría `new Function`.
- **Rate limit solo en el login** (5 intentos por minuto e IP, en memoria del proceso). Los
  intentos fallidos se registran con la IP y el email enmascarado (`a***@dominio`), sin
  dejar datos personales completos en los logs. Suficiente para una instancia; con varias
  réplicas se necesita un store compartido (ver Roadmap).
- **Un único proxy de confianza.** `trust proxy = 1` asume exactamente nginx delante del backend;
  la API no debe exponerse directamente, porque un `X-Forwarded-For` falsificado alteraría la IP
  registrada y el rate limit.
- **Imágenes validadas por contenido**, no por la extensión ni el `Content-Type` declarado: se
  comprueba la firma de bytes de JPEG, PNG o WebP, el nombre en disco es un UUID (sin rutas del
  cliente) y se sirven con `X-Content-Type-Options: nosniff`.
- **Advertencia de secreto de demo.** Si `JWT_SECRET` es el valor de ejemplo, la API arranca pero
  registra una advertencia al iniciar (ver "Checklist para producción").

### Frontend

- **shadcn/ui sobre Base UI**, las primitivas por defecto de shadcn: componentes accesibles cuyo
  código vive en el repositorio y se adapta sin depender de un tema cerrado.
- **TanStack Table en lugar de MUI X DataGrid.** En DataGrid el ordenamiento por varias columnas
  es una funcionalidad de pago (Pro); TanStack Table ofrece orden múltiple, orden manual y
  paginación del servidor de forma nativa y gratuita, y deja el marcado bajo nuestro control.
- **Estado del listado en la URL**, que además es la clave de caché de TanStack Query.
- **Etiquetas de filtros tras recargar.** La URL guarda el ID del autor o la editorial filtrados;
  al recargar, la etiqueta visible se resuelve con `GET /api/authors?limit=50` (o
  `/api/publishers`). Un endpoint por ID está en el Roadmap.
- **Carga diferida por ruta** (`lazy` de React Router) y dependencias en chunks propios: el chunk
  de entrada pasó de 849 kB a 87 kB y ningún archivo supera 500 kB. Las páginas que no se visitan
  (formulario, detalle, papelera, auditoría) no se descargan al abrir el listado.
- **Responsive sin librería extra:** grid de filtros de 1 a 5 columnas según el ancho, formulario
  y detalle en una columna en móvil y tablas con desplazamiento horizontal dentro de su
  contenedor, nunca de la página.
- **Exportación como enlace directo.** "Exportar CSV" es una descarga nativa del navegador: con la
  sesión expirada, el navegador descarga la respuesta de error en lugar del archivo. La descarga
  con manejo de errores está en el Roadmap.

### Plataforma

- **Prisma 7 y no Prisma 8.** Prisma 8 es una reescritura que aún está en release candidate; 7.10
  es estable y con soporte extendido. El acceso a datos está aislado en repositorios, lo que
  acota una migración futura.
- **TypeScript 6 y no 7.** `@nestjs/swagger` 12 todavía no admite TypeScript 7.
- **Versiones exactas y lockfile.** Todas las dependencias se fijan sin rangos y se instalan con
  `npm ci`: una versión nueva (o comprometida) de una dependencia no llega por accidente a una
  build sin pasar por una actualización revisada del lockfile, una defensa básica frente a
  ataques de supply chain en npm.
- **Vitest en ambas aplicaciones.** Es el runner por defecto de NestJS 12 y de Vite: una sola
  herramienta y una sola forma de configurar la cobertura.
- **Monorepo simple.** `backend/` y `frontend/` son aplicaciones independientes, sin workspaces
  ni herramientas de monorepo. El costo es declarar los tipos de la API en ambos lados; la mejora
  prevista es generarlos desde OpenAPI.

## Calidad: tests y cobertura

```bash
cd backend && npm run test:cov
cd frontend && npm run test:cov
# Integración (requiere PostgreSQL; por defecto el de desarrollo en localhost:5432)
cd backend && npm run test:e2e
```

- **Umbral forzado de 80 %** en líneas, ramas, funciones y sentencias, definido en
  `coverage.thresholds` de cada `vitest.config.ts`. El comando falla si no se alcanza, tanto en
  local como en CI.
- **`coverage.include` explícito:** los archivos sin tests también cuentan, en lugar de medir
  solo lo que los tests importan.
- **Backend:** servicios con repositorios simulados (incluido que la auditoría use la misma
  transacción), controllers, parseo de orden y construcción de consultas, interceptor de
  respuestas, filtro de excepciones, guard y extracción del token, exportación CSV (escapado y
  BOM) y almacenamiento en disco con un directorio temporal.
- **Integración contra PostgreSQL real** (`npm run test:e2e` en `backend/`): crea y migra una base
  dedicada `cmpc_libros_test` y verifica lo que un mock no puede demostrar: que el guard global
  protege todas las rutas, que el soft delete se respeta en listado, detalle, exportación, edición
  e imagen, el rollback real de una transacción cuando falla la auditoría, el escape de `%` y `_`
  en la búsqueda, la paginación estable, los errores 400/413 de imágenes y el CSV.
- **Frontend:** hooks (debounce, parámetros de búsqueda, queries y mutaciones), cliente HTTP
  (manejo de 401 y errores), protección de rutas, login, tabla (orden reflejado en la URL),
  filtros, formulario (validación), selector de imagen y detalle, con MSW simulando la API.

Exclusiones de cobertura y su motivo:

| Aplicación | Excluido | Motivo |
|---|---|---|
| Backend | `main.ts` | Arranque del servidor; se verifica al levantar el stack. |
| Backend | `*.module.ts` | Declaraciones de inyección de dependencias sin lógica. |
| Backend | DTOs | Clases declarativas; sus reglas se ejercitan en los tests de validación y controllers. |
| Backend | Cliente generado de Prisma | Código generado por la herramienta. |
| Frontend | `src/components/ui/**` | Componentes generados por el CLI de shadcn. |
| Frontend | `main.tsx` | Punto de montaje de React. |

### Cobertura actual

Resultado de `npm run test:cov`:

| Aplicación | Tests | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|---|
| Backend | 307 unitarios + 45 de integración | 99,33 % | 94,31 % | 98,90 % | 99,32 % |
| Frontend | 271 | 96,64 % | 94,60 % | 96,41 % | 97,61 % |

La cobertura se mide sobre los tests unitarios; los de integración (`npm run test:e2e`) se
ejecutan aparte contra PostgreSQL.

## Rendimiento

- **Índices parciales** (`WHERE deleted_at IS NULL`) para el listado: PostgreSQL recorre el índice
  ya ordenado en lugar de leer la tabla y ordenar. Se puede comprobar con el stack levantado:

  ```bash
  docker compose exec -T db psql -U cmpc -d cmpc_libros -c \
    "EXPLAIN SELECT id FROM books WHERE deleted_at IS NULL ORDER BY title LIMIT 10"
  # → Index Scan using books_active_title_idx on books
  ```

  La papelera tiene su propio índice parcial (`deleted_at IS NOT NULL`, ordenado por fecha de
  eliminación); con pocos libros eliminados PostgreSQL prefiere leer la tabla y lo usa a medida
  que el volumen crece.
- **Carga diferida por ruta** en el frontend: `npm run build` en `frontend/` muestra el chunk de
  entrada (~87 kB) separado de React, Base UI y TanStack, y de cada página.
- **Exportación CSV en streaming** por lotes: la memoria del servidor no crece con el inventario.

## Integración continua

GitHub Actions (`.github/workflows/ci.yml`) se ejecuta en cada push y en cada pull request a
`main`, sobre `ubuntu-24.04` fijo para que el resultado no cambie con las migraciones del runner:

| Job | Pasos |
|---|---|
| Backend | `npm ci`, `prisma generate`, lint, typecheck, tests con cobertura |
| Backend · integración | servicio `postgres:18-alpine`, migraciones sobre `cmpc_libros_test` y `npm run test:e2e` |
| Frontend | `npm ci`, lint, typecheck, tests con cobertura |
| Docker | valida `docker-compose.yml`, construye las imágenes, levanta el stack, espera los healthchecks y consulta `/api/health` y una ruta de la SPA a través de nginx |

## Roadmap

Evoluciones previstas para próximas versiones, con su diseño propuesto:

| Evolución | Diseño propuesto |
|---|---|
| Refresh tokens | Access token de vida corta en cookie + refresh token rotativo en cookie httpOnly restringida a `/api/auth/refresh`, almacenado hasheado en BD con detección de reutilización |
| Roles (RBAC) | Columna `role` en `users`, decorador `@Roles()` + `RolesGuard` |
| Almacenamiento S3/MinIO | Nueva clase `S3StorageService implements StorageService`, seleccionada por variable de entorno |
| Export masivo asíncrono | Cola BullMQ + Redis, job que genera el archivo y notifica/descarga por URL firmada |
| Varios autores por libro | Tabla puente `book_authors (book_id, author_id, position)` |
| Portadas privadas | Servir las imágenes con URLs firmadas de vida corta (o desde S3 con URLs prefirmadas) en lugar de `/api/uploads` público, y retirar la portada al eliminar un libro |
| Cliente tipado | `openapi-typescript` generado desde el Swagger del backend |
| Tests e2e de interfaz | Playwright contra el stack de Docker Compose en CI (login, listado, alta con imagen, eliminación) |
| Base de integración aislada | Testcontainers para levantar un PostgreSQL efímero por suite, sin depender de una instancia local |
| Rate limit distribuido | Throttler global con store en Redis y límites específicos para exportación y subida de imágenes |
| Procesamiento de imágenes | Re-codificar las portadas con `sharp` (elimina contenido no gráfico) y generar miniaturas |
| Prisma 8 | Migrar cuando alcance GA; el acceso a datos está aislado en repositorios, lo que acota el cambio |
| Catálogos por ID | `GET /api/authors/:id` (y equivalentes) o `?ids=` en los listados, para resolver las etiquetas de los filtros sin traer 50 registros |
| Gestión de catálogos | Pantalla para renombrar o fusionar autores, editoriales y géneros, y ocultar de los filtros los que no tienen libros activos |
| Auditoría avanzada | Filtros por usuario y rango de fechas, y enlace desde cada registro al libro afectado |
| Exportación con manejo de errores | Descarga vía `fetch` + `Blob` con `withCredentials`: ante un 401 redirige al login y ante otros errores muestra un aviso, en lugar de descargar el cuerpo del error |

## Estructura del repositorio

```
.
├── backend/                 API NestJS + Prisma
│   ├── prisma/              schema.prisma, migraciones y seed
│   ├── src/                 módulos de la aplicación
│   ├── Dockerfile           build multi-stage, usuario no root
│   └── docker-entrypoint.sh migraciones → seed → API
├── frontend/                SPA Vite + React
│   ├── src/                 app, features, componentes y utilidades
│   ├── Dockerfile           build de Vite servido por nginx
│   └── nginx.conf           SPA, caché de assets y proxy de /api
├── docs/                    arquitectura, modelo de datos y diseño
├── .github/workflows/       CI
├── docker-compose.yml
├── .env.example
└── README.md
```
