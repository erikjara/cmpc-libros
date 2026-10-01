-- DropIndex
DROP INDEX "books_created_at_idx";

-- DropIndex
DROP INDEX "books_deleted_at_idx";

-- DropIndex
DROP INDEX "books_price_idx";

-- CreateIndex
CREATE INDEX "books_active_created_at_idx" ON "books"("created_at") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "books_active_title_idx" ON "books"("title") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "books_active_price_idx" ON "books"("price") WHERE ("deleted_at" IS NULL);
