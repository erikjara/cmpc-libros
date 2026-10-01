-- Nombres de autor, editorial y género únicos sin distinguir mayúsculas ("Pablo Neruda" y
-- "pablo neruda" son el mismo autor). Índices de expresión sobre lower(name): Prisma no
-- puede declararlos en el schema, pero tampoco los compara ni los elimina en migraciones
-- siguientes. La columna sigue siendo text, así que los índices GIN trigram de las
-- búsquedas ILIKE siguen sirviendo.

-- Si ya hubiera nombres que solo difieren en mayúsculas, el índice único no podría crearse:
-- se aborta indicando cuáles fusionar (reasignar sus libros a uno y borrar el resto).
DO $$
DECLARE
  duplicated TEXT;
BEGIN
  SELECT string_agg(entry, '; ') INTO duplicated
  FROM (
    SELECT 'authors: ' || string_agg(name, ' | ' ORDER BY name) AS entry
    FROM authors GROUP BY lower(name) HAVING count(*) > 1
    UNION ALL
    SELECT 'publishers: ' || string_agg(name, ' | ' ORDER BY name)
    FROM publishers GROUP BY lower(name) HAVING count(*) > 1
    UNION ALL
    SELECT 'genres: ' || string_agg(name, ' | ' ORDER BY name)
    FROM genres GROUP BY lower(name) HAVING count(*) > 1
  ) AS duplicates;

  IF duplicated IS NOT NULL THEN
    RAISE EXCEPTION 'Hay nombres de catálogo que solo difieren en mayúsculas; fusiónalos antes de migrar: %', duplicated;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "authors_name_lower_key" ON "authors" (lower("name"));

-- CreateIndex
CREATE UNIQUE INDEX "publishers_name_lower_key" ON "publishers" (lower("name"));

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_lower_key" ON "genres" (lower("name"));
