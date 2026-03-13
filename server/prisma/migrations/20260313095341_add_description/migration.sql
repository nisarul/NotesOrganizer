-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notebook_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "folders_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_folders" ("created_at", "deleted_at", "depth", "id", "is_deleted", "name", "notebook_id", "parent_id", "sort_order", "updated_at") SELECT "created_at", "deleted_at", "depth", "id", "is_deleted", "name", "notebook_id", "parent_id", "sort_order", "updated_at" FROM "folders";
DROP TABLE "folders";
ALTER TABLE "new_folders" RENAME TO "folders";
CREATE TABLE "new_notebooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'notebook',
    "user_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notebooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notebooks" ("color", "created_at", "deleted_at", "icon", "id", "is_deleted", "name", "sort_order", "updated_at", "user_id") SELECT "color", "created_at", "deleted_at", "icon", "id", "is_deleted", "name", "sort_order", "updated_at", "user_id" FROM "notebooks";
DROP TABLE "notebooks";
ALTER TABLE "new_notebooks" RENAME TO "notebooks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
