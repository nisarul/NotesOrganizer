# NotesOrganizer — Copilot Instructions

## Project Overview

NotesOrganizer is a self-hosted, OneNote-style markdown note-taking web application. It uses a **monorepo** layout with `client/` (React frontend) and `server/` (Fastify backend). Notes are stored as `.md` files on disk with metadata in SQLite.

---

## Architecture & Tech Stack

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Frontend           | React 18+ with TypeScript           |
| UI / Styling       | Tailwind CSS (v3) with shadcn/ui-style CSS variables |
| Markdown Editor    | TipTap (ProseMirror) for WYSIWYG    |
| Split-view Editor  | CodeMirror 6 for raw markdown       |
| State (server)     | TanStack React Query v5             |
| State (client)     | Zustand                             |
| Backend            | Fastify v5, Node.js, TypeScript     |
| ORM / DB           | Prisma v6 + SQLite                  |
| Auth               | JWT (jsonwebtoken) + bcryptjs       |
| Validation         | Zod                                 |
| Image Processing   | Sharp                               |
| PDF Export          | jsPDF + html2canvas (client-side)   |
| Build Tool         | Vite v5                             |

---

## Directory Structure

```
q:\NotesOrganizer/
├── package.json              # Root scripts (dev, build, db commands)
├── .gitignore
├── client/                   # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       │   ├── editor/       # NoteEditor, EditorToolbar, SplitEditor, etc.
│       │   ├── sidebar/      # SidebarTree, TreeContextMenu, etc.
│       │   ├── search/       # GlobalSearch, FilterDropdown
│       │   ├── tags/         # TagPicker
│       │   ├── history/      # VersionHistory
│       │   └── common/       # Shared UI (MoveNoteModal, etc.)
│       ├── hooks/            # useAuth, useTheme, useNotes, useTreeData
│       ├── layouts/          # MainLayout (2-panel: sidebar + editor)
│       ├── lib/              # api.ts (fetch wrapper + JWT), utils.ts (cn helper)
│       ├── pages/            # LoginPage
│       ├── stores/           # appStore.ts (Zustand)
│       └── styles/           # globals.css (Tailwind + theme vars)
├── server/                   # Fastify backend
│   ├── dev.mjs               # Dev launcher (loads .env, runs dist/index.js)
│   ├── .env                  # DATABASE_URL, JWT secrets, PORT
│   ├── prisma/
│   │   ├── schema.prisma     # Full DB schema
│   │   ├── seed.mjs          # Seed script (admin user)
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts          # Fastify entry, plugin/route registration
│   │   ├── plugins/
│   │   │   └── auth.ts       # JWT plugin, authenticate decorator
│   │   ├── routes/
│   │   │   ├── auth.ts       # Register, login, refresh, /me
│   │   │   ├── notebooks.ts  # CRUD + soft-delete
│   │   │   ├── folders.ts    # CRUD, max depth=3 enforcement
│   │   │   ├── notes.ts      # CRUD, draft/commit, move/copy, pin/fav, reorder
│   │   │   ├── tags.ts       # CRUD, assign/unassign to notes
│   │   │   ├── search.ts     # Full-text search across titles + content
│   │   │   ├── images.ts     # Upload, serve, list images per note
│   │   │   ├── trash.ts      # List, restore, permanent delete
│   │   │   └── export.ts     # HTML/MD export, version history endpoints
│   │   └── services/
│   │       ├── storage.ts    # File system ops (notes, drafts, images, versions)
│   │       └── versioning.ts # Version snapshot creation, commit, restore
│   └── dist/                 # Compiled JS output (tsc)
└── data/                     # User content (gitignored)
    ├── notes/    {uuid}.md
    ├── drafts/   {uuid}.draft.md
    ├── images/   {uuid}/{img-uuid}.ext
    └── versions/ {uuid}/v{N}.md
```

---

## Data Model

### Hierarchy
```
Notebook (project-level, has color + icon)
 └── Folder (up to 3 levels deep via self-referencing parent_id)
      └── Note (has title, stored as .md file on disk)
```

### Key Tables (Prisma schema)
- **User** — id, username, email, passwordHash
- **Notebook** — id, name, color, icon, userId, sortOrder, isDeleted, deletedAt
- **Folder** — id, name, notebookId, parentId (self-ref), depth (1-3), sortOrder, isDeleted
- **Note** — id, title, folderId?, notebookId, contentPath, draftPath?, isPinned, isFavorite, isDirty, isDeleted, sortOrder, lastOpenedAt
- **Tag** — id, name, color, userId. Unique on (name, userId)
- **NoteTag** — composite PK (noteId, tagId)
- **NoteVersion** — id, noteId, contentPath, versionNumber, message?
- **Image** — id, noteId, filename, path, size

### Hybrid Storage Model
- **SQLite** = metadata, relationships, sort order, soft-delete flags
- **Filesystem** = actual markdown content (.md files), drafts, images, version snapshots

### Save & Versioning
1. **Typing** → debounced 2s auto-save → writes `drafts/{id}.draft.md`, sets `isDirty=true`. No version.
2. **Ctrl+S / Save button** → promotes draft to `notes/{id}.md`, creates `versions/{id}/v{N}.md`, creates NoteVersion row, sets `isDirty=false`.
3. **Opening a note** → if `isDirty=true`, load from draft; else load from committed file.

---

## Coding Conventions

### General
- **TypeScript** everywhere (strict mode). No `any` unless absolutely necessary — use explicit types.
- **ESM modules** — the server uses `"type": "module"` with `.js` extensions in imports.
- File names: **camelCase** for utilities/hooks, **PascalCase** for React components.
- No default exports except for React page/layout components.

### Server (Fastify)
- **Route pattern**: Export an `async function xxxRoutes(server: FastifyInstance)` that registers routes.
- **Auth guard**: Use `server.addHook('preHandler', server.authenticate)` at the top of protected route files, or per-route with `{ preHandler: [server.authenticate] }`.
- **Validation**: Use **Zod** schemas with `safeParse()`. Return 400 with `{ error, details }` on failure.
- **Prisma**: Instantiate `const prisma = new PrismaClient()` at module level in each route file.
- **Soft-delete pattern**: Filter with `isDeleted: false` in all queries. Set `isDeleted: true, deletedAt: new Date()` on delete.
- **Ownership checks**: Always include `userId` or `notebook: { userId }` in queries to prevent cross-user access.
- **Error responses**: `{ error: string }` with appropriate HTTP status codes.
- **File I/O**: Use `services/storage.ts` functions — never do raw `fs` operations in routes.
- **Import extensions**: Always use `.js` extension in relative imports (e.g., `'../plugins/auth.js'`).

### Client (React)
- **Data fetching**: Use `useQuery` / `useMutation` from TanStack React Query. Query keys follow `['entity', id?]` pattern.
- **API calls**: Use the `api<T>()` function from `lib/api.ts` — it handles JWT headers and automatic token refresh.
- **State**: Zustand store (`stores/appStore.ts`) for UI state (selected items, sidebar, editor mode, recent notes). React Query for server state.
- **Styling**: Tailwind utility classes. Use `cn()` helper from `lib/utils.ts` to merge classes. Use CSS variables from `globals.css` for theme colors (e.g., `bg-background`, `text-foreground`, `bg-primary`).
- **Dark mode**: Toggle `dark` class on `<html>`. Theme CSS variables are defined in `:root` and `.dark` scopes.
- **CSS `@apply` restriction**: Do NOT use `@apply` with custom theme color classes (e.g., `@apply bg-background`) in `globals.css`. Use plain CSS with `hsl(var(--variable))` instead. `@apply` with standard Tailwind utilities (e.g., `@apply flex items-center`) is fine.
- **Icons**: Use `lucide-react` — import individual icons by name.
- **Toast notifications**: Use `toast` from `sonner`.
- **Components**: Keep components focused. Editor components in `components/editor/`, sidebar in `components/sidebar/`, etc.

### Prisma
- Use `@map("snake_case")` for database column names, camelCase for TypeScript fields.
- Use `@@map("table_name")` for table names.
- UUIDs for all primary keys (`@id @default(uuid())`).
- Cascade deletes where appropriate (notes cascade from notebooks).
- Soft-delete fields: `isDeleted Boolean @default(false)`, `deletedAt DateTime?`.

---

## Build & Run Commands

### Development
```bash
# From root:
cd server && npx tsc          # Compile server TypeScript
node server/dev.mjs            # Start backend (port 3001)

# Frontend (from root):
node node_modules/vite/bin/vite.js --config client/vite.config.ts --port 5173
```

### Production Build
```bash
# Build client
cd client && node ../node_modules/vite/bin/vite.js build

# Build server
cd server && npx tsc

# Output: client/dist/ (static files) + server/dist/ (compiled JS)
```

### Database
```bash
cd server
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate                    # Regenerate Prisma client
node prisma/seed.mjs                   # Seed admin user
```

### Environment-Specific Notes
- **Node.js 20.11** is the runtime. Vite v6 is NOT compatible — use **Vite v5**.
- `tsx` and `esbuild` have **EPERM issues** on the dev Windows machine. The server uses `tsc` to compile to `dist/`, then `dev.mjs` runs the compiled JS.
- Use **bcryptjs** (pure JS), NOT `bcrypt` (native addon fails to build).
- Install npm packages with `--ignore-scripts` to avoid esbuild postinstall EPERM failures.
- After installing new packages at root, if Prisma is affected, copy generated client: `xcopy /E /I /Y server\node_modules\.prisma node_modules\.prisma`.

---

## API Design

### URL Patterns
- `POST /api/auth/register` | `POST /api/auth/login` | `POST /api/auth/refresh` | `GET /api/auth/me`
- `GET|POST /api/notebooks` | `GET|PUT|DELETE /api/notebooks/:id`
- `GET|POST /api/folders` | `PUT|DELETE /api/folders/:id`
- `GET|POST /api/notes` | `GET|PUT|DELETE /api/notes/:id`
- `PUT /api/notes/:id/draft` — auto-save draft
- `POST /api/notes/:id/commit` — explicit save + version
- `PATCH /api/notes/:id/move` | `POST /api/notes/:id/copy`
- `PATCH /api/notes/:id/pin` | `PATCH /api/notes/:id/favorite`
- `PATCH /api/notes/reorder` — batch sort_order update
- `GET|POST|DELETE /api/tags` | `POST|DELETE /api/tags/notes/:noteId/tags`
- `GET /api/search?q=...&tags=...`
- `GET /api/notes?filter=favorites|recent|tag:{name}`
- `POST /api/notes/:id/images` | `GET /api/notes/:id/images/:imageFile`
- `GET /api/notes/:id/versions` | `GET /api/notes/:id/versions/:versionId` | `POST /api/notes/:id/versions/:versionId/restore`
- `GET /api/notes/:id/export?format=html|md`
- `GET /api/trash` | `POST /api/trash/:id/restore?type=...` | `DELETE /api/trash/:id?type=...`

### Response Conventions
- Success: `{ entity: {...} }` or `{ entities: [...] }` or `{ success: true }`
- Error: `{ error: "message" }` with optional `details`
- List endpoints always wrap the array: `{ notebooks: [...] }`, not bare array
- Pagination: not implemented yet; use `take` limits in search

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Header: Logo | Search (Ctrl+K) | Filter | Theme | User     │
├──────────────┬───────────────────────────────────────────────┤
│  Sidebar     │  Breadcrumb: Notebook > Folder > Note         │
│  (tree view) │  Note Title + Tags + [Save]                   │
│              │  Editor Toolbar                                │
│  📓 Notebook │  ┌─────────────────────────────────────────┐  │
│   📁 Folder  │  │  TipTap / CodeMirror Editor             │  │
│    📝 Note   │  └─────────────────────────────────────────┘  │
│  🗑 Trash     │  Footer: Word count | Draft/Saved status      │
├──────────────┴───────────────────────────────────────────────┤
│  Recently opened: Note A · Note B · Note C                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Important Constraints

1. **Max folder nesting depth = 3**. Backend enforces this. UI should disable "New Subfolder" when depth >= 3.
2. **Soft-delete everything**. Never hard-delete unless via the Trash permanent delete endpoint.
3. **Ownership isolation**. Every query must scope to `request.user!.userId` or `notebook: { userId }`.
4. **File paths use forward slashes** in stored `contentPath` / `draftPath` values for cross-platform compat.
5. **No inline `fs` calls in routes** — use `services/storage.ts`.
6. **Draft ≠ Version**. Typing auto-saves drafts. Only explicit Save creates versions.
7. **Vite proxy**: Dev Vite server proxies `/api` to `http://localhost:3001`. No need for CORS in dev.
