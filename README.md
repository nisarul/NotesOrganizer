<p align="center">
  <img src="https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-Prisma_v6-003B57?logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

# 📓 NotesOrganizer

A self-hosted, OneNote-style markdown note-taking web application. Organize notes in **notebooks → folders → notes** with a rich WYSIWYG editor, split markdown view, tags, search, version history, and public sharing.

Built for developers and power users who want full control over their notes.

---

## ✨ Features

### Core
- **Hierarchical Organization** — Notebooks → Folders (up to 3 levels deep) → Notes
- **Rich WYSIWYG Editor** — TipTap-based with bold, italic, headings, lists, code blocks (syntax highlighted), tables, links, blockquotes, checklists
- **Split View Editor** — Raw markdown (CodeMirror 6) + live HTML preview side-by-side
- **Draft Auto-Save** — Debounced 2-second auto-save as you type (no version created)
- **Manual Versioning** — Ctrl+S / Save button creates a numbered version snapshot
- **Markdown Storage** — Notes stored as `.md` files on disk, metadata in SQLite

### Organization & Navigation
- **Collapsible Sidebar Tree** — File-explorer style with expand/collapse all
- **Drag & Drop Reorder** — Reorder notebooks, folders, and notes by dragging
- **Right-Click Context Menus** — Create, rename, delete, move, copy, pin, favorite, share
- **Breadcrumb Navigation** — Full path shown above editor
- **Search** — Global search (Ctrl+K) across titles and content with snippet preview
- **Filter** — By favorites, recent, or tag
- **Tags** — Color-coded tags with inline creation and filtering
- **Pin to Top** — Pin important notes to the top of their folder
- **Favorites** — Star notes for quick filtering
- **Recently Opened** — Quick-access bar at the bottom

### Sharing & Collaboration
- **Public Note Sharing** — Make any note publicly viewable via a short URL
- **Read-Only View** — Non-owners see a clean, read-only rendered view
- **Copy Public Link** — One-click copy of the shareable URL
- **URL-Based Routing** — Each note has a bookmarkable URL (`/note/{id}`)

### Editor Features
- **Image Paste & Upload** — Paste from clipboard or drag into editor
- **Code Syntax Highlighting** — Via lowlight (highlight.js)
- **Task Lists / Checklists** — Interactive checkboxes
- **Tables** — Insert and edit tables
- **Export** — Download as Markdown, HTML, or PDF (client-side)
- **Version History** — View, preview, and restore previous versions

### UI & UX
- **Dark / Light Theme** — Toggle with persistence
- **Resizable Sidebar** — Drag to resize (200px–600px, persisted)
- **Inter Font** — Clean, modern typography
- **Hover Tooltips** — Note/folder stats on hover
- **Properties Modal** — View/edit notebook color
- **Trash** — Soft-delete with restore and permanent delete, preview deleted notes
- **Toast Notifications** — Sonner-based feedback for all actions
- **Keyboard Shortcuts** — Ctrl+K (search), Ctrl+S (save), Ctrl+B (bold), etc.

### Security
- **JWT Authentication** — Access + refresh tokens with auto-refresh
- **Ownership Isolation** — All queries scoped to authenticated user
- **Password Hashing** — bcryptjs with 12 rounds
- **Input Validation** — Zod schemas on all endpoints
- **HTML Escaping** — XSS protection in exports
- **Path Traversal Protection** — Image serving validates filenames

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Header: Logo │ Search (Ctrl+K) │ Theme │ User │ Logout      │
├──────────────┬───────────────────────────────────────────────┤
│  Sidebar     │  Breadcrumb: Notebook > Folder > Note         │
│  (tree view) │  Note Title + Tags + [Save]                   │
│              │  Editor Toolbar                                │
│  📓 Notebook │  ┌─────────────────────────────────────────┐  │
│   📁 Folder  │  │  TipTap / CodeMirror Editor             │  │
│    📝 Note   │  └─────────────────────────────────────────┘  │
│  🗑 Trash     │  Footer: Word count │ Draft/Saved status      │
├──────────────┴───────────────────────────────────────────────┤
│  Recently opened: Note A · Note B · Note C                   │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| UI | Tailwind CSS 3, shadcn/ui-style CSS variables |
| Editor | TipTap (WYSIWYG) + CodeMirror 6 (Split) |
| State | TanStack React Query v5 + Zustand |
| Backend | Fastify v5, Node.js, TypeScript |
| Database | Prisma v6 + SQLite |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| Image Processing | Sharp |

### Hybrid Storage

- **SQLite** — Metadata, relationships, sort order, soft-delete flags
- **Filesystem** — Markdown content (`.md`), drafts, images, version snapshots

```
data/
├── notes/     {uuid}.md           # Committed content
├── drafts/    {uuid}.draft.md     # Auto-saved drafts
├── images/    {uuid}/{img}.ext    # Uploaded images
└── versions/  {uuid}/v{N}.md     # Version snapshots
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x+
- **npm** 9+

### Installation

```bash
git clone https://github.com/nisarul/NotesOrganizer.git
cd NotesOrganizer

# Install dependencies
npm install --ignore-scripts
cd server && npm install --ignore-scripts && cd ..
cd client && npm install --ignore-scripts && cd ..

# Set up database
cd server
cp .env.example .env          # Or create .env with DATABASE_URL="file:./dev.db"
npx prisma migrate dev --name init --skip-seed
node prisma/seed.mjs          # Creates admin user
cd ..
```

### Development

```bash
# Terminal 1: Backend
cd server && npx tsc
node server/dev.mjs            # http://localhost:3001

# Terminal 2: Frontend
node node_modules/vite/bin/vite.js --config client/vite.config.ts --port 5173
# http://localhost:5173
```

**Default login:** `admin` / `admin123`

> ⚠️ Change the admin password after first login!

### Production Build

```bash
# Build frontend
cd client && node ../node_modules/vite/bin/vite.js build

# Build backend
cd server && npx tsc

# Run
node server/dev.mjs
```

---

## 🌐 Deployment (Nginx)

The `nginx/notesorganizer.conf` file provides a ready-to-use config:

```bash
# Copy config
sudo cp nginx/notesorganizer.conf /etc/nginx/sites-available/notesorganizer
sudo ln -s /etc/nginx/sites-available/notesorganizer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Start with PM2
pm2 start ecosystem.config.cjs
```

---

## 📡 API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Login with username/password |
| `GET /api/notebooks` | List all notebooks with tree |
| `POST /api/notes` | Create a note |
| `PUT /api/notes/:id/draft` | Auto-save draft |
| `POST /api/notes/:id/commit` | Save + create version |
| `GET /api/search?q=...` | Full-text search |
| `PATCH /api/notes/:id/favorite` | Toggle favorite |
| `PATCH /api/notes/:id/public` | Toggle public sharing |
| `GET /api/public/:slug` | View public note (no auth) |
| `GET /api/trash` | List deleted items |

See [copilot-instructions.md](.github/copilot-instructions.md) for the full API reference.

---

## 📁 Project Structure

```
NotesOrganizer/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── components/
│       │   ├── editor/        # NoteEditor, EditorToolbar, SplitEditor
│       │   ├── sidebar/       # SidebarTree (tree view + context menus)
│       │   ├── tags/          # TagPicker
│       │   ├── history/       # VersionHistory
│       │   ├── search/        # FilterDropdown
│       │   └── common/        # MoveNoteModal, PropertiesModal
│       ├── hooks/             # useAuth, useTheme
│       ├── layouts/           # MainLayout
│       ├── pages/             # LoginPage, PublicNotePage
│       └── stores/            # Zustand (appStore)
├── server/                    # Fastify backend
│   └── src/
│       ├── routes/            # 9 route files (auth, notebooks, folders, notes, tags, search, images, trash, export)
│       ├── services/          # storage.ts, versioning.ts
│       └── plugins/           # JWT auth
├── nginx/                     # Nginx config
└── ecosystem.config.cjs       # PM2 config
```

---

## 🔧 Environment Variables

Create `server/.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-random-secret-here"
JWT_REFRESH_SECRET="another-random-secret"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgements

- [TipTap](https://tiptap.dev/) — WYSIWYG editor
- [CodeMirror](https://codemirror.net/) — Code editor
- [Prisma](https://www.prisma.io/) — Database ORM
- [Fastify](https://fastify.dev/) — Web framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Lucide](https://lucide.dev/) — Icons
- [shadcn/ui](https://ui.shadcn.com/) — UI inspiration
