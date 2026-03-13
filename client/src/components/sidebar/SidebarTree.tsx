import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import { toast } from 'sonner';
import MoveNoteModal from '../common/MoveNoteModal';
import PropertiesModal from '../common/PropertiesModal';
import FilterDropdown from '../search/FilterDropdown';
import {
  BookOpen, Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  Plus, Star, Circle, Trash2, RotateCcw, Eye, ChevronsUpDown, ChevronsDownUp, Pin, Globe,
} from 'lucide-react';

interface Notebook {
  id: string; name: string; color: string; icon: string; sortOrder: number;
  folders: FolderItem[]; notes: NoteListItem[];
}
interface FolderItem {
  id: string; name: string; sortOrder: number;
  children?: FolderItem[]; notes?: NoteListItem[];
}
interface NoteListItem {
  id: string; title: string; isPinned: boolean; isFavorite: boolean;
  isDirty: boolean; isPublic?: boolean; publicSlug?: string | null; sortOrder: number; createdAt: string; updatedAt: string;
}

interface Props {
  notebooks: Notebook[];
  loading: boolean;
}

export default function SidebarTree({ notebooks, loading }: Props) {
  const queryClient = useQueryClient();
  const {
    selectedNoteId, setSelectedNote, addRecentNote,
    expandedNodes, toggleNode, expandAll, collapseAll, expandNode,
  } = useAppStore();

  // Auto-expand tree path to reveal the selected note
  useEffect(() => {
    if (!selectedNoteId || !notebooks.length) return;

    const findNotePath = (nbs: Notebook[]): string[] | null => {
      for (const nb of nbs) {
        // Check root notes
        if (nb.notes.some(n => n.id === selectedNoteId)) return [nb.id];
        // Check folders recursively
        const searchFolders = (folders: FolderItem[], path: string[]): string[] | null => {
          for (const f of folders) {
            if (f.notes?.some(n => n.id === selectedNoteId)) return [...path, f.id];
            if (f.children) {
              const found = searchFolders(f.children, [...path, f.id]);
              if (found) return found;
            }
          }
          return null;
        };
        const folderPath = searchFolders(nb.folders, [nb.id]);
        if (folderPath) return folderPath;
      }
      return null;
    };

    const path = findNotePath(notebooks);
    if (path) {
      path.forEach(id => expandNode(id));
    }
  }, [selectedNoteId, notebooks]); // eslint-disable-line react-hooks/exhaustive-deps

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: string; id: string; notebookId?: string; depth?: number;
  } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null);
  const [moveAction, setMoveAction] = useState<'move' | 'copy'>('move');
  const [showTrash, setShowTrash] = useState(false);
  const [propsTarget, setPropsTarget] = useState<{ type: string; id: string; name: string; color?: string } | null>(null);
  const [trashPreview, setTrashPreview] = useState<{ id: string; name: string; type: string; path?: string; content?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<{ type: string; id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Fix #1: Close context menu on ANY click anywhere (window-level)
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // Trash data
  const { data: trashData } = useQuery({
    queryKey: ['trash'],
    queryFn: () => api<{ items: { id: string; name?: string; title?: string; type: string; deletedAt: string; path?: string }[] }>('/trash'),
    enabled: showTrash,
  });

  // Filtered notes
  const { data: filteredData } = useQuery({
    queryKey: ['notes', 'filtered', activeFilter],
    queryFn: () => api<{ notes: { id: string; title: string; isPinned: boolean; isFavorite: boolean; isDirty: boolean; notebookId: string; folderId: string | null; createdAt: string; updatedAt: string; notebook?: { name: string }; folder?: { name: string }; tags?: { tag: { id: string; name: string; color: string } }[] }[] }>(`/notes?filter=${activeFilter}`),
    enabled: !!activeFilter,
  });

  // Mutations
  const createNotebook = useMutation({
    mutationFn: (name: string) => api('/notebooks', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notebooks'] }); toast.success('Notebook created'); },
  });

  const createFolder = useMutation({
    mutationFn: (data: { name: string; notebookId: string; parentId?: string }) =>
      api('/folders', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notebooks'] }); toast.success('Folder created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createNote = useMutation({
    mutationFn: (data: { notebookId: string; folderId?: string }) =>
      api<{ note: { id: string; title: string } }>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setSelectedNote(data.note.id);
      addRecentNote(data.note.id, data.note.title);
      toast.success('Note created');
    },
  });

  const renameItem = useMutation({
    mutationFn: ({ type, id, name }: { type: string; id: string; name: string }) => {
      const endpoint = type === 'notebook' ? `/notebooks/${id}`
        : type === 'folder' ? `/folders/${id}`
        : `/notes/${id}`;
      const body = type === 'note' ? { title: name } : { name };
      return api(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notebooks'] }); setRenameId(null); },
  });

  const deleteItem = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => {
      const endpoint = type === 'notebook' ? `/notebooks/${id}`
        : type === 'folder' ? `/folders/${id}`
        : `/notes/${id}`;
      return api(endpoint, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast.success('Moved to trash');
    },
  });

  const moveNote = useMutation({
    mutationFn: ({ noteId, notebookId, folderId }: { noteId: string; notebookId: string; folderId: string | null }) =>
      api(`/notes/${noteId}/move`, { method: 'PATCH', body: JSON.stringify({ notebookId, folderId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setMoveNoteId(null);
      toast.success('Note moved');
    },
  });

  const copyNote = useMutation({
    mutationFn: ({ noteId, notebookId, folderId }: { noteId: string; notebookId: string; folderId: string | null }) =>
      api<{ note: { id: string; title: string } }>(`/notes/${noteId}/copy`, { method: 'POST', body: JSON.stringify({ notebookId, folderId }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setMoveNoteId(null);
      toast.success(`Copied as "${data.note.title}"`);
    },
  });

  const restoreItem = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      api(`/trash/${id}/restore?type=${type}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast.success('Restored');
    },
  });

  const permanentDelete = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      api(`/trash/${id}?type=${type}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast.success('Permanently deleted');
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (noteId: string) =>
      api(`/notes/${noteId}/favorite`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const togglePin = useMutation({
    mutationFn: (noteId: string) =>
      api(`/notes/${noteId}/pin`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const togglePublic = useMutation({
    mutationFn: (noteId: string) =>
      api<{ note: { isPublic: boolean; publicSlug: string | null } }>(`/notes/${noteId}/public`, { method: 'PATCH' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      if (data.note.isPublic && data.note.publicSlug) {
        const url = `${window.location.origin}/public/${data.note.publicSlug}`;
        navigator.clipboard.writeText(url).then(() => {
          toast.success('Public link copied to clipboard');
        }).catch(() => {
          toast.success(`Public link: ${url}`);
        });
      } else {
        toast.success('Note is now private');
      }
    },
  });

  const reorderItems = useMutation({
    mutationFn: (data: { type: string; items: { id: string; sortOrder: number }[] }) =>
      api('/notes/reorder', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, type: string, id: string) => {
    setDragItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragItem(null);
    setDropTarget(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDropReorder = (e: React.DragEvent, targetId: string, siblings: { id: string }[], type: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragItem || dragItem.type !== type || dragItem.id === targetId) return;

    const ids = siblings.map(s => s.id);
    const fromIdx = ids.indexOf(dragItem.id);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Reorder: remove from old position, insert at new
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragItem.id);

    // Build new sort orders
    const items = ids.map((id, i) => ({ id, sortOrder: i }));
    reorderItems.mutate({ type, items });
    setDragItem(null);
  };

  const handleContextMenu = (e: React.MouseEvent, type: string, id: string, notebookId?: string, parentId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, notebookId, parentId });
  };

  const handleRenameSubmit = () => {
    if (!renameId || !renameValue.trim()) { setRenameId(null); return; }
    renameItem.mutate({ type: renameId.startsWith('nb:') ? 'notebook' : renameId.startsWith('f:') ? 'folder' : 'note', id: renameId.replace(/^(nb:|f:|n:)/, ''), name: renameValue.trim() });
  };

  const startRename = (type: string, id: string, currentName: string) => {
    const prefix = type === 'notebook' ? 'nb:' : type === 'folder' ? 'f:' : 'n:';
    setRenameId(prefix + id);
    setRenameValue(currentName);
    setContextMenu(null);
  };

  const openProperties = (type: string, id: string, name: string, color?: string) => {
    setPropsTarget({ type, id, name, color });
    setContextMenu(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const sortNotes = (notes: NoteListItem[]) =>
    [...notes].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));

  if (loading) {
    return (
      <div className="flex-1 p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const renderNote = (note: NoteListItem, depth: number, siblings?: NoteListItem[]) => {
    const isActive = selectedNoteId === note.id;
    const isRenaming = renameId === `n:${note.id}`;
    const isDropTarget = dropTarget === `n:${note.id}`;

    return (
      <div
        key={note.id}
        draggable={!isRenaming}
        onDragStart={(e) => handleDragStart(e, 'note', note.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, `n:${note.id}`)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => siblings && handleDropReorder(e, note.id, siblings, 'note')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors group ${
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground/80'
        } ${isDropTarget && dragItem?.type === 'note' ? 'border-t-2 border-primary' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => { setSelectedNote(note.id); addRecentNote(note.id, note.title); }}
        onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
        title={`Created: ${formatDate(note.createdAt)}\nModified: ${formatDate(note.updatedAt)}${note.isFavorite ? '\n★ Favorite' : ''}${note.isDirty ? '\n● Unsaved changes' : ''}`}
      >
        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenameId(null); }}
            className="flex-1 text-xs bg-transparent border border-ring rounded px-1 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-xs">{note.title}</span>
        )}
        {note.isPinned && <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        {note.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
        {note.isPublic && <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />}
        {note.isDirty && <Circle className="w-2 h-2 fill-primary text-primary flex-shrink-0" />}
      </div>
    );
  };

  const renderFolder = (folder: FolderItem, depth: number, notebookId: string, folderSiblings?: FolderItem[]) => {
    const isExpanded = expandedNodes.has(folder.id);
    const canNest = depth < 3;
    const isFolderDropTarget = dropTarget === `f:${folder.id}`;

    return (
      <div key={folder.id}>
        <div
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, 'folder', folder.id); }}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, `f:${folder.id}`); }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { e.stopPropagation(); folderSiblings && handleDropReorder(e, folder.id, folderSiblings, 'folder'); }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-sm hover:bg-accent/50 transition-colors group ${
            isFolderDropTarget && dragItem?.type === 'folder' ? 'border-t-2 border-primary' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleNode(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, notebookId, depth)}
          title={`Folder: ${folder.name}\nNotes: ${folder.notes?.length || 0}\nDepth: ${depth}/3`}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
          {isExpanded ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" /> : <Folder className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />}
          {renameId === `f:${folder.id}` ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenameId(null); }}
              className="flex-1 text-xs bg-transparent border border-ring rounded px-1 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-xs font-medium">{folder.name}</span>
          )}
          {/* Inline add note */}
          <button
            onClick={(e) => { e.stopPropagation(); createNote.mutate({ notebookId, folderId: folder.id }); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
            title="New note"
          >
            <FileText className="w-3 h-3" />
          </button>
          {/* Inline add subfolder (only if depth < 3) */}
          {canNest && (
            <button
              onClick={(e) => { e.stopPropagation(); const name = prompt('Subfolder name:'); if (name?.trim()) createFolder.mutate({ name: name.trim(), notebookId, parentId: folder.id }); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
              title="New subfolder"
            >
              <Folder className="w-3 h-3" />
            </button>
          )}
        </div>
        {isExpanded && (
          <>
            {folder.children?.map((child) => renderFolder(child, depth + 1, notebookId, folder.children))}
            {folder.notes?.length ? sortNotes(folder.notes).map((note) => renderNote(note, depth + 1, folder.notes)) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notebooks</span>
        <div className="flex items-center gap-0.5">
          <FilterDropdown activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          <button
            onClick={() => {
              // Collect all notebook + folder IDs
              const ids: string[] = [];
              const collectIds = (folders: FolderItem[]) => {
                for (const f of folders) {
                  ids.push(f.id);
                  if (f.children) collectIds(f.children);
                }
              };
              for (const nb of notebooks) {
                ids.push(nb.id);
                collectIds(nb.folders);
              }
              expandAll(ids);
            }}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            title="Expand all"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => collapseAll()}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            title="Collapse all"
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const name = prompt('Notebook name:');
              if (name?.trim()) createNotebook.mutate(name.trim());
            }}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="New notebook"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree or Filtered View */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {activeFilter ? (
          /* Filtered tree — show full hierarchy but only branches with matching notes */
          <div>
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                {activeFilter === 'favorites' ? '★ Favorites' : activeFilter === 'recent' ? '🕐 Recent' : activeFilter.startsWith('tag:') ? `🏷 ${activeFilter.substring(4)}` : activeFilter}
              </span>
              <button onClick={() => setActiveFilter(null)} className="text-xs text-primary hover:underline">Clear</button>
            </div>
            {!filteredData?.notes.length ? (
              <div className="text-center text-xs text-muted-foreground py-6">No notes match this filter</div>
            ) : (
              (() => {
                // Build a set of matching note IDs
                const matchingIds = new Set(filteredData.notes.map(n => n.id));
                // Filter the tree to only show branches containing matching notes
                const filterFolder = (folder: FolderItem): FolderItem | null => {
                  const matchingNotes = folder.notes?.filter(n => matchingIds.has(n.id)) || [];
                  const matchingChildren = (folder.children || []).map(filterFolder).filter(Boolean) as FolderItem[];
                  if (matchingNotes.length === 0 && matchingChildren.length === 0) return null;
                  return { ...folder, notes: matchingNotes, children: matchingChildren };
                };
                const filteredNotebooks = notebooks
                  .map(nb => {
                    const matchingRootNotes = nb.notes.filter(n => matchingIds.has(n.id));
                    const matchingFolders = nb.folders.map(filterFolder).filter(Boolean) as FolderItem[];
                    if (matchingRootNotes.length === 0 && matchingFolders.length === 0) return null;
                    return { ...nb, notes: matchingRootNotes, folders: matchingFolders };
                  })
                  .filter(Boolean) as Notebook[];

                return filteredNotebooks.map(nb => (
                  <div key={nb.id}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-foreground/80">
                      <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{nb.name}</span>
                      {nb.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nb.color }} />}
                    </div>
                    {nb.folders.map(f => renderFolder(f, 1, nb.id, nb.folders))}
                    {nb.notes.map(n => renderNote(n, 1, nb.notes))}
                  </div>
                ));
              })()
            )}
          </div>
        ) : notebooks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No notebooks yet</p>
            <button
              onClick={() => {
                const name = prompt('Notebook name:');
                if (name?.trim()) createNotebook.mutate(name.trim());
              }}
              className="text-xs text-primary hover:underline mt-1"
            >
              Create one
            </button>
          </div>
        ) : (
          notebooks.map((nb) => {
            const isExpanded = expandedNodes.has(nb.id);
            return (
              <div key={nb.id}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'notebook', nb.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, `nb:${nb.id}`)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropReorder(e, nb.id, notebooks, 'notebook')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group ${
                    dropTarget === `nb:${nb.id}` && dragItem?.type === 'notebook' ? 'border-t-2 border-primary' : ''
                  }`}
                  onClick={() => toggleNode(nb.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'notebook', nb.id, nb.id)}
                  title={`Notebook: ${nb.name}\nNotes: ${nb.notes.length}\nFolders: ${nb.folders.length}`}
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  {renameId === `nb:${nb.id}` ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenameId(null); }}
                      className="flex-1 text-sm bg-transparent border border-ring rounded px-1 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm font-medium">{nb.name}</span>
                  )}
                  {/* Color dot — only when explicitly set */}
                  {nb.color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nb.color }} />}
                  {/* Inline add buttons */}
                  <button
                    onClick={(e) => { e.stopPropagation(); createNote.mutate({ notebookId: nb.id }); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
                    title="New note"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); const name = prompt('Folder name:'); if (name?.trim()) createFolder.mutate({ name: name.trim(), notebookId: nb.id }); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
                    title="New folder"
                  >
                    <Folder className="w-3 h-3" />
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-0">
                    {nb.folders.map((folder) => renderFolder(folder, 1, nb.id, nb.folders))}
                    {sortNotes(nb.notes).map((note) => renderNote(note, 1, nb.notes))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Trash Section */}
      <div className="border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={() => setShowTrash(!showTrash)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {showTrash ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Trash2 className="w-3.5 h-3.5" />
          <span>Trash</span>
        </button>
        {showTrash && (
          <div className="max-h-48 overflow-y-auto px-1 pb-1">
            {!trashData?.items.length ? (
              <div className="text-center text-xs text-muted-foreground py-3">Trash is empty</div>
            ) : (
              trashData.items.map(item => (
                <div key={item.id} className="px-2 py-1.5 text-xs text-muted-foreground group hover:bg-accent/30 rounded transition-colors">
                  <div className="flex items-center gap-1.5">
                    {item.type === 'notebook' ? <BookOpen className="w-3 h-3 flex-shrink-0 opacity-50" /> :
                     item.type === 'folder' ? <Folder className="w-3 h-3 flex-shrink-0 opacity-50" /> :
                     <FileText className="w-3 h-3 flex-shrink-0 opacity-50" />}
                    <span className="flex-1 truncate font-medium">{item.name || item.title}</span>
                    {item.type === 'note' && (
                      <button
                        onClick={async () => {
                          try {
                            const data = await api<{ note: { content: string } }>(`/notes/${item.id}`);
                            setTrashPreview({ id: item.id, name: item.name || item.title || '', type: item.type, path: item.path, content: data.note.content });
                          } catch {
                            setTrashPreview({ id: item.id, name: item.name || item.title || '', type: item.type, path: item.path, content: '(Could not load content)' });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground transition-all"
                        title="Preview"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => restoreItem.mutate({ id: item.id, type: item.type })}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground transition-all"
                      title="Restore"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Permanently delete?')) permanentDelete.mutate({ id: item.id, type: item.type }); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {item.path && (
                    <div className="text-[10px] text-muted-foreground/60 ml-[18px] mt-0.5 truncate">{item.path}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'notebook' && (
            <>
              <ContextMenuItem label="New Note" onClick={() => createNote.mutate({ notebookId: contextMenu.id })} />
              <ContextMenuItem label="New Folder" onClick={() => {
                const name = prompt('Folder name:');
                if (name?.trim()) createFolder.mutate({ name: name.trim(), notebookId: contextMenu.id });
              }} />
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Rename" onClick={() => {
                const nb = notebooks.find(n => n.id === contextMenu.id);
                if (nb) startRename('notebook', nb.id, nb.name);
              }} />
              <ContextMenuItem label="Properties" onClick={() => {
                const nb = notebooks.find(n => n.id === contextMenu.id);
                if (nb) openProperties('notebook', nb.id, nb.name, nb.color);
              }} />
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Delete" danger onClick={() => { deleteItem.mutate({ type: 'notebook', id: contextMenu.id }); setContextMenu(null); }} />
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <ContextMenuItem label="New Note" onClick={() => { createNote.mutate({ notebookId: contextMenu.notebookId!, folderId: contextMenu.id }); setContextMenu(null); }} />
              {(contextMenu.depth ?? 0) < 3 && (
                <ContextMenuItem label="New Subfolder" onClick={() => {
                  setContextMenu(null);
                  const name = prompt('Subfolder name:');
                  if (name?.trim()) createFolder.mutate({ name: name.trim(), notebookId: contextMenu.notebookId!, parentId: contextMenu.id });
                }} />
              )}
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Rename" onClick={() => {
                // Find folder name from tree
                const findFolder = (folders: FolderItem[], id: string): FolderItem | null => {
                  for (const f of folders) {
                    if (f.id === id) return f;
                    if (f.children) { const found = findFolder(f.children, id); if (found) return found; }
                  }
                  return null;
                };
                for (const nb of notebooks) {
                  const f = findFolder(nb.folders, contextMenu.id);
                  if (f) { startRename('folder', f.id, f.name); break; }
                }
              }} />
              <ContextMenuItem label="Properties" onClick={() => {
                const findFolder2 = (folders: FolderItem[], id: string): FolderItem | null => {
                  for (const f of folders) { if (f.id === id) return f; if (f.children) { const found = findFolder2(f.children, id); if (found) return found; } } return null;
                };
                for (const nb of notebooks) {
                  const f = findFolder2(nb.folders, contextMenu.id);
                  if (f) { openProperties('folder', f.id, f.name); break; }
                }
              }} />
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Delete" danger onClick={() => { deleteItem.mutate({ type: 'folder', id: contextMenu.id }); setContextMenu(null); }} />
            </>
          )}
          {contextMenu.type === 'note' && (
            <>
              <ContextMenuItem label="Rename" onClick={() => {
                const findNote = (nb: Notebook): NoteListItem | null => {
                  for (const n of nb.notes) { if (n.id === contextMenu.id) return n; }
                  const searchFolders = (folders: FolderItem[]): NoteListItem | null => {
                    for (const f of folders) {
                      if (f.notes) for (const n of f.notes) { if (n.id === contextMenu.id) return n; }
                      if (f.children) { const found = searchFolders(f.children); if (found) return found; }
                    }
                    return null;
                  };
                  return searchFolders(nb.folders);
                };
                for (const nb of notebooks) { const n = findNote(nb); if (n) { startRename('note', n.id, n.title); break; } }
              }} />
              <ContextMenuItem label="Properties" onClick={() => {
                const findNote2 = (nb: Notebook): NoteListItem | null => {
                  for (const n of nb.notes) { if (n.id === contextMenu.id) return n; }
                  const search = (folders: FolderItem[]): NoteListItem | null => {
                    for (const f of folders) { if (f.notes) for (const n of f.notes) { if (n.id === contextMenu.id) return n; } if (f.children) { const r = search(f.children); if (r) return r; } } return null;
                  };
                  return search(nb.folders);
                };
                for (const nb of notebooks) { const n = findNote2(nb); if (n) { openProperties('note', n.id, n.title); break; } }
              }} />
              <div className="border-t border-border my-1" />
              {(() => {
                const findNote3 = (nb: Notebook): NoteListItem | null => {
                  for (const n of nb.notes) { if (n.id === contextMenu.id) return n; }
                  const s = (folders: FolderItem[]): NoteListItem | null => {
                    for (const f of folders) { if (f.notes) for (const n of f.notes) { if (n.id === contextMenu.id) return n; } if (f.children) { const r = s(f.children); if (r) return r; } } return null;
                  };
                  return s(nb.folders);
                };
                let note: NoteListItem | null = null;
                for (const nb of notebooks) { note = findNote3(nb); if (note) break; }
                return (
                  <>
                    <ContextMenuItem
                      label={note?.isFavorite ? '★ Unfavorite' : '☆ Favorite'}
                      onClick={() => { toggleFavorite.mutate(contextMenu.id); setContextMenu(null); }}
                    />
                    <ContextMenuItem
                      label={note?.isPinned ? 'Unpin' : 'Pin to top'}
                      onClick={() => { togglePin.mutate(contextMenu.id); setContextMenu(null); }}
                    />
                    <ContextMenuItem
                      label={note?.isPublic ? '🔓 Make private' : '🔗 Share publicly'}
                      onClick={() => { togglePublic.mutate(contextMenu.id); setContextMenu(null); }}
                    />
                    {note?.isPublic && note?.publicSlug && (
                      <ContextMenuItem
                        label="📋 Copy public link"
                        onClick={() => {
                          const url = `${window.location.origin}/public/${note.publicSlug}`;
                          navigator.clipboard.writeText(url).then(() => toast.success('Public link copied')).catch(() => toast.info(url));
                          setContextMenu(null);
                        }}
                      />
                    )}
                  </>
                );
              })()}
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Move to..." onClick={() => { setMoveNoteId(contextMenu.id); setMoveAction('move'); setContextMenu(null); }} />
              <ContextMenuItem label="Copy to..." onClick={() => { setMoveNoteId(contextMenu.id); setMoveAction('copy'); setContextMenu(null); }} />
              <div className="border-t border-border my-1" />
              <ContextMenuItem label="Delete" danger onClick={() => { deleteItem.mutate({ type: 'note', id: contextMenu.id }); if (selectedNoteId === contextMenu.id) setSelectedNote(null); setContextMenu(null); }} />
            </>
          )}
        </div>
      )}
      
      {/* Move/Copy Modal */}
      {moveNoteId && (
        <MoveNoteModal
          currentNotebookId=""
          currentFolderId={null}
          title={moveAction === 'move' ? 'Move to...' : 'Copy to...'}
          onSelect={(notebookId, folderId) => {
            if (moveAction === 'move') {
              moveNote.mutate({ noteId: moveNoteId, notebookId, folderId });
            } else {
              copyNote.mutate({ noteId: moveNoteId, notebookId, folderId });
            }
          }}
          onClose={() => setMoveNoteId(null)}
        />
      )}

      {/* Properties Modal */}
      {propsTarget && (
        <PropertiesModal
          type={propsTarget.type}
          id={propsTarget.id}
          name={propsTarget.name}
          color={propsTarget.color}
          onClose={() => { setPropsTarget(null); queryClient.invalidateQueries({ queryKey: ['notebooks'] }); }}
        />
      )}

      {/* Trash Preview Modal */}
      {trashPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setTrashPreview(null)}>
          <div className="bg-popover border border-border rounded-xl shadow-2xl w-[600px] max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="font-medium text-sm">{trashPreview.name}</div>
                {trashPreview.path && <div className="text-xs text-muted-foreground mt-0.5">was in: {trashPreview.path}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { restoreItem.mutate({ id: trashPreview.id, type: trashPreview.type }); setTrashPreview(null); }}
                  className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Restore
                </button>
                <button onClick={() => setTrashPreview(null)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80">{trashPreview.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${danger ? 'text-destructive' : ''}`}
    >
      {label}
    </button>
  );
}
