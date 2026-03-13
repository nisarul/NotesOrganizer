# Plan: NotesOrganizer — Self-Hosted Markdown Note-Taking App (v2)

## TL;DR
Build a OneNote-style web app with full markdown editing (WYSIWYG + split-view), hierarchical organization in a single sidebar tree (Notebooks → nested Folders up to 3 levels → Notes), hybrid storage (SQLite metadata + .md files on disk), draft auto-save + manual versioning, full auth, and a modern UI. Self-hosted behind Nginx. Develop on Windows, deploy on Linux.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18+ with TypeScript | Rock-solid, massive ecosystem, future-proof |
| UI Components | shadcn/ui + Tailwind CSS | Modern, elegant, fully customizable, dark/light theming built-in |
| Markdown Editor | TipTap (ProseMirror-based) | Native WYSIWYG + split-view, excellent image paste/upload support |
| Split-view raw editor | CodeMirror 6 | Syntax highlighting for raw markdown editing |
| State/Data | React Query (TanStack Query) + Zustand | Efficient server-state + lightweight client-state |
| Backend | Fastify (Node.js, TypeScript) | High performance, modern, excellent plugin ecosystem |
| ORM / DB | Prisma + SQLite | Type-safe queries, simple file-based DB, easy to backup |
| Auth | JWT (jsonwebtoken + bcrypt) | Stateless auth, simple self-hosted setup |
| Image Processing | Sharp | Resize, thumbnails for uploaded images |
| PDF Export | jsPDF + html2canvas (client-side) | No server load for exports |
| Build Tool | Vite | Fast dev server, optimized builds |
| Deployment | Nginx reverse proxy → Node.js process (PM2) | Stable, production-ready |

---

## Data Architecture

### Hierarchy (single sidebar tree)
```
📓 Notebook (project-level)
 └── 📁 Folder (up to 3 levels of nesting)
      └── 📁 Subfolder
           └── 📁 Sub-subfolder (max depth)
                └── 📝 Note
```
- Notebooks are top-level containers (one per project)
- Folders can nest up to 3 levels deep (enforced by backend)
- Notes live inside any folder or directly under a notebook
- Self-referencing `parent_id` on the Folders table enables nesting

### Hybrid Storage

**SQLite** stores:
- Users (id, username, email, password_hash, created_at)
- Notebooks (id, name, color, icon, user_id, sort_order, is_deleted, deleted_at, created_at, updated_at)
- Folders (id, name, notebook_id, parent_id [nullable, self-ref], depth, sort_order, is_deleted, deleted_at, created_at, updated_at)
- Notes (id, title, folder_id [nullable], notebook_id, content_path, draft_path, is_pinned, is_favorite, is_dirty, is_deleted, deleted_at, sort_order, last_opened_at, created_at, updated_at)
- Tags (id, name, color, user_id)
- NoteTags (note_id, tag_id)
- NoteVersions (id, note_id, content_path, version_number, message [optional], created_at)
- Images (id, note_id, filename, path, size, created_at)

**Filesystem** stores:
```
data/
├── notes/
│   └── {note-uuid}.md           # Last committed/saved content
├── drafts/
│   └── {note-uuid}.draft.md     # Unsaved draft (auto-saved on type)
├── images/
│   └── {note-uuid}/
│       └── {image-uuid}.{ext}   # Uploaded images
└── versions/
    └── {note-uuid}/
        └── v{number}.md         # Versioned snapshots
```

### Save & Versioning Model
1. **As you type** → debounced auto-save (2s idle) writes to `drafts/{id}.draft.md`, sets `is_dirty=true` in DB. No version created.
2. **On explicit Save (Ctrl+S / Save button)** → draft content is committed to `notes/{id}.md`, a snapshot is written to `versions/{id}/v{N}.md`, a `NoteVersions` row is created, `is_dirty=false`.
3. **On opening a note** → if `is_dirty=true`, load from draft file; otherwise load from committed file.
4. **Unsaved indicator** → dot/badge on the note in the sidebar tree when `is_dirty=true`.

---

## Application Layout (UI)

```
┌──────────────────────────────────────────────────────────────┐
│  Header: Logo | 🔍 Search | Filter ▼ | ☀/🌙 Theme | 👤 User │
├──────────────┬───────────────────────────────────────────────┤
│              │  Breadcrumb: Notebook > Folder > Subfolder    │
│  Sidebar     │───────────────────────────────────────────────│
│  (tree view) │  Note Title (editable)                        │
│              │  Tags: [tag1] [tag2] [+]          [Save btn]  │
│  📓 Project A│───────────────────────────────────────────────│
│   📁 Design  │                                               │
│    📝 Note 1 │  ┌─────────────────────────────────────────┐  │
│    📝 Note 2•│  │                                         │  │
│   📁 Backend │  │  Markdown Editor                        │  │
│    📁 APIs   │  │  (WYSIWYG ↔ Split toggle)               │  │
│     📝 Note 3│  │                                         │  │
│   📝 Note 4  │  │  ☑ Checklist items supported            │  │
│  📓 Project B│  │  ```code syntax highlighted```          │  │
│   📁 Notes   │  │                                         │  │
│  🗑 Trash     │  └─────────────────────────────────────────┘  │
│              │  Footer: Word count | "Draft" or "Saved"      │
├──────────────┴───────────────────────────────────────────────┤
│  Recently opened: Note 3 · Note 1 · Note 4                  │
└──────────────────────────────────────────────────────────────┘
```

Key UI elements:
- **Single sidebar** with collapsible tree (file-explorer style) — notebooks, nested folders, notes
- **Breadcrumb** above editor showing full path
- **Unsaved indicator** (•) on dirty notes in tree
- **Right-click context menus** on all tree items (rename, delete, move, copy, new note, new folder)
- **Filter dropdown** in header (by tags, by favorites, by recent)
- **Sort control** on sidebar (by date modified, date created, title)
- **Trash section** at bottom of sidebar tree
- **Recently opened** bar at the bottom or as a pinned section

---

## Phases & Steps

### Phase 1: Project Scaffolding & Core Infrastructure (6 steps)
1. Initialize monorepo structure with `client/` (Vite + React + TypeScript) and `server/` (Fastify + TypeScript), root `package.json` with workspaces
2. Set up Tailwind CSS + shadcn/ui in the client, configure dark/light theme tokens
3. Set up Prisma with SQLite schema — all tables: Users, Notebooks, Folders (self-referencing parent_id, depth), Notes, Tags, NoteTags, NoteVersions, Images with soft-delete fields (is_deleted, deleted_at)
4. Create the `data/` directory structure: `notes/`, `drafts/`, `images/`, `versions/`
5. Implement JWT auth system: register, login, refresh token, auth middleware guard, password hashing with bcrypt
6. Create seed script for initial admin user

### Phase 2: Backend API (14 steps, *depends on Phase 1*)
7. **Notebooks CRUD** — `GET/POST/PUT/DELETE /api/notebooks`, sort_order, soft-delete
8. **Folders CRUD** — `GET/POST/PUT/DELETE /api/folders`, parent_id for nesting, enforce max depth=3, sort_order, soft-delete
9. **Notes CRUD** — `GET/POST/PUT/DELETE /api/notes`, read/write .md files, sort_order, soft-delete, set last_opened_at on GET
10. **Draft auto-save API** — `PUT /api/notes/:id/draft` — writes to draft file, sets is_dirty=true (*depends on 9*)
11. **Commit/Save API** — `POST /api/notes/:id/commit` — promotes draft → committed, creates version snapshot, sets is_dirty=false (*depends on 10*)
12. **Tags API** — `GET/POST/DELETE /api/tags`, `POST/DELETE /api/notes/:id/tags` (*parallel with 9*)
13. **Search API** — `GET /api/search?q=...&tags=...` full-text search across titles + content, filterable by tags (*depends on 9*)
14. **Filter API** — `GET /api/notes?filter=favorites|recent|tag:{name}` — filter notes by favorites, recent, or tag (*depends on 9*)
15. **Image upload API** — `POST /api/notes/:id/images`, multipart upload, Sharp resize/thumbnail (*depends on 9*)
16. **Version history API** — `GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionId`, `POST /api/notes/:id/versions/:versionId/restore` (*depends on 11*)
17. **Reorder API** — `PATCH /api/reorder` batch-update sort_order for notebooks, folders, or notes (*depends on 9*)
18. **Move/Copy API** — `PATCH /api/notes/:id/move`, `POST /api/notes/:id/copy` — move or duplicate a note to a different folder/notebook (*depends on 9*)
19. **Trash API** — `GET /api/trash` (list soft-deleted items), `POST /api/trash/:id/restore`, `DELETE /api/trash/:id` (permanent delete) (*depends on 9*)
20. **Export API** — `GET /api/notes/:id/export?format=html|md` (*depends on 9*)

### Phase 3: Frontend Shell & Navigation (5 steps, *parallel with Phase 2*)
21. Set up React Router with auth-guarded routes
22. Build Login/Register pages with form validation (shadcn form components)
23. Build the 2-panel layout: collapsible sidebar + editor area, using resizable pane
24. Build dark/light theme system using Tailwind's dark mode + shadcn theme tokens, persist preference in localStorage
25. Build the sidebar tree component — collapsible nodes for notebooks, folders (nested), notes; with expand/collapse, icons, unsaved indicator (•)

### Phase 4: Frontend Features — Core (8 steps, *depends on Phases 2 & 3*)
26. **Sidebar tree interactions** — create/rename/delete notebooks & folders via right-click context menu; enforce 3-level nesting limit in UI (*depends on 8, 25*)
27. **Notes in tree** — create/rename/delete notes via context menu; show pin ★ and unsaved • indicators; click to open in editor (*depends on 9, 25*)
28. **Breadcrumb navigation** — show full path above editor (Notebook > Folder > Subfolder > Note), clickable segments to navigate/expand tree (*depends on 25*)
29. **TipTap WYSIWYG editor** — toolbar: bold, italic, headings, lists, code blocks (syntax-highlighted), tables, links, horizontal rule, blockquote, checklist/to-do items (*depends on 23*)
30. **Split-view editor mode** — CodeMirror 6 for raw markdown + live preview side-by-side, toggleable with WYSIWYG mode (*depends on 29*)
31. **Draft auto-save** — debounced (2s) auto-save on content change, writes to draft API, shows "Draft" indicator in footer; "Unsaved" dot in tree (*depends on 10, 29*)
32. **Manual save/commit** — Ctrl+S or Save button commits draft, creates version, shows "Saved ✓" in footer (*depends on 11, 31*)
33. **Drag-and-drop reorder** — reorder notebooks, folders, notes in sidebar tree; persist via reorder API (*depends on 17, 25*)

### Phase 5: Frontend Features — Enhanced (8 steps, *depends on Phase 4*)
34. **Image paste & upload** — paste from clipboard or drag into editor, upload via API, insert inline (*depends on 15, 29*)
35. **Tags UI** — tag picker on notes (above editor), create tags inline, color picker for tags (*depends on 12, 27*)
36. **Filter & sort** — filter dropdown in header (by tag, by favorites, by recent); sort control on sidebar (date modified, date created, title A-Z/Z-A) (*depends on 14, 25*)
37. **Global search** — search bar in header (Ctrl+K), results dropdown with note title + snippet + breadcrumb path (*depends on 13, 23*)
38. **Move/Copy notes** — context menu option to move or copy a note, modal to pick destination folder (*depends on 18, 25*)
39. **Trash UI** — trash section at bottom of sidebar, list deleted items, restore or permanently delete (*depends on 19, 25*)
40. **Version history UI** — side panel showing version list with timestamps, click to preview diff, restore button (*depends on 16, 29*)
41. **Export UI** — export button on notes: PDF (client-side jsPDF+html2canvas), HTML, raw .md download (*depends on 20, 29*)
42. **Recently opened** — bar or section showing last N opened notes for quick access (*depends on 9*)

### Phase 6: Polish & Deployment (6 steps)
43. Loading skeletons, empty states ("No notes yet — create one!"), error boundaries, toast notifications (shadcn Sonner)
44. Keyboard shortcuts: Ctrl+S save, Ctrl+N new note, Ctrl+K search, Ctrl+B bold, Ctrl+I italic, Ctrl+Shift+X strikethrough, etc.
45. Responsive design — collapsible sidebar on smaller screens, hamburger menu
46. Write Nginx config: reverse proxy to Fastify on localhost port, serve client static files from build, gzip, cache headers
47. PM2 ecosystem config for Node.js process management
48. Production build scripts (`npm run build`) and deployment README with step-by-step Linux deployment instructions

---

## Relevant Files (to be created)

### Root
- `package.json` — Monorepo root with workspaces
- `.gitignore`
- `README.md`

### Server (`server/`)
- `server/src/index.ts` — Fastify entry point, plugin registration, CORS
- `server/src/plugins/auth.ts` — JWT auth plugin + middleware decorator
- `server/src/routes/auth.ts` — Register, login, refresh token
- `server/src/routes/notebooks.ts` — Notebooks CRUD + soft-delete
- `server/src/routes/folders.ts` — Folders CRUD, nesting validation (max depth 3)
- `server/src/routes/notes.ts` — Notes CRUD + file I/O, draft save, commit/version
- `server/src/routes/tags.ts` — Tags CRUD, note-tag assignment
- `server/src/routes/search.ts` — Full-text search + tag filter
- `server/src/routes/images.ts` — Image upload, Sharp processing
- `server/src/routes/trash.ts` — List, restore, permanent delete
- `server/src/routes/export.ts` — HTML/MD export
- `server/src/services/storage.ts` — File system operations (notes, drafts, images, versions)
- `server/src/services/versioning.ts` — Version snapshot creation + retrieval
- `server/prisma/schema.prisma` — Full database schema

### Client (`client/`)
- `client/src/App.tsx` — Root with router + providers (QueryClient, ThemeProvider, AuthProvider)
- `client/src/layouts/MainLayout.tsx` — 2-panel layout: sidebar + editor
- `client/src/pages/LoginPage.tsx` — Auth pages
- `client/src/components/sidebar/SidebarTree.tsx` — Full hierarchical tree (notebooks, folders, notes)
- `client/src/components/sidebar/TreeNode.tsx` — Individual tree node (expand/collapse, icon, context menu, drag handle)
- `client/src/components/sidebar/TreeContextMenu.tsx` — Right-click menu (rename, delete, move, copy, new note, new folder)
- `client/src/components/sidebar/SortControl.tsx` — Sort dropdown for sidebar
- `client/src/components/sidebar/TrashSection.tsx` — Trash view in sidebar
- `client/src/components/editor/MarkdownEditor.tsx` — TipTap WYSIWYG with extensions (code highlight, checklist, image)
- `client/src/components/editor/SplitEditor.tsx` — CodeMirror + preview split view
- `client/src/components/editor/EditorToggle.tsx` — WYSIWYG ↔ Split mode switch
- `client/src/components/editor/Breadcrumb.tsx` — Path breadcrumb above editor
- `client/src/components/editor/NoteHeader.tsx` — Title + tags + save button
- `client/src/components/search/GlobalSearch.tsx` — Ctrl+K search modal with results
- `client/src/components/search/FilterDropdown.tsx` — Filter by tags, favorites, recent
- `client/src/components/tags/TagPicker.tsx` — Tag selector + inline create
- `client/src/components/history/VersionHistory.tsx` — Version list + preview + restore
- `client/src/components/common/MoveNoteModal.tsx` — Destination picker for move/copy
- `client/src/hooks/useAuth.ts` — Auth state, login/register/logout
- `client/src/hooks/useNotes.ts` — Notes CRUD + draft auto-save (React Query mutations)
- `client/src/hooks/useTreeData.ts` — Fetch and structure sidebar tree data
- `client/src/hooks/useTheme.ts` — Dark/light theme toggle + persistence
- `client/src/lib/api.ts` — Fetch wrapper with JWT interceptor + refresh
- `client/src/stores/appStore.ts` — Zustand store (selected note, sidebar state, editor mode)
- `client/src/styles/globals.css` — Tailwind base + shadcn theme variables

### Deployment
- `nginx/notesorganizer.conf` — Nginx site config
- `ecosystem.config.js` — PM2 config

---

## Verification

1. **Auth flow**: Register → login → JWT received → protected routes accessible → refresh token works → logout clears tokens
2. **Notebook/Folder CRUD**: Create notebook → create folder → create nested folder (up to 3 levels) → attempt 4th level → rejected → rename → delete soft-deletes
3. **Notes CRUD**: Create note → verify .md file on disk → edit → auto-save writes draft file → explicit save commits + creates version
4. **Draft vs. Save**: Edit note → see "Draft" indicator → navigate away → come back → draft content loaded → Ctrl+S → "Saved ✓" → version created in versions/ directory
5. **Editor modes**: Type in WYSIWYG → switch to split-view → content preserved → add checklist items → code blocks syntax-highlighted → switch back → all preserved
6. **Sidebar tree**: All notebooks, folders (nested), notes render in tree → expand/collapse works → right-click shows context menu → drag-and-drop reorders → sort changes order
7. **Breadcrumb**: Click note deep in hierarchy → breadcrumb shows full path → click breadcrumb segment → tree navigates/scrolls to that node
8. **Image upload**: Paste image in editor → uploaded → renders inline → persists after save → visible after page refresh
9. **Search**: Create notes → Ctrl+K → type keyword → results show with snippet + breadcrumb path → click result opens note
10. **Filter**: Filter by tag → only matching notes shown → filter by favorites → only pinned shown → clear filter → all shown
11. **Tags**: Add tag → filter by tag → remove tag → filter updates
12. **Move/Copy**: Right-click note → Move → pick destination → note moved → tree updates
13. **Trash**: Delete note → appears in Trash → restore → back in original location → permanent delete → gone from disk
14. **Version history**: Edit multiple times with explicit saves → open version history → see versions → restore older version → content reverts
15. **Export**: Export as PDF → downloads correctly → export as HTML → valid file → export as .md → raw markdown
16. **Dark/Light theme**: Toggle → all UI updates → refresh → preference persisted
17. **Recently opened**: Open several notes → recently opened bar shows them in order → click to reopen
18. **Nginx deployment**: `npm run build` → start via PM2 → access through Nginx on Linux server → all routes work

---

## Decisions

- **Single sidebar tree** (not two panels) with hierarchical file-explorer-style view for notebooks, nested folders, and notes
- **Nested folders up to 3 levels** enforced by backend depth validation on the Folders table (self-referencing parent_id)
- **Draft auto-save + manual versioning**: Auto-save drafts on keystroke (debounced), only create version snapshots on explicit Save — balances convenience with version cleanliness
- **Hybrid storage**: SQLite metadata + .md files on disk — queryable metadata + human-readable files
- **Soft-delete with Trash**: Items are soft-deleted (is_deleted flag + deleted_at timestamp), shown in Trash section, can be restored or permanently removed
- **Full auth system**: Username/password with JWT for future multi-user potential
- **TipTap + CodeMirror**: TipTap for WYSIWYG, CodeMirror 6 for raw split-view editor
- **Client-side PDF export**: jsPDF + html2canvas, no server-side rendering needed
- **Monorepo**: Single repo, `client/` and `server/` workspaces
- **Develop on Windows, deploy on Linux**: Fully cross-platform stack, no issues
