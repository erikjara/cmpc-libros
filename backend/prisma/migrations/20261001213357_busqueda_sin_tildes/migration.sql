-- Búsqueda sin distinguir tildes ni mayúsculas: "garcia" encuentra "García Márquez".
-- title_search y author_search guardan toSearchKey() del título y del nombre del autor
-- (src/common/search/search-key.ts): NFD, sin marcas diacríticas U+0300–U+036F, minúsculas y
-- espacios colapsados. La aplicación las escribe en cada alta y edición; aquí se rellenan las
-- filas existentes con la misma transformación en SQL (normalize() es nativo de PostgreSQL
-- 13+; no hace falta la extensión unaccent). Los índices GIN trigram se declaran en el schema,
-- así que Prisma los conoce y no los elimina en migraciones posteriores.

-- AlterTable
ALTER TABLE "books" ADD COLUMN "title_search" TEXT,
ADD COLUMN "author_search" TEXT;

-- Backfill
UPDATE "books" AS b SET
  "title_search" = btrim(regexp_replace(
    lower(regexp_replace(normalize(b."title", NFD), '[̀-ͯ]', '', 'g')),
    '\s+', ' ', 'g')),
  "author_search" = btrim(regexp_replace(
    lower(regexp_replace(normalize(a."name", NFD), '[̀-ͯ]', '', 'g')),
    '\s+', ' ', 'g'))
FROM "authors" AS a
WHERE a."id" = b."author_id";

ALTER TABLE "books" ALTER COLUMN "title_search" SET NOT NULL,
ALTER COLUMN "author_search" SET NOT NULL;

-- La búsqueda ya no filtra por books.title: su índice trigram queda sin uso.
-- DropIndex
DROP INDEX "books_title_trgm_idx";

-- CreateIndex
CREATE INDEX "books_title_search_trgm_idx" ON "books" USING GIN ("title_search" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "books_author_search_trgm_idx" ON "books" USING GIN ("author_search" gin_trgm_ops);
