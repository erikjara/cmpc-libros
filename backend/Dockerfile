# syntax=docker/dockerfile:1

# ---------- deps: dependencias completas para compilar ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build: cliente Prisma + compilación TypeScript ----------
FROM deps AS build
# prisma generate no se conecta a la base de datos, pero prisma.config.ts exige la variable
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    CHECKPOINT_DISABLE=1
COPY . .
RUN npx prisma generate && npm run build

# ---------- prod-deps: solo dependencias de producción ----------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
# migrate deploy y db seed se ejecutan en runtime: la CLI de Prisma debe ser dependencia de producción
RUN test -x node_modules/.bin/prisma \
    || { echo "ERROR: 'prisma' debe declararse en dependencies (lo usa docker-entrypoint.sh)" >&2; exit 1; }

# ---------- runtime: imagen final, usuario no root ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads \
    CHECKPOINT_DISABLE=1 \
    PATH=/app/node_modules/.bin:$PATH
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# El seed (tsx prisma/seed.ts) importa el cliente generado desde src/generated/prisma
COPY --from=build /app/src/generated ./src/generated
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
ENTRYPOINT ["./docker-entrypoint.sh"]
