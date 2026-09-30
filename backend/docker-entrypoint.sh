#!/bin/sh
# Arranque del contenedor: migraciones → seed idempotente → API.
set -eu

echo "[entrypoint] Aplicando migraciones pendientes"
prisma migrate deploy

echo "[entrypoint] Ejecutando seed idempotente"
prisma db seed

echo "[entrypoint] Iniciando la API en el puerto ${PORT:-3000}"
exec node dist/main.js
