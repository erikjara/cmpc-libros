-- CreateIndex
CREATE INDEX "books_trashed_deleted_at_idx" ON "books"("deleted_at" DESC) WHERE ("deleted_at" IS NOT NULL);
