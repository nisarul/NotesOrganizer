-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notebooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'notebook',
    "user_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notebooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notebooks" ("color", "created_at", "deleted_at", "description", "icon", "id", "is_deleted", "name", "sort_order", "updated_at", "user_id") SELECT "color", "created_at", "deleted_at", "description", "icon", "id", "is_deleted", "name", "sort_order", "updated_at", "user_id" FROM "notebooks";
DROP TABLE "notebooks";
ALTER TABLE "new_notebooks" RENAME TO "notebooks";
CREATE TABLE "new_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "folder_id" TEXT,
    "notebook_id" TEXT NOT NULL,
    "content_path" TEXT NOT NULL DEFAULT '',
    "draft_path" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_dirty" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "public_slug" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "last_opened_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notes_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notes" ("content_path", "created_at", "deleted_at", "draft_path", "folder_id", "id", "is_deleted", "is_dirty", "is_favorite", "is_pinned", "last_opened_at", "notebook_id", "sort_order", "title", "updated_at") SELECT "content_path", "created_at", "deleted_at", "draft_path", "folder_id", "id", "is_deleted", "is_dirty", "is_favorite", "is_pinned", "last_opened_at", "notebook_id", "sort_order", "title", "updated_at" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
CREATE UNIQUE INDEX "notes_public_slug_key" ON "notes"("public_slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
