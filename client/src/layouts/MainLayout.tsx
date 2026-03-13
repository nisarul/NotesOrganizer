import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import SidebarTree from '../components/sidebar/SidebarTree';
import NoteEditor from '../components/editor/NoteEditor';
import {
  Sun, Moon, Search, PanelLeftClose, PanelLeft,
  LogOut, BookOpen,
} from 'lucide-react';

export default function MainLayout() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { noteId: urlNoteId } = useParams<{ noteId?: string }>();
  const {
    sidebarCollapsed, toggleSidebar,
    selectedNoteId, setSelectedNote,
    recentNotes, addRecentNote,
  } = useAppStore();

  // Sync URL → state on mount
  useEffect(() => {
    if (urlNoteId && urlNoteId !== selectedNoteId) {
      setSelectedNote(urlNoteId);
    }
  }, [urlNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state → URL when note changes
  useEffect(() => {
    if (selectedNoteId) {
      navigate(`/note/${selectedNoteId}`, { replace: true });
    } else if (window.location.pathname.startsWith('/note/')) {
      navigate('/', { replace: true });
    }
  }, [selectedNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 280;
  });
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(600, startW + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      localStorage.setItem('sidebarWidth', String(sidebarWidth));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Search query
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
  });

  const handleSearchSelect = (noteId: string, title: string) => {
    setSelectedNote(noteId);
    addRecentNote(noteId, title);
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Fetch tree data
  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ['notebooks'],
    queryFn: () => api<{ notebooks: Notebook[] }>('/notebooks'),
  });

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-3 gap-2 flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-20">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-accent transition-colors">
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-1.5 mr-4">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">NotesOrganizer</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search notes...</span>
            <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+K</kbd>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleTheme} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="text-xs text-muted-foreground px-2">{user?.username}</div>
          <button onClick={logout} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-destructive" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <>
            <aside
              className="bg-sidebar flex flex-col overflow-hidden flex-shrink-0 border-r border-sidebar-border"
              style={{ width: sidebarWidth }}
            >
              <SidebarTree notebooks={treeData?.notebooks || []} loading={treeLoading} />
            </aside>
            {/* Drag handle */}
            <div
              className="w-1 hover:w-1.5 hover:bg-primary/30 cursor-col-resize flex-shrink-0 transition-all"
              onMouseDown={startResize}
            />
          </>
        )}

        {/* Editor area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedNoteId ? (
            <NoteEditor key={selectedNoteId} noteId={selectedNoteId} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Select a note to start editing</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Or create a new one from the sidebar</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Recently opened */}
      {recentNotes.length > 0 && (
        <div className="h-8 border-t border-border flex items-center px-3 gap-1 flex-shrink-0 overflow-x-auto">
          <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">Recent:</span>
          {recentNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => { setSelectedNote(note.id); addRecentNote(note.id, note.title); }}
              className={`text-xs px-2 py-0.5 rounded hover:bg-accent transition-colors flex-shrink-0 ${
                selectedNoteId === note.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }`}
            >
              {note.title}
            </button>
          ))}
        </div>
      )}

      {/* Search modal overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
          <div className="w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="flex-1 bg-transparent outline-none text-sm"
                autoFocus
              />
            </div>
            {searchResults?.results && searchResults.results.length > 0 && (
              <div className="max-h-80 overflow-y-auto py-2">
                {searchResults.results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSearchSelect(result.id, result.title)}
                    className="w-full px-4 py-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <div className="text-sm font-medium">{result.title}</div>
                    {result.snippet && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.snippet}</div>
                    )}
                    {result.notebook && (
                      <div className="text-xs text-muted-foreground/60 mt-0.5">
                        {result.notebook.name}
                        {result.folder && ` > ${result.folder.name}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults?.results?.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Types
interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  notebook: { id: string; name: string } | null;
  folder: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
  updatedAt: string;
}

interface Notebook {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  folders: Folder[];
  notes: NoteListItem[];
  _count: { notes: number };
}

interface Folder {
  id: string;
  name: string;
  sortOrder: number;
  children?: Folder[];
  notes?: NoteListItem[];
}

interface NoteListItem {
  id: string;
  title: string;
  isPinned: boolean;
  isFavorite: boolean;
  isDirty: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
